# Compliance Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [compliance-agent](../../reference/agents/compliance-agent.md)

aidlc-compliance-agent はあなたの GRC（ガバナンス・リスク・コンプライアンス）アナリストである。ライフサイクルのすべての stage が、適用される規制上の義務と組織のコンプライアンスポリシーを織り込むことを保証する。規制要件を早期にスキャンし、技術的コントロールへ対応付け、コンプライアンスリスクの RAID ログを維持し、設計が監査の期待を満たすことを検証する。

aidlc-compliance-agent は支援ロール専任で動く — リードする stage は無い。代わりに、Ideation・Construction・Operation にまたがる 4 つの stage でコンプライアンスの専門性を提供する。

## リードする stage

aidlc-compliance-agent はどの stage もリードしない。

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | Ideation | 規制上の制約の特定、コンプライアンスの実現性、RAID ログの初期化 |
| 3.2 NFR Requirements | Construction | 規制 NFR の対応付け、コンプライアンスコントロール要件、データ分類 |
| 3.4 Infrastructure Design | Construction | データ所在地の検証、暗号化要件、IAM のコンプライアンスコントロール |
| 4.2 Environment Provisioning | Operation | コンプライアンスコントロールの検証、監査ログ、規制設定のチェック |

## 期待できること

aidlc-compliance-agent が（リードと並ぶ支援エージェントとして）アクティブなとき、規制フレームワーク・データ分類・コントロールの対応付けに集中する。適用される規制（GDPR・HIPAA・PCI-DSS・SOC 2）、データの機微度、既存のコンプライアンスポリシーを尋ねる。コンプライアンスコントロールのマトリクスを生み、是正が必要なギャップにフラグを立てる。

## 協働のしかた

aidlc-compliance-agent は aidlc-architect-agent からシステム設計とデータフローの情報を、aidlc-devsecops-agent からセキュリティコントロールの詳細を受け取る。設計へ織り込むためのコンプライアンス要件と制約を aidlc-architect-agent へ、実装のためのセキュリティコントロール仕様を aidlc-devsecops-agent へ返す。

## 主要原則

- コンプライアンスは制約であり、後付けではない — リリース時に発覚するギャップはプロジェクトの失敗である
- データ分類がすべてのコントロール判断を駆動する
- コンプライアンスの主張には監査可能な証拠が要る — 証明の無いコントロールは存在しない
- 是正は最も機微なデータと、最も罰則の重い規制に集中させる
- 規制リテラシーはチームスポーツである — aidlc-compliance-agent が教育し、チームが実行する
