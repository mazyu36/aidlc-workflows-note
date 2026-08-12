# 開発者リファレンス概要

> [AI-DLC ドキュメント](../README.md) の一部 · [ユーザーガイド](../guide/00-introduction.md) · [Harness Engineer ガイド](../harness-engineering/00-overview.md) · **開発者リファレンス**

このリファレンスは AI-DLC の内部アーキテクチャと実装を文書化する。対象読者は、AI-DLC のコードベース自体 — orchestrator、hook、CLI ツール、stage-graph のコンパイル pipeline、audit の分類体系、テストスイート — を変更するコントリビューターである。

AI-DLC を**使って**ソフトウェアを構築する立場なら、まず [ユーザーガイド](../guide/00-introduction.md) から始める。設定を通じて **AI-DLC の振る舞いを再形成する**立場 — stage や agent の追加、scope の定義、rule と sensor の著述、チーム knowledge の追加 — なら、まず [Harness Engineer ガイド](../harness-engineering/00-overview.md) から始める; それらはコード変更ではなくデータ変更であり、そこの各章は、網羅的なスキーマを求めてここへ指し戻す前に、ワークフローを物語る。

> **このリファレンスにおけるパス。** AI-DLC は一度だけ著述され harness ごとに生成されるので、ファイルは意図によって 3 つの規約のいずれかで名付けられる:
> - **`core/…`** -- 手で著述される、harness 中立な**信頼できる源泉**（例: `core/tools/aidlc-orchestrate.ts`、`core/aidlc-common/stages/`）。ここで編集する。ファイルが*著述*または*変更*される場所を名指すパスは `core/` パスである。
> - **`dist/<harness>/…`** -- **生成され、コミットされ、drift ガードされた**ディストリビューション（`dist/claude/.claude/`、`dist/kiro/.kiro/`、`dist/kiro-ide/.kiro/`、`dist/codex/`、`dist/opencode/`、`dist/copilot/`）。決して手で編集されない; `bun scripts/package.ts` によってバイト単位で再生成される。*出荷される*ものを説明するときだけ引用される。
> - **`<harness-dir>/…`**（例: `.claude/`、`.kiro/`、`.codex/`） -- *インストールされた*プロジェクトの中の**ランタイム**の場所であり、そこでコマンドが走り、ワークフロー中にフレームワークが読み書きする（`bun .claude/tools/aidlc-graph.ts compile`、`.claude/agents/` を読む `loadAgents()`）。このディレクトリは harness のパラメータである。
>
> このリファレンスが裸の `.claude/` パスを示すとき、それは特に Claude harness のランタイムの場所と読むこと; 同じファイルは `core/` で著述され、各 harness 自身のディレクトリに出荷される。

## このリファレンスが扱う範囲

