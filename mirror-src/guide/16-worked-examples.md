# 実例集

AI-DLC の実際の動きを示す 2 つの完全なウォークスルー: bugfix と feature。それぞれコマンドの呼び出し、stage の進行、承認 gate、成果物の出力を示す。

> **Harness に関する注記。** これらの記録は **Claude Code** で採られたもので、その
> サーフェス — `/aidlc` と、`Task` 呼び出しで dispatch される subagent の stage — を示す。
> stage のフロー・gate・成果物はどの harness でも同一で、異なるのは dispatch の機構だけ
> である（Kiro は `subagent` ツール、Codex は `codex exec` のワーカーを使う）。
> [他の harness で動かす](harnesses/README.md) を参照。

---

## Bugfix のウォークスルー

この例はユーザープロフィール API の null ポインタ例外を直す。**bugfix** scope は 7 stage（Initialization 3 + ドメイン 4）を Minimal depth で走らせる。

### 呼び出し

```
/aidlc bugfix
```

conductor が何を直したいかを尋ねる:

> **What would you like to build?**

あなたはこう答える:

> The user profile API returns HTTP 500 when the `display_name` field is null. The `GET /api/v1/users/:id/profile` endpoint crashes with a NullPointerException in `ProfileSerializer.serialize()`. This affects about 12% of user profiles created before display_name was made mandatory.

### 実行される stage

| # | Stage | Phase | リードエージェント | モード |
|---|-------|-------|------------|------|
| 0.1 | Workspace Scaffold | Initialization | orchestrator | inline（自動進行） |
| 0.2 | Workspace Detection | Initialization | orchestrator | inline（自動進行） |
| 0.3 | State Init | Initialization | orchestrator | inline（自動進行） |
| 2.1 | Reverse Engineering | Inception | aidlc-developer-agent + aidlc-architect-agent | pipeline |
| 2.3 | Requirements Analysis | Inception | aidlc-product-agent | inline |
| 3.5 | Code Generation | Construction | aidlc-developer-agent | subagent |
| 3.6 | Build and Test | Construction | aidlc-quality-agent | inline |

### Initialization（stage 0.1-0.3）— 自動進行

3 つの Initialization stage は単一の決定論的ツール呼び出し（`aidlc-utility intent-birth`）として、ユーザーの対話なしに 1 秒未満で走る:

- **0.1 Workspace Scaffold** — 最初の intent を自動 birth し、record dir を `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`（以下 `<record>/` と表記）に作成する — `<YYMMDD>` は記録が時系列に並ぶコンパクトな UTC 日付プレフィクス、`<label>` は conductor が付ける要望の短いケバブケースの本質で、正準の id は `intents.json` レジストリ行が運ぶ UUIDv7 である
- **0.2 Workspace Detection** — ルールベースのスキャンが Java 17・Spring Boot 3.2・Maven・brownfield プロジェクトを特定する
- **0.3 State Init** — scope `bugfix`、depth `Minimal`、実行対象の印が付いたドメイン stage で `aidlc-state.md` を初期化する

> Progress: 3/7 overall | 3/3 INITIALIZATION stages complete. Next: Reverse Engineering

### Stage 2.1 — Reverse Engineering

2 リンクの pipeline がコードベースをスキャンする: まず aidlc-developer-agent のコードスキャン、次に成果物を書き出す aidlc-architect-agent の統合。リポジトリのための 9 つの永続成果物を `aidlc/spaces/default/codekb/user-service/` に生み出す:

| 成果物 | 内容 |
|----------|----------|
| `business-overview.md` | ユーザーサービス — プロフィール、設定、認証トークン |
| `architecture.md` | Spring Boot モノリス、3 層設計 |
| `code-structure.md` | 6 パッケージ: controller・service・model・repository・serializer・config |
| `api-documentation.md` | `/api/v1/users/` 配下の 8 つの REST エンドポイント |
| `component-inventory.md` | controller・service・repository・serializer の目録 |
| `technology-stack.md` | Java 17、Spring Boot 3.2、PostgreSQL 15、Jackson 2.15 |
| `dependencies.md` | Maven の依存ツリー、サードパーティライブラリ、バージョン制約 |
| `code-quality-assessment.md` | テストカバレッジ 62%、基本的な CI |
| `reverse-engineering-timestamp.md` | いつ・どのコミットに対してスキャンが走ったか |

