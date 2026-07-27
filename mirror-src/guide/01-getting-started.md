# はじめかた

本章では、この実装のインストール、環境の検証、最初のワークフローへの準備を順に進める。

---

## 前提条件

この実装はシステムに 2 つのツールを必要とする:

| 前提条件 | 目的 | インストール |
|-------------|---------|---------|
| **Claude Code** | この実装は Claude Code のコマンドとして動作する。orchestrator・エージェント・hooks はすべて Claude Code 内で実行される。 | ネイティブインストール（推奨・自動更新）: macOS/Linux/WSL `curl -fsSL https://claude.ai/install.sh \| bash`; Windows PowerShell `irm https://claude.ai/install.ps1 \| iex`。または `brew install --cask claude-code`。（[docs](https://code.claude.com/docs/en/quickstart)） |
| **bun** | すべての CLI ツールと全 13 hooks（状態管理・audit ログ・sensor ディスパッチ・runtime-graph コンパイル・ループ強制・状態遷移と reviewer スコープの強制・statusline・human-turn の記録）に必要。すべて TypeScript で bun により実行される（起動 約 20ms）。追加依存なし — macOS・Linux・ネイティブ Windows PowerShell で同一に動作する。 | `curl -fsSL https://bun.sh/install \| bash`（[docs](https://bun.sh)）。Windows では: `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 \| iex"` |

> **重要**: 非対話シェルでも `bun` が `PATH` に載っていること。Claude Code はシェルを非対話で実行するため、読み込まれるのは `~/.zshenv`（zsh）または `~/.bashrc`（bash）であり、`~/.zshrc` ではない。Windows の Git Bash では `~/.bashrc` が正しいファイルになる。Claude Code 内で `which bun` が失敗する場合は、該当ファイルに bun の PATH export を追加する。

前提条件の検証:

```bash
command -v claude >/dev/null && echo "✓ Claude Code installed" || echo "✗ Install Claude Code first"
command -v bun    >/dev/null && echo "✓ bun installed"          || echo "✗ Install bun first"
```

## AWS Bedrock のセットアップ

この実装は **AWS Bedrock** 向けに設定済みで出荷される。同梱の `.claude/settings.json` は次を設定する:

| 変数 | 値 | 目的 |
|----------|-------|---------|
| `CLAUDE_CODE_USE_BEDROCK` | `1` | Claude Code を Bedrock 経由にルーティングする |
| `AWS_REGION` | `us-east-1` | Bedrock のリージョン — **必須**。Claude Code は `~/.aws` からは読まない。リージョンの上書きは後述。 |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `global.anthropic.claude-fable-5[1m]` | `fable`/`fable[1m]` を選ぶユーザー向けの Fable エイリアス |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `global.anthropic.claude-opus-4-8[1m]` | orchestrator のモデル（`opus[1m]`、1M コンテキスト版として使用） |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `global.anthropic.claude-sonnet-4-6[1m]` | subagent のモデル |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | バックグラウンド / 高速タスク（`[1m]` なし: Haiku 4.5 は 200K モデルで 1M 版が無い） |

これらのモデル固定は global な Bedrock 推論プロファイル ID（`global.` プレフィクス）を使う。Fable・Opus・Sonnet の固定に付く `[1m]` サフィックスは 1M コンテキスト版の選択で、これにより（`opus[1m]` の orchestrator だけでなく）tier 固定された subagent も 1M ウィンドウを得る。Claude Code はモデル ID が Bedrock に届く前にサフィックスを取り除く。AWS アカウント側のセットアップは 1 回だけ必要になる。

### AWS アカウントの 1 回限りのセットアップ（手動パス）

1. **Anthropic モデルアクセスを有効化する。** [Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/) の **Model catalog** を開き、使用する各 Anthropic モデル（Fable・Opus・Sonnet・Haiku）を選択してユースケースフォームを送信する。アクセスは即時に付与される。モデルを呼び出す前に AWS アカウントごとに 1 回必要になる。（AWS Organizations では管理アカウントから 1 回送信すれば、承認が子アカウントにも及ぶ。）

2. **IAM 権限をアタッチする。** ロール / ユーザーがモデル呼び出しと推論プロファイル解決に必要とする権限:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowModelAndInferenceProfileAccess",
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel",
           "bedrock:InvokeModelWithResponseStream",
           "bedrock:ListInferenceProfiles",
           "bedrock:GetInferenceProfile"
         ],
         "Resource": [
           "arn:aws:bedrock:*:*:inference-profile/*",
           "arn:aws:bedrock:*:*:application-inference-profile/*",
           "arn:aws:bedrock:*:*:foundation-model/*"
         ]
       }
     ]
   }
   ```

3. **AWS 認証情報を用意する。** Claude Code は AWS SDK の既定の認証情報チェーンを使う。次のいずれか 1 つで良い:

   ```bash
   aws configure                         # static access key / secret
   # — or — an SSO profile:
   aws sso login --profile <your-profile>
   export AWS_PROFILE=<your-profile>
   # — or — credentials already exported in your environment (AWS_ACCESS_KEY_ID, etc.)
   ```

   秘密情報は共有の `settings.json` に置かない。`AWS_PROFILE`（や漏らしたくない env）は、代わりに gitignore 済みの `.claude/settings.local.json` に置く。

4. **リージョンを設定する**（`us-east-1` でない場合）。同梱の既定は `us-east-1` で、共有設定を編集せずに上書きできる:

   ```bash
   cp .claude/settings.local.json.example .claude/settings.local.json
   # then add  "AWS_REGION": "<your-region>"  to the env block
   ```

   `settings.local.json` は `settings.json` より優先される。モデルがそのリージョンで利用可能かは `aws bedrock list-inference-profiles --region <your-region>` で確認する。

> **より簡単なパス:** 上記の手動手順の代わりに `claude` を実行し、ログインプロンプトで **3rd-party platform → Amazon Bedrock** を選ぶと、ウィザードが認証情報・リージョン・アクセス可能なモデルを検出してユーザー設定に書き込む。変更したいときは `/setup-bedrock` をいつでも再実行できる。手順 1（モデルアクセス）だけはコンソールで 1 回完了させる。

権威ある常時更新のセットアップ情報 — IAM の詳細、SSO の更新、推論プロファイル、トラブルシューティング — は AWS のガイドを参照: **[Claude Code on Amazon Bedrock: Quick Setup Guide](https://community.aws/content/2tXkZKrZzlrlu0KfH8gST5Dkppq/claude-code-on-amazon-bedrock-quick-setup-guide)** および [Amazon Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)。

## MCP サーバー（任意）

この実装はプロジェクトルート（`.claude/` の隣）の `.mcp.json` で MCP サーバーを宣言する。Claude Code がセッションにプロビジョニングし、すべての AI-DLC エージェントがその全部を継承する — つまり、宣言済みのどのサーバーにも、エージェントごとの許可なしで到達できる。同梱の `.mcp.json` は 5 つの MCP サーバーを宣言する:

| サーバー | 提供するもの | トランスポート | 認証情報 |
|--------|----------|-----------|-------------|
| `context7` | ライブラリ / SDK ドキュメントの検索 | HTTP | 環境変数の `CONTEXT7_API_KEY` |
| `aws-mcp` | AWS API アクセス | `uvx`（`mcp-proxy-for-aws@latest`、`AWS_REGION=us-east-1`） | 標準の AWS 認証情報チェーン |
| `aws-pricing` | AWS 料金の照会 | `uvx`（`awslabs.aws-pricing-mcp-server@latest`） | AWS 認証情報チェーン |
| `aws-iac` | Infrastructure-as-code ツーリング | `uvx`（`awslabs.aws-iac-mcp-server@latest`） | AWS 認証情報チェーン |
| `aws-serverless` | サーバーレスツーリング | `uvx`（`awslabs.aws-serverless-mcp-server@latest`） | AWS 認証情報チェーン |

### 前提条件

4 つの AWS サーバーは `uvx` 経由で起動する。`uv`/`uvx` を 1 回インストールする:

```bash
curl -fsSL https://astral.sh/uv/install.sh | sh
```

`context7` は HTTP サーバーでローカルインストール不要。使うには API キーを export する:

```bash
export CONTEXT7_API_KEY=<your-key>
```

`CONTEXT7_API_KEY`（ほか秘密の env）は共有の `settings.json` ではなく、gitignore 済みの `.claude/settings.local.json` に置く。`.mcp.json` 自体は env 変数のプレースホルダのみを持ち、秘密情報はコミットされない。

### 何が使えるようになるか

4 つの AWS サーバーは、Claude Code が Bedrock に使っているのと同じ既定の AWS SDK 認証情報チェーンで認証する（[AWS Bedrock のセットアップ](#aws-bedrock-setup) を参照）。`uvx` がインストールされ AWS 認証情報が解決すれば自動で立ち上がり、`context7` は `CONTEXT7_API_KEY` が設定されれば立ち上がる。サーバーはセッションレベルで継承されるため、どのエージェントも宣言済みの全サーバーに到達できる — エージェントごとの許可作業は存在しない。

> **エージェントを制限する（上級）:** 継承は加算的で、サーバーを宣言すると全エージェントが使えるようになり、エージェント単位の許可はできない。特定のエージェントにサーバーを*使わせない*には、そのエージェントの `tools:` 許可リストを、呼び出してよい完全修飾の `mcp__<server>__<tool>` id に絞る（裸の `mcp__<server>` トークンは尊重されない）。エージェントのツールアクセスの仕組みは [エージェント](06-agents.md) を参照。

### 使わない場合は？

認証情報が無くてもブロックされない。認証情報の無いサーバー — AWS チェーンも `CONTEXT7_API_KEY` も無い — は単に利用不可になるだけで、ワークフローはそれ無しで動き、待ちで止まることもない。サーバーを完全に外すには `.mcp.json` からエントリを削除する。

---

## インストール

AI-DLC は、利用する harness 向けのディストリビューションをプロジェクトへコピーすることでインストールする。
以下の手順は **Claude Code**（`dist/claude/.claude/` ツリー）を扱う。他のディストリビューションは
[Kiro CLI で動かす](harnesses/kiro-cli.md)、
[Kiro IDE で動かす](harnesses/kiro-ide.md)、
[Codex CLI で動かす](harnesses/codex-cli.md)、
[opencode 上の AI-DLC](harnesses/opencode.md) を参照。Claude Code 実装は
プロジェクトにコピーする `.claude/` ディレクトリとして出荷される。

以下の `cp` コマンドは、本リポジトリの `v2` ブランチの clone 上で実行する:

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

### 手順 1: 実装をコピーする

```bash
cp -r dist/claude/.claude/ your-project/.claude/
cp -r dist/claude/aidlc/   your-project/aidlc/     # the workspace shell — a sibling of .claude/, not inside it
```

1 行目はエンジン — orchestrator・stage ファイル・エージェントペルソナ・hooks・knowledge ファイル・既定設定 — をコピーする。2 行目は **ワークスペースシェル**: エンジンが読む構築済みの `aidlc/spaces/default/memory/` メソッドツリーをコピーする。これは `.claude/` の**兄弟**（内側ではない）として出荷されるため、別にコピーする必要がある — もしくは `dist/claude/` ツリー全体を一度にコピーする。`aidlc/spaces/default/memory/` が無いと `/aidlc --doctor` の「workspace shell ready」チェックが失敗する。

### 手順 2: プロジェクトへ移動する

```bash
cd your-project
```

すべての `/aidlc` コマンドはプロジェクトルートからの相対で動く。

---

## ワークスペースシェル

スキャフォールドの手順は存在しない。コピーしたディストリビューションにワークスペースシェル
— `.claude/` エンジンと、memory 層（チームが確認した practices と learnings が住む
`aidlc/spaces/default/memory/`）を持つ構築済みの `aidlc/spaces/default/` — が同梱されている。
init コマンドを実行することはない。

初めて `/aidlc` を実行した（または何を作るか記述した）とき、エンジンが最初の intent を
アクティブな space へ**自動 birth** する。各 intent は
`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` に自分の record dir を持ち、そこには次が入る:

- `aidlc-state.md` — intent 単位のワークフロー状態
- `audit/` — クローンごとのシャード（`<host>-<clone>.md`）として書かれる audit トレイル
- `<phase>/<stage>/...` — stage の成果物（例: `inception/requirements-analysis/requirements.md`）

チームナレッジは 1 階層上、space レベルの
`aidlc/spaces/<space>/knowledge/`（`intents/` の兄弟）にあり、space 内の
すべての intent を横断して蓄積される。エンジンは空で作成する。任意の `aidlc-shared/` と
エージェント別サブディレクトリの下に自由形式のファイルを追加する。

最初の実行前に [チームナレッジ](08-knowledge.md) やチームの practices を足すには、
同梱の `aidlc/spaces/default/memory/` のファイルを編集する。space レベルの
`aidlc/knowledge/` ディレクトリは最初の `/aidlc` 実行時に（空で）作成される。

ワークスペースレイアウトの全体像 — 複数の intent を同時に保持する仕組み、space の目的、
移動のコマンド — は [Space と Intent](03-spaces-and-intents.md) を参照。

---

## セットアップの検証

ヘルスチェックを実行して、すべてが揃っていることを確認する:

```
/aidlc --doctor
```

`--doctor` は全チェック合格で 0、いずれかの失敗で 1 で終了する。完全なレポートはどちらの場合も stdout に書かれる。

### `--doctor` が確認する内容

| チェック | 検証する内容 |
|-------|-------------------|
| 前提条件 | `bun` がインストール済みで `$PATH` にあること |
| hook の存在 | `settings.json` が束線するすべての hook（`hooks` ブロック + `statusLine` コマンド — フレームワークの全 13 hook）が `.claude/hooks/` に存在すること。束線済みなのに欠けている hook は大きく失敗する。期待一覧を `settings.json` から取るため、そこに hook を足せば自動で検査対象になる |
| プロジェクト構造 | `.claude/settings.json` が期待する構成で存在すること |
| ワークスペースシェル | `.claude/` + `aidlc/spaces/default/memory/`（同梱シェル）が存在すること |
| 状態ファイル | アクティブ intent の `aidlc-state.md` が audit トレイルと一致すること（ドリフトなし） |
| hook ハートビート | `.aidlc-hooks-health/` に hook 実行の新しいタイムスタンプがあること |
| グラフ整合性 | `stage-graph.json` にサイクルが無く、全 slug に対応する stage ファイルがあること |
| scope 検証 | 全 9 scope がグラフに対して正しく walk できること（scope 切り詰めギャップの advisory は想定内） |
| スキーマ + 参照 | 全 stage の YAML frontmatter が妥当で、consumes / requires_stage の参照が全て解決すること |
| キーワード重複 | `.claude/scopes/*.md` 間で同じキーワードを複数 scope が主張していないこと |
| compose 保留マーカー | `aidlc/.aidlc-compose-pending`（実行中の compose gate マーカー）があれば年齢とともに報告する。新しいもの（24 時間未満・開いた compose gate では正常）は advisory として合格。古いもの（クラッシュした compose gate の置き去り）は失敗。無ければ沈黙。対処: compose gate が保留中でなければ削除、そうでなければ gate を解決する |

### 出力例

```
✓ bun installed (required for CLI tools and hooks)
✓ aidlc-audit-logger.ts present
✓ aidlc-sync-statusline.ts present
✓ aidlc-validate-state.ts present
✓ aidlc-log-subagent.ts present
✓ aidlc-session-start.ts present
✓ aidlc-session-end.ts present
✓ aidlc-statusline.ts present
✓ settings.json present
✓ AWS_AIDLC_DEFAULT_SCOPE (unset — no project default)
✓ workspace shell ready (.claude/ + aidlc/spaces/default/memory/)
✓ Hook heartbeats: not yet fired (first workflow stage will populate)
✓ State matches last audit event (no drift)
✓ Cycle detection: 0 cycles
✓ Orphan stage files: 32 graph entries all have files
✓ Scope validation: 9 scopes valid (29 advisories)
✓ Schema validation: 32/32 stages valid
✓ Graph references: 122 artifacts + edges resolved
✓ Keyword overlap: no conflicts
```

### 失敗の直し方

| 失敗 | 対処 |
|---------|-----|
| `bun` が未インストール | `curl -fsSL https://bun.sh/install \| bash` でインストール。Windows では `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 \| iex"`。非対話シェルで PATH に載っていることを確認する。 |
| hook が存在しない | ディストリビューションから `.claude/` ディレクトリを再コピーする |
| `settings.json` が無い | ディストリビューションから再コピーする: `cp dist/claude/.claude/settings.json .claude/settings.json` |
| ワークスペースシェルが無い | `dist/claude/` からワークスペースシェルをプロジェクトルートへ再コピーする |
| 状態ファイルの問題 | アクティブ intent の record dir を `aidlc/spaces/<space>/intents/` の下でアーカイブし、`/aidlc` を実行して新規に始める |
| グラフ / scope / スキーマ / キーワードの失敗 | 診断が問題の成果物・slug・scope 名を特定して報告する。これらは `.claude/aidlc-common/stages/` や `.claude/scopes/` の authoring ドリフトを示す。`bun .claude/tools/aidlc-graph.ts compile` でコンパイル済みグラフ + scope グリッドを再生成するか、名指しされた stage / scope を直接確認する。 |

---

## 最初のワークフローを開始する

`--doctor` が通れば、実行の準備は完了である:

```
/aidlc Build a REST API for inventory management
```

または scope を直接指定する:

```
/aidlc feature
/aidlc bugfix Fix the login timeout issue
```

この後に何が起きるかのステップバイステップの解説は [最初のワークフロー](02-your-first-workflow.md) を参照。

---

## クイックリファレンス

シェルで:

```bash
# Verify prerequisites
command -v claude >/dev/null && echo "✓ Claude Code" || echo "✗ Claude Code"
command -v bun    >/dev/null && echo "✓ bun"          || echo "✗ bun"

# From your aidlc-workflows clone (v2 branch) - see Installation above
# Install (engine + the workspace shell sibling)
cp -r dist/claude/.claude/ your-project/.claude/
cp -r dist/claude/aidlc/   your-project/aidlc/

# Launch Claude Code in your project
cd your-project && claude
```

Claude Code セッションの中で:

```
# Verify (exits 1 on any check failure; read stdout for the full report)
/aidlc --doctor

# Start
/aidlc Build a task management API with user authentication
```

---

## ツール権限

同梱の `.claude/settings.json` は、ワークフローが呼び出しごとの許可プロンプトなしに動くよう、Claude Code のツール（Read・Edit・Write・Bash・Glob・Grep・Task・WebSearch）を事前承認している。使用前にこのファイルを確認し、自組織のセキュリティ要件に合わせて調整すること。

ツール権限の変更方法は [カスタマイズ](13-customization.md) を参照。

---

## 次のステップ

- [最初のワークフロー](02-your-first-workflow.md) — 完全な 1 実行の注釈付きウォークスルー
- [Scope・Depth・テスト戦略](05-scopes-and-depth.md) — タスクに合った scope の選び方
- [トラブルシューティング](15-troubleshooting.md) — よくある問題と対処
- [用語集](glossary.md) — 用語リファレンス
