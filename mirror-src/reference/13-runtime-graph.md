# Runtime Graph

> 対象読者: Tier 2/3（チーム導入者、フレームワーク貢献者）。

この章は、v0.5.0 milestone 8 で導入されたワークフロー単位の `runtime-graph.json`
成果物を文書化する — `stage-graph.json` のデータプレーン側の鏡であり、承認 gate の
たびに audit ログから実体化される。[Plane アーキテクチャ](02-plane-architecture.md)
（この成果物を動機づける制御/データプレーンの分離）と
[状態機械](12-state-machine.md)（その遷移が compile を起動するライフサイクル）を
相互参照せよ。

---

## 1. それは何か

`stage-graph.json` は構造の真である — すべての stage 定義、すべての
`requires_stage` / `produces` / `consumes` エッジ。ワークフロー実行をまたいで
安定である。

`runtime-graph.json` は実行の真である — *現在の*ワークフローについて、どの stage が
始まったか、どれが承認されたか、各 stage の memory.md がどう見えるか、どの sensor が
発火したか。ワークフローごとに 1 ファイルで、`<record>/runtime-graph.json` に住む —
`<record>/` = intent の record dir、`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`。
`stage-graph.json` と同じノード形状で、構造の代わりに遠隔測定で満たされる。

これが存在するのは、消費者（milestone 11 の Bolt fork/merge、milestone 12 の gate ritual、
milestone 14 の doctor、v0.10.0 の cross-workflow observer）が、照会のたびに audit ログを
歩き直すのではなく、1 つの実体化されたビューを読むためである。

---

## 2. スキーマ

下の TS インターフェースはロックされた契約である。変更するには、同じ PR で
すべての消費者を bump する必要がある。

```ts
interface RuntimeGraph {
  workflow_id: string;            // ISO timestamp from LATEST WORKFLOW_STARTED audit row (so a re-birthed intent identifies the live workflow, not a dead one)
  scope: string;                  // from state.md "Scope" field
  started_at: string;             // ISO 8601, same row as workflow_id
  stages: RuntimeStage[];         // chronological order by started_at
  bolt_dag?: BoltDag;             // present only when units-generation's unit-of-work-dependency.md carries a valid (well-formed, acyclic) fenced edge block; absent/malformed/cyclic blocks omit the node
}

interface BoltDag {
  units: { name: string; depends_on: string[]; kind?: string }[]; // verbatim from the authored edge block; kind (service|spec|ui|packaging|library) present only when the edge block tags the unit
  batches: string[][];            // topological levels; each level = units whose deps are all satisfied by prior levels; level entries sorted lexicographically (deterministic)
}

interface RuntimeStage {
  stage_slug: string;
  started_at: string | null;      // ISO from STAGE_STARTED; null when `instances` is present
  completed_at: string | null;    // ISO from STAGE_COMPLETED; null when pending OR when `instances` is present
  agent: string | null;           // lead_agent; null when `instances` is present
  memory_path: string;            // <record>/<phase>/<stage>/memory.md (parent stage path even on instance-bearing rows)
  memory_entries: number | null;  // null = no memory.md file OR `instances` is present; else parseMemoryHeadings.total
  memory_breakdown: {             // null when memory_entries is null
    interpretations: number;
    deviations: number;
    tradeoffs: number;
    open_questions: number;
  } | null;
  sensor_firings: SensorFiring[]; // empty array in milestone 8 (sensors fire in milestone 9 + milestone 10)
  outcome: "approved" | "failed" | "pending";
  learnings_captured: {           // null on pending rows; populated on transition to approved
    from_orchestrator: number;    // zero in milestone 8 (gate ritual is milestone 12)
    from_user_addition: number;
  } | null;
  instances?: BoltInstance[];     // present only when stage runs per-Bolt; milestone 11 populates
}

interface BoltInstance {
  bolt: string;
  worktree: string;
  started_at: string;
  completed_at: string | null;
  memory_path: string;
  memory_entries: number | null;
  memory_breakdown: { interpretations: number; deviations: number; tradeoffs: number; open_questions: number; } | null;
  sensor_firings: SensorFiring[];
  outcome: "approved" | "failed" | "pending";
}

interface SensorFiring {
  id: string;
  fire_id: string;                // 8-hex correlator emitted by the milestone 9 dispatcher on every row
  result: "passed" | "failed" | "budget-override" | "incomplete"; // 4-state (milestone 12 Q10)
  ts: string;                     // FIRED row's timestamp
  detail_path?: string;
}
```