**承認 gate:**

```
Reverse Engineering complete. How would you like to proceed?
- Approve        -> Continue to Requirements Analysis
- Request Changes -> Provide revision feedback
```

**Approve** を選ぶ。

### Stage 2.3 — Requirements Analysis

aidlc-product-agent ペルソナが読み込まれ、`<record>/inception/requirements-analysis/requirements-analysis-questions.md` に明確化質問を作る:

```markdown
## Q1: Bug Severity Classification
How severe is this bug for your users?
A. Critical — causes data loss or security exposure
B. High — blocks a core workflow for affected users
C. Medium — degraded experience but workaround exists
D. Low — cosmetic or minor inconvenience
X. Other (please specify)

[Answer]:
```

conductor が対話モードを提案する:

```
How would you like to answer these questions?
- Guide me        -> Walk through each question interactively
- I'll edit the file -> Fill in answers directly
- Chat            -> Discuss freely
```

**Guide me** を選び、こう答える: Q1 = High、Q2 = フォールバックはユーザー名、Q3 = null を穏当に処理（マイグレーションなし）。

conductor は 3 つの機能要件（null 処理・serializer の修正・フォールバックロジック）と 1 つの非機能要件（応答時間の回帰なし）を持つ `requirements.md` を生成する。

**承認 gate:** **Approve** を選ぶ。

### Stage 3.5 — Code Generation

conductor がコード生成計画を作り、aidlc-developer-agent の subagent に委譲する:

**計画:**
1. null の `display_name` を処理するよう `ProfileSerializer.serialize()` を修正
2. null / 非 null ケースの単体テストを追加
3. `ProfileService.getProfile()` の防御的チェックを修正
4. API エンドポイントの統合テストを追加

計画を承認する。subagent が 4 手順すべてを実装する:

- **変更**: `ProfileSerializer.java`（ユーザー名フォールバック付きの null 安全化）
- **変更**: `ProfileService.java`（防御的な null 処理）
- **作成**: `ProfileSerializerTest.java`（単体テスト 2 件）
- **作成**: `ProfileControllerIntegrationTest.java`（統合テスト 2 件）

**承認 gate:** **Approve** を選ぶ。

### Stage 3.6 — Build and Test

aidlc-quality-agent がビルドとテストを実行する:

```
mvn clean compile        # BUILD SUCCESS
mvn test                 # 89 tests, 0 failures
mvn verify               # Integration tests pass
```

結果は `<record>/construction/build-and-test/test-results.md` に捕捉される: 89 テスト合格、失敗 0、カバレッジは 62% から 64% に上昇。

**承認 gate:** **Approve** を選ぶ。ワークフロー完了。

### 終了時の状態

```
aidlc/spaces/default/
  codekb/
    user-service/             # 9 space-level RE artifacts
  intents/260624-null-display-fix/
    aidlc-state.md            # All 7 stages marked [x]
    audit/                    # Full decision trail (per-clone shards)
    inception/
      requirements-analysis/ # requirements.md + questions
    construction/
      bugfix-null-display-name/
        code-generation/     # plan + summary
      build-and-test/        # instructions + test results
```

ワークスペースルートのアプリケーションコード:
- `ProfileSerializer.java`（変更）
- `ProfileService.java`（変更）
- `ProfileSerializerTest.java`（作成）
- `ProfileControllerIntegrationTest.java`（作成）

### 主要な観察

1. **すべてのドメイン stage に承認 gate** — 各決定をあなたが制御する
2. **Minimal depth** — 簡潔で的を絞った成果物。修正の定義に必要な質問だけ
3. **subagent への委譲** — 重い仕事（RE・コード生成）はサブプロセスで走り、あなたは承認する
4. **完全な audit トレイル** — すべての決定が ISO タイムスタンプ付きで記録される
5. **セッション再開** — どの時点で中断しても、`/aidlc` が進行中の状態を検出する

---

## Feature のウォークスルー

この例はタスク管理アプリの通知サービスを作る。**feature** scope は全 32 stage を Standard depth で走らせる。このウォークスルーは全 phase の主要 stage をハイライトする。

