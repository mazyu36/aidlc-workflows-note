# Codex CLI 上の AI-DLC

`dist/codex/` は、OpenAI の **Codex CLI** harness 向けの、フレームワークの harness ディストリビューションのひとつである。1 つの決定論的 core、多くの harness: エンジン、状態機械、audit ログ、グラフ、swarm の referee、learnings の gate はすべてのディストリビューションでバイト同一 — 異なるのはシェルだけである。このツリーは `core/` + `harness/codex/` から `bun scripts/package.ts codex` で**生成**される。決して手で編集しないこと（ドリフトガードが CI を落とす）。

## 前提条件

- **Codex CLI ≥ 0.139.0** — それより古いリリースは subagent の hook ペイロードで本物の
  エージェントロールを表に出さず、ハイフン入りのエージェント TOML を解決しない。
  `/aidlc --doctor` がこのピンを強制する。`codex --version` で確認する。
- **bun** — Claude の harness と同じ要件。すべてのツールと hook は bun 経由で走る。
- **モデルプロバイダ** — 同梱の `config.toml` は既定で **Amazon Bedrock**
  （`openai.gpt-5.5`。エージェントは `openai.gpt-5.4`）。AWS のプロファイル / リージョンを
  `[model_providers.amazon-bedrock.aws]` に設定する。OpenAI 認証を使うならプロバイダの行を
  コメントアウトする。注: Bedrock では `web_search` が使えない。market-research の stage は
  穏当に劣化する。

## インストール

1. ディストリビューションをプロジェクト（**git リポジトリ**でなければならない —
   Codex はプロジェクトの `.codex/hooks.json` を git リポジトリの中でしか発見しない）へ
   コピーする:

   ```bash
   cp -r dist/codex/.codex/  your-project/.codex/
   cp -r dist/codex/.agents/ your-project/.agents/
   cp -r dist/codex/aidlc/   your-project/aidlc/      # the workspace shell (spaces/default/memory) — a sibling of .codex/, not inside it
   cp dist/codex/AGENTS.md   your-project/AGENTS.md   # or merge into yours
   ```

   `aidlc/` ディレクトリはワークスペースシェルである — エンジンが読む構築済みの
   `aidlc/spaces/default/memory/` メソッドツリーを同梱する。`.codex/` の**兄弟**なので
   別にコピーする（もしくは `dist/codex/` ツリー全体を一度にコピーする）。これが無いと
   `$aidlc --doctor` の「workspace shell ready」チェックが失敗する。

2. ワークフローを始める**前に**、同梱 `AGENTS.md` の「Git Integration」節にある
   `.gitignore` エントリを適用する — 各 intent の `audit/` 配下のクローン別 audit
   シャードは意図的にコミットされ（各クローンが自分の `<host>-<clone>.md` に書くため、
   並行追記が git コンフリクトすることはない）、ユーザーごとのカーソルとマシンローカルの
   ランタイム状態は無視されたままになる。

3. プロジェクトを信頼し、hook の trust を事前シードする。Codex は信頼されていない hook を
   決して実行しない（`--dangerously-bypass-hook-trust` フラグでも実行されない）。
   対話的な TUI セッションを 1 回走らせて hooks ダイアログで「Trust all and continue」を
   選ぶか、AI-DLC のソースチェックアウトから決定論的に事前シードする。固定された開発依存を
   一度インストールし、エントリを生成する:

   ```bash
   bun install --frozen-lockfile
   bun scripts/package.ts codex trust --project "/abs/path/to/your project"
   ```

   このコマンドは `$CODEX_HOME/config.toml` に貼れる `[hooks.state]` エントリを出力する
   （ハッシュはパスではなく hook の同一性を覆う — 出力されるエントリは同梱の `hooks.json`
   に対して正確である）。コマンドは完全な出力を TOML として直列化するため、クォートされた
   パス・空白・Windows のバックスラッシュは保たれる。hook のマニフェストが
   `<project>/.codex/hooks.json` に無い場合は、その正確なパスを明示的に渡す:

   ```bash
   bun scripts/package.ts codex trust \
     --project "/abs/path/to/your project" \
     --hooks-json "/abs/custom path/hooks.json"
   ```

   シェルでは両引数をクォートする。`--hooks-json` は Codex の trust の同一性として
   そのまま使われる。エントリの生成後に正規化や置換をしないこと。コマンドの stdout 全体を
   ユーザー設定に貼り付ける。同じ `hooks.json` パスのエントリが既にあるなら、その一式を
   置き換える。2 つ目のコピーを追記しないこと — 重複した TOML テーブルは設定全体を
   無効化する。

4. 同梱の `.codex/config.toml` を `~/.codex/config.toml` にマージする（またはプロジェクト
   レベルに保つ — 信頼されたプロジェクトはそれを読む）。検証:

   ```bash
   bun .codex/tools/aidlc-utility.ts doctor
   ```

## 使う

