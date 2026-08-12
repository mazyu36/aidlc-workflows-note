# Construction phase — Stage リファレンス (3.1-3.7)

## Phase 概観

Construction phase は、Inception からの設計成果物を、動作しテスト済みの
ソフトウェアへと変換する。functional design、non-functional requirements と
design、infrastructure design、code generation、build/test 検証、CI pipeline
設定にわたる 7 つの stage（3.1 から 3.7）をカバーする。

Construction は AI-DLC 方法論における 5 つの phase のうち 4 番目である。それは
Delivery Planning（Stage 2.8）中に生産される **実行計画** によって駆動される。
この計画が、どの stage を実行し、どれを skip し、どの順序で unit をビルドするかを
決める。

すべての stage は、承認 gate・質問フォーマット・完了メッセージ・状態追跡について
`stage-protocol.md` に従う。

> **パス規約。** 各ワークフローの成果物は、その **intent record dir** —
> `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` の下に住む（`<space>` は、
> 非既定の space が関与しない限り `default` であり、`<YYMMDD>-<label>` は intent
> ディレクトリ: `260624` のようなコンパクトな UTC 日付プレフィックスに、record が
> 時系列でソートされるよう短い kebab-case ラベルを付けたもの）。以下では
> `<record>/` はそのディレクトリの略記である; 例えば
> `<record>/construction/{unit-name}/functional-design/` は
> `aidlc/spaces/default/intents/<YYMMDD>-<label>/construction/{unit-name}/functional-design/`
> に展開される。ディレクトリ名は人間可読なラベルである; 正規のアイデンティティは
> `intents.json` レジストリ行に格納される UUIDv7 である。（per-intent レイアウト
> 以前に作られたプロジェクトはフラットなツリーを使っていた; engine は初回実行時に
> それらを移行する。）

---

## Bolt ごとの Construction

Construction は、stage 2.8 からの `bolt-plan.md`（Bolt シーケンス +
walking-skeleton マーカー）と stage 2.7 からの依存 DAG に駆動され、**Bolt ごと**
に実行される。[Bolt](../../guide/glossary.md) は、1 つの Unit または依存で結ばれた
小さな Unit 群に対する stage 3.1–3.5 の 1 パスである。stage 3.6（Build and Test）
と 3.7（CI Pipeline）は、最後にすべての Bolt にわたって **1 回**走る。

```
Bolt 1 (walking skeleton) — always gated:
  Questions (3.1–3.4 across the Bolt's Units in QUESTION-ONLY mode)
  → Answers gate (Bolt-level)
  Design artifacts (3.1–3.4 in ARTIFACT-ONLY mode)
  Code generation (3.5 per Unit via Task delegation)
  → Walking-skeleton gate
  → Ladder prompt (fires once): "autonomous" or "gated"
  → Write Construction Autonomy Mode to state

Bolt 2..N — autonomy mode governs the gate:
  (Parallel-eligible Bolts run as a batch; single batch-level gate covers
   every Bolt in it.)
  Questions → Answers gate (Bolt-level) → Design → Code-gen → Bolt/batch
  gate (skipped if autonomous). Failure always halts and asks.

After all Bolts:
  3.6 Build and Test (runs once across the full codebase)
  3.7 CI Pipeline    (runs once, conditional)
```

各 design stage ファイル（3.1–3.4）は QUESTION-ONLY と ARTIFACT-ONLY の実行
モードをサポートする — 詳細は個々の stage ファイルを参照。Code Generation の Step 3
**Plan Approval は、生成前に常にハードストップする** — Bolt 実行中も含めて。通常の
Bolt 実行中に **engine によって抑制される** のはその Step 7 の Unit ごとの完了
承認 gate だけである; それは単一の Bolt レベル（またはバッチレベル）の完了 gate で
置き換えられる。Unit ごとの完了 gate は直接起動での使用（例:
`/aidlc --stage code-generation`）のために残る。

**Construction の反復順序（opt-in）。** 既定では、engine は Unit ごとの construction
stage を stage-major で反復する: すべての Unit について 3.1 を走らせ、次にすべての
Unit について 3.2 を走らせ、と続け、すべての Unit について最後に 3.5 Code
Generation を走らせる。state ファイルが `## Runtime State` の下に
`Construction Iteration: unit-major` を記録するとき（delivery-planning で
`aidlc-state.ts set-construction-iteration unit-major` により、または人間によって
設定される）、engine は代わりに unit-major で歩く: Bolt ビルド順の各 Unit について、
その Unit の 4 つの design ドキュメント（3.1 から 3.4）を著述し、次いでそのコード
（3.5）を生成してから、次の Unit が始まる — 最初の動くコードは、すべての Unit の
design の後ではなく、1 つの Unit の design の後に現れる。Code Generation の Unit
ごとの Plan Approval（Step 3）は依然として生成の前にハードストップし、autonomy な
Construction swarm は、このノブがセットされている間は決して発火しない（この歩みが
ビルドを所有し、Bolt ビルド順で直列に進む; 並列バッチ swarm は stage-major の領分
である）。stage ごとの承認 gate は、数も機構も変わらない; unit-major の下では、
それらは遅く、stage 順に、Code Generation を含む（stage × Unit の）グリッド全体が
カバーされた後に、stage ごとに人間の承認 1 つで発火する。
正確な値 `unit-major` だけがそれを起動する; 不在または `stage-major` が既定である。

**並列バッチ。** 2 つ以上の Bolt が依存充足を共有し、互いに依存しないとき、
conductor は単一の assistant メッセージで N 個の `Task` 呼び出しを発行することで、
それらの Code Generation stage を並行してディスパッチする。1 つのバッチレベル gate
がそれらすべてをカバーする。audit イベント（`BOLT_STARTED`、`BOLT_COMPLETED`）は
`Batch=N` フィールドを運ぶので、兄弟はログから復元可能である。

**失敗処理。** Bolt の失敗は、autonomy mode に関わらず常に Construction を停止する。
選択肢は、retry（失敗した Bolt だけを再実行）、skip（`[S]` とマークして続行 —
依存する Bolt も失敗しうる）、または abort である。並列バッチ内の成功した兄弟は、
その `[x]` ステータスと成果物を保つ。正規の仕様は `stage-protocol.md` §1
「Construction Bolt gates」と SKILL.md §CONSTRUCTION Flow を参照。

---

## Stage サマリテーブル

