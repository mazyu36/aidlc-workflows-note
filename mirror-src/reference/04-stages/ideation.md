# Ideation phase — stage リファレンス (1.1-1.7)

## phase の概要

Ideation phase は AI-DLC ライフサイクルの 5 つの phase のうち 2 番目である。intent を捕捉し、
実現性を検証し、scope を定義し、いかなる技術的作業に着手する前にも承認を確保することで、
イニシアチブ全体の土台を確立する。この phase は stage 1.1 から 1.7 までを実行し、Inception
phase への移行を制御する go/no-go gate で締めくくる。

7 つの stage はすべて inline で実行され（subagent への委譲は無い）、承認 gate・質問フォーマット・
完了メッセージについて標準の stage-protocol.md に従う。orchestrator はそれらを順にルーティング
し、現在の scope に当てはまらない CONDITIONAL の stage をスキップする。

**Ideation phase の主な特徴:**

- どの stage も inline 実行モードを用いる（ユーザーとの直接の対話）。
- stage は intent の record dir 配下 `<record>/ideation/<stage-name>/` に成果物を生成する。ここで `<record>` は `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` である（`audit/` シャードディレクトリ、stage ごとの `memory.md`、verification レポートも同じ record dir 配下に置かれる）。
- Stage 1.1 を除くすべての stage は、先行する stage の出力に依存する。
- Stage 1.7 は Inception へ引き継ぐ前に phase 境界の検証チェックを実行する。
- この phase は 2 つの ALWAYS stage（1.1 Intent Capture と 1.7 Approval & Handoff）で挟まれる;
  中間の 5 つの stage は CONDITIONAL で、scope に応じてスキップされうる。

**Scope 駆動の stage 選択:**

| Scope            | 含まれる stage                              |
|------------------|---------------------------------------------|
| enterprise       | 1.1-1.7 すべて                              |
| feature          | 1.1-1.7 すべて                              |
| mvp              | 1.1, 1.3（light）, 1.4, 1.6                 |
| poc              | 1.1（最小限）                               |
| bugfix           | なし（Ideation を完全にスキップ）           |
| refactor         | なし（Ideation を完全にスキップ）           |
| infra            | なし（Ideation を完全にスキップ）           |
| security-patch   | なし（Ideation を完全にスキップ）           |
| workshop         | なし（Ideation を完全にスキップ）           |

---

## stage サマリテーブル

| Stage | 名称                        | 条件        | リード agent    | サポート agent                              | モード |
|-------|-----------------------------|-------------|-----------------|---------------------------------------------|--------|
| 1.1   | Intent Capture & Framing    | ALWAYS      | aidlc-product-agent   | aidlc-architect-agent                             | inline |
| 1.2   | Market Research             | CONDITIONAL | aidlc-product-agent   | --                                          | inline |
| 1.3   | Feasibility & Constraints   | CONDITIONAL | aidlc-architect-agent | aidlc-aws-platform-agent, aidlc-compliance-agent        | inline |
| 1.4   | Scope Definition            | ALWAYS      | aidlc-product-agent   | aidlc-delivery-agent                              | inline |
| 1.5   | Team Formation              | CONDITIONAL | aidlc-delivery-agent  | --                                          | inline |
| 1.6   | Rough Mockups               | CONDITIONAL | aidlc-design-agent    | aidlc-product-agent                               | inline |
| 1.7   | Approval & Handoff          | ALWAYS      | aidlc-delivery-agent  | aidlc-product-agent                               | inline |

---

## Stage 1.1: Intent Capture & Framing

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.1                                                                    |
| 条件             | ALWAYS — 全ワークフローの最初の stage; イニシアチブの土台を確立する      |
| リード agent     | aidlc-product-agent                                                          |
| サポート agent   | aidlc-architect-agent（技術的コンテキスト）                                   |
| レビュアー       | aidlc-product-lead-agent（source の裏付けとプロダクト品質のレビュー）       |
| モード           | inline                                                                 |
| 完了 Emoji       | :bulb:                                                                 |

### 目的

Intent Capture はあらゆる AI-DLC ワークフローの入口である。ビジネス上の問題を捕捉し、
ステークホルダーを特定し、成功指標を確立し、プロジェクトタイプ（greenfield・brownfield・
migration）を分類する。生成される intent statement と stakeholder map は、下流のすべての
stage が積み上げる土台となる。

ユーザーが `$ARGUMENTS` 経由で自由記述の intent テキストを与えた場合、そのテキストは seed
コンテキストとして渡され、stage は「何を作りたいか？」と再度問わない。

### 入力

