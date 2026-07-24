# Operations Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [operations-agent](../../reference/agents/operations-agent.md)

aidlc-operations-agent はあなたのサイトリライアビリティエンジニア兼インシデントマネージャーである。デプロイされたシステムが可観測で、レジリエントで、継続的に改善されることを保証する。CloudWatch のダッシュボードとアラームから、X-Ray トレーシング、SLO 追跡、インシデント対応の runbook、カオスエンジニアリングによる検証まで、運用の層を所有する。決定的に重要なのは、本番の洞察を次のイテレーションの Ideation へ還流してフィードバックループを閉じることである。

aidlc-operations-agent は Operation phase の 3 つの stage をリードする。監視のセットアップコマンド・runbook スクリプト・診断ツールを実行するための Bash アクセスを持つ。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 4.4 Observability Setup | Operation | ダッシュボード、アラーム、トレーシング、構造化ログ、カスタムメトリクス |
| 4.5 Incident Response | Operation | SSM runbook、インシデント計画、エスカレーションマトリクス、オンコール体制 |
| 4.7 Feedback & Optimization | Operation | SLO レポート、コスト分析、ドリフト検出、フィードバックループ |

4.6 Performance Validation は aidlc-quality-agent がリードする。このエージェントが 4.4 で整備する運用テレメトリとベースラインは非公式にその作業へ流れるが、4.6 の正式な支援エージェントではない。

## 支援する stage

なし。aidlc-operations-agent はリード専任のエージェントである — 他のエージェントの stage を支援しない。リードはすべて Operation にあり、そこでライフサイクルのループを閉じる。

## 期待できること

aidlc-operations-agent がアクティブなとき、監視の選好、SLO 目標、インシデント対応プロセス、オンコール体制を尋ねる。CloudWatch のダッシュボード設定、閾値と通知先を持つアラーム定義、X-Ray トレーシングのセットアップ、よくあるシナリオ（サービス再起動・キャッシュのフラッシュ・フェイルオーバー）の SSM runbook、エスカレーション経路付きのインシデント重大度定義を生む。

Feedback & Optimization（最終 stage）では、本番メトリクスを分析し、最適化の機会を特定し、運用の洞察を次の開発サイクルのために aidlc-product-agent へ還流するフィードバックループ文書を生む。

## 協働のしかた

aidlc-operations-agent は aidlc-aws-platform-agent からプロビジョニング済みのインフラを、aidlc-pipeline-deploy-agent からデプロイ済みのサービスを受け取る。性能のベースラインと SLO の検証では aidlc-quality-agent と、アプリケーションレベルのログ改善では aidlc-developer-agent と連携する。そのフィードバックレポートが Operation から Ideation へ戻る橋であり、ライフサイクルのループを完成させる。

## 主要原則

- テレメトリは包括的に集めるが、アラートはユーザー影響のある問題だけに出す — アラート疲れは対応力を落とす
- SLO が信頼性の目標を定義する。他のすべてはそこから導かれる
- すべてのインシデントは学びの機会である — 非難なしのポストモーテムがインシデントを改善に変える
- テストされていないレジリエンス機構は仮定にすぎない — カオスエンジニアリングがそれを検証する
- Ideation へ還流しない本番の洞察は、無駄になった学びである
- 手作業の運用トイルは根絶する — 繰り返し可能な runbook の手順はすべて自動化する
