# Sensor

sensor は、agent が stage の出力を書くときに自動で発火する、決定論的で助言的なチェックで
ある。rule が agent の読む散文である（[Rule と学習ループ](05-rules-and-the-loop.md)）のに
対し、sensor は走るコードである — rule のフィードフォワードに対する、制御ループのフィード
バックの半分。rule は「user story は Given/When/Then に従う」と言う; sensor は、agent が
たった今書いたファイルに必須の見出しが在ることをバイト単位で検証する。

この章は、harness engineer が sensor で実際に行う仕事を語る: 同梱される 4 つを理解し、
新しい manifest を著述し、それを走らせるべき stage に束ねる。完全なフィールドごとの契約は、
開発者リファレンスの [Sensor System](../reference/07-sensor-system.md) に住む — この章は
それを言い直すのではなく、各スキーマの判断のたびにそこへ指し降ろす。

---

## sensor とは何か

sensor manifest は YAML frontmatter 付きの Markdown ファイルで、`core/sensors/` の下に
落とす。frontmatter は純粋な **capability descriptor** である — チェックが何で、どう起動するか
を述べる。どの stage がそれを使うかについては何も述べない。その束縛は stage 側に住む。それが
この章の中心的なアイデアであり、manifest と stage が疎結合のままである理由である。

2 つの性質がランタイムの振る舞いを定義し、両方とも何かを著述する前に内面化する価値がある:

- **それは stage 中の Write と Edit で発火する。** agent が出力ファイルを書くか編集する
  とき、`PostToolUse` hook がアクティブな stage にどの sensor が適用されるかをチェックし、
  合致する各々を走らせる。ワークフロー中に sensor を手で起動することは決してない; それは
  すべてのファイル書き込みに便乗する。（manifest の `command:` はデバッグ用に人間が走らせる
  ことも可能である — リファレンスを参照 — が、ワークフローの経路は hook である。）
