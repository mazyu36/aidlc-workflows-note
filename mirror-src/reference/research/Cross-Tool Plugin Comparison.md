# クロスツール Plugin Manifest 比較

> **Codex Manifest Shape Report への追補** | June 26, 2026  
> **出典**: OpenAI Codex docs, Anthropic Claude Code docs, Cursor official plugins repo, OpenCode docs, HuggingFace Context Course  
> **比較対象プラットフォーム**: Codex, Claude Code, Cursor, OpenCode, Pi

---

## プラットフォームのアーキテクチャモデル

AI コーディングツールのエコシステムは、2 つの基本的なアプローチに分かれる:

| モデル | プラットフォーム | 特徴 |
|-------|-----------|-----------------|
| **Manifest-first** | Codex, Claude Code | 宣言的な JSON manifest + root レベルのコンポーネントディレクトリ。インストール時にコードは走らない。 |
| **Code-first** | OpenCode | JS/TS モジュールが hook 関数をエクスポートする。plugin がコードそのものである。 |
| **IDE-extension** | Cursor (VS Code fork) | VS Code の extension モデルを継承 + 新しい plugin 仕様 |
| **Package-based** | Pi | 規約ベースのディレクトリを持つ `package.json` |

---

## Manifest の横並び比較

### Codex `.codex-plugin/plugin.json`

```json
{
  "name": "text-processor-plugin",
  "version": "1.0.0",
  "description": "Text analysis skills",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "apps": "./.app.json",
  "hooks": "./hooks/hooks.json",
  "interface": {
    "displayName": "Text Processor",
    "shortDescription": "Analyze text with AI",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": ["Analyze this text for readability"],
    "brandColor": "#10A37F",
    "logo": "./assets/logo.png"
  }
}
```

### Claude Code `.claude-plugin/plugin.json`

```json
{
  "name": "text-processor-plugin",
  "version": "1.0.0",
  "description": "Text analysis skills",
  "author": { "name": "Your Name" }
}
```

**注目点**: Claude Code の manifest ははるかに簡素である — コンポーネントは規約（ディレクトリの存在）で発見され、明示的なパスで指し示されない。`interface` オブジェクトは無い。

### OpenCode（Manifest 無し — コードが plugin である）

```typescript
// .opencode/plugins/text-processor-plugin.ts
import type { Plugin } from "@opencode-ai/plugin"

export const TextProcessorPlugin: Plugin = async ({ project, client, $, directory }) => {
  return {
    "tool.execute.before": async (input) => {
      if (input.tool === "read") {
        await client.app.log({ body: { message: "Consider text analysis" } })
      }
    }
  }
}
```

### Pi `package.json`

```json
{
  "name": "text-processor-plugin",
  "version": "1.0.0",
  "keywords": ["pi-package"],
  "pi": {
    "skills": ["./skills"],
    "extensions": ["./extensions"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

---

## ディレクトリ構造の比較

### Codex
```
my-plugin/
├── .codex-plugin/
│   └── plugin.json          ← Manifest (ONLY file here)
├── skills/
│   └── analyze-text/
│       └── SKILL.md
├── .mcp.json                ← MCP server config
├── .app.json                ← App/connector config  
├── hooks/
│   └── hooks.json
└── assets/
    ├── logo.png
    └── screenshot-1.png
```

### Claude Code
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          ← Manifest (ONLY file here)
├── skills/
│   └── analyze-text/
│       └── SKILL.md
├── agents/                  ← UNIQUE: agent definitions
│   └── reviewer.md
├── .mcp.json                ← MCP server config
├── .lsp.json                ← UNIQUE: LSP server config
├── hooks/
│   └── hooks.json
├── monitors/                ← UNIQUE: background monitors
│   └── monitors.json
├── themes/                  ← UNIQUE: color themes
│   └── dracula.json
└── README.md
```

