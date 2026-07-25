# aidlc-product-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-product-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, WebSearch, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| intent-capture | Intent Capture and Framing | ステークホルダーの入力から、ビジネスの intent、問題定義、成功指標、初期制約を捕捉する |
| market-research | Market Research and Competitive Analysis | 競合状況、市場トレンド、build-vs-buy のトレードオフ、差別化の機会を調査する |
| scope-definition | Scope Definition and Prioritization | scope 境界（in/out）を定義し、優先順位付けフレームワークを適用し、Intent Backlog を作る |
| requirements-analysis | Requirements Analysis | Ideation 成果物からの要件を、トレース可能でテスト可能な仕様へ構造化・形式化する |
| user-stories | User Stories | 要件を、persona・受け入れ基準・依存マッピングを備えた INVEST 準拠の user story へ変換する |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| rough-mockups | Rough Mockups and Concept Visualization | ワイヤーフレームを、捕捉された intent とユーザーニーズに照らして検証する |
| approval-handoff | Initiative Approval and Handoff | phase 遷移の前に initiative brief の完全性を検証する |
| refined-mockups | Refined Mockups and UX Design | 洗練された設計を、user story と受け入れ基準に照らして検証する |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| ユーザー / ステークホルダーの入力 | 生のビジネスニーズ、ドメイン知識、プロジェクト記述 |
| 既存のドキュメント | 以前の成果物、レガシーシステムのドキュメント |
| aidlc-operations-agent | 次の Ideation サイクルに向けた本番からの運用フィードバック（ライフサイクルの loop を閉じる） |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-architect-agent | システム設計と分解のための検証済み要件 |
| aidlc-developer-agent | コード生成のための story 仕様 |
| aidlc-quality-agent | テストケース設計のための受け入れ基準 |
| aidlc-delivery-agent | delivery 計画のための優先順位付き backlog |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-product-agent/`

| ファイル | 内容 |
|------|---------|
| functional-design-guide.md | 機能設計の方法論 |
| market-research-methods.md | 市場調査の手法とテンプレート |
| prioritization-frameworks.md | MoSCoW、WSJF、RICE、Kano のフレームワーク |
| product-guide.md | プロダクトマネジメントの方法論 |
| requirements-elicitation.md | 要件収集の手法 |
| requirements-guide.md | 要件分析の方法論 |
| user-story-patterns.md | INVEST 基準、story パターン、受け入れ基準のテンプレート |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-product-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
プロダクト知識 — 既存の persona、市場調査、ドメイン用語集、
ステークホルダーのコミュニケーションの好みなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-product-agent](../../guide/agents/product-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-product-agent.md`](../../../dist/claude/.claude/agents/aidlc-product-agent.md)