| Stage | 名前                  | 実行        | 条件                                                                                               | リードエージェント   | 支援エージェント  | モード                      | Unit ごと |
|-------|-----------------------|-------------|----------------------------------------------------------------------------------------------------|---------------------|-------------------|-----------------------------|----------|
| 3.1   | Functional Design     | CONDITIONAL | 新しいデータモデル、複雑なビジネスロジック、またはビジネスルールの設計が必要                        | aidlc-architect-agent     | aidlc-developer-agent   | inline                      | Yes      |
| 3.2   | NFR Requirements      | CONDITIONAL | パフォーマンス・セキュリティ・スケーラビリティの懸念、または tech stack の選定が必要                 | aidlc-architect-agent     | aidlc-devsecops-agent, aidlc-compliance-agent, aidlc-quality-agent   | inline                      | Yes      |
| 3.3   | NFR Design            | CONDITIONAL | NFR Requirements が実行され、NFR パターンの設計が必要                                                | aidlc-architect-agent     | aidlc-aws-platform-agent| inline                      | Yes      |
| 3.4   | Infrastructure Design | CONDITIONAL | infrastructure サービスのマッピングが必要、deployment アーキテクチャが必要、またはクラウドリソースが必要 | aidlc-aws-platform-agent  | aidlc-devsecops-agent, aidlc-compliance-agent   | inline                      | Yes      |
| 3.5   | Code Generation       | ALWAYS      | 実行計画内のすべての unit に対して常に実行される                                                   | aidlc-developer-agent     | (なし)            | subagent (aidlc-developer-agent)  | Yes      |
| 3.6   | Build and Test        | ALWAYS      | Unit ごとの全 stage が終わった後に常に 1 回実行される                                               | aidlc-quality-agent       | aidlc-devsecops-agent   | inline                      | No       |
| 3.7   | CI Pipeline           | CONDITIONAL | CI pipeline の作成または大幅な変更が必要なときに実行                                                | aidlc-pipeline-deploy-agent| (なし)           | inline                      | No       |

---

## Stage 3.1: Functional Design

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.1                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | CONDITIONAL（実行計画に従う）                                                                     |
| 条件              | 新しいデータモデル、複雑なビジネスロジック、またはビジネスルールの設計が必要。新しいビジネスロジックの無い単純なロジック変更なら skip。 |
| Unit ごと         | Yes                                                                                               |
| リードエージェント| aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-developer-agent                                                                                   |
| mode              | inline                                                                                            |
| 入力              | unit-of-work.md, unit-of-work-story-map.md, requirements.md, application design 成果物            |
| 出力              | `<record>/construction/{unit-name}/functional-design/` — business-logic-model.md, business-rules.md, domain-entities.md, CONDITIONAL: frontend-components.md |

### 目的

単一の unit of work のためにビジネスロジック、ドメインモデル、ルールを設計する。
aidlc-architect-agent がリードし、aidlc-developer-agent が技術的実現性のインプットを
提供する。

### 入力

- `<record>/inception/units-generation/unit-of-work.md` からの unit 定義
- `<record>/inception/units-generation/unit-of-work-story-map.md` からの割り当てられた stories
- `<record>/inception/requirements-analysis/requirements.md` からの requirements
- `<record>/inception/application-design/` からの application design 成果物

### ステップ

1. **Personas をロード** — aidlc-architect-agent（lead）の persona と knowledge を
   ロードする。技術的な実装インプットのために aidlc-developer-agent の persona と
   knowledge をロードする。aidlc-architect-agent を主たる視点として適用する。

2. **Unit コンテキストを読む** — unit 定義、割り当てられた stories、requirements、
   application design 成果物を読む。

3. **Functional Design Plan を作成** — unit の scope を分析し、
   `<record>/construction/{unit-name}/functional-design/functional-design-questions.md`
   に `[Answer]:` タグを使ってコンテキストに適した質問を持つ questions ファイルを
   作成する。フォーカス領域:
   - ビジネスロジックのワークフローとアルゴリズム
   - ドメインモデルとエンティティ関係
   - ビジネスルール、制約、検証ロジック
   - データフローと変換
   - 他の unit または外部システムとの統合ポイント
   - エラー処理とエッジケース
   - Frontend コンポーネント（コンポーネント階層、props/state、インタラクション
     フロー、フォーム検証）
   - ビジネスシナリオ（end-to-end のユーザージャーニー、happy/unhappy パス、
     並行性のエッジケース）

4. **回答を収集し分析** — stage-protocol.md の質問フローに従って回答を収集する
   （インタラクションモードの選択を提示し、回答を収集し、ファイルに書き戻す）。
   必須の曖昧性分析を行う:
   - 曖昧な回答を特定する（"mix of"、"not sure"、"depends"、"probably"）
   - 回答間の矛盾をチェックする
   - 成果物生成に必要な欠けた詳細をフラグする
   - 曖昧性が 1 つでも見つかったら: フォローアップ質問を作成し、進む前に解消する

5. **成果物を生成** — `<record>/construction/{unit-name}/functional-design/` に
   以下を生成する:
   - **business-logic-model.md**: unit のビジネスロジックの詳細なアルゴリズム、
     ワークフロー、データ変換、処理シーケンス、決定木
   - **business-rules.md**: 決定ルール、検証ロジック、制約、ポリシー、条件付き
     振る舞い、ビジネス不変条件
   - **domain-entities.md**: エンティティ、関係、データ構造、属性、ライフサイクル
     状態、エンティティ相互作用パターン
   - **frontend-components.md**（CONDITIONAL — unit が frontend/UI を含む場合のみ）:
     コンポーネント階層、props/state 設計、インタラクションフロー、フォーム検証
     ルール、API 統合ポイント

6. **完了を準備** — unit の Functional Design 成果物を検証する。state を編集しない;
   gate の結果を `aidlc-orchestrate.ts` を通じて報告する。

7. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                   | 説明                                                                     |
|--------------------------|--------------------------------------------------------------------------|
| business-logic-model.md  | アルゴリズム、ワークフロー、データ変換、処理シーケンス、決定木             |
| business-rules.md        | 決定ルール、検証ロジック、制約、ポリシー、条件付き振る舞い                |
| domain-entities.md       | エンティティ、関係、データ構造、属性、ライフサイクル状態                  |
| frontend-components.md   | (CONDITIONAL) コンポーネント階層、props/state、インタラクションフロー、フォーム検証、API 統合 |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記

- questions ファイルは stage 成果物と同じ場所
  `<record>/construction/{unit-name}/functional-design/functional-design-questions.md`
  に配置される。
- frontend-components.md は、unit が frontend/UI 作業を含むときにのみ生産される。
- すべての質問は 3 モードのインタラクションフロー（Guide me / I'll edit the
  file / Chat）を使う。

---

## Stage 3.2: NFR Requirements

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.2                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | CONDITIONAL（実行計画に従う）                                                                     |
| 条件              | パフォーマンス要件、セキュリティ考慮、スケーラビリティの懸念、または tech stack の選定が必要。NFR 要件が無く tech stack が既に決定済みなら skip。 |
| Unit ごと         | Yes                                                                                               |
| リードエージェント| aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-devsecops-agent, aidlc-compliance-agent, aidlc-quality-agent                                       |
| mode              | inline                                                                                            |
| 入力              | functional design 成果物, requirements.md, RE 成果物                                              |
| 出力              | `<record>/construction/{unit-name}/nfr-requirements/` — performance-requirements.md, security-requirements.md, scalability-requirements.md, reliability-requirements.md, tech-stack-decisions.md |