### 呼び出し

```
/aidlc feature
```

> **What would you like to build?**

> A notification service for our task management app. Users should receive in-app notifications and optional email digests when tasks are assigned, due dates approach, or comments are posted. Support notification preferences per user.

### Initialization（stage 0.1-0.3）— 自動進行

3 つの Initialization stage が `aidlc-utility intent-birth` の中で自動実行される。Workspace Detection が特定する: TypeScript、Node.js 20、Express、PostgreSQL、既存のタスク・ユーザーサービスを持つ brownfield プロジェクト。

> Progress: 3/32 overall | Scope: feature, Depth: Standard

### Ideation phase（stage 1.1-1.7）

**Stage 1.1 — Intent Capture**（aidlc-product-agent）

aidlc-product-agent はまず許可された source の宇宙を
`intent-capture-questions.md` に記録し、続いて問題・対象ユーザー・
stakeholder・決定権限・コミュニケーション要求・scope について尋ねる:

```markdown
## Sources

- [desc] Initial description: "A notification service for our task management app..."
- [scope] Workflow-selected scope: `feature`.

## Q1. Which notification channels are in scope?
A. In-app only
B. In-app + email
C. In-app + email + push
D. In-app + email + push + SMS
X. Other

[Answer]: B. In-app + email
```

出来上がった artifact は、各主張をその register または確認済みの回答に
結びつけたまま保つ:

```markdown
## Target Customer

Task-management users receiving assignment, due-date, or comment events. [desc]

## Notification Channels

In-app notifications and optional email digests are in scope. [Q1]

## Assumptions & Open Questions

None.
```

stakeholder map は同じタグを `Source` 列で使う。裏付けの無い内容は
フォローアップとして質問されるか、`## Assumptions & Open
Questions` の下に残る。残存する assumption はあなたの明示的な受諾を必要とし、
assumption としてラベルされたままになる。その後 aidlc-product-lead-agent が
通常の承認 gate の前に source の裏付けをレビューする。

**Stage 1.4 — Scope Definition**（aidlc-product-agent）

scope の境界を定義する: in-scope（3 つのトリガー種別・ユーザー設定・メールダイジェスト）、out-of-scope（プッシュ通知・SMS・リアルタイム WebSocket）。優先順位付けされた項目を持つ `scope-document.md` と `intent-backlog.md` を生む。

**Stage 1.7 — Approval & Handoff**（aidlc-delivery-agent）

Ideation の全出力を集約する initiative brief をまとめる。phase 境界検証が intent から scope へのトレーサビリティを確認する。

> Progress: 10/32 overall | IDEATION complete. Verification Gate passed.

### Inception phase（stage 2.1-2.8）

**Stage 2.1 — Reverse Engineering**（pipeline）

既存コードベースの 2 リンクスキャン。9 つの成果物をリポジトリの space レベルのストア `aidlc/spaces/<active-space>/codekb/<repo>/` に書き、通知サービスが統合すべき既存のサービス構造・データベーススキーマ・API パターンを特定する。

**Stage 2.2 — Practices Discovery**（aidlc-pipeline-deploy-agent）

これは subagent の hub-and-spoke である。aidlc-pipeline-deploy-agent が Reverse Engineering の証拠から草稿を書き、aidlc-quality-agent・aidlc-developer-agent・aidlc-devsecops-agent が互いの contribution を見ずに並列でその草稿を検分する。人間へのインタビューが証拠のギャップとポリシー判断を解消し、その後リードが 3 つの contribution を `team-practices.md`・`discovered-rules.md`・`evidence.md` に統合する。gate は **Approve** / **Request Changes** を提示する。Approve の後、`practices-promote` が `aidlc/spaces/<active-space>/memory/team.md` と `project.md` を書き、確認済みタイムスタンプと対応する `PRACTICES_AFFIRMED` の領収書をアトミックに記録する。conductor が stage を承認済みと報告するのはその後だけである。昇格が無い・古い・失敗した場合、gate は開いたままで stage は未完了になる。

**Stage 2.3 — Requirements Analysis**（aidlc-product-agent）

