# Sensor システム

> 対象読者: Tier 2/3（team adopter、framework contributor）。

この章は AI-DLC の sensor manifest の **スキーマリファレンス** である — stage の出力への書き込みで発火する決定論的なチェックのことである。sensor は制御ループのフィードバックの半分であり、rule はフィードフォワードの半分である（次章の [Rule システム](08-rule-system.md) を参照）。[Plane アーキテクチャ](02-plane-architecture.md) の章は、両者を compile が各 stage ノードへ解決する control-plane の入力として枠づける。

この章は manifest の *ファイル形式* を扱う — sensor manifest が何を含むか、stage がどう sensor をインポートするか、同梱される 4 つの manifest がどう設定されるか。ワークフロー中に sensor がどう発火するかのユーザー向けのビューは、ユーザーガイドの [Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) を参照。

> **パス規約。** 以下の `<record>/` = アクティブな intent の record dir、
> `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`（コンパクトな UTC 日付プレフィックスと
> 短い kebab-case ラベルなので、record dir は時系列でソートされる; 正準の id は
> `intents.json` レジストリ行に格納される UUIDv7 である）。同梱 manifest 中の 2 つの
> document-shape sensor の `matches` glob は、なおレガシーの artifact-tree パスを運ぶことに
> 注意（スキーマを文書化する下部で逐語引用する）。

ランタイムの振る舞いは [Stage プロトコル](04-stage-protocol.md) を参照。stage 定義のファイル形式の対応物は [Stage 定義](15-stage-definition.md) にある。

---

## Manifest の位置とファイル名

sensor manifest は次に住む:

```
dist/claude/.claude/sensors/aidlc-<id>.md
```

すべての framework 同梱の manifest は `aidlc-` ファイル名プレフィックスを運ぶ（より広い framework ファイルの規約に合致する）。frontmatter の `id:` フィールドは、`aidlc-` プレフィックスを除き `.md` サフィックスを剥いだファイル名の語幹に等しくねばならない:

| ファイル名 | 必須の `id:` |
|---|---|
| `aidlc-required-sections.md` | `required-sections` |
| `aidlc-linter.md` | `linter` |

ファイル名↔id ルールは `tests/unit/t86-sensor-manifest-schema.sh` が強制する。`aidlc-` プレフィックスは **カスタムのユーザー同梱のものを含め、すべての sensor に必須である**: compile resolver は `SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`（`aidlc-graph.ts` の `loadSensors`）で manifest を発見するので、プレフィックスの無いファイルは静かにスキップされ、決して stage に束縛されない。カスタムの sensor は `aidlc-<id>.md` と名付け、`id: <id>` を設定する。

---

## Sensor Manifest スキーマ

