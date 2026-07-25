# Plane アーキテクチャ

> 対象読者: Tier 2/3（team adopter、framework contributor）。

この章は AI-DLC の three-plane アーキテクチャ — control・data・management の関心の分離 — と、それらを繋ぐ compile 境界を説明する。[Sensor システム](07-sensor-system.md)（control-plane の sensor manifest）、[Rule システム](08-rule-system.md)（control-plane の rule ファイル）、[状態機械](12-state-machine.md)（data-plane のライフサイクル）へ相互リンクする。これは設計の基盤である; sensor と rule の manifest は、その基盤が操作するソースファイルである。

---

## 1. 問題

v0.5.0 は rule・sensor と、ワークフロー実行中に観察を捕らえて次回に自動で発火する場所へ書き込む learning loop を導入する。その基礎モデルには本物の複雑さがある: 複数種の stage ごとのインポート、ファイル名で付く universal-default rule、sensor manifest、hook チェーン。顧客は framework を使うのにそのすべてを学ばねばならないべきではないし、framework はホットパスでルックアップのコストを払うべきではない。

正しい枠づけは「設計をより単純にする」ことでは *ない*。*「この種のシステムのために既に存在する規律を借りる」* ことである。現代のネットワーキングの three-plane アーキテクチャが最も近い類似であり、教訓はほぼ直接転移する。

---

## 2. ネットワーキングの類似

現代のルーター（あるいは SDN コントローラ）は、その仕事を 3 つの plane に分割する:

- **Management plane** — SNMP、syslog、ダッシュボード、NETCONF、gRPC、CLI。設定を入れ、可観測性を出す。人間のケイデンス（一度設定し、時折クエリする）。
- **Control plane** — BGP、OSPF、IS-IS、経路計算。トポロジーが与えられたら、各パケットがどのパスを取るべきかを決める。トポロジーのケイデンス（秒〜分）。
- **Data plane** — フローテーブル、ACL、ASIC 転送。このパケットを今、ナノ秒で、テーブルルックアップにより転送する。ラインレート。

盗む価値のある 5 つの教訓:

### フィルタ評価はパケットレートでは決して起きない

OSPF はトポロジーが変わるとき一度だけ最短経路を計算する。結果は data plane のフローテーブルにインストールされる。以降のすべてのパケットはテーブルルックアップである — ナノ秒、決定論的、フィルタロジック無し。賢い仕事は *トポロジー変更時* に起き、*パケット時* にではない。

### plane 間のインターフェースは明示的である

OpenFlow、P4、NETCONF、gRPC。control plane は data plane のメモリに手を伸ばさない; 「このフローをインストールせよ」と言う構造化されたメッセージを送る。data plane が確認する。これは失敗モードを診断可能にする — 拒否されたインストールは明確なシグナルであり、静かな取りこぼしではない。

### 失敗はきれいに隔離される

control plane がクラッシュしても、data plane は最後にインストールされた rule を使って転送を続ける。data plane が故障すれば、control plane はハートビートで気づき、その故障を迂回して再ルーティングする。どちらの plane も相手を道連れにしないことは、荷重を担う性質である。

### テレメトリがループを閉じる

data plane はフロー統計・ドロップ・レイテンシを報告する。control plane はテレメトリを消費して決める: 輻輳を迂回して再ルーティングする、サービスをスケールする、ピアを down とマークする。*control plane がより賢くなるのは、data plane が報告し返すからである。*

### 3 つの plane、3 つのケイデンス

management plane は人間のケイデンスで走る。control plane はトポロジーのケイデンスで走る。data plane はラインレートで走る。各 plane は、その仕事が許すなら遅くてもよい。

---

## 3. AI-DLC へのマッピング

マッピングは聞こえるより近い。（以下の `<record>/` = アクティブな intent の record dir、`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`; audit trail は `<record>/audit/` 下の per-clone シャードのディレクトリである。）

