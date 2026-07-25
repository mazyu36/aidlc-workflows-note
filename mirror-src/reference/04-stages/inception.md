# Inception Phase -- Stage リファレンス (2.1--2.8)

## Phase 概観

Inception phase は、AI-DLC 方法論における 5 つの phase のうち 3 番目である。Ideation
phase のビジネス intent と scope を、具体的な技術成果物へと変換する: リバースエンジニアリング
されたコードベース理解（brownfield プロジェクト向け）、チームの practices と運用 rule、
形式的な要件、user story、refined mockup、アプリケーションアーキテクチャ、unit-of-work への
分解、そして Construction phase を統べる delivery plan である。

Inception は stage 2.1 から 2.8（8 stage）を走らせ、Construction へ引き継ぐ前に、Stage 2.8
（Delivery Planning）で phase 境界の verification チェックをもって締めくくる。

> **パス規約.** 各ワークフローの成果物は、その **intent record dir** — 
> `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` の下に住む（ここで `<space>` は、
> 非デフォルトの space が関与しない限り `default` であり、`<YYMMDD>` は record が時系列で
> ソートされるようにするコンパクトな UTC 日付プレフィックスであり、`<label>` はリクエストの
> 本質を短い kebab-case で表したものである; 同日の衝突には数値カウンタが付く）。正規で衝突
> しない id は、`intents.json` レジストリ行に記録された UUIDv7 である — ディレクトリ名は
> 人間が読めるラベルにすぎない。以下では、`<record>/` はそのディレクトリの略記である; 例えば
> `<record>/inception/requirements-analysis/requirements.md` は
> `aidlc/spaces/default/intents/<YYMMDD>-<label>/inception/requirements-analysis/requirements.md`
> に展開される。Reverse Engineering の出力は例外である: それらは intent record の外、
> 永続的なリポジトリごとのストア
> `aidlc/spaces/<active-space>/codekb/<repo>/` に住む。
> （per-intent レイアウト以前に作られたプロジェクトはフラットなツリーを使っていた; engine は
> 初回実行時にそれらを移行する。）

この phase は、dispatch される 3 つのトポロジを含む: Stage 2.1 の 2-link の Reverse
Engineering pipeline、Stage 2.2 の Practices Discovery の hub-and-spoke、そして Stage 2.4 の
User Stories の mob である。

**Inception phase の主な特徴:**

- この phase は、2-link の pipeline を使う技術的な discovery stage（2.1 Reverse
  Engineering）で始まり、続いて subagent の hub-and-spoke を使う方法論 discovery stage
  （2.2 Practices Discovery）、その後 inline の要件 stage、mob の story stage、そして
  4 つの inline の設計/計画 stage が続く。
- Stage 2.1 は 2-link の pipeline を使う: aidlc-developer-agent がコードをスキャンし、続いて
  aidlc-architect-agent がスキャンを 9 個の構造化された成果物へと統合する。brownfield
  プロジェクトに対する always-rerun ポリシーを持つ。
- Stage 2.2 は greenfield と brownfield の作業で同じトポロジを走らせる:
  pipeline-deploy の lead draft、相互に盲目な quality/developer/devsecops の spoke、
  human interview、続いて lead integration である。affirmation されると、コンテンツは
  `<record>/inception/practices-discovery/` から space の memory 層 —
  `aidlc/spaces/<active-space>/memory/team.md` と `project.md` — へ昇格される。
  これは、この stage を他のあらゆる stage と構造的に異なるものにしている行をまたぐ昇格である。
- Stage 2.7 は `unit-of-work.md` を生成し、これは Construction phase の phased
  construction フローを駆動する unit を定義する。
- Stage 2.8 は、各 unit についてどの Construction stage がどの順序で走るかを決める実行計画を
  生成する。チームの Way of Working、Walking Skeleton の姿勢、Deployment のセクションを求めて
  `aidlc/spaces/<active-space>/memory/{org,team,project}.md` を読む。
- Stage 2.8 の phase 境界 verification は、Requirements から Stories、Architecture への整合を
  検証する。

**Scope 駆動の stage 包含:**

| Scope            | 含まれる Stage                                                |
|------------------|----------------------------------------------------------------|
| enterprise       | 2.1--2.8 すべて                                               |
| feature          | 2.1--2.8 すべて                                               |
| mvp              | 2.1（brownfield の場合）, 2.2, 2.3, 2.4, 2.5（UI の場合）, 2.6, 2.7, 2.8 |
| poc              | 2.1（brownfield の場合）, 2.3（最小限）                        |
| bugfix           | 2.1（常時 -- バグを見つける）, 2.3（最小限 -- バグの説明）      |
| refactor         | 2.1（常時 -- 現行コードを理解する）, 2.3（最小限）             |
| infra            | 2.2, 2.3（infra 要件）                                        |
| security-patch   | 2.1（脆弱性の文脈を見つける）, 2.3（最小限）                    |
| workshop         | 2.1--2.8                                                      |

---

## Stage サマリ表

| Stage | 名前                   | 条件        | Lead Agent             | Support Agents                                       | モード                            |
|-------|------------------------|-------------|------------------------|------------------------------------------------------|----------------------------------|
| 2.1   | Reverse Engineering    | CONDITIONAL | aidlc-developer-agent        | aidlc-architect-agent                                      | pipeline（aidlc-developer-agent → aidlc-architect-agent、2-link チェーン） |
| 2.2   | Practices Discovery    | CONDITIONAL | aidlc-pipeline-deploy-agent  | aidlc-quality-agent, aidlc-developer-agent, aidlc-devsecops-agent      | subagent（greenfield と brownfield での hub-and-spoke） |
| 2.3   | Requirements Analysis  | ALWAYS      | aidlc-product-agent          | --                                                   | inline                           |
| 2.4   | User Stories           | CONDITIONAL | aidlc-product-agent          | aidlc-design-agent, aidlc-developer-agent, aidlc-quality-agent | mob                              |
| 2.5   | Refined Mockups        | CONDITIONAL | aidlc-design-agent           | aidlc-product-agent                                        | inline                           |
| 2.6   | Application Design     | CONDITIONAL | aidlc-architect-agent        | aidlc-aws-platform-agent, aidlc-design-agent               | inline                           |
| 2.7   | Units Generation       | ALWAYS      | aidlc-architect-agent        | aidlc-delivery-agent                                       | inline                           |
| 2.8   | Delivery Planning      | ALWAYS      | aidlc-delivery-agent         | aidlc-architect-agent                                      | inline                           |

---

## Stage 2.1: Reverse Engineering

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.1                                                                    |
| 条件             | CONDITIONAL -- brownfield が検出された; freshness のため常に再実行       |
| Lead Agent       | aidlc-developer-agent                                                        |
| Support Agents   | aidlc-architect-agent                                                        |
| モード           | pipeline（2-link チェーン: aidlc-developer-agent がスキャンし、aidlc-architect-agent が統合して書き出す） |
| 完了 Emoji       | （stage-protocol.md の完了テンプレートを使う）                          |

### 目的

Reverse Engineering は、brownfield プロジェクトの既存コードベースに対する包括的な分析を
行う。2-link の pipeline（`mode: pipeline`）として走る: まず aidlc-developer-agent が
コードベース全体をスキャンし、続いて aidlc-architect-agent がスキャン結果を 9 個の構造化
された成果物へと統合して書き出す。これらの成果物は、後続のすべての Inception および
Construction stage が土台とする技術的基盤を提供する。

**Always-rerun ポリシー:** Reverse Engineering は、以前の成果物が存在する場合でも
brownfield プロジェクトに対して常に再実行される。これにより、成果物が古いスナップショットで
はなくコードベースの現在の状態を反映することが保証される。

### 入力

- `<record>/aidlc-state.md`（プロジェクトタイプの確認）

### ステップ

1. **条件をチェックする** -- `<record>/aidlc-state.md` を読み、プロジェクトタイプが
   brownfield であることを確認する。プロジェクトが brownfield でない場合、
   `aidlc-orchestrate.ts report --stage reverse-engineering
   --result skipped --reason "greenfield workspace has no existing codebase to
   reverse engineer"` でこの stage をスキップする。engine は `[S]` を記録し、
   アトミックに先へルーティングする。