- `$ARGUMENTS` またはその intent の `audit/` シャードから得るユーザーのプロジェクト記述
- 過去のセッションからの既存の `<record>/` 成果物（あれば）
- `aidlc/spaces/<active-space>/memory/` からの guardrails

### Steps

1. **agent persona のロード** — aidlc-product-agent の persona と knowledge をロードする。技術的コンテキストの視点のため aidlc-architect-agent の persona をロードする。
2. **先行コンテキストのロード** — ユーザーのプロジェクト記述を読む。既存の成果物を確認する。guardrails をロードする。
3. **明確化のための質問の生成** — 最初の記述・ワークフローが選んだ scope・使用したアクティブ memory の rule のための `## Sources` register とともに `<record>/ideation/intent-capture/intent-capture-questions.md` を作成する。ビジネス上の問題・顧客・成功指標・イニシアチブの契機・ステークホルダー・決定権限・コミュニケーション要求、そしてワークフローが選んだ scope が意図するプロダクト境界と合致するかを尋ねる。A-E の選択肢に X（Other）を加えた `[Answer]:` タグ形式を用いる。tri-mode の質問フローを提供する。
4. **回答の収集と分析** — すべてのタグが埋まっていることを確認する。曖昧さ・矛盾の分析を実行する。
5. **裏付けのある成果物の生成** — intent statement と stakeholder map を生成する。実質的な段落・リスト項目・表のデータ行はすべて、インラインの `[desc]`・`[scope]`・`[Q<n>]`・`[memory:<id>]`・`[assumption]` のいずれかのタグを運ぶ。両方のファイルは `## Assumptions & Open Questions` を含む。
6. **assumption の解決** — いずれかの成果物が assumption を残す場合、それを受諾するか、フォローアップの質問に変換するようユーザーに求める。受諾は assumption のラベルを保つ; 主張を事実へ昇格させない。
7. **完了の準備** — Product Lead のレビューを実行し、両方の成果物を検証し、gate の結果を
   `aidlc-orchestrate.ts` 経由で報告する。
8. **完了の提示と承認の要求** — 標準の 2 択 gate。

### 出力

| ファイル                       | 内容                                                          |
|-------------------------------|---------------------------------------------------------------|
| `intent-statement.md`         | source タグ付きの問題の記述・対象顧客・成功指標・イニシアチブの契機、およびワークフローが選んだ scope 対ユーザーが確認した初期の scope シグナル; 必須の assumption セクション |
| `stakeholder-map.md`          | source タグ付きのステークホルダーと関心事、意思決定者 対 影響者、コミュニケーション要件; 必須の assumption セクション |
| `intent-capture-questions.md` | 許可された source の register、`[Answer]:` タグ付きの明確化質問、必要な場合の assumption の確認 |

### 補足

- 全ワークフローの最初の stage。ユーザー入力以外に先行成果物は無い。
- `$ARGUMENTS` 内の自由記述の intent は seed コンテキストとして用いられる。
- 選ばれなかった選択肢は除外でも要件でもない。裏付けの無い内容は省略されるか、
  フォローアップで引き出されるか、明示的な assumption としてのみ保持される。
- intent statement は後続のすべての Ideation stage に供給され、Inception へと引き継がれる。

---

## Stage 1.2: Market Research & Competitive Analysis

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.2                                                                    |
| 条件             | CONDITIONAL — 内部ツール・バグ修正・リファクタリングではスキップ         |
| リード agent     | aidlc-product-agent                                                          |
| サポート agent   | (なし)                                                                 |
| モード           | inline                                                                 |
| 完了 Emoji       | :bar_chart:                                                            |

### 目的

外部の競合状況に照らしてイニシアチブを検証する。competitive analysis・market trends・build-vs-buy 評価・差別化戦略を生成する。

### 入力

- Stage 1.1 からの intent statement

### 出力

| ファイル                        | 内容                                                        |
|---------------------------------|-------------------------------------------------------------|
| `competitive-analysis.md`       | 競合状況、競合プロファイル、強み/弱み |
| `market-trends.md`              | 業界トレンド、規制の変化、市場規模             |
| `build-vs-buy.md`               | build-vs-buy-vs-partner の評価                          |
| `market-research-questions.md`  | `[Answer]:` タグ付きの明確化質問                  |

### 補足

- スキップ条件: 内部ツール、バグ修正、リファクタリング、インフラのみ、セキュリティパッチ、poc scope。
- Stage 1.3 Feasibility（実行された場合）と Stage 1.4 Scope Definition に供給される。

---

