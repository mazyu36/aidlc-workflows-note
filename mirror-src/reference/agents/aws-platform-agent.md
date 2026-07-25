# aidlc-aws-platform-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-aws-platform-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| infrastructure-design | Infrastructure Design | アプリケーションアーキテクチャを、AWS サービスの選定、CDK/CloudFormation テンプレート、VPC 設計、IAM ポリシー、コスト見積もりへ翻訳する |
| environment-provisioning | Environment Provisioning | IaC 定義から dev/staging/production 環境を、drift 検出と環境の等価性を伴ってプロビジョニングする |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| feasibility | Feasibility and Constraint Analysis | AWS サービスの可用性、リージョンの制約、クラウドプラットフォームの制限を評価する |
| application-design | Application Design | クラウドネイティブなパターン、マネージドサービスの統合、サーバーレスの選択肢について助言する |
| nfr-design | NFR Design | NFR を、インフラ仕様、オートスケーリングポリシー、レジリエンス構成へ翻訳する |
| feedback-optimization | Feedback and Optimization | 本番メトリクスに基づいて、コスト最適化の機会とインフラのチューニングを特定する |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-architect-agent | アプリケーションのトポロジー、コンポーネントインベントリ、インフラ要件 |
| aidlc-devsecops-agent | セキュリティ要件、コンプライアンスコントロール、暗号化仕様 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-pipeline-deploy-agent | デプロイ先の環境エンドポイント、インフラの出力 |
| aidlc-operations-agent | observability セットアップと監視のためのプロビジョニング済みインフラ |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-aws-platform-agent/`

| ファイル | 内容 |
|------|---------|
| cdk-best-practices.md | AWS CDK の construct パターン、スタック構成、テスト |
| cost-optimization-patterns.md | FinOps のパターン、ライトサイジング、リザーブドインスタンス、Savings Plans |
| infrastructure-guide.md | インフラ設計の方法論と環境プロビジョニング |
| well-architected-framework.md | AWS Well-Architected Framework の 6 本の柱のリファレンス |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-aws-platform-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
インフラ文脈 — 既存の VPC 設計、AWS アカウント構造、
承認済みのサービスカタログ、コストベースラインなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-aws-platform-agent](../../guide/agents/aws-platform-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-aws-platform-agent.md`](../../../dist/claude/.claude/agents/aidlc-aws-platform-agent.md)
