# aidlc-design-agent -- 技術リファレンス

## 識別情報

| フィールド | 値 |
|-------|-------|
| 名称 | aidlc-design-agent |
| Tier | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, WebSearch, AskUserQuestion |
| 禁止される Claude Code ツール | Task |

---

## Stage の担当

### リードする stage

| Stage | 名称 | この agent の役割 |
|-------|------|----------------------|
| rough-mockups | Rough Mockups and Concept Visualization | Ideation の間に、低忠実度のワイヤーフレーム、コンセプトスケッチ、初期の情報アーキテクチャを作る |
| refined-mockups | Refined Mockups and UX Design | ワイヤーフレームを、インタラクション仕様、レスポンシブデザイン、アクセシビリティ注釈を備えた中〜高忠実度のモックアップへ発展させる |

### 支援する stage

| Stage | 名称 | この agent の貢献 |
|-------|------|-----------------------------|
| user-stories | User Stories | story を、インタラクションの詳細と UX 受け入れ基準で拡充する |
| application-design | Application Design | UI コンポーネント仕様と、デザインシステムのマッピングを貢献する |

---

## 協働パターン

### 受け取り元

| 供給元 | 成果物 |
|--------|-----------|
| aidlc-product-agent | user story、persona、intent、ユーザージャーニーの文脈 |
| aidlc-architect-agent | コンポーネント設計の制約、UI に影響する技術の制限 |

### 引き継ぎ先

| 受け渡し先 | 成果物 |
|--------|-----------|
| aidlc-developer-agent | 実装のためのインタラクション仕様、コンポーネント仕様 |
| aidlc-quality-agent | テストのための UX 受け入れ基準、アクセシビリティ要件 |

---

## Knowledge ソース

### 方法論（Tier 1）

パス: `.claude/knowledge/aidlc-design-agent/`

| ファイル | 内容 |
|------|---------|
| accessibility-wcag.md | WCAG 2.1 AA のガイドラインと実装パターン |
| component-spec-template.md | コンポーネント仕様（状態、props、振る舞い）を文書化するテンプレート |
| interaction-design-patterns.md | ナビゲーション、フォーム、フィードバック、状態遷移のインタラクションパターン |
| ux-guide.md | UX デザインの方法論と原則 |
| wireframing-guide.md | 低忠実度・高忠実度のワイヤーフレーミング手法 |

### チーム（Tier 2）

パス: `aidlc/knowledge/aidlc-design-agent/`（space レベルの knowledge dir。user 管理）

チームがコンテンツを持つときに作る space レベルのディレクトリ（engine は `aidlc/knowledge/` を空で出荷する）。チームがプロジェクト固有の
デザインアセット — 既存のデザインシステム、ブランドガイドライン、タイポグラフィの
ルール、コンポーネントライブラリなど — を投入する。

---

## 関連リンク

- [Agent リファレンス概要](README.md)
- [Agent ガイド: aidlc-design-agent](../../guide/agents/design-agent.md)
- [Stage ドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-design-agent.md`](../../../dist/claude/.claude/agents/aidlc-design-agent.md)