### 目的

単一の unit について、パフォーマンス、セキュリティ、スケーラビリティ、信頼性、
技術選定にわたる非機能要件を定義する。aidlc-architect-agent がリードし、
aidlc-devsecops-agent がセキュリティのインプットを、aidlc-compliance-agent が規制の
インプットを、aidlc-quality-agent がテスト可能性と測定可能性のインプットを提供する。

### 入力

- `<record>/construction/{unit-name}/functional-design/` からの functional design
  成果物（存在する場合）
- `<record>/inception/requirements-analysis/requirements.md` からの requirements
- `aidlc/spaces/<active-space>/codekb/<repo>/` からの reverse engineering 成果物
  （存在する場合）

### ステップ

1. **Personas をロード** — aidlc-architect-agent（lead）の persona と knowledge を
   ロードする。支援インプットのために aidlc-devsecops-agent（セキュリティ要件）、
   aidlc-compliance-agent（規制要件）、aidlc-quality-agent（テスト可能性）の persona と
   knowledge をロードする。

2. **先行成果物を読む** — functional design 成果物（存在する場合）、requirements、
   reverse engineering 成果物を読む。

3. **NFR カテゴリを評価** — NFR カテゴリにわたって unit を分析する:
   - **パフォーマンス**: レスポンスタイム、スループット、レイテンシ目標、リソース
     利用率
   - **セキュリティ**: 認証、認可、データ保護、コンプライアンス要件
   - **スケーラビリティ**: 負荷処理、成長予測、スケーリング戦略
   - **信頼性**: 可用性目標、フォールトトレランス、災害復旧、データ耐久性
   - **可観測性**: モニタリング、ロギング、アラート、トレーシングの要件

4. **質問を生成** — 不明確な NFR 領域について
   `<record>/construction/{unit-name}/nfr-requirements/nfr-requirements-questions.md`
   に `[Answer]:` タグを使って questions ファイルを作成する。定量化可能な目標と
   具体的な制約にフォーカスする。

5. **回答を収集し分析** — stage-protocol.md の質問フローに従って回答を収集する。
   必須の曖昧性分析を行う:
   - 曖昧な回答を特定する（"fast enough"、"highly available"、"secure"）
   - NFR 目標間の矛盾をチェックする
   - 欠けた定量目標をフラグする
   - 曖昧性が 1 つでも見つかったら: フォローアップ質問を作成し、進む前に解消する

6. **成果物を生成** — `<record>/construction/{unit-name}/nfr-requirements/` に
   以下を生成する:
   - **performance-requirements.md**: レスポンスタイム目標、スループット要件、
     レイテンシ予算、リソース制約、ベンチマーク
   - **security-requirements.md**: 認証要件、認可モデル、データ保護、
     コンプライアンス、脅威の考慮
   - **scalability-requirements.md**: 負荷予測、スケーリングトリガー、キャパシティ
     計画、データ成長、並行性目標
   - **reliability-requirements.md**: 可用性目標（SLA/SLO）、フォールトトレランス
     要件、バックアップ/復旧、graceful degradation
   - **tech-stack-decisions.md**: 技術選定と根拠 — 言語、フレームワーク、
     データベース、インフラツール、および各選択の正当化

7. **完了を準備** — unit の NFR Requirements 成果物を検証する。state を編集しない;
   gate の結果を `aidlc-orchestrate.ts` を通じて報告する。

8. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                       | 説明                                                                       |
|------------------------------|----------------------------------------------------------------------------|
| performance-requirements.md  | レスポンスタイム、スループット、レイテンシ予算、リソース制約、ベンチマーク  |
| security-requirements.md     | 認証、認可、データ保護、コンプライアンス、脅威                              |
| scalability-requirements.md  | 負荷予測、スケーリングトリガー、キャパシティ計画、並行性                    |
| reliability-requirements.md  | 可用性目標（SLA/SLO）、フォールトトレランス、バックアップ/復旧             |
| tech-stack-decisions.md      | 各選択の根拠を伴う技術選定                                                  |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記 — NFR 粒度の拡張

この stage は **5 つの成果物ファイル** を生産する。これは、NFR Requirements に
2 ファイルのみを定義する upstream リファレンスから拡張されている。これは SKILL.md
（"Deliberate Deviations from Reference"）に文書化された意図的な逸脱である。より
細かい粒度はトレーサビリティを改善し、単一ドキュメントを過負荷にすることなく関心
ごとのレビューを可能にする。5 つのファイルはパフォーマンス、セキュリティ、
スケーラビリティ、信頼性を専用の成果物に分離し、技術選定の根拠のために専用の
tech-stack-decisions.md を追加する。

---

## Stage 3.3: NFR Design

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.3                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | CONDITIONAL（NFR Requirements が実行された場合のみ）                                              |
| 条件              | NFR Requirements が実行され、NFR パターンの設計が必要。NFR Requirements が skip された場合は skip。 |
| Unit ごと         | Yes                                                                                               |
| リードエージェント| aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-aws-platform-agent                                                                                |
| mode              | inline                                                                                            |
| 入力              | NFR requirements 成果物, functional design 成果物                                                 |
| 出力              | `<record>/construction/{unit-name}/nfr-design/` — performance-design.md, security-design.md, scalability-design.md, reliability-design.md, logical-components.md |

### 目的

NFR requirements を具体的な設計パターンとアーキテクチャ的ソリューションに翻訳する。
aidlc-architect-agent がリードし、aidlc-aws-platform-agent がインフラとプラットフォームの
インプットを提供する。

### 入力

- `<record>/construction/{unit-name}/nfr-requirements/` からの NFR requirements
- `<record>/construction/{unit-name}/functional-design/` からの functional design
  成果物（存在する場合）
- アーキテクチャ的コンテキストのための
  `<record>/inception/application-design/` からの application design

### ステップ

1. **Personas をロード** — aidlc-architect-agent（lead）の persona と knowledge を
   ロードする。インフラとプラットフォームのインプットのために aidlc-aws-platform-agent の
   persona と knowledge をロードする。

2. **先行成果物を読む** — NFR requirements、functional design 成果物（存在する
   場合）、およびアーキテクチャ的コンテキストのための application design を読む。

3. **Design 質問を生成** — `<record>/construction/{unit-name}/nfr-design/nfr-design-questions.md`
   に `[Answer]:` タグを使ってコンテキストに適した質問を持つ questions ファイルを
   作成する。フォーカス領域:
   - レジリエンスパターン（circuit breaker、bulkhead、フォールバック戦略）
   - スケーラビリティパターン（水平 vs 垂直、データパーティショニング、キャッシュ
     tier）
   - パフォーマンス最適化（レイテンシ予算、スループット目標、リソースプーリング）
   - セキュリティアプローチ（多層防御、ゼロトラスト、暗号化標準）
   - 論理コンポーネント境界（サービス分離、障害ドメイン、blast radius）

