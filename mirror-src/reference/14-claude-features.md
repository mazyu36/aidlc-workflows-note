# Harness プリミティブのマッピング

AI-DLC の方法論のコンセプトは harness 中立である; 各 CLI harness はそれらを自身のネイティブな
プリミティブを通して表現する。この章は AI-DLC のコンセプトを、各 harness が使うプリミティブへ
マッピングし、その後 **Claude Code** の表現を深く詳述する（それは最も完全に文書化された harness
である; Kiro CLI、Kiro IDE、Codex、opencode は同じコンセプトを自身の等価物を通して表現し、章ごと
の要約は
[他の harness で動かす](../guide/harnesses/README.md) にあり、harness を足すためのソース契約は
[新しい harness への移植](../harness-engineering/09-porting-to-a-new-harness.md) である）。

hook については [Hook とツール](06-hooks-and-tools.md) を参照。knowledge については [Knowledge System](10-knowledge-system.md) を参照。

---

## コンセプトからプリミティブへのマッピング（harness ごと）

AI-DLC のコンセプトが定数である; それを運ぶプリミティブが harness のパラメータである。新しい
harness に移植するときは列を足す。

| AI-DLC コンセプト | Claude Code | Kiro CLI | Kiro IDE | Codex CLI | opencode |
|----------------|-------------|----------|----------|-----------|----------|
| **Orchestrator エントリ**（`/aidlc` + runner） | Skills（`/aidlc`） | Skills（`/aidlc`） | Skills（`/aidlc`） | Skills（`$aidlc`） | Command → skill（`/aidlc`; `.aidlc/skills` からの skill を `skills.paths` 経由で） |
| **Agent ペルソナ**（合計 14） | `.claude/agents/*.md` | `.kiro/agents/*.json` + ペルソナ `.md` | ペルソナ `.md`; 委任先は IDE の `tools:` grant を足す | `.codex/agents/` の TOML | `.opencode/agents/*.md`（subagent）+ ペルソナ `.md` |
| **自動化**（audit、状態、追跡） | `settings.json` 経由の Hook | `agents/aidlc.json` 経由の Hook | `.kiro/hooks/*.kiro.hook` ファイル | `.codex/hooks.json` 経由の Hook（1 つのアダプタ） | アダプタ plugin（`.opencode/plugin/`） |
| **常設の rule**（レイヤーチェーン） | `aidlc/spaces/<active-space>/memory/`（`.claude/rules/aidlc.md` の @-import stub 経由） | `aidlc/spaces/<active-space>/memory/`（Kiro resources glob 経由） | `aidlc/spaces/<active-space>/memory/`（Kiro resources glob 経由） | `aidlc/spaces/<active-space>/memory/`（`AIDLC_RULES_DIR` 経由） | `aidlc/spaces/<active-space>/memory/`（`instructions` glob 経由） |
| **プロジェクトオンボーディング文書** | `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` | `AGENTS.md` | `AGENTS.md` |
| **Permissions / 設定** | `.claude/settings.json` | `.kiro/settings/cli.json` + agent 設定 | 委任先のための Agent `.md` の `tools:` frontmatter | `.codex/config.toml`（+ Starlark `rules/`） | `opencode.json`（プロジェクトルート） |

その下にある決定論的な engine、state machine、audit ログ、stage graph、そして swarm referee は、
あらゆる harness にわたってバイト同一である — それらを運ぶプリミティブだけが異なる。この章の残りは
各プリミティブの **Claude Code** 表現を詳細に文書化する; Kiro CLI、Kiro IDE、Codex、opencode の
等価物については、それらの guide 章を参照。

---

## Claude 固有

以下のセクションは、特に Claude Code が各プリミティブをどう表現するか — その skill frontmatter、
agent のロードモード、`settings.json` ブロック、そして `.mcp.json` モデル — を記述する。他の
harness は同じコンセプトを上の表のプリミティブを通して運ぶ; あるメカニクスが Claude 専用のところ
（`companyAnnouncements` のウェルカムメッセージ、statusline コマンド、`AskUserQuestion` の gate
ウィジェット）では、そのように明示する。

---

## Skills

### エントリポイントとしての SKILL.md

orchestrator は `.claude/skills/aidlc/SKILL.md` に住む。ユーザーは `/aidlc` コマンドでそれを呼び出す。このファイルはメタデータを宣言するために YAML frontmatter を使う:

```yaml
---
name: aidlc
description: >
  AI-DLC workflow orchestrator. Start, resume, or manage an AI-driven
  development lifecycle.
argument-hint: "[description | --status | --stage <slug|#> | --phase <name|#> | --help]"
user-invocable: true
---
```

orchestrator の frontmatter は `hooks:` ブロックを運ばない。v0.6.0 の時点で、あらゆるフレームワーク hook は `settings.json` にプロジェクト全体で登録される（hooks-move、Fork 2→B）ので、orchestrator と、パッケージされたまたは手書きのあらゆる runner は、runner ごとの `hooks:` ブロックをコピーせずに決定論的な背骨を継承する。

| フィールド | 目的 |
|-------|---------|
| `name` | Claude Code のコマンドシステムで skill を `/aidlc` として登録する |
| `description` | skill の発見とヘルプテキストで表示される |
| `argument-hint` | `/aidlc` の後に表示される、受理される引数を示すプレースホルダテキスト |
| `user-invocable` | `true` に設定すると、ユーザーが直接トリガーできる |

SKILL.md の本体は薄い forwarding loop — conductor — である。それはオーケストレーション engine（`aidlc-orchestrate next`）を呼び、それが返す型付きの directive に作用し（stage を実行、質問、swarm のファンアウト）、結果を報告し（`report`）、繰り返す。stage 間の決定 — セッション検出、scope から stage へのマッピング、stage graph、ルーティング、stage の前進 — は、このファイルではなく、engine と、それが読むコンパイル済みデータ（`tools/data/stage-graph.json`、`scope-grid.json`）に住む。[Engine と Skill システム](17-skill-system.md) を参照。

### プロジェクト全体の Hook

すべてのフレームワーク hook は `settings.json` にプロジェクト全体で登録される（workflow-spine hook が、そこで session-lifecycle と statusline の hook に加わる）。各 hook は **self-gate** する — アクティブなワークフローが無いとき早期終了する — ので、AI-DLC の外の通常の Claude Code 使用中には no-op になる。完全な詳細は [Hook とツール](06-hooks-and-tools.md) を参照。

### コンパニオンファイル

SKILL.md は `.claude/skills/aidlc/` の中の 2 つのコンパニオンファイルセットを参照する:

- **`stage-protocol.md`** -- 全 32 stage の必須プロトコル（承認 gate、質問の書式、audit ログのルール、完了メッセージ、phase 境界の検証）。
- `stages/initialization/`、`stages/ideation/`、`stages/inception/`、`stages/construction/`、`stages/operation/` の中の **Stage ファイル** -- 32 の個別の stage 定義。

---

## Agents

### Agent ファイル形式

この実装は AI-DLC の agent の役割を `.claude/agents/` のフラットな `.md` ファイルとしてレンダリングする — 14 ファイル: 11 のドメイン専門家ペルソナ、2 つのレビュー専用 agent（product-lead、architecture-reviewer）、そして adaptive-workflows の composer。各々が YAML frontmatter に続けて markdown 本体を使う。frontmatter は agent がアクティベートされたときの Claude Code の振る舞いを制御する; 本体はペルソナ、責務、stage の所有権、コラボレーションパターン、knowledge のロード順、そして主要な原則を提供する。

完全な agent システムのドキュメントは [Agent System](05-agent-system.md) を参照。

### Inline と Subagent のロード

conductor は、4 つの stage トポロジーにわたって、2 つの agent アクティベーションのモード - ペルソナ採用と Task dispatch - を使う:

**Inline 実行（32 stage 中 28）:**
conductor は agent の `.md` ファイルを読み、メインの会話の中で直接ペルソナを採る。ユーザーはリアルタイムで agent とやり取りする。

**Dispatched 実行（4 stage: 2.1 pipeline、2.2 subagent、2.4 mob、3.5 subagent）:**
conductor は Claude Code の Task ツール経由で別々の Claude インスタンスに委任する。dispatch された各 agent は隔離して走り、プロンプト経由でコンテキストを受け取り、構造化された要約を返す; アンサンブルの協力者はさらに、lead が統合する contribution ファイルを書く。