2. **Developer によるコードスキャン** -- aidlc-developer-agent subagent
   （`subagent_type="aidlc-developer-agent"`）で Task tool に委譲する。委譲プロンプトに、
   `agents/aidlc-developer-agent.md` からの aidlc-developer-agent persona と、
   `.claude/knowledge/aidlc-developer-agent/` からの knowledge を含める。
   コンテキストとして `aidlc-state.md` からの workspace 状態を含める。

   developer は次を求めてコードベース全体をスキャンする:
   - すべてのパッケージ、モジュール、およびそれらの目的
   - ビルドシステム、設定、依存関係
   - 外部および内部の API（エンドポイント、コントラクト、メソッド）
   - フレームワーク、ライブラリ、およびそれらのバージョン
   - テストディレクトリ、テストフレームワーク、カバレッジ設定
   - コード品質の指標（lint、CI/CD、ドキュメント）
   - 技術的負債のシグナル

   developer は、`{{HARNESS_DIR}}/knowledge/aidlc-developer-agent/re-artifacts.md` の
   Developer Code Scan Template に従って、構造化されたスキャン結果を返す。

3. **Architect による統合** -- aidlc-architect-agent subagent
   （`subagent_type="aidlc-architect-agent"`）で Task tool に委譲する。委譲プロンプトに、
   `agents/aidlc-architect-agent.md` からの aidlc-architect-agent persona と、
   `.claude/knowledge/aidlc-architect-agent/` からの knowledge を含める。完全な developer の
   スキャン結果をコンテキストとして渡す。`aidlc-state.md` からの workspace 状態を含める。
   リポジトリの出力ディレクトリを
   `bun {{HARNESS_DIR}}/tools/aidlc-utility.ts codekb-path --repo <repo>` で解決し、
   その正確なパスを architect に渡す。

   architect はスキャン結果を、解決された space レベルの codekb ディレクトリ内の 9 個の出力
   成果物（下記の出力を参照）へと統合する。

4. **完了の準備** -- 9 個すべての成果物が存在することを検証する。`aidlc-state.md` を編集
   しない; ライフサイクルの完了は、gate の後の report に属する。

5. **完了の提示と承認の要求** -- `aidlc-orchestrate.ts report --stage reverse-engineering --result
   awaiting-approval` で gate を開き、9 個すべての成果物を表示し、続いて同じ engine コマンドを
   通じて human の approved/rejected の結果を report する。

### 出力

各リポジトリの 9 個の成果物すべては、`aidlc-utility.ts codekb-path --repo <repo>` が印字する
正確なディレクトリを使って `aidlc/spaces/<active-space>/codekb/<repo>/` に書き出される:

| #  | ファイル                          | 内容                                                        |
|----|----------------------------------|-------------------------------------------------------------|
| 1  | `business-overview.md`           | ビジネスドメイン、目的、主要な機能                          |
| 2  | `architecture.md`                | システムアーキテクチャ、パターン、コンポーネント関係（Mermaid ダイアグラム付き）。ビジネストランザクションがコンポーネントをまたいでどう実装されるかを描く Interaction Diagrams セクションを必ず含める（シーケンス図またはフロー図）。 |
| 3  | `code-structure.md`              | パッケージ/モジュール構成、ファイル分類、コードパターン       |
| 4  | `api-documentation.md`           | 外部および内部の API サーフェス、エンドポイント、コントラクト |
| 5  | `component-inventory.md`         | 責務と依存を伴う完全なコンポーネント一覧                     |
| 6  | `technology-stack.md`            | 言語、フレームワーク、バージョン付きライブラリ               |
| 7  | `dependencies.md`                | 外部依存、パッケージをまたぐ内部依存                         |
| 8  | `code-quality-assessment.md`     | テストカバレッジ、lint、CI/CD、ドキュメント品質、技術的負債   |
| 9  | `reverse-engineering-timestamp.md` | RE が実行された時点（日付、可能ならコミットハッシュ、分析の scope） |

### 承認 gate

標準の 2 択 gate: **Approve**（Requirements Analysis へ続く）/ **Request Changes**。

### 注記

- **Always-rerun ポリシー:** この stage は、以前の成果物が存在する場合でも brownfield
  プロジェクトに対して常に再実行される。これは upstream リファレンスからの意図的な逸脱で
  あり、SKILL.md の "Deliberate Deviations" セクションに文書化されている。
- **2-link pipeline:** aidlc-developer-agent が生のコードスキャンを行い（link 1、lead）、
  続いて aidlc-architect-agent がスキャンを構造化された成果物へと統合して書き出す（link 2、
  最終 link）。この分離により、スキャンが徹底的（developer の視点）であり、統合が
  アーキテクチャ的に情報を得たもの（architect の視点）であることが保証される。
- bugfix と refactor の scope では、既存コードの理解が不可欠であるため、この stage は
  （境界的に greenfield と見なせるものでも）常に実行される。
- security-patch scope では、この stage は脆弱性の文脈を見つけるために実行される。
- ここで生成される 9 個の成果物は、Requirements Analysis（2.3）、User Stories（2.4）、
  Application Design（2.6）、Units Generation（2.7）によって消費される。
- `architecture.md` 成果物は、ビジネストランザクションがコンポーネントをまたいでどう実装
  されるかを、シーケンス図またはフロー図を使って示す Interaction Diagrams を含めねばならない。

---

## Stage 2.2: Practices Discovery

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.2                                                                    |
| 条件             | CONDITIONAL -- EXECUTE scope では freshness のため常に再実行            |
| Lead Agent       | aidlc-pipeline-deploy-agent                                                  |
| Support Agents   | aidlc-quality-agent, aidlc-developer-agent, aidlc-devsecops-agent                        |
| モード           | subagent（lead draft → 相互に盲目な 3 つの spoke → human interview → lead integration） |
| 完了 Emoji       | （stage-protocol.md の完了テンプレートを使う）                          |

### 目的

Practices Discovery は、AI-DLC において 2 軸の設定モデルの両方の行に書き込む唯一の stage で
ある。チームの way of working、walking-skeleton の姿勢、testing の姿勢、deployment のリズム、
code-style の rule を discover する。brownfield の実行はリポジトリと Reverse Engineering の
エビデンスを使う; greenfield の実行は active-space の `org.md` から lead draft を種付けする。
どちらも同じ subagent の hub-and-spoke を使う: pipeline-deploy の lead draft、相互に盲目な
quality/developer/devsecops の contribution、human interview、続いて lead integration である。
human が affirmation gate で承認した後、コンテンツは stage が承認を report する前に
`aidlc/spaces/<active-space>/memory/team.md` と `project.md` へ昇格される。

### 入力

- `<record>/aidlc-state.md`（プロジェクトタイプ）
- brownfield のみ: `aidlc/spaces/<active-space>/codekb/<repo>/` からの
  reverse-engineering の 9 個の成果物（business-overview,
  architecture, code-structure, api-documentation, component-inventory,
  technology-stack, dependencies, code-quality-assessment,
  reverse-engineering-timestamp）
- `aidlc/spaces/<active-space>/memory/{org,team,project}.md`（デフォルトと以前の affirmation）
- `.claude/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md`（lead-agent の KB）

### 出力

4 つの lead 成果物と 3 つの spoke contribution が
`<record>/inception/practices-discovery/` に書き出される:

- `team-practices.md` -- 記述的な、チームの声の散文。`team.md` の見出しに一致する
  5 つのセクション: Way of Working, Walking Skeleton, Testing Posture, Deployment,
  Code Style。
- `discovered-rules.md` -- 是正的で、agent 向け。2 つのセクション: Mandated
  （`ALWAYS …` rule）と Forbidden（`NEVER …` rule）。
- `evidence.md` -- agent ごとの発見サマリ; 再実行のための freshness の跡。
- `practices-discovery-timestamp.md` -- 実行タイムスタンプ + コミットハッシュ。
- `contributions/aidlc-{quality,developer,devsecops}-agent.md` -- 相互に盲目な各 spoke
  からの、identity でマークされた 1 つの contribution; これらのファイルは engine が
  チェックする完了エビデンスである。

affirmation されると、コンテンツは次へ昇格される:

- `aidlc/spaces/<active-space>/memory/team.md` -- `replaceSection` による section 置換
  （再実行は section の内容を蓄積せず上書きする）。
- `aidlc/spaces/<active-space>/memory/project.md` -- `appendUnderHeading` による
  見出し下への追記（rule は蓄積する; 日付スタンプがそれらを区別する）。

### ステップ

1. **入力を分類する** -- `aidlc-state.md` を読んで greenfield か brownfield かを分類し、
   active space を解決する。brownfield は Reverse Engineering の成果物とリポジトリの
   エビデンスをロードする。greenfield は `memory/org.md` からデフォルトをロードする。
   再実行では、以前の `team.md` と `project.md` もロードする。
