# aidlc-quality-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-quality-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| build-and-test | Build and Test | テスト戦略を定義し、テストスイートを生成し、カバレッジを受け入れ基準に照らして検証し、品質 gate を強制する |
| performance-validation | Performance Validation and Load Testing | 負荷テストを設計・実行し、NFR 目標を検証し、ボトルネックを特定し、キャパシティ計画の推奨を生む |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| practices-discovery | Practices Discovery | テスト態勢、カバレッジの下限、CI の block-or-warn の振る舞いを、自身の貢献ファイルに記録する、相互に blind な spoke |
| user-stories | User Stories | mob アンサンブルにおけるテスト容易性と受け入れ基準の声; 自身の貢献ファイルを書く |
| nfr-requirements | NFR Requirements | テスト可能な品質特性シナリオと、測定可能な NFR 目標を定義する |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-product-agent | テストケース導出のための、受け入れ基準付き user story |
| aidlc-architect-agent | NFR 目標、設計のテスト容易性評価、テスト境界 |
| aidlc-developer-agent | テスト用の実装コード |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-pipeline-deploy-agent | CI/CD へのテストスイート統合、品質 gate の定義 |
| aidlc-operations-agent | 本番監視のための性能ベースライン |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-quality-agent/`

| ファイル | 内容 |
|------|---------|
| nfr-reliability-guide.md | 信頼性テストの方法論とレジリエンス検証 |
| nfr-validation-methods.md | NFR 検証の手法（負荷テスト、性能プロファイリング） |
| test-strategy-patterns.md | テストピラミッドのパターン、テストデータ戦略、品質 gate の設計 |
| testing-guide.md | テストの方法論とテストケース設計の原則 |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-quality-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
QA 文脈 — 既存のテストフレームワーク、カバレッジ目標、性能
ベースライン、品質 gate の閾値など — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-quality-agent](../../guide/agents/quality-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-quality-agent.md`](../../../dist/claude/.claude/agents/aidlc-quality-agent.md)