| ネットワーキング | AI-DLC の類似 |
|---|---|
| Control plane（BGP、OSPF、経路計算） | Stage 定義、rule、sensor — 何が走るべきかのスキーマ |
| Data plane（パケット転送、フローテーブル） | Stage の実行、Bolt、agent の呼び出し — 実際の実行 |
| Management plane（SNMP、ダッシュボード、CLI） | `/aidlc --doctor`、designer（将来）、audit クエリ、`CLAUDE.md` |
| Routing protocol（BGP / OSPF） | Compile: `aidlc-graph.ts compile` が stage frontmatter + rule + sensor を読み、各 stage の pull インポートをソースレジストリに対して解決し、グラフを発する |
| ASIC にロードされる FIB（forwarding information base） | compile 時に解決された stage ごとの `rules_in_context` + `sensors_applicable` を持つ `stage-graph.json` |
| OpenFlow / NETCONF（インターフェース） | `stage-graph.json` — compile と orchestrator の間の明示的なインターフェース |
| Telemetry（NetFlow、sFlow） | Audit ログ、sensor の発火、memory.md エントリ → intent の `runtime-graph.json` |
| Reactive flow install（PACKET_IN） | Learning loop: data plane が観察を報告 → ユーザーが確認 → rule/sensor へのファイル書き込み、加えて新しい sensor 束縛が捕らえられたときの発生元 stage の frontmatter 編集 |
| Proactive route install（BGP advertisement） | Framework PR: どのワークフローが走るより前に新しい stage/rule/sensor を出す |
| Topology change → 経路を再計算 | ワークフロー開始 → compile が現在のソースファイルを読む; 以降の再計算は次のワークフローで駆動される |
| プリインストールされた FIB がパケット飛行を跨いで安定 | ワークフロー中の learning-loop の書き込みは進行中のコンパイル済みビューに影響しない; それらは次のワークフロー開始時に適用される（§5 を参照） |
| テーブルルックアップによるラインレート転送 | Orchestrator + dispatcher はグラフノードから事前解決されたフィールドを読む; ランタイムに解決の走査は無い |

`stage-graph.json` の plane ラベルと、ランタイムの読み取りパターンは、FIB / route-table / CLI の分離を映す。設定は management plane で入る; control plane がそれを compile し、data plane がルックアップで実行する。

---

## 4. compile 境界

荷重を担う洞察: ネットワーキングがフィルタ評価や継承の走査をパケットレートに置かないのは、その仕事がそこでは高すぎるからである。control plane は一度計算して FIB にインストールし、data plane はルックアップで転送する。AI-DLC は同じパターンに従う: ワークフロー開始時に一度 compile し、ワークフローを通じて解決済みビューを読み、次のワークフロー開始時に再 compile する。

### 何が compile され、何がディスクに留まるか

| 状態 | ライフサイクル | ディスク上のソース | compile 先 | 読み手 |
|---|---|---|---|---|
| Stage DAG、scope ルーティング、成果物の生産 | Framework でバージョン管理（framework PR で変わる） | Stage frontmatter（`.claude/aidlc-common/stages/*.md`） | `stage-graph.json` | Orchestrator、doctor、designer |
| **Rule**（散文、規範的） | 可変; framework PR か learning-loop の書き込み | `aidlc/spaces/<active-space>/memory/<scope>.md`（ファイル名由来; org/team/project は全 stage に付く） | `stage-graph.json` のノードごとの `rules_in_context` | Orchestrator（解決済みビュー）; Claude Code の auto-load は in-context 散文のためソースを読む |
| **Sensor**（manifest、検証チェック） | 可変; framework PR か learning-loop の書き込み（manifest は一度著述、stage は id でインポート） | `.claude/sensors/aidlc-<id>.md` | `stage-graph.json` のノードごとの `sensors_applicable` | Dispatcher は stage 入口で解決済みリストを読む; PostToolUse がそこから発火する |
| ワークフロー実行のテレメトリ | ワークフローごと、累積 | `audit/` シャード · `memory.md` · Bolt fork | `<record>/runtime-graph.json` | Doctor、gate ritual、将来のワークフロー横断オブザーバー |
| Stage ごとの観察ログ | Stage 実行ごと | `<record>/<phase>/<stage>/memory.md` | （compile 無し — 直接読む） | この stage の gate での gate ritual |