- **それは助言的である — 決してブロックしない。** このリリースの sensor の結果はテレメトリ
  であり、gate ではない。失敗した sensor は audit 行と、何が欠けているかを正確に指す detail
  ファイルを生むが、stage の承認 gate やあなたのワークフローを止めはしない。あなたはシグナルを
  見て、それをどうするかを決める。（`default_severity` は今日 `advisory` に固定されている;
  `blocking` 値は将来のリリースに予約されている — 下の
  [`default_severity`](#judgment-calls-matches-and-default_severity) を参照。）

各発火は intent の `audit/` シャードに 1 行を残す。イベント名 — ログを grep するとき正確な
大文字小文字が重要である — は、sensor が始まるとき **`SENSOR_FIRED`**、通過するとき
**`SENSOR_PASSED`**、ギャップを見つけるとき **`SENSOR_FAILED`** である。失敗した行は
`<record>/.aidlc-sensors/<stage-slug>/`（intent の record dir の中）の下の detail ファイル
にリンクし、それが具体的なギャップを名指す: 欠けた見出し、参照されない上流の成果物、lint
エラー。実行中にこれがどう見えるかのユーザー向けのツアーは、ユーザーガイドの
[Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) にある。

---

## 同梱される 4 つの sensor

4 つの manifest が `.claude/sensors/` の下に同梱され、各々が `aidlc-` プレフィックスを持つ:

| Manifest | 発火対象 | チェック |
|----------|----------|--------|
| `aidlc-required-sections.md` | record-dir の markdown 出力 | 出力が必須の H2 見出しを運ぶ — 汎用のコンテンツ形状チェック |
| `aidlc-upstream-coverage.md` | record-dir の markdown 出力 | stage の成果物（集合として評価）が、stage が消費すると宣言する各上流の成果物を、slug・wikilink・または生産する stage のディレクトリパスで参照する |
| `aidlc-linter.md` | `.ts` / `.js` のコード出力 | 設定済みの linter（既定は ESLint）をラップする |
| `aidlc-type-check.md` | `.ts` / `.tsx` のコード出力 | 設定済みの type-checker（既定は `tsc`）をラップする |

4 つすべてが `matches:` glob でゲートされる（下で詳述）: 最初の 2 つのドキュメント形状
チェックは成果物ツリーにスコープされ（同梱の manifest は `**/{aidlc-docs,intents}/**` を運ぶ
— intent ごとの record ツリー。移行前のプロジェクト用にレガシーの `aidlc-docs/` アームを
保っている）、2 つのコード品質チェックはそれぞれの言語 glob（`**/*.{ts,js}`、
`**/*.{ts,tsx}`）にスコープされる。自分のものを著述する前に `aidlc-required-sections.md` を
end to end で読むこと — それは 4 つのうち最小で、形状全体、frontmatter と散文の本体を示す。

---

## 束縛がどう働くか: pull 著述

manifest は **stage を対象づけるフィールドを運ばない**。`applies_to:` は無い —
フレームワークは意図的にそれを除いた。stage は、自身の frontmatter で sensor を名指すことに
よって、その出力で何が発火するかを決める:

```yaml
# core/aidlc-common/stages/construction/code-generation.md
---
slug: code-generation
phase: construction
sensors:
  - linter
  - type-check
---
```

これは **pull 著述** であり、harness モデルの他のすべての束縛と同じ方向である: 消費者
（stage）が能力（sensor）を名指し、決してその逆ではない。`sensors:` リストは裸の id を保持
する — `aidlc-linter` ではなく `linter` — なぜなら id は manifest の frontmatter の `id:`
フィールドに一致し、それは `aidlc-` プレフィックスを剥いだファイル名の語幹に等しいからである。

その見返りは参照の局所性である。stage ファイルを開けば、その stage が走るときどのチェックが
発火するかが正確に見える — この stage を対象にすると主張するものを探して、すべての manifest を
走査する必要は無い。同じ `sensors:` 区画は、[Stage の解剖](01-anatomy-of-a-stage.md) で
stage 側から記述されている; ここでは sensor 側から見ている。

ワークフロー開始時、compile resolver が `.claude/sensors/` を歩き、すべての manifest を id で
索引し、各 stage について宣言された各インポートをルックアップする — id に manifest が無ければ、
stage が走るときに静かに失敗するのではなく、コンパイル時に大きな音で投げる。解決した stage
ごとのビューは stage グラフノードに焼き込まれ、hook は発火時にそこからそれを読む。念頭に置く
1 つの帰結: ワークフローの途中で manifest を編集しても、進行中の実行で発火するものは **変わら
ない**。compile のスナップショットは次のワークフローが始まるまで保たれる。完全な resolver の
仕組みは [stage が sensor をどうインポートするか](../reference/07-sensor-system.md#how-stages-import-sensors)
にある。

---

## 新しい sensor を著述する

sensor を足すことは 2 つの書き込みである: manifest、続けて束縛。

**1. `core/sensors/aidlc-<id>.md` に manifest を落とす。** ファイル名の語幹（`aidlc-`
プレフィックスを除いたもの）は frontmatter の `id:` に等しくねばならない。frontmatter は
短い — 5 つの必須フィールドと、いくつかの任意のもの:

| フィールド | 必須 | 何か |
|-------|----------|------------|
| `id` | yes | kebab-case; `aidlc-` を除いたファイル名の語幹に等しい |
| `kind` | yes | `deterministic` が今日唯一受理される値 |
| `command` | yes | dispatcher が走らせる正規の起動プレフィックス |
| `default_severity` | yes | `advisory` が今日唯一受理される値 |
| `description` | yes | 1 行の人間向け説明 |
| `category` | no | 自由形式のラベル（同梱 manifest は `document-shape`、`code-quality` を使う） |
| `matches` | no | sensor がどのファイル書き込みで発火するかを絞る glob |

`command:` は **プレフィックス** であり、完全な argv ではない。dispatcher は発火時に
ランタイムのコンテキストを追記する — 常に `--stage <slug>`、続けて sensor の入力形状に合致する
ファイルフラグ: ドキュメント sensor には `--output-path <path>`、コード sensor（`linter`、
`type-check`）には `--file-path <path>`。だから manifest は純粋な capability descriptor の
ままで、発火ごとのフラグを決して符号化しない。dispatcher が組み立てる正確な起動は
[`command:` 起動契約](../reference/07-sensor-system.md#command-invocation-contract) に
文書化されている。完全なスキーマ — `input_schema`、`output_schema`、`timeout_seconds`、
未知のキーへの前方互換ポリシー — は
[Sensor Manifest スキーマ](../reference/07-sensor-system.md#sensor-manifest-schema) を参照。

**2. id を stage の `sensors:` リストに足すことで束ねる。** ディレクトリに座っている
manifest は、stage がそれをインポートするまで何もしない。チェックを発火させたい stage を開き、
その frontmatter の `sensors:` リストに裸の id を足すと、束縛は次の compile で効力を持つ。
sensor を複数の stage で走らせるには、各々に id を足す — strict-additive で、考えるべき
上書きレイヤーは無い。sensor が stage で発火するのを止めるには、その stage から id を除く。
manifest は決して変わらない; インポートリストだけが変わる。

`aidlc-` ファイル名プレフィックスは、カスタムのものも含めすべての sensor に必須である —
compile resolver（`aidlc-graph.ts` の `loadSensors`）は `SENSOR_FILE_REGEX =
/^aidlc-([a-z][a-z0-9-]*)\.md$/` で manifest を発見し、プレフィックスの無いファイルを静かに
スキップするので、それは決して発見されず、決して stage に束縛されない。sensor を
`core/sensors/aidlc-<id>.md` と名付け、`id: <id>` を設定する; ファイル名-id ルールは
プレフィックスの後の語幹に適用される。

---

## 判断のポイント: `matches` と `default_severity`

manifest のほとんどは機械的である。2 つのフィールドが本物の著述の判断を運ぶ。

**`matches` — このチェックはどんな形状のファイルを分析すべきか？** この glob は発火
フィルタであり、実質的に必須である: hook は書き込まれるパスがそれに合致するときだけ sensor を
発火させ、`matches` の **無い** エントリは一切発火しない。コード品質 sensor はそれをコード
glob に設定し（`aidlc-linter.md` は `**/*.{ts,js}`、`aidlc-type-check.md` は
`**/*.{ts,tsx}` を使う）、コードの書き込みでだけ発火して散文には黙る; ドキュメント形状 sensor
は成果物ツリーにスコープされ、stage が書く任意の markdown 成果物で発火する。あなたのチェックが
意味を持つファイル形状を決め、それをカバーする最も狭い glob を書く。空の `matches: ""` は
パース時に拒否される; そして glob が無いことは sensor が決して走らないことを意味するので、
「すべてで発火する」モードは無い — 形状を名指さねばならない。hook は発火時に、書き込まれる
パスをこの glob と比較する。完全な振る舞いは
[`matches` フィルタ](../reference/07-sensor-system.md#matches-filter) にある。

**`default_severity` — 今のところ advisory のみ。** 今日受理される唯一の値は `advisory`
なので、これは自由な選択ではなく固定の選択である。名指す価値があるのは、それがあなたが
買い入れる契約を定義するからである: sensor は知らせる、強制はしない。gate を止める `blocking`
値は将来のリリースに予約されている; それまで、すべての sensor は人間が読むセカンドオピニオン
であり、決して壁ではない。予約値ポリシーは
[`default_severity`](../reference/07-sensor-system.md#default_severity) にある。

---

## 学習ループがあなたのために sensor をインストールするとき

sensor を常に手で著述するわけではない。§13 の learning gate は、ワークフロー中に sensor の
提案を確認したときに 1 つをインストールできる — 決定論的なチェックが stage の出力で発火すべき
だと決め、gate でそれをチェックすると、フレームワークはあなたが手作業でするのと同じ 2 つの
書き込みのインストールを行う: あなたのプロジェクトの `.claude/sensors/aidlc-<id>.md`
（決して同梱のフレームワークディストリビューションではない）に **project 層** の manifest を
スキャフォールドし、新しい id を発生元の stage の `sensors:` インポートリストにアトミックに
追記する。その gate 確認の経路は **`SENSOR_PROPOSED`** audit 行を発するので、束縛が静かに
インストールされることは決してない。ループとその `SENSOR_PROPOSED` 行は
[Rule と学習ループ](05-rules-and-the-loop.md) で扱う; ユーザー向けのウォークスルーは、
ユーザーガイドの [Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) にある。

この章の手著述の経路と、ループがインストールする経路は、同じ成果物を生む — manifest と
インポートリストのエントリ。違いは誰が始動するかである: あなたがファイルを直接編集するか、
あるいは gate が、あなたがワークフローの途中で行った訂正を捕らえるか。

---

## 次へ

[チーム Knowledge](07-team-knowledge.md) — agent に、働く前にロードするドメインの
コンテキストを与える。harness engineer が形作る最後のデータサーフェスである。