### OpenCode
```
my-project/
├── .opencode/
│   ├── plugins/
│   │   └── text-processor.ts   ← Plugin IS the code
│   └── package.json
├── opencode.json               ← npm plugin references
└── README.md
```

### Pi
```
my-package/
├── package.json                ← Manifest (no hidden dir)
├── skills/
│   └── analyze-text/
│       └── SKILL.md
├── extensions/                 ← Runtime TS/JS extensions
│   └── text-processor.ts
├── prompts/
└── themes/
```

---

## Manifest フィールド比較

| フィールド | Codex | Claude Code | OpenCode | Pi |
|-------|-------|-------------|----------|-----|
| **場所** | `.codex-plugin/plugin.json` | `.claude-plugin/plugin.json` | N/A（code-first） | `package.json` |
| **必須** | `name` のみ | `name` のみ | N/A | `name` |
| **名前の形式** | kebab-case | kebab-case | モジュールのエクスポート | npm 形式 |
| **バージョン** | 任意（semver） | 任意（semver または git SHA） | N/A | 必須（semver） |
| **コンポーネントポインタ** | 明示的（`"skills": "./skills/"`） | 規約ベース（ディレクトリを自動検出） | N/A | 明示的（`"pi": {"skills": [...]}`） |
| **Interface/UI メタデータ** | リッチな `interface` オブジェクト（15 フィールド） | 無し — marketplace メタデータは marketplace.json 内 | N/A | 無し |
| **MCP 設定** | `.mcp.json`（manifest から指し示される） | `.mcp.json`（root で自動検出） | 別個の設定 | 任意の `.mcp.json` |
| **パスのルール** | `./` で始まり、`..` 無し | `./` で始まり、`..` 無し | N/A | 標準の node 解決 |
| **前方互換** | `extra` map が未知を保持する | 認識されないフィールドは検証に失敗する | N/A | 標準 JSON |
| **検証** | SDK (Elixir) — 寛容、extra を保持 | 厳格なスキーマ — 未知を拒否 | N/A | npm 検証 |

---

## サポートされるコンポーネント型

| コンポーネント | Codex | Claude Code | OpenCode | Cursor | Pi |
|-----------|:-----:|:-----------:|:--------:|:------:|:---:|
| Skills (SKILL.md) | ✅ | ✅ | ❌（代わりに hooks） | ❌ | ✅ |
| MCP Servers | ✅ | ✅ | ❌（別個） | ✅（consumer） | ✅（アダプタ経由） |
| App Connectors | ✅ (.app.json) | ❌ | ❌ | ❌ | ❌ |
| Lifecycle Hooks | ✅ | ✅（30+ イベント） | ✅（25+ イベント） | ❌ | ❌ |
| Agents/Subagents | ❌ | ✅ (agents/) | ❌ | ❌ | ❌ |
| LSP Servers | ❌ | ✅ (.lsp.json) | ❌ | ❌（VS Code ネイティブ） | ❌ |
| Monitors | ❌ | ✅（experimental） | ❌ | ❌ | ❌ |
| Themes | ❌ | ✅（experimental） | ❌ | ❌（VS Code ネイティブ） | ✅ |
| Custom Tools | ❌（MCP 経由） | ❌（MCP 経由） | ✅（コード内） | ❌ | ✅（extension 内） |

---

## 配布モデル