2. **Lead による draft** -- `aidlc-pipeline-deploy-agent` を dispatch する。それは初期の
   `team-practices.md`、`discovered-rules.md`、`evidence.md` を書く。brownfield は
   観測されたエビデンスから draft する; greenfield は org のデフォルトから draft し、
   未確認の前提をすべて明確にマークする。
3. **相互に盲目な 3 つの spoke** -- 1 つの並列バッチで、lead draft に対して
   `aidlc-quality-agent`、`aidlc-developer-agent`、`aidlc-devsecops-agent` を dispatch
   する。ブリーフには draft のパスが含まれるが、他の spoke の出力は含まれない。各々は
   `contributions/` の下に自身の identity でマークされた contribution ファイルを書く;
   lead の成果物は編集しない。
4. **human interview** -- 3 つの spoke がすべて返った後、構造化された質問を提示する。
   brownfield はエビデンスのギャップとポリシー判断を尋ねる; greenfield は 5 つの practice
   領域すべてを、org のデフォルトを提案として尋ねる。再実行は以前に affirm された記述を
   事前入力する。すべての質問と正確な回答をログに残す。
5. **Lead integration** -- draft、3 つの contribution パスすべて、そして interview の回答を
   伴って、pipeline-deploy の lead を再度 dispatch する。lead だけが最終成果物を統合し、
   `PRACTICES_DISCOVERED` を発する。
6. **affirmation gate を開く** -- 尋ねる前に `aidlc-orchestrate.ts report --stage
   practices-discovery --result awaiting-approval` を呼ぶ。draft を、ちょうど 2 つの
   オプションで提示する: **Approve** / **Request Changes**。Request Changes の応答は
   `--result rejected` を通じて report される; 昇格は起きない。
7. **human 承認後に昇格する** -- human が Approve を選んだ後にのみ、active-space の
   `team.md` と `project.md` への決定論的な昇格を走らせる。それは `project.md` を先に、
   `team.md` を後に書き、`PRACTICES_AFFIRMED` を発する。昇格が失敗した場合は
   `PRACTICES_OVERRIDE` を発し、stage を `[?]` のまま gate を開いたままにし、承認を
   report しない。
8. **受領を検証し、それから report する** -- 昇格が成功すると、`Practices Affirmed
   Timestamp` と、対応する `PRACTICES_AFFIRMED` の audit 受領が、アトミックに記録される。
   それから `aidlc-orchestrate.ts report --stage practices-discovery --result
   approved --user-input "Approve"` を呼ぶ。engine は完了とルーティングの前に、3 つの
   contribution ファイルすべてと現在の試行の受領を検証する。

### 承認 gate

標準の 2 択 gate: **Approve** / **Request Changes**。Approve は昇格が走る間、開いたまま
保持される; 昇格と affirm タイムスタンプが成功した後にのみ、conductor は
`--result approved --user-input "<exact choice>"` を report できる。昇格の失敗は、gate を
開いたまま、stage を未完了のままにする。

### 注記

- `.claude/tools/aidlc-lib.ts` の `replaceSection` ヘルパーは、team.md の行をまたぐ昇格を
  サポートするために、milestone 8 で特別に追加された（既存の `appendUnderHeading` は
  再実行をまたいで重複を蓄積する）。
- `org.md` と `team.md` は 1 つの Title Case 見出しセット
  （`## Way of Working`、`## Walking Skeleton`、`## Testing Posture`、
  `## Deployment`、`## Code Style`）を共有する。stage は `org.md` の各 section を、
  対応する Title Case 見出しで `extractMarkdownSection` を通じて読み、`team.md` の
  同じ見出しを section 置換する。
- resume 時には、lead draft と既存の contribution ファイルをすべて保つ。欠けている
  spoke だけを dispatch し、それから interview と lead integration へ続く。完了済みの
  support 作業を繰り返さない。
- contribution のエビデンスは必須である。quality、developer、devsecops の contribution の
  いずれかが欠けているか、間違った identity マーカーを持つ場合、承認は拒否される。

---

## Stage 2.3: Requirements Analysis

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.3                                                                    |
| 条件             | ALWAYS -- depth は複雑さに応じて適応する                                |
| Lead Agent       | aidlc-product-agent                                                          |
| Support Agents   | （なし）                                                                |
| モード           | inline                                                                 |
| 完了 Emoji       | :mag:                                                                  |

### 目的

Requirements Analysis は、user の intent とリバースエンジニアリングされたコードベース理解を、
形式的で構造化された要件へと変換する。リクエストを明確さ、タイプ、scope、複雑さについて
評価する; 適切な depth を決める; 既に分かっていることを抽出する; 6 つの次元にわたる完全性
分析を走らせる; 明確化のための質問を生成する; そして形式的な要件ドキュメントを生成する。

この stage は常に実行されるが、プロジェクトの複雑さに基づいて depth を適応させる: 明確で
狭い scope には minimal、中程度の scope には standard、著しい未知を伴う大きな scope には
comprehensive である。

### 入力

- Stage 2.1 からの Reverse Engineering 成果物
  （`aidlc/spaces/<active-space>/codekb/<repo>/`）、brownfield の場合
- intent の `audit/` シャードからの user のプロジェクト説明

### ステップ

1. **agent persona をロードする** -- `agents/aidlc-product-agent.md` からの
   aidlc-product-agent persona と、`.claude/knowledge/aidlc-product-agent/` からの
   knowledge をロードする。

2. **以前のコンテキストをロードする** -- brownfield の場合:
   `aidlc/spaces/<active-space>/codekb/<repo>/` から RE 成果物を読む。intent の `audit/`
   シャードから user のプロジェクト説明を読む。

3. **user のリクエストを分析する** -- 次についてリクエストを評価する:
   - **明確さ**: リクエストはどれだけよく定義されているか？
   - **タイプ**: 新機能、拡張、リファクタリング、バグ修正、マイグレーション
   - **Scope**: 単一コンポーネント、複数コンポーネント、システム全体
   - **複雑さ**: シンプル、標準、複雑

4. **depth を決める** -- 複雑さの評価に基づく:
   - **Minimal**: 明確なリクエスト、狭い scope、よく理解されたドメイン
   - **Standard**: 中程度の scope、いくらかの未知、複数のステークホルダー
   - **Comprehensive**: 大きな scope、著しい未知、複雑なドメイン

5. **現在の要件を評価する** -- user の入力から既に分かっていることを抽出し整理する:
   明示的な機能要件、暗黙の非機能要件、制約と前提、ビジネスの文脈と目標。

6. **完全性分析** -- 6 つの次元にわたるカバレッジを評価する:
   1. 機能要件 -- 中核となる振る舞い、機能、ユースケース
   2. 非機能要件 -- パフォーマンス、セキュリティ、スケーラビリティ、
      信頼性
   3. user シナリオ -- user のワークフロー、エッジケース、エラーシナリオ
   4. ビジネスの文脈 -- 目標、成功指標、ステークホルダー、制約
   5. 技術的な文脈 -- 統合ポイント、プラットフォーム要件、
      テクノロジ制約
   6. 品質属性 -- 保守性、テスト容易性、アクセシビリティ、
      ユーザビリティ

   各次元のギャップを特定する。

7. **明確化のための質問を生成する** -- PROACTIVE: 要件が 6 つの次元すべてにわたって
   例外的に明確かつ完全でない限り、常に明確化のための質問を生成する。
   `[Answer]:` タグ形式を使って
   `<record>/inception/requirements-analysis/requirements-analysis-questions.md`
   を作成する。A〜E のオプションを伴う、文脈に応じた質問を含める。すべての質問は
   最終オプションとして `X. Other (please specify)` で終わらねばならない。すべての
   `[Answer]:` タグは空白のままにする。

   3 モードの質問フローを提供する: Guide Me / Edit File / Chat。

8. **回答を収集し分析する** -- 質問ファイルを読み、すべての `[Answer]:` タグが埋まって
   いることを確認する。いずれかが空白なら、未回答の質問を AskUserQuestion 経由で提示し、
   回答を書き戻す。部分的な回答で先へ進んではならない。次を走らせる:
   - MANDATORY な曖昧さ検出: すべての応答を曖昧な言葉遣い
     （"mix of"、"not sure"、"depends"、"probably"、"maybe"）についてスキャンする
   - 回答間の矛盾チェック
   - 欠けている詳細の特定

9. **フォローアップの質問** -- 何らかの曖昧さ、あいまいさ、または矛盾が見つかった場合、
   その具体的な問題を狙ったフォローアップの質問を作成する。先へ進む前にすべての曖昧さを
   解決する。「疑わしいときは、尋ねる。」

