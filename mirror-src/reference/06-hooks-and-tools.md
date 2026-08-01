# Hooks and Tools

この章は、hook システムのアーキテクチャ、13 個すべての hook スクリプト、audit イベントの分類体系、CLI ツールの構成、そして決定論的なユーティリティツールを文書化する。

> **パス規約。** 状態・audit・成果物は、アクティブな intent の **record dir** の下に住む — `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`、以下では `<record>/` と書く（record dir が時系列でソートされるよう、コンパクトな UTC 日付プレフィックスと短い kebab-case ラベルを付す; 正規の id は `intents.json` レジストリ行の UUIDv7 である）。audit トレイルは単一ファイルではなく、`<record>/audit/` の下の clone ごとのシャードのディレクトリである。

---

## Hook システムのアーキテクチャ

この実装は `.claude/hooks/` にある 13 個の hook スクリプトを使う。13 個すべてが TypeScript である（`bun` で走る）。13 個すべてが **project-wide** である — `settings.json` に登録され（statusline はトップレベルの `statusLine` キーで、残る 12 個は `hooks` ブロックで）、どの skill がアクティブかに関わらず発火する。以前は分割されていた（6 個は skill スコープとして `aidlc/SKILL.md` frontmatter に宣言され、残りは project-wide だった）; v0.6.0 で skill スコープの 6 個を `settings.json` に移し、すべてのエントリポイント — orchestrator、各同梱の scope/stage runner、および手書きの顧客 runner — が runner ごとの `hooks:` ブロック無しで決定論的なスパインを継承するようにした。

13 個のうち 10 個は **非ブロッキング** である。3 個は **フロー変更** である: `Stop` hook はフォワーディングループを走らせ続け、reviewer-scope hook は兄弟 unit の reviewer アクセスを拒否し、state-transition guard は `aidlc-orchestrate.ts report` を迂回する直接のライフサイクル呼び出しを拒否する。

```
.claude/hooks/
+-- mint-presence.ts     # UserPromptSubmit + PostToolUse AskUserQuestion (project-wide, settings.json, TypeScript)
+-- state-transition-guard.ts # PreToolUse Bash (project-wide, settings.json, TypeScript, flow-altering)
+-- reviewer-scope.ts    # PreToolUse file/search/shell tools (project-wide, settings.json, TypeScript, flow-altering)
+-- audit-logger.ts      # PostToolUse Write|Edit (project-wide, settings.json, TypeScript)
+-- sensor-fire.ts       # PostToolUse Write|Edit (project-wide, settings.json, TypeScript)
+-- sync-statusline.ts   # PostToolUse TaskUpdate (project-wide, settings.json, TypeScript)
+-- runtime-compile.ts   # PostToolUse Bash (project-wide, settings.json, TypeScript)
+-- validate-state.ts    # PreCompact (project-wide, settings.json, TypeScript)
+-- log-subagent.ts      # SubagentStop (project-wide, settings.json, TypeScript)
+-- aidlc-stop.ts        # Stop (project-wide, settings.json, TypeScript, flow-altering)
+-- session-start.ts     # SessionStart (project-wide, settings.json, TypeScript)
+-- session-end.ts       # SessionEnd (project-wide, settings.json, TypeScript)
+-- aidlc-statusline.ts  # statusLine (project-wide, settings.json, TypeScript)
```

### Hook 一覧

| Hook | イベント | スコープ | Matcher | 目的 |
|------|-------|---------|---------|------|
| `mint-presence.ts` | UserPromptSubmit + PostToolUse | Project-wide (settings.json) | (空) / `AskUserQuestion` | すべての本物の人間プロンプトと、応答されたすべての `AskUserQuestion` ウィジェットで `HUMAN_TURN` イベントを記録する（gate 承認やインタビュー回答はタイプされたプロンプトではなくウィジェットのクリックである）; 承認/インタビュー gate は台帳をチェックし、最後の gate 解決以降に 1 つを要求するので、autopilot 下のモデルは人間が行動していないのに承認を捏造できない |
| `state-transition-guard.ts` | PreToolUse | Project-wide (settings.json) | `Bash` | **フロー変更。** 直接の `aidlc-state.ts` ライフサイクル動詞を拒否し、conductor を `aidlc-orchestrate.ts report` へリダイレクトする; 読み取り専用および特殊な recovery/構成の動詞は利用可能なまま残る |
| `reviewer-scope.ts` | PreToolUse | Project-wide (settings.json) | `Read\|Edit\|Write\|Glob\|Grep\|Bash` | **フロー変更。** unit ごとの reviewer 読み取りスコープ境界（stage-protocol §12a）を決定論的に強制する: conductor の reviewer ディスパッチ記録（`<record>/.aidlc-reviewer-dispatch.json`）が新鮮な間、ディスパッチされた reviewer のツール呼び出しのうち兄弟 unit の `construction/` パスに手を伸ばすもの — ファイル読み書きと兄弟にまたがる grep/glob/shell パターン — は拒否される（exit 2 + リダイレクトする stderr の理由）、ただし対象が記録の免除リストにある場合を除く。各拒否は `REVIEWER_SCOPE_BLOCKED` を発する。あらゆる曖昧さで fail-open する; `AIDLC_DISABLE_REVIEWER_SCOPE_HOOK=1` は強制を無効化する |
| `audit-logger.ts` | PostToolUse | Project-wide (settings.json) | `Write\|Edit` | 成果物の書き込みを `audit/` シャードに自動ログする |
| `sensor-fire.ts` | PostToolUse | Project-wide (settings.json) | `Write\|Edit` | 合致する書き込みで、アクティブな stage の解決済み Sensor を発火する（advisory; 決してブロックしない） |
| `sync-statusline.ts` | PostToolUse | Project-wide (settings.json) | `TaskUpdate` | stage タスクのアクティベーション時に状態ファイルを自動同期する |
| `runtime-compile.ts` | PostToolUse | Project-wide (settings.json) | `Bash` | transition クラスの audit 発行時に `runtime-graph.json` を再コンパイルする |
| `validate-state.ts` | PreCompact | Project-wide (settings.json) | (空) | 状態ファイルを検証し、recovery ブレッドクラムを書く |
| `log-subagent.ts` | SubagentStop | Project-wide (settings.json) | (空) | subagent 完了イベントをログする |
| `aidlc-stop.ts` | Stop | Project-wide (settings.json) | (空) | **フロー変更。** ターン終了時にフォワーディングループを強制する: `aidlc-orchestrate next` を走らせ; `done` または `parked` では stop を許し、保留中の directive では stop をブロックして `reason` 経由で次の一手を注入し戻す。次のときは stop を許す（human-wait 免除）: 現在の stage が承認待ち（`[?]`）、修正中（`[R]`）、正規または アクティブな unit ごとの `<slug>-questions.md` に未回答の質問があって `[-]` 進行中、または終了しつつあるターンが会話的だった（人間の最後のプロンプトがワークフローエンジン呼び出し無しで応答された、harness トランスクリプトから読み取る）とき — 最後の 2 つは自律 Construction 下では抑制される。再帰境界あり（no-progress カウンタ + `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` 下の `stop_hook_active`; 既定はインタラクティブ実行で 2、自律 Construction 下で 8）。AIDLC ワークフローの外では no-op |
| `session-start.ts` | SessionStart | Project-wide (settings.json) | (空) | セッション再開時にワークフローのコンテキストを注入する |
| `session-end.ts` | SessionEnd | Project-wide (settings.json) | (空) | 正常終了時に `SESSION_ENDED` audit イベントを発する |
| `aidlc-statusline.ts` | statusLine | Project-wide (settings.json) | -- | ターミナルにリアルタイムの進捗を表示する |

### 共通の性質

13 個の TypeScript hook すべて:

- TypeScript で書かれ、`bun` で走る
- 実行権限を必要としない — macOS、Linux、ネイティブ Windows PowerShell で同一に動く
- Claude Code から stdin で JSON を受け取る
- ネイティブの JSON パースを使う（`jq` 依存なし）
- 成功時またはスキップ時に code 0 で exit する（`Stop` hook はブロックするときも 0 で exit する — ブロックは stdout の `{"decision":"block"}` JSON オブジェクトで通知される; 2 つの PreToolUse guard は exit 2 + stderr の理由で拒否を通知する）
- 複数のフォールバック手法で `$CLAUDE_PROJECT_DIR` を解決する
- ロックとユーティリティ関数を `lib.ts` から共有する

### Audit イベントフロー

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant AL as audit-logger.ts
    participant VS as validate-state.ts
    participant LS as log-subagent.ts
    participant SS as session-start.ts
    participant SE as session-end.ts
    participant AF as audit/ shard
    participant SF as aidlc-state.md
    participant RF as .aidlc-recovery.md

    Note over CC: Session starts
    CC->>SS: SessionStart event (source=startup|resume|clear|compact)
    SS->>SF: Read state fields
    SF-->>SS: Phase, Stage, Status, Agent
    SS->>AF: Append SESSION_STARTED or SESSION_RESUMED
    SS->>RF: Check recovery breadcrumb
    SS-->>CC: {"additionalContext": "..."}

    Note over CC: Stage execution
    CC->>AL: PostToolUse (Write/Edit)
    AL->>AL: Filter: record dir only, skip audit/ shards
    AL->>AF: Append ARTIFACT_CREATED or ARTIFACT_UPDATED

    Note over CC: Subagent completes
    CC->>LS: SubagentStop event
    LS->>AF: Append SUBAGENT_COMPLETED

    Note over CC: Context compaction
    CC->>VS: PreCompact event
    VS->>SF: Validate required sections
    VS->>RF: Write recovery breadcrumb
    VS->>AF: Append SESSION_COMPACTED

    Note over CC: Session ends
    CC->>SE: SessionEnd event
    SE->>AF: Append SESSION_ENDED
```

---

## ワークフロースパインの hook

これら 6 個の hook（audit/sensor/statusline/runtime-compile/state-validation/subagent のスパイン）は `settings.json` に project-wide で登録される。常にオンだが、各々が **self-gate** する: アクティブなワークフローが無い（`aidlc-state.md` / アクティブな intent の `audit/` シャードが不在）とき早期 exit するので、audit ログと状態同期が非 AI-DLC セッションを散らかすことは決してない。v0.6.0 より前は `aidlc/SKILL.md` frontmatter に宣言されていた（skill スコープ）; `settings.json` への移行により、すべてのエントリポイント — orchestrator とすべての同梱または手書きの runner — が `hooks:` ブロックをコピーせずにスパインを継承する。

### PostToolUse: audit-logger.ts

**ソース:** `.claude/hooks/aidlc-audit-logger.ts`
**トリガー:** すべての `Write` または `Edit` Claude Code ツール呼び出しの後（matcher: `"Write|Edit"`）
**目的:** 成果物の書き込みを intent の `audit/` シャードに自動ログする

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** `$CLAUDE_PROJECT_DIR` を、スクリプトパス導出と CWD 検出へのフォールバック付きで解決する。
2. **ヘルスハートビート:** UTC タイムスタンプを `.aidlc-hooks-health/audit-logger.last` に書く。
3. **JSON パース:** stdin を読み、`tool_name` と `tool_input.file_path` を抽出する。
4. **パスフィルタリング:** intent の record dir 配下でないファイルをスキップする。`audit/` シャード自体をスキップする（再帰を避ける）。
5. **Audit ファイルガード:** アクティブな intent の `audit/` シャードが存在しなければ静かに exit する（フレームワークが作成する）。
6. **コンテキスト抽出:** record dir までのパスプレフィックスを剥ぎ、`/` を ` > ` に置換してブレッドクラムにする（例: `inception > requirements-analysis > requirements.md`）。
7. **アトミックロック:** システムの temp ディレクトリ（`os.tmpdir()`）で `mkdir` ベースのロックを 3 回リトライループ（100ms 遅延）で使う。ハッシュがプロジェクトごとにロックを隔離する。
8. **ログエントリ:** 正規の `ARTIFACT_CREATED`（純新規パスへの Write）または `ARTIFACT_UPDATED`（Edit、または既存を上書きする Write）イベントを `appendAuditEntry` 経由で追記する。フィールド: Timestamp、Event、Tool、File、Context。

### PostToolUse: sync-statusline.ts

**ソース:** `.claude/hooks/aidlc-sync-statusline.ts`
**トリガー:** すべての `TaskUpdate` 呼び出しの後（matcher: `"TaskUpdate"`）
**目的:** stage タスクが `in_progress` になったとき `aidlc-state.md` を自動同期する

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** audit-logger.ts と同じマルチフォールバックパターン。
2. **Status フィルタ:** `status` が `in_progress` のときだけ発火する。`completed`、`pending` などでは静かに exit する。
3. **activeForm フィルタ:** `activeForm` フィールドが無い、または `[slug]` サフィックスパターンが無ければ静かに exit する。
4. **状態ファイルガード:** `aidlc-state.md` が存在しなければ静かに exit する（init 前）。
5. **ヘルスハートビート:** `.aidlc-hooks-health/sync-statusline.last` に書く。
6. **状態同期:** `bun aidlc-utility.ts set-status --stage <slug>` を呼ぶ（Phase、Stage、Agent、チェックボックスを更新）。

**設計ノート:**
- Stage Jump タスク（`[slug]` 無し）と依存関係配線の TaskUpdate（activeForm 無し）は自然にフィルタで除かれる。
- hook は既存の `set-status` サブコマンドを呼ぶ — 新しいコードパスは不要。

### PostToolUse: sensor-fire.ts

**ソース:** `.claude/hooks/aidlc-sensor-fire.ts`
**トリガー:** すべての `Write` または `Edit` Claude Code ツール呼び出しの後（matcher: `"Write|Edit"`）
**目的:** 合致する書き込みで、アクティブな stage のコンパイル解決済み Sensor を発火する（advisory; 決してブロックしない）

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** audit-logger.ts と同じマルチフォールバックパターン。
2. **Audit + state ガード:** `audit/` シャードまたは `aidlc-state.md` が存在しなければ静かに exit する（init 前）。
3. **アクティブ stage の読み取り:** アクティブな stage の `sensors_applicable` 配列を `stage-graph.json` から読む — その stage ノードのコンパイル解決済み sensor リスト（workspace-scaffold のような stage では空）。
4. **ディスパッチ:** 適用可能な各 Sensor について、`aidlc-sensor.ts fire <id> --stage <slug> --output-path <path>` を spawn する。dispatcher は各 Sensor の `matches` glob を hook 側で適用する; 合致しない書き込みはスキップされる。結果は advisory である — hook は書き込みを決してブロックしない。
5. **ヘルスハートビート:** 発火時に `.aidlc-hooks-health/sensor-fire.last` を書くので、doctor は健全なアイドル hook を静かな失敗と区別できる。

manifest スキーマと fire ライフサイクルは [Sensor System](07-sensor-system.md) を参照。

### PostToolUse: runtime-compile.ts

**ソース:** `.claude/hooks/aidlc-runtime-compile.ts`
**トリガー:** すべての `Bash` Claude Code ツール呼び出しの後（matcher: `"Bash"`）
**目的:** transition クラスの audit イベントが今しがた着地したとき `runtime-graph.json` を再コンパイルする

**処理ステップ:**

1. **コマンドフィルタ:** `bun .claude/tools/aidlc-(state|jump|bolt|utility).ts` の起動だけが早期 exit を通過する。`aidlc-runtime.ts` は明示的に拒否される（再帰ガード）。
2. **Audit 存在ガード:** init 前に清く exit する（まだ `audit/` シャードが無い）。
3. **ヘルスハートビート:** `.aidlc-hooks-health/runtime-compile.last` を書く。
4. **末尾読み取り:** マージされた `audit/` シャードを `\n---\n` で分割し、最後の 3 ブロックを取る（単一の `approve` 呼び出しが追記する上限）。
5. **イベントクラスフィルタ:** 最後の 3 ブロックのいずれかが `GATE_APPROVED`、`STAGE_STARTED`、`STAGE_AWAITING_APPROVAL`、`AUDIT_MERGED`、`WORKFLOW_COMPLETED` を運ぶときだけ再コンパイルする。合致無しでは exit する。
6. **ディスパッチ:** `bun aidlc-runtime.ts compile` を spawn する。非ゼロ exit では `--doctor` 用に hook ドロップを記録する; 親の Bash 呼び出しを決してブロックしない。

コンパイルライフサイクルとロックされたスキーマは [Runtime Graph](13-runtime-graph.md) を参照。

### PreCompact: validate-state.ts

**ソース:** `.claude/hooks/aidlc-validate-state.ts`
**トリガー:** Claude Code が会話コンテキストを compact する前（matcher: 空 = 常時）
**目的:** セクション存在チェック（情報提供のみ、compaction をブロックしない）と recovery ブレッドクラムの書き込み

**処理ステップ:**

1. **状態ファイルガード:** `aidlc-state.md` が存在しなければ清く exit する。
2. **セクション検証:** 2 つの必須セクションを `grep -q` でチェックする:
   - `## Stage Progress` -- 完了状況付きの全 stage のチェックリスト
   - `## Current Status` -- 現在の phase、stage、scope
   いずれかのセクションが欠けていれば WARNING を出力する（情報提供のみ -- compaction をブロックできない）。
