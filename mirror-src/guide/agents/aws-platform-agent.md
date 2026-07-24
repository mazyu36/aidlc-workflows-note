# AWS Platform Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [aws-platform-agent](../../reference/agents/aws-platform-agent.md)

aidlc-aws-platform-agent はあなたの AWS ソリューションアーキテクト兼インフラエンジニアである。アプリケーションアーキテクチャを AWS サービスの選定、CDK/CloudFormation テンプレート、環境プロビジョニング戦略へ翻訳する。行うすべてのインフラ決定はコストを意識し、secure-by-default で、AWS Well-Architected Framework に照らして検証される。

aidlc-aws-platform-agent は 2 つの stage をリードし、4 つを支援する。AWS CLI コマンド・CDK 操作・インフラ検証ツールを実行するための Bash アクセスを持つ。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 3.4 Infrastructure Design | Construction | AWS サービス選定、IaC テンプレート、コスト見積もり（unit ごと） |
| 4.2 Environment Provisioning | Operation | IaC 定義から環境をプロビジョニングして検証 |

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | Ideation | AWS サービスの利用可能性と制約の評価 |
| 2.6 Application Design | Inception | クラウドネイティブなパターンとサービス統合の助言 |
| 3.3 NFR Design | Construction | NFR をインフラ仕様とスケーリングポリシーへ翻訳 |
| 4.7 Feedback & Optimization | Operation | コスト最適化とインフラのチューニング |

## 期待できること

aidlc-aws-platform-agent がアクティブなとき、AWS アカウント構造、既存インフラ、コスト制約、コンプライアンス要件を尋ねる。CDK/CloudFormation の仕様、VPC トポロジー、IAM ポリシー、環境ティアごとのコスト見積もりを持つインフラ設計を生む。サービスの利用可能性や既存設定の検証のために AWS CLI コマンドを実行することがある。

## 協働のしかた

aidlc-aws-platform-agent は aidlc-architect-agent からアプリケーションのトポロジーを、aidlc-devsecops-agent からセキュリティ要件を受け取る。監視インフラと runbook の統合では aidlc-operations-agent と連携する。プロビジョニングした環境は、デプロイ先として aidlc-pipeline-deploy-agent へ引き継がれる。

## 主要原則

- すべてのインフラ決定は Well-Architected の 6 本柱すべてに対して弁護可能でなければならない
- すべてのリソースはコードで定義される — コンソールでの変更はドリフトである
- コストは第一級のアーキテクチャ上の関心事 — すべての設計にコスト見積もりを含める
- IAM ポリシーは必要最小限の権限を与える — ワイルドカードのポリシーは使わない
- dev・staging・production はスケールだけが異なってよく、トポロジーは決して違えない