10. **要件を生成する** -- 次を含む
    `<record>/inception/requirements-analysis/requirements.md` を作成する:
    - intent 分析 -- user が達成しようとしていること（機能だけでなく目標）
    - 機能要件 -- 機能領域またはドメインごとに整理
    - 非機能要件 -- パフォーマンス、セキュリティ、スケーラビリティの目標
    - 制約 -- 技術的、ビジネス的、組織的
    - 前提 -- 根拠とともに文書化
    - スコープ外 -- 明示的に除外された項目
    - オープンな質問 -- 後続 stage のために残る不確実性

11. **完了の準備** -- 要件成果物を検証する。`<record>/aidlc-state.md` を編集しない;
    完了とルーティングは engine が所有する。

12. **完了の提示と承認の要求** -- :mag: emoji とレビューパスを伴う完了メッセージを表示する。
    承認 gate には 2 つのバリアントがある:

    **実行状態で User Stories が SKIP に設定されている場合:** 3 択 gate:
    Approve / Request Changes / Add User Stories（現在スキップされている User Stories
    stage を含める）。「Add User Stories」が選択された場合、
    `bun {{HARNESS_DIR}}/tools/aidlc-utility.ts recompose --add user-stories` を走らせる;
    チェックボックスを直接編集しない。

    **User Stories が SKIP に設定されて *いない* 場合:** 標準の 2 択 gate: Approve /
    Request Changes。

### 出力

すべての成果物は `<record>/inception/requirements-analysis/` に書き出される:

| ファイル                              | 内容                                                    |
|--------------------------------------|---------------------------------------------------------|
| `requirements.md`                    | 形式的な要件: intent 分析、機能/非機能要件、制約、前提、スコープ外、オープンな質問 |
| `requirements-analysis-questions.md` | `[Answer]:` タグを伴う明確化のための質問（入力成果物）  |

### 承認 gate

条件付き gate 形式:

- **User Stories がスキップされる場合:** 3 択 gate -- **Approve** / **Request
  Changes** / **Add User Stories**
- **User Stories がスキップされない場合:** 標準の 2 択 gate -- **Approve** /
  **Request Changes**

### 注記

- これはワークフローで最も詳細な質疑応答 stage である。MANDATORY な曖昧さ検出を強制し、
  部分的またはあいまいな回答では先へ進まない。
- depth は複雑さに応じてスケールする: bugfix/poc には minimal、feature には standard、
  enterprise には comprehensive。
- bugfix scope では、この stage は minimal depth でバグの説明を捉える。
- infra scope では、この stage はインフラ要件を捉える。
- ここで生成される要件ドキュメントは、User Stories（2.4）、Refined Mockups（2.5）、
  Application Design（2.6）、Units Generation（2.7）、Delivery Planning（2.8）によって
  消費される。

---

## Stage 2.4: User Stories

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.4                                                                    |
| 条件             | CONDITIONAL -- ユーザー向け機能、複数のペルソナ、複雑なビジネスロジック、またはチームをまたぐ作業の場合に実行する |
| Lead Agent       | aidlc-product-agent                                                          |
| Support Agents   | aidlc-design-agent, aidlc-developer-agent, aidlc-quality-agent               |
| モード           | mob（2.5.0 の mob-elaboration ショーケース）                            |
| 完了 Emoji       | :books:                                                                |

### 目的

User Stories は、形式的な要件を、各機能の「誰が、何を、なぜ」を定義するユーザー中心の
story へと変換する。この stage は 2 部構成に従う: PART 1 は明確化のための質問を伴う story
plan を作成し、PART 2 は実際の story とペルソナを生成する。plan と story は、統合された
レビューのために完了 gate で一緒に提示される。

この stage は mob-elaboration のショーケース（mode: mob）である: Product Manager が主導し、
design、developer、quality の agent が lead の draft に対して独立した協力者として dispatch
される — 盲目ラウンド、統合、1 回の限定された異議ラウンド — その後 Product Leader がレビュー
する。aidlc-design-agent のユーザーエクスペリエンスの視点は、upstream リファレンスには無い
意図的な追加であり、SKILL.md の "Deliberate Deviations" セクションに文書化されている。

### 入力

- `<record>/inception/requirements-analysis/requirements.md`
- Stage 2.1 からの RE 成果物
  （`aidlc/spaces/<active-space>/codekb/<repo>/`）、
  brownfield の場合

### ステップ

1. **lead persona をロードする** -- `agents/aidlc-product-agent.md` からの
   aidlc-product-agent persona と、`.claude/knowledge/aidlc-product-agent/` からの
   knowledge をロードする。support agent（design、developer、quality）は inline では
   ロードされない — これは mob stage である; それらは生成中に独立した協力者として
   dispatch される。

2. **User Stories が必要かを検証する** -- このプロジェクトで user story が価値を加えるかを
   評価する:
   - **実行する条件**: ユーザー向け機能、複数のユーザーペルソナ、複雑な
     ビジネスロジック、チームをまたぐ調整が必要
   - **スキップする条件**: 純粋なリファクタリング、孤立したバグ修正、インフラのみ、
     開発者向けツーリング

   決定（Execute か Skip）、根拠、考慮した要因、主要な価値領域（実行する場合）または
   代替のカバレッジ（スキップする場合）を文書化する
   `<record>/inception/user-stories/user-stories-assessment.md` を作成する。

   スキップする場合、`aidlc-orchestrate.ts report --stage user-stories
   --result skipped --reason "<reason from the assessment>"` を呼ぶ。engine は成果物や
   ensemble エビデンスのチェックの前に `[S]` を記録しルーティングする。

3. **以前のコンテキストをロードする** -- 
   `<record>/inception/requirements-analysis/requirements.md` を読む。brownfield の場合、
   `aidlc/spaces/<active-space>/codekb/<repo>/` から関連する RE 成果物を読む。

**PART 1: 計画**

4. **質問を伴う story plan を作成する** -- 次を含む
   `<record>/inception/user-stories/user-stories-questions.md` を作成する:
   - ペルソナ開発のアプローチ（ユーザーは誰で、その目標は何か）
   - INVEST 基準（Independent、Negotiable、Valuable、Estimable、Small、Testable）を
     使った story 形式
   - MoSCoW 優先度（Must Have / Should Have / Could Have / Won't Have）を使った story の
     優先順位付け。MVP 境界は Delivery Planning の間に正式に決定される; story の優先度が
     その決定に情報を与える。
   - 分解アプローチのオプション（機能別、ペルソナ別、ワークフロー別、ドメイン領域別、
     または epic 別）
   - ペルソナと story 粒度についての user 入力のための、`[Answer]:` タグ形式を使った
     埋め込み質問

5. **回答を収集する** -- stage-protocol.md セクション 3 の質問フロー（インタラクション
   モードの選択を提供し、回答を収集し、ファイルへ書き戻す）に従って回答を収集する。

6. **回答を分析する** -- MANDATORY な曖昧さ分析: すべての応答を曖昧な言葉遣い
   （"mix of"、"not sure"、"depends"、"probably"）についてスキャンする。矛盾をチェック
   する。欠けている詳細を特定する。何らかの曖昧さが見つかった場合、フォローアップの質問を
   作成する。

7. **plan を提示し生成する** -- story plan のサマリ（ペルソナ数、story 数、分解アプローチ）
   を inline で提示する。それから即座に PART 2 へ進む。user は完了 gate で、統合された出力
   （plan + 生成された story）をレビューし承認する。

   生成が完了する前に user がフィードバックで割り込んだ場合、それを修正リクエストとして
   扱い、生成を続ける前に plan を更新する。

**PART 2: 生成**

8. **plan を実行する -- mob 経由で story とペルソナを生成する**:

   **Lead の draft。** aidlc-product-agent はまず
   `<record>/inception/user-stories/personas.md` を draft する:
   - ユーザーペルソナの定義（名前、役割、目標、ペインポイント、文脈）
   - ペルソナの関係と優先度ランキング

   そして `<record>/inception/user-stories/stories.md`:
   - 標準形式の user story: 「As a [persona], I want [goal], so that
     [benefit]」
   - 各 story の受け入れ基準
   - story の優先度（Must Have / Should Have / Could Have / Won't Have）
   - story の依存と関係
   - INVEST 準拠のノート

   **相互に盲目な support contribution。** aidlc-design-agent、
   aidlc-developer-agent、aidlc-quality-agent を、lead draft に対して 1 回の並列ラウンドで
   dispatch する。各ブリーフには draft、Q&A、要件のパスが含まれるが、兄弟の contribution は
   含まれない。各 support agent は
   `<record>/inception/user-stories/contributions/<agent-slug>.md` の下に、自身の
   identity でマークされたファイルを書く。

   **Lead の integration。** aidlc-product-agent は完了 gate の前に、3 つの contribution
   すべてを `personas.md` と `stories.md` へ統合する。判断を要する事項は stage の途中で
   human へ回される; knowledge の争いは 1 回の限定された異議ラウンドを得る。維持された
   反対意見は gate で引用される。