3. **Recovery ブレッドクラム:** 現在の stage と検証タイムスタンプを含む `.aidlc-recovery.md` を書く。セッション再開時、フレームワークはこれを `aidlc-state.md` と比較して compaction 関連の状態破損を検出する。

**これがなぜ重要か:** コンテキスト compaction は会話履歴を捨てる。stage の途中で compaction が起きると、モデルは自分が何をしていたかの認識を失う。recovery ブレッドクラムは compaction を生き延びる外部のチェックポイントを提供する。

### SubagentStop: log-subagent.ts

**ソース:** `.claude/hooks/aidlc-log-subagent.ts`
**トリガー:** いずれかの subagent（Claude Code Task ツールの起動）が完了したとき（matcher: 空 = 常時）
**目的:** subagent 完了イベントを audit トレイルにログする

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** audit-logger.ts と同じマルチフォールバックパターン。
2. **ヘルスハートビート:** `.aidlc-hooks-health/log-subagent.last` に書く。
3. **JSON パース:** `agent_type`（既定 `"unknown"`）、`agent_id`、`last_assistant_message`（200 文字に切り詰め）を抽出する。
4. **Audit ファイルガード:** `audit/` シャードが存在しなければ静かに exit する。
5. **エントリ組み立て:** 正規の `SUBAGENT_COMPLETED` イベントを `appendAuditEntry` 経由で発する。フィールド: Timestamp、Event、Agent Type、任意で Agent ID と切り詰めた Message。
6. **アトミックロック:** audit-logger.ts と同じ `mkdir` ベースのパターン（`lib.ts` で統一）だが、競合を避けるため別のロック名を使う。

**ディスパッチされたすべての agent で発火する:**
- Stage 2.1（Reverse Engineering、`mode: pipeline`）-- repo ごとに 2 回発火する: `aidlc-developer-agent` のコードスキャン、続けて `aidlc-architect-agent` の統合
- Stage 3.5（Code Generation、`mode: subagent`）-- `aidlc-developer-agent`（unit of work ごとに 1 回発火する）
- アンサンブル stage（`mode: mob`、またはサポート agent 付きの `subagent`）-- ディスパッチされた協働者ごとと lead ディスパッチごとに 1 回発火する（例: user-stories は 3 人の協働者それぞれに発火する）

Workspace 検出（0.2）はかつて subagent だった; 今は `aidlc-utility intent-birth` の中で決定論的に走るので、この hook は初期化中にもはや発火しない。

---

### Stop: aidlc-stop.ts

**ソース:** `.claude/hooks/aidlc-stop.ts`
**トリガー:** conductor がターンを終えようとするとき（matcher: 空 = 常時、`/aidlc` がアクティブな間）
**目的:** インタラクティブなフォワーディングループを強制する — engine がワークフローを `done` と報告するまで走らせ続ける

これはフレームワークの 3 つのフロー変更 hook の 1 つであり、下の 2 つの PreToolUse guard と並ぶ。ターンの終了を止めるために `{"decision":"block"}` を返しうる; 他の 10 個の hook は観察して exit 0 する。gate 付きの会話的な経路では conductor（LLM）がループを保持する、なぜなら人間に質問できるのはそれだけだからである — だから engine を参照し忘れると、ワークフローは漂流する。この hook はその LLM の勤勉さへの依存を取り除く: ループは harness によって強制される。

**処理ステップ:**

1. **stdin のイディオム:** `log-subagent.ts` を鏡写す — TTY は Claude Code JSON が来ないことを意味する（test/debug）ので、stop を許す。さもなければ Stop-hook JSON を読み、そこから必要なのは `stop_hook_active` だけである。
2. **AIDLC の外では no-op:** プロジェクトディレクトリの下にアクティブな intent の `aidlc-state.md` が無ければ、強制すべきものは無い — stop を許す。frontmatter の `Stop` matcher は既に hook を `/aidlc` にスコープしている; これは非 AIDLC セッションが決してブロックされないための多層防御である。
3. **engine を compose する:** `bun .claude/tools/aidlc-orchestrate.ts next --project-dir <dir>` を走らせ、directive の `kind` をパースする。状態を再導出はしない — engine を compose する。
4. **`done` → 許す:** directive が `done` なら、ワークフローは完了である; hook は何も発せず exit 0 する（先例の非ブロッキングパターン）、そして再帰カウンタをクリアする。
5. **`parked` -> 許す:** directive が `parked` なら、ワークフローは後のセッションのために意図的にフロー途中で park された（`aidlc-orchestrate park`）; hook は stop を許してカウンタをクリアする、`done` とちょうど同じに。これはサポートされたマルチセッションの exit である: これが無いと、唯一の清い stop は `done` であり、長いワークフローの agent は残りの stage をラバースタンプしてしか到達できない（#367）。**Autonomy guard（#365）:** `parked` の許しは自律 Construction 下（`Construction Autonomy Mode: autonomous`）では抑制されるので、そこでの `parked` directive は cap 境界のブロックに落ち、ループは動き続ける。
6. **Human-wait -> 許す:** directive が保留中だが conductor が正しく人間で park している（または単に雑談している）なら、hook は stop を許し、nudge をスパムするのではなくドロップを記録する。4 つのケースが該当する: 現在の stage のチェックボックスが積極的に `[?]` 承認待ち、`[R]` 修正中、`[-]` 進行中 **かつ** その `<slug>-questions.md` に未回答の `[Answer]:` タグがある（保留中の stage 途中の明確化質問）、または終了しつつあるターンが会話的だった（人間の直近のプロンプトがワークフローエンジン呼び出し無しで応答された、harness トランスクリプトから読み取る） - 最後の 2 つは自律 Construction 下では抑制される。積極的確認のみ: 他のあらゆる状態、チェックボックス行無し、開いた質問無し、トランスクリプト無し / 人間プロンプト無し / 応答ターンでのエンジン呼び出しあり、またはパースエラーは、下のブロックに落ちる。下の「Human-wait 免除」を参照。
7. **Pending -> ブロックして注入:** 他のあらゆる（保留中の）directive - `run-stage`、`dispatch-subagent`、`invoke-swarm`、`present-gate`、`ask`、`print`、`error` - では `{"decision":"block","reason":<オンタスクの継続>}` を出力するので、同じセッションが次の一手を注入された状態で再開する。注入された `reason` は清い一時停止の代替として `aidlc-orchestrate park` も名指すので、長いワークフローを止めたい conductor は前進するのではなく park する。
8. **Fail open:** 予期しない失敗（読めない状態、非ゼロで exit するかパース可能な directive を返さない engine、不正な stdin）は stop を許し、ドロップを記録する。fail open は、さもなければターンを罠にかけうる hook にとって唯一安全な失敗モードである。

