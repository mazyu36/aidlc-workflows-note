# aidlc-devsecops-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-devsecops-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

この agent は lead stage を持たない。Inception・Construction・Operation phase の複数
stage にわたって、もっぱら support の役割で動作する。

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| practices-discovery | Practices Discovery | スキャン、シークレット取り扱い、secure-pipeline の所見を、自身の貢献ファイルに記録する、相互に blind な spoke |
| nfr-requirements | NFR Requirements | セキュリティコントロール仕様と脅威モデルの統合 |
| infrastructure-design | Infrastructure Design | IAM ポリシーのレビュー、セキュリティグループの検証、ネットワークセキュリティの評価 |
| build-and-test | Build and Test | SAST/DAST スキャンの構成、依存の脆弱性スキャン、IaC のセキュリティ linting |
| environment-provisioning | Environment Provisioning | セキュリティ態勢の検証（Security Hub、Inspector、GuardDuty、暗号化、CloudTrail、VPC Flow Logs） |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-compliance-agent | Ideation からの規制要件（制約レジスタ、RAID log） |
| aidlc-architect-agent | 脅威モデリングのためのシステム設計、コンポーネント境界 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-developer-agent | セキュアコーディング要件、脆弱性修正の仕様 |
| aidlc-quality-agent | 実行のためのセキュリティテストケース |
| aidlc-pipeline-deploy-agent | CI/CD pipeline 統合のためのセキュリティ gate |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-devsecops-agent/`

| ファイル | 内容 |
|------|---------|
| devsecops-pipeline-patterns.md | セキュリティ pipeline 統合のパターン（SAST、DAST、IaC スキャン） |
| nfr-requirements-guide.md | セキュリティ重視の NFR 要件の方法論 |
| security-guide.md | アプリケーションとクラウドのセキュリティの方法論 |
| threat-modelling-stride.md | STRIDE 脅威モデリングの方法論とテンプレート |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-devsecops-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
セキュリティ文脈 — 既存の脅威モデル、セキュリティポリシー、承認済みの
暗号化標準、ペネトレーションテストの所見など — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-devsecops-agent](../../guide/agents/devsecops-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-devsecops-agent.md`](../../../dist/claude/.claude/agents/aidlc-devsecops-agent.md)
