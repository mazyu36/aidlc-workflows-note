# aidlc-delivery-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-delivery-agent |
| Tier | **templated** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| team-formation | Team Formation | 必要なスキルセットを評価し、mob チームを編成し、コミュニケーション規範を定義する |
| approval-handoff | Initiative Approval and Handoff | initiative brief をまとめ、完全性を検証し、ステークホルダー承認のために提示し、phase 引き継ぎを実行する |
| delivery-planning | Delivery Planning | Bolt シーケンスを計画し（units-generation stage の依存 DAG を通じた経済的な順序付け）、mob を割り当て、Bolt ごとの Definition of Done と確信の仮説を定義する |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| scope-definition | Scope Definition and Prioritization | scope を、delivery の実現性と利用可能なキャパシティに照らして検証する |
| units-generation | Units Generation | unit の粒度を、計画のニーズと delivery 順序付けの要件に整合させる |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-product-agent | scope、優先順位、initiative の枠組み、優先順位付き backlog |
| aidlc-architect-agent | unit、複雑度の見積もり、依存グラフ |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| すべての construction agent | delivery 計画、mob の割り当て、Bolt シーケンス |
| Orchestrator | phase gate 承認のための initiative brief |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-delivery-agent/`

| ファイル | 内容 |
|------|---------|
| mob-programming-guide.md | mob programming のパターン、役割（driver、navigator、researcher）、チーム構成 |
| team-topologies.md | チーム編成のパターンとコミュニケーション構造 |
| workflow-planning-guide.md | delivery 計画: 経済的 vs トポロジカルな順序付け、WSJF、walking skeleton、Bolt DoD のパターン |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-delivery-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
delivery 文脈 — チームの規約、bolt サイジングの好み、
組織のキャパシティ制約など — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-delivery-agent](../../guide/agents/delivery-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-delivery-agent.md`](../../../dist/claude/.claude/agents/aidlc-delivery-agent.md)