9. **完了の準備** -- mob 成果物と 3 つの協力者 contribution ファイルすべてを検証する。
   state を編集しない; gate の結果を `aidlc-orchestrate.ts` を通じて report する。

10. **完了の提示と承認の要求** -- :books: emoji、生成されたペルソナと story のサマリ、
    レビューパスを伴う完了メッセージを表示する。標準の 2 択承認 gate: Approve（次の stage
    へ続く）/ Request Changes。

### 出力

すべての成果物は `<record>/inception/user-stories/` に書き出される:

| ファイル                        | 内容                                                         |
|--------------------------------|--------------------------------------------------------------|
| `stories.md`                   | 受け入れ基準、優先度、依存、INVEST ノートを伴う user story    |
| `personas.md`                  | ユーザーペルソナの定義、関係、優先度ランキング               |
| `user-stories-assessment.md`   | 根拠と考慮した要因を伴う Execute/skip の決定                  |
| `user-stories-questions.md`    | `[Answer]:` タグを使った明確化のための質問を伴う story plan（入力成果物） |
| `contributions/aidlc-{design,developer,quality}-agent.md` | gate の前に lead が統合する、相互に盲目な support contribution |

### 承認 gate

標準の 2 択 gate: **Approve**（次の stage へ続く）/ **Request Changes**。

### 注記

- スキップ条件: 純粋なリファクタリング、孤立したバグ修正、インフラのみ、開発者向け
  ツーリング。
- 2 部構成（plan してから生成）により、user は story が書かれる前に story の分解アプローチに
  影響を与えられる。
- user story の優先度（MoSCoW）は MVP 境界に情報を与えるが、それを決定はしない。正式な
  MVP 境界は Delivery Planning（Stage 2.8）の間に設定される。
- `user-stories-assessment.md` 成果物は、stage がスキップされる場合でも、根拠を文書化する
  ために常に生成される。
- 3 つの identity でマークされた contribution ファイルは必須の ensemble エビデンスである;
  lead が 3 つすべてを統合するまで承認は拒否される。
- ここで生成される story は、Refined Mockups（2.5）、Application Design（2.6）、
  Units Generation（2.7）、Delivery Planning（2.8）によって消費される。
- aidlc-design-agent の support は UX に情報を得た開発のための意図的な追加であり、
  SKILL.md の Deliberate Deviations セクションに記されている。

---

## Stage 2.5: Refined Mockups & UX Design

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.5                                                                    |
| 条件             | CONDITIONAL -- 非 UI、API のみ、またはインフラのみの取り組みではスキップする |
| Lead Agent       | aidlc-design-agent                                                           |
| Support Agents   | aidlc-product-agent（stories に照らして検証する）                            |
| モード           | inline                                                                 |
| 完了 Emoji       | :art:                                                                  |

### 目的

Refined Mockups は、Ideation Stage 1.6 の粗いコンセプトワイヤーフレームを、形式的な要件と
user story に情報を得た中〜高忠実度のモックアップへと進化させる。詳細なインタラクション仕様、
デザインシステムのマッピング、レスポンシブな振る舞いの定義、アクセシビリティ準拠の
チェックリストを生成する。

非 UI の取り組み（API のみ、バックエンド）では、この stage はインタラクション図を API の
開発者エクスペリエンス仕様へと洗練する。

この stage は、Stage 1.6（Rough Mockups）もスキップされた場合、通常はスキップされる。

### 入力

- Stage 1.6 からの rough mockup（`<record>/ideation/rough-mockups/`）、
  存在する場合
- Stage 2.4 からの user story（`<record>/inception/user-stories/`）
- Stage 2.3 からの要件
  （`<record>/inception/requirements-analysis/`）

### ステップ

1. **agent persona をロードする** -- `agents/aidlc-design-agent.md` からの
   aidlc-design-agent persona と、`.claude/knowledge/aidlc-design-agent/` からの
   knowledge をロードする。

2. **以前のコンテキストをロードする** -- `<record>/ideation/rough-mockups/` から
   rough mockup を読む（存在する場合）。`<record>/inception/user-stories/` から user story
   を読む。`<record>/inception/requirements-analysis/` から要件を読む。

3. **明確化のための質問を生成する** -- 次をカバーする質問を伴う
   `<record>/inception/refined-mockups/refined-mockups-questions.md` を作成する:
   - 各 user story を UI でどう表現すべきか
   - 必要なインタラクションパターン（モーダル、インライン編集、ウィザード、
     プログレッシブディスクロージャー）
   - 各画面が扱わねばならない状態（ローディング、空、エラー、成功、部分的）
   - 既存のデザインシステム / コンポーネントライブラリとの整合
   - アクセシビリティ要件（WCAG レベル）
   - 必要なレスポンシブブレークポイント
   - API の場合: 開発者エクスペリエンス要件

   stage-protocol.md の質問フローに従う。

4. **回答を収集し分析する** -- 一貫性のために、デザインの決定を user story と要件に照らして
   検証する。

5. **成果物を生成する** -- 中〜高忠実度のモックアップ（user story/画面ごと）、
   インタラクション仕様ドキュメント、デザインシステムのマッピング、レスポンシブな振る舞いの
   仕様、アクセシビリティ準拠のチェックリストを作成する。非 UI の取り組みでは、API の
   開発者エクスペリエンス仕様を作成する。

6. **完了の準備** -- refined-mockup 成果物を検証する。state を編集しない; gate の結果を
   `aidlc-orchestrate.ts` を通じて report する。

7. **完了の提示と承認の要求** -- :art: emoji を伴う完了メッセージを表示する。標準の
   承認 gate（Approve / Request Changes）。

### 出力

すべての成果物は `<record>/inception/refined-mockups/` に書き出される:

| ファイル                         | 内容                                                        |
|---------------------------------|-------------------------------------------------------------|
| `mockups.md`                    | user story/画面ごとの中〜高忠実度のモックアップ             |
| `interaction-spec.md`           | インタラクションパターン、状態管理、遷移                     |
| `design-system-mapping.md`      | デザインシステム / コンポーネントライブラリへのコンポーネントマッピング |
| `accessibility-checklist.md`    | WCAG 準拠チェックリストと要件                                |
| `refined-mockups-questions.md`  | `[Answer]:` タグを伴う明確化のための質問（入力成果物）      |

### 承認 gate

標準の 2 択 gate: **Approve** / **Request Changes**。

### 注記

- スキップ条件: 非 UI、API のみ、またはインフラのみの取り組み。また、Stage 1.6
  （Rough Mockups）がスキップされた場合も通常はスキップされる。
- mvp scope では、この stage はプロジェクトが UI を持つ場合にのみ実行される。
- ここで生成されるモックアップは Application Design（2.6）へ供給され、最終的に UI
  コンポーネントのための Construction の Code Generation（3.5）へ供給される。
- アクセシビリティチェックリストは、Build and Test（3.6）へ供給されるテスト可能な基準を
  提供する。

---

## Stage 2.6: Application Design

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.6                                                                    |
| 条件             | CONDITIONAL -- 新しいコンポーネントやサービスが必要なときに実行する; 既存コンポーネントの修正のみの場合はスキップする |
| Lead Agent       | aidlc-architect-agent                                                        |
| Support Agents   | aidlc-aws-platform-agent, aidlc-design-agent                                |
| モード           | inline                                                                 |
| 完了 Emoji       | :building_construction:                                                |

### 目的

Application Design は、プロジェクトのシステムアーキテクチャを定義する: コンポーネント境界、
インターフェース、サービス定義、通信パターン、依存関係、そして architecture decision record
（ADR）である。要件と user story を、Construction を導く具体的な技術設計へと変換する。

aidlc-aws-platform-agent は AWS サービスマッピングについての補助的な視点を提供する。
aidlc-design-agent の support も、UX に情報を得たアーキテクチャのために SKILL.md の
Deliberate Deviations セクションに記されている。

`decisions.md` 成果物（ADR）は upstream リファレンスには存在しない意図的な追加であり、
SKILL.md の "Deliberate Deviations" セクションに文書化されている。

### 入力

- `<record>/inception/requirements-analysis/requirements.md`
- `<record>/inception/user-stories/stories.md`（生成された場合）
- Stage 2.1 からの RE 成果物（特に `architecture.md`、
  `component-inventory.md`、`dependencies.md`）、brownfield の場合