| Stage | Claude Code Subagent タイプ | Agent | 理由 |
|-------|---------------------------|-------|--------|
| 2.1 Reverse Engineering | `aidlc-developer-agent` その後 `aidlc-architect-agent`（pipeline、2-link チェーン） | aidlc-developer-agent + aidlc-architect-agent | 深いコード分析が大きな中間出力を生む |
| 2.2 Practices Discovery | lead、3 つの並列 support スポーク、lead 統合（subagent hub-and-spoke） | pipeline-deploy + quality + developer + devsecops | 独立した practice の証拠、人間へのインタビュー、その後の制御された統合 |
| 2.4 User Stories | product lead に加え並列の design/developer/quality mob | 参加者 4 名 | 人間の判断を伴う、境界づけられた協調的なストーリーの精緻化 |
| 3.5 Code Generation | `aidlc-developer-agent` | aidlc-developer-agent | コード記述は、unit 仕様に集中したクリーンなコンテキストから恩恵を受ける |

Workspace 検出（0.2）はかつて subagent であった; 今は `aidlc-utility intent-birth` の中で決定論的に走る。

### Agent の tier（射影される model + effort）

あらゆる agent の著述されたダイヤルは `tier:` である; packager はそれを Claude Code が読む `model:`/`effort:` frontmatter キーへ射影する。以前の振る舞い（v2.2.15 から v2.2.19; それ以前はキーが不活性な `modelOverride:` だった）は、9 つの judgment 型の agent に `model: opus` を固定し、より大きな model を走らせるセッションを強制的にダウングレードしていた。

| Tier | Agents | Claude Code の射影 | 論拠 |
|------|--------|------------------------|-----------|
| `judgment` | architect, product, design, developer, quality, devsecops, compliance, aws-platform, composer (9) | `model: inherit`、`effort:` 行なし - セッションの model と effort が勝つ | 決定が下流へカスケードする多制約推論 - アーキテクチャの境界、intent の解釈、UX のトレードオフ、コード合成、脅威の優先順位づけ、規制のエッジケース、クラウドアーキテクチャ |
| `balanced` | architecture-reviewer, product-lead (2) | `model: sonnet`、`effort:` 行なし | 明示的なチェックリストに対するレビュー; 基準が方法論を符号化するので、セッション effort の中サイズ model で十分である |
| `templated` | delivery, pipeline-deploy, operations (3) | `model: sonnet`、`effort: medium` | 出力は支配的にテンプレート化された計画テーブル、CI/CD YAML、または observability/runbook のスキャフォールディングである; 方法論は agent の knowledge ファイルに符号化されている |

省かれた `effort:` キーはセッションの effort を継承し、固定されたものは両方向でセッションを上書きする（固定は cap であって floor ではない） - 不在は最初の 2 つの tier では意図的である。完全な harness ごとの射影テーブル（Kiro では、すべての tier がセッションの model と effort を継承する）と `tier_cap` の上書きは [Agent System](05-agent-system.md) に住む。

---

## Rules

### レイヤー化された rule ファイル

この実装は、`aidlc/spaces/<active-space>/memory/` のアクティブな space memory レイヤーから振る舞いの rule を読み、それは `.claude/rules/aidlc.md` の @-import stub 経由で Claude のコンテキストへ引き込まれる。継承チェーンのレイヤーごとに 1 ファイル:

```
aidlc/spaces/<active-space>/memory/
├── org.md                        # framework defaults (shipped)
├── team.md                       # this team's affirmed practices
├── project.md                    # this project's specialization
└── phases/                       # rules scoped to a phase
    ├── ideation.md
    ├── inception.md
    ├── construction.md
    └── operation.md
```

各ファイルはトピック別の `##` 見出し（Way of Working、Testing Posture、Deployment、Code Style、Forbidden、Mandated、など）を運ぶ。ワークフロー開始時、compile resolver はチェーン **org → team → project → phase → stage** を歩き、解決した rule 集合を各 stage のグラフノードに焼き込む。モデルは **strict-additive** である: あらゆるレイヤーの適用可能なすべての rule が agent のコンテキストに同時に現れる — より狭いレイヤーがより広いものを静かに上書きすることは決してない。より広いスコープの rule と *矛盾する* であろう rule は、ランタイムで調停されるのではなく、書かれるときに admission gate で拒否される。正典のレイアウト、scope の導出、そして衝突のセマンティクスは [Rule システム](08-rule-system.md) にある。