**セキュリティ性質 — `reason` はオンタスクの継続であり、決して override ではない。** 注入された `reason` は conductor がまだ負っている仕事（「フォワーディングループを走らせ、directive に基づき行動し、それから report する」）を名指し、何か新しいことや帯域外のことをする指示は決してしない。override の形をした directive は conductor 自身の安全訓練によって拒否される; その拒否がセキュリティ性質である。したがってバグのあるまたは侵害された engine は、認可された仕事を *継続* させることしかできない — セッションを乗っ取ってユーザーに反して行動させることはできない。

**再帰ガード — スタックしたブロックは決してセッションを罠にかけられない。** 永遠に再発火するブロックは、hook がターンを罠にかけうる唯一の道なので、再帰は 2 通りに、両方ネイティブに、境界づけられる:

- **`stop_hook_active`** — Claude Code は、現在の stop それ自体が先行する Stop-hook ブロックの産物であるとき、これを true に設定する。hook はこれを、既にブロックされたシーケンスの中にいるというシグナルとして読む。
- **no-progress カウンタ** - hook は `<record>/.aidlc-stop-hook/block-count.json`（intent の record dir の中）の下に小さな記録を、ワークフローの *進捗シグネチャ*（Current Stage slug + audit 末尾長）をキーに永続化する。ワークフローを前進させる `report` はそのシグネチャを変えるので、カウンタはリセットする - 健全なループは決してスロットルされない。連続するブロックでシグネチャが不変のとき（report が走らなかった）、カウンタは増える。no-progress の連続が上限 - `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`、その既定は **run-mode を認識する: インタラクティブ実行で 2、自律 Construction 下で 8**（インタラクティブは 2 なので、雑談中または一時停止中の人間は 1 回の nudge で解放される; 自律は 8 なので、解放する人間のいない無人ループは手放す前に完了まで走る） - に達すると、hook はターンを **解放** する（stop を許す）ので、スタックしたループは常に手放す。明示的な `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` は両方の既定を上書きする。

**Human-wait 免除 - インタラクティブな gate は罰されない。** conductor が人間を待っている（または単に会話的である）*から* ターンを終える 4 つのケースは、hook が決して nudge をスパムしないよう扱われる:

- **Esc は無料。** Stop hook はユーザーの割り込み（Esc）では発火しないので、手動の割り込みが罠にかかることは決してない — そのケースにコードは不要である。
- **承認 gate は無料ではない。** conductor が `AskUserQuestion` の回答を待つためにターンを終えるとき、Stop hook は *発火する*。承認 gate（現在の stage が `[?]` 承認待ち）または Request-Changes ループ（`[R]` 修正中）では、engine は依然として進行中の stage に対し保留中の `run-stage` を再発行するので、免除が無ければ hook はブロックし、cap が尽きるまでフォワーディングループの nudge を再注入する — インタラクティブな gate では混乱を招く。だから現在の stage のチェックボックスが積極的に `[?]`/`[R]` のとき、hook は stop を許す。これは **積極的確認のみで fail-open** である: より進んで解放するだけで、決してより多くブロックしない; チェックボックス行の欠落とあらゆるパースエラーは cap 境界のブロックに落ちるので、本物の stage 途中の中断はなお nudge される。
- **stage 途中の明確化質問も無料ではない。** そのような質問は stage を `[-]` 進行中で park する — 怠惰な中断と同じチェックボックス状態なので、`[-]` だけでは免除できない。しかし conductor は質問する前に空の `[Answer]:` タグを持つ `<slug>-questions.md` を作らねばならない（stage protocol §3）ので、未回答のタグは質問が保留中である積極的シグナルである。hook は正規の `<record>/<phase>/<slug>/` ディレクトリ、または unit ごとの Construction directive では `next` が名指す正確な `<record>/construction/<unit>/<slug>/` をチェックする; 別の unit からの古い質問は受理しない。現在の `[-]` stage の質問ファイルに未回答のタグがあるとき、hook は stop を許す。これは **厳格にゲートされる**: 自律 Construction 下（`Construction Autonomy Mode: autonomous`、ループが無人で走り続けねばならない場所）では決して発火せず、あらゆる miss - ファイル無し、すべて回答済み、autonomous、または読み取りエラー - で cap 境界のブロックに落ちるので、本物の stage 途中の中断はなお nudge される。（残余のケースへの即時緩和策: `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP=1`。）
- **会話的なターンも無料ではない。** アクティブなワークフロー中、ただ雑談したい（質問する、決定を議論する）人間はループに nudge し戻されるべきではない。hook は harness トランスクリプトを読み、直近の本物の人間プロンプトが **無し** のワークフローエンジン関与で応答された - conductor がそのプロンプト以降 `aidlc-orchestrate` も `aidlc-state` も走らせなかった - とき stop を許す。読み取り専用のクエリ（`--status`、`--doctor`、`--help`、`--version`）は関与に **数えない** ので、`--status` で応答された「今どの stage にいる？」はなお雑談として該当する。Claude と Codex は Stop ペイロードに `transcript_path` を届ける; **Kiro と opencode は何も届けない**（opencode の `session.idle` イベントはトランスクリプトを運ばない）ので、それらの harness ではこの免除は不活性であり、run-mode を認識するインタラクティブ cap（2）が、雑談中の人間を 8 回ではなく 1 回の nudge の後に去らせる解放経路である。これは **厳格にゲートされ fail-closed** である: 自律 Construction 下では決して発火せず、欠落したまたは読めないトランスクリプト、人間プロンプトが見つからない、または応答ターンでのエンジン呼び出しは cap 境界のブロックに落ちるので、ワークフローに関与してからループ途中で中断した conductor はなお nudge される。それは常に許すだけ - 決してより多くはブロックできない。

> **sensor-fire hook の advisory 契約との対比。** `aidlc-sensor-fire.ts` は明示的な *never-block* 契約を運ぶ（決して `{decision: block}` を返さない、`t95` Case 7 で保証される）。それは *その hook の* advisory 契約であり、フレームワーク全体のブロック禁止ではない。`Stop` hook のループ強制のための `block` の使用は、別の、認可された契約である。

---

### PreToolUse: aidlc-state-transition-guard.ts

**ソース:** `.claude/hooks/aidlc-state-transition-guard.ts`
**トリガー:** `Bash` ツール呼び出しの前
**目的:** ワークフローのライフサイクル変異を orchestration engine の背後に保つ

guard は直接の `aidlc-state.ts` ライフサイクル動詞を exit 2 と
リダイレクトする stderr の理由で拒否する。conductor は gate と完了の結果には
`aidlc-orchestrate.ts report`、park には `aidlc-orchestrate.ts park`、そして
ルーティングには `next`/jump フローを使う。読み取り専用の状態クエリと特殊な
recovery/構成の動詞は利用可能なまま残る。state CLI は独立に同じ所有権マーカーを
チェックし、シェルコマンドを pre-tool ペイロードで露出できない harness を
カバーする。

---

### PreToolUse: aidlc-reviewer-scope.ts

**ソース:** `.claude/hooks/aidlc-reviewer-scope.ts`
**トリガー:** file/search/shell ツール呼び出しの前（`Read`、`NotebookRead`、`Edit`、`MultiEdit`、`Write`、`NotebookEdit`、`LS`、`Glob`、`Grep`、または `Bash`; matcher: `"Read|NotebookRead|Edit|MultiEdit|Write|NotebookEdit|LS|Glob|Grep|Bash"`）
**目的:** unit ごとの reviewer 読み取りスコープ境界（stage-protocol §12a）を決定論的に強制する