4. **回答を収集し分析** — stage-protocol.md の質問フローに従って回答を収集する。
   必須の曖昧性分析を行う:
   - 曖昧な回答を特定する（"mix of"、"not sure"、"depends"、"probably"）
   - 回答間の矛盾をチェックする
   - 成果物生成に必要な欠けた詳細をフラグする
   - 曖昧性が 1 つでも見つかったら: フォローアップ質問を作成し、進む前に解消する

5. **NFR ソリューションを設計** — 各 NFR カテゴリについて具体的なソリューションを
   設計する:
   - **パフォーマンス**: キャッシュ戦略、クエリ最適化、コネクションプーリング、
     非同期処理、CDN 利用、遅延ロード、ページネーション
   - **セキュリティ**: 認証フロー、認可モデル、暗号化（保存時および転送時）、
     入力検証、CSRF/XSS 保護、シークレット管理、監査ロギング
   - **スケーラビリティ**: 水平/垂直スケーリングアプローチ、負荷分散、データ
     パーティショニング/シャーディング、キューベースの疎結合、ステートレス設計
   - **信頼性**: circuit breaker、バックオフを伴うリトライポリシー、ヘルス
     チェック、graceful degradation、フェイルオーバー戦略、データレプリケーション

6. **成果物を生成** — `<record>/construction/{unit-name}/nfr-design/` に以下を
   生成する:
   - **performance-design.md**: キャッシュアーキテクチャ、最適化戦略、リソース
     プーリング、非同期パターン、パフォーマンス予算
   - **security-design.md**: 認証/認可アーキテクチャ、暗号化設計、入力検証戦略、
     セキュリティヘッダ、コンプライアンス制御
   - **scalability-design.md**: スケーリングアーキテクチャ、負荷分散、データ
     パーティショニング戦略、キャパシティ閾値、オートスケーリングルール
   - **reliability-design.md**: レジリエンスパターン、circuit breaker 設定、
     リトライポリシー、ヘルスチェック設計、フェイルオーバー手順、バックアップ戦略
   - **logical-components.md**: 論理インフラコンポーネントのインベントリ — サービス
     境界、障害ドメイン、blast radius マッピング、コンポーネント分離戦略、共有
     リソースの特定。NFR パターンが適用される場所のコンポーネントレベルのビューを
     提供することで、NFR design の判断を Infrastructure Design と橋渡しする。

7. **完了を準備** — unit の NFR Design 成果物を検証する。state を編集しない;
   gate の結果を `aidlc-orchestrate.ts` を通じて報告する。

8. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                 | 説明                                                                            |
|------------------------|---------------------------------------------------------------------------------|
| performance-design.md  | キャッシュアーキテクチャ、最適化戦略、リソースプーリング、非同期パターン         |
| security-design.md     | 認証アーキテクチャ、暗号化設計、入力検証、セキュリティヘッダ                     |
| scalability-design.md  | スケーリングアーキテクチャ、負荷分散、データパーティショニング、オートスケーリングルール |
| reliability-design.md  | レジリエンスパターン、circuit breaker、リトライポリシー、フェイルオーバー手順    |
| logical-components.md  | コンポーネントインベントリ、サービス境界、障害ドメイン、blast radius マッピング  |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記 — NFR Design の粒度

この stage は **5 つの成果物ファイル**（4 つの NFR 固有の design に加えて
logical-components.md）を生産する。これは、NFR Design に 2 ファイルのみを定義する
upstream リファレンスから拡張されている。これは SKILL.md（"Deliberate Deviations
from Reference"）に文書化された意図的な逸脱である。logical-components.md 成果物は、
NFR パターンがコンポーネントレベルのどこに適用されるかをマッピングすることで、NFR
design と Infrastructure Design（Stage 3.4）の間の橋渡しとして機能する。

---

## Stage 3.4: Infrastructure Design

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.4                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | CONDITIONAL（実行計画に従う）                                                                     |
| 条件              | infrastructure サービスのマッピングが必要、deployment アーキテクチャが必要、またはクラウドリソースが必要。インフラ変更が無くインフラが既に定義済みなら skip。 |
| Unit ごと         | Yes                                                                                               |
| リードエージェント| aidlc-aws-platform-agent                                                                                |
| support_agents    | aidlc-devsecops-agent, aidlc-compliance-agent                                                           |
| mode              | inline                                                                                            |
| 入力              | NFR design 成果物, application design, functional design                                          |
| 出力              | `<record>/construction/{unit-name}/infrastructure-design/` — deployment-architecture.md, infrastructure-services.md, monitoring-design.md, cicd-pipeline.md, CONDITIONAL: shared-infrastructure.md |

### 目的

単一の unit について、インフラ、deployment アーキテクチャ、モニタリング、CI/CD
pipeline を設計する。aidlc-aws-platform-agent がリードし、aidlc-devsecops-agent が
インフラのセキュリティを保証し、aidlc-compliance-agent がデータレジデンシーと規制
制約をチェックする。

### 入力

- `<record>/construction/{unit-name}/nfr-design/` からの NFR design（存在する場合）
- `<record>/construction/{unit-name}/functional-design/` からの functional design
  （存在する場合）
- `<record>/inception/application-design/` からの application design
- `<record>/construction/{unit-name}/nfr-requirements/` からの NFR requirements
  （存在する場合）

### ステップ

1. **Personas をロード** — aidlc-aws-platform-agent（lead）の persona と knowledge を
   ロードする。支援インプットのために aidlc-devsecops-agent（インフラセキュリティ）と
   aidlc-compliance-agent（データレジデンシー、規制制約）の persona と knowledge を
   ロードする。

2. **先行成果物を読む** — コンテキストのためにすべての先行 design 成果物を読む:
   NFR design、functional design、application design、NFR requirements。

3. **Infrastructure 質問を生成** —
   `<record>/construction/{unit-name}/infrastructure-design/infrastructure-design-questions.md`
   に `[Answer]:` タグを使ってコンテキストに適した質問を持つ questions ファイルを
   作成する。フォーカス領域:
   - Deployment 戦略（コンテナ化、サーバーレス、ハイブリッド、マルチリージョン）
   - コンピュート/ストレージ/ネットワーキング（サイジング、トポロジー、レイテンシ
     要件）
   - モニタリングアプローチ（メトリクス、ロギング、トレーシング、アラート閾値）
   - CI/CD pipeline（build stage、deployment 戦略、ロールバック手順）
   - シークレット管理（vault、環境変数、ローテーションポリシー）
   - スケーリングポリシー（オートスケーリングトリガー、キャパシティ上限、コスト
     制約）

4. **回答を収集し分析** — stage-protocol.md の質問フローに従って回答を収集する。
   必須の曖昧性分析を行う:
   - 曖昧な回答を特定する（"cloud-based"、"auto-scale"、"standard
     monitoring"）
   - 回答間の矛盾をチェックする
   - 成果物生成に必要な欠けた詳細をフラグする
   - 曖昧性が 1 つでも見つかったら: フォローアップ質問を作成し、進む前に解消する