**なぜ org/team ファイルが lean のままか:** Claude Code は space memory ファイルを（`.claude/rules/aidlc.md` の @-import stub 経由で）、非 AI-DLC のものを含む各会話へロードする。出荷されるレイヤーを簡潔でトピック別の構造に保つことで、通常の開発セッションを汚染するのを避ける。上流仕様が rule に置く詳細な方法論は、代わりに `.claude/knowledge/aidlc-shared/` か、SKILL.md と stage-protocol.md に住み、`/aidlc` がアクティブなときだけロードされる。

### 学習ループ

rule ファイルは静的ではない — v0.5.0 の学習ループは、ワークフロー中の訂正を次回のための常設の rule に変える。分業は意図的である: LLM の唯一の仕事は、stage が走る間に観察を stage の `memory.md` の日記に書くこと（Interpretations / Deviations / Tradeoffs / Open questions）である。それ以外はすべて決定論的なツールか人間の決定である:

1. **日記（LLM）。** stage 中、観察は intent の record dir の `<record>/<phase>/<stage>/memory.md`（`<record>/` = `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）に蓄積される。
2. **Surface（tool）。** 承認 gate で、`aidlc-learnings.ts surface` が日記を読み、構造化された candidate を emit する — LLM は再パースも分類もしない。
3. **確認（human）。** conductor が candidate をレンダリングする; あなたはどれを保持するかを選び、自由テキストの追加については、宛先を導く単一の見出しを選ぶ。
4. **Admission チェック（knowledge）。** 保持された各 learning は `org.md` の合致するセクションに対してチェックされる; 矛盾は、あなたが修正・スキップ・エスカレートできるよう露出される。
5. **Persist（tool）。** `aidlc-learnings.ts persist` は、確認された各 learning を practice として `aidlc/spaces/<active-space>/memory/{project,team}.md` に日付付きエントリとして書き、sensor 束縛の learning については、manifest に加え stage の `sensors:` インポートを、1 つのロックされたトランザクションの内側でインストールする。それは `RULE_LEARNED` / `SENSOR_PROPOSED` を emit する。

ユーザー向けのウォークスルー（具体例付き）は [Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) にある; harness engineer の著述の観点は [Rule と学習ループ](../harness-engineering/05-rules-and-the-loop.md) にある。

---

## CLAUDE.md

### プロジェクトレベルの指示

`.claude/CLAUDE.md` は、すべての会話にロードされるプロジェクトレベルの指示を提供する。AI-DLC にとって、それは bootstrap ドキュメントとして機能する。

**主要なセクション:**

| Section | Contents |
|---------|----------|
| Prerequisites | `bun`（唯一のランタイム依存）; `mkdir` ベースのロック |
| AI-DLC Structure | skill、agent、rule、knowledge、hook の場所 |
| Conventions | 成果物は `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` 下の intent の record dir へ; アプリケーションコードは workspace ルートへ |
| Session Resumption | 起動時に `aidlc-state.md` をチェックし、再開オプションを提示する |
| Git Integration | commit ポリシー（下記参照） |

### Git 統合

```
Commit: aidlc/ workspace (memory layer, intents registry, per-intent
        aidlc-state.md, audit/ shards, and stage artifacts)
