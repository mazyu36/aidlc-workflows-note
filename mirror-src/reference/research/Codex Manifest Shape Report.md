# Codex Manifest の形: Codex はどう Add-in を管理するか

> **Deep Research レポート** | June 26, 2026  
> **出典**: OpenAI 公式ドキュメント, Codex SDK v0.16.1 (HexDocs), HuggingFace Context Course, community guides, GitHub issues  
> **確信度**: High — 一次ソースのドキュメント + SDK 型仕様 + 実務者による検証

---

## エグゼクティブサマリ

OpenAI Codex は **manifest-first plugin system** を用いる。ここではすべての plugin が、必須の単一ファイル `.codex-plugin/plugin.json` によって識別される。この manifest は plugin の identity を宣言し、同梱されるコンポーネント（skills、MCP servers、app connectors、lifecycle hooks）を指し示し、marketplace 表示のための install-surface メタデータを提供する。

**主要な事実:**
- manifest で厳密に必須なのは `name`（kebab-case）だけである
- plugin は最大 4 つのコンポーネント型を同梱する: Skills（脳）、Apps（手）、MCP Servers（神経系）、Hooks（ライフサイクル）
- 配布は Git ネイティブな marketplace を用いる — repo スコープ・personal・official のいずれかになり得る JSON カタログである
- plugin は `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/` にインストールされる
- このシステムは前方互換である: 未知のキーは `extra` map を介してラウンドトリップのシリアライズを生き延びる

---

## 1. Manifest ファイル: `plugin.json`

### 位置と役割

manifest は `.codex-plugin/plugin.json` に住む — `.codex-plugin/` ディレクトリ内で許される唯一のファイルである。他のすべてのコンポーネント（`skills/`、`hooks/`、`assets/`、`.mcp.json`、`.app.json`）は plugin root に住む。

manifest は 3 つの仕事を持つ:
1. plugin を **識別する**（name、version、author）
2. **同梱コンポーネントを指し示す**（skills、MCP servers、apps、hooks）
3. **marketplace メタデータを提供する**（説明、アイコン、法的リンク、スターター prompt）

