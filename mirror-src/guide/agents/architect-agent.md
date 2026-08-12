# Architect Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [architect-agent](../../reference/agents/architect-agent.md)

aidlc-architect-agent はあなたのソリューションアーキテクトである。要件を堅牢なシステムアーキテクチャへ翻訳し、Architecture Decision Record（ADR）を作り、ドメインモデルを設計し、プロジェクトを実装可能な unit of work に分解する。パターンとトレードオフで考え、開発者が直接実装できる設計を生む。

aidlc-architect-agent は、ライフサイクルの単一エージェントとして最多の stage — 計 6 つ、Ideation・Inception・Construction にまたがる — をリードする。設計の第一の権威であり、他の 7 つの高判断エージェントとともに `judgment` tier を持つため、特定のモデルを固定せず、セッション自身のモデルと effort を継承する。`templated` tier（Claude Code・Codex・opencode では中型モデル + 低めの effort。Kiro・Cursor・Copilot では全 tier がセッションのモデルと effort を継承）を持つのは delivery・pipeline-deploy・operations だけである。その出力が支配的に定型だからだ。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | Ideation | 技術的実現性の評価と制約の分析 |
| 2.6 Application Design | Inception | コンポーネント設計、API 契約、ADR |
| 2.7 Units Generation | Inception | 設計を実装可能な unit of work に分解 |
| 3.1 Functional Design | Construction | 詳細なドメインモデルとビジネスロジック（unit ごと） |
| 3.2 NFR Requirements | Construction | 測定可能な目標を持つ非機能要件（unit ごと） |
| 3.3 NFR Design | Construction | キャッシュ・レジリエンス・セキュリティの技術的アプローチ（unit ごと） |

stage 2.1（Reverse Engineering）の統合ステップもリードし、aidlc-developer-agent からコードスキャン結果を受け取って 9 つのアーキテクチャ成果物を生む。

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 1.1 Intent Capture | Ideation | 技術的文脈の提供 |
| 2.1 Reverse Engineering（dispatch される最終 pipeline リンク） | Inception | コードスキャン結果を一貫したアーキテクチャモデルへ統合 |
| 2.8 Delivery Planning | Inception | ビルド順序をアーキテクチャの依存関係に照らして検証 |

## 期待できること

aidlc-architect-agent がアクティブなとき、境界・パターン・トレードオフに集中する。既存システムの制約、技術の選好、スケーラビリティ要件、運用上の関心を尋ねる。明示的な決定根拠を持つ構造化された設計文書、markdown で記述されたコンポーネント図、重要な選択ごとの ADR を生む。

## 協働のしかた

aidlc-architect-agent は aidlc-product-agent から要件を、aidlc-developer-agent からコードスキャン結果を受け取る。AWS サービスへの対応付けでは aidlc-aws-platform-agent と、セキュアな設計では aidlc-devsecops-agent と、規制の制約では aidlc-compliance-agent と連携する。その出力（unit 仕様・API 契約・NFR 目標）は aidlc-developer-agent・aidlc-quality-agent・aidlc-aws-platform-agent が消費する。

## 主要原則

- すべての設計成果物は、明示的な根拠を持つ決定へ追跡できなければならない
- コンポーネント境界を正しく引くことは、内部の詳細より重要である
- コンポーネント間の依存は積極的に最小化する
- 再利用のためではなく変化のために設計する — 変更容易性に最適化する
- 隠れた仮定を明示する — データフロー・所有権・故障モードを表に出す
- 可逆な決定を選ぶ。不可逆な決定には追加の精査のフラグを付ける
