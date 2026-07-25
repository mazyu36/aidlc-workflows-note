# Operation phase — stage リファレンス (4.1-4.7)

## phase の概要

Operation phase は AI-DLC ライフサイクルの 5 つの phase のうち 5 番目である。Construction
からのビルド・テスト済みソフトウェアを受け取り、デプロイ・モニタリング・インシデントへの
備え・パフォーマンス検証・継続的な最適化へと進める。pipeline の設定、環境のプロビジョニング、
デプロイの実行、observability、インシデント対応、パフォーマンス検証、フィードバック収集に
またがる 7 つの stage（4.1 から 4.7）を扱う。

7 つの Operation stage はすべて **CONDITIONAL** である — scope と実行計画に基づいて実行される。
例えば mvp・poc・bugfix・refactor scope は Operation を完全にスキップする。infra と
security-patch scope はサブセット（デプロイと環境の stage）を実行する。

すべての stage は **inline** で実行される（Operation phase に subagent は無い）。すべての stage
は承認 gate・質問フォーマット・完了メッセージ・state トラッキングについて `stage-protocol.md`
に従う。

---

## stage サマリテーブル

| Stage | 名称                     | 実行        | 条件                                                                   | リード agent        | サポート agent      | モード                           |
|-------|--------------------------|-------------|------------------------------------------------------------------------|---------------------|---------------------|----------------------------------|
| 4.1   | Deployment Pipeline      | CONDITIONAL | CD pipeline の作成や大幅な変更が必要なときに実行                        | aidlc-pipeline-deploy-agent| (なし)             | inline                           |
| 4.2   | Environment Provisioning | CONDITIONAL | AWS 環境のプロビジョニングや検証が必要なときに実行                      | aidlc-aws-platform-agent  | aidlc-devsecops-agent, aidlc-compliance-agent     | inline                           |
| 4.3   | Deployment Execution     | CONDITIONAL | deployment pipeline と環境の準備が整った後に実行                       | aidlc-pipeline-deploy-agent| aidlc-developer-agent    | inline                           |
| 4.4   | Observability Setup      | CONDITIONAL | モニタリング・ダッシュボード・アラーム・トレーシングの設定が必要なときに実行 | aidlc-operations-agent    | (なし)              | inline                           |
| 4.5   | Incident Response        | CONDITIONAL | 運用 runbook とインシデント対応手順が必要なときに実行                    | aidlc-operations-agent | (なし)              | inline                           |
| 4.6   | Performance Validation   | CONDITIONAL | NFR のパフォーマンス目標を負荷下で検証する必要があるときに実行           | aidlc-quality-agent       | (なし)              | inline                           |
| 4.7   | Feedback & Optimization  | CONDITIONAL | 継続的な運用モニタリングと最適化が必要なときに実行                       | aidlc-operations-agent    | aidlc-aws-platform-agent  | inline                           |

### マルチエージェント stage

3 つの Operation stage が複数の agent を巻き込む:

- **4.2 Environment Provisioning**: aidlc-aws-platform-agent（lead）+ aidlc-devsecops-agent（セキュリティ態勢の検証）+ aidlc-compliance-agent（データレジデンシー、規制コントロール）
- **4.3 Deployment Execution**: aidlc-pipeline-deploy-agent（lead）+ aidlc-developer-agent（データベースマイグレーション）
- **4.7 Feedback & Optimization**: aidlc-operations-agent（lead）+ aidlc-aws-platform-agent（コスト最適化、ドリフト検出）

いずれの場合も、conductor はまず lead agent を呼び出し、続いて lead の出力をコンテキストと
して support agent を呼び出す。conductor がすべての委譲を行う; agent が互いを呼び出すことは
決して無い。

---

## Stage 4.1: Deployment Pipeline Configuration

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.1                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（deployment pipeline が既に存在し十分な場合はスキップ）                                 |
| リード agent      | aidlc-pipeline-deploy-agent                                                                             |
| support_agents    | (なし)                                                                                            |
| 入力              | Stage 3.7 からの CI pipeline 設定、Stage 3.4 からの infrastructure design                         |

### 目的

CD pipeline、デプロイ戦略、ロールバック手順、環境の promotion gate を設定する。

### 出力