12 の機能要件（通知トリガー・設定の CRUD・メール描画・ダイジェストのスケジューリング）と 5 つの非機能要件（配信遅延 < 5 秒・メール再試行・設定の保存）を生む。質問はエッジケースを掘る: メール配信が失敗したら？ダイジェストはどの頻度で走るべきか？

**Stage 2.4 — User Stories**（mob）

まず aidlc-product-agent がペルソナとストーリーの草稿を書く。次に aidlc-design-agent・aidlc-developer-agent・aidlc-quality-agent が相互に盲目な協力者としてその草稿を検分し、それぞれ identity 付きの contribution ファイルを書く。リードの aidlc-product-agent が 3 つの contribution を `personas.md` と `stories.md` に統合してから、**Approve** / **Request Changes** の gate を提示する。

**Stage 2.6 — Application Design**（aidlc-architect-agent）

aidlc-architect-agent が通知サービスのアーキテクチャを設計する:

- **コンポーネント**: NotificationService、PreferenceService、EmailRenderer、DigestScheduler
- **API 契約**: 設定管理の REST エンドポイント、トリガー用の内部イベントハンドラ
- **ADR**: イベント駆動のトリガーパターン（ポーリングとの比較）、メールキューに SQS（直接送信との比較）

`components.md`、`services.md`、`decisions.md` を生む。

**Stage 2.7 — Units Generation**（aidlc-architect-agent）

3 つの unit of work に分解する:

1. **notification-core** — イベントハンドラ、通知の保存、in-app 配信
2. **notification-preferences** — 設定の CRUD API、既定の設定
3. **notification-email** — メール描画、SQS 統合、ダイジェストのスケジューラ

依存マップ付きの `unit-of-work.md` を生む: notification-core が先、その後 preferences と email が並列。

**Stage 2.8 — Delivery Planning**（aidlc-delivery-agent）

Bolt の順序: Bolt 1 が notification-core を出荷する（walking skeleton — イベントハンドラのパイプラインを end-to-end で証明）。Bolt 2 が notification-preferences と notification-email を並列で出荷する。Bolt ごとの DoD は `bolt-plan.md` に、WSJF 流の根拠は `risk-and-sequencing-rationale.md` に、外部の SES/SQS 依存は `external-dependency-map.md` に対応付けられる。phase 境界検証が要件とアーキテクチャの整合を確認する。

> Progress: 18/32 overall | INCEPTION complete. Verification Gate passed.

### Construction phase（stage 3.1-3.7）

Construction は 2.8 の計画に従って **Bolt 単位**で走る。最初の Bolt が walking skeleton で、その後の ladder prompt が残りの自律性を決める。依存を共有する Bolt は並列で走る。

**Bolt 1: notification-core** — walking skeleton（常に gate 付き）

この Bolt はイベントハンドラのパイプラインが動くことを証明する end-to-end のスライスである: 通知イベントが内部ハンドラに届き、ストレージに落ち、in-app 配信のエンドポイントに現れる。conductor は notification-core の 3.1–3.4 を横断する 1 回の質問ラウンドで開き、すべての設計成果物を生成し、コード生成を aidlc-developer-agent の subagent に委譲する。

- **3.1 Functional Design** — ドメインエンティティ（Notification、NotificationEvent）、ビジネスルール（重複排除、レート制限）
- **3.5 Code Generation** — イベントハンドラ、通知リポジトリ、in-app 配信エンドポイント。ソース 3 ファイル、テスト 4 ファイル。

walking-skeleton の gate — Bolt 1 のコードサマリをレビューして承認する。

承認の直後、**ladder prompt** が発火する:

```
The walking skeleton shipped. How should the remaining Bolts run?
  ▸ Continue autonomously
    Run remaining Bolts without gates. Failures still halt and ask.
  ▸ Gate every Bolt
    Present an approval gate after each Bolt (or parallel batch).
```

形が動くのを見たので、**Continue autonomously** を選ぶ。conductor は `aidlc-state.md` に `Construction Autonomy Mode: autonomous` を記録し、`AUTONOMY_MODE_SET` を発行する。

**Bolt 2: notification-preferences + notification-email** — 並列バッチ