Gitignore:
  - aidlc/active-space, aidlc/spaces/*/intents/active-intent  (per-user cursors)
  - aidlc/.aidlc-clone-id, aidlc/.aidlc-sessions/             (machine-local)
  - aidlc/spaces/*/intents/*/runtime-graph.json              (re-derivable)
  - aidlc/spaces/*/intents/*/.aidlc-*                          (incl. .aidlc-recovery.md)
```

audit トレイルは **clone ごとのシャード**（`audit/<host>-<clone>.md`）として commit される: 各 clone は自身のシャードに追記するので、並行する追記が git で衝突することは決してない。ユーザーごとのセッションカーソルとマシンローカルな導出状態は無視される。

---

## Settings

### Permissions の設定

`.claude/settings.json` は Claude Code のツールを事前承認するので、ワークフローは呼び出しごとの permission プロンプト無しで走る:

```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Bash",
      "Glob", "Grep", "Task", "WebSearch"
    ]
  }
}
```

これが無ければ、Claude Code は初回使用ごとに「Allow this tool?」とプロンプトを出し、ワークフローを乱す -- 特に、ユーザーが直接やり取りしていない subagent の委任中に。

### Status Line の設定

```json
"statusLine": {
  "type": "command",
  "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/aidlc-statusline.ts\""
}
```

ツール使用時だけでなく定期的に走り、ターミナルの status を最新に保つ。

### SessionStart と SessionEnd Hook の設定

```json
"hooks": {
  "SessionStart": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/aidlc-session-start.ts\""
    }]
  }],
  "SessionEnd": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/aidlc-session-end.ts\""
    }]
  }]
}
```

`settings.json` に（プロジェクト全体で）登録される — v0.6.0 の hooks-move 以降のすべてのフレームワーク hook と同様に。セッションライフサイクルイベントは、いずれにせよプロジェクト全体でなければならない。なぜならそれらは `/aidlc` がアクティベートする前と、それが終了した後に発火するからである: `session-start.ts` は再開コンテキストを注入し、`session-end.ts` は audit の完全性のために `SESSION_ENDED` を emit する。

### 個人設定のオーバーライド

`.claude/settings.local.json`（gitignore 済み）は、リポジトリに影響を与えずに共有設定を上書きする:

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

---

## MCP サーバー

### サーバーレジストリとしての .mcp.json

この実装は、その Model Context Protocol（MCP）サーバーを、`.claude/` の内側ではなくその隣、プロジェクトルートの `.mcp.json` で宣言する。このファイルはサーバー名を、そのトランスポートと起動設定へマッピングする:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
      }
    },
    "aws-mcp": {
      "command": "uvx",
      "args": [
        "mcp-proxy-for-aws@latest",
        "https://aws-mcp.us-east-1.api.aws/mcp",
        "--metadata",
        "AWS_REGION=us-east-1"
      ]
    },
    "aws-pricing": { "command": "uvx", "args": ["awslabs.aws-pricing-mcp-server@latest"] },
    "aws-iac": { "command": "uvx", "args": ["awslabs.aws-iac-mcp-server@latest"] },
    "aws-serverless": { "command": "uvx", "args": ["awslabs.aws-serverless-mcp-server@latest"] }
  }
}
```

出荷される 5 つのサーバーは、フレームワークの agent が手を伸ばす統合をカバーする:

| Server | Transport | Auth | 目的 |
|--------|-----------|------|---------|
| `context7` | HTTP | `${CONTEXT7_API_KEY}` env passthrough | ライブラリ/SDK ドキュメントのルックアップ |
| `aws-mcp` | `uvx`（`mcp-proxy-for-aws@latest`、`AWS_REGION=us-east-1`） | 標準の AWS 認証情報チェーン | AWS API アクセス |
| `aws-pricing` | `uvx`（`awslabs.aws-pricing-mcp-server@latest`） | AWS 認証情報チェーン | AWS pricing |
| `aws-iac` | `uvx`（`awslabs.aws-iac-mcp-server@latest`） | AWS 認証情報チェーン | Infrastructure-as-code ツーリング |
| `aws-serverless` | `uvx`（`awslabs.aws-serverless-mcp-server@latest`） | AWS 認証情報チェーン | Serverless ツーリング |

レジストリは環境変数のプレースホルダだけを運ぶ — commit された秘密は無い。認証情報はあなたのシェルを通って流れる: `context7` は環境から `CONTEXT7_API_KEY` を読み、4 つの `uvx` 起動 AWS サーバーはあなたの標準の AWS 認証情報チェーンに対して認証する（`uv`/`uvx` は `curl -fsSL https://astral.sh/uv/install.sh | sh` でインストール）。認証情報を持たないサーバーは、単にセッションに利用不可であり、ワークフローを決してブロックしない。

`.mcp.json` はプロジェクトルートに住む。なぜならそれが、プロジェクトスコープの MCP サーバーについて Claude Code が読むパスだからである。この実装は現在、Claude Code plugin ではなく `.claude/` ディレクトリのコピーとして出荷されるが、プロジェクトルートの `.mcp.json` 配置は正典の plugin 位置でもあるので、レジストリは変更なしに plugin ポータブルである。

### プロビジョニングと継承

アクセスモデルは、プロビジョニングに続いて継承であり、その間に grant ステップは無い:

1. **一度宣言する。** サーバーはプロジェクトルートの `.mcp.json` にリストされる。
2. **セッションへプロビジョニングする。** Claude Code は宣言されたサーバーを起動し、そのツールを `mcp__<server>__<tool>` の id としてセッションへ露出する。
3. **どこでも継承する。** subagent は既定でセッションのすべての MCP tool を継承する。あらゆる AI-DLC agent — inline で走ろうと、委任された subagent（dispatch される stage 2.1、2.2、2.4、3.5 とその協力者）として走ろうと — は宣言されたすべてのサーバーに到達する。

agent ごとの grant ステップは無く、必要もない: 継承が既定であり、それはすべての agent にわたって追加的である。新しい agent ファイルは、その frontmatter でサーバーをリストすることによってではなく、存在することによって MCP アクセスを得る。

### なぜ per-agent の grant が無いのか

これは load-bearing な教訓であり、蒸し返されないよう平易に述べる価値がある。**MCP アクセスは追加によって agent に付与できない — それは継承され、唯一のレバーは制限である。** Claude Code 2.1.159 に対する経験的な spike が、境界を確立した:

- agent は、その frontmatter でサーバーを *名指す* ことによって何も得ない。追加的な grant フィールドは無い。継承がすでに、agent にすべてのセッション MCP tool を与えている。
- agent がサーバーを使うのを *妨げる* には、その `tools:` allowlist（本物の Claude Code frontmatter フィールド）を、それが呼び出しを許される完全修飾の `mcp__<server>__<tool>` id に絞る。埋められた `tools:` リストからツールを省くことが、それを拒否する。
- 裸の `mcp__<server>` トークンは尊重され **ない** — サーバーレベルのワイルドカードは無い。完全修飾の `mcp__<server>__<tool>` id だけが合致する。
- `disallowedTools` は、denylist 側の本物の、機能するフィールドである。この実装は、ネストされた subagent の spawn をブロックするために `disallowedTools: Task` を使う; その拒否は MCP サーバーアクセスに影響しない。

spike はまた、別の frontmatter の footgun を露出した: `allowedTools` は認識される Claude Code subagent フィールドで **は** なく、静かに無視される。`allowedTools: Read` を宣言する agent はなお MCP tool に到達し、inherit-all と同一に振る舞ったが、同じ agent が `tools: Read` を持つと正しくそれを拒否した。解決（v0.5.4）: 静かに無視される `allowedTools` フィールドは、出荷されるあらゆる agent ファイル（`.claude/agents/*.md`）から取り除かれた。agent は今や意図的にフルのセッション toolset — 組み込みツールと MCP tool の両方 — を継承し、宣言された唯一の制限は `disallowedTools: Task` である。文書化されたオプトインの絞り込みは、本物の `tools:` allowlist であり、それは完全修飾の `mcp__<server>__<tool>` id も列挙されない限り、継承された MCP を落とす。だから inherit-all は今や、無視されるフィールドの偶然ではなく、意図的で文書化されたモデルである: 今日、あらゆる agent は宣言されたあらゆるサーバーに到達する。

### settings.json の Permissions との関係

2 つの設定ファイルは異なる問いに答え、重複しない:

- `.claude/settings.json` の `permissions.allow` は *組み込みの Claude Code ツール*（Read、Edit、Write、Bash、Glob、Grep、Task、WebSearch）を事前承認するので、セッションは初回使用時にプロンプトを出さない（上の [Settings](#settings) を参照）。それは MCP サーバーについては何も言わない。
- `.mcp.json` は *どの MCP サーバーが存在するか* と、それらをどう起動するかを宣言する。プロビジョニングと継承は、`settings.json` ではなく Claude Code の MCP レイヤーによって統べられる。

セッションに現れる MCP サーバーは、`.mcp.json` に加え利用可能な認証情報の関数であって、`settings.json` の allow-list エントリの関数ではない。agent ごとの絞り込みは、それが結線されているとき、`settings.json` でも `.mcp.json` でもなく、agent の `tools:` frontmatter に住む。

---

## 機能インタラクションマップ

| Feature | File(s) | ロードのタイミング | 役割 |
|---------|---------|---------------|------|
| CLAUDE.md | `.claude/CLAUDE.md` | すべての会話 | Bootstrap: 構造、prerequisites、規約 |
| Settings | `.claude/settings.json` | すべての会話 | Claude Code ツールを事前承認する |
| Rules | `aidlc/spaces/<active-space>/memory/*.md`（`.claude/rules/aidlc.md` @-stub 経由） | すべての会話 | 最小限のガードレール; 自己学習による訂正 |
| Skill | `.claude/skills/aidlc/SKILL.md` | `/aidlc` の呼び出し時 | Orchestrator: セッション、scope、stage graph、委任 |
| Workflow-spine hook | `.claude/settings.json` | 常時オン; ワークフローが無ければ self-gate | PostToolUse、PreCompact、SubagentStop、Stop |
| Agents（inline） | `.claude/agents/*.md` | ペルソナのアクティベーション | 32 stage 中 28: conductor が agent ペルソナを採る |
| Agents（dispatched） | `.claude/agents/*.md` | Task ツールの委任 | 4 stage（2.1 pipeline、2.2 subagent、2.4 mob、3.5 subagent）: 隔離された実行 |
| Knowledge（Tier 1） | `.claude/knowledge/` | ペルソナのアクティベーション（ステップ 2-3） | 56 の methodology リファレンスファイル |
| Knowledge（Tier 2） | space レベルの `aidlc/knowledge/`（`intents/` の兄弟） | ペルソナのアクティベーション（ステップ 4-5） | チーム管理のカスタマイズ |
| Stage protocol | `stage-protocol.md` | すべての stage 実行 | 必須の振る舞いの契約 |
| Stage files | `stages/**/*.md` | Engine のルーティング | 32 の個別の stage 定義 |
| State file | `aidlc-state.md` | セッション開始 + 全体を通して | 永続的なワークフロー状態 |
| Audit file | `audit.md` | 実行を通して | 追記専用の audit トレイル |

### ロードシーケンス

ユーザーが `/aidlc feature` を走らせるとき:

```
1.  CLAUDE.md loads              (every conversation)
1a. statusLine command starts    (settings.json -- runs continuously)
2.  settings.json loads          (every conversation; all hooks register here, project-wide)
2a. SessionStart hook fires      (settings.json -- if session resume)
3.  memory/ rules load            (every conversation)
4.  SKILL.md activates           (skill invocation -- the conductor)
5.  Conductor calls the engine   (`aidlc-orchestrate next $ARGUMENTS`)
6.  Engine reads state + graph   (decides the move, emits a typed directive)
7.  Conductor acts on directive  (run-stage: load agent .md + knowledge, run the body)
8.  Stage executes               (stage work)
9.  Hooks fire as needed         (Claude Code tool calls, compaction, subagent stop)
10. Conductor reports the outcome (`aidlc-orchestrate report` -- commits state)
11. Loop back to step 5          (next directive) until the engine emits `done`
```

ステップ 1-2a は、非 AI-DLC のものであってもすべての会話で起こる — そして、あらゆる hook が（skill のアクティベーション時ではなく）`settings.json` にプロジェクト全体で登録されるので、決定論的な背骨は `/aidlc` が呼び出されるより前に整っている; 各 hook は、アクティブなワークフローが無いとき no-op へ self-gate する。ステップ 3 は rule レイヤーをロードする。ステップ 4 以降は、ユーザーが `/aidlc` を呼び出すときだけワークフローをセットアップし駆動する; ステップ 5-11 は directive ごとに 1 回繰り返す — 各イテレーションが何をするかを決めるのは SKILL.md ではなく engine である。

---

## クロスリファレンス

- [アーキテクチャ](01-architecture.md) -- すべての機能レイヤーを含む 5 レイヤーモデル
- [Orchestrator](03-orchestrator.md) -- SKILL.md のディープダイブ
- [Agent System](05-agent-system.md) -- agent frontmatter、ツール制限、agent の tier
- [Hook とツール](06-hooks-and-tools.md) -- hook システム、audit の分類体系、CLI ツール
- [Knowledge System](10-knowledge-system.md) -- 2 層 knowledge、ロード順
- [新しい harness への移植](../harness-engineering/09-porting-to-a-new-harness.md) -- 上のマッピングに列を足す方法: manifest、hook アダプタ、そして `emit.ts` 契約
- [他の harness で動かす](../guide/harnesses/README.md) -- これらのプリミティブの Kiro CLI、Kiro IDE、Codex、opencode での表現
