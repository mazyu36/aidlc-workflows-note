# aidlc-compliance-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-compliance-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, WebSearch, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

この agent は lead stage を持たない。ライフサイクル全体を通じて、もっぱら support
および助言の立場で動作する。

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| feasibility | Feasibility and Constraint Analysis | 規制上の制約の特定、コンプライアンス実現性の評価、RAID log の初期化 |
| nfr-requirements | NFR Requirements | コンプライアンス駆動の非機能要件とコントロール仕様 |
| infrastructure-design | Infrastructure Design | データレジデンシーの検証、暗号化要件、IAM audit |
| environment-provisioning | Environment Provisioning | プロビジョニングされた環境のコンプライアンス態勢の検証 |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-architect-agent | コンプライアンスレビューのためのシステム設計、データフロー図 |
| aidlc-devsecops-agent | コンプライアンスマッピングのためのセキュリティコントロール、暗号化仕様 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-architect-agent | 設計に組み込むためのコンプライアンス要件 |
| aidlc-devsecops-agent | 規制上の要請から導出されるセキュリティコントロール仕様 |
| Orchestrator | コンプライアンスリスクのエスカレーション、RAID log の更新 |

### 連携する相手（peer）

| Peer | 共有する関心事 |
|------|----------------|
| aidlc-aws-platform-agent | データレジデンシー、保存時の暗号化、IAM audit |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-compliance-agent/`

| ファイル | 内容 |
|------|---------|
| regulatory-frameworks.md | 主要な規制フレームワーク（PCI-DSS、HIPAA、SOC 2、GDPR）のリファレンス |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-compliance-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
コンプライアンス文脈 — 既存のコンプライアンスマトリクス、audit の所見、データ
分類スキーム、規制の解釈など — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-compliance-agent](../../guide/agents/compliance-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-compliance-agent.md`](../../../dist/claude/.claude/agents/aidlc-compliance-agent.md)