5. **Infrastructure を設計** — 4 つの領域にわたってインフラを設計する:
   - **Deployment アーキテクチャ**: コンピュートモデル（コンテナ、サーバーレス、
     VM）、ネットワーキングトポロジー、ストレージ戦略、環境レイアウト
     （dev/staging/prod）
   - **Infrastructure サービス**: データベース（種類、サイジング、レプリケーション）、
     キャッシュ（戦略、退避）、メッセージキュー、検索サービス、CDN、DNS、ロード
     バランサ
   - **モニタリング & 可観測性**: メトリクス収集、ログ集約、分散トレーシング、
     アラートルール、ダッシュボード、SLI/SLO トラッキング
   - **CI/CD pipeline**: build stage、test stage、deployment stage、環境の昇格、
     ロールバック戦略、フィーチャーフラグ、成果物管理

6. **成果物を生成** — `<record>/construction/{unit-name}/infrastructure-design/`
   に以下を生成する:
   - **deployment-architecture.md**: コンピュートリソース、ネットワーキング、
     ストレージ、環境定義、infrastructure-as-code アプローチ、リソースサイジング
   - **infrastructure-services.md**: データベース設計、キャッシュ層、メッセージング
     インフラ、外部サービス統合、サービスディスカバリ
   - **monitoring-design.md**: メトリクスと KPI、ログ戦略、トレーシング設定、
     アラート定義、ダッシュボード仕様、インシデント対応
   - **cicd-pipeline.md**: pipeline stage、build 設定、テスト自動化の統合、
     deployment 戦略（blue-green、canary、rolling）、ロールバック手順、CI/CD での
     シークレット管理
   - **shared-infrastructure.md**（CONDITIONAL — 複数の unit がインフラリソースを
     共有するときに生産）: 共有データベース、共有キャッシュ、共有メッセージキュー、
     共有ネットワーキング、unit を跨ぐサービスディスカバリ、リソースの所有権と
     アクセス境界

7. **完了を準備** — unit の Infrastructure Design 成果物を検証する。state を
   編集しない; gate の結果を `aidlc-orchestrate.ts` を通じて報告する。

8. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                     | 説明                                                                      |
|----------------------------|---------------------------------------------------------------------------|
| deployment-architecture.md | コンピュート、ネットワーキング、ストレージ、環境定義、IaC アプローチ       |
| infrastructure-services.md | データベース、キャッシュ、メッセージング、外部統合、サービスディスカバリ   |
| monitoring-design.md       | メトリクス、ログ、トレーシング、アラート、ダッシュボード、SLI/SLO トラッキング |
| cicd-pipeline.md           | pipeline stage、build 設定、deployment 戦略、ロールバック手順              |
| shared-infrastructure.md   | (CONDITIONAL) unit を跨ぐ共有リソース、所有権境界                          |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記 — Infrastructure Design の拡張

この stage は **5 つの成果物ファイル** を生産する。これは、2〜3 ファイルを持つ
upstream リファレンスから拡張されている。これは SKILL.md（"Deliberate Deviations
from Reference"）に文書化された意図的な逸脱である。monitoring-design.md と
cicd-pipeline.md を専用の成果物として追加することで、運用の可視性を改善する。
shared-infrastructure.md は、複数の unit がインフラリソースを共有するときにのみ
条件付きで生産される。

---

## Stage 3.5: Code Generation

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.5                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | ALWAYS（unit ごと）                                                                               |
| 条件              | 実行計画内のすべての unit に対して常に実行される。                                                |
| Unit ごと         | Yes                                                                                               |
| リードエージェント| aidlc-developer-agent                                                                                   |
| support_agents    | (なし — 集中した実装)                                                                             |
| mode              | subagent (Task tool subagent_type: aidlc-developer-agent)                                               |
| 入力              | この unit のすべての先行 design 成果物                                                            |
| 出力              | application コード（workspace ルート） + `<record>/construction/{unit-name}/code-generation/` — code-generation-plan.md, code-generation-questions.md, code-summary.md |

### 目的

単一の unit of work について、すべての application コード、テスト、設定を生成する。
これは、実行計画に関わらずすべての unit について常に実行される唯一の stage である。
コードは workspace ルートに書かれ、決して `<record>/` には書かれない。

### 重要なルール

- application コードは workspace ルートへ行き、決して `<record>/` へは行かない
- Brownfield: ファイルをその場で変更する。`ClassName_modified.java` のような重複を
  決して作らない
- テスト自動化のため、インタラクティブな UI 要素に `data-testid` 属性を追加する

### 入力

- `<record>/construction/{unit-name}/functional-design/` からの functional design
  （存在する場合）
- `<record>/construction/{unit-name}/nfr-requirements/` からの NFR requirements
  （存在する場合）
- `<record>/construction/{unit-name}/nfr-design/` からの NFR design（存在する場合）
- `<record>/construction/{unit-name}/infrastructure-design/` からの infrastructure
  design（存在する場合）
- `<record>/inception/application-design/` からの application design
- `<record>/inception/units-generation/unit-of-work.md` からの unit 定義
- `<record>/inception/units-generation/unit-of-work-story-map.md` からの story map

### ステップ

この stage は **2 部構成** を持つ: 計画に続いて生成。

#### PART 1 — 計画（Steps 1-3）

1. **すべての Unit 成果物を読む** — 現在の unit のすべての design 成果物
   （functional design、NFR requirements、NFR design、infrastructure design、
   application design、unit 定義、story map）を読む。

2. **Code Generation Plan を作成** —
   `<record>/construction/{unit-name}/code-generation/code-generation-plan.md` に、
   各実装ステップのチェックボックスを持つ詳細な計画を作成する。story-to-code-step の
   トレーサビリティを含める — 各計画ステップを、それが実装するユーザーストーリーへ
   マッピングし戻す。

   **推奨される計画構造**（アーキテクチャが異なる順序を要求するなら適応する）:

   ```
   Step 1:  Project structure setup (directories, config files, package.json/Cargo.toml/etc.)
   Step 2:  Data models / database schema / migrations
   Step 3:  Business logic layer (core domain logic, services)
   Step 4:  Business logic tests (unit tests for Step 3)
   Step 5:  API / endpoint layer (routes, controllers, handlers)
   Step 6:  API tests (unit + integration tests for Step 5)
   Step 7:  Repository / data access layer (queries, ORM config)
   Step 8:  Frontend components (if applicable -- UI components, pages, state)
   Step 9:  Frontend tests (component tests, interaction tests)
   Step 10: Configuration and environment setup (.env templates, build config)
   Step 11: Test configuration (vitest.config, jest.config, or equivalent)
   Step 12: Documentation (inline docs, API docs, README updates)
   ```

   この層ごとのアプローチは、依存元が依存先の前にビルドされることを保証する
   （ビジネスロジックの前にデータモデル、API の前にビジネスロジック）。
   アーキテクチャが要求するとき（例: イベント駆動システム、独立したスタックを持つ
   マイクロサービス）は逸脱する。

   **テストファイルは計画で MANDATORY である。** 計画は以下のステップを含まねば
   ならない:
   - Unit テストファイル（キーとなる振る舞いのカバレッジを持つ、コンポーネント/
     モジュールごとに 1 つ）
   - テスト設定（vitest.config、jest.config、または同等物）

   計画がテストファイルのステップを省いている場合、ユーザーに提示する前にそれらを
   追加せねばならない。テストは Build and Test に先送りされない — その stage は
   検証と拡張を行うのであり、ゼロから作成するのではない。

   明確な実行順序とトレーサビリティのため、各計画ステップに連番を振る（Step 1、
   Step 2 など）。