どちらも notification-core だけに依存し、互いに依存しないため、2.8 の計画は単一のバッチにスケジュールする。conductor は Bolt ごとに質問を集めて設計成果物を生成し、1 ターンで 2 つの `Task` 呼び出しを発行して**両方の code-generation stage を並行 dispatch** する。

- **notification-preferences — 3.1 Functional Design** — Preference エンティティ、既定値、チャネルのトグル
- **notification-preferences — 3.5 Code Generation** — CRUD API エンドポイント、設定リポジトリ、検証。ソース 2 ファイル、テスト 3 ファイル。
- **notification-email — 3.2 NFR Requirements** — メール配信の信頼性（指数バックオフ付き再試行）、ダイジェストスケジューリングの正確性
- **notification-email — 3.4 Infrastructure Design** — SQS キュー、SES 統合、dead-letter キューの CloudWatch アラーム
- **notification-email — 3.5 Code Generation** — メール描画、SQS コンシューマ、ダイジェストの cron ジョブ。ソース 4 ファイル、テスト 5 ファイル。

両方の subagent Task が次のターンで返る。autonomous を選んだためバッチの gate は無く、Construction はそのまま 3.6 へ進む。

**失敗した場合はどうなるか。** 仮に `notification-email` の Code Generation が壊れた SES モックで返ったとする。conductor は `notification-preferences` の完了を待ち、その成果物をディスクに保全して、こう提示する:

```
Bolt notification-preferences succeeded. Bolt notification-email failed during code generation:
  "SES client mock could not be constructed — check test config."

Options:
  ▸ Retry         Re-run notification-email from code generation.
  ▸ Skip          Mark notification-email skipped and continue. Dependent Bolts may also fail.
  ▸ Abort         Stop Construction. Resume via /aidlc --stage code-generation.
```

**Retry** を選び、モックの設定を直せば、notification-email だけが再実行される。preferences は既に `[x]` 完了である。

**Stage 3.6 — Build and Test**（aidlc-quality-agent。全 Bolt の後に 1 回）

ビルド手順を生成し、3 Unit 全体でテストスイートを実行する: 47 テスト合格、失敗 0、カバレッジ 78%。

**Stage 3.7 — CI Pipeline**（aidlc-pipeline-deploy-agent）

lint・build・test・セキュリティスキャンの stage を持つ CI パイプラインを構成する。品質 gate: カバレッジ >= 75%、致命的な脆弱性なし。

> Progress: 25/32 overall | CONSTRUCTION complete. Verification Gate passed.

### Operation phase（stage 4.1-4.7）

**Stage 4.1 — Deployment Pipeline** — ヘルスチェック gate 付きの blue-green デプロイ戦略

**Stage 4.2 — Environment Provisioning** — SQS キュー、SES 設定、通知保存用の DynamoDB テーブル

**Stage 4.4 — Observability Setup** — 通知配信遅延・メール送信レート・dead-letter キュー深度の CloudWatch ダッシュボード。配信失敗のアラーム。

**Stage 4.7 — Feedback & Optimization** — SLO 目標（in-app 配信 99.9%、メールは 30 秒以内の配信 99%）、コスト分析、フィードバックループ文書。

> Progress: 32/32 overall | OPERATION complete. Feature workflow complete.

### bugfix との主要な違い

| 観点 | Bugfix | Feature |
|--------|--------|---------|
| 実行 stage 数 | 7 | 32 |
| Depth | Minimal | Standard |
| Phase | Initialization + Inception + Construction | 全 5 |
| unit of work 数 | 1 | 3 |
| Bolt 単位の Construction | なし（bugfix は単一 Bolt） | あり — 2 Bolt（walking skeleton + 並列バッチ 1） |
| 条件付き stage | 大半をスキップ | 大半を実行 |
| 承認 gate | 4 | walking skeleton + ladder prompt。残りの Bolt は autonomy mode に従う |

---

## 次のステップ

- [Scope・Depth・テスト戦略](05-scopes-and-depth.md) — scope がどの stage を走らせるかを決める仕組み
- [stage はどう走るか](04-phases-and-stages.md) — stage プロトコルの詳細
- [エージェント](06-agents.md) — エージェントのペルソナと責務
- [成果物リファレンス](14-artifacts-reference.md) — 成果物ディレクトリツリーの全体
