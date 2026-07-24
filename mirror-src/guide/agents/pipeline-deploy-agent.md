# Pipeline & Deploy Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [pipeline-deploy-agent](../../reference/agents/pipeline-deploy-agent.md)

aidlc-pipeline-deploy-agent はあなたの CI/CD エンジニア兼リリースマネージャーである。ビルド仕様とインフラのターゲットを、品質 gate・ロールバックの安全性・完全な監査可能性を備えて、コミットから本番までを運ぶ完全自動のパイプラインへ翻訳する。

aidlc-pipeline-deploy-agent は Inception・Construction・Operation にまたがる 4 つの stage をリードする。パイプラインツール・デプロイスクリプト・スモークテストのコマンドを実行するための Bash アクセスを持つ。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 2.2 Practices Discovery | Inception | hub-and-spoke の発見の草稿・インタビュー・統合。承認された practices をアクティブ space の team/project memory へ昇格 |
| 3.7 CI Pipeline | Construction | 品質 gate 付きの CI パイプライン構成 |
| 4.1 Deployment Pipeline | Operation | デプロイ戦略とロールバック手順を備えた CD パイプライン |
| 4.3 Deployment Execution | Operation | デプロイの実行、スモークテスト、ヘルスの監視 |

## 支援する stage

aidlc-pipeline-deploy-agent は助言の立場でどの stage も支援しない。

## 期待できること

Practices Discovery では、aidlc-pipeline-deploy-agent がまず草稿を書き、人間へのインタビューの後に、相互に盲目な quality・developer・devsecops の contribution を統合する。デリバリー系の stage では、CI/CD 基盤・デプロイ先・ブランチ戦略・ロールバック要件を尋ね、パイプライン構成・デプロイ戦略・ロールバック runbook を生み、Deployment Execution を監視する。

## 協働のしかた

aidlc-pipeline-deploy-agent は aidlc-developer-agent からビルド可能なソースとテストスイートを、aidlc-quality-agent から品質 gate の定義を、aidlc-aws-platform-agent から環境のエンドポイントを受け取る。デプロイしたサービスは可観測性の整備のために aidlc-operations-agent へ引き継がれ、デプロイの成果物は性能検証のために aidlc-quality-agent へ渡る。

## 主要原則

- すべてのコミットはリリース候補である — 全 gate を通過したなら本番に出せる
- すべてのデプロイにはテスト済みのロールバック経路が要る
- CI パイプラインは時間ではなく分で完了すべき — 遅いパイプラインはバッチ化を招く
- 品質 gate は欠陥のある成果物がユーザーに届くのを防ぐために存在する
- スモークテストがサービスの健全性を確認するまで、デプロイは完了ではない
