# Cursor 上の AI-DLC

`dist/cursor/` は、[Cursor](https://cursor.com) 向けの、フレームワークの harness ディストリビューションのひとつである。1 つのツリーが **Cursor IDE** と **Cursor CLI**（`agent`）の両方に給仕する: 両者は同じ `.cursor/` の発見機構を共有する。1 つの決定論的 core、多くの harness: エンジン、状態機械、audit ログ、グラフ、swarm の referee、learnings の gate はすべてのディストリビューションでバイト同一 — 異なるのはシェルだけである。このツリーは `core/` + `harness/cursor/` から `bun scripts/package.ts cursor` で**生成**される。決して手で編集しないこと（ドリフトガードが CI を落とす）。

## レイアウト

Cursor はこれまでで最も「ネイティブ」なポートである — 標準の core プロジェクションを直接消費する（`emit.ts` も分割 dot ディレクトリも無い）。ディストリビューションの構成:

- **`.cursor/`** — フレームワークのツリー。Cursor がネイティブな意味として読むサブディレクトリはごく一部: `rules/`（1 つの standing と 4 つの phase メソッドポインタ）、`agents/`（14 のペルソナをネイティブ subagent として）、`skills/`（orchestrator・utility ショートカット・生成された stage ランナー）、`hooks.json` + `hooks/`（hook の配線とアダプタ）、`cli.json`（権限）、`mcp.json`（MCP サーバー、追加する場合）。それらの傍にあるエンジンのディレクトリ（`tools/`・`aidlc-common/`・`knowledge/`・`sensors/`・`scopes/`）は Cursor にとって不活性なデータであり、同じディレクトリを安全に共有する。
- **`aidlc/`** — ワークスペースシェル（エンジンが読む構築済みの `aidlc/spaces/default/memory/` メソッドツリー）、`.cursor/` の兄弟。
- **`AGENTS.md`** — Cursor が自動で読むプロジェクトルートのアンビエント指示。

## 前提条件

- **Cursor** — IDE か Cursor CLI（`curl https://cursor.com/install -fsS | bash` でインストール、`agent` として起動）。両方がこのインストールの `.cursor/` サーフェスを読む。cursor-agent 2026.07 で検証済み。hook（`.cursor/hooks.json`）と skill（`.cursor/skills/`）は current-line の機能である。
- **bun** — どの harness とも同じ要件。すべてのツールと hook は bun 経由で走る。`bun` は Cursor が spawn するシェルが見える PATH に無ければならない。
- **名前付きモデル向けの有料 Cursor プラン** — 無料アカウントは `Auto` しか使えない。tier 付きのペルソナサーフェスは**モデル固定を持たずに**同梱される（すべての tier が Cursor 上では null に投影される: モデルの利用可否はプラン依存のため）、そのためすべてのエージェントがセッションモデルを継承する。`--model` を渡すヘッドレス CLI 実行には、それを許すプランが必要である。Bedrock の BYOK は IDE 専用: Pro では静的キー、Teams では IAM ロール（Cursor のモデル設定に対して文書で確認済みだが、ここではライブ検証していない）。CLI はモデルを Cursor 自身のバックエンド経由で回す。

## インストール

1. ディストリビューションをプロジェクトへインストールする:

   ```bash
   bun dist/cursor/install.ts your-project
   ```

   インストーラは完全コピーを事前確認し、プロジェクト所有の衝突を拒否し、`.cursor/.gitignore` と既存のメソッド memory を保持し、`.cursor/hooks.json` と `.cursor/cli.json` を構造的にマージし、既存の `AGENTS.md` と `.gitignore` ファイルには置き換えではなくマーク付きの AI-DLC セクションを追加する。フレームワークの所有権を `.cursor/aidlc-install.json` に記録する。再実行すると、`aidlc/active-space` と明示的なプラグイン選択・合成状態を保ちながら管理対象ファイルをアップグレードし、削除後に復元されたファイルを含め、すべての可変な rule・ペルソナポインタにその space を再適用する。plugin が合成した stage ファイルは、contribution sidecar か seam sentinel がその stage を識別できる場合にのみ保持され、インストーラは保持したすべての管理対象パスを出力する。無関係な core stage は通常の receipt-hash の衝突・アップグレード処理をそのまま通る。
   `aidlc/` シェルは、エンジンが読む構築済みの `aidlc/spaces/default/memory/` メソッドツリーを同梱する。これが無いと `/aidlc --doctor` の「workspace shell ready」チェックが失敗する。

2. Cursor IDE でプロジェクトを開く（または中で `agent` を起動する）。`/aidlc --doctor` を実行し、続けて `/aidlc` に作りたいものを続けて打つ。ネイティブの utility ショートカットは `/aidlc-status`、`/aidlc-jump --stage <slug>`（または `--phase <name>`）、`/aidlc-scope <name>` である。

## この harness での違い

- **質問は番号付きの散文の選択肢として描画される**（構造化質問のウィジェットは無い）。`[Answer]:` タグ付きの質問ファイルが正であることは変わらない。
- **hook は AIDLC アダプタ（`.cursor/hooks/aidlc-cursor-adapter.ts`）を通じて `.cursor/hooks.json` に乗る**。アダプタは Cursor の camelCase の hook イベント（`sessionStart`・`sessionEnd`・`beforeSubmitPrompt`・`preToolUse`・`postToolUse`・`postToolUseFailure`・`preCompact`・`stop`）を、バイト共有の core hook 本体（bun のサブプロセスとして実行）に対応付ける: 各 human turn での human-turn 記録、ツール実行前の state-transition・reviewer 読み取りスコープ・review-freeze・plan-approval の各 guard、write / edit での audit + sensor、失敗した Task の attribution クリーンアップ、shell での stage-graph 再構築、コンパクション前の状態検証。**PreToolUse guard のブロック**は Cursor の `{"permission":"deny","agent_message":...}` の stdout チャネル経由で行われ、`failClosed: true` を登録する。不正な入力、guard の欠落、guard のクラッシュはすべて操作を拒否する。Cursor はシェルツールを `Shell` と呼ぶ。アダプタはこれを core hook の `Bash` に対応付ける。Cursor のファーストクラスの `Delete` ツール（この harness だけに固有 — 他のすべての harness では削除はシェルを経由する）は reviewer-scope guard に write として提示されるため、unit-scoped の reviewer が兄弟 unit の成果物を削除することはできない。Shell ペイロードの入れ子になった `cwd`/`working_directory` フィールドは共有 guard 契約に昇格されるため、相対的な読み取りと書き込みは Cursor が実際に実行する場所でチェックされる。
- **forwarding loop の強制は助言的である。** Cursor の `stop` hook は停止を拒否できないため、core の stop hook が `block` と答えたときアダプタは代わりにフォローアップのナッジを表示する（opencode と同じ姿勢）。ホストの `loop_limit` は Cursor の既定の 5 ではなく 10 であり、これは core の自律的な no-progress 上限 8 をカバーする。conductor スキル内の forwarding loop こそが本当の規律である。
- **本物の session-end の瞬間が存在する**（Codex とは異なり）: `sessionEnd` が発火するため、`SESSION_ENDED` の audit イベントが発行される。コンパクション前の検証も発火する（`preCompact`）。
- **ペルソナはネイティブの subagent である。** `.cursor/agents/` 配下の 14 のペルソナ `.md` ファイルは frontmatter の `name` で発見される。conductor は大半の stage でこれらを inline に纏い、2 つの subagent stage（2.1 reverse-engineering・3.5 code-generation）では `task` ツールで委譲する。worker エージェントは `task` ツールを持たないため、委譲先が再委譲することはできない。
- **subagent の identity は再構成される。** Cursor は hook ペイロード上で subagent 別の identity を一切出さない（`subagentStart`/`subagentStop` イベントは文書化されているが CLI では発火しない）。そのためアダプタは `aidlc/.aidlc-cursor-subagents/` 配下に保護されたプロジェクトローカルの runtime ledger を保持する: トップレベルの会話は `sessionStart`/`beforeSubmitPrompt` の時点で自己登録し（subagent の会話はどちらのイベントも受け取らない）、各 Task の spawn がそのエージェントを記録し、reviewer 読み取りスコープの強制は、登録されたトップレベルセッションではない会話からの呼び出しに帰属を付ける。親の次の同期的な Task dispatch は、その直前のレコードを引退させて記録する（Cursor CLI は Task の `postToolUse` を一切出さない）。真の親間の曖昧さは、reviewer が生きている間は常に保守的にとどまるため、reviewer-scope の強制を無効化することはできない。委譲されたツールは、祖先の削除や無引用のシェル glob / character-class パスを経由しても ledger や dispatch レコードにアクセスできない。attribution のストレージが欠落または読み取り不能な状態で reviewer の dispatch がなお有効なら、操作は reviewer の強制を逃れるのではなく fail closed する。review の delegate は通常の Shell コマンドを使えるが、汎用インタプリタと動的なコマンド評価は拒否される。Cursor のネイティブな読み取り / 検索ツールを使い、実行可能なプローブは親の会話に走らせる。
- **生成された stage・scope ランナーは明示専用である。** Cursor は生成されたランナースキル（plugin のランナーを含む）に `disable-model-invocation: true` を受け取るため、通常のコーディングプロンプトが状態変更を伴うワークフローショートカットを自動起動することはない。
- **utility ショートカットはネイティブなスキルである。** `/aidlc-status`・`/aidlc-jump`・`/aidlc-scope` は、第 2 のエンジン経路を作ることなく、スラッシュメニューでの発見性を改善する。いずれも `disable-model-invocation: true` を持ち、Cursor はユーザーが選んだときだけそれらを起動する。レガシーの `.cursor/commands/` サーフェスは同梱されない。
- **method rule は読み取り指示であり、import ではない。** Cursor の rule は `@`-import 行を展開しない。`.cursor/rules/aidlc.mdc` は常に適用され、アクティブな space の org/team/project ファイルを指す。4 つの `.cursor/rules/aidlc-phase-*.mdc` rule はエージェントが判断し、関連するときだけ該当する phase ファイルを指す（cursor-agent でライブ検証済み: phase を意識したプロンプトは該当する phase rule だけを読み込み、無関係なプロンプトはどれも読み込まない）。`sessionStart` hook は別途ライブなワークフロー文脈を注入する。`/aidlc space <name>` は 5 つの rule ファイルすべてをその場で向け直す。
- **Construction の swarm は task ツールのファンアウトのみで走る**（`AIDLC_USE_SWARM=1` は大きな音の no-op — Workflow ツールは存在しない）。
- **ステータスライン / ウェルカムメッセージは無い** — `/aidlc-status`（または `/aidlc --status`）と各 gate の進捗行を使う。
- **Tab の自動補完はこのインストールで変更されない** — 設定に関わらず Cursor 自身のモデルに乗る。
- **Permissions**: `.cursor/cli.json` は `Shell(bun)` のみを事前承認する（プロジェクトレベルの `cli.json` は権限のみを運ぶ）。それ以外のすべてのシェルコマンドは、あなたの Cursor の承認設定に従う。
- **MCP サーバー**: 同梱なし。必要なら `.cursor/mcp.json` 配下に自分で設定する。
- **ヘッドレスの `agent -p` 実行は承認 gate を通過できない。** human-presence の mint は `beforeSubmitPrompt` に乗るが、Cursor はこれを対話的な送信のときだけ発火する（cursor-agent 2026.07 で検証済み） — そのため print モードの実行は `HUMAN_TURN` を一切記録せず、gate 付きの stage は、無人のモデルが自分の作業を承認できるようにするのではなく、設計どおり承認を拒否する。ヘッドレスモードは読み取り専用の utility（`--status`・`--doctor`・`--version`）と自律的な Construction（gate に人間がいないため免除される）に使い、gate 付きのワークフローは対話的な Cursor セッションで実行する。これはフレームワークの presence gate の性質であり、Cursor の制約ではない — どの harness も presence を human-prompt イベントから mint する。

## インストールの検証

```bash
bun .cursor/tools/aidlc-utility.ts doctor        # all checks pass on a fresh copy
agent -p "/aidlc --status" --output-format text --trust   # /aidlc --status through the CLI
```

doctor の Cursor 固有チェック: `.cursor/hooks.json` の hook 配線、`.cursor/cli.json` の `Shell(bun)` 権限の事前承認、`.cursor/rules/aidlc.mdc` の standing rule、そして 4 つすべての phase-rule ポインタ。

> **スクリプティングの罠: Cursor CLI は常に exit 0 になる。** ヘッドレスの `agent -p "<prompt>" --output-format text --trust` は実行がエラーになってもリターンコード 0 を返す。そのため CI チェックは出力されたテキストで判定しなければならず、exit ステータスで判定してはならない。名前付きモデル（`--model`）には有料プランが必要である。無ければ `Auto` を使う。

## 次のステップ

インストールと検証は済んだ？ 方法論はどの harness でも同じである — 中立の章で続きを:

- [最初のワークフロー](../02-your-first-workflow.md) — 注釈付きの end-to-end 実行。
- [Phase と Stage](../04-phases-and-stages.md) — 5 つの phase と 32 の stage。
- [Scope・Depth・テスト戦略](../05-scopes-and-depth.md) — 実行の適切なサイズ選び。
- [用語集](../glossary.md) — すべての用語の定義。

他の harness: [opencode 上の AI-DLC](opencode.md) · [harness ファミリーの索引](README.md)。
