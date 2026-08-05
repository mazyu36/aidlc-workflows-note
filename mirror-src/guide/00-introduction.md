# はじめに

> [AI-DLC ドキュメント](../README.md) の一部 · **ユーザーガイド** · [Harness Engineer ガイド](../harness-engineering/00-overview.md) · [開発者リファレンス](../reference/00-overview.md)

## AI-DLC とは

AI-DLC（AI-Driven Development Life Cycle）は、AI 支援によるソフトウェア開発を、再現可能で追跡可能な phase に構造化するための方法論である。これは [AWS AI-DLC methodology](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) を起源とする。本リポジトリはこれを単一の harness 非依存なコアからネイティブに実装しており、すでに利用している CLI harness の中で動作する。現時点では Claude Code、Kiro CLI、Kiro IDE、Codex CLI、opencode である。本ガイドは harness 非依存であり、harness ごとに詳細が異なる箇所ではその旨を明記し、対応する harness の章へ誘導する（[他の harness で実行する](harnesses/README.md) を参照）。特に断りがない限り、例は Claude Code で示す。

呼び出しは単一のコマンドで行う:

```
/aidlc Build a REST API for inventory management
```

その後 AI-DLC は、intent の捕捉から要件・設計・実装・テスト・デプロイに至る構造化されたワークフローを通じて利用者を導きつつ、あらゆる意思決定ポイントで制御を利用者の手に残す。

## 哲学: Small Mob, Broad Agents

数十もの狭い専門家（ウォーターフォールの引き継ぎの連鎖を再現してしまうアプローチ）ではなく、AI-DLC は**広範な能力を持つ 11 個のエージェント**を用いる。各エージェントは複数の stage と phase にまたがって関与する。各エージェントは stage をまたいでコンテキストを引き継ぐため、引き継ぎが不要になり、調整のオーバーヘッドが減る。

これは効果的な人間のチームの働き方を反映している。3〜5 人の mob が機能全体をカバーし、各人が単一の狭い専門性ではなく広範なスキルを持ち寄る。

## orchestrator の仕組み

AI-DLC は本質的にシンプルなループを実行する。決定論的な **engine** が次に起きることを決定し、**conductor**（`/aidlc` セッション、`SKILL.md`）がそれを実行し、次の一手を engine に問い合わせる。このループ全体を通じて、フレームワークは次を行う:

1. **stage ファイルを読む** — 5 つの phase にまたがる 32 個の stage 定義。各定義が入力・手順・出力・リードエージェントを指定する
2. **エージェントペルソナを読み込む** — 専門知識を備えたドメインエキスパートの視点（アーキテクト、開発者、プロダクトマネージャーなど）を有効化する
3. **状態と audit を管理する** — `aidlc-state.md` で進捗を追跡し、追跡可能性のためにすべての意思決定を intent の `audit/` シャードに記録する
4. **stage トポロジーにまたがって委譲する** — 集中的な自律作業やマルチエージェント協働のために、subagent を hub-and-spoke、pipeline、mob として dispatch する
5. **承認 gate を提示する** — 各 stage の後、workflow が進む前に利用者がレビューして承認する

engine はルーティングを担う（次はどの stage か、どの scope か、いつ止まるか）。conductor は実行品質を担う（stage をうまく回し、良い質問をし、意思決定を利用者に提示する）。ほとんどの stage は **inline** で実行される。conductor がエージェントの視点を採用し、会話の中で利用者と直接作業する。4 つの stage は dispatch されるトポロジーを使う。Practices Discovery と Code Generation は `subagent` ハブとして、Reverse Engineering は 2 リンクの `pipeline` として、User Stories は `mob` として実行される。完全なトポロジーは 28 inline / 2 subagent / 1 pipeline / 1 mob である。全体アーキテクチャについては、開発者リファレンスの [Engine and Skill System](../reference/17-skill-system.md) を参照。

## 本ガイドの対象読者

本ガイドは、ソフトウェアを構築するために AI-DLC を**使う**すべての人に向けたものである:

- **新規ユーザー** — [はじめかた](01-getting-started.md)、[最初のワークフロー](02-your-first-workflow.md)、[Space と Intent](03-spaces-and-intents.md) から始めるとよい
- **通常ユーザー** — [CLI コマンド](12-cli-commands.md)、[Scope・Depth・テスト戦略](05-scopes-and-depth.md)、[トラブルシューティング](15-troubleshooting.md) を参照する
- **チームリード** — チームの標準に合わせて AI-DLC をカスタマイズするには、[ナレッジ](08-knowledge.md) と [Rule と学習ループ](09-rules-and-the-learning-loop.md) を参照する

AI-DLC の*振る舞いそのもの*を作り変えるには — stage やエージェントの追加、scope の定義、rule や sensor の作成、チームナレッジの追加（すべて設定であり、コードは不要）— [Harness Engineer ガイド](../harness-engineering/00-overview.md) を参照。AI-DLC のコードベース自体を変更するには、[開発者リファレンス](../reference/00-overview.md) を参照。

## 主要な数値

| 指標 | 値 |
|--------|-------|
| Phase | 5（Initialization、Ideation、Inception、Construction、Operation） |
| Stage | 32 |
| エージェント | 合計 14: 11 のドメインエキスパート、2 のレビュアー、および composer |
| Scope | 9（enterprise から workshop まで）+ 自動検出 |
| Depth レベル | 3（Minimal、Standard、Comprehensive） |
| テスト戦略レベル | 3（Minimal、Standard、Comprehensive） |
| Audit イベントタイプ | 76 |

## ガイドマップ

| 章 | 学べる内容 |
|---------|------------------|
| [はじめかた](01-getting-started.md) | 前提条件、インストール、最初のヘルスチェック |
| [最初のワークフロー](02-your-first-workflow.md) | 完全な実行の注釈付きウォークスルー |
| [Space と Intent](03-spaces-and-intents.md) | workspace のレイアウト: 複数の作業を space と intent にまたがって実行する |
| [Phase と Stage](04-phases-and-stages.md) | 5 つの phase と 32 個の stage を解説 |
| [Scope・Depth・テスト戦略](05-scopes-and-depth.md) | scope / depth / テスト戦略の選び方と上書き方法 |
| [エージェント](06-agents.md) | 14 エージェントの一覧: 11 のドメインエキスパート、2 のレビュアー、および composer |
| [エージェント詳解](agents/README.md) | エージェントごとのリファレンスページ: 責務、stage、ナレッジ |
| [インタラクションモード](07-interaction-modes.md) | Guide Me / Edit File / Chat と承認 gate |
| [ナレッジ](08-knowledge.md) | 会社の標準や規約を追加する |
| [Rule と学習ループ](09-rules-and-the-learning-loop.md) | 自己学習する振る舞いの rule |
| [状態と Audit](10-state-and-audit.md) | 進捗と意思決定がどう追跡されるか |
| [セッション管理](11-session-management.md) | resume、redo、jump、recovery、セッションレポートのスキル |
| [CLI コマンド](12-cli-commands.md) | 例付きの完全なフラグリファレンス |
| [カスタマイズ](13-customization.md) | 設定、scope 設定、エージェントのチューニング |
| [成果物リファレンス](14-artifacts-reference.md) | intent ごとの record dir（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）を解説 |
| [トラブルシューティング](15-troubleshooting.md) | 症状ベースの問題解決 |
| [実例集](16-worked-examples.md) | bugfix と feature の完全なウォークスルー |
| [スキルとランナーコマンド](17-skills.md) | `/aidlc-*` の stage ランナー・scope ランナーコマンドと、独自ランナー作成の道筋 |
| [Workshop モード](workshop-mode.md) | workshop scope 向けのマルチ開発者手動レシピ（git push による claim セマンティクス） |
| [他の harness で実行する](harnesses/README.md) | Kiro CLI、Kiro IDE、Codex CLI、opencode でのインストールと実行、および harness ごとの差異 |
| [用語集](glossary.md) | 全用語の定義 |
