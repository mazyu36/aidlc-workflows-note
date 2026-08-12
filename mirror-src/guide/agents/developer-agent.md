# Developer Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [developer-agent](../../reference/agents/developer-agent.md)

aidlc-developer-agent はあなたのシニアソフトウェア開発者である。アーキテクチャ設計と unit の仕様を、本番品質のコードへ翻訳する。リバースエンジニアリングでは、aidlc-architect-agent が統合する深いコードスキャンを実行する。

aidlc-developer-agent は Reverse Engineering のコードスキャンと Code Generation をリードし、Inception の両アンサンブルで dispatch される協働者でもある: Practices Discovery の hub-and-spoke ではコードパターンの証拠を検分し、User Stories の mob では実装可能性の声を担う。Code Generation は集中実行の subagent として走る。ビルドツール・パッケージマネージャ・テストコマンドを実行するための Bash アクセスを持つ。

Workspace Detection（0.2）はかつて aidlc-developer-agent が subagent としてリードしていたが、いまはルールベースのスキャナとして `aidlc-utility intent-create` の中で決定論的に実行される。aidlc-developer-agent はもう Initialization に関与しない。

## リードする stage

| Stage | Phase | 説明 |
|-------|-------|-------------|
| 2.1 Reverse Engineering（コードスキャン） | Inception | architect の統合に向けた構造化分析を生む深いコードスキャン |
| 3.5 Code Generation | Construction | 設計仕様から unit of work を実装（unit ごと） |

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 2.2 Practices Discovery | Inception | 相互に盲目なコードパターンのスポーク。自分の contribution ファイルを書く |
| 2.4 User Stories | Inception | mob アンサンブルでの実装可能性の声。自分の contribution ファイルを書く |
| 3.1 Functional Design | Construction | API 契約とデータモデルの入力 |
| 4.3 Deployment Execution | Operation | データベースマイグレーション |

## 期待できること

Code Generation の間、aidlc-developer-agent は subagent として走る — 直接対話することはない。進捗表示が見え、完了すると結果が見える。orchestrator はまずコード生成計画を承認のために提示し、その後 subagent が各手順を実装する。

アプリケーションコードは（intent の record dir ではなく）ワークスペースルートへ直接書かれる。intent の record dir にある `code-summary.md` 成果物が、何が作成・変更されたかを記録する。

## 協働のしかた

aidlc-developer-agent は aidlc-architect-agent から unit の仕様と設計パターンを、aidlc-quality-agent からテスト要件を受け取る。CDK/インフラの整合では aidlc-aws-platform-agent と、セキュアコーディングでは aidlc-devsecops-agent と連携する。そのコードスキャン結果は統合のために aidlc-architect-agent へ流れ、実装済みコードはテストのために aidlc-quality-agent へ引き継がれる。

## 主要原則

- 動作し、テストされた実装を届ける — リファクタリングは後続のイテレーションで
- プロジェクトの既存パターンと規約に従う
- 読みやすくデバッグしやすいコードを書く — 巧妙な抽象化を避ける
- 入力は早く検証し、意味のあるエラーを投げ、例外を決して握りつぶさない
- 生成されたすべての unit は少なくともハッピーパスのテストを含む
- リバースエンジニアリングでは、スキャンの徹底さが統合の品質を決める