3. **Plan Approval** — 計画のサマリをユーザーに提示し、承認を求める。まず
   `<record>/construction/{unit-name}/code-generation/code-generation-questions.md`
   を **Plan Approval** 質問と空の `[Answer]:` とともに作成またはリセットし、
   次にそれを構造化された質問としてレンダリングし、ターンを止める:
   - "Approve Plan" — code generation へ進む
   - "Request Changes" — 計画を改訂する

   人間が応答した後にのみタグを埋める。変更の要求は記録され、計画は改訂され、
   Plan Approval タグは再プロンプト前に空にリセットされる。forwarding-loop の継続は
   決して承認ではない。

#### PART 2 — 生成（Steps 4-7）

4. **コードを生成** — 委譲する前に、ユーザーに表示する:
   "Generating code for [N] plan steps. This may take several minutes
   depending on project complexity. I'll show a summary when complete."

   aidlc-developer-agent subagent（subagent_type="aidlc-developer-agent"）を持つ Task
   ツールへ委譲する。

   **subagent に渡されるコンテキスト:**
   - プロンプトの最初の行として、正確なターゲットマーカー
     `AIDLC-UNIT: <directive.unit>`（または `unit` の無い単一イテレーションの
     directive では現在の unit 名）。文脈上の依存関係は追加のマーカーを
     受け取らない。
   - `agents/aidlc-developer-agent.md` からの lead agent の persona と
     `.claude/knowledge/aidlc-developer-agent/` からの knowledge（subagent は会話履歴に
     アクセスできないのでプロンプトに含める）
   - 現在の Unit のみの design 成果物（すべての unit ではない）
   - 各 inception-phase 成果物の 1〜2 行のサマリとそのファイルパス（requirements
     サマリ、stories サマリ、app design サマリ） — subagent は完全な内容が必要なら
     特定のファイルを Read できる
   - 承認された code-generation-plan.md（全内容）
   - プロジェクト workspace の詳細（aidlc-state.md からの言語、フレームワーク、規約）
   - 各計画ステップを順次実行し、完了したらチェックボックスをマークする指示

   **コンテキスト予算:** すべての unit ではなく、現在の unit の design 成果物のみを
   渡す。完全な内容を埋め込むのではなく、ファイルパスとともに inception 成果物を
   サマライズする。subagent は workspace ですべてのコード、テストファイル、設定
   成果物を生成する。

5. **Code サマリを生成** — subagent の完了後、
   `<record>/construction/{unit-name}/code-generation/code-summary.md` を作成し、
   以下を文書化する:
   - 作成/変更されたファイル
   - キーとなる実装判断
   - テストカバレッジのサマリ
   - 計画からの逸脱

6. **完了を準備** — unit のコードとサマリの成果物を検証する。state を編集しない;
   gate の結果を `aidlc-orchestrate.ts` を通じて報告する。

7. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                    | 説明                                                                |
|---------------------------|---------------------------------------------------------------------|
| code-generation-plan.md   | チェックボックス、story トレーサビリティ、ステップの順序付けを持つ詳細な計画 |
| code-generation-questions.md | 永続化された Plan Approval 質問と明示的な人間の回答               |
| code-summary.md           | 作成/変更されたファイル、判断、テストカバレッジ、計画からの逸脱      |
| (application コード)       | workspace ルートに書かれたすべてのソースコード、テスト、設定         |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記

- **2 部構成**: 計画フェーズ（Steps 1-3）はユーザーインタラクションと plan approval
  とともに inline で走る。生成フェーズ（Steps 4-7）は Task ツール経由で
  aidlc-developer-agent subagent へ委譲する。これは、完全に inline で走るほとんどの
  Construction stage とは異なる。
- **Developer-agent subagent**: Code generation は inline 実行ではなく
  `subagent_type="aidlc-developer-agent"`（Task ツール経由で委譲）を使う。これは
  subagent を使う唯一の Construction stage である。subagent はフルセッションの
  ツールセットを継承する（aidlc-developer-agent は `tools:` allowlist を宣言しない）
  ので、Read、Edit、Write、Glob、Grep、Bash、AskUserQuestion、および継承した MCP
  ツールに到達する。
- **コンテキスト予算**: 現在の unit の design 成果物のみが subagent に渡される。
  inception-phase の成果物は、subagent が必要なものを選択的に Read できるよう、
  ファイルパスとともに 1〜2 行でサマライズされる。
- **テストファイルの必須の包含**: テストファイルは code generation 計画の一部で
  MUST である。Stage 3.6（Build and Test）はテストを検証・拡張するが、ゼロから
  作成はしない。
- **Brownfield の認識**: brownfield プロジェクトでは、subagent は重複を作るのでは
  なく既存のファイルをその場で変更する。

---

## Stage 3.6: Build and Test

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.6                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | ALWAYS（すべての unit が完了した後）                                                              |
| 条件              | Unit ごとの全 stage が終わった後に常に 1 回実行される。                                           |
| Unit ごと         | No（すべての unit に対して 1 回走る）                                                             |
| リードエージェント| aidlc-quality-agent                                                                                     |
| support_agents    | aidlc-devsecops-agent                                                                                   |
| mode              | inline                                                                                            |
| 入力              | すべての unit にわたるすべての code generation 出力                                               |
| 出力              | `<record>/construction/build-and-test/` — build-instructions.md, unit-test-instructions.md, integration-test-instructions.md, performance-test-instructions.md, security-test-instructions.md, build-and-test-summary.md, test-results.md, および条件付きのテスト指示ファイル |

### 目的

すべてのテスト種別にわたってテスト指示を生成し、次に Bash 経由で実際に build と
テストを実行する。この stage はすべての unit にわたって動作する — Unit ごとでは
ない。aidlc-quality-agent がリードし、aidlc-devsecops-agent がセキュリティテストの
専門性を提供する。

### 入力

- `<record>/construction/*/code-generation/code-summary.md` からの、すべての unit に
  わたる code generation 出力
- パフォーマンスおよびセキュリティテストのニーズのための、unit にわたる NFR
  requirements（存在する場合）

### ステップ

1. **Personas をロード** — aidlc-quality-agent（lead）の persona と knowledge を
   ロードする。セキュリティテストのインプットのために aidlc-devsecops-agent の persona
   と knowledge をロードする。