orchestrator は `$aidlc`（または `/skills` → aidlc）に scope か記述を続けて呼び出す —
コマンドは Claude harness と同じである（`$aidlc --status`・`$aidlc --help`・…）。
stage ランナーは明示専用: `$aidlc-application-design`・`$aidlc-bugfix` 等
（37 のランナー記述がインデックスを汚さないよう、暗黙のスキルマッチングから除外されている）。

## Claude Code に対する harness の差分

- **gate** は、同梱設定のフラグが有効なとき `request_user_input` ツールで描画され、
  そうでなければ番号付き散文のフォールバック（番号か自由文で回答）になる。gate の意味論は
  どちらにせよエンジン側にある。
- **カスタムのステータスラインは無い** — ワークフローの位置は `update_plan` ツール
  （`task-progress` のステータスライン項目）と `$aidlc --status` に乗る。
- **サンドボックス下の git**: `workspace-write` は設計上、サンドボックス内で `.git` を
  読み取り専用に保つ。対話セッションは自動でエスカレーションし、同梱の
  `.codex/rules/default.rules` が `git worktree`/`commit`/`add` を事前許可する。
  ヘッドレス実行（CI・exec のワーカー）は `writable_roots = ["<main repo>/.git"]` を
  必要とする — 同梱 `config.toml` にテンプレートがある（リンクされた worktree は
  `<main>/.git/worktrees/*` へ解決されるため、メインリポジトリの `.git` でなければ
  ならない）。
- **swarm の床 = `codex exec` のワーカー** — Construction の unit ごとに、その Bolt の
  worktree でヘッドレスのワーカーを 1 つ（常に `< /dev/null`）、同じ決定論の referee で
  走らせる。`AIDLC_USE_SWARM=1` はここに Workflow ツールが無いため大きな音で劣化する
  （`SWARM_DEGRADED` が audit される）。
- **セッションのライフサイクル**: Codex には SessionEnd のイベントが無い。閉じられなかった
  セッションは、次のセッション開始時に推定の `SESSION_ENDED` audit 行として調停される。
  Codex 専用の PostCompact イベントはコンパクション後にワークフローのミッションを
  再注入する — Claude harness に対する決定論の向上である。
- **成果物 audit の忠実度**: ヘッドレスの `codex exec` 実行では、モデルがシェルの
  ヒアドキュメントでファイルを書くことが多く、これは `apply_patch` の hook マッチャを
  すり抜ける — `ARTIFACT_*` の行が疎になりうる。対話的な TUI セッション（システムプロンプトが
  `apply_patch` を義務付ける）が高忠実度の audit モードである。
- **AIDLC のルール層**はワークスペースルートの `aidlc/spaces/<active-space>/memory/` に住む（手で編集できる 1 つのソース。どの harness でも同一）。`config.toml` の `AIDLC_RULES_DIR` env の継ぎ目がリゾルバをそこへ向け、orchestrator は `@aidlc/spaces/<active-space>/memory/...` のプロンプト言及を注入する。Codex ネイティブの `.codex/rules/` ディレクトリは Starlark の権限ルールを持つ — AIDLC のメソッドとは別物である。
- **ウェルカムメッセージは無い**: Claude harness はセッション開始時に `settings.json` の
  `companyAnnouncements` から Phases/Stages/Scopes のオンボーディングバナーを描画する。
  Codex に同等物は無い。session-start の経路は再開の文脈だけを注入する。
- **MCP サーバー**: Codex は MCP の定義を `config.toml`（プロジェクトの
  `.codex/config.toml` か `~/.codex/config.toml`）の `[mcp_servers.<name>]` テーブルから
  読む — 必要なサーバーをそこに足す。同梱の設定は**何も**宣言しない（Claude harness は
  `.mcp.json` で 5 つ同梱するが、Codex は既定でゼロ）。

## 再生成

```bash
bun scripts/package.ts codex          # regenerate dist/codex from core/ + harness/codex/
bun scripts/package.ts --check        # CI drift guard (every harness)
```

core の `.ts` ファイルは `core/tools/` と `core/hooks/` のソースとバイト同一である
（`tests/unit/t150-codex-packaging.test.ts` が固定）。散文は `{{HARNESS_DIR}}` トークンを
運び、パッケージャが `.codex` に置換する（加えて `rules/` → `aidlc-rules/` のリネーム）。
これが唯一許された変換クラスである。ライブの end-to-end ジャーニーは
`tests/e2e/t-exec-codex-status.serial.test.ts`（gate: `AIDLC_CODEX_EXEC_LIVE=1`）。

## 次のステップ

インストールと trust は済んだ？ 方法論はどの harness でも同じである — 中立の章で続きを:

- [最初のワークフロー](../02-your-first-workflow.md) — 注釈付きの end-to-end 実行。
- [Phase と Stage](../04-phases-and-stages.md) — 5 つの phase と 32 の stage。
- [Scope・Depth・テスト戦略](../05-scopes-and-depth.md) — 実行の適切なサイズ選び。
- [用語集](../glossary.md) — すべての用語の定義。

他の harness: [Kiro IDE で AI-DLC を動かす](kiro-ide.md) · [harness ファミリーの索引](README.md)。