| 次元 | Codex | Claude Code | OpenCode | Cursor |
|-----------|-------|-------------|----------|--------|
| **主な配布** | Git repo | Git repo | npm + ローカルファイル | VS Code Marketplace (OpenVSX) |
| **Marketplace 形式** | `marketplace.json`（JSON カタログ） | `marketplace.json`（JSON カタログ） | `opencode.json` 配列 | `.vsix` パッケージ |
| **スコープ** | Official, Repo, Personal | User, Project, Local, Managed | プロジェクトローカル | Global |
| **インストール cache** | `~/.codex/plugins/cache/` | `~/.claude/plugins/` | `node_modules` | `~/.vscode/extensions/` |
| **オフラインサポート** | ✅（cache が残る） | ✅（cache が残る） | ✅（npm cache） | ✅ |
| **バージョン固定** | marketplace エントリ内の `ref`/`sha` | git SHA または明示的なバージョン | npm semver | Extension バージョン |
| **CLI インストール** | `codex plugin install` | `claude plugin install` | npm install | ext install |
| **Marketplace CLI** | `codex plugin marketplace add` | （marketplace.json ファイル） | N/A | N/A |
| **Policy 制御** | `AVAILABLE`/`PREINSTALLED`/`HIDDEN` | スコープ付き設定 | N/A | N/A |

---

## Hook/イベントシステム

