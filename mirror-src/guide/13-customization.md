# カスタマイズ

AI-DLC はチームのニーズへ適応するように設計されている。本章では設定の上書き、scope の構成、stage のカスタマイズ、ステータスライン、ツール権限を扱う。

> **Harness 固有の設定。** harness 非依存のカスタマイズ — scope 構成・stage の depth・
> ナレッジ・rule — はどの harness でも適用される。本章の機構レベルの設定
>（`settings.json` / `settings.local.json`、statusline コマンド、`$CLAUDE_PROJECT_DIR`、
> ツール権限ブロック）は **Claude Code 固有**である。Kiro は同等物を
> `.kiro/settings/cli.json` + エージェント設定で、Codex は `.codex/config.toml`
> + Starlark rules で、Cursor は `.cursor/hooks.json` + `.cursor/cli.json`
>（permissions のみ）で、opencode はプロジェクトルートの `opencode.json` で、Copilot は
> `.github/hooks/aidlc.json`（hook の配線）+ `~/.copilot/config.json`（folder trust）で
> 構成する — 各 harness のサーフェスは
> [Kiro CLI で動かす](harnesses/kiro-cli.md)、
> [Kiro IDE で動かす](harnesses/kiro-ide.md)、
> [Codex CLI で動かす](harnesses/codex-cli.md)、
> [Cursor 上の AI-DLC](harnesses/cursor.md)、
> [opencode 上の AI-DLC](harnesses/opencode.md)、
> [GitHub Copilot 上の AI-DLC](harnesses/copilot.md) を参照。

---

## 設定の上書き（`settings.local.json`）

共有の `.claude/settings.json` はフレームワークに同梱され、バージョン管理にコミットされる。チームに影響させずローカル環境の設定を上書きするには、個人用の上書きファイルを作る:

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

このファイルは `.gitignore` に載っており、個人の変更がコミットされることはない。用途:

- モデル選択の上書き（例: 別の Opus / Sonnet のモデル ID へ切り替え）
- ローカル環境向けの環境変数の設定
- セキュリティ要件に合わせたツール権限の調整

---

## エージェントのモデルと effort（tier）

同梱エージェントは `tier:`（`judgment` | `balanced` | `templated`）付きで書かれており、ビルドが各 harness ネイティブの model / effort キーへ投影する — judgment のエージェントはセッションのモデルと effort を継承し、balanced のエージェントは中型モデルを固定し（Claude Code・Codex・opencode。Kiro・Cursor・Copilot では全 tier がセッションモデルを継承）、templated のエージェントは同じモデル固定 harness で effort も下げる。完全な投影表は [エージェントシステム](../reference/05-agent-system.md) を参照。

インストール済みコピーで 1 体のエージェントだけ挙動を変えるには、投影された値を直接編集する — 例えば Claude のエージェント `.claude/agents/aidlc-*-agent.md` の frontmatter に `model: opus` を設定する。Kiro ではサーフェスが harness に依存する: Kiro CLI ではエージェントの `.kiro/agents/aidlc-*-agent.json` に `"model"` フィールドを足し、Kiro IDE ではエージェントの `.kiro/agents/aidlc-*-agent.md` frontmatter に `model:` 行を設定する（エージェントの JSON ファイルは CLI 専用 — IDE は spawn 時に `.md` frontmatter を読む）。どちらの場合もインストールで有効なモデル ID を使うこと。Kiro のエージェントはモデル固定なしで出荷されるため、既定ではセッションモデルを継承する。この編集は `dist/<harness>/` シェルを再コピーするまで生き残る。ソースから自分のディストリビューションをビルドする際に全エージェントへ上限を掛けるには、`core/memory/org.md`/`project.md` の frontmatter に `tier_cap:` を設定するか、パッケージャを `AIDLC_TIER_CAP=<tier>` で実行する — どちらも `bun scripts/package.ts` のパック時のノブであり、ランタイム設定ではない。

---

## プロジェクト単位の既定 scope

