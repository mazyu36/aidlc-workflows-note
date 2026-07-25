# aidlc-architect-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-architect-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

aidlc-architect-agent は設計の中心的な権威であり、ライフサイクルの 3 つの phase に
わたって、アーキテクチャ的に最も複雑な推論タスクを担う。他の 7 つの high-judgment な
agent とともに `judgment` tier を帯びる — 3 つの `templated` agent（delivery、
pipeline-deploy、operations）は、支配的に templated な計画・CI/CD・runbook の出力を生む。

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| feasibility | Feasibility and Constraint Analysis | 技術的実現性を評価し、統合の制約を特定し、制約レジスタとリスク評価を生む |
| application-design | Application Design | システムアーキテクチャを設計する: bounded context、コンポーネントインターフェース、アーキテクチャスタイルの選定、ADR |
| units-generation | Units Generation | アプリケーション設計を、境界と依存 DAG を持つ実装可能な Unit of Work へ分解する。経済的な順序付け（何を最初に出荷するか、なぜか）は delivery-planning stage の決定である |
| functional-design | Functional Design | 詳細なドメインモデル、シーケンス図、API 仕様、データモデル、状態遷移を作る |
| nfr-requirements | NFR Requirements | 性能・セキュリティ・スケーラビリティ・信頼性について、測定可能な目標を持つ非機能要件を列挙する |
| nfr-design | NFR Design | NFR の技術的アプローチを設計する: キャッシュ、circuit breaker、レジリエンス、セキュリティアーキテクチャ、observability |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| intent-capture | Intent Capture and Framing | 捕捉された intent に対して、技術的文脈と実現性の視点を提供する |
| reverse-engineering | Reverse Engineering（dispatch される最終 pipeline リンク） | aidlc-developer-agent からコードスキャン結果を受け取り、一貫したアーキテクチャモデルへ統合する |
| delivery-planning | Delivery Planning | ビルド順序をアーキテクチャの依存関係とコンポーネント結合に照らして検証する |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-product-agent | 要件、user story、intent backlog |
| aidlc-developer-agent | reverse engineering 統合のためのコードスキャン結果 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-developer-agent | unit of work 仕様、API 契約、デザインパターン |
| aidlc-quality-agent | テスト境界、検証用の NFR 目標 |
| aidlc-aws-platform-agent | アプリケーション設計から導出されるインフラ要件 |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-architect-agent/`

| ファイル | 内容 |
|------|---------|
| adr-template.md | Architecture Decision Record のテンプレートと例 |
| architecture-guide.md | アーキテクチャの方法論と設計プロセス |
| architecture-patterns.md | アーキテクチャスタイルのパターン（マイクロサービス、モジュラモノリス、イベント駆動、サーバーレス） |
| ddd-patterns.md | ドメイン駆動設計のパターン（bounded context、集約、エンティティ、値オブジェクト） |
| nfr-design-guide.md | 非機能要件の設計方法論 |
| nfr-design-patterns.md | NFR 実装の技術的パターン（キャッシュ、circuit breaker、レジリエンス） |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-architect-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
アーキテクチャ文脈 — 既存のアーキテクチャ図、technology radar、承認済みパターン、
制約レジスタなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-architect-agent](../../guide/agents/architect-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-architect-agent.md`](../../../dist/claude/.claude/agents/aidlc-architect-agent.md)