2. **テスト要件を分析** — すべての unit にわたる code generation 出力を読む。
   パフォーマンスおよびセキュリティテストのニーズを特定するため、NFR requirements
   （存在する場合）をレビューする。必要なすべてのテスト種別をカタログ化する。

3. **Build 指示を生成** —
   `<record>/construction/build-and-test/build-instructions.md` を作成する:
   - 依存関係のインストール手順
   - 環境セットアップ（環境変数、設定ファイル、ローカルサービス）
   - Build コマンド（コンパイル、バンドル、トランスパイル）
   - Build 検証手順
   - よくある build 問題のトラブルシューティング

4. **Unit テスト指示を生成** —
   `<record>/construction/build-and-test/unit-test-instructions.md` を作成する:
   - テストフレームワークのセットアップと設定
   - unit テストの実行方法（コマンド、フラグ、フィルタ）
   - 期待されるテストカバレッジ目標
   - モッキング/スタビングのガイダンス
   - テストデータ管理

5. **Integration テスト指示を生成** —
   `<record>/construction/build-and-test/integration-test-instructions.md` を
   作成する:
   - テスト環境の前提条件（データベース、サービス、キュー）
   - integration テストの実行方法
   - unit を跨ぐ相互作用のテスト
   - 外部依存の扱い（スタブ、test double、サンドボックス）
   - テストデータのセットアップとティアダウン

6. **Performance テスト指示を生成**（CONDITIONAL） — いずれかの unit に NFR
   パフォーマンス要件が存在する場合、`performance-test-instructions.md` を作成する:
   - 負荷テストツールと設定
   - NFR 目標にマッピングされたパフォーマンステストシナリオ
   - ベースライン測定とベンチマーク
   - ストレステストとソークテストの手順
   - パフォーマンスリグレッションの検出

7. **Security テスト指示を生成**（CONDITIONAL） — いずれかの unit に NFR
   セキュリティ要件が存在する場合、`security-test-instructions.md` を作成する:
   - セキュリティスキャンツール（SAST、DAST、依存関係監査）
   - 認証/認可のテストシナリオ
   - 入力検証とインジェクションのテスト
   - コンプライアンス検証手順
   - 脆弱性アセスメント手順

8. **追加のテスト種別を生成**（CONDITIONAL） — プロジェクトのアーキテクチャに
   基づいて該当する場合、具体的に命名されたファイルを作成する:
   - **contract-test-instructions.md**: マイクロサービス API 向け —
     consumer-driven contract、スキーマ検証、API 互換性
   - **e2e-test-instructions.md**: UI 駆動のアプリケーション向け — ブラウザ
     自動化、ユーザージャーニーテスト、クロスブラウザ検証
   - **accessibility-test-instructions.md**: ユーザー向けインターフェース向け —
     WCAG 準拠、スクリーンリーダーテスト、キーボードナビゲーション

   すべてのファイルは `<record>/construction/build-and-test/` に行く。

9. **Build and Test サマリを生成** —
   `<record>/construction/build-and-test/build-and-test-summary.md` を作成する:
   - 全体の build ステータスと前提条件
   - テスト種別のインベントリ（どのテスト種別が生成されたか）
   - unit ごとのカバレッジ期待
   - レディネス評価（build-ready、test-ready、deployment-ready）
   - 既知の制限または未解決の項目

10. **Build とテストを実行** — 指示ファイルに文書化された build とテストのコマンドを
    **Bash 経由で** 実行しようとする:

    a. **Build**: build-instructions.md からの build コマンドを Bash 経由で実行する。
       出力をキャプチャする。
    b. **Unit テスト**: unit-test-instructions.md からの unit テストコマンドを Bash
       経由で実行する。pass/fail のカウントをキャプチャする。
    c. **Integration テスト**（該当する場合）: integration テストコマンドを実行する。
       結果をキャプチャする。
    d. **結果を報告**: `<record>/construction/build-and-test/test-results.md` を
       以下とともに作成または更新する:
       - Build ステータス（成功/失敗 + 出力）
       - テスト結果（total、passed、failed、skipped）
       - 失敗の詳細（テスト名、アサーション、スタックトレース）
       - カバレッジレポート（テストフレームワークがサポートする場合）

    **失敗診断ループ（2 回試行）:** 失敗時、build またはテストが失敗したら、問題を
    診断して修正しようとする:
    - エラー出力を読む
    - 失敗しているコードを特定する
    - 修正を適用する
    - 失敗したステップを再実行する
    - 2 回の試行後も修正できなければ、失敗を test-results.md に記録し、承認 gate で
      ユーザーに問題を提示する

    **成功時:** Build and Test サマリを実際の結果（指示だけでなく）で更新する。

11. **完了を準備** — build/test のエビデンスを検証する。stage または phase の state
    を編集しない; 報告された gate の結果が遷移を所有する。

12. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                            | 説明                                                            | 条件               |
|-----------------------------------|-----------------------------------------------------------------|--------------------|
| build-instructions.md             | 依存関係インストール、環境セットアップ、build コマンド、トラブルシューティング | Always             |
| unit-test-instructions.md         | テストフレームワークのセットアップ、実行コマンド、カバレッジ目標、モッキング | Always             |
| integration-test-instructions.md  | 前提条件、unit を跨ぐテスト、外部依存、データセットアップ        | Always             |
| performance-test-instructions.md  | 負荷テスト、NFR シナリオ、ベースライン、ストレス/ソークテスト    | NFR perf が存在する場合 |
| security-test-instructions.md     | SAST/DAST、認証テスト、インジェクションテスト、コンプライアンス  | NFR sec が存在する場合  |
| contract-test-instructions.md     | consumer-driven contract、スキーマ検証、API 互換性              | マイクロサービスの場合   |
| e2e-test-instructions.md          | ブラウザ自動化、ユーザージャーニー、クロスブラウザ              | UI 駆動の場合          |
| accessibility-test-instructions.md| WCAG 準拠、スクリーンリーダー、キーボードナビゲーション          | ユーザー向け UI の場合  |
| build-and-test-summary.md         | 全体ステータス、テストインベントリ、カバレッジ、レディネス評価   | Always             |
| test-results.md                   | 実際の build/test 実行結果、pass/fail、カバレッジ               | Always             |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記

- **実際の Bash 実行**: この stage はテスト指示を文書化するだけではない — 実際に
  Bash 経由で build とテストのコマンドを走らせ、本物の結果をキャプチャする。これは、
  コードベースに対して本物のコマンドを実行する数少ない stage の 1 つである。
- **失敗診断ループ**: この stage は失敗を自動的に診断・修正しようとし、最大 2 回の
  試行を行う。2 回の試行後も修正が失敗したら、失敗は記録され、承認 gate でユーザーに
  提示される。