| 章 | トピック |
|---------|-------|
| [Architecture](01-architecture.md) | 5 層モデル、[Configuration layers](01-architecture.md#configuration-layers) のルーティング原則、実行モデル、設計判断 |
| [Plane アーキテクチャ](02-plane-architecture.md) | control / data / management plane の分離とその境界 |
| [Orchestrator](03-orchestrator.md) | SKILL.md の conductor: 転送ループ、gate の儀式、それが駆動する状態機械 |
| [Stage プロトコル](04-stage-protocol.md) | 振る舞いの契約: 承認 gate、コンプライアンスチェックリスト |
| [Stages](04-stages/) | phase ごとの stage ドキュメント（5 ファイル） |
| [Agent System](05-agent-system.md) | agent の構造、frontmatter の契約、設定マトリクス |
| [Hook とツール](06-hooks-and-tools.md) | hook システム、CLI ツール、82 イベントの audit 分類体系 |
| [Sensor System](07-sensor-system.md) | sensor manifest スキーマ、PULL インポート、発火モデル、default severity |
| [Rule System](08-rule-system.md) | rule ファイルのレイアウト、scope の導出、layer-chain resolver、競合 gate |
| [テスト](09-testing.md) | テストピラミッド、tier、スタブ、フィクスチャ、テストレジストリ |
| [Knowledge System](10-knowledge-system.md) | 2 層アーキテクチャ、ロード順、テンプレート |
| [Contributing](11-contributing.md) | 開発ワークフロー、ユーティリティハンドラのチェックリスト、ドキュメントポリシー |
| [状態機械](12-state-machine.md) | workflow / phase / stage の機械、82 イベントの分類体系、audit-first のルール |
| [Runtime Graph](13-runtime-graph.md) | コンパイル済みの `runtime-graph.json` 成果物: stage graph の data-plane ミラー |
| [Harness プリミティブの対応](14-claude-features.md) | 各 AI-DLC 概念が harness のネイティブプリミティブにどう対応するか（Claude Code を深く） |
| [Stage 定義](15-stage-definition.md) | YAML frontmatter の契約、3 区画の本体、コンパイル pipeline |
| [Artifact Vocabulary](16-artifact-vocabulary.md) | 命名規則、衝突ポリシー、ファイルシステムへの対応、ライブレジストリの見方 |
| [Engine と Skill システム](17-skill-system.md) | orchestration engine（`next`/`report`/`park`）、型付き directive の契約、conductor、複数 skill、scope shape、swarm referee |
| [Plugin Mechanism](18-plugin-mechanism.md) | AIDLC plugin システム: manifest、本物のホストプラグインとしてのインストール時合成、加算的なコントリビューションの継ぎ目、マルチテナントのガード、as-built ステータス。著述のウォークスルーは [harness-engineering/10](../harness-engineering/10-authoring-a-plugin.md) |
| [図](diagrams.md) | すべての Mermaid 図を 1 箇所に |
| [Agents](agents/) | 技術的な agent リファレンス（frontmatter、ツール、stage の所有） |

## ナビゲーションの仕方

- **新しい関心事（rule、方法論、knowledge の事実）はどこに属すか？** [Architecture: Configuration layers](01-architecture.md#configuration-layers) を読む — 境界テストを備えた 2 軸モデル（著述 × 消費）が、あらゆる新しい関心事を正しいファイルへルーティングする。
- **新しい stage を足す？** [Stage プロトコル](04-stage-protocol.md)、続けて [Stages](04-stages/) の該当する phase ファイル、続けて [Contributing](11-contributing.md) を読む。
- **stage 定義のフォーマットを変える？** どの stage `.md` ファイルを編集する前にも [Stage 定義](15-stage-definition.md) を読む。stage ファイルのフォーマットはデータ駆動である; ランタイムはコンパイル済みの JSON を読む。
- **成果物を足す、または改名する？** [Artifact Vocabulary](16-artifact-vocabulary.md) を読む — この章は命名規則、安定性ポリシー（改名/削除 = major、追加 = minor）を説明し、ライブなリストとして `bun aidlc-graph.ts artifacts` を指す。レジストリは stage ファイルから導出され、書かれるものではない。
- **新しい scope を足す？** [Contributing: Adding a Scope](11-contributing.md#adding-a-scope) を読む。scope はファイルで著述される — `.claude/scopes/aidlc-<name>.md` ファイルと、各メンバー stage の `scopes:` タグ — TypeScript の編集は不要である。
- **新しい agent を足す？** [Contributing: Adding an Agent](11-contributing.md#adding-an-agent) を読む。agent はその `.md` frontmatter を通じてデータ駆動である — TypeScript の編集は不要である。
- **agent を変更する？** [Agent System](05-agent-system.md) と、[Agents](agents/) にある該当 agent のファイルを読む。
- **hook に取り組む？** [Hook とツール](06-hooks-and-tools.md) と、hook のテストパターンとして [テスト](09-testing.md) を読む。
- **orchestrator を変える？** [Orchestrator](03-orchestrator.md) と [Architecture](01-architecture.md) を読む。audit イベントを足す、または変更するなら、[状態機械](12-state-machine.md) の章から始める — そうしなければ drift テストが捕まえる。

## ユーザーガイドとの関係

ユーザーガイド（`docs/guide/`）は AI-DLC が**何をするか**と**どう使うか**を説明する。この開発者リファレンスは**どう動くか**と**どう変えるか**を説明する。いくつかのトピックは両方に現れる:

| トピック | ユーザーガイド | 開発者リファレンス |
|-------|-----------|-------------------|
| Agents | 何をするか、いつ現れるか | frontmatter の契約、足し方/変え方 |
| Knowledge | 会社標準の足し方 | ロード順の内部、テンプレートシステム |
| Hooks | 何がログされるか | hook の実装、audit イベントの分類体系 |