| 側面 | Codex | Claude Code | OpenCode |
|--------|-------|-------------|----------|
| **イベント数** | ~5-6（SessionStart, Turn*, ToolCall*） | 30+ イベント | 25+ イベント |
| **Hook タイプ** | `command` のみ | `command`, `http`, `mcp_tool`, `prompt`, `agent` | JS/TS ハンドラ関数 |
| **信頼モデル** | Non-managed（明示的な user の信頼が必要） | Non-managed（明示的な信頼） | 自動ロード（プロジェクト内のコード） |
| **環境変数** | `PLUGIN_ROOT`, `PLUGIN_DATA` | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR` | コード内の context オブジェクト |
| **イベントマッチャ** | N/A | 正規表現パターン（例: `"Write|Edit"`） | ツール名のマッチング |
| **ブロッキング** | No | Yes（PreToolUse はブロックできる） | Yes（before hook はブロックできる） |

---

## 主要なアーキテクチャの違い

### 1. 明示的ポインタ vs 規約による発見

**Codex** は明示的な manifest ポインタを要求する:
```json
{ "skills": "./skills/", "mcpServers": "./.mcp.json" }
```

**Claude Code** はディレクトリの存在によって自動発見する — `skills/` が plugin root に存在すれば、skills がロードされる。manifest は `name` だけを必要とする。これは Claude Code の plugin を作りやすくするが、推論しにくくする（暗黙の振る舞い）。

### 2. Interface メタデータ: Codex のみ

Codex は marketplace 表示のためのリッチな `interface` オブジェクトを持つ（ブランドカラー、ロゴ、スクリーンショット、スターター prompt）。Claude Code は manifest に **同等物を持たない** — すべての表示メタデータは plugin 自身ではなく marketplace エントリに住む。

**なぜ重要か**: Codex の plugin は marketplace 目的で自己記述的である。Claude Code の plugin は発見性を marketplace エントリに依存する。

### 3. App Connectors: Codex 専用

サードパーティサービス認証（OAuth、API キー）のための `.app.json` を持つのは Codex だけである。Claude Code、OpenCode、Cursor は plugin システムに認証 connector を同梱せず — 外部サービス統合は MCP server が扱うことを期待する。

**なぜ重要か**: Codex は「Slack/GitHub/Figma への接続」を第一級の plugin の関心事として扱う。他はこれを完全に MCP へ委ねる。

### 4. Subagents: Claude Code 専用

agent 定義（モデル選択、ツール制限、分離）を持つ `agents/` ディレクトリをサポートするのは Claude Code だけである。Codex には agent の同梱が無い — その「subagent」の概念は plugin システムの外で動く。

### 5. LSP + Monitors + Themes: Claude Code の幅広さ

Claude Code は最も豊かなコンポーネントサーフェスを持つ: LSP servers（リアルタイムのコードインテリジェンス）、monitors（バックグラウンドの stdout 監視）、themes。これらは Claude Code の plugin を完全な IDE extension に近づける。Codex はより狭いが、よりクリーンである。

### 6. 検証の哲学

| | Codex | Claude Code |
|--|-------|-------------|
| 未知のキー | `extra` map に **保持される** | **拒否される** — 検証が失敗する |
| 前方互換 | ✅ ラウンドトリップを生き延びる | ❌ 未知を除去せねばならない |
| 厳格さ | 寛容（name のみ必須） | 厳格（スキーマ強制） |

これは重要な分岐である: Codex の plugin は前方互換な実験的フィールドを持ち運べる。Claude Code の厳格な検証は、古いツールが新しい manifest の機能で壊れることを意味する。

### 7. クロスツールのポータビリティ

| レイヤー | ポータブル？ | 備考 |
|-------|-----------|-------|
| MCP servers | ✅ 普遍的 | 同じ `.mcp.json` が Codex, Claude Code, Cursor をまたいで動く |
| Skills (SKILL.md) | 🟡 ほぼポータブル | 同じ形式、異なる自動発見/起動 |
| Hooks | ❌ ツール固有 | 異なるイベント、異なるスキーマ |
| Manifest | ❌ ツール固有 | `.codex-plugin/` ≠ `.claude-plugin/` |
| Marketplace | 🟡 ほぼポータブル | 同じ JSON 形式、異なるパス |

**MCP は普遍的な相互運用レイヤーである。** よく作られた MCP server はすべてのツールをまたいで動く。MCP の上のすべて（skills、hooks、marketplace メタデータ）はツール固有だが — 機能的なロジック（MCP server のコード）は write-once, run-anywhere である。

---

## まとめ: どのモデルをいつ使うか

| 欲しいもの... | 最適なプラットフォームモデル |
|----------------|-------------------|
| 宣言的で検査可能な plugin | Codex または Claude Code（manifest-first） |
| リッチな marketplace 表示 | Codex（interface オブジェクト） |
| 最大限のコンポーネントの多様性 | Claude Code（agents, LSP, monitors, themes） |
| チーム横断の配布 | Codex または Claude Code（Git marketplace） |
| コードレベルの hook 制御 | OpenCode（プログラム的な hook） |
| IDE ネイティブな extension | Cursor（VS Code モデル） |
| MCP のポータビリティ | すべて（MCP は普遍的） |
| 前方互換なスキーマ | Codex（extra map） |
| 厳格な検証の安全性 | Claude Code（未知を拒否） |
| サードパーティサービス認証 | Codex（.app.json connector） |

---

## 収束の論題

表面的な違いにもかかわらず、エコシステムは収束しつつある:

1. **普遍的な接着剤としての MCP** — すべてのツールが MCP server を消費する。これが write-once のレイヤーである。
2. **共有概念としての Skills** — YAML frontmatter 付きの SKILL.md は Codex、Claude Code、Pi に現れる。形式はほぼ同一である。
3. **Git ネイティブな配布** — Codex と Claude Code はどちらも、Git repo を指す `marketplace.json` カタログを使う。コンパイルステップ無し、ビルドシステム無し。
4. **Plugin = ディレクトリ** — manifest-first の両プラットフォームは同じ物理パターンを共有する: `plugin.json` を持つ隠し設定ディレクトリ（`.codex-plugin/` または `.claude-plugin/`）と、plugin root にあるすべてのコンポーネント。

重要な違いは **野心の範囲** である: Codex は Skills + MCP + Apps に集中する（クリーンでポータブル）。Claude Code はコンポーネントの多様性を最大化する（agents, LSP, monitors, themes）。OpenCode はプログラム的に進む（完全な JS/TS 制御）。しかし下層の MCP は、どのラッパーを選んでも機能的なツールがポータブルであることを意味する。

---

*出典: [OpenAI Codex Plugins](https://developers.openai.com/codex/plugins/build), [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference), [Cursor Plugin Ecosystem](https://pyshine.com/Cursor-Plugins-AI-Code-Editor-Plugin-Specification/), [OpenCode Plugins](http://opencode.ai/docs/plugins), [HuggingFace Context Course Unit 3](https://huggingface.co/learn/context-course/unit3/anatomy.md)*
