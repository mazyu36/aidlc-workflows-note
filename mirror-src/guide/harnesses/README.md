# 他の harness で動かす

AI-DLC は harness 非依存の 1 つの core を、利用する CLI の上へ描画したものである。方法論 — [phase と stage](../04-phases-and-stages.md)、[エージェント](../06-agents.md)、[scope](../05-scopes-and-depth.md)、[承認 gate](../07-interaction-modes.md) — はどの harness でも同一である。異なるのは*シェル*だ: gate の描画のしかた、subagent の dispatch のしかた、どのセッションイベントが発火するか、設定がどこに住むか。ここにある各章は、1 つの harness のインストール手順・前提条件・中立の方法論と異なる少数の挙動を扱う。

harness を選ぶ:

| Harness | 呼び出し | 章 |
|---------|--------|---------|
| **Claude Code** | `/aidlc` | [ユーザーガイド](../00-introduction.md) 全体でカバー（例は Claude Code で動く）。インストールは [はじめかた](../01-getting-started.md)。 |
| **Kiro IDE** | `/aidlc` | [Kiro IDE で AI-DLC を動かす](kiro-ide.md) — 前提条件（Opus 4.8）、インストール、hooks、Kiro での違い。 |
| **Kiro CLI**（≥ 2.6） | `/aidlc` | [Kiro CLI で AI-DLC を動かす](kiro-cli.md) — 前提条件、インストール、Kiro での違い。 |
| **Codex CLI**（≥ 0.145.0） | `$aidlc` | [Codex CLI 上の AI-DLC](codex-cli.md) — 前提条件、trust の事前シード、Bedrock 設定、git リポジトリ必須の件。 |
| **Cursor** | `/aidlc` | [Cursor 上の AI-DLC](cursor.md) — Cursor IDE と CLI 向けの 1 つのツリー、ネイティブの subagent と skill、hooks.json アダプタ、Cursor での違い。 |
| **opencode**（≥ 1.17） | `/aidlc` | [opencode 上の AI-DLC](opencode.md) — `.aidlc/` + `.opencode/` の分割レイアウト、アダプタのプラグイン、opencode での違い。 |
| **GitHub Copilot**（CLI ≥ 1.0.74 / VS Code ≥ 1.130） | `/aidlc` | [GitHub Copilot 上の AI-DLC](copilot.md) — 両サーフェス共通の 1 つのインストール、`.github/` への merge、フォルダの信頼、Copilot での違い。 |

Kiro（IDE・CLI）上の AI-DLC は **Claude Opus 4.8** で最もよく動き、これには **Kiro の有償プラン**が必要である。

この集合はオープンだ: 新しい harness には同じテンプレートからここに専用の章が足される。新しい harness を*作る*側（ソースの契約 — manifest・hook アダプタ・`emit.ts`）は、Harness Engineer ガイドの [新しい harness への移植](../../harness-engineering/09-porting-to-a-new-harness.md) を参照。

どの harness で動かしても方法論は同じである — [最初のワークフロー](../02-your-first-workflow.md) と [Phase と Stage](../04-phases-and-stages.md) のツアーから始めるとよい。