プロジェクト内のすべてのワークフローを同じ scope から始めるべきとき — 例えば全参加者が `workshop` で走るべきワークショップ — `.claude/settings.json` の `env` ブロックに `AWS_AIDLC_DEFAULT_SCOPE` を設定する（同梱ファイルは既にこれを `workshop` に設定している）:

```json
{
  "env": {
    "AWS_AIDLC_DEFAULT_SCOPE": "workshop"
  }
}
```

> 同梱の `env` ブロックには Bedrock のモデル ID（`CLAUDE_CODE_USE_BEDROCK`、`ANTHROPIC_DEFAULT_OPUS_MODEL` 等）も含まれる。それらは別に列挙されている — 上の例は分かりやすさのため scope のキーだけを示す。

これを設定すると、裸の `/aidlc` 呼び出しが `workshop` を既定 scope として使う。参加者は毎回 `/aidlc workshop` を覚える必要がない。env 変数はワークフローの初期化時にのみ読まれる。intent の `aidlc-state.md` が（record dir 配下に）存在するようになった後は状態ファイルが正であり、env の変更は実行中のワークフローに影響しない。

**優先順位（高い順）:**

1. 明示的な CLI フラグ: `/aidlc feature` や `/aidlc --scope bugfix` が勝つ。
2. 自由記述のキーワード検出: `/aidlc fix the login bug` は引き続き `bugfix` に対応する。検出された scope は既存の確認プロンプトで上書きできる。
3. `.claude/settings.json` の `AWS_AIDLC_DEFAULT_SCOPE` env 変数。
4. ハードコードされたフォールバック（intent birth では `poc`、マッチしない自由記述では `feature`）。