`instances` が在るとき、stage 行の単一インスタンスフィールド（`started_at`、
`completed_at`、`memory_entries`、`memory_breakdown`）は NULL である — それらの値は
代わりに各インスタンスに載る。stage 行のフィールドとインスタンス配列のフィールドは
決して共存しない。

### Bolt/unit 依存 DAG（`bolt_dag`）

任意の `bolt_dag` ノードは、engine が並列ビルドバッチを計算するために読む機械可読な
unit 依存グラフである — swarm の fan-out における「DAG が許可である」。そのソースは、
units-generation（2.7）が人間可読な散文の傍らで `unit-of-work-dependency.md` に
著述する **`yaml` フェンス付き `units:` エッジブロック** である:

```yaml
units:
  - name: auth
    kind: service
    depends_on: []
  - name: api
    depends_on: [auth]
```

各 unit は任意の `kind`（`service | spec | ui | packaging |
library`）を運べる — その unit が何であるか。それは `bolt_dag.units[].kind` にそのまま
乗り、unit 単位の construction 設計の刈り込みを駆動する（[Stage 定義](15-stage-definition.md)
の `produces_kinds` を参照）: stage の produces 成果物は、各 unit の kind に適用される
ものへと絞り込まれる。タグの無い unit は `kind` キーを持たず、設計成果物のマトリクス
全体を保つ。不正な kind 値はブロック全体を `malformed`（下記参照）にするので、typo は
誤って刈り込むのではなく 2.7 gate で大きな音で失敗する。

`compile` は *その構造化ブロック* を — 純粋なデータのパース、モデル呼び出し無し —
`units`（そのままのエッジ）と `batches`（トポロジカルなレベル）にパースする。各 batch は、
依存がすべて先行 batch によって満たされる unit の集合であり、したがって batch の unit は
相互依存を持たず並列に走れる。レベルのエントリは発行前に辞書順にソートされるので、
ノードは著述順に関わらず決定論的である。

ノードは、成果物が無いとき、あるいはそのエッジブロックが無い・malformed（重複名、
dangling または自己依存、パース不能）・cyclic のとき、**完全に省かれる** — `compile` は
理由を名指す stderr の診断を書き、誤って有効な DAG を発行するのではなく `bolt_dag` を
envelope から外す。それらの失敗は、同じブロックを検証し `edge_block: ok | absent |
malformed | cyclic` を報告する `required-sections` sensor によって、上流の 2.7 gate で
表面化される。エッジを構造化データとして著述すること（知的作業、一度きり、2.7 承認
gate の背後）が、hook 発火の `compile` を再実行でバイト同一に保つ: compile の経路に
モデルは座らない。orchestrate engine はキャッシュされた `bolt_dag` を
`unit-of-work-dependency.md` に対して検証し、ノードが無いかその著述された成果物と
食い違うとき、読み取り側で unit 単位のイテレーションを自己修復する; グラフファイル自体は
次の compile によってのみ修復される。

---

## 3. Compile のライフサイクル

compile は、遷移クラスの audit 発行のたびに PostToolUse Bash hook
（`.claude/hooks/aidlc-runtime-compile.ts`）によって起動される。この hook は
conductor からのすべての `Bash` ツール呼び出しで発火し、安価にフィルタする:

1. **Command filter** — `bun .claude/tools/aidlc-(state|jump|bolt|utility).ts`
   の呼び出しだけが early exit を通り抜ける。`aidlc-runtime.ts` は除外される
   （recursion guard）; `aidlc-log.ts` は饒舌な stage 内イベントのみを発行する;
   `aidlc-worktree.ts` は WORKTREE_* イベントのみを発行する。
2. **Audit-existence guard** — intent の `audit/` シャードがまだ存在しなければ exit する。
3. **Heartbeat** — doctor の silent-hook 検出のために
   `<record>/.aidlc-hooks-health/runtime-compile.last` を書く。
4. **Last-3-block tail-read** — `audit.md` を `\n---\n` で分割し、最後の 3 エントリを
   取る。
5. **Event-class filter** —
   `**Event**: (GATE_APPROVED|STAGE_STARTED|STAGE_AWAITING_APPROVAL|AUDIT_MERGED|WORKFLOW_COMPLETED)`
   を 3 ブロックのいずれかに対して照合する。合致しなければ exit する。
6. **Dispatch** — `spawnSync("bun", [".claude/tools/aidlc-runtime.ts", "compile", ...])`。

`WORKFLOW_COMPLETED` は遷移集合に在るので、最終 stage の approve が compile を
発火させる。`aidlc-state.ts:575-593` の `handleCompleteWorkflow` は 4 つの audit 行 —
STAGE_COMPLETED + PHASE_COMPLETED + PHASE_VERIFIED + WORKFLOW_COMPLETED — を発行し、
そのうち最後の 3 つは `PHASE_COMPLETED + PHASE_VERIFIED + WORKFLOW_COMPLETED` である。
（approve の経路では、approve が既に発行済みなので STAGE_COMPLETED は抑制され、
`GATE_APPROVED` が実行に先行する — だから最終 stage の approve は、いずれにせよ 1 回の
Bash 呼び出しで 5 行を追記する。）regex に `WORKFLOW_COMPLETED` が無ければ、
runtime-graph は最終 stage を approved として決して記録しないだろう。

compile 自体は audit ログ全体を歩き（したがって結果は event-sourced であり、遷移増分
ではない）、`STAGE_STARTED` を同じ slug の次の `STAGE_COMPLETED` と対にし、各 stage の
memory.md を `aidlc-lib.ts` の `parseMemoryHeadings()` 経由で読み、成果物を
`withAuditLock` の中で `writeFileAtomic` 経由でアトミックに書く。

---

## 4. Outcome enum と時系列のペアリング

3 つの outcome 値: `"approved" | "failed" | "pending"`。

- **approved** — `STAGE_STARTED@T1` が後続の `STAGE_COMPLETED@T2` と対になる。
  行の `completed_at` は `T2` である。
- **pending** — `STAGE_STARTED@T1` があり、その slug の後続の `STAGE_COMPLETED` が
  無い。行の `completed_at` は `null` である。
- **failed** — `instances[]` の親 stage rollup によってのみ発行される（単一インスタンスの
  stage は `"approved" | "pending"` のままである）。Construction stage の `instances[]` が
  空でないとき、親の `outcome` はそのインスタンスの rollup である: すべて approved →
  `approved`; いずれか failed → `failed`; それ以外（いずれか pending、失敗なし）→
  `pending`。単一インスタンスの stage は `failed` を発行しない。なぜなら基盤の
  `BOLT_FAILED` イベントは instances を持つ経路の外では Construction-stage スコープを
  持たないからである。

Re-jump の扱い: `/aidlc --stage <slug>` は、すでに完了した slug に対して
`STAGE_STARTED` を再発行する。audit ログは
`STAGE_STARTED@T1, STAGE_COMPLETED@T2, STAGE_STARTED@T3` を運ぶ。ペアリング規則は
`STARTED@T1` を `COMPLETED@T2` と合致させ → approved を生むはずだが、その slug の
最新の `STAGE_STARTED` がより古い行を上書きする — slug ごとに 1 行、最新の STARTED が
勝つ。したがって結果は `started_at: T3, completed_at: null` の pending 行である。

