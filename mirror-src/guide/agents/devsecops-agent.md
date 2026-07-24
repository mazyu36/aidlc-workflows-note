# DevSecOps Agent

> **エージェント深掘り** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [深掘り](README.md) · 技術リファレンス: [devsecops-agent](../../reference/agents/devsecops-agent.md)

aidlc-devsecops-agent はあなたのセキュリティエンジニアである。セキュリティが最後に貼り付けられるのではなく、ライフサイクルのすべての phase に埋め込まれることを保証する。Ideation で特定されたコンプライアンス要件を受け取り、セキュリティコントロール・脅威モデル・スキャンパイプライン・ランタイム監視として実装する。アプリケーションセキュリティ、クラウドセキュリティ、パイプラインセキュリティをカバーする。

aidlc-compliance-agent と同様、aidlc-devsecops-agent は支援ロール専任で動く。Inception・Construction・Operation にまたがる 5 つの stage でセキュリティの専門性を提供する。セキュリティスキャンツールを実行するための Bash アクセスを持つ。

## リードする stage

aidlc-devsecops-agent はどの stage もリードしない。

## 支援する stage

| Stage | Phase | 貢献 |
|-------|-------|-------------|
| 2.2 Practices Discovery | Inception | 相互に盲目なセキュリティ practice のスポーク。自分の contribution ファイルを書く |
| 3.2 NFR Requirements | Construction | セキュリティコントロール、脅威モデル、STRIDE 分析 |
| 3.4 Infrastructure Design | Construction | IAM ポリシーのレビュー、セキュリティグループの検証 |
| 3.6 Build and Test | Construction | SAST/DAST スキャン、依存の脆弱性、IaC の lint |
| 4.2 Environment Provisioning | Operation | セキュリティ態勢の検証（Security Hub・Inspector・GuardDuty） |

## 期待できること

aidlc-devsecops-agent が（支援エージェントとして）アクティブなとき、攻撃面・信頼境界・セキュリティコントロールに集中する。設計をセキュリティのアンチパターンについてレビューし、機微なデータフローが暗号化されアクセス制御されていることを検証し、サードパーティ依存を既知の脆弱性について評価する。

## 協働のしかた

aidlc-devsecops-agent は aidlc-compliance-agent から規制要件を、aidlc-architect-agent からシステム設計を受け取る。セキュアコーディングの実践では aidlc-developer-agent と、インフラの堅牢化では aidlc-aws-platform-agent と、セキュリティテスト要件では aidlc-quality-agent と連携する。そのセキュリティ gate とスキャン設定は aidlc-pipeline-deploy-agent へ引き継がれる。

## 主要原則

- 多層防御 — 単一のセキュリティコントロールが単一障害点になってはならない
- あらゆる場所で最小権限 — すべてのユーザー・サービス・プロセスに必要最小限の権限
- 侵害を前提とする — 内部コンポーネント同士も認証・認可しなければならない
- 既定の設定はセキュアでなければならない
- すべての入力は検証されるまで敵対的で、すべての外部データはサニタイズされるまで汚染されている
- セキュリティは要件であり、先送りできる機能ではない