2 つのコンパイル済み成果物、いずれもワークフローごと。`stage-graph.json` は解決済みの control-plane ビューを運ぶ: stage DAG、scope ルーティング、成果物の生産、加えて継承が事前解決された stage ごとの rule・sensor のリスト。`runtime-graph.json` は再コンパイルされる — audit ログの完全なイベントソース走査 — 遷移クラスの audit イベントごとに。ディスク上のソースファイルは著述サーフェスである; コンパイル済みグラフはランタイムが読むものである。

### ワークフロー開始時の 1 回の compile

compile は stage frontmatter を読み、`aidlc/spaces/<active-space>/memory/` と `.claude/sensors/` を歩き、universal-default rule をファイル名で付け（`org.md`、`team.md`、`project.md` は全 stage に適用される）、それから各 stage の pull インポートをソースレジストリに対してルックアップする:

- stage の `phase: <name>` フィールドは、合致する `phases/<name>.md` rule を付ける（stage ごとに 1 つの rule）。[Rule システム](08-rule-system.md) を参照。
- stage の `sensors: [<id>, ...]` リストは各 id を `.claude/sensors/` に対して解決する。未知の id は compile を大きな音で失敗させる — stage は、それがインポートするものの発火に静かに失敗できない。[Sensor システム](07-sensor-system.md) を参照。

compile は答えを各 stage ノードに焼き込んだ `stage-graph.json` を発する。ワークフローを通じて、orchestrator と dispatcher はそれらの事前解決されたフィールドを読む。ワークフロー中の learning-loop の書き込みはソースファイルを更新するが、進行中のコンパイル済みビューには影響しない — ユーザーは既に stage 内で orchestrator を訂正済みである; rule は次回のためのものである。次のワークフローの compile がそれらを拾う。BGP がパケット飛行の途中で経路を再計算しないのと同じ形である。

### ロックされ、アトミック

compile が初日から対処せねばならない 2 つの失敗モード。この実装の Bolt ごとの worktree は、たいていの場合並列 agent のために状態を隔離するが、`data/stage-graph.json` は repo 共有であって worktree にスコープされない — そしてユーザーは同じチェックアウトに対して 2 つのターミナルで `/aidlc` を起動できる — ので、いずれにせよ compile には防御が必要である。

- **並行 compile** は `data/stage-graph.json` への書き込みを競合させるだろう。compile は v0.4.0 以来 `withAuditLock` の下で走る（`lib.ts` を参照）ので、並行呼び出しは直列化される — 2 番目は 1 番目が終わるのを待ち、それから新鮮なソース状態に対して走る。
- **書き込み途中のクラッシュ。** 書き込み途中で中断された compile は、consumer に無効な JSON を読ませてはならない。compile は temp ファイルに書き、出力を検証し、それから POSIX `rename(2)` でアトミックにリネームする。読み手は前の compile の出力か新しいものかのどちらかを見る — 半分書かれたファイルは決して見ない。

どちらのパターンも state-and-audit の作業のため既にコードベースに住む; compile はそれらを継承する。

### 2 つのグラフ、2 つのライフサイクル

2 つのコンパイル済み成果物は、異なる consumer と異なる更新ケイデンスを持つ:

- **`stage-graph.json`** — control plane。ワークフロー開始時に compile される。ワークフローの全寿命を通じて安定。orchestrator（DAG トポロジー、scope ルーティング）、dispatcher（stage ごとの `sensors_applicable`）が読む; Claude Code の auto-load は散文のコンテキストのため、ソースの rule ファイルを並行して消費する。
- **`runtime-graph.json`** — data plane。`<record>/runtime-graph.json` にあるワークフローごとの成果物。遷移クラスの audit イベントごとに再コンパイルされる（audit ログの完全なイベントソース走査）。実行のテレメトリを集約する: どの stage が走ったか、どの Bolt が fork したか、どの sensor が発火したか、どの memory.md ファイルが存在するか。gate ritual（candidate を表面化するため）、doctor（実行の健全性のため）、将来のワークフロー横断オブザーバーが読む。スキーマ・compile ライフサイクル・回復モデルは [Runtime グラフ](13-runtime-graph.md) を参照。

