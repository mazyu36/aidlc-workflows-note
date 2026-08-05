# 用語集

AI-DLC 用語の正準定義。ユーザーガイドと開発者リファレンスのすべてのドキュメントは、これらの用語を一貫して使う。

---

| 用語 | 定義 |
|------|-----------|
| **Agent** | 同梱される 14 のペルソナのひとつ: 11 のドメインエキスパート、レビュー専任の 2 エージェント、適応ワークフローの composer。conductor が、それぞれの専門の stage・レビュー・構成の役割のために有効化する。 |
| **Approval gate** | 各 stage の末尾にある対話的チェックポイント。作業の承認、変更の要求、（3 回の修正後は）accept as-is を選ぶ。Initialization の stage は承認 gate をスキップする。 |
| **Autonomy mode** | walking-skeleton の ladder prompt の後に `aidlc-state.md` に記録される設定（`Construction Autonomy Mode`）。`autonomous`（以後の Bolt は gate なしで走る）か `gated`（Bolt ごとに承認を求める）のいずれか。プロンプト前の既定は `unset`。 |
| **Bolt** | Construction の実行単位: 1 つの Unit（または依存で結ばれた小さな Unit 群）に対する stage 3.1–3.5 の 1 パス。stage 3.6（Build and Test）と 3.7（CI Pipeline）は Bolt ごとではなく、全 Bolt 完了後に 1 回走る。Construction の最初の Bolt が walking skeleton である。参照: [parallel batch]、[walking skeleton]、[ladder prompt]。 |
| **Artifact** | stage が生成し、intent の record dir（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）に保存されるバージョン管理された markdown 文書。例: `requirements.md`、`code-summary.md`、`initiative-brief.md`。 |
| **Audit trail** | intent の record dir の `audit/` にある追記専用イベントログ。クローン別シャード（`<host>-<clone>.md`）として書かれ、読む側が glob してタイムスタンプでマージする。intent から本番までの完全なトレーサビリティのため、76 のイベント種別を ISO タイムスタンプ付きで記録する。 |
| **CLI tool** | この実装が必要とする外部のコマンドラインユーティリティ（実行時の前提は `bun` のみ）。Claude Code のツールと混同しないこと。 |
| **Claude Code tool** | Read・Write・Edit・Bash・Glob・Grep・Task・AskUserQuestion のような Claude Code の組み込み能力。エージェントは既定でセッションの完全なツールセットを継承する。任意の `tools:` 許可リストで絞れ、同梱される唯一の制限は `disallowedTools: Task` である。 |
| **Codex** | OpenAI Codex CLI の harness — 今日の AI-DLC の harness ディストリビューションのひとつで、`core/` + `harness/codex/` から `dist/codex/` へ生成される。`$aidlc` で呼び出す。[Codex CLI 上の AI-DLC](harnesses/codex-cli.md) を参照。 |
| **Command** | AI-DLC のユーザー向け呼び出し。`/aidlc` に scope・フラグ・自由記述を続けて打つ。内部的には `/aidlc` は Claude Code の skill に対応する。 |
| **Compaction** | コンテキストウィンドウが埋まったとき、以前の会話コンテキストを要約する Claude Code の自動処理。この実装は `aidlc-state.md` と `.aidlc-recovery.md` によりコンパクションを跨いで状態を保つ。 |
| **Conductor** | `/aidlc` セッションそのもの（`SKILL.md`）。薄い forwarding loop を回す: **Engine** に次の一手を尋ね、それを実行し（stage の実行、質問、swarm のファンアウト）、結果を報告し、繰り返す。所有するのは実行品質であってルーティングではない。[Engine と Skill システム](../reference/17-skill-system.md) を参照。 |
| **Control loop** | stage を操舵し検証する、**Rule**（作業前に適用される常設の決定 = feedforward）と **Sensor**（出力に発火する決定論チェック = feedback）の対。（CLI ディストリビューションの意味の **Harness** とは別物。かつては両方が「harness」と呼ばれていた。） |
| **Core** | `core/` にある、手書きで harness 非依存な単一の正 — エンジン・stage・エージェント・rule・scope・sensor・knowledge・hook・セッションスキル。すべての harness ディストリビューションはここから生成される。編集するのはここであり、`dist/` では決してない。 |
| **Depth** | 各 stage がどれだけ詳細に作るかを制御する 3 つの詳細レベル（Minimal・Standard・Comprehensive）のひとつ。scope は既定の depth を持ち、任意の承認 gate で上書きできる。[Scope・Depth・テスト戦略](05-scopes-and-depth.md) を参照。 |
| **Directive** | **Engine** が `next` のたびに発行する型付きの指示（例: `run-stage`、`ask`、`print`、`done`、`invoke-swarm`）。**Conductor** に次に何をするかを正確に伝える。[Engine と Skill システム](../reference/17-skill-system.md) を参照。 |
| **Distribution** | 1 つの harness のために生成され、コミットされ、ドリフト検知される `dist/<harness>/` ツリー（`dist/claude/`、`dist/kiro/`、`dist/kiro-ide/`、`dist/codex/`、`dist/opencode/`）。ユーザーはこれをプロジェクトへコピーする。メンテナが手で編集することはない。**Core** から **Packager** が生成する。 |
| **Engine** | stage 間のルーティングすべて — scope の解決、stage の順序付け、ジャンプ、再開、gate の状態 — を所有し、**Conductor** が実行する型付き **Directive** を発行する決定論的オーケストレーションツール（`aidlc-orchestrate.ts`。サブコマンドはちょうど 4 つ: `next`・`continue`・`report`・`park`。`continue` は内部の steering 用トランスポート）。[Engine と Skill システム](../reference/17-skill-system.md) を参照。 |
| **External tool** | stage が使うサードパーティのツールやサービス（例: AWS CLI、Maven、npm）。Claude Code のツールと区別される。 |
| **Guardrail** | Rule ファイル内の本文セクション（`## Forbidden`・`## Mandated`・phase rule の guardrail 見出し）で、規範的な行動制約を表すもの。容れ物が Rule で、その中の規範的な内容を「guardrail」と呼ぶ。**Rule** を参照。 |
| **Harness** | AI-DLC の core の CLI ディストリビューション — harness 非依存の **Core** を描画する先の、対応力のあるコマンドラインエージェント 1 つ。集合はオープンで成長する（今日: Claude Code・Kiro CLI・Kiro IDE・Codex CLI・opencode）。*注 — 「harness」はこのリポジトリで文脈により 4 つの意味を持つ:* (1) **この正準の CLI ディストリビューションの意味**、(2) rule+sensor の**制御ループ**（古い用法。改名済み — **Control loop** を参照）、(3) `harness/<name>/` のソースサーフェスディレクトリ、(4) `tests/harness/` のテストヘルパーディレクトリ。ユーザードキュメントで「a harness」は意味 1 だけである。 |
| **Hook** | イベントに応じて Claude Code が自動実行する TypeScript スクリプト。この実装は 16 の hook を使い、すべて `settings.json` にプロジェクト全体で登録される: ワークフローの背骨（audit ログ、sensor ディスパッチ、runtime グラフのコンパイル、statusline 同期、token 使用量の折り込み、コンパクション時の状態検証、subagent 追跡、ターン終端のループ強制）に加え、セッションライフサイクル、human-turn の記録、厳密な dispatch-rule 配送、状態遷移・reviewer スコープ・review-freeze のガード、statusline コマンド。それぞれ自己判定し、ワークフローが無ければ no-op になる。 |
| **Inline execution** | orchestrator がエージェントペルソナを読み込み、会話の中で stage を直接実行する既定の実行モード。リアルタイムのユーザー対話に対応する。 |
| **Intent** | space の `intents.json` レジストリの 1 行（`{uuid, slug, dirName, scope, repos, status}`）として追跡される作業単位。`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` に自分の [Record dir] を持つ。`<YYMMDD>` はコンパクトな UTC 日付プレフィクス（例: `260624` = 2026-06-24）で記録が時系列に並び、`<label>` は要望の本質を表す短いケバブケースである。同日同ラベルの衝突は数値カウンタ（`-2`、`-3`、…）で解決する。正準で衝突しない id はレジストリ行に保存される時刻順の UUIDv7 であり、ディレクトリ名の接尾辞ではない。エンジンは最初の `/aidlc` で最初の intent を自動 birth し、`active-intent` ポインタが現在のものを選ぶ。**Space**・**Record dir** を参照。 |
| **Kiro** | Kiro の harness — 今日の AI-DLC の harness ディストリビューションのひとつで、`core/` から `dist/kiro/`（CLI）と `dist/kiro-ide/`（IDE）へ生成され、AIDLC のメソッドは CLI のエージェント resources または IDE の常時包含 steering のライブ参照を通じて `aidlc/spaces/<active-space>/memory/` から読まれる。`/aidlc` で呼び出す。[Kiro IDE で AI-DLC を動かす](harnesses/kiro-ide.md) と [Kiro CLI で AI-DLC を動かす](harnesses/kiro-cli.md) を参照。 |
| **Knowledge** | stage 開始時にエージェントが読み込むリファレンス資料。2 層ある: 方法論ナレッジ（フレームワーク同梱・`.claude/knowledge/`）と、チームナレッジ（ユーザー管理・space レベルのドメイン知識・`aidlc/spaces/<space>/knowledge/` — 自由形式、ブートストラップ時は空、space 内の全 intent で共有）。 |
| **Ladder prompt** | walking-skeleton の Bolt の最後に一度だけ表示されるプロンプト。「continue autonomously」か「gate every Bolt」を選ばせる。選択は autonomy mode として記録され、残りすべての Bolt を統べる。 |
| **Learning loop** | stage 内の修正を永続的な practices と Sensor に変える v0.5.0 の機構。stage 中に orchestrator が観察を `memory.md` に記録し、承認 gate でそれを提示し、あなたが残すものを確認すると、確認された各学びが practice として `aidlc/spaces/<active-space>/memory/project.md` に書かれる（ワンクリックで `team.md` へ昇格）— または新しい Sensor が雛形生成される — 次のワークフローから適用される。[Rule と学習ループ](09-rules-and-the-learning-loop.md) を参照。 |
| **Lifecycle** | AI-DLC の方法論の全体: AI-Driven Development Life Cycle。方法論の 1 回の実行が workflow である。 |
| **Manifest** | harness の `harness/<name>/manifest.ts` — **Core** をその harness の **Distribution** へどう投影するかを **Packager** に伝える宣言的契約（ディレクトリ対応、rules のリネーム、authored ファイル、任意の `emit` プラグイン）。harness の追加は、ほぼ manifest を 1 枚書くことである。 |
| **MCP server** | プロジェクトルート（`.claude/` の隣）の `.mcp.json` で宣言され、Claude Code のセッションにプロビジョニングされる外部ツールサーバー。この実装は 5 つ同梱する: `context7` と 4 つの AWS サーバー（`aws-mcp`・`aws-pricing`・`aws-iac`・`aws-serverless`）。すべてのエージェントがセッションの全 MCP サーバーを継承する — エージェント別の許可は無く、あるエージェントに使わせ*ない*には `tools:` 許可リストを特定の `mcp__<server>__<tool>` id に絞る。認証情報の無いサーバーは単に利用不可となり、ワークフローを決してブロックしない。[Harness プリミティブの対応 — MCP サーバー](../reference/14-claude-features.md#mcp-servers) と [はじめかた](01-getting-started.md#mcp-servers-optional) を参照。 |
| **memory.md** | `<record>/<phase>/<stage>/memory.md`（intent の record dir 配下）にある stage ごとの観察日誌。stage 開始時に自動作成され、orchestrator が維持する（手で編集しない）。Interpretations・Deviations・Tradeoffs・Open questions を記録し、承認 gate で学習ループが読む入力である。 |
| **Mob execution** | 有界のラウンドで動く dispatch されたメッシュ（`mode: mob`）。リードが草稿を書き、相互に盲目な協力者が並列に contribution ファイルを書き、リードが統合し、未解決の判断は人間に渡ることがある。User Stories（2.4）が出荷されている mob である。 |
| **Multi-repo intent** | 作業が複数の兄弟コードリポジトリにまたがる intent。リポジトリの集合は誕生時に捕捉され — `--repos a,b` で明示するか、兄弟の自動発見（ワークスペースルート直下で `.git` を持つ子すべて）— intent の `intents.json` 行に `repos` として保存される。Construction は各 git 操作を `--repo <name>` で特定のリポジトリにアンカーする。repos の記録が無い intent は従来の単一リポジトリのケース（git はプロジェクトディレクトリで走る）。[成果物リファレンス](14-artifacts-reference.md) を参照。 |
| **opencode** | opencode の harness（opencode.ai）— 今日の AI-DLC の harness ディストリビューションのひとつで、`core/` + `harness/opencode/` から `dist/opencode/` へ生成される。エンジンツリーは `.aidlc/` に出荷される（opencode は `.opencode/tools/*.ts` をカスタムツールとして自動インポートするため、エンジンをそこに置けない）。`.opencode/` はネイティブシェル（subagent・`/aidlc` コマンド・hook アダプタのプラグイン）だけを運び、AIDLC のメソッドはプロジェクトルートの `opencode.json` の `instructions` glob 経由で読まれる。`/aidlc` で呼び出す。[opencode 上の AI-DLC](harnesses/opencode.md) を参照。 |
| **Orchestrator** | ワークフローがどう駆動されるかの総称: 次に何が起きるかを決める決定論的な **Engine** と、それを実行する **Conductor**（`SKILL.md`）。`/aidlc` で呼び出す。[Engine と Skill システム](../reference/17-skill-system.md) を参照。 |
| **Packager** | `scripts/package.ts` — **Core** と各 **Manifest** からすべての `dist/<harness>/` **Distribution** を再生成するビルド。`bun scripts/package.ts` で全ビルド、`--check` は CI で走るバイト一致のドリフトガード。 |
| **Parallel batch** | 依存が満たされ、互いに依存しない Bolt のグループ。orchestrator が並行実行する。バッチ末尾の 1 つの承認 gate が中のすべての Bolt をカバーする。 |
| **Pipeline execution** | 宣言された順にリンクが走る dispatch された連鎖（`mode: pipeline`）。各リンクは上流の仕事をすべて見え、最後のリンクが成果物を完成させる。Reverse Engineering（2.1）が出荷されている pipeline である。 |
| **Phase** | ライフサイクルの 5 大区分のひとつ: Initialization（0）・Ideation（1）・Inception（2）・Construction（3）・Operation（4）。各 phase は 3〜8 の stage を含む（Initialization 3・Ideation 7・Inception 8・Construction 7・Operation 7）。 |
| **Phase boundary verification** | phase の遷移で走る自動のトレーサビリティ検査。下流 stage が積み上げる前に、欠けたリンク・孤立した成果物・不整合を捕まえる。 |
| **Plane** | フレームワークが分離する 3 つの関心事のひとつ。ネットワーキングのアーキテクチャから借用: **制御プレーン**（stage 定義・Rule・Sensor — 何が走るべきかのスキーマ。コンパイル時に解決）、**データプレーン**（実際の stage 実行・Bolt・audit の遠隔測定）、**管理プレーン**（`/aidlc --doctor`・audit の照会・`CLAUDE.md`）。ユーザー向けの導入は [Rule と学習ループ](09-rules-and-the-learning-loop.md)、完全なモデルは `docs/reference/02-plane-architecture.md` を参照。 |
| **Record dir** | 1 つの intent の成果物・stage ごとの `memory.md` 日誌・`aidlc-state.md`・`audit/` シャードを保持する intent 別ディレクトリ: `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`（`<record>/` と表記）。intent ごとに 1 つ持ち、アクティブなものは `active-intent` ポインタが選ぶ。**Space**・**Intent** を参照。 |
| **Recovery breadcrumb** | PreCompact hook が書く隠しファイル `.aidlc-recovery.md`。コンパクション後の状態破損を検出するため、最後に検証された stage とタイムスタンプを含む。 |
| **Reviewer** | 品質 gate のエージェント — `aidlc-product-lead-agent`（要件・ストーリー・モックアップ）または `aidlc-architecture-reviewer-agent`（技術設計）。stage が `reviewer:` フィールドを宣言しているとき、stage 本体が成果物を作った後に独立した sub-agent として起動される。主要成果物に `## Review` の判定（READY / NOT-READY）を追記し、NOT-READY ならビルダーが再実行して `reviewer_max_iterations`（既定 2）までループし、その後は未解決の指摘を人間の承認 gate に提示する。決してブロックしない — 決めるのは常に人間である。[エージェント](06-agents.md) を参照。 |
| **Rule** | ワークスペースルートのアクティブ space の memory 層（`aidlc/spaces/<active-space>/memory/`）に一度だけ書かれ、各 harness のネイティブな取り込み（Claude の `@`-import スタブ、Kiro CLI の resources または IDE の steering、Codex の `AIDLC_RULES_DIR`）でコンテキストへ引き込まれ、カバーするすべての stage に適用される永続的な行動ルール。rule は厳密加算の 5 層連鎖 — org → team → project → phase → stage — で解決され、適用されるすべての rule がコンテキストに現れる。広い層は決して上書きされず、足されるだけである。rule は**制御ループ**の feedforward 側であり、決定論検証のために Sensor と対になりうる。[Rule と学習ループ](09-rules-and-the-learning-loop.md) を参照。 |
| **Runtime graph** | intent の record dir にあるワークフロー単位の `runtime-graph.json` 成果物: 構造的な stage グラフのデータプレーン側の鏡で、承認 gate のたびに audit ログから実体化される。どの stage が走ったか、どの Bolt がフォークしたか、どの Sensor が発火したか、`memory.md` のエントリ数を記録する — doctor と学習ループが読む、照会可能な実行ビューである。 |
| **Scope** | どの stage をどの depth で実行するかを決める 9 つの名前付き構成（enterprise・feature・mvp・poc・bugfix・refactor・infra・security-patch・workshop）のひとつ。自由記述の intent からの自動検出もできる。 |
| **Sensor** | `.claude/sensors/` のマニフェスト（例: `aidlc-linter.md`、`aidlc-type-check.md`）で定義される決定論的検証チェック。sensor は PostToolUse hook 経由で stage の出力への Write/Edit に発火し、advisory な `SENSOR_*` audit 行を記録する — ワークフローを決してブロックしない。どの Sensor が発火するかは stage が `sensors:` frontmatter リストで宣言する。Sensor は**制御ループ**の feedback 側、Rule は feedforward 側である。[Rule と学習ループ](09-rules-and-the-learning-loop.md) を参照。 |
| **Test strategy** | いくつのテストを生成しどのテスト種別を含めるかを制御する、3 つのテスト量レベル（Minimal・Standard・Comprehensive）のひとつ。depth からは独立 — scope が独自の既定を宣言しない限り depth のレベルに従う（例: workshop の既定は Minimal）。[Scope・Depth・テスト戦略](05-scopes-and-depth.md#the-3-test-strategy-levels) を参照。 |
| **Session** | `/aidlc` を実行する 1 つの Claude Code の会話。ワークフローは再開機構により複数セッションにまたがりうる。 |
| **Skill** | Claude Code のプリミティブ: スラッシュコマンドを登録する、YAML frontmatter 付きの markdown ファイル。AI-DLC の orchestrator は `/aidlc` skill として実装されている。ユーザー向けドキュメントでは「skill」より「command」を好む。 |
| **Space** | `aidlc/spaces/<space>/` にあるチーム単位のワークスペース。自分の `memory/`・`knowledge/`・intent 記録（`intents/`）を持つ。アクティブな space は gitignore 済みの `aidlc/active-space` ポインタで解決され、既定は `default`。単一チームのユーザーは `spaces/default/` しか見ない。**Intent**・**Knowledge** を参照。 |
| **Stage** | ライフサイクルの 32 の離散ステップのひとつ。各 stage はリードエージェントと定義された入出力を持ち、stage プロトコルに従う。stage は phase ごとに番号付けされる（例: 1.1、2.4、3.5）。 |
| **State file** | `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/aidlc-state.md`（intent の record dir 配下）にある intent 単位の永続的ワークフロー状態。6 状態チェックボックス（`[ ]` / `[-]` / `[?]` / `[R]` / `[x]` / `[S]`）で stage 進捗・scope・ワークスペース文脈・セッション再開情報を追跡する。 |
| **Subagent execution** | conductor が harness の dispatch ツールを通じて別のエージェントコンテキストを起動する、dispatch されたハブ（`mode: subagent`）。Code Generation（3.5）は集中実行の 1 エージェント。Practices Discovery（2.2）は hub-and-spoke: リードの草稿、相互に盲目な 3 つの支援 contribution、人間へのインタビュー、リードの統合。 |
| **Unit of work** | stage 2.7（Units Generation）で分解される、独立実装可能なソリューションの断片。1 つ以上の Unit が Construction のために Bolt に束ねられる。 |
| **Walking skeleton** | Construction の最初の Bolt — すべての統合点を通す最薄の end-to-end スライス。残りの Construction が走る前に全体の形を確認できるよう、常に gate 付き・対話的である。承認の直後に ladder prompt が発火する。 |
| **Utility command** | `/aidlc` に渡す非ワークフローのフラグ。`--status`・`--doctor`・`--version`・`--stage`・`--phase`・`--scope` のような、完全なワークフローを走らせずに特定の操作を行うもの。 |
| **Workflow** | `/aidlc` の呼び出しから stage の完了までの、AI-DLC ライフサイクルの end-to-end の 1 回の実行。特定のタスク（feature・bugfix 等の scope）に限定される。 |