### ステップ

1. **agent persona をロードする** -- `agents/aidlc-architect-agent.md` からの
   aidlc-architect-agent persona と、`.claude/knowledge/aidlc-architect-agent/` からの
   knowledge をロードする。AWS サービスマッピングのために、`agents/aidlc-aws-platform-agent.md`
   からの aidlc-aws-platform-agent persona と、`.claude/knowledge/aidlc-aws-platform-agent/`
   からの knowledge をロードする。

2. **以前のコンテキストをロードする** -- 要件、user story（生成された場合）、RE 成果物
   （brownfield の場合、特に architecture.md、component-inventory.md、dependencies.md）を
   読む。scope の文脈は `<record>/aidlc-state.md` から来る。

3. **質問を伴う design plan を作成する** -- 次をカバーする、`[Answer]:` タグ形式を使った
   文脈に応じた質問を伴う
   `<record>/inception/application-design/application-design-questions.md` を作成する:
   - コンポーネント境界の決定
   - アーキテクチャスタイルの好み（まだ決まっていない場合）
   - サービス通信パターン（sync vs. async、REST vs. gRPC vs.
     events）
   - データの所有権とストレージ戦略
   - 既存コンポーネントとの統合アプローチ（brownfield）
   - UI コンポーネント構造（ユーザー向けの場合、UX デザイナーの視点に情報を得たもの）

4. **回答を収集し分析する** -- stage-protocol.md セクション 3 の質問フローに従って回答を
   収集する。MANDATORY な曖昧さ分析: 曖昧な言葉遣い、矛盾、欠けている詳細をスキャンする。
   何らかの曖昧さが見つかった場合、フォローアップの質問を作成する。先へ進む前にすべての
   曖昧さを解決する。

5. **design 成果物を生成する** -- 5 個の design 成果物を作成する（下記の出力を参照）。

6. **完了の準備** -- design 成果物を検証する。state を編集しない; gate の結果を
   `aidlc-orchestrate.ts` を通じて report する。

7. **完了の提示と承認の要求** -- :building_construction: emoji、design 成果物のサマリ、
   強調された主要なアーキテクチャ決定、レビューパスを伴う完了メッセージを表示する。3 択の
   承認 gate: Approve / Request Changes / Add Units Generation（実行計画でスキップされて
   いた場合）。Add Units Generation を選択すると
   `bun {{HARNESS_DIR}}/tools/aidlc-utility.ts recompose --add units-generation` を走らせる;
   state のチェックボックスを直接編集することは決してない。

### 出力

5 個すべての成果物は `<record>/inception/application-design/` に書き出される:

| ファイル                           | 内容                                                      |
|-----------------------------------|-----------------------------------------------------------|
| `components.md`                   | コンポーネントの名前、目的、責務、インターフェース、境界、所有権 |
| `component-methods.md`            | 各コンポーネントの公開インターフェースのメソッドシグネチャ、入出力の型、エラー処理のアプローチ（詳細なビジネスルールは Functional Design に属する） |
| `services.md`                     | サービス定義、責務、オーケストレーションパターン（choreography vs. orchestration）、通信コントラクト、ライフサイクルとスケーリングの特性 |
| `component-dependency.md`         | 依存マトリクス、通信パターン（sync/async/event-driven）、コンポーネント間のデータフロー、共有リソースの特定 |
| `decisions.md`                    | Context、Decision、Consequences、Alternatives Considered を伴う Architecture Decision Records（ADR）; トレードオフ分析; 可逆性の評価 |

加えて、質問ファイルが入力として作成される:

| ファイル                                   | 内容                                            |
|-------------------------------------------|-------------------------------------------------|
| `application-design-questions.md`         | `[Answer]:` タグを伴う design の質問            |

### 承認 gate

特別な 3 択 gate:

- **Approve** -- 次の stage へ続く
- **Request Changes** -- 修正のフィードバックを提供する
- **Add Units Generation** -- 現在スキップされている Units Generation stage を含める
  （実行計画でスキップされていた場合）;
  `aidlc-utility.ts recompose --add units-generation` 経由

### 注記

- スキップ条件: 変更が既存コンポーネントの修正のみで、新しいコンポーネントやサービスが
  必要ない。
- `decisions.md` 成果物（ADR）は upstream リファレンスからの意図的な逸脱である。各 ADR は
  Context、Decision、Consequences、Alternatives Considered、そしてトレードオフ分析と
  可逆性の評価を含む。
- ここで生成される design 成果物は、Units Generation（2.7）の主要な入力であり、Construction
  stage（Functional Design 3.1、Code Generation 3.5）に直接情報を与える。
- brownfield プロジェクトでは、design は RE 成果物に文書化された既存コンポーネントとの統合を
  考慮せねばならない。

---

## Stage 2.7: Units Generation

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.7                                                                    |
| 条件             | ALWAYS -- Stage 2.8 が Bolt sequencing のために消費する依存 DAG を生成する; コンパイル済み scope グリッドで 2.8 と一緒に移動する |
| Lead Agent       | aidlc-architect-agent                                                        |
| Support Agents   | aidlc-delivery-agent                                                         |
| モード           | inline                                                                 |
| 完了 Emoji       | :wrench:                                                               |

### 目的

Units Generation は、application design を、Construction phase の phased construction
フローを駆動する個別の Unit of Work へと分解する。各 Unit は、システムの独立して実装可能な
一片（サービス、モジュール、またはデプロイ可能なコンポーネント）を表す。この stage は、
Construction が何をビルドするかを決めるために使う `unit-of-work.md` ファイル、Stage 2.8 が
Bolt sequencing のために消費する依存 DAG（`unit-of-work-dependency.md`）、そしてすべての
user story が Unit に割り当てられることを保証する story map を生成する。

**Stage 2.7 は依存 DAG（トポロジ）を生成する。Stage 2.8 はその中を通る経済的な経路
（Bolt シーケンス）を選ぶ。** 2.7 は実装順序を推奨したりクリティカルパスを特定したりして
はならない — それらは 2.8 の経済的 sequencing の決定である。

これは、Inception の設計作業と Construction の実装作業の間の、重要な橋渡し stage である。
ここで生成される unit の定義、依存、story マッピングは、Construction phase がどう実行される
かを直接制御する。

この stage は 2 部構成に従う: PART 1 は明確化のための質問を伴う分解 plan を作成し plan の
承認を得る、そして PART 2 は実際の unit 成果物を生成する。

### 入力

- Stage 2.6 からのすべての design 成果物
  （`<record>/inception/application-design/`: components.md,
  component-methods.md, services.md, component-dependency.md, decisions.md）
- `<record>/inception/requirements-analysis/requirements.md`
- `<record>/inception/user-stories/stories.md`（生成された場合）

### ステップ

**PART 1: 計画**

1. **agent persona をロードする** -- `agents/aidlc-architect-agent.md` からの
   aidlc-architect-agent persona と、`.claude/knowledge/aidlc-architect-agent/` からの
   knowledge をロードする。実現可能性の検証と優先順位付けのために、
   `agents/aidlc-delivery-agent.md` からの aidlc-delivery-agent persona と、
   `.claude/knowledge/aidlc-delivery-agent/` からの knowledge をロードする。

2. **以前のコンテキストをロードする** -- `<record>/inception/application-design/` から
   すべての成果物（5 ファイルすべて）を読む。要件を読む。user story を読む（生成された
   場合）。scope の文脈は `<record>/aidlc-state.md` から来る。

3. **質問を伴う分解 plan を作成する** -- 次をカバーする、`[Answer]:` タグ形式を使った質問を
   伴う `<record>/inception/units-generation/units-generation-questions.md` を作成する:
   - Unit 境界の戦略（サービス別、機能別、ドメイン別、デプロイターゲット別）
   - Unit 粒度の好み（粗粒度 vs. 細粒度）
   - 依存順序の好み（厳密なトポロジカルのみ、または独立した Unit 間の並列性を許す）
   - Unit 間の統合ポイントとコントラクト（API、共有データ、events）
   - デプロイモデル（モノリシックデプロイ、独立デプロイ、ハイブリッド）

   NOTE: 実装順序の優先度（value-first、risk-first、walking-skeleton-first）については
   尋ねてはならない。それらは Stage 2.8 Delivery Planning に属する経済的 sequencing の
   決定である。

4. **回答を収集し分析する** -- stage-protocol.md セクション 3 の質問フローに従って回答を
   収集する。MANDATORY な曖昧さ分析: 曖昧な言葉遣い、矛盾、欠けている詳細をスキャンする。
   何らかの曖昧さが見つかった場合、フォローアップの質問を作成する。先へ進む前にすべての
   曖昧さを解決する。