これはフレームワークの 3 つのフロー変更 hook の 1 つであり、2 つの `PreToolUse` guard の 1 つである。§12a の散文の境界は、1 つの unit にディスパッチされた reviewer は兄弟 unit の `construction/<other-unit>/` の内容をどのツールでも読んではならないと言う — フィールドのトランスクリプトは、勤勉な reviewer が cross-unit glob（`construction/*/*/*.md`）を運ぶ再帰的な grep で散文を迂回し、unit ごとのレビューコストを unit 数に対して超線形に育てるのを示した。フレームワークのレイヤリング（決定論はツールと hook に属する）に従い、この hook は境界を自己強制させる。

**ディスパッチをどう学ぶか。** conductor は §12a ステップ 1（unit ごとの stage のみ）で `<record>/.aidlc-reviewer-dispatch.json` を書く — `{reviewer, stage, unit, exempt[]}`、ここで `exempt` は解決済みの `consumes` 契約パス、stage ファイル、Q&A ファイル、そして（現在の unit の設計が統合ポイントを明示的に名指すとき）その 1 つの所有する兄弟ファイルを運ぶ — そしてステップ 3 で判定が読まれるときそれを削除する。この記録が強制のウィンドウである; 6 時間より古い記録はクラッシュしたレビューからの孤児であり、無視され janitor される（compose-marker の陳腐化規律）。

**Identity。** Claude Code と Codex はアクティブな subagent の名前を hook ペイロードの `agent_type` として届ける（メインセッションの呼び出しでは不在）ので、hook は `agent_type` が記録の `reviewer` に等しいときだけ強制する。Kiro CLI は hook を 2 つの reviewer agent 自身の JSON 設定の中に登録するので、登録それ自体が identity である（adapter が `scoped_registration` を保証する）。Kiro IDE は登録を出荷しない: ツール入力はサポートされる世代をまたいで一様には利用できない（捕捉される PostToolUse の write / shell の入力は空。より新しい 1.x ビルドは一部の PreToolUse と委譲の入力を populate する - `kiro-ide-hook-payload.md` を参照）ので、フレームワークはそこで安定した pre-tool の identity/target 契約に依存できず、§12a の散文の境界がその harness で統べる。

**Decision。** matcher（`evaluateReviewerScope`、`t220` で固定されたエクスポートされた純関数）はパスフィールドとコマンド/パターンテキストを `construction/<seg>` トークンについて走査する: ディスパッチされた unit は通過し、ワイルドカードや裸の sweep ルートはブロックし、具体的な兄弟は、完全なトークンが免除エントリの `construction/` サフィックスに正確に合致しない限りブロックする。現在の unit の grep、共有の inception 契約、および validation ツールの実行は決して触られない。ブロックは `REVIEWER_SCOPE_BLOCKED` audit 行（Tool、Target、Stage、Unit）を発し、**exit 2 + リダイレクトする stderr の理由** で通知する — harness の PreToolUse reject 契約 — それはスコープを名指し、reviewer を通過した契約へ指し戻す。

**あらゆる箇所で fail-open。** 記録無し、古いまたは不正な記録、非 reviewer agent、未知のツール、不正な stdin、またはあらゆる内部エラーは呼び出しを許す; ディスパッチ記録の無い reviewer-agent の目撃は `--doctor` 用の advisory ドロップを記録する（conductor がステップ 1 の書き込みを忘れた）。決定論的なオフスイッチ `AIDLC_DISABLE_REVIEWER_SCOPE_HOOK=1` は強制を完全に無効化する。

---

## Project-Wide の hook

これら 3 つの hook は、`/aidlc` skill がアクティブかどうかに関わらず発火する。

### SessionStart: session-start.ts

**ソース:** `.claude/hooks/aidlc-session-start.ts`
**登録:** `settings.json` の `hooks.SessionStart` 下
**目的:** セッション再開時にワークフローのコンテキストを `additionalContext` JSON として注入する

Claude Code がセッションを開始する（または compaction 後に再開する）とき、この hook はアクティブなワークフローをチェックし、鍵となる状態フィールドを会話に注入する。

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** マルチフォールバック手法（`$CLAUDE_PROJECT_DIR`、スクリプトパス、CWD）。
2. **状態ファイルガード:** `aidlc-state.md` が存在しなければ exit する。
3. **ヘルスハートビート:** `.aidlc-hooks-health/session-start.last` に書く。
4. **状態抽出:** 状態ファイルを読み、7 フィールドを抽出する: Phase、Stage、Status、Last Completed、Next Action、Agent、Scope。
5. **Recovery チェック:** `.aidlc-recovery.md` が存在すれば、compaction 警告ノートを含める。
6. **JSON 出力:** ネイティブの JSON シリアライズで `{"additionalContext": "..."}` を出力する。

**出力フォーマット:**

```
AIDLC WORKFLOW ACTIVE
Scope: feature
Lifecycle Phase: Inception
Current Stage: 2.4 User Stories
Status: in_progress
Active Agent: aidlc-product-agent
Last Completed: 2.3 Requirements Analysis
Next Action: resume current stage
```

### SessionEnd: session-end.ts

**ソース:** `.claude/hooks/aidlc-session-end.ts`
**登録:** `settings.json` の `hooks.SessionEnd` 下
**目的:** アクティブな AI-DLC ワークフローが在るとき、すべての正常な Claude Code の exit で `SESSION_ENDED` audit イベントを発する。

**ライフサイクル:**
1. **ワークフローガード:** アクティブな intent の `aidlc-state.md` が存在しないとき静かに exit する（正規の「アクティブなワークフロー」マーカー — `session-start.ts` と同じガード）。born した intent の無い workspace シェルは何も発しない。
2. **Audit 発行:** `aidlc-audit.ts` 経由で `SESSION_ENDED` を `audit/` シャードに追記する。セッションライフサイクルの可観測性のために `session-start.ts` の `SESSION_STARTED` とペアになる。

### Status Line: aidlc-statusline.ts

**ソース:** `.claude/hooks/aidlc-statusline.ts`
**登録:** `settings.json` の `statusLine` 下、`bun` 経由で起動
**目的:** ターミナルのステータスバーにリアルタイムのワークフロー進捗

**出力フォーマット:** `[AIDLC] PHASE [▓▓▓▓▓░░░░░] n/m > Display Name -- Agent`

特殊状態: `[AIDLC] ready`（ワークフロー無し）、`[AIDLC] COMPLETE [▓▓▓▓▓▓▓▓▓▓]`（完了）。

**処理ステップ:**

1. **プロジェクトディレクトリの解決:** 4 つのフォールバック手法（stdin JSON `workspace.project_dir`、`$CLAUDE_PROJECT_DIR`、`fileURLToPath` 経由のスクリプトパス、CWD）。
2. **Ready フォールバック:** 状態ファイルが存在しないか phase が空なら `[AIDLC] ready` を出力する。
3. **状態抽出:** 状態ファイルから Phase、Stage、Agent を単一ファイルの regex で読む。stage slug を表示名にマップする。`-agent` サフィックスを剥ぐ。
4. **Phase スコープの進捗:** 現在の phase 見出し（`### <Lifecycle Phase> PHASE`）の下の `[x]` チェックボックスを数え、SKIP と `[S]`（jump-skip）stage を除く。`{done, total}` を生成し、これが 10 文字の unicode バー（`floor(done·10/total)` 経由で `▓`/`░`）と `done/total` 比（例: `4/7`）の両方を養う。バーと比は 1 つのスコープを共有するので一緒に進む。
5. **Model + context:** stdin JSON から model ID と context パーセンテージを抽出する。Bedrock プレフィックスを `BR:` に略し、context を緑/黄/赤に着色する。
6. **Complete 検出:** Status が `Completed` なら、`[AIDLC] COMPLETE [bar]` を出力する。
7. **グレースフルな劣化:** 各セグメントは値を持つときだけ追記される。

