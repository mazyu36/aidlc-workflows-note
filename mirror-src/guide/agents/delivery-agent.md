# Delivery Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [delivery-agent](../../reference/agents/delivery-agent.md)

aidlc-delivery-agent はあなたのエンジニアリングマネージャー兼デリバリープランナーである。scope 定義とアーキテクチャ設計を、チーム割り当て・ビルド順序・シーケンシングを伴う実行可能なデリバリー計画へ翻訳する。Ideation を Construction へ橋渡しする initiative brief を所有し、完全なトレーサビリティを伴う滑らかな phase の引き継ぎを保証する。

aidlc-delivery-agent は Ideation と Inception にまたがる 3 つの stage をリードする。設計されたものが実際に届けられるか、どの順序で届けるかに責任を持つエージェントである。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 1.5 Team Formation | Ideation | 必要スキルを評価し、チーム構造を編成 |
| 1.7 Approval & Handoff | Ideation | phase gate の承認に向けて initiative brief をまとめる |
| 2.8 Delivery Planning | Inception | Bolt の順序（2.7 の DAG を通した経済的な順序付け）を、チーム割り当て・リスク / 順序の根拠・外部依存マップとともに計画 |

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 1.4 Scope Definition | Ideation | scope をデリバリーの実現性に照らして検証 |
| 2.7 Units Generation | Inception | unit の粒度を計画のニーズに整合させる |

## 期待できること

aidlc-delivery-agent がアクティブなとき、順序付けと実現性に集中する。チームの規模、利用可能な専門性、デリバリーの選好を尋ねる。unit of work をビルド順序へ対応付け、クリティカルパスを特定し、進行を塞ぎうる依存にフラグを立てる構造化された計画を生む。

## 協働のしかた

aidlc-delivery-agent は aidlc-product-agent から scope と優先度を、aidlc-architect-agent から unit の仕様と複雑度の見積もりを受け取る。そのデリバリー計画は、ビルド順序とチーム割り当てを理解するためにすべての Construction エージェントが消費する。

## 主要原則

- 計画は生きた文書である — 変えられない計画は失敗する
- 小さなバッチ、速いフィードバック — 小さな増分ほどリスクを早く表に出す
- すべての unit of work は要件へ遡れなければならない
- phase の遷移には明示的な完全性チェックが要る
- 確信は Bolt ごとに獲得する — 出荷された各 Bolt が次の Bolt のリスクを下げる