- **条件付きのテスト種別**: パフォーマンステスト、セキュリティテスト、contract
  テスト、E2E テスト、accessibility テストは、関連する条件が満たされたとき
  （NFR requirements が存在する、マイクロサービスアーキテクチャ、UI 駆動の
  アプリケーション、ユーザー向けインターフェース）にのみ生成される。
- **Unit を跨ぐ scope**: Unit ごとの stage 3.1-3.5 とは異なり、Build and Test は
  すべての unit が生産したすべてのコードにわたって 1 回走る。それは個々の unit では
  なく、統合されたコードベースを検証する。
- **Phase の完了**: この stage（該当する場合は 3.7 とともに）は Construction phase の
  終わりを画する。最終的に承認されたレポートにより、engine は Construction を完了と
  マークし、アトミックに Operation へルーティングする。

---

## Stage 3.7: CI Pipeline

### メタデータ

| プロパティ        | 値                                                                                                |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.7                                                                                               |
| Phase             | Construction                                                                                      |
| 実行              | CONDITIONAL（CI が既に存在し十分なら skip）                                                       |
| 条件              | CI pipeline の作成または大幅な変更が必要なときに実行                                              |
| Unit ごと         | No（すべての unit に対して 1 回走る）                                                             |
| リードエージェント| aidlc-pipeline-deploy-agent                                                                             |
| support_agents    | (なし)                                                                                            |
| mode              | inline                                                                                            |
| 入力              | Stage 3.5 からの code generation 出力、Stage 3.6 からの build/test 結果                           |
| 出力              | `<record>/construction/ci-pipeline/` — ci-config.md, quality-gates.md, ci-pipeline-questions.md |

### 目的

quality gate、成果物管理、build/test 自動化を伴う CI（Continuous Integration）
pipeline を設定する。aidlc-pipeline-deploy-agent がリードし、支援エージェントは無い。

### 入力

- `<record>/construction/build-and-test/` からの build/test 結果
- `<record>/construction/infrastructure-design/` からの infrastructure design
  （存在する場合）
- 既存の CI 設定のための workspace プロファイル

### ステップ

1. **Agent Personas をロード** — aidlc-pipeline-deploy-agent の persona と knowledge を
   ロードする。

2. **先行コンテキストをロード** — build/test 結果、infrastructure design（存在する
   場合）、既存の CI 設定のための workspace プロファイルを読む。

3. **明確化のための質問を生成** —
   `<record>/construction/ci-pipeline/ci-pipeline-questions.md` を以下の質問とともに
   作成する:
   - どの CI ツールが使われているか（CodePipeline、CodeBuild、GitHub Actions、
     Jenkins）？
   - ブランチ戦略は何か？
   - マージ前にどの quality gate が必要か？
   - どの成果物リポジトリが使われているか（ECR、CodeArtifact、S3）？

   stage-protocol.md の質問フローに従う。

4. **回答を収集し分析** — 既存のインフラとチームの能力に照らして CI の選択を
   検証する。

5. **成果物を生成** — CI pipeline 設定（buildspec.yml、workflow YAML、または同等
   物）、quality gate の定義、成果物リポジトリ設定を作成する。

6. **Phase 境界の検証** — Construction-to-Operation の検証チェックを走らせる:
   - アーキテクチャ-コード-テストの整合
   - すべてのコードが design にトレースする
   - 受け入れ基準に対するテストカバレッジ
   - 結果を `<record>/verification/phase-check-construction.md` に書く

7. **完了を準備** — CI と境界の成果物を検証する。stage または phase の state を
   編集しない; 報告された gate の結果が遷移を所有する。

8. **完了** — 完了メッセージと承認 gate を提示する。

### 出力

| 成果物                    | 説明                                                     |
|---------------------------|----------------------------------------------------------|
| ci-config.md              | CI pipeline 設定（buildspec、workflow YAML など）        |
| quality-gates.md          | マージ/昇格のための quality gate 定義                    |
| ci-pipeline-questions.md  | 回答を伴う明確化のための質問                             |

### 承認 gate

厳密に 2 択: Approve / Request Changes。

### 注記

- **Phase 境界の検証**: これは Construction phase の最後の stage である。それは
  Construction-to-Operation の phase 境界検証チェック（stage-protocol-governance.md
  セクション 13 に準拠）を行い、アーキテクチャがコードにトレースし、コードがテストに
  トレースすることを検証する。結果は
  `<record>/verification/phase-check-construction.md` に書かれる。
- **条件付き実行**: この stage は、プロジェクトが既に十分な CI pipeline を持つ場合は
  skip される。Delivery Planning からの実行計画が、それが走るかどうかを決める。
- **Post-unit 実行**: Stage 3.6 と同様、この stage は Unit ごとではなく、すべての
  Unit ごとの作業が完了した後に 1 回走る。

---

## Phase サマリ

Construction phase は、フェーズ化された construction フローを通じて、Inception の
design を動作するソフトウェアへと変換する:

**Unit ごとの stage（3.1-3.5）:**
- 3.1 Functional Design — ビジネスロジック、ドメインモデル、ルール（architect-led）
- 3.2 NFR Requirements — パフォーマンス、セキュリティ、スケーラビリティ、信頼性、
  tech stack（architect-led）
- 3.3 NFR Design — NFR カテゴリの具体的なパターン（architect-led）
- 3.4 Infrastructure Design — deployment、サービス、モニタリング、CI/CD
  (aws-platform-led)
- 3.5 Code Generation — subagent による 2 部構成の計画 + 生成
  (developer-led)

**Post-unit の stage（3.6-3.7）:**
- 3.6 Build and Test — 指示生成 + 失敗診断を伴う実際の Bash 実行（quality-led）
- 3.7 CI Pipeline — CI 設定 + phase 境界検証
  (pipeline-deploy-led)

**主な特徴:**
- Stage 3.1-3.4 は CONDITIONAL; 3.5-3.6 は ALWAYS 実行; 3.7 は CONDITIONAL
- すべての条件付き stage は Delivery Planning からの実行計画に従う
- Unit ごとのループは、次が始まる前に 1 つの unit が完全に完了することを保証する
- NFR 成果物は、upstream リファレンスと比べて拡張された粒度（requirements に 5
  ファイル、design に 5）を使う
- Infrastructure Design は、専用のモニタリングと CI/CD ファイルを持つ 5 つの成果物に
  拡張される
- Code generation は、コンテキスト予算の制御を伴う aidlc-developer-agent subagent を使う
- Build and Test は、実際のコマンド実行と自動化された失敗診断を行う
- CI Pipeline は、Operation への遷移前に phase 境界検証を含む

**upstream リファレンスからの意図的な逸脱:**
- NFR Requirements: 5 ファイル（リファレンスの 2 から拡張）
- NFR Design: logical-components.md を含む 5 ファイル（リファレンスの 2 から拡張）
- Infrastructure Design: monitoring-design.md と cicd-pipeline.md を含む 5 ファイル
  （リファレンスの 2〜3 から拡張）
- 計画/質問ファイルと stage 成果物の co-location