それらを混ぜることは cacheability の境界を侵す。`stage-graph.json` はワークフローの寿命の間キャッシュされたい; `runtime-graph.json` はイベントごとに変異する。同じ成果物にすることは、data plane が sensor の発火を報告するたびに control plane 全体を再発行することを意味するだろう。

### なぜ rule と sensor が同じ compile を流れるか

compile はすべての control-plane 入力に対して対称である。Stage frontmatter、rule ファイル、sensor ファイルはすべて、ワークフロー開始時に `aidlc-graph.ts` が読む; すべてが解決済みの stage ごとのビューに寄与する。ネットワーキングはこれを行う — BGP と OSPF は同じ FIB を養う; ACL とポリシーは同じフローテーブルを養う。1 つのコンパイル済みビュー、複数のソース。

具体的には、各 stage ノードは 2 つのフィールドを得る:

```json
{
  "slug": "requirements-analysis",
  "phase": "inception",
  "sensors": ["required-sections", "upstream-coverage"],
  "rules_in_context": [
    {"path": "aidlc/spaces/default/memory/org.md", "scope": "org"},
    {"path": "aidlc/spaces/default/memory/team.md", "scope": "team"},
    {"path": "aidlc/spaces/default/memory/project.md", "scope": "project"},
    {"path": "aidlc/spaces/default/memory/phases/inception.md", "scope": "phase"}
  ],
  "sensors_applicable": [
    {"id": "required-sections", "path": ".claude/sensors/aidlc-required-sections.md"},
    {"id": "upstream-coverage", "path": ".claude/sensors/aidlc-upstream-coverage.md"}
  ]
}
```

`matches`（解決済みの sensor エントリに存在するとき）は sensor 側の capability filter — *「この sensor はこの glob に合致するファイルを分析する」* — であり、compile が manifest から逐語で stage の解決済みエントリにスナップショットする。PostToolUse hook は manifest を開き直すことなく発火時にそれを読む。

2 つの帰結:

- **dispatcher はランタイムに解決の走査をしない。** stage 入口は `sensors_applicable` をノードから読む — 既にルックアップされ、既に付いている。PostToolUse はこの事前解決されたリストから発火する。
- **doctor と designer は 1 つの解決済みビューを問い合わせる。** 「この stage にどの rule が適用されるか？」「このファイルを編集するとどの sensor が発火するか？」どちらも `stage-graph.json` から直接答える、ファイルシステムの走査は無い。

### 適用されたネットワーキングの教訓

control plane（compile）が遅くて賢い仕事を一度行う; その後 data plane（orchestrator + dispatcher の読み取り）が解決済みビューの上で速く走る。ワークフロー開始時の compile はすべての stage ごとのインポートを解決する — すべての `sensors:` id がルックアップされ、すべての `phase:` が付き、universal-default rule がファイル名で拾われる。ワークフローを通じて、ランタイムはグラフノードから事前解決されたフィールドを読む。BGP はパケット飛行の途中で経路を再計算しない; AI-DLC はワークフローの途中で再コンパイルしない。ワークフロー中の learning-loop の書き込みはソースファイルを更新する; それらは次のワークフロー開始時にコンパイル済みビューに入る。

---

## 5. 創発的性質としての回復

今しがた記述した data plane — `runtime-graph.json`、audit ログ、state ドキュメント、`memory.md`、成果物ツリー — は、対価を払わずに得た性質を持つ。compaction 後やクリーンな再起動後に始まった新鮮な harness セッションは、これら 5 つのソースを一緒に読み、前のセッションが中断したところから引き継ぐのに十分なワークフローの状態を再構築できる。回復は v0.5.0 に足された機能ではない; 設計のデータ規律の創発的性質である。