---

## Audit イベントの分類体系

audit トレイル（intent の `audit/` シャード）は、`.claude/knowledge/aidlc-shared/audit-format.md` に定義されたイベント分類体系を使う。すべてのイベントはツール所有かフック所有である - conductor はもはや散文からイベントを発しない。正規の emitter レジストリと audit-first のアトミック性ルールは [State Machine](12-state-machine.md) を参照; 下の要約はクロスリファレンスであり、真実の源ではない。

### イベントカテゴリ

| カテゴリ | 数 | イベント | ログする主体 |
|----------|-------|--------|-----------|
| **Session Lifecycle** | 4 | `SESSION_STARTED`, `SESSION_RESUMED`, `SESSION_COMPACTED`, `SESSION_ENDED` | Hook（session-start、validate-state PreCompact、session-end） |
| **Workflow Lifecycle** | 4 | `WORKFLOW_STARTED`, `WORKFLOW_COMPLETED`, `WORKFLOW_PARKED`, `WORKFLOW_UNPARKED` | `aidlc-utility.ts intent-birth`; `aidlc-orchestrate.ts report`/`park`（内部の状態 emitter 経由） |
| **Phase** | 4 | `PHASE_STARTED`, `PHASE_COMPLETED`, `PHASE_VERIFIED`, `PHASE_SKIPPED` | `aidlc-utility.ts intent-birth`; ライフサイクルの結果は `aidlc-orchestrate.ts` 経由で報告される |
| **Stage** | 6 | `STAGE_STARTED`, `STAGE_AWAITING_APPROVAL`, `STAGE_REVISING`, `STAGE_COMPLETED`, `STAGE_SKIPPED`, `STAGE_JUMPED` | `aidlc-orchestrate.ts report`（内部の状態 emitter）、`aidlc-jump.ts` |
| **Initialization** | 3 | `WORKSPACE_SCAFFOLDED`, `WORKSPACE_SCANNED`, `WORKSPACE_INITIALISED` | `aidlc-utility.ts intent-birth` |
| **Navigation** | 4 | `SCOPE_CHANGED`, `SCOPE_DETECTED`, `DEPTH_CHANGED`, `TEST_STRATEGY_CHANGED` | `aidlc-utility.ts` |
| **Interaction** | 6 | `DECISION_RECORDED`, `GATE_APPROVED`, `GATE_REJECTED`, `QUESTION_ANSWERED`, `REVIEW_REQUESTED`, `REVIEW_COMPLETED` | `aidlc-log.ts`, `aidlc-state.ts` |
| **Artifact** | 3 | `ARTIFACT_CREATED`, `ARTIFACT_UPDATED`, `ARTIFACT_REUSED` | audit-logger hook, `aidlc-state.ts reuse-artifact` |
| **Subagent** | 1 | `SUBAGENT_COMPLETED` | log-subagent hook |
| **Reviewer scope** | 1 | `REVIEWER_SCOPE_BLOCKED` | reviewer-scope hook |
| **Utility** | 1 | `HEALTH_CHECKED` | `aidlc-utility.ts doctor` |
| **Error/Recovery** | 2 | `ERROR_LOGGED`, `RECOVERY_COMPLETED` | `lib.ts emitError`, `aidlc-state.ts acknowledge-compaction` |
| **Construction Bolt** | 4 | `BOLT_STARTED`, `BOLT_COMPLETED`, `BOLT_FAILED`, `AUTONOMY_MODE_SET` | `aidlc-bolt.ts` |
| **Worktree / fork-merge** | 7 | `WORKTREE_CREATED`, `WORKTREE_MERGED`, `WORKTREE_DISCARDED`, `STATE_FORKED`, `STATE_MERGED`, `AUDIT_FORKED`, `AUDIT_MERGED` | `aidlc-worktree.ts`, `aidlc-state.ts`（fork/merge）, `aidlc-audit.ts`（audit-fork/merge） |
| **Practices** | 4 | `PRACTICES_DISCOVERED`, `PRACTICES_AFFIRMED`, `PRACTICES_OVERRIDE`, `PRACTICES_SECTION_EMPTY` | `aidlc-state.ts`（`practices-promote` は `PRACTICES_AFFIRMED` のみを発する; `practices-event` は他の 3 つを発する） |
| **Merge dispatch** | 3 | `MERGE_DISPATCH_INVOKED`, `MERGE_DISPATCH_RETURNED`, `MERGE_DISPATCH_FALLBACK` | `aidlc-bolt.ts dispatch-event` |
| **Sensors** | 5 | `SENSOR_FIRED`, `SENSOR_PASSED`, `SENSOR_FAILED`, `SENSOR_BUDGET_OVERRIDE`, `GUARDRAIL_LOADED` | `aidlc-sensor.ts fire`, `aidlc-utility.ts doctor`（`GUARDRAIL_LOADED`） |
| **Learning loop** | 3 | `MEMORY_EMPTY`, `RULE_LEARNED`, `SENSOR_PROPOSED` | `aidlc-runtime.ts compile`, `aidlc-learnings.ts persist` |
| **Swarm** | 6 | `SWARM_STARTED`, `SWARM_UNIT_CONVERGED`, `SWARM_UNIT_FAILED`, `SWARM_BATON_RETURNED`, `SWARM_COMPLETED`, `SWARM_DEGRADED` | `aidlc-swarm.ts` referee — `prepare` からの `SWARM_STARTED` + `SWARM_DEGRADED`; unit ごとのペア、baton 行、バッチ集計は `finalize` から |

### エントリフォーマット

すべての audit イベントは `audit-format.md` に定義されたフォーマットに従う:

```markdown
## EVENT_NAME
**Timestamp**: 2026-01-15T10:30:00Z
**Event**: EVENT_NAME
**Details**: [event-specific content]

---
```

すべてのイベント — hook 生成もツール生成も — は同じ正規の `appendAuditEntry` emitter を使い、`**Event**:` フィールド付きの同一の構造化 markdown を生む。見出しは `aidlc-audit.ts` の `EVENT_HEADINGS` 経由でイベント名から導出される。

### 必須イベント

完了まで実行するすべての stage は次を生む:
- `STAGE_STARTED` -- engine が stage をアクティブ化するときログされる
- `STAGE_COMPLETED` -- conductor が完了または承認を報告するときアトミックにログされる

skip として報告された stage は `STAGE_COMPLETED` の代わりに `STAGE_SKIPPED` を発する;
両方として表現されることは決してない。

### Hook 生成 vs ツールログ

| ソース | イベント | いつ |
|--------|--------|------|
| `audit-logger.ts` | `ARTIFACT_CREATED` / `ARTIFACT_UPDATED` | intent の record dir へのすべての Write/Edit（`audit/` シャードを除く） |
| `log-subagent.ts` | `SUBAGENT_COMPLETED` | あらゆる subagent の stop |
| `reviewer-scope.ts` | `REVIEWER_SCOPE_BLOCKED` | unit ごとの reviewer のツール呼び出しが兄弟 unit アクセスで拒否された（PreToolUse） |
| `session-start.ts` | `SESSION_STARTED` / `SESSION_RESUMED` | Claude Code SessionStart hook 入力の `source` フィールドに応じて |
| `session-end.ts` | `SESSION_ENDED` | Claude Code SessionEnd hook |
| `validate-state.ts` | `SESSION_COMPACTED` | Claude Code PreCompact hook |
| CLI ツール | 他のすべてのイベント（stage/phase/workflow ライフサイクル、gate、決定、bolt、sensor、learnings、recovery、…） | ライフサイクルと gate 行は、conductor の report の後に orchestration engine の内部の状態 emitter から来る; 他の行はそれを所有するツール（`aidlc-log.ts`、`aidlc-bolt.ts`、`aidlc-learnings.ts`、`aidlc-utility.ts`）から来る。決して散文から手で追記されない（`SKILL.md`「Never emit audit events from prose」を参照）。 |