Single-stage の除外: `--single` の stage-runner 実行は、その
`STAGE_STARTED`/`STAGE_COMPLETED` の対を、合成された
`**Workflow**: single-stage:<slug>` id の下でコミットする（audit のみ;
`aidlc-orchestrate.ts` の `handleSingleReport` を参照）。ペアリングは、`Workflow`
フィールドが `single-stage:` で始まる `STAGE_*` 行をすべてスキップする — それらの行は
どのメインワークフローにも属さないので、メインの `runtime-graph.json` に行を作ることも
完了させることも決してない（したがって `summary` のカウントを膨らませることも決して
ない）。メインワークフローの `STAGE_*` 行は `Workflow` フィールドを持たない; 不在は行が
保たれることを意味する。同じ除外が `aidlc-state.ts` の `hasStageAuditEvent` 重複排除
チェックにも適用されるので、single 実行の `STAGE_COMPLETED` が、同じ slug のメイン
ワークフロー自身の完了発行を抑制することはできない。

---

## 5. MEMORY_EMPTY のセマンティクス

`MEMORY_EMPTY` audit 行は、stage 行が次のすべてを満たすとき compile によって発行される
（唯一の emitter — `audit-format.md:171` が `tools/aidlc-runtime.ts compile` を登録する）:

- `outcome === "approved"`（pending 行は発行しない — 下の §6 を参照）
- `memory_entries === 0`（ファイルは存在し、正準の §13 の 4 見出しの下にエントリが 0）

エントリが 0 の pending 行は発行しない。まだ進行中の stage は、conductor がまだ memory.md
に書いていないために正当にエントリ 0 でありうる — 進行中に MEMORY_EMPTY を発行すると、
本物の日記スキップを表さないノイズを生む。milestone 14 の doctor が欲しいシグナルは
「エントリ 0 で承認された stage」である — それには stage が承認されていることが必要である。

### 冪等性 — (slug, gate-completion) ごとに正確に一度

`runtime-graph.json` 自体は、同じ audit ログに対する再 compile をまたいでバイト等価で
ある。MEMORY_EMPTY の発行はより強い:
**`(stage_slug, completed_at)` タプルごとに最大 1 つの MEMORY_EMPTY 行**。

ロックされた区画の中で、compile は `audit.md` を再読し、エントリ 0 で承認された各 slug
について既存の MEMORY_EMPTY 行を走査し、いずれかの先行行の Timestamp がこの slug の
`completed_at` 以上であれば発行を抑制する。これが意味するのは:

- stage がエントリ 0 で承認された後の最初の compile は、1 つの MEMORY_EMPTY 行を発行する。
- 同じワークフロー中のその後の compile はすべて、その slug について再発行しない。
- `--stage <slug>` の re-jump + 再承認は新しい `STAGE_COMPLETED`（より後の
  `completed_at`）を生む — 再承認時に stage がなお空なら、先行行の Timestamp が今や新しい
  completed_at より < なので、新鮮な MEMORY_EMPTY 行が発行される。

doctor の MEMORY_EMPTY 率メトリクスは、重複排除なしにこれらの行を直接読む; 空の日記を
伴う gate 完了ごとに 1 行。

ロックされた区画の中で MEMORY_EMPTY が発行された後に成果物の書き込みが失敗すると、
audit ログは runtime-graph.json が決して着地しなかった stage について N 個の
MEMORY_EMPTY 行を運ぶ。次の compile はその抑制走査でそれらの行を見て再発行をスキップ
する; そして成果物が着地する。重複発行なし、幻の成果物なし。

---

## 6. v0.4.0 の backfill 規則

milestone 13 の memory.md ライフサイクルが出荷される前に完了した stage は、memory.md の
履歴を持たない。backfill 規則:

- `memory_entries: null` ↔ `memory_breakdown: null` ↔ MEMORY_EMPTY 発行なし。
- 両フィールドは一緒に動く。判別子は「`parseMemoryHeadings` は実行されたか？」である —
  memory.md が存在すれば（ゼロバイトでも）実行され、キーは数値である; memory.md が
  無ければ、両方とも `null` である。

この規則が無ければ、v0.5.0 にアップグレードするすべての v0.4.x ユーザーは、アップグレード
後の最初のワークフローで MEMORY_EMPTY 行の嵐を見るだろう。

---

## 7. 復旧モデル — snapshot + suffix replay

`runtime-graph.json` + `audit.md` は event-sourced な対を成す。`audit.md` は追記専用の
イベントログ; `runtime-graph.json` は最後の gate 遷移で取られた実体化 snapshot である。
両方を持つ読み手は、snapshot を読み、次に snapshot の最後の `completed_at` 以降の audit
行を replay することで、現在の状態を再構成する。

人間の読み順で、5 つの復旧ソース:

1. **成果物ツリー**（`<record>/<phase>/<stage>/`） — 何が生産されたか。
2. **memory.md**（`<record>/<phase>/<stage>/memory.md`） — conductor が捕らえることを
   選んだもの。
3. **audit/ シャード** — 正準のイベントログ; 実際に何が起きたか。
4. **state.md** — アクティブ stage のカーソル。
5. **runtime-graph.json** — 実体化されたビュー; audit を歩き直すより照会が速いが、
   常にそこから再導出可能。

### pending 行の鮮度に関する注意

pending 行の `memory_entries` と `memory_breakdown` は、最後の compile 時点で snapshot
されたものである。stage が進行中で、conductor が最後の compile 発火以降にさらにエントリを
書いていれば、snapshot は遅れる。復旧の消費者は復旧時に memory.md を再パースしなければ
ならない; pending 行について snapshot されたカウントを信頼してはならない。

v0.5.0 には pending のカウントをライブで読む消費者は無い。この切り出しを必要とする
v0.6.0 の `--resume` のために文書化しておく。

### 並列 Bolt の進行中復旧（v0.5.0 で解決）

batch の途中でクラッシュする並列 Bolt を持つワークフローは、milestone 8 では Bolt 単位の
復旧の継ぎ目を持たなかった — スキーマは `instances?` を予約していたが、compile は main で
単一インスタンスの行しか書かず、worktree は runtime-graph fragment を決して受け取らな
かった。v0.5.0 で、`aidlc-runtime.ts fragment-fork`（Bolt 開始）と
`fragment-merge`（Bolt complete --merge）、および audit が Construction phase の stage の
ウィンドウ内に 2 つ以上の異なる slug を示すとき `BoltInstance[]` を発行する compile
populator の拡張によって解決された。

Bolt 単位の fragment は v0.5.0 では dead-on-arrival である（worktree の record-dir の
`runtime-graph.json` を読む v0.5.0 の読み手は無い）。v0.6.0 の `--resume` は、この
fragment をヒントとして扱い、main の merge 後の runtime-graph を正準とし、加えて
`aidlc-bolt.ts` に従って孤立した worktree をチェックして、それらのための復旧プロンプトを
表面化すべきである。

---

## 8. CLI サーフェス

```bash
# Walk audit + memory.md, write runtime-graph.json (invoked by hook).
bun .claude/tools/aidlc-runtime.ts compile

# Print one stage row from runtime-graph.json (debug/test surface).
bun .claude/tools/aidlc-runtime.ts read <stage-slug>

# Print deterministic aggregates over runtime-graph.json: stage/phase
# outcome tallies, memory-entry counts by category, sensor 4-state
# tallies, learnings captured, and workflow duration. Read-only; the
# session skills (session-cost, replay, outcomes-pack) consume the
# --json shape so every number they render comes from here, not from
# LLM-side counting.
bun .claude/tools/aidlc-runtime.ts summary [--json]

# Byte-copy main runtime-graph.json into a Bolt's worktree fragment
# (one-shot; called by `aidlc-bolt start --worktree`). No audit emit —
# the fragment lifecycle rides on STATE_FORKED + AUDIT_FORKED.
bun .claude/tools/aidlc-runtime.ts fragment-fork --slug <kebab-slug>

# Remove the worktree fragment (idempotent; called by
# `aidlc-bolt complete --merge`). No audit emit — the fragment
# lifecycle rides on STATE_MERGED + AUDIT_MERGED. Main's runtime-graph
# is rebuilt event-source by the post-Bash compile hook on AUDIT_MERGED.
bun .claude/tools/aidlc-runtime.ts fragment-merge --slug <kebab-slug>
```