5. **plan の承認を得る** -- AskUserQuestion 経由で分解 plan を user へ提示する:
   アプローチ（Unit 境界の戦略、推定 unit 数、依存構造）を要約する。オプション:
   Approve Plan / Revise Plan。

**PART 2: 生成**

6. **plan を実行する -- unit 成果物を生成する** -- 承認された plan に基づいて、3 個の出力
   成果物を生成する（下記の出力を参照）。

7. **完了の準備** -- unit 成果物を検証し、Construction のための unit リストを記録する。
   state を編集しない; gate の結果を `aidlc-orchestrate.ts` を通じて report する。

8. **完了の提示と承認の要求** -- :wrench: emoji、定義された unit のサマリ、マップされた依存、
   割り当てられた story、レビューパスを伴う完了メッセージを表示する。標準の 2 択承認 gate:
   Approve（Construction phase へ続く）/ Request Changes。

### 出力

3 個すべての成果物は `<record>/inception/units-generation/` に書き出される:

| ファイル                         | 内容                                                        |
|---------------------------------|-------------------------------------------------------------|
| `unit-of-work.md`               | Unit の定義（名前、説明、境界）、責務、Unit ごとのデプロイモデル（standalone/shared/embedded）、相対的な複雑さの見積もり（S/M/L/XL）、unit の種別（`service`/`spec`/`ui`/`packaging`/`library`、どの construction design 成果物が適用されるかを駆動する）、実装ノートと制約 |
| `unit-of-work-dependency.md`    | Unit 間の依存 DAG（有向エッジ、サイクルなし）、統合ポイント（API/共有データ/events）、並列開発の機会（互いに依存の無い Unit の集合）。トポロジのみで、経済的な経路選択（推奨順序、クリティカルパス）は 2.8 の仕事である。フェンスされた `yaml` エッジブロックは DAG を反映し、各 unit に任意の `kind:` をタグ付けできる（[Runtime グラフ](../13-runtime-graph.md) `bolt_dag.units[].kind` を参照） |
| `unit-of-work-story-map.md`     | 各 user story を実装する Unit へマップ、複数の Unit にまたがる横断的な story、各 Unit 内での story 実装順序、カバレッジの検証（すべての story が割り当てられ、すべての Unit が story を持つ） |

加えて、質問ファイルが入力として作成される:

| ファイル                               | 内容                                              |
|---------------------------------------|---------------------------------------------------|
| `units-generation-questions.md`       | `[Answer]:` タグを伴う分解の質問                  |

### 承認 gate

標準の 2 択 gate: **Approve**（Construction phase へ続く）/ **Request Changes**。

### 注記

- **この stage の出力が Construction を駆動する。** `unit-of-work.md` ファイルは、
  Construction phase がその Unit ごとのループで反復する Unit を定義する。各 Unit は、次の
  Unit が始まる前に、適用可能な Construction stage（Functional Design、NFR Requirements、
  NFR Design、Infrastructure Design、Code Generation）を通過する。
- **2.7 は scope に入っているとき ALWAYS。** コンパイル済み scope グリッドでは、2.7 と 2.8 は
  一緒に移動する（scope ごとに両方 EXECUTE か両方 SKIP）。この stage には単一 unit の
  スキップ条件は無い — 単一 Unit のフローでも自明な DAG を生成する。
- 2 部構成（plan してから生成）により、user は Unit が定義される前に分解戦略を承認できる。
  ステップ 5 には、最終の完了 gate とは別の中間承認 gate（Approve Plan / Revise Plan）が
  ある。
- 依存 DAG は 2.8 の経済的な Bolt sequencing へ供給される。2.8 は、リスク、価値、学習で
  重み付けされた経路を DAG の中から選ぶ。
- story map はトレーサビリティを提供する: すべての user story は少なくとも 1 つの Unit に
  割り当てられねばならず、すべての Unit は少なくとも 1 つの story を持たねばならない。
- aidlc-delivery-agent は実現可能性の検証と優先順位付けの入力を提供し、分解が delivery の
  視点から実践的であることを保証する。

---

## Stage 2.8: Delivery Planning

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Inception                                                              |
| Stage #          | 2.8                                                                    |
| 条件             | ALWAYS -- Inception の総仕上げ stage                                    |
| Lead Agent       | aidlc-delivery-agent                                                         |
| Support Agents   | aidlc-architect-agent（アーキテクチャ依存に照らしてビルド順序を検証する） |
| モード           | inline                                                                 |
| 完了 Emoji       | :calendar:                                                             |

### 目的

Delivery Planning は Inception phase の総仕上げである。Bolt シーケンス — Stage 2.7 が生成した
Unit of Work が Construction を通じて実行される順序 — を計画する。Stage 2.7 が分析的
（依存 DAG）であるのに対し、Stage 2.8 は経済的である: リスク、価値、チームのキャパシティ、
学習で重み付けされた経路を DAG の中から選ぶ。

`stage-protocol.md` の正規の Glossary によると、**Bolt** とは「Construction 内のデプロイ可能な
unit of work — stage 3.1〜3.5 を通る 1 回のパス」である。Bolt は 1 つ以上の Unit of Work に
対する Construction の 1 回のパスであり、MMF や sprint とは異なる。（stage 3.6 build-and-test
と 3.7 ci-pipeline は Bolt ごとではなく、すべての Bolt をまたいで最後に 1 回走る。）

経済的価値は DAG から導けない — AI agent はトポロジカルにソートできるが、どの Bolt が最も速く
市場仮説を検証するか、あるいはどれがコミットメントが積み重なる前に最も恐ろしい未知を露わに
するかは決められない。それはこの stage で捉えられる人間の価値判断である。

この stage はまた、Construction へ遷移する前にすべての Inception 成果物の完全性を検証する、
phase 境界 verification チェックを走らせる。

**重要な区別:** この stage は Bolt sequencing を計画する。どの AI-DLC stage をどの depth で
走らせるかは決めない — それは `/aidlc` skill の scope 選択によって扱われる。

### 入力

すべての Inception phase 成果物:

- Stage 2.3 からの要件（`<record>/inception/requirements-analysis/`）
- Stage 2.4 からの user story（`<record>/inception/user-stories/`）
- Stage 2.6 からの application design
  （`<record>/inception/application-design/`）
- Stage 2.7 からの unit（`<record>/inception/units-generation/`）
- Stage 1.5 からの team formation
  （`<record>/ideation/team-formation/`）、存在する場合

### ステップ

1. **agent persona をロードする** -- `agents/aidlc-delivery-agent.md` からの
   aidlc-delivery-agent persona と、`.claude/knowledge/aidlc-delivery-agent/` からの
   knowledge をロードする。ビルド順序の検証のために aidlc-architect-agent をロードする。

2. **以前のコンテキストをロードする** -- すべての Inception phase 成果物を読む: 要件、
   user story、application design、unit、そして team formation（存在する場合）。

3. **明確化のための質問を生成する** -- 次をカバーする質問を伴う
   `<record>/inception/delivery-planning/delivery-planning-questions.md` を作成する:
   - sequencing ヒューリスティック: risk-first、value-first、walking-skeleton-first、
     またはハイブリッド
   - 使う場合は WSJF（Weighted Shortest Job First）のスコアリングモデルと重み
   - 最初の Bolt: スケールする前にアプローチを証明する walking skeleton（Cockburn）
     または確信を築くスライス
   - Unit of Work の Bolt へのバンドリング
   - 各 Bolt の Definition of Done
   - Bolt ごとの確信仮説 — それを出荷することで何が証明されるか
   - Mob-to-Bolt の割り当て（利用可能なとき 1.5 からのチームを参照する;
     それが走らなかったときは AI のみ）
   - 特定の Bolt をゲートする外部依存（API、データ、承認）
   - 最も早く取り組むべき主要なリスク項目

   stage-protocol.md の質問フローに従う。

4. **回答を収集し分析する** -- 選ばれた Bolt シーケンスが 2.7 の依存 DAG を尊重することを
   （aidlc-architect-agent の入力とともに）検証する。トポロジカル順序からの逸脱は、rationale
   成果物で正当化できるようにフラグを立てる。

