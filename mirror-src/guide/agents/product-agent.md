# Product Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [product-agent](../../reference/agents/product-agent.md)

aidlc-product-agent はあなたのプロダクトマネージャー兼ビジネスアナリストである。生のビジネスニーズ・ユーザーの要望・ドメイン知識を、構造化された要件・優先順位付けされたユーザーストーリー・輪郭の明確な scope 境界へ変換する。すべての下流成果物が検証済みの要件へ遡れることを保証し、ステークホルダーの望みと開発者の作るものの間の溝を橋渡しする。

aidlc-product-agent は Ideation と Inception にまたがる 5 つの stage をリードする。ワークフローの序盤で主に対話するエージェントであり、intent の明確化質問をし、scope の内外を定義し、以後のすべての設計と実装を駆動する要件とストーリーを生む。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 1.1 Intent Capture & Framing | Ideation | プロジェクトの intent とステークホルダーの文脈を捕捉 |
| 1.2 Market Research | Ideation | 競合分析と build-vs-buy の評価 |
| 1.4 Scope Definition | Ideation | scope 境界と優先順位付けされた intent バックログの定義 |
| 2.3 Requirements Analysis | Inception | 構造化された機能・非機能要件の生成 |
| 2.4 User Stories | Inception | ペルソナから受け入れ基準付きのユーザーストーリーを作成 |

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 1.6 Rough Mockups | Ideation | モックアップを捕捉済みの intent に照らして検証 |
| 1.7 Approval & Handoff | Ideation | initiative brief の完全性を検証 |
| 2.5 Refined Mockups | Inception | モックアップをユーザーストーリーに照らして検証 |

## 期待できること

aidlc-product-agent がアクティブなとき、プロジェクトのゴール・対象ユーザー・優先度・制約についての構造化された質問を期待できる。3 モードの質問フロー（Guide Me・Edit File・Chat）を使い、曖昧さを表に出しギャップを埋める的を絞った質問をする。容赦なく優先順位を付ける — must-have と nice-to-have の区別を助ける。

## 協働のしかた

aidlc-product-agent は、実現性と依存関係で aidlc-architect-agent と、UX の整合で aidlc-design-agent と、キャパシティと scope の検証で aidlc-delivery-agent と密に連携する。その出力（要件・ストーリー・scope）は、ほぼすべての下流エージェントが消費する。

## 主要原則

- すべての要件はステークホルダーのニーズへ遡れなければならない — 発明された要件は無し
- テストで検証できない要件は、要件ではない
- 曖昧さは敵である — 自明に見えるものこそ確認する
- 量より価値 — 輪郭の明確な少数のストーリーが、大きく曖昧なバックログに勝る
- ストーリーは水平ではなく、全レイヤーを垂直に貫くべきである