## Stage 1.3: Feasibility & Constraint Analysis

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.3                                                                    |
| 条件             | CONDITIONAL — 些細な変更ではスキップ; 技術的リスクやコンプライアンス上の必要がある場合は実行 |
| リード agent     | aidlc-architect-agent（技術的実現性）                                        |
| サポート agent   | aidlc-aws-platform-agent（AWS の全体像）、aidlc-compliance-agent（規制スキャン） |
| モード           | inline                                                                  |
| 完了 Emoji       | :test_tube:                                                            |

### 目的

技術的な成立性を評価し、制約を特定し、RAID log（Risks, Assumptions, Issues, Dependencies）を確立する。マルチエージェント stage: architect が主導し、続いて aws-platform と compliance が入力を与える。

### 入力

- Stage 1.1 からの intent statement
- Stage 1.2 からの market research（実行された場合）

### 出力

| ファイル                     | 内容                                                           |
|------------------------------|----------------------------------------------------------------|
| `feasibility-assessment.md`  | 技術的成立性、リスク分析                             |
| `constraint-register.md`     | 技術的・組織的・規制上の制約          |
| `raid-log.md`                | Risks, Assumptions, Issues, Dependencies                       |
| `feasibility-questions.md`   | `[Answer]:` タグ付きの明確化質問                     |

### 補足

- mvp scope では "light" の depth で実行する。
- マルチエージェントのパターン: orchestrator はまず lead agent を走らせ、続いて lead の出力をコンテキストとして support agent を走らせる。

---

## Stage 1.4: Scope Definition & Prioritization

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.4                                                                    |
| 条件             | ALWAYS — depth は scope に適応する                                      |
| リード agent     | aidlc-product-agent                                                          |
| サポート agent   | aidlc-delivery-agent（キャパシティの実態チェック）                           |
| モード           | inline                                                                 |
| 完了 Emoji       | :dart:                                                                 |

### 目的

scope の境界を確立する。MoSCoW・WSJF・RICE のいずれかの優先順位付けと value stream map を用いて、優先順位付けされた intent backlog（proto-unit of work）を生成する。

### 入力

- Stage 1.1 からの intent statement
- Stage 1.3 からの feasibility assessment（存在する場合）

### 出力

| ファイル                          | 内容                                                      |
|-----------------------------------|-----------------------------------------------------------|
| `scope-document.md`               | in/out の scope 境界の定義                          |
| `intent-backlog.md`               | proto-unit の優先順位付けされた backlog（MoSCoW/WSJF/RICE） |
| `scope-definition-questions.md`   | `[Answer]:` タグ付きの明確化質問                |

### 補足

- 常に実行され、depth は scope に適応する。
- scope document はプロジェクト全体の権威ある境界となる。

---

## Stage 1.5: Team Formation & Mob Planning

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.5                                                                    |
| 条件             | CONDITIONAL — 単独開発者や小規模チームのプロジェクトではスキップ         |
| リード agent     | aidlc-delivery-agent                                                         |
| モード           | inline                                                                 |
| 完了 Emoji       | :people_holding_hands:                                                 |

### 目的

チームの空き状況を評価し、スキルをマッピングし、ギャップを特定し、mob 構成の計画を生成する。

### 入力

- Stage 1.4 からの scope definition
- Stage 1.3 からの feasibility assessment（存在する場合）

### 出力

| ファイル                        | 内容                                                        |
|---------------------------------|-------------------------------------------------------------|
| `team-assessment.md`            | チームの空き状況、RACI マトリクス、キャパシティの割り当て         |
| `skill-matrix.md`               | 必要なスキル 対 利用可能なスキル、ギャップ分析                 |
| `mob-composition.md`            | mob 構成の計画、チームトポロジー                         |
| `team-formation-questions.md`   | `[Answer]:` タグ付きの明確化質問                  |

### 補足

- スキップ条件: 単独開発者のプロジェクト、小規模チーム、poc・bugfix・refactor scope。
- Stage 2.8 Delivery Planning に供給される。

---

## Stage 1.6: Rough Mockups & Concept Visualization

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.6                                                                    |
| 条件             | CONDITIONAL — non-UI・API のみ・インフラのみではスキップ                 |
| リード agent     | aidlc-design-agent                                                           |
| サポート agent   | aidlc-product-agent（intent に照らして検証）                                 |
| モード           | inline                                                                 |
| 完了 Emoji       | :pencil2:                                                              |

### 目的

初期のコンセプトビジュアライゼーションを生成する。UI の場合: 低忠実度のワイヤーフレームとユーザーフロー図。non-UI の場合: システムコンテキスト図とインタラクションフローのスケッチ。すべての図は stage-protocol.md の ASCII 標準に従う。

### 入力

- Stage 1.1 からの intent statement
- Stage 1.4 からの scope definition

### 出力

