# Quality Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [quality-agent](../../reference/agents/quality-agent.md)

aidlc-quality-agent はあなたの QA エンジニア兼パフォーマンススペシャリストである。テスト戦略を定義し、テストスイート（単体・統合・契約・セキュリティ）を生成し、受け入れ基準に対するカバレッジを検証し、負荷テストを設計・実行し、非機能要件の目標を検証する。実装されたすべての unit が受け入れ基準を満たし、システム全体が品質 gate を満たすことを保証する。

aidlc-quality-agent は 2 つの stage — Construction と Operation に 1 つずつ — をリードし、さらに 3 つの stage を支援する。ビルドツール・テストコマンド・性能テストユーティリティを実行するための Bash アクセスを持つ。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 3.6 Build and Test | Construction | ビルドの実行、テストスイートの生成と実行、品質 gate の検証 |
| 4.6 Performance Validation | Operation | 負荷テスト、NFR 検証マトリクス、キャパシティ計画 |

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 2.2 Practices Discovery | Inception | 相互に盲目なテスト姿勢のスポーク。自分の contribution ファイルを書く |
| 2.4 User Stories | Inception | mob でのテスト可能性・受け入れ基準の声。自分の contribution ファイルを書く |
| 3.2 NFR Requirements | Construction | テスト可能な品質特性シナリオの定義 |

## 期待できること

aidlc-quality-agent がアクティブなとき、ビルド手順とテストスイートを生成し、実装済みコードに対して実行する。Build and Test では、プロジェクトのビルドシステムを走らせ、単体テスト・統合テスト・プロジェクトに適したその他のテスト種別を実行する。合否の結果、カバレッジのメトリクス、品質 gate の状態を報告する。

Operation phase の Performance Validation では、負荷テストを設計・実行し、NFR 目標（レイテンシのパーセンタイル・スループット・可用性）を検証し、目標と実測を比べる NFR 検証マトリクスを生む。

## 協働のしかた

aidlc-quality-agent は aidlc-product-agent から受け入れ基準付きのユーザーストーリーを、aidlc-architect-agent から NFR 目標を、aidlc-developer-agent から実装済みコードを受け取る。セキュリティテスト要件では aidlc-devsecops-agent と、CI 統合では aidlc-pipeline-deploy-agent と連携する。テスト結果と性能のベースラインは aidlc-operations-agent へ引き継がれる。

## 主要原則

- 実装ではなく要件をテストする
- テストピラミッドに従う: 多くの速い単体テスト、より少ない統合テスト、最小限の end-to-end テスト
- 欠陥を見つけたら、直す前にそれを再現するテストを書く
- テストは実行順序や共有状態に依存してはならない
- カバレッジは指針であってゴールではない — 考え抜かれた 70% は無意味なアサーションの 100% に勝る