| 成果物                            | 説明                                                             |
|-----------------------------------|------------------------------------------------------------------|
| cd-config.md                      | CD pipeline の設定                                               |
| deployment-strategy.md            | デプロイ戦略（blue/green、canary、rolling）、promotion gate       |
| rollback-runbook.md               | ロールバック手順と runbook                                       |
| deployment-pipeline-questions.md  | 回答付きの明確化質問                                             |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

---

## Stage 4.2: Environment Provisioning

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.2                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（環境が既にプロビジョニング済みの場合はスキップ）                                       |
| リード agent      | aidlc-aws-platform-agent                                                                                |
| support_agents    | aidlc-devsecops-agent（セキュリティ態勢の検証）、aidlc-compliance-agent（データレジデンシー、規制コントロール） |
| 入力              | Stage 3.4 からの infrastructure design、Stage 4.1 からの CD pipeline 設定                         |

### 目的

Construction からの Infrastructure as Code を用いて、対象の AWS 環境をプロビジョニングし検証する。aidlc-devsecops-agent はセキュリティ態勢を検証し、aidlc-compliance-agent はデータレジデンシーと規制コントロールを確認する。

### 出力

| 成果物                                | 説明                                                       |
|---------------------------------------|------------------------------------------------------------|
| environment-inventory.md              | プロビジョニングされた環境のインベントリ                    |
| validation-report.md                  | インフラの検証レポート、ヘルスチェック                      |
| environment-provisioning-questions.md | 回答付きの明確化質問                                        |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

---

## Stage 4.3: Deployment Execution

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.3                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（deployment pipeline と環境の準備が整った後に実行; 既にデプロイ済みの場合はスキップ）   |
| リード agent      | aidlc-pipeline-deploy-agent                                                                             |
| support_agents    | aidlc-developer-agent（データベースマイグレーション）                                                   |
| 入力              | Stage 4.1 からの CD pipeline 設定、Stage 4.2 からのプロビジョニング済み環境                        |

### 目的

実際のデプロイを実行する: 成果物を pipeline に通し、smoke test を実行し、ヘルスチェックを検証し、データベースマイグレーションを実行する。

### 出力

| 成果物                            | 説明                                                         |
|-----------------------------------|--------------------------------------------------------------|
| deployment-log.md                 | デプロイ実行ログ                                             |
| smoke-test-results.md             | デプロイ後の smoke test 結果                                 |
| health-check-report.md            | ヘルスチェック検証レポート                                   |
| deployment-execution-questions.md | 回答付きのデプロイ前チェック質問                             |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

---

## Stage 4.4: Observability Setup

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.4                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（observability が既に設定済みの場合はスキップ）                                         |
| リード agent      | aidlc-operations-agent                                                                                  |
| 入力              | Stage 3.3 からの NFR design、Stage 3.4 からの infrastructure design、デプロイ済みアプリケーション |

### 目的

モニタリング、ダッシュボード、アラーム、SLO/SLI トラッキング、ログクエリ、分散トレーシング、異常検出を設定する。

### 出力

| 成果物                            | 説明                                                           |
|-----------------------------------|----------------------------------------------------------------|
| dashboards.md                     | CloudWatch ダッシュボードの設定                                |
| alarms.md                         | severity・SNS ルーティング・エスカレーションを伴うアラーム定義   |
| slo-config.md                     | SLO/SLI トラッキングの設定                                     |
| log-queries.md                    | CloudWatch Logs Insights の保存済みクエリ                       |
| tracing-config.md                 | X-Ray トレーシングの設定                                       |
| anomaly-config.md                 | 異常検出の設定                                                 |
| observability-setup-questions.md  | 回答付きの明確化質問                                           |

### 補足

- Operation のどの stage よりも多くの成果物を生成する（6 つのコンテンツファイル + 質問）。
- AWS 固有（CloudWatch、X-Ray、SNS）だが、パターンは転用可能である。

---

## Stage 4.5: Incident Response & Runbook Generation

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.5                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（POC や非本番デプロイではスキップ）                                                     |
| リード agent      | aidlc-operations-agent                                                                                  |
| 入力              | Stage 4.4 からの observability setup、Stage 3.3 からの NFR design、Stage 3.4 からの infrastructure design |

### 目的

運用 runbook、インシデント対応計画、エスカレーション手順を生成する。

### 出力

| 成果物                            | 説明                                                           |
|-----------------------------------|----------------------------------------------------------------|
| runbooks.md                       | SSM Automation の runbook ライブラリ                           |
| incident-plan.md                  | インシデント対応計画（AWS Incident Manager 連携）              |
| escalation-matrix.md              | エスカレーション経路、オンコールローテーション、コミュニケーション手順 |
| incident-response-questions.md    | 回答付きの明確化質問                                           |