すべてのサブコマンドは、標準の cwd ベースの解決を上書きするための
`--project-dir <path>` を受け付ける。

compile は通常運用では hook 駆動である; 手動起動はテストとデバッグのために存在する。

---

## 9. なぜ hook 駆動で、LLM ツール結合ではないか

以前の計画リビジョンは、`handleApprove` / `handleAdvance` / `handleComplete --merge` の
中に `spawnSibling(..., "aidlc-runtime.ts compile", ...)` 呼び出しを挿入することを
提案した。そのアプローチは、[Plane アーキテクチャ](02-plane-architecture.md) に
文書化された荷重を受けるテネットに違反する:

> 決定性が要るところでは、ツールを使え。知識が要るところでは、LLM/agent を使え。
> 判断が要るところでは、人間を使え。

Runtime-graph の compile は、いかなる特定のセッションの外からも観測可能でなければ
ならないデータプレーンの基盤である。それを LLM が起動するツールに結合すると、LLM の
脱落が決定性の保証を壊すことを意味する — 人間が Approve をクリックした後に conductor が
`aidlc-orchestrate.ts report --stage <slug> --result approved --user-input "<exact choice>"`
の呼び出しを忘れると、audit 行は決して追記されず、かつ compile は決して発火しない;
runtime-graph は静かに遅れ、復旧の基盤は壊れる。

PostToolUse Bash hook は、LLM が次に何をするかに関わらず、conductor の実際のサブ
プロセス起動で発火する。audit 発行側の継ぎ目（`bun aidlc-(state|jump|bolt|utility).ts`）が
決定論的なアンカーである。

---

## 10. 将来の PR で解決される既知のギャップ

- **MEMORY_EMPTY 率メトリクス** — milestone 14 の doctor が、§5 で凍結された
  `(Stage, ISO-second)` 重複排除タプルを使ってその率を表面化する。
- **`learnings_captured` の由来カウント** — milestone 12 の gate ritual が
  `from_orchestrator` と `from_user_addition` を満たす。
- **`sensor_firings` 配列** — milestone 9 + milestone 10 が sensor をディスパッチし、
  このスロットを満たす。
- **runtime-graph.json の Bolt fork/merge** — v0.5.0 で `fragment-fork`（新しい audit
  イベントなし; STATE_FORKED + AUDIT_FORKED に便乗）と `fragment-merge`（新しい audit
  イベントなし; STATE_MERGED + AUDIT_MERGED に便乗）によって解決された。compile は、
  Construction stage のウィンドウ内に 2 つ以上の異なる slug が座るとき、audit の
  BOLT_* タグ付きイベントから `instances[]` を満たす。
- **ヘッドレスワークフローのための CLI モードディスパッチ** — v0.6.0+ は非 Claude Code の
  実行経路を出荷するかもしれない; hook は Claude Code セッションの中でのみ発火する。

---

## 11. Fragment のライフサイクル

Bolt 単位の runtime-graph fragment ファイルは `<worktree>/<record>/runtime-graph.json`
に住み、gitignore され、main の位置を鏡写しにする。そのライフサイクルは:

1. **Bolt 開始時の fork。** `aidlc-bolt start --worktree --slug <slug>` は、state-fork +
   audit-fork の後に `aidlc-runtime fragment-fork --slug <slug>` に委譲する。単一読み取り
   プロトコル: `readFileSync` で一度バッファに読み、`writeFileSync` でそのバッファから
   fragment パスへ書き、同じバッファを stdout envelope 用にハッシュする。fork の途中で
   main を書き換える並行 compile に対する byte-copy / hash の競合を塞ぐ。main にまだ
   runtime-graph.json が無ければ、fragment は worktree の state カーソルに錨づけされた
   空グラフである。
2. **Bolt の生存中の進化。** post-Bash compile hook は、遷移クラスの audit 発行のたびに
   発火する — worktree 内の遷移を含む。各発火は、worktree の audit ビューから worktree の
   runtime-graph.json（fragment）を再 compile する。fragment は、この Bolt の audit-fork の
   瞬間にアクティブだった兄弟について `instances[]` が満たされた状態になりうる; worktree の
   audit は fork 時点の snapshot なので、後から始まる兄弟は fragment に現れない。
3. **Bolt complete 時の merge。** `aidlc-bolt complete --merge --slug <slug>` は、
   state-merge + audit-merge の後に `aidlc-runtime fragment-merge --slug <slug>` に
   委譲する。fragment-merge は fragment を stdout の可観測性のためにハッシュし、それを
   `unlinkSync` し、JSON envelope を発行する。親の Bash 起動が戻った後、compile hook が
   main で再発火し、たった今 merge された slug について `instances[]` を満たした状態で
   main の runtime-graph を再構築する。
4. **多層防御による除去。** `aidlc-worktree merge` と `aidlc-worktree discard` はどちらも
   `git worktree remove` を呼び、それが推移的に fragment を除去する。fragment-merge の
   明示的な除去は、暗黙のクリーンアップと多層防御パターンとして対になり、state 側で
   state-merge と `git worktree remove` が既に対になっているのを鏡写しにする。
5. **失敗モード。** `fragment-fork` の失敗（worktree なし、fragment がすでに存在、
   byte-copy IO エラー、spawn タイムアウト）は、`aidlc-bolt` に doctor の帰属のための
   `Reason: fragment-fork-*` フィールド付きの `BOLT_FAILED` を発行させる（IO / guard
   エラーには `fragment-fork-failed`; spawn SIGTERM には `fragment-fork-timeout`）;
   state-fork + audit-fork はロールバックされない（各々がすでに自身の audit 行を発行
   済み）。audit-merge がすでに着地した後の `fragment-merge` の失敗は、異常な部分成功の
   audit シグネチャ `BOLT_COMPLETED → STATE_MERGED → AUDIT_MERGED → BOLT_FAILED
   (Reason: fragment-merge-*)` を生む（IO / guard エラーには `fragment-merge-failed`;
   spawn SIGTERM には `fragment-merge-timeout`）; fragment ファイルは暗黙の
   `git worktree remove` クリーンアップまで残存する。main に対するその後の compile は、
   一貫した runtime-graph を生む（この位置の BOLT_FAILED はインスタンスを `"approved"` と
   採点する。なぜなら rollup における STATE_MERGED 優先の序列は、Bolt の内容がすでに main
   に伝播したことを反映するからである。ここでの BOLT_FAILED は復旧の遠隔測定である;
   それは継ぎ目を記録し、内容自体は無傷のままだった）。

---

## 次のステップ

- **なぜデータプレーンはこのように構造化されているか** — `runtime-graph.json` を第 2 の
  真のソースではなく `stage-graph.json` の鏡にする、制御/データプレーンの分離。
  [Plane アーキテクチャ](02-plane-architecture.md) を参照。
- **compile を起動するライフサイクル** — その audit 発行が compile hook を駆動する、
  workflow / phase / stage の遷移。[状態機械](12-state-machine.md) を参照。
- **このグラフが導出される元の audit ログ** - 74 イベントの分類と emitter レジストリ。
  [状態機械](12-state-machine.md) と、ユーザーガイドの
  [状態と Audit トレイル](../guide/10-state-and-audit.md) を参照。