---

## Claude Code ツールの構成

### Permissions（settings.json）

`.claude/settings.json` の `permissions.allow` 配列は、起動ごとの permission プロンプトを避けるため Claude Code ツールを事前承認する:

| Claude Code ツール | AI-DLC での用途 |
|------------------|-------------|
| `Read` | stage ファイル、knowledge ファイル、状態ファイル、プロジェクトのソースコードの読み取り |
| `Edit` | 既存成果物の修正、状態ファイルの更新 |
| `Write` | 新規成果物の作成、audit ログエントリ、ディレクトリのスキャフォールド |
| `Bash` | build ツール、test コマンド、タイムスタンプ、パッケージマネージャの実行 |
| `Glob` | workspace 検出と reverse engineering の際のパターンによるファイル検索 |
| `Grep` | コードベースからパターン、依存関係、API エンドポイントの検索 |
| `Task` | Reverse Engineering と Code Generation のための subagent への委譲 |
| `WebSearch` | 市場調査、デザイン参考の検索、コンプライアンスフレームワークの調査 |

`AskUserQuestion` は既定で常に許可され、明示的な承認を必要としない。

### Agent のツール制限

すべての agent は既定でセッションのフルツールセットを継承する; 出荷される唯一の制限は `disallowedTools: Task` である。ペルソナは frontmatter に任意の `tools:` allowlist を足すことで狭められる（`mcp__<server>__<tool>` id も列挙されない限り継承した MCP ツールを落とす）が、出荷される 14 個の agent のいずれもそうしない。下の表は、方法論がどの agent に stage の仕事で Bash と WebSearch を行使すると *期待する* かを記録する。

| Claude Code ツール | それを行使すると期待される Agent |
|------------------|---------------------------------|
| Bash | aidlc-aws-platform-agent, aidlc-devsecops-agent, aidlc-developer-agent, aidlc-quality-agent, aidlc-pipeline-deploy-agent, aidlc-operations-agent |
| WebSearch | aidlc-product-agent, aidlc-design-agent, aidlc-compliance-agent |
| Read/Edit/Write/Glob/Grep/AskUserQuestion | 14 個の agent すべて |

**パターン:** Bash は CLI 対話を必要とするロール（build ツール、
test コマンド、インフラ）で期待される。WebSearch は調査志向の
ロール（市場調査、デザイン参考、規制フレームワーク）で期待される。

---

## 決定論的なユーティリティツール

ファイル `.claude/tools/aidlc-utility.ts` は、ユーティリティコマンドを決定論的に扱う（LLM 推論不要）Bun/TypeScript CLI ツールである。conductor は単一の Bash 呼び出しでそれにディスパッチする:

```bash
bun .claude/tools/aidlc-utility.ts <subcommand>
```

### 実装済みのサブコマンド

| Subcommand | 目的 | 発行 |
|------------|---------|-------|
| `help` | 使い方と利用可能なコマンドを表示する | — |
| `version` | フレームワークのバージョンを表示する | — |
| `status` | `aidlc-state.md` からの読み取り専用のステータスチェック。Status 行に `[?]` / `[R]` の gate 認識を表面化する。 | — |
| `doctor` | ヘルスチェック: hook、前提条件、ファイル構造を検証する | `HEALTH_CHECKED` |
| `intent-birth` | 新しい intent を born し、3 つの決定論的な Initialization stage を走らせる。 | `WORKFLOW_STARTED`, `PHASE_STARTED`, `PHASE_SKIPPED`, `STAGE_STARTED`, `STAGE_COMPLETED`, `WORKSPACE_*`、および init から init 後の最初の phase への引き継ぎイベント |
| `init` | このリリースでは transition エラーのみ; 何を作るか記述して作業を始めると engine が `intent-birth` へルーティングする。 | なし |
| `intent [name]` | intent を一覧する（`--json`）か、アクティブ intent カーソルを切り替える。通常 `/aidlc intent [name]` からルーティングされる。 | — |
| `space [name]` | space を一覧する（`--json`）か、アクティブ space カーソルと harness include を切り替える。通常 `/aidlc space [name]` からルーティングされる。 | — |
| `space-create <name>` | フレームワーク memory のベースラインから新しい space を作成する。通常 `/aidlc space-create <name>` からルーティングされる。 | — |
| `codekb-path [--repo <name>] [--json]` | 直接呼び出し専用の読み取り専用クエリで、決定論的な repo ごとの codekb ディレクトリを表示する。`/aidlc codekb-path` ルートは無い。 | — |
| `select-plugins [names]` | インストールの有効化済みプラグイン集合への直接呼び出し専用のクエリ/更新。`/aidlc select-plugins` ルートは無い。 | set モードで `PLUGIN_SELECTION_CHANGED` |
| `scope-change` | ワークフロー途中のアトミックな scope 更新（stage 包含を再計算）。どの stage が EXECUTE/SKIP かを再計画する。 | `SCOPE_CHANGED` |
| `config-get`, `config-list` | アクティブなワークフロー config（`depth`、`test-strategy`）を読む; `config-list --json` は構造化された形状を発する。 | なし |
| `config-change` | アクティブなワークフロー config を書く。Dispatcher 形式: `/aidlc config set depth <value>` または `/aidlc config set test-strategy <value>`。 | `DEPTH_CHANGED`, `TEST_STRATEGY_CHANGED` |
| `plugin-list` | インストール済みプラグインを有効/無効状態付きで一覧する; `--json` は `plugins` と `selectionActive` を発する。 | なし |
| `plugin-sync` | 各プラグインの `hooks/compose.ts` を走らせてインストール済みプラグインルートを compose する; ルート無しは清い no-op。 | なし |
| `set-status` | 低レベルの状態フィールド同期（TaskUpdate で `sync-statusline.ts` hook が呼ぶ） | — |
| `detect-scope` | freeform 処理中に scope 検出イベントを記録する。2 モード: `--scope <s> --input <text> [--source freeform\|keyword\|env\|cli]`（明示）、または `--from-text --input <text>`（`inferScopeFromText` 経由の推論 — 各 scope の `keywords` を `.claude/scopes/*.md` frontmatter から読み、単語境界マッチ、アルファベット順のタイブレーク、`>5` 語で `feature` へフォールバック）。モードは相互排他。keyword が発火したとき audit イベントは任意の `Matched keywords` フィールドを含む。 | `SCOPE_DETECTED` |
| `detect` | 読み取り専用の composer スキャン（ディスパッチされた composer の最初の呼び出し）: 標準の scope レジストリ、コンパイル済み stage グラフの要約、そして composed された scope の 2 ファイルが着地すべきパスを JSON（`--json`）で表示する。何も変異しない。 | — |
| `recompose` | 実行中のプラン再形成: `--skip <slug,...>` / `--add <slug,...>` は、audit ロック下でライブの状態ファイル上のカーソルより前の PENDING stage のプランサフィックスを反転させる。厳格に検証する（枯渇した必須入力、frozen/カーソルより後の stage、walking skeleton アンカーの移動、非 Running ワークフロー、または自律 Construction はすべて拒否する）そして派生した状態フィールドを再構築する。 | `RECOMPOSED` |
| `resolve-env-scope` | `AWS_AIDLC_DEFAULT_SCOPE` 環境変数を検証し、その値を stdout に発する | — |
| `scope-table` | orchestrator skill のコンパイル済み scope 表をレンダーまたはドリフトチェックする。 | — |
| `stage-table` | orchestrator skill のコンパイル済み stage 表をレンダーまたはドリフトチェックする。 | — |

ユーザー向けの `intent`、`space`、`space-create` 形式は
[CLI Commands](../guide/12-cli-commands.md) と
[Spaces and Intents](../guide/03-spaces-and-intents.md) で扱う。`codekb-path` と
`select-plugins` は意図的に
`bun <harness-dir>/tools/aidlc-utility.ts <verb>` として直接起動される; どちらも orchestrator
コマンドではない。