5. **成果物を生成する** -- `<record>/inception/delivery-planning/` に 4 個の成果物を
   作成する:
   - `bolt-plan.md` — Bolt の順序付きシーケンス; Bolt ごとの Unit of Work、
     walking-skeleton マーカー、Definition of Done、確信仮説、期待されるデモ。
   - `team-allocation.md` — Bolt-to-mob の割り当て; チーム数 > 1 のときは Program Board
     相当。
   - `risk-and-sequencing-rationale.md` — Bolt 順序の背後にある理由:
     WSJF スコア、risk-first の論拠、walking-skeleton-first の論拠、または
     value-first の論拠。
   - `external-dependency-map.md` — ゲートされた項目を消費する Bolt へマップ
     （完全に AI で完結するときは軽量または空）。

6. **phase 境界 verification** -- Inception-to-Construction の verification チェックを
   走らせる:
   - Requirements から Stories、Architecture への整合
   - すべての story が要件へトレースする
   - アーキテクチャがすべての story をカバーする
   - 結果を `<record>/verification/phase-check-inception.md` へ書く

7. **完了の準備** -- delivery と境界 verification の成果物を検証する。phase または stage の
   state を書かない; 承認 report が Inception-to-Construction のアトミックな遷移を所有する。

8. **完了の提示と承認の要求** -- :calendar: emoji を伴う完了メッセージを表示する。承認 gate:
   Approve（Construction へ進む）/ Request Changes。user はこの gate で stage の
   包含/除外を上書きできる。

### 出力

すべての成果物は `<record>/inception/delivery-planning/` に書き出される:

| ファイル                               | 内容                                                        |
|---------------------------------------|-------------------------------------------------------------|
| `bolt-plan.md`                        | 順序付きの Bolt シーケンス; Bolt ごとの Unit of Work、walking-skeleton マーカー、Definition of Done、確信仮説、期待されるデモ |
| `team-allocation.md`                  | Bolt-to-mob の割り当て; チーム数 > 1 のときは Program Board 相当; 1.5 が走らなかったときは AI のみの割り当て |
| `risk-and-sequencing-rationale.md`    | Bolt 順序についての WSJF / risk-first / walking-skeleton-first / value-first の正当化 |
| `external-dependency-map.md`          | ゲートされた項目（外部 API、データの可用性、承認のリードタイム、外部チームへの引き継ぎ）を消費する Bolt へマップ |
| `delivery-planning-questions.md`      | `[Answer]:` タグを伴う明確化のための質問（入力成果物）      |

phase 境界 verification の出力:

| ファイル                                         | 内容                                        |
|-------------------------------------------------|---------------------------------------------|
| `<record>/verification/phase-check-inception.md` | Inception-to-Construction のトレーサビリティチェック結果 |

### 承認 gate

標準の 2 択 gate: **Approve**（Construction へ進む）/ **Request Changes**。user はこの gate で
stage の包含/除外を上書きできる。

### 注記

- **phase 境界 stage。** これは 3 つの phase 境界 stage のうち 2 番目である（1.7 の後、
  3.7 の前）。verification チェックは Requirements-to-Stories-to-Architecture の整合を
  検証する。
- **経済的 vs トポロジカルな sequencing。** Stage 2.7 は依存 DAG を生成する（トポロジカル
  順序は記述的な幾何として得られる）。Stage 2.8 は、人間の価値判断で重み付けされた経路を
  その DAG の中から選ぶ。risk-first または walking-skeleton-first の論拠がそれを正当化する
  とき、Bolt 順序はトポロジカル順序から逸脱してよい — その逸脱は
  `risk-and-sequencing-rationale.md` に捉えられる。
- **Bolt ≠ sprint ≠ MMF。** 正規の Glossary によると、Bolt は Construction stage 3.1〜3.5 を
  通る 1 回のパスである（3.6 Build and Test と 3.7 CI Pipeline はすべての Bolt の後に 1 回
  走る）。sequencing のヒューリスティック（walking skeleton、WSJF）は Bolt 内に適用される;
  それらは Bolt が何であるかを再定義しない。
- **upstream からの意図的な逸脱。** upstream リファレンスはこの stage を「Workflow Planning」
  と呼び、それを純粋な stage セレクタとして扱う。この実装（「Delivery Planning」に改名）は
  Bolt sequencing、team allocation、リスクの rationale を加える。
- bolt plan は確信を築くシーケンスを定義する。各 Bolt は定義された Unit of Work、
  Definition of Done、確信仮説を持つ。
- aidlc-architect-agent は、提案された Bolt シーケンスが component-dependency と
  unit-of-work-dependency の成果物で定義された依存を尊重することを検証する。
- team allocation は、存在すれば Team Formation の成果物（Stage 1.5）から引く; 1.5 が SKIP
  （mvp、workshop）のときは、すべての Bolt が aidlc-developer-agent（AI）によって実行される。

---

## Phase サマリ

### 主要な出力

Inception phase は、Construction と Operation へ引き継がれる次の主要な出力を生成する:

1. **Reverse Engineering 成果物**（2.1） -- `aidlc/spaces/<active-space>/codekb/<repo>/`
   にあるリポジトリごとの 9 個の成果物で、既存コードベースを文書化する: ビジネス概観、
   アーキテクチャ、コード構造、API ドキュメント、コンポーネントインベントリ、テクノロジ
   スタック、依存、コード品質評価、タイムスタンプ。（brownfield プロジェクトのみ。）
2. **要件ドキュメント**（2.3） -- 形式的な要件: 機能、非機能、制約、前提、スコープ外、
   オープンな質問。
3. **User Stories とペルソナ**（2.4） -- 受け入れ基準、優先度、依存を伴う user story;
   ユーザーペルソナの定義。（該当する場合。）
4. **Refined Mockups**（2.5） -- 中〜高忠実度のモックアップ、インタラクション仕様、
   デザインシステムのマッピング、アクセシビリティチェックリスト。（該当する場合。）
5. **Application Design**（2.6） -- コンポーネント定義、メソッドシグネチャ、サービス定義、
   依存マトリクス、architecture decision record。（該当する場合。）
6. **Units of Work**（2.7） -- 境界と複雑さの見積もりを伴う unit 定義、ビルド順序を伴う
   unit 依存マトリクス、story-to-unit マッピング。（該当する場合。）これは Construction の
   phased construction フローを駆動する成果物である。
7. **Delivery Plan**（2.8） -- bolt plan、ビルド順序、依存マトリクス、team allocation。
   これは Construction と Operation を統べる実行計画である。
8. **Phase 境界 verification**（2.8） -- Inception-to-Construction のトレーサビリティ
   チェックで、`<record>/verification/phase-check-inception.md` へ書かれる。

### Construction への引き継ぎ

Stage 2.8 での承認をもって、フレームワークは Construction phase へ遷移する。Construction は
Delivery Planning からの実行計画に基づいて stage レベルのタスクを作成し、phased construction
フローを実行する:

Construction は `bolt-plan.md` に従って Bolt ごとに走り、bolt plan に従って並列バッチが
許される。各 Bolt は 1 つ以上の Unit の一貫したスライスをカバーする
（`unit-of-work.md` と `unit-of-work-dependency.md` に従う）:

各 Bolt について:
1. **3.1 Functional Design**（実行計画に応じて条件付き）
2. **3.2 NFR Requirements**（実行計画に応じて条件付き）
3. **3.3 NFR Design**（実行計画に応じて条件付き）
4. **3.4 Infrastructure Design**（実行計画に応じて条件付き）
5. **3.5 Code Generation**（常時、Bolt 内の unit ごと）

最後の Bolt が完了した後:
6. **3.6 Build and Test**（常時）
7. **3.7 CI Pipeline**（条件付き）

Bolt は依存グラフが許す限り並列バッチで走れる; walking-skeleton の Bolt は、並列バッチが
始動する前に end-to-end の形を検証するため、常に単一 Bolt のバッチとして最初に走る。
完全な Bolt ごとのナラティブは `docs/guide/04-phases-and-stages.md:263-293` を参照。

### 相互参照

- **Orchestrator**: `dist/claude/.claude/skills/aidlc/SKILL.md` --
  ルーティングロジック、scope-to-stage マッピング、stage グラフ、Construction フローの定義
- **Stage Protocol**: `dist/claude/.claude/aidlc-common/protocols/stage-protocol.md`
  -- 承認 gate、質問形式、完了メッセージ、そして §13 の Learnings Ritual。phase 境界
  verification は `stage-protocol-governance.md` §13 に住む。
- **Ideation Phase**: `docs/reference/04-stages/ideation.md` -- 前の phase の
  ドキュメント
- **Construction Phase**: Construction stage は、Stage 2.8 が生成した delivery plan に
  従って実行される
- **Deliberate Deviations**: SKILL.md は、always-rerun の RE ポリシー、aidlc-design-agent の
  support 追加、ADR 成果物、Delivery Planning の拡張を含む、upstream リファレンスからの
  意図的な差異を文書化している