すべての manifest は YAML frontmatter と本体を持つ Markdown ファイルである。frontmatter は構造化された契約 — 純粋な capability descriptor — であり、本体はチェックを文書化する人間の散文である。manifest は *sensor が何であるか* を述べ、どの stage がそれを使うかは述べない; その関係は stage の frontmatter の `sensors:` フィールドを介して stage 側に住む（下の [stage がどう sensor をインポートするか](#how-stages-import-sensors) を参照）。

```yaml
---
id: required-sections                       # required
kind: deterministic                          # required
command: bun .claude/tools/aidlc-sensor-required-sections.ts   # required
default_severity: advisory                   # required
description: Checks that stage output ...    # required
category: document-shape                     # optional
matches: "**/{aidlc-docs,intents}/**"                  # optional capability filter
input_schema:                                # optional
  output_path: string
  stage_slug: string
output_schema:                               # optional
  pass: boolean
  missing_headings: string[]
timeout_seconds: 5                           # optional
---

# required-sections sensor

<body — prose documenting default mode, override mode, failure mode>
```

| フィールド | 必須 | 型 | 備考 |
|---|---|---|---|
| `id` | ✓ | kebab-case 文字列 | `aidlc-` プレフィックスを除いたファイル名の語幹に等しい; rule ファイルの `pairing:` フィールドから相互参照される（[Rule システム](08-rule-system.md) を参照）。 |
| `kind` | ✓ | enum | 今日受理されるのは `deterministic` のみ; `llm` は v0.11.0 の LLM-dispatch 章に予約されている。下の [`kind` enum](#kind-enum) を参照。 |
| `command` | ✓ | string | 正準の起動プレフィックス — 各同梱 sensor はそれ自身の sensor ごとのスクリプトを名指す（例: `bun .claude/tools/aidlc-sensor-required-sections.ts`）。dispatcher（`aidlc-sensor.ts`）は `--stage <slug>` に続けて、sensor の入力形状に合致するファイルフラグを追記する: document sensor には `--output-path <path>`、コード sensor（`linter`、`type-check`）には `--file-path <path>`。 |
| `default_severity` | ✓ | enum | 今日受理されるのは `advisory` のみ; `blocking` は将来の ralph-driver 作業に予約されている。 |
| `description` | ✓ | string | 1 行の人間向け説明。 |
| `category` | optional | string | 自由形式の記述ラベル（4 つの同梱 manifest は `document-shape` と `code-quality` を使う; 閉じた enum ではない）。 |
| `matches` | optional | glob string | 発火時に PostToolUse hook が消費する capability filter。下の [`matches` フィルタ](#matches-filter) を参照。 |
| `input_schema` | optional | object | 今日は助言的; 将来の LLM dispatch がテンプレート化契約として使う。 |
| `output_schema` | optional | object | 今日は助言的; 将来の LLM dispatch がパース契約として使う。 |
| `timeout_seconds` | optional | int | 発火ごとの実時間の上限。 |

---

## `kind` enum

`kind` フィールドは dispatch 機構を宣言する。スキーマが今日受理するのは正確に 1 つの値である:

- `deterministic` — manifest の `command:` は自己完結したシェル起動であり、0（pass）/ 非 0（fail）で終了し、既知のパスに構造化された detail を書く。

`llm` は **LLM-dispatch 章に予約されている**（v0.11.0+）。その章が出るまで、consumer は parse 時に `kind: llm` を拒否せねばならない。予約は write 時に強制される: 今日 `kind: llm` manifest を出すことは、parser が拒否する manifest 著者のエラーである。

`kind` の未知の値（`deterministic` 以外の何か）は parse 時に拒否される。前方互換は *未知のキー* に適用される（[前方互換ポリシー](#forward-compat-policy) を参照） — 既知のキーの未知の値には適用されない。

---

## stage がどう sensor をインポートするか

pull 著述: 各 stage の frontmatter は、それが使う sensor を宣言する。compile resolver は宣言された各 id を manifest レジストリでルックアップし、`sensors_applicable` 配列を stage のコンパイル済みグラフノードに焼き込む。著述の方向は参照の局所性である — stage ファイルを開けば、その stage が走るときどのチェックが発火するかが正確に見える。

```yaml
# dist/claude/.claude/aidlc-common/stages/construction/code-generation.md
---
slug: code-generation
phase: construction
# ...
requires_stage: [...]
sensors:
  - linter
  - type-check
inputs: ...
outputs: ...
---
```

`sensors:` は裸の id のリストである — id は各 manifest の frontmatter の `id:` フィールドに合致し、それは（ファイル名↔id 契約により）`aidlc-` プレフィックスを除いたファイル名の語幹に等しい。compile resolver は:

1. `dist/claude/.claude/sensors/` を歩き、すべての `aidlc-<id>.md` manifest をパースする。
2. 解決時の O(1) ルックアップのため manifest を id で索引する。
3. 各 stage について、宣言された各インポート id をルックアップする; 未知なら投げる（fire 時に静かにではなく、compile 時に大きな音で失敗）。
4. manifest の `matches` filter を逐語で解決済みの `sensors_applicable[]` エントリにコピーする。
5. stage ごとの解決済み配列を正準の `data/stage-graph.json` に発する（FIELD_ORDER 固定: `rules_in_context` の後）。

ランタイムの PostToolUse hook（`aidlc-sensor-fire.ts`）は `sensors_applicable` をグラフノードから読む — 決して manifest を開き直さない。`matches` は compile でスナップショットされる: ワークフロー中の manifest 編集は、進行中のワークフローの書き込みで発火するものを変えない（BGP 安定性の性質 — [Plane アーキテクチャ](02-plane-architecture.md) を参照）。

### stage ごとの sensor マトリクス（32 の framework stage）

| Stage | `sensors:` |
|---|---|
| 3 つの initialization（workspace-scaffold、workspace-detection、state-init） | `[]`（決定論的セットアップ、agent が著述する markdown 無し） |
| 7 つの ideation、8 つの inception、7 つの operation markdown stage + `code-generation` | markdown stage には `[required-sections, upstream-coverage]`; `code-generation` には `[linter, type-check]`（コードのみ） |
| `build-and-test` | `[required-sections, upstream-coverage, type-check]`（linter は意図的に省略 — build が正準の lint を走らせる） |
| 5 つの construction-design（ci-pipeline、functional-design、infrastructure-design、nfr-design、nfr-requirements） | `[required-sections, upstream-coverage, linter, type-check]`（コードサンプルを伴う markdown design） |

fork は stage の `sensors:` リストを直接編集することで stage をカスタマイズする — 束縛はカスタマイズされる対象のすぐ隣に住む。manifest は純粋な capability descriptor である; stage を対象づけるフィールドを運ばない（`applies_to:` は無い — pull 著述がそれを除いた）。strict-additive ランタイムが適用される: fork が stage に sensor を欲するならインポートし、欲しなければ省く。考えるべき上書きレイヤーは無い。

---

## `matches` フィルタ

`matches` は manifest 上の任意のトップレベルの capability descriptor である。sensor が分析できるファイルの glob 形状を宣言し — *「この sensor はこの glob に合致するファイルを分析する」* — resolver が compile 時にではなく、PostToolUse hook が発火時に消費する。

| Manifest | `matches` |
|---|---|
| `aidlc-required-sections.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-upstream-coverage.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-linter.md` | `**/*.{ts,js}` |
| `aidlc-type-check.md` | `**/*.{ts,tsx}` |

`matches` **こそが** fire filter である — 実質的に任意ではない。hook は書き込まれるパスを glob と比較し、合致するときだけ発火する; `matches` glob を **持たない** エントリは一切発火しない（`aidlc-sensor-fire.ts`: `if (!entry.matches) continue`）。だから 4 つの同梱 manifest はすべて 1 つを宣言する — 2 つの document-shape sensor は artifact tree にスコープされ（同梱 manifest は上に示した `matches` 値を運ぶ）、2 つの code-quality sensor はそれぞれの言語 glob にスコープされる。compile resolver は `matches` を逐語で stage ごとの `sensors_applicable[]` エントリにコピーする; hook はスナップショットされた値をグラフノードから読む。

空文字列（`matches: ""`）は parse 時に拒否される。glob が無いことは sensor が決して発火しないことを意味するので、manifest は自身が適用される glob 形状を宣言せねばならない — 「すべてで発火する」モードは無い。

### rule と sensor の間の相互参照

rule ファイルは sensor へフィードフォワードするのに `pairing: aidlc-required-sections`（`aidlc-` プレフィックス付き）を使う; sensor manifest の `id:` は `required-sections`（プレフィックス無し）である。doctor のカバレッジチェックは、manifest の `id` と照合する前に、rule の `pairing:` 値から `aidlc-` プレフィックスを剥いで正規化する。

---

## `default_severity`

`advisory` は v0.5.0 で唯一の有効な値である。advisory な sensor の失敗は audit 行と detail ファイルを生むが、stage の gate やユーザーのワークフローをブロックしない。

`blocking` は将来の ralph driver に予約されている。driver が着地するまで、フィールドは構造上は存在するが、意味論上は単一値である。

---

## `command:` 起動契約

manifest の `command:` は **正準の起動プレフィックス** であり、完全な argv ではない — 各同梱 sensor はそれ自身の sensor ごとのスクリプトを名指す。dispatcher（`aidlc-sensor.ts`）は発火時にランタイムのコンテキストを追記する: 常に `--stage <stage-slug>`、続けて sensor の入力形状に合致するファイルフラグ — document sensor には `--output-path <file>`、コード sensor（`linter`、`type-check`）には `--file-path <file>`:

```
<command> --stage <stage-slug> --output-path <file-being-written>   # document sensor
<command> --stage <stage-slug> --file-path   <file-being-written>   # code sensor
```

だから次を持つ manifest は:

```yaml
command: bun .claude/tools/aidlc-sensor-required-sections.ts
```

intent の record dir に requirements 成果物を書く `requirements-analysis` に対して起動されると、次のように dispatch される:

```
bun .claude/tools/aidlc-sensor-required-sections.ts \
  --stage requirements-analysis \
  --output-path aidlc/spaces/default/intents/260624-inventory-api/inception/requirements-analysis/requirements.md
```

manifest は発火ごとのフラグを符号化しない。dispatcher がそれらを追記する; manifest は純粋な capability descriptor のままである。

---

## Gate-ritual の受け渡し（surface は stdout、selections-file は in）

§13 の learning gate は tool-as-actor である。決定論的なツール（`aidlc-learnings.ts`）と conductor（ライブの `/aidlc` セッション）の間の往復は 2 つのレッグを持ち、その間に knowledge ステップと judgement ステップがある:

1. **`surface`（stdout）。** `bun .claude/tools/aidlc-learnings.ts surface --slug <stage-slug>` は stage の `memory.md` を読み、構造化 JSON を出力する: `candidates[]`（空でない Interpretation / Deviation / Tradeoff エントリごとに 1 つ、各々が `id`、`source_heading`、`ts`、`summary`、`context`、`default_scope: "project"` を運ぶ）と読み取り専用の `parked_open_questions[]`。AskUserQuestion のフィールド名は無い — 純粋なドメインデータである。open question は決して candidate にならない（それらはリサーチ項目である）。
2. **conductor が AskUserQuestion をレンダリングする（knowledge）。** candidate ごとに 1 つのオプション（label = candidate の `summary` を逐語で; description = 導出された宛先、例 `→ memory/project.md (Deviation)`、加えて promote-to-team のアフォーダンス）。`multiSelect` の後、conductor は保持された各 label をその candidate の `id` + `source_heading` に相関づける。それから常に "Anything to add for next time?" と尋ねる; 任意の自由テキストは 1 つの heading-pick AUQ（Interpretation / Deviation / Tradeoff / Open question）を得る — heading pick はユーザーの唯一の分類であり、宛先はそこから導出される。
3. **Admission conflict-check（knowledge → orchestrator-LLM; どの selection が persist に届くかをゲートする）。** 保持された各 learning について、conductor は単一の提案された日付付きエントリを `org.md` の合致する `## <section>` と比較する（§5 admission gate の単一行版）。矛盾があると conductor は衝突する org の文をインラインで表面化し、ユーザーが revise / skip / escalate する（judgement → user; user-override の経路は無い）。conflict-clear か user-escalated な selection だけが進む。sensor manifest には org-section の対応物が無く、このチェックをスキップする。
4. **`persist`（selections-file を in）。** conductor は保持された selection を `<record>/.aidlc-learnings/<slug>-selections.json`（intent の record dir 内）（gitignore 対象）に書き、`bun .claude/tools/aidlc-learnings.ts persist --slug <slug> --selections-json <path>` を呼ぶ。ツールは決定論的なライターである — 決して衝突を判断しない; 各 learning を practice として `aidlc/spaces/<active-space>/memory/{project,team}.md` にルーティングし、sensor selection については 1 つの `withAuditLock` の中で two-write インストール（manifest + 発生元 stage の `sensors:` frontmatter）を行い、それから `RULE_LEARNED` / `SENSOR_PROPOSED` を発する。

selections-file は replay 成果物である: クラッシュした persist は人間に再度プロンプトすることなく同じ JSON を replay する（書き込まれた行ごとの `<!-- cid:<slug>:<id> -->` マーカーによる content-presence の冪等性）。

---

## スキャフォールドされる manifest の既定値

sensor の提案が gate で確認されると、gate-ritual ツールは新しい **project 層** の manifest を `<project>/.claude/sensors/aidlc-<id>.md` にスキャフォールドする — 決して同梱の framework ディストリビューションではない（プロジェクトごとの learning loop は framework を変異させてはならない; framework-distribution のパスは拒否される）。フィールドの既定値は:

| フィールド | 既定値 | 備考 |
|---|---|---|
| `id` | ユーザーの自由テキストから導出（kebab-case にする） | |
| `kind` | `deterministic` | 今日唯一受理される値 |
| `command` | `bun .claude/tools/aidlc-sensor-<id>.ts` | プレースホルダの sensor ごとのスクリプト; ユーザーがチェックを実装するスクリプトに更新する |
| `default_severity` | `advisory` | 今日唯一受理される値 |
| `description` | ユーザーの自由テキストから | |
| `category` | `""` | 望むならユーザーが埋める |
| `matches` | 発火には glob が必須 | scaffold は sensor が適用される glob 形状（artifact-tree glob か `**/*.ts` のようなコード glob）を尋ねる; `matches` の無いエントリは決して発火しない |
| `input_schema` | `{ output_path: string, stage_slug: string }` | dispatcher が追記するフラグに合致する |
| `output_schema` | `{ pass: boolean }` | dispatcher が依拠する最小の構造 |
| `timeout_seconds` | `30` | 保守的な既定値; 遅い dispatcher 向けに調整する |

manifest をスキャフォールドした後、gate-ritual ツールは — 同じ `withAuditLock` トランザクションの中で — 新しい id を発生元 stage の `sensors:` frontmatter リストに追記する（pull 著述の two-write インストール）。sensor は次のワークフローが compile するときに完全に結線される。これは唯一認可された stage-frontmatter の編集である: インポートリストを伸ばす（形状は不変、中身は不変ではない）のであって、`## Steps` / `## Sensors` / `## Learn` の本体は決して伸ばさない。

4 つの同梱 manifest は、これらの既定値が後に発展する変種を示す: `aidlc-required-sections.md` と `aidlc-upstream-coverage.md` は artifact-tree の `matches` glob（上の `matches` 表に示した値）とともに `timeout_seconds: 5` を使う; `aidlc-linter.md` は `matches: "**/*.{ts,js}"` とともに `30` を使う; `aidlc-type-check.md` は `matches: "**/*.{ts,tsx}"` とともに `60` を使う。

---

## 前方互換ポリシー

sensor manifest の consumer（compile、dispatcher、gate-ritual のスキャフォールド、doctor）は **未知の manifest キー** を許容せねばならない。将来のリリースが任意の `cool_new_field:` を足しても、古い consumer は manifest をパースし、そのフィールドを無視して続行する。これはスキーマの加算的な発展を、fork やアップグレード前の workspace を壊すことなく可能にする。

前方互換は既知のキーの未知の値には適用されない。上の [`kind` enum](#kind-enum) に文書化したとおり、`kind` の未知の値は parse 時に拒否される。同じ原則が他の enum 形状のフィールド（`default_severity`）にも適用される。

---

## 将来のリリースへの予約

いくつかの sensor 能力はスキーマ内で予約されているがまだアクティブではない、ゆえにそれらが着地するときフィールド形状が安定するようにしてある:

- **`kind: llm` dispatch** — LLM が評価する sensor（v0.11.0）。スキーマは今日 `kind` を受理するが、parse 時に `deterministic` 以外のいかなる値も拒否する。
- **`blocking` severity** — advisory テレメトリをログするのではなく gate を停止させる sensor の失敗（v0.10.0 ralph driver）。今日 `advisory` が唯一受理される値である。

両方とも write 時に強制される: 今それらを使う manifest を出すことは、parser が拒否する著者のエラーである。

## 次のステップ

- **Rule** — 制御ループのフィードフォワードの半分は、`pairing:` フィールドを介してこれらの sensor と対になる。[Rule システム](08-rule-system.md) を参照。
- **ユーザー向けの learning loop** — sensor の提案がどう gate で表面化・確認され、確認された提案がどう新しい manifest をスキャフォールドするか。ユーザーガイドの [Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) を参照。
- **compile 境界** — `sensors_applicable` がどうワークフロー開始時に一度解決され、発火時にグラフノードから読まれるか。[Plane アーキテクチャ](02-plane-architecture.md) を参照。

上のスキーマと、`dist/claude/.claude/sensors/` にある 4 つの同梱 manifest が、動く実例である。