### 5 つのソース、1 つの絵

| ソース | 何を記録するか | 読む順 |
|---|---|---|
| 成果物ツリー（`<record>/<phase>/<stage>/*.md`） | 決定そのもの、完成形で | 1 番目 |
| stage ごとの `memory.md` | 意思決定中に気づかれたこと | 2 番目 |
| Audit ログ（`<record>/audit/` シャード） | 各決定がいつ起きたか、誰が承認したか | 3 番目 |
| State ドキュメント（`<record>/aidlc-state.md`、stage ごとの state） | ワークフローの今どこにいるか | 4 番目 |
| `runtime-graph.json` | stage 横断のサマリ（所要時間、sensor の発火、learnings の数） | 5 番目 |

成果物が最初に来るのは、それが実際に合意されたことの永続的な記録だからである。他の 4 つのソースは道のりについてである — 何が検討されたか、いつ起きたか、何が保留か、stage を跨いでパターンがどう見えるか。他人の半分終わった作業を引き継ぐ人間も同じように読む: 出力が最初、ノートが 2 番目、タイムラインが 3 番目、現在のカーソルが 4 番目、サマリビューが最後。

### 回復がきれいに再構築するもの

決定、出力、stage 内のコンテキスト、タイムライン、現在位置、そしてどの Bolt がどんな結果で fork したか。5 つのソースを読む新鮮なセッションは、ワークフローが何を生産したか、ユーザーがどんな訂正をしたか、どの gate が承認されたか、何がまだ保留か、そして前の実行がおおよそどう進んでいたかを知る。

### 回復が再構築できないもの

前のセッションの会話のリズム — ユーザーの stage 途中の Q&A パターン、`memory.md` にコミットされる前の LLM の作業仮説、途中で中断された部分的なツール呼び出し。会話バッファはセッションとともに消える。これは LLM セッションの根本的な性質であり、修正可能な設計上の性質ではない。回復の仕事は、新しいセッションに再定位して続行するのに十分なものを与えることであり、前のセッションの正確な精神状態を再現することではない。

### 一貫性の制約

異なるコードパスによって書かれる 5 つのソースは、回復が機能するためにすべて合理的に一貫を保たねばならない。audit ログは正準である（追記専用、「何が起きたか」の真実の源）; 他の 4 つは、それらの書き込みが v0.4.0 以来の同じ `withAuditLock` プリミティブでゲートされるので、それと一貫する。5 つのいずれかを audit ログに対して読む新鮮なセッションは、ドリフトを検出して調停できる。

### これが framework にとって意味すること

framework は既にこれの小さな版を実践している: 今日の `aidlc-state.md` は intent の誕生時に書かれセッション再開時に読まれる `Scope` フィールドを運ぶので、ワークフローの scope は orchestrator がそれを再導出せずともコンテキストの compaction を生き延びる。一般化は、data plane のうち何か永続的なものを記録するすべての部分が、state ファイルだけでなく回復サーフェスの一部になる、ということである。より深い原則は、*data plane が回復のために構造化されている* ということである: すべての永続的な記録が回復サーフェスの一部であるがゆえに、再開の経路は bolt-on ではなく、既に存在する基盤の上の小さな追加である。

---

## 次のステップ

この章はレンズである; 開発者リファレンスの残りは、それを通して見た仕組みである。

- **稼働中の control plane** — orchestrator がどうコンパイル済みの stage グラフを駆動するか。[Orchestrator](03-orchestrator.md) を参照。
- **control-plane の入力** — compile が各 stage ノードへ解決するソースファイル: [Sensor システム](07-sensor-system.md)（manifest）と [Rule システム](08-rule-system.md)（rule ファイル）。
- **data-plane の成果物** — `runtime-graph.json` のスキーマ・compile ライフサイクル・回復モデル。[Runtime グラフ](13-runtime-graph.md) を参照。
- **ユーザー向けのビュー** — framework を構築する人ではなく、ワークフローを走らせる人向けに枠づけられた control/data/management。[Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) を参照。