### 設計の根拠

決定論的なハンドラは、純粋な計算である操作 — テキストの表示、ファイルの読み取り/整形、前提条件のチェック、ディレクトリの作成 — の LLM オーバーヘッドを避ける。それらは 1 秒未満で走り、タスクトラッキングを必要とせず、`lib.ts` の共有ヘルパー経由で自身の audit ログを扱う。

---

## Sensor、Learning、Runtime のツール

さらに 3 つの `aidlc-*.ts` ツールが v0.5.0 のデータ plane を支える。各々が薄い決定論的な dispatcher である: hook がそれらを自動で起動し、デバッグ用に人間からも呼べる。それらは `aidlc-utility.ts` と同じ three-concerns の分割に従う — 決定論はツールに住み、conflict/contradiction の VERDICT は orchestrator-LLM のもの、keep/skip の判断は gate でのユーザーのものである。

### `aidlc-sensor.ts` — Sensor dispatcher

Sensor の起動をルーティングする: 入力を検証し、グラフから manifest と stage を解決し、audit ロック下で `SENSOR_FIRED` を発し、Sensor ごとのスクリプトを spawn し（ロックは保持しない）、それからペアの終端行を発する。manifest スキーマ、fire ライフサイクル、結果の真理値表は [Sensor System](07-sensor-system.md) を参照。

| Subcommand | 目的 | 発行 |
|------------|---------|-------|
| `list` | フレームワーク Sensor を列挙する（`id`、`kind`、`description`）、アルファベット順に | — |
| `describe <id>` | 1 つの Sensor の manifest フィールド（command、default severity、`matches` glob、任意の timeout、manifest path）を表示する | — |
| `fire <id> --stage <slug> --output-path <path>` | 出力ファイルに対して Sensor を発火する | `SENSOR_FIRED` それから `SENSOR_PASSED` / `SENSOR_FAILED` / `SENSOR_BUDGET_OVERRIDE` のいずれか |

dispatcher は自身の起動エラー（未知の id、欠けたフラグ、`matches` 不一致）でのみ非ゼロで exit する。Sensor の *結果* — pass、fail、timeout、またはあらゆるスクリプトエラー — は advisory である: CLI はなお 0 で exit し、常に `SENSOR_FIRED` 行をペアの終端行で閉じる。失敗は detail ファイルを `<record>/.aidlc-sensors/<stage>/<id>-<fire-id>.md`（intent の record dir の中）に race-free に書く（`wx` フラグ write + rename）。同じ dispatcher が、すべての合致する `Write` / `Edit` で `aidlc-sensor-fire.ts` PostToolUse hook によって駆動される。

### `aidlc-learnings.ts` — Learning-gate ツール

stage-protocol §13 learning 儀式の tool-as-actor 側。`surface` は今しがた承認された stage の `memory.md` を読む; `persist` は確認された選択を書く。検出、surfacing、ルーティング、書き込みは決定論的（このツール）; admission の conflict-check は orchestrator-LLM のもの; keep/skip/escalate は `AskUserQuestion` gate でのユーザーのもの。LLM 呼び出しはツールに住まない。learning ループと strict-additive な rule モデルは [Rule System](08-rule-system.md) を参照。

| Subcommand | 目的 | 発行 |
|------------|---------|-------|
| `surface --slug <stage-slug>` | 読み取り専用。`memory.md` エントリを keep 候補（Interpretations / Deviations / Tradeoffs）と park された open question に分ける; 構造化された JSON 候補集合を表示する | — |
| `persist --slug <stage-slug> --selections-json <path>` | 確認された各 learning を practice（既定 scope は project）として `aidlc/spaces/<active-space>/memory/project.md` / `memory/team.md` に日付付きエントリとして書く; Sensor 束縛の learning には project-tier manifest をスキャフォールドし、その id を発生元の stage の `sensors:` frontmatter に追記する — 両方の書き込みは 1 つの `withAuditLock` の中で | `RULE_LEARNED`, `SENSOR_PROPOSED` |

両サブコマンドは `--project-dir <path>` を受理する。`persist` は決して判断しない — conflict-clear かユーザーが escalate した選択だけを受け取る — そして audit の fresh な in-lock read に対し `(Stage, Candidate-ID)` ごとに重複排除するので、同日の再実行は二重追記ではなく no-op である。

### `aidlc-runtime.ts` — Runtime-graph コンパイラ + リーダー

intent の `runtime-graph.json`、`stage-graph.json` のデータ plane の鏡を物質化する。`compile` は `audit/` シャードと stage ごとの `memory.md` ファイルを歩く; `read` は 1 つの stage 行を表示する。コンパイラは純粋な観察者である — `aidlc-state.md` を決して変異せず、決してプロンプトしない。ロックされたスキーマは [Runtime Graph](13-runtime-graph.md) を参照。

| Subcommand | 目的 | 発行 |
|------------|---------|-------|
| `compile` | audit + memory を歩き、`runtime-graph.json` を書き直す; diary が空の承認済み stage ごとに `MEMORY_EMPTY` 行を発する | `MEMORY_EMPTY` |
| `read <stage-slug>` | `runtime-graph.json` から 1 つの stage の行を表示する | — |
| `fragment-fork --slug <slug>` | main の `runtime-graph.json` を Bolt worktree にバイトコピーする（一度きり）。`aidlc-bolt.ts start --worktree` が呼ぶ | — |
| `fragment-merge --slug <slug>` | worktree フラグメントを削除する（冪等）。`aidlc-bolt.ts complete --merge` が呼ぶ | — |

同じ audit に対する `compile` の再実行はバイト等価なグラフを生む。すべての transition クラスの audit 発行（`GATE_APPROVED`、`STAGE_STARTED`、`STAGE_AWAITING_APPROVAL`、`AUDIT_MERGED`、`WORKFLOW_COMPLETED`）で `aidlc-runtime-compile.ts` PostToolUse Bash hook によって自動で起動される; 手動起動はデバッグサーフェスである。`fragment-fork` / `fragment-merge` プリミティブは既存の fork/merge audit 境界（`STATE_FORKED` + `AUDIT_FORKED`、`STATE_MERGED` + `AUDIT_MERGED`）に便乗し、自身のイベントは発しない。すべてのサブコマンドは `--project-dir <path>` を受理する。

---

## 前提条件

1. **bun** -- 13 個すべての hook とすべての CLI ツール（`aidlc-utility.ts`、`aidlc-state.ts`、`aidlc-jump.ts`、`aidlc-orchestrate.ts`、`aidlc-audit.ts`、`aidlc-validate.ts`、`aidlc-graph.ts`、`aidlc-sensor.ts`、`aidlc-learnings.ts`、`aidlc-runtime.ts`）に必須。`curl -fsSL https://bun.sh/install | bash` でインストール。Windows では: `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 | iex"`。非対話シェルのために PATH に在らねばならない。
2. **$CLAUDE_PROJECT_DIR** -- Claude Code がプロジェクトルートに設定する。すべての hook がこれを使って `aidlc/` workspace（およびその中のアクティブな intent の record dir）を特定する。

他の前提条件は無い: すべての hook とツールは bun で走る TypeScript なので、どのプラットフォームでも `jq`、`sed`、`awk`、Git Bash、WSL は不要である。

---

## クロスリファレンス

- [Architecture](01-architecture.md) -- 5 レイヤーモデルの hook レイヤー
- [Stage Protocol](04-stage-protocol.md) -- stage ごとの audit ログルール
- [Knowledge System](10-knowledge-system.md) -- audit-format.md 分類体系（共有 knowledge に同梱）
- [Contributing](11-contributing.md) -- ユーティリティハンドラの追加
- [Harness Primitives Mapping](14-claude-features.md) -- settings.json 構成（Claude 固有セクション）
- [State Machine](12-state-machine.md) -- 正規のイベント emitter レジストリと audit-first のアトミック性ルール