### 完全な Manifest の例

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "Bundle reusable skills and app integrations.",
  "author": {
    "name": "Your team",
    "email": "team@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://example.com/plugins/my-plugin",
  "repository": "https://github.com/example/my-plugin",
  "license": "MIT",
  "keywords": ["research", "crm"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "apps": "./.app.json",
  "hooks": "./hooks/hooks.json",
  "interface": {
    "displayName": "My Plugin",
    "shortDescription": "Reusable skills and apps",
    "longDescription": "Distribute skills and app integrations together.",
    "developerName": "Your team",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "websiteURL": "https://example.com",
    "privacyPolicyURL": "https://example.com/privacy",
    "termsOfServiceURL": "https://example.com/terms",
    "defaultPrompt": [
      "Use My Plugin to summarize new CRM notes.",
      "Use My Plugin to triage new customer follow-ups."
    ],
    "brandColor": "#10A37F",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png",
    "screenshots": ["./assets/screenshot-1.png"]
  }
}
```

> 出典: [developers.openai.com/codex/plugins/build](https://developers.openai.com/codex/plugins/build)

---

## 2. フィールドリファレンス

### トップレベルの必須フィールド

| フィールド | 型 | 検証 |
|-------|------|------------|
| `name` | string | **空でない kebab-case** でなければならない（小文字・数字・ハイフンのみ） |

> 厳密に必須なのは `name` だけである。それ以外はすべて任意である。

### トップレベルの任意フィールド

| フィールド | 型 | 目的 |
|-------|------|---------|
| `version` | string | Semver 文字列（例: `"1.0.0"`）— cache パスを決定する |
| `description` | string | 人間が読めるサマリ |
| `author` | object | `{name, email?, url?}` |
| `homepage` | string | ランディングページの URL |
| `repository` | string | ソースコード repo の URL |
| `license` | string | SPDX 識別子（例: `"MIT"`） |
| `keywords` | string[] | 発見用タグ |
| `skills` | string | skills ディレクトリへのパス（`./` で始めねばならない） |
| `mcpServers` | string | `.mcp.json` ファイルへのパス |
| `apps` | string | `.app.json` ファイルへのパス |
| `hooks` | string/array/object | パス（複数可）またはインラインの hook 定義 |
| `interface` | object | install-surface メタデータ（§3 を参照） |

### The `interface` Object

| JSON キー | 目的 | 制約 |
|----------|---------|------------|
| `displayName` | marketplace 上の plugin タイトル | — |
| `shortDescription` | plugin カード上の 1 行説明 | — |
| `longDescription` | 詳細ページの説明 | — |
| `developerName` | パブリッシャ名 | — |
| `category` | marketplace カテゴリ | 例: `"Productivity"` |
| `capabilities` | capability バッジ | 例: `["Read", "Write"]` |
| `websiteURL` | 外部リンク | — |
| `privacyPolicyURL` | プライバシーポリシー | 公開 plugin には必須 |
| `termsOfServiceURL` | 利用規約 | — |
| `defaultPrompt` | composer 内のスターター prompt | **最大 3 件、各 ≤128 文字** |
| `brandColor` | Hex カラー | 例: `"#10A37F"` |
| `composerIcon` | アイコンパス | `./assets/icon.png` |
| `logo` | ロゴパス | `./assets/logo.png` |
| `screenshots` | スクリーンショットパス | `./assets/*` パスの配列 |

---

## 3. 検証ルール（SDK が強制）

Codex SDK（Elixir, `Codex.Plugins.Manifest.parse!/1`）はこれらの安定したルールを強制する:

| ルール | 詳細 |
|------|--------|
| kebab-case 名 | 空でなく、小文字 + 数字 + ハイフンのみ |
| `./` プレフィックス必須 | すべてのコンポーネントパスと asset パスは `./` で始めねばならない |
| `..` エスケープ禁止 | パスは plugin root より上をたどれない |
| defaultPrompt の上限 | 最大 **3** 件 |
| prompt 長の上限 | 空白正規化後、各 ≤**128 文字** |
| 決定論的 JSON | 書き込みは末尾改行付きの安定した JSON を生む |
| 前方互換キー | 未知のキーは `extra` map に保持され、ラウンドトリップを生き延びる |

```elixir
# Validation API
{:ok, manifest} = Codex.Plugins.Manifest.parse(data)
Codex.Plugins.Manifest.parse!(data)  # raises on error
```

---

## 4. ディレクトリレイアウト

```
my-plugin/                          ← plugin root
├── .codex-plugin/
│   └── plugin.json                 ← REQUIRED (only file in this dir)
├── skills/                         ← "skills": "./skills/"
│   ├── code-review/
│   │   └── SKILL.md
│   └── deploy/
│       └── SKILL.md
├── hooks/
│   └── hooks.json                  ← "hooks": "./hooks/hooks.json"
├── .app.json                       ← "apps": "./.app.json"
├── .mcp.json                       ← "mcpServers": "./.mcp.json"
└── assets/
    ├── icon.png
    ├── logo.png
    └── screenshot-1.png
```

---

## 5. コンポーネントの結線: Add-in はどう参照されるか

### 5.1 Skills（「脳」レイヤー）

**Manifest ポインタ**: `"skills": "./skills/"`

Codex はディレクトリを走査し、`SKILL.md` ファイルを含むサブディレクトリを探す。各 skill は YAML frontmatter を持つ:

```markdown
---
name: deploy-kubernetes
description: Deploy containerized apps to Kubernetes clusters.
---

## Workflow
1. Verify kubectl context...
2. Generate manifests...
```

**アクティベーションモード:**
- **Implicit**（既定）: user のタスクが `description` に意味的に合致するとき自動ロードされる
- **Explicit**: `$skill-name` 構文で起動される

**設定の上書き**（`config.toml`）:
```toml
[skills.deploy-kubernetes]
enabled = true
invocation = "explicit"    # or "implicit"
priority = 10              # higher wins on conflicts
```

**解決の優先順位**: REPO > USER > ADMIN > SYSTEM > DEFAULTS

---

### 5.2 MCP Servers（「神経系」レイヤー）

**Manifest ポインタ**: `"mcpServers": "./.mcp.json"`

等価な 2 つの形式:

```json
// Direct server map
{
  "docs": {
    "command": "docs-mcp",
    "args": ["--stdio"]
  }
}

// Wrapped (alternative)
{
  "mcp_servers": {
    "docs": {
      "command": "docs-mcp",
      "args": ["--stdio"]
    }
  }
}
```

各サーバエントリ: `command`（必須）、`args`（必須）、`env`（任意）。

**サーバごとの policy 上書き**（`config.toml`）:
```toml
[plugins."my-plugin".mcp_servers.docs]
enabled = true
default_tools_approval_mode = "prompt"
enabled_tools = ["search"]

[plugins."my-plugin".mcp_servers.docs.tools.search]
approval_mode = "approve"
```

**承認モード**: `"approve"`（自動実行）、`"prompt"`（user に尋ねる）、`"deny"`（ブロック）

---

### 5.3 Apps/Connectors（「手」レイヤー）

**Manifest ポインタ**: `"apps": "./.app.json"`

認証付きのサードパーティサービス connector を定義する:

```json
{
  "apps": [{
    "name": "github-connector",
    "auth": {
      "type": "oauth2",
      "client_id": "${GITHUB_CLIENT_ID}",
      "authorization_url": "https://github.com/login/oauth/authorize",
      "token_url": "https://github.com/login/oauth/access_token",
      "scopes": ["repo", "read:org"]
    }
  }]
}
```

**認証タイプ**: OAuth 2.0, API key  
**認証のタイミング**: marketplace policy によって制御される — `ON_INSTALL` または `ON_FIRST_USE`

---

### 5.4 ライフサイクル Hooks

**Manifest ポインタ**: `"hooks": "./hooks/hooks.json"`（指定しなければ自動発見される）

`hooks` フィールドは **4 つの形式** を受理する:
1. 単一パス: `"./hooks/hooks.json"`
2. パスの配列: `["./hooks/session.json", "./hooks/tools.json"]`
3. インラインオブジェクト
4. インラインオブジェクトの配列

**Hook イベントスキーマ**:
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "python3 ${PLUGIN_ROOT}/hooks/session_start.py",
        "statusMessage": "Loading plugin context"
      }]
    }]
  }
}
```

**サポートされるイベント**: `SessionStart`, `TurnStarted`, `TurnCompleted`, `ToolCallRequested`, `ToolCallCompleted`

hook コマンドで利用可能な **環境変数**:
| 変数 | 説明 |
|----------|-------------|
| `PLUGIN_ROOT` | インストール済み plugin の root パス |
| `PLUGIN_DATA` | plugin の書き込み可能なデータディレクトリ |
| `CLAUDE_PLUGIN_ROOT` | 互換エイリアス |
| `CLAUDE_PLUGIN_DATA` | 互換エイリアス |

**⚠️ 信頼モデル**: plugin の hook は **non-managed** である — user が hook 定義を明示的にレビューして信頼するまで、Codex はそれらをスキップする。plugin をインストールしても、その hook が自動的に信頼されることは無い。

---

## 6. 配布: Marketplace システム

### Marketplace JSON 構造

```json
{
  "name": "repo-marketplace",
  "interface": { "displayName": "Team Plugins" },
  "plugins": [
    {
      "name": "demo-plugin",
      "source": {
        "source": "local",
        "path": "./plugins/demo-plugin"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL",
        "products": ["codex-app", "codex-cli"]
      },
      "category": "Productivity"
    }
  ]
}
```

### Marketplace スコープ

| Tier | 場所 | 可視性 |
|------|----------|------------|
| Official | OpenAI ホスト | 全員 |
| Repository | `$REPO_ROOT/.agents/plugins/marketplace.json` | repo の協力者 |
| Personal | `~/.agents/plugins/marketplace.json` | 現在の user |
| Legacy | `$REPO_ROOT/.claude-plugin/marketplace.json` | クロスツール互換 |

### ソースタイプ

| タイプ | 形式 | ユースケース |
|------|--------|----------|
| `local` | `"./relative/path"` | 同一 repo の plugin |
| `url` | 完全な HTTPS/SSH URL | 単独の plugin repo |
| `git-subdir` | URL + サブディレクトリパス | Monorepo の plugin |
| GitHub shorthand | `owner/repo[@ref]` | 手早い参照 |

**Git 由来の marketplace エントリの例:**
```json
{
  "name": "remote-helper",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/example/codex-plugins.git",
    "path": "./plugins/remote-helper",
    "ref": "main"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

### Policy 制御

| フィールド | 値 | 効果 |
|-------|--------|--------|
| `policy.installation` | `AVAILABLE`, `PREINSTALLED`, `HIDDEN` | 発見/自動インストールの挙動 |
| `policy.authentication` | `ON_INSTALL`, `ON_FIRST_USE`, `NONE` | 認証のタイミング |
| `policy.products` | string[] | 特定の Codex サーフェスに制限する |

### CLI コマンド

```bash
# Marketplace management
codex plugin marketplace add owner/repo
codex plugin marketplace add ./local-path
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove <name>

# Plugin lifecycle
codex plugin install <plugin-name>
codex plugin enable <plugin-id>
codex plugin disable <plugin-id>
codex plugin remove <plugin-id>
codex plugin upgrade <plugin-id>
```

### インストール Cache

plugin は次にインストールされる:
```
~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/
```

- ローカル plugin: `$VERSION = "local"`
- Codex は source ではなく **cache** からロードする（オフライン利用を可能にする）
- cache はアンインストール後も残る（再有効化をサポートする）
- バージョン検証のために `gitCommitSha` を追跡する

### Plugin の状態

設定ファイルで制御される:
- User: `~/.codex/settings.json`
- Project: `./.codex/settings.json`（git 管理下）
- Local: `./.codex/settings.local.json`（gitignore 対象）

```json
{
  "enabledPlugins": {
    "my-plugin@repo-marketplace": true,
    "experimental@personal": false
  }
}
```

---

## 7. ランタイム解決フロー

```
                    ┌─────────────────────────────┐
                    │    .codex-plugin/plugin.json │
                    └──────────────┬──────────────┘
           ┌───────────┬──────────┼──────────┬──────────────┐
           ▼           ▼          ▼          ▼              ▼
      "skills"    "mcpServers"  "apps"    "hooks"     "interface"
      "./skills/" "./.mcp.json" ".app"   "./hooks/"   (metadata)
           │           │          │          │
           ▼           ▼          ▼          ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
    │ Scan for │ │ Spawn   │ │Resolve │ │ Await   │
    │ SKILL.md │ │ process │ │ creds  │ │ user    │
    │ files    │ │ per     │ │(OAuth/ │ │ trust   │
    │          │ │ entry   │ │ APIkey)│ │ review  │
    └────┬─────┘ └────┬────┘ └───┬────┘ └────┬────┘
         ▼            ▼          ▼           ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
    │ Index by │ │Register │ │Register│ │ Execute │
    │ name+desc│ │ tools   │ │ caps   │ │ command │
    │ for auto │ │ in agent│ │ as     │ │ on      │
    │ matching │ │         │ │ tools  │ │ event   │
    └──────────┘ └─────────┘ └────────┘ └─────────┘
```

**インストール時**: ファイルが cache にコピーされる → コンポーネントが登録される  
**ランタイム時**: 有効な plugin がロードされる → skills が索引される → MCP servers が spawn される → apps が有効化される → 信頼された hook がアームされる

---

## 8. エコシステム比較

| 次元 | Codex | Claude Code | Cursor | VS Code |
|-----------|-------|-------------|--------|---------|
| モデル | Manifest-first | Manifest-first | IDE ネイティブ | Extension API |
| Manifest | `.codex-plugin/plugin.json` | `.claude-plugin/plugin.json` | N/A | `package.json` |
| 配布 | Git repo + cache | Git repo + cache | 中央ストア | `.vsix` パッケージ |
| コンポーネント | Skills + MCP + Apps + Hooks | Skills + MCP + Hooks + LSP | Extension | Extension |
| オフライン | ✅ | ✅ | ❌ | ✅ |
| クロスツール MCP | ✅ | ✅ | ✅（consumer） | ❌ |

**重要な洞察**: MCP は普遍的な相互運用レイヤーである。よく作られた MCP server は Codex、Claude Code、Cursor をまたいで動く。ラッピングのレイヤー（marketplace メタデータ、skill 定義）はツール固有だが、機能的なインフラはポータブルである。

---

## 9. 最小 → 公開への段階

### 絶対的な最小（有効）
```json
{ "name": "my-plugin" }
```

### 最小限の機能
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Reusable greeting workflow",
  "skills": "./skills/"
}
```

### 公開品質
§1 の例のすべてのフィールド。特に次に注意する:
- `interface.privacyPolicyURL` と `termsOfServiceURL`（official ディレクトリには必須）
- `interface.defaultPrompt`（最大 3 × 128 文字のスターター prompt）
- `interface.logo` と `screenshots`（marketplace でのプレゼンス）
- 少なくとも `name` を持つ `author`
- 発見性のための `keywords`

---

## 10. 主要な要点

1. **Manifest-first は宣言的である** — インストール時にコードは走らない; JSON は検査可能でポータブルである
2. **必須なのは `name` だけ** — 最小限で始め、必要に応じて複雑さを足す
3. **3 層アーキテクチャ** が関心を分離する: Skills（知識）、Apps（認証）、MCP（ツール）
4. **信頼は明示的である** — hook は自動実行されない; user はレビューして承認せねばならない
5. **前方互換** — 未知のキーは `extra` map を介して SDK のラウンドトリップを生き延びる
6. **Git ネイティブな配布** — plugin は repo に住む; コンパイル無し、ビルドステップ無し
7. **MCP はポータビリティのレイヤーである** — 同じ server が Codex、Claude Code、Cursor をまたいで動く

---

*3 つの並行リサーチトラックから編集した。個別の agent ファイルは `artifacts/research/codex-manifest-shape/` にある。*  
*一次ソース: [OpenAI Codex Docs](https://developers.openai.com/codex/plugins/build), [Codex SDK HexDocs](https://hexdocs.pm/codex_sdk/13-plugin-authoring.html), [HuggingFace Context Course](https://huggingface.co/learn/context-course/unit3/anatomy.md)*