---

## Stage 4.6: Performance Validation & Load Testing

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.6                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（POC やパフォーマンスが重要でないアプリケーションではスキップ）                          |
| リード agent      | aidlc-quality-agent                                                                                     |
| 入力              | Stage 3.2 からの NFR requirements、Stage 3.3 からの NFR design、Stage 4.4 からの observability データ |

### 目的

デプロイ済みアプリケーションに対して NFR のパフォーマンス目標を検証するため、負荷テストを設計・実行する。

### 出力

| 成果物                                | 説明                                                       |
|---------------------------------------|------------------------------------------------------------|
| load-test-plan.md                     | シナリオ・ツール・設定を含む負荷テスト計画                  |
| test-results.md                       | パフォーマンステストの結果（レイテンシ、スループット、エラー率） |
| nfr-validation-matrix.md             | NFR 目標 対 実測の検証マトリクス                            |
| performance-validation-questions.md   | 回答付きの明確化質問                                        |

---

## Stage 4.7: Continuous Feedback & Optimization

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.7                                                                                               |
| Phase             | Operation                                                                                         |
| 実行              | CONDITIONAL（一度きりのデプロイではスキップ）                                                       |
| リード agent      | aidlc-operations-agent                                                                                  |
| support_agents    | aidlc-aws-platform-agent（コスト最適化、ドリフト検出）                                                  |
| 入力              | すべての Operation phase 成果物、本番モニタリングデータ                                             |

### 目的

SLO 遵守のレビュー、コスト最適化の分析、インフラのドリフト検出、運用インサイトの収集。これは AI-DLC ワークフロー全体の **最後の stage** である。

### 出力

| 成果物                                | 説明                                                       |
|---------------------------------------|------------------------------------------------------------|
| slo-report.md                         | SLO 遵守レポート、エラーバジェットのバーンレート            |
| cost-analysis.md                      | AWS Cost Explorer の分析、最適化の推奨                      |
| drift-report.md                       | AWS Config のドリフト検出レポート、Trusted Advisor のレビュー |
| feedback-loop.md                      | 運用インサイト、改善提案、次の Ideation サイクルへの入力     |
| feedback-optimization-questions.md    | 回答付きの明確化質問                                        |

### 承認 gate — 3 択（特有）

Stage 4.7 は **特有の 3 択の承認 gate** を持つ:

1. **Approve** — ワークフロー完了。AI-DLC ライフサイクル全体が終了する。
2. **Request Changes** — 修正のフィードバックを与える。
3. **Start New Ideation Cycle** — feedback-loop.md のインサイトを新しい Stage 1.1 へ還流する。

これは AI-DLC ライフサイクルの循環的な性質を反映している。

---

## phase のサマリ

**デプロイの stage（4.1-4.3）:**
- 4.1 Deployment Pipeline — CD pipeline 設定、デプロイ戦略、ロールバック runbook
- 4.2 Environment Provisioning — セキュリティ態勢のレビューを伴う AWS 環境のプロビジョニングと検証
- 4.3 Deployment Execution — 成果物のデプロイ、smoke test、ヘルスチェック、データベースマイグレーション

**運用準備の stage（4.4-4.6）:**
- 4.4 Observability Setup — ダッシュボード、アラーム、SLO、ログクエリ、トレーシング、異常検出
- 4.5 Incident Response — runbook、インシデント計画、エスカレーションマトリクス
- 4.6 Performance Validation — 負荷テスト、NFR 目標の検証、キャパシティプランニング

**継続的改善（4.7）:**
- 4.7 Feedback & Optimization — SLO 遵守、コスト分析、ドリフト検出、feedback loop

**Scope の適用可否:**
- enterprise / feature / workshop: 全 7 stage
- infra: Stage 4.1-4.4（deployment-pipeline, environment-provisioning, deployment-execution, observability-setup）
- security-patch: Stage 4.1, 4.3（deployment-pipeline, deployment-execution）
- mvp / poc / bugfix / refactor: Operation phase を完全にスキップ

## 関連

- [Orchestrator](../03-orchestrator.md) — ルーティングのロジック、scope マッピング
- [Stage Protocol](../04-stage-protocol.md) — 承認 gate、state トラッキング
- [Construction Stages](construction.md) — 前の phase