| ファイル                       | 内容                                                           |
|-------------------------------|----------------------------------------------------------------|
| `wireframes.md`               | 低忠実度のワイヤーフレーム（UI）またはシステムコンテキスト図（non-UI） |
| `user-flow.md`                | 中心的なユーザーフロー図（UI）またはインタラクションフローのスケッチ（non-UI） |
| `rough-mockups-questions.md`  | `[Answer]:` タグ付きの明確化質問                     |

### 補足

- スキップ条件: non-UI・API のみ・インフラのみのイニシアチブ。
- Inception の Stage 2.5 Refined Mockups に供給される（その stage も実行される場合）。

---

## Stage 1.7: Initiative Approval & Handoff

### メタデータ

| フィールド        | 値                                                                     |
|------------------|------------------------------------------------------------------------|
| Phase            | Ideation                                                               |
| Stage #          | 1.7                                                                    |
| 条件             | ALWAYS — Inception の前の最後の Ideation gate                           |
| リード agent     | aidlc-delivery-agent                                                         |
| サポート agent   | aidlc-product-agent（完全性を検証）                                          |
| モード           | inline                                                                 |
| 完了 Emoji       | :white_check_mark:                                                     |

### 目的

すべての Ideation 成果物を単一の initiative brief にまとめ、すべての決定を記録し、phase 境界の検証を実行し、go/no-go gate を提示する。

### 入力

stage 1.1-1.6 からのすべての Ideation phase 成果物。

### Steps

1. aidlc-delivery-agent の persona と knowledge をロードする。
2. すべての Ideation phase 成果物を読む。
3. 承認質問を生成する。
4. initiative brief（全出力をまとめた one-pager）をまとめる。
5. phase 境界の検証（Intent -> Scope -> Intent Backlog の一貫性）。
6. handoff と phase 境界の成果物を検証する; ライフサイクルの state を直接編集しない。
7. 3 択の承認 gate を提示する。承認されたら結果を報告し、engine が stage を完了して Inception
   へアトミックに遷移するようにする。

### 出力

| ファイル                          | 内容                                                      |
|-----------------------------------|-----------------------------------------------------------|
| `initiative-brief.md`             | 全 Ideation 出力をまとめた 1 ページの要約           |
| `decision-log.md`                 | Ideation 中に下されたすべての決定の記録              |
| `approval-handoff-questions.md`   | `[Answer]:` タグ付きの承認質問                  |

phase 境界の検証:

| ファイル                                      | 内容                                        |
|-----------------------------------------------|---------------------------------------------|
| `<record>/verification/phase-check-ideation.md` | Ideation から Inception へのトレーサビリティ検査 |

### 承認 gate

特殊な 3 択 gate:

- **Approve** — Inception phase へ進む
- **Request Changes** — 修正のフィードバックを与える
- **Reject Initiative** — ワークフローを完全に終了する

### 補足

- phase 境界の stage — stage-protocol のガバナンスに従って verification を実行する。
- initiative brief は Ideation phase 全体のエグゼクティブサマリとして機能する。

---

## phase のサマリ

### 主要な出力

1. **Intent Statement**（1.1）— 問題の記述、対象顧客、成功指標、プロジェクトの分類。
2. **Stakeholder Map**（1.1）— 主要なステークホルダー、意思決定者、コミュニケーション要件。
3. **Competitive Analysis**（1.2）— 市場でのポジショニング、build-vs-buy（該当する場合）。
4. **Feasibility Assessment and RAID Log**（1.3）— 技術的成立性、リスク登録簿、制約（該当する場合）。
5. **Scope Document and Intent Backlog**（1.4）— 権威ある scope 境界、優先順位付けされた proto-unit のリスト。
6. **Team Plan**（1.5）— skill matrix、mob 構成、キャパシティの割り当て（該当する場合）。
7. **Concept Mockups**（1.6）— ワイヤーフレーム/ユーザーフロー、またはシステムコンテキスト図（該当する場合）。
8. **Initiative Brief**（1.7）— 全 Ideation 出力を統合したエグゼクティブ one-pager。
9. **Phase Boundary Verification**（1.7）— トレーサビリティ検査の結果。

### Inception への引き継ぎ

Stage 1.7 での承認をもって、フレームワークは Inception phase へ遷移する。Inception は
Stage 2.1 Reverse Engineering（brownfield プロジェクトの場合）または Stage 2.3 Requirements
Analysis（greenfield プロジェクトの場合）で始まる。

## 関連

- [Orchestrator](../03-orchestrator.md) — ルーティングのロジック、scope から stage へのマッピング
- [Stage Protocol](../04-stage-protocol.md) — 承認 gate、質問フォーマット、phase 境界の検証
- [Inception Stages](inception.md) — 次の phase
- [Initialization Stages](initialization.md) — 前の phase