**有効値:** `enterprise`、`feature`、`mvp`、`poc`、`bugfix`、`refactor`、`infra`、`security-patch`、`workshop`。無効な値は呼び出し時に明確なメッセージでエラーになる。チームは `.claude/scopes/aidlc-<name>.md` ファイルを置いてメンバー stage の `scopes:` リストにタグ付けすることで追加の scope を定義できる — [コントリビューション: scope の追加](../reference/11-contributing.md#adding-a-scope) を参照。`.claude/agents/` に追加のエージェントも定義できる — [コントリビューション: エージェントの追加](../reference/11-contributing.md#adding-an-agent) を参照。

**設定の検証:** `/aidlc --doctor` で env 変数が設定済み・有効であることを確認する:

```
✓  AWS_AIDLC_DEFAULT_SCOPE=workshop (valid)
```

**初期化時の通知:** env の既定が適用されるとき、orchestrator はワークフロー開始時に 1 行の通知（`Using scope=<value> from AWS_AIDLC_DEFAULT_SCOPE (.claude/settings.json)`）を表示し、scope の出所が効いた瞬間に見えるようにする。

なぜ scope だけで depth や test-strategy は無いのか？ 各 scope は既に自分の depth と test-strategy の既定を宣言している（workshop → Standard depth・Minimal テスト戦略）。scope を設定すればそれらが自動で連鎖する。どちらかを上書きしたければ CLI で `--depth` か `--test-strategy` を渡す。

**機微な値:** `.claude/settings.json` はバージョン管理にコミットされる。秘密情報・認証情報・個人の上書きをここに置かないこと — 機微なものには `.claude/settings.local.json`（gitignore 済み）を使う。

---

## scope の構成

scope は、どの stage をどの depth・テスト戦略で実行するかを制御する。AI-DLC は 9 つの名前付き scope を提供する。完全な表（各 scope の EXECUTE/総 stage 数・既定 depth・テスト戦略・ユースケース）の単一のソースは [Scope・Depth・テスト戦略 § 9 つのコア scope](05-scopes-and-depth.md#the-9-core-scopes) である。本節はその*構成*と上書きを扱う。

### scope の選択

明示的に指定するか、orchestrator に自動検出させる:

```
/aidlc enterprise       # Explicit scope
/aidlc Build a payments API  # Auto-detects "feature"
/aidlc Fix the login bug     # Auto-detects "bugfix"
```

### 実行時の上書き

ワークフロー中はいつでも scope を上書きできる:

- **任意の承認 gate で**: 別の scope や depth を要望する
- **ユーティリティコマンドで**: `/aidlc --scope enterprise` がアクティブな scope を変更する
- **stage の追加**: Ideation と Inception の承認 gate では、以前スキップされた stage をワークフローに戻せる

---

## stage のカスタマイズ

各 stage は `.claude/aidlc-common/stages/[phase]/` にある自己完結の `.md` ファイルである。stage ファイルは次を指定する:

- **メタデータ** — stage 番号、phase、実行モード、リード / 支援エージェント
- **入力** — 読み込む先行成果物
- **手順** — 番号付きの実行シーケンス
- **出力** — 生成する成果物
- **完了** — 承認 gate のパターン

stage の振る舞いを変えるには、その stage ファイルを直接編集する。すべての stage は共有パターン（承認 gate・質問形式・状態追跡）について stage プロトコルを参照する。

### depth レベル

各 scope は成果物の詳細度を制御する既定 depth を持つ:

| Depth | 説明 |
|-------|-------------|
| **Minimal** | 簡潔な成果物、的を絞った分析、任意コンテンツなし |
| **Standard** | バランスの取れた詳細、主要・副次の関心事をカバー |
| **Comprehensive** | 完全な詳細、広範な分析、任意コンテンツをすべて含む |

任意の承認 gate で、別のレベルを要望して depth を上書きできる。

---

## ステータスライン（Claude Code のみ）

**Claude Code** では、この実装はターミナルのステータスバーにワークフロー進捗を示すステータスラインを表示する。他の harness にステータスラインは無い — ワークフローの位置は `/aidlc --status`（Kiro・Cursor・opencode）や、`update_plan` のタスク進捗項目 + `$aidlc --status`（Codex）で表示する:

```
[AIDLC] IDEATION [▓▓▓▓▓░░░░░] 4/7 > Intent Capture -- Product Agent
```

表示は順に: 現在の phase、phase の進捗（バーと比 — どちらも現在 phase の範囲）、stage の表示名、リードエージェント。コンテキスト使用量は右側に現れ（例: `ctx:15%`）、残りが減るにつれて色分けされる。Claude の使用量台帳にデータがある場合、`↑<in> ↓<out> $<usd>` が続き、対象は現在のワークフローと現在のトランスクリプト/セッションのみで、それ以前のワークフローとセッションは除外される。`AIDLC_DISABLE_USAGE_TRACKING=1` を設定すると使用量追跡は完全に無効になり、このセグメントも消える。

### 設定

ステータスラインは `.claude/settings.json` で設定される:

```json
"statusLine": {
  "type": "command",
  "command": "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/aidlc-statusline.ts\""
}
```

### 形式のカスタマイズ

`.claude/hooks/aidlc-statusline.ts` を直接編集する。出力形式はファイル末尾近くの `main()` 関数に定義されている。hook は `aidlc-state.md` から phase・stage・エージェントを読み、stage の slug を表示名に対応させ、同じ phase ローカルのチェックボックス解析から unicode の進捗バーと `n/m` 比の両方を組み立てる。

### ステータスラインの無効化

`settings.json` から `statusLine` ブロックを削除する。ターミナルのステータスバーは Claude Code の既定に戻る。

---

## ツール権限

`.claude/settings.json` の `permissions.allow` リストは、ワークフローが呼び出しごとの許可プロンプトなしに走るよう Claude Code のツールを事前承認する:

```json
"permissions": {
  "allow": [
    "Read", "Edit", "Write",
    "Bash(bun \"$CLAUDE_PROJECT_DIR/.claude/tools/\"*)",
    "Bash", "Glob", "Grep", "Task", "WebSearch"
  ]
}
```

スコープ付きの `Bash(bun "$CLAUDE_PROJECT_DIR/.claude/tools/"*)` エントリは裸の `Bash` より前に置かれ、フレームワーク自身のツール呼び出しが常により狭いルールに先にマッチする。`$CLAUDE_PROJECT_DIR` はダブルクォートのまま（`*` はクォートの外）にすることで、プロジェクトパスに空白があっても単語分割するシェルでコマンドが生き残り、権限マッチャは引き続き glob できる。

### 権限の仕組み

- **プロジェクト全体の天井**: `settings.json` の allow リストが利用可能なツールの最大集合である
- **エージェントは既定でセッションの完全なツールセットを継承する**。同梱の唯一の制限は、入れ子の subagent 生成をブロックする `disallowedTools: Task` である
- **任意のエージェント別の絞り込み**: frontmatter に `tools:` 許可リストを足すことでエージェントを絞れる — 省略すればすべてを継承する。`tools:` を列挙すると、完全修飾の `mcp__<server>__<tool>` id も併記しない限り、継承していた MCP ツールが落ちる

### 権限の拡張

追加の能力を要するカスタム stage を作る場合にだけ、allow リストにツールを足す。

### 権限の絞り込み

allow リストからツールを外すと、使用のたびに手動承認が要るようになる。`Task` を外すと、4 つの dispatch される stage（2.1 Reverse Engineering の pipeline、2.2 Practices Discovery の subagent、2.4 User Stories の mob、3.5 Code Generation の subagent）が委譲のたびに許可を求めるようになる点に注意。ワークスペース検出（0.2）は `aidlc-utility intent-create` の中で決定論的に実行される — `Task` は使わない。

---

## AI-DLC の拡張

上記の settings・scope・depth・stage の編集は、あなたが走らせるワークフローの日々の調整を覆う。フレームワークそのものをチーム向けに作り変えたいとき — stage の追加、エージェントの追加、scope の定義、常設 rule の教示、決定論チェックの束線、ドメイン知識の追加 — それは独自のガイドを持つ別の仕事である: **[Harness Engineer ガイド](../harness-engineering/00-overview.md)**。

分かれ目はデータ対コードである。そのガイドにあるものはすべて、フレームワークが読む YAML frontmatter 付きの Markdown ファイルか JSON 設定であり、TypeScript の編集は無い。拡張ごとの行き先:

| やりたいこと | 出発点 |
|--------------|----------|
| stage の動作を編集する、新しい stage を足す | [Stage の解剖](../harness-engineering/01-anatomy-of-a-stage.md)、[Stage の追加](../harness-engineering/02-adding-a-stage.md) |
| エージェントの追加・変更 | [エージェントの追加](../harness-engineering/03-adding-an-agent.md) |
| scope の定義・調整 | [Scope](../harness-engineering/04-scopes.md) |
| 常設 rule の教示、学習ループの運用 | [Rule と学習ループ](../harness-engineering/05-rules-and-the-loop.md) |
| 決定論チェック（sensor）を stage に束線する | [Sensor](../harness-engineering/06-sensors.md) |
| チームのドメイン知識を足す | [チームナレッジ](../harness-engineering/07-team-knowledge.md) |

変更がフレームワークの*コード* — orchestrator・hook・CLI ツール・コンパイルパイプライン — に及ぶなら、それは [開発者リファレンス](../reference/00-overview.md) である。

---

## ナレッジと Rule

2 層ナレッジシステムと rule / 学習ループの詳細は次を参照:

- [ナレッジ](08-knowledge.md) — チームナレッジのディレクトリと方法論リファレンスファイル
- [Rule と学習ループ](09-rules-and-the-learning-loop.md) — 行動ルールと自己学習のフロー

---

## 次のステップ

- [Scope・Depth・テスト戦略](05-scopes-and-depth.md) — scope と stage の完全な対応
- [エージェント](06-agents.md) — エージェントの権限と能力
- [トラブルシューティング](15-troubleshooting.md) — ステータスラインの問題、hook の設定
- [用語集](glossary.md) — scope・depth・guardrail・knowledge の定義
