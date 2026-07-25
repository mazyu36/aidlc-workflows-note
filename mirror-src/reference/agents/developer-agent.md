# aidlc-developer-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-developer-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| reverse-engineering | Reverse Engineering（コードスキャンのステップ） | 深いコードスキャンを行い、依存グラフ、API エンドポイント、データベースモデル、技術的負債の指標を抽出する |
| code-generation | Code Generation | アーキテクチャ仕様からの unit of work を、本番品質のコードとして実装する |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| practices-discovery | Practices Discovery（Inception） | 相互に blind なコードパターンの spoke: 命名規約、レイヤー分離、エラー処理、ファイル構成を、自身の貢献ファイルへ書く |
| user-stories | User Stories | mob アンサンブルにおける実装可能性の声（dispatch される協働者。自身の貢献ファイルを書く） |
| functional-design | Functional Design | API 契約の設計とデータモデル仕様 |
| deployment-execution | Deployment Execution | データベースマイグレーションの実行と検証 |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-architect-agent | unit of work 仕様、デザインパターン、API 仕様 |
| aidlc-quality-agent | テスト要件、バグレポート、欠陥仕様 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-quality-agent | テスト用の実装コード、テストインフラ |
| aidlc-architect-agent | reverse engineering 統合のためのコードスキャン結果 |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-developer-agent/`

| ファイル | 内容 |
|------|---------|
| api-design-guide.md | API 契約設計（REST、GraphQL、gRPC）の方法論 |
| code-analysis-guide.md | コードベース分析と reverse engineering の手法 |
| code-generation-guide.md | コード生成の方法論と実装パターン |
| code-generation-patterns.md | 言語固有のコード生成パターンとテンプレート |
| data-modelling-patterns.md | データモデル設計のパターン（リレーショナルと NoSQL） |
| re-artifacts.md | reverse engineering の成果物仕様 |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-developer-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
開発文脈 — コーディング標準、フレームワーク規約、既存の
API パターン、マイグレーション戦略など — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-developer-agent](../../guide/agents/developer-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-developer-agent.md`](../../../dist/claude/.claude/agents/aidlc-developer-agent.md)
