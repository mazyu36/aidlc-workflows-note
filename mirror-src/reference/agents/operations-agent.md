# aidlc-operations-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-operations-agent |
| Tier | **templated** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| observability-setup | Observability Setup | CloudWatch ダッシュボード、アラーム、X-Ray トレーシング、構造化ログ、カスタムメトリクスを構成する |
| incident-response | Incident Response | SSM runbook を著述し、重大度レベルを定義し、on-call 体制を確立し、chaos 実験を設計する |
| feedback-optimization | Feedback and Optimization | 本番メトリクスを分析し、洞察を Ideation へ還元し、インフラとアーキテクチャの改善を推奨する |

### 支援する stage

なし。stage グラフは performance-validation（4.6）に `support_agents: []` を記録する
— その stage は aidlc-quality-agent がリードする。この agent が observability-setup
（4.4）で立ち上げる運用テレメトリとベースラインは、性能検証に非公式に供給されるが、
operations は 4.6 の公式な support agent ではない。

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-aws-platform-agent | プロビジョニングされたインフラ、CloudWatch 名前空間、スケーリングポリシー |
| aidlc-pipeline-deploy-agent | デプロイされたサービス、デプロイのメタデータ |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-product-agent | 次の Ideation サイクルのための運用フィードバック（ライフサイクルの loop を閉じる） |
| aidlc-architect-agent | 本番の観察に基づくアーキテクチャ改善の推奨 |
| Orchestrator | イテレーション計画のためのフィードバックレポート |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-operations-agent/`

| ファイル | 内容 |
|------|---------|
| incident-response-guide.md | インシデント対応の方法論、重大度レベル、ポストモーテムのテンプレート |
| nfr-performance-guide.md | 性能監視と最適化の方法論 |
| observability-patterns.md | observability のパターン（ダッシュボード、アラーム、トレーシング、ロギング） |
| slo-sli-patterns.md | SLO/SLI 定義のパターン、error budget のポリシー |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-operations-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
運用文脈 — 既存の runbook、on-call スケジュール、SLO 目標、
監視ダッシュボードなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-operations-agent](../../guide/agents/operations-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-operations-agent.md`](../../../dist/claude/.claude/agents/aidlc-operations-agent.md)
