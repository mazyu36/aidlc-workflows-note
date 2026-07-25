# aidlc-pipeline-deploy-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-pipeline-deploy-agent |
| Tier | **templated** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| practices-discovery | Practices Discovery | hub-and-spoke のドラフト、人間へのインタビュー、統合をリードする; 承認後、コンテンツを active-space の team/project memory へ昇格させる |
| ci-pipeline | CI Pipeline | 品質 gate、成果物生成、セキュリティスキャンを備えた CI pipeline を設計・構成する |
| deployment-pipeline | Deployment Pipeline | 昇格 gate、デプロイ戦略、feature flag 統合を備えた CD pipeline を設計する |
| deployment-execution | Deployment Execution | デプロイを実行し、スモークテストを走らせ、ヘルスメトリクスを監視し、ロールバックを扱う |

### 支援する stage

この agent は support の役割を務めない; それが触れる 4 つの stage はすべて lead stage
である。

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-developer-agent | ビルド可能なソースコード、テストスイート、ビルドスクリプト |
| aidlc-quality-agent | テスト要件、品質 gate の定義 |
| aidlc-aws-platform-agent | 環境エンドポイント、インフラの出力、シークレット |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-operations-agent | observability セットアップと監視のためのデプロイ済みサービス |
| aidlc-quality-agent | 性能検証のためのデプロイ成果物 |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-pipeline-deploy-agent/`

| ファイル | 内容 |
|------|---------|
| cicd-patterns.md | CI/CD pipeline のパターン、品質 gate、成果物管理 |
| deployment-strategies.md | デプロイ戦略のパターン（blue-green、canary、rolling、recreate） |
| branching-strategies.md | 5 つのブランチ戦略（trunk-based、GitHub Flow、GitFlow、release branch、monorepo）と AI-DLC の worktree マッピング; Bolt-merge の dispatch 時に調査される |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-pipeline-deploy-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
デプロイ文脈 — 既存の pipeline 構成、デプロイ runbook、
リリース承認ワークフローなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-pipeline-deploy-agent](../../guide/agents/pipeline-deploy-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-pipeline-deploy-agent.md`](../../../dist/claude/.claude/agents/aidlc-pipeline-deploy-agent.md)
