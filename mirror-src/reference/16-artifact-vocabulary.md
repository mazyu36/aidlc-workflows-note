# 成果物の語彙

この章は AI-DLC の成果物名についての書かれた rule である — 各 stage の `produces:` と
`consumes[].artifact:` YAML frontmatter に現れる正典の文字列。命名の形状、衝突解決のポリシー、
ファイルシステムパスの規約、そしてライブのレジストリをコマンドラインからどう見るかをカバー
する。

レジストリそれ自体は **導出される** もので、書かれるものではない。「どの正典の名前が存在する
か」の正典のソースは、すべての stage ファイルの `produces[]` フィールドを、各 stage の
`optional_produces[]`（stage が unit ごとに条件付きで書くかもしれない成果物、
`15-stage-definition.md` のフィールドリファレンスを参照）と和集合したものであり、だから条件
付きで生成される名前も登録されたまま、その producer に解決可能なままである。
`dist/claude/.claude/tools/aidlc-graph.ts` のヘルパーがコンパイル済みの stage グラフを読み、
その和集合を集合として返す — scope（`aidlc-lib.ts:772` の `validScopes()`）と agent
（`aidlc-lib.ts:794` の `loadAgents()`）に使われるのと同じパターン。レジストリをこの章の外に
保つことは、並行して手で保守されるリストが招く drift を防ぐ。

---

## ここでの成果物とは何か

成果物は、ちょうど 1 つの生成する stage がその YAML frontmatter で宣言する **正典の識別子**
である。他の stage は、読み取り依存を宣言するために同じ識別子を `consumes[]` で参照する。
識別子は短い kebab-case の文字列である — ファイル拡張子は無く、フォルダのプレフィックスも
無く、スラッシュも無い。

`dist/claude/.claude/aidlc-common/protocols/stage-definition.md` のマイルストーン 4 の実例からの
具体例:

```yaml
slug: scope-definition
# ...
produces:
  - scope-document
  - intent-backlog
  - scope-definition-questions
consumes:
  - artifact: intent-statement
    required: true
  - artifact: feasibility-assessment
    required: false
```

ここで `scope-document`、`intent-backlog`、`scope-definition-questions` は scope-definition
stage が生成する成果物である; `intent-statement` と `feasibility-assessment` はそれが消費する
成果物である（他の stage — それぞれ `intent-capture` と `feasibility` — が生成する）。

このレジストリで成果物で **ない** もの:

- **ファイルパス。** `<record>/ideation/scope-definition/scope-document.md`（`<record>/` は
  intent の record dir、`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）はファイルシステム上の
  位置である; 正典の名前は `scope-document` である。下の「ファイルシステムのマッピング」を参照。
- **ファイル名。** ディスク上の `.md` ファイルと正典の名前は一致する必要はない（衝突を除けば、
  通常は一致する）。
- **状態の配管。** `aidlc-state.md`、`audit.md`、`.aidlc-recovery.md` は、`produces[]` を介した
  stage ではなく、ツール（`aidlc-state.ts`、hook スクリプト）によって管理される。それらは
  レジストリに決して現れない。
- **ランタイムの値。** 「user の散文の回答」や「workspace 分類（greenfield/brownfield）」の
  ような文字列は動的なデータであり、耐久的な stage 間の成果物ではない。

---

## 導出ルール

1. **stage ファイルが正典である。** 各 stage の `produces:` リストは、その stage が emit する
   すべての正典の名前を宣言する。`consumes:` は、その stage が依存する正典の文字列を名指す。
2. **レジストリは計算されるもので、書かれるものではない。** `bun
   dist/claude/.claude/tools/aidlc-graph.ts artifacts` を走らせてライブのレジストリを出力する —
   1 行に 1 つの名前、アルファベット順にソート。ツールはコンパイル済みの `stage-graph.json` から
   すべての stage の `produces[]` を和集合する。
3. **この章に並行リストは無い。** 読み手が列挙を欲しければ、ツールを走らせる。この章は正典の
   名前をレジストリ表として決して列挙しない。
4. **メンバーシップは doctor によって検証される。** `/aidlc --doctor` は「Graph references」
   チェック（`aidlc-utility.ts`）を走らせる — すべての `consumes[].artifact` エントリと
   `requires_stage[]` slug は、導出されたレジストリに対して解決せねばならない。孤児の consumer
   は壊れた参照として報告される。

32 個すべての stage ファイルが `produces:` を宣言するので、導出は完全なレジストリを返す。
ツールは空のデータに対しても well-defined である — `produces:` の無い stage は単に何も寄与
しない — が、出荷されたフレームワークではすべての stage が populate されている。

---

## 命名ルール

すべての正典の名前は `/^[a-z][a-z0-9-]*$/` を満たさねばならない —
`dist/claude/.claude/tools/aidlc-stage-schema.ts` の `SLUG_RE` が強制する形状である。それは
以下を意味する:

- **小文字のみ。** `scope-document` であり、`ScopeDocument` や `SCOPE_DOCUMENT` ではない。
- **ファイル拡張子は無い。** `scope-document` であり、`scope-document.md` ではない。
- **フォルダのプレフィックスは無く、スラッシュも無い。** `scope-document` であり、
  `ideation/scope-definition/scope-document` ではない。
- **文字で始まる。** `s1` は合法である; `1-thing` は違う。
- **内側のハイフン、数字、小文字のみ。** アンダースコアは無く、スペースも無く、Unicode 文字も
  無い。

質問の成果物は、慣習により `<stage-slug>-questions` の規約に従う — user 入力を集める stage は、
主な成果物と並んで兄弟の `<slug>-questions` 正典の名前を宣言する。慣習であり、parser の rule
ではない。

形状は **フラットな名前空間** である — `<phase>/<stage>/<artifact>` のような階層的なプレフィッ
クスは無い。これは他のすべての AI-DLC 識別子に合致する: agent slug、scope 名、stage slug、
phase 名はすべてフラットな kebab である。

---

## 衝突ポリシー

2 つの stage は、それらの `produces[]` リストで同じ正典の名前を宣言 **してはならない**。
レジストリは集合である; 名前はグローバルに一意でなければならない。同じ根底の概念が 2 つの
stage によって emit されるとき、曖昧さを解消する 2 つの別個の名前を選ぶ。

今日の 1 つの例: `build-and-test`（Construction）と `performance-validation`（Operation）の両方
が `test-results.md` というファイルを書く。正典の名前は、2 つがワイヤ上で決して衝突しないよう
に分割されている:

- `build-test-results` — `build-and-test` が emit する。その stage の兄弟の名前とペアになる:
  `build-instructions`、`unit-test-instructions`、`integration-test-instructions`、
  `performance-test-instructions`、`security-test-instructions`、`build-and-test-summary`。
- `load-test-results` — `performance-validation` が emit する。同じ stage が既に生成する
  `load-test-plan` とペアになる。

両方の名前は今日、それぞれの stage の `produces:` リストで出荷される。

**ディスク上のファイル名は一致する必要はない。** 両方の stage は、それぞれのフォルダで
`test-results.md` に書き続けられる; 正典の名前はワイヤの識別子であり、ファイル名ではない。

---

## ファイルシステムのマッピング

成果物は、`(canonical name) + (producing stage) + (per-unit flag)` から導出可能なパスでディスク
上に住む。今日は 2 つの形状がある:

- **非 per-unit stage（29 のうち 24）:**
  `<record>/<phase>/<stage>/<canonical-name>.md`
  例: `feasibility-assessment`（Ideation の `feasibility` stage が生成する）は
  `<record>/ideation/feasibility/feasibility-assessment.md` に住む。

- **Per-unit の Construction stage（29 のうち 5）:** `nfr-requirements`、
  `nfr-design`、`functional-design`、`infrastructure-design`、`code-generation`。これらは
  Construction 中に Unit of Work ごとに各成果物の 1 コピーを emit する:
  `<record>/construction/{unit-name}/<stage>/<canonical-name>.md`
  例: `business-logic-model`（`functional-design` が生成する）は
  `<record>/construction/{unit-name}/functional-design/business-logic-model.md` に住む。

Per-unit の状態は、stage の `for_each: unit-of-work` frontmatter フィールドによって宣言される —
Unit ごとに 1 回走る 5 つの Construction stage がそれを運ぶ; 残りはそれを省く。将来のヘルパー
は、stage グラフ + canonical name からパスを機械的に計算できるだろう。

**Codekb は space レベルの例外である。** reverse-engineering の 9 つの成果物
（`business-overview`、`architecture`、`code-structure`、`api-documentation`、
`component-inventory`、`technology-stack`、`dependencies`、`code-quality-assessment`、
`reverse-engineering-timestamp`）は、intent ごとの record dir の下に **解決しない**。それらは
`aidlc/spaces/<space>/codekb/<repo>/` の、耐久的でリポジトリごとのコード knowledge base に落ちる
— space 内のすべての intent で共有される、intent ではなくリポジトリでキーされるストア。パスは
`resolveArtifactPath`（`dist/claude/.claude/tools/aidlc-orchestrate.ts`）の `isCodekb` 分岐を
介して record 相対の rule の外で解決され、同じディレクトリは読み取り専用の直接ユーティリティ
呼び出し `bun <harness-dir>/tools/aidlc-utility.ts codekb-path` によって出力される。

**衝突では canonical name ≠ ファイル名。** 衝突が分割される場合（上を参照）、ディスク上の
ファイル名は分割前の形（`test-results.md`）を保つ一方、canonical name は曖昧さを解消した版で
ある。ファイルシステムではなく、stage の `produces:` リストと `bun aidlc-graph.ts artifacts` を
信頼できる情報源として使うこと。

---

## ライブのレジストリをどう見るか

```bash
bun dist/claude/.claude/tools/aidlc-graph.ts artifacts
```

1 行に 1 つの canonical name を、アルファベット順にソートして出力する。

PR-8 以前の出力は空である — stage はまだ YAML に移行しておらず、`produces:` も populate されて
いない。PR-8 以後、出力は 29 の非 initialisation stage を跨いでおよそ 118 の名前に育つ。

数を数えるには `wc -l` に、フィルタには `grep` に、drift チェックには期待するベースラインに
対する `diff` にパイプする。

---

## 成果物の追加またはリネーム

この章への編集は不要である — レジストリは導出される。

**新しい成果物を足すには:**

1. 生成する stage の `.md` ファイルを編集し、canonical name をその `produces:` リストに足す。
2. `bun aidlc-graph.ts artifacts` を走らせて、それが現れることを確認する。
3. `/aidlc --doctor` を走らせて、どの consumer ももはや存在しない名前を参照していないことを
   確認する（「Graph references」チェック）。

**成果物をリネームするには:**

1. 生成する stage の `produces:` エントリでそれをリネームする。
2. すべての消費する stage の `consumes[].artifact` エントリでそれをリネームする。
3. `/aidlc --doctor`（PR-11 以後）は、更新し忘れた consumer を捕らえる — 古い名前は
   missing-producer エラーになる。

stage-graph の CI drift 検出（`aidlc-graph compile --check`）は、YAML ソースから
`stage-graph.json` を再生成し忘れたリネームを捕らえる。

---

## 安定性

v1.0 の出荷時点のライブのレジストリが、フレームワークの成果物サーフェスの安定性のベースライン
である。成果物名の安定性ポリシーは次のとおり:

- **リネーム** と **削除** はメジャーバージョンの変更である — v1.x → v2.0。
- **追加** はマイナーバージョンで出荷される — v1.0 → v1.1 など。
- **v1.0 まで流動的**: 現在の v0.3.0 Foundation セットが出発点である; 後の v0.4.0–v0.11.0
  リリースは、方法論が進化するにつれて名前を追加、リネーム、削除するかもしれない。

このポリシーはライブのデータに対して強制可能である: タグ時点のレジストリと HEAD 時点の
レジストリの間の drift は 1 行の `diff` である。

---

## クロスリファレンス

- `dist/claude/.claude/aidlc-common/protocols/stage-definition.md` — 正典の stage 形式 spec;
  `produces[]` / `consumes[]` を構造化されたフィールドとして定義する。
- [Stage Definition](15-stage-definition.md) — spec についてのナラティブの章。
- [State Machine](12-state-machine.md) — audit イベントのための並行する導出パターン: 正典の
  enum はドキュメントではなく `aidlc-audit.ts` に住む。
- [User Guide — Artifacts Reference](../guide/14-artifacts-reference.md) — user 向けの成果物
  ライフサイクルとディレクトリレイアウト。
- `dist/claude/.claude/tools/aidlc-graph.ts` — 導出ツール（`artifactsRegistry()` + `artifacts`
  CLI サブコマンド）。
