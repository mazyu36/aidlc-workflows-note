# Stage を足す

stage はワークフローグラフのノードである: 消費・生産する成果物、それを率いる agent、
どう走るかを宣言する仕事の単位。1 つ足すことは harness engineer が行う最も構造的な変更である
— あなたは方法論そのものに新しいステップを導入している。この章は end-to-end のレシピを歩く:
phase を選び、ファイルを著述し、依存エッジを配線し、グラフをコンパイルし、新しい stage が
期待どおりの場所に着地することを確認する。

先に [Stage の解剖](01-anatomy-of-a-stage.md) を読むこと。その章は、このレシピがあなたに
既に理解済みと想定するファイル形式 — frontmatter の契約と 3 区画の本体 — を扱う。ここでは
*ワークフロー*に焦点を当てる: フィールドごとのスキーマではなく、判断のポイントと検証の
ステップ。網羅的な契約について、この章は各ステップで
[Stage 定義](../reference/15-stage-definition.md) へリンクで降りる。

規律は、開発者リファレンスの
[Scope を足す](../reference/11-contributing.md#adding-a-scope) と
[Agent を足す](../reference/11-contributing.md#adding-an-agent) のレシピを映す:
番号付きのステップのリスト、続けて*何が自動で検証されるか*と*自分で確認せねばならないもの*の
明確な分割。

---

## 始める前に: 新しい stage が正しい一手か？

新しい stage は、既存のどの stage も生産しない成果物を生産する、または既存のどの stage も
扱わない形で消費するとき、その場所を得る。*既存の stage が何をするか*だけを変えたいなら
— 手順を言い換える、率いる agent を付け替える、sensor を付ける — その stage ファイルを
その場で編集する。新しいノードは要らない。その場の編集は [Stage の解剖](01-anatomy-of-a-stage.md) を参照。

stage を足すことは**データの仕事**である: YAML frontmatter 付きの Markdown ファイルを
著述し、JSON 成果物を再コンパイルする。TypeScript の変更は無い。念頭に置く 1 つの境界 —
グラフ*コンパイラ自身*が新しい振る舞い（まだ理解しない新しい frontmatter キー、新しい探索
ルール）を要するなら、それは開発者リファレンスの関心であり、harness の仕事ではない。スペックが
既に知る予約キー（`when`、`on_failure`、`blocks_on`、他）は
[Stage 定義](../reference/15-stage-definition.md) に挙げられている。まだ実装されていない
ものに手を伸ばすことは、あなたがコードの線を越えたことを意味する。

---

## Steps

### 1. stage がどの phase に属すかを決める

stage ファイルは
`core/aidlc-common/stages/<phase>/<slug>.md` 下に住む。phase はディレクトリである。
5 つある:

```
core/aidlc-common/stages/
├── initialization/
├── ideation/
├── inception/
├── construction/
└── operation/
```

stage が座る phase は装飾ではない。コンパイル時にどの
`phases/<phase>.md` rule レイヤーが stage に付くかを決める — construction phase の
stage は construction phase rule を継承し、inception stage は inception rule を継承する。
（initialization に phase rule ファイルは無い。）stage を、ファイルするのに便利な場所ではなく、
その仕事がライフサイクル上で実際に起きる場所に置くこと。

### 2. 必須の frontmatter とともに stage ファイルを作る

選んだ phase ディレクトリに新しい `<slug>.md` を置く。slug は
ファイル名の語幹であり、他のあらゆる場所での stage の同一性である — `requires_stage`
エッジ、scope マッピング、audit ログにおいて。慎重に選ぶこと。後でリネームすると波及する。

frontmatter はグラフエッジと実行契約を宣言する。構造的な重みを運ぶ
フィールド:

| フィールド | 何をするか |
|-------|--------------|
| `requires_stage` | 依存エッジ — どの stage がこれに先行せねばならないか |
| `consumes` | この stage が読む成果物、各々に `required` の真偽値 |
| `produces` | この stage が書く成果物（その前方エッジ） |
| `lead_agent` | stage を所有するペルソナ |
| `support_agents` | conductor が率いる者の後にロードする任意の視点 |
| `mode` | `inline`、`subagent`、`pipeline`、`mob`、または予約済みの `agent-team` |
| `for_each` | 任意 — インスタンスが反復を駆動する成果物を名指す |
| `summary_confirmation` | 任意 — ファイルに裏付けられた回答を常に収集する stage には `required`、条件付きの質問フローには `if-present` |

本体は `## Steps` で開く — 率いる agent が従う命令形の散文。
`## Sensors` と `## Learn` の区画はその後に来る。完全な
フィールド表、型、制約は
[フィールドリファレンス — いつ使うか](../reference/15-stage-definition.md#field-reference-when-to-use) を参照。

### 3. グラフが配置するよう依存エッジを配線する

ここで新しい stage が実際にワークフローに嵌まる。3 つのフィールドが
配線を行い、互いに整合せねばならない:

- **`requires_stage`** はエッジを符号化する。2 種のエッジを運ぶ:
  *意味的なデータ依存*（「私は成果物 X を消費し、それを stage Y が生産する」→
  `Y` を足す）と*提示順序のエッジ*（1 つの phase の 2 つの stage で、データ依存は
  無いが走る順序が固定）。順序エッジをコンパイラのアルファベット順のタイブレークに
  頼るのではなく明示的に著述する。タイブレークはあなたの明示的な配置の下のセーフティネット
  としてだけ働く。
- **`consumes`** は stage が読む成果物を挙げる。各エントリは
  *アクティブな計画に*スコープされた `required` の真偽値を運ぶ: `required: true` は「生産する
  stage がこの scope で走るなら、consume は満たされねばならない」を意味する — 「生産者が
  常に走る」ではない。brownfield モードでのみ要る consume は
  `conditional_on: brownfield` を取る。無条件の consume はこのフィールドを
  完全に省く（`always` の値は無い）。
- **`produces`** は前方エッジを挙げる。下流の stage が「誰が
  成果物 Z を生産するか？」と尋ねると、グラフは `producersOf()` 経由で答える — なので
  `produces: [Z]` を宣言する stage が、その上流に配線されるものである。

この 3 つを整合させればコンパイラが自動で stage を配置する。
配置するために `stage-graph.json` を手編集することは決してない。
`requires_stage`、`consumes[].required`、`consumes[].conditional_on`、
`for_each` のニュアンス（集約が宣言されるのではなく*推論される*仕方を含む）は
[フィールドリファレンス — いつ使うか](../reference/15-stage-definition.md#field-reference-when-to-use)
で扱う。

### 4. harness を再生成し、`stage-graph.json` を再コンパイルさせる

`core/` 下にあなたが今著述した YAML が正のソースである。パッケージャを走らせて、すべての
`dist/<harness>/` ツリーを `core/` から再生成する — これはあなたの新しい stage ファイルを
コピーし、グラフを再コンパイルする:

```bash
bun scripts/package.ts            # regenerate every harness from core/ + harness/
bun scripts/package.ts --check    # the CI drift guard — run before committing
```

ランタイムはコンパイル済みの成果物 `<harness-dir>/tools/data/stage-graph.json`
（例: インストール済み Claude ツリーの `.claude/tools/data/stage-graph.json`）を読む。これは
パッケージャが呼び出すグラフコンパイラが YAML から生む。既にインストール済みのツリーで
反復しているなら、そのツリーのグラフを直接再コンパイルできる:

```bash
bun .claude/tools/aidlc-graph.ts compile
```

いずれにせよ著述フローは一方向のパイプラインである — `core/` で YAML を編集し、
パッケージャ（またはインストール済みツリーに対する `compile`）を走らせ、JSON が更新され、
ランタイムのローダー（`loadStageGraph()`）が新しいノードをそのまま拾う。決して
`stage-graph.json` を手編集しない。それはビルド成果物であり、手編集は次の compile で
上書きされる。完全なパイプライン図と CI ドリフト
ガードは
[著述フロー](../reference/15-stage-definition.md#authoring-flow) にある。

### 5. それが現れることを — どの scope でかも — 検証する

新しいノードがコンパイルされて入ったことを確認し、それがどこで走るかを見る:

```bash
# Topological order of the full graph — your slug should appear
bun .claude/tools/aidlc-graph.ts topo

# Who produces / consumes your stage's artifacts
bun .claude/tools/aidlc-graph.ts producers <artifact>
bun .claude/tools/aidlc-graph.ts consumers <artifact>

# The stages on a given scope's path — does your stage run for this scope?
bun .claude/tools/aidlc-graph.ts scope <scope-name>

# Dependency sanity for a scope
bun .claude/tools/aidlc-graph.ts validate-scope <scope-name>
```

まっさらな stage はどの scope でも自動的には**走らない**。scope
メンバーシップは今や stage 自身に住む: その frontmatter の `scopes:` リストが、それが走る
すべての scope を名指す。scope を名指さない stage はどこでも `SKIP` である。
なので stage を足した後、どの scope がそれを走らせるべきかを決め、stage の `scopes:` リストに
各 scope 名を足す — 続けて再コンパイルして転置が `scope-grid.json` を更新するようにする —
[Scope](04-scopes.md) を参照。これは意図的な継ぎ目である:
stage 本体を著述するとそれが*存在*する。`scopes:` タグがそれを*走らせる*。

---

## stage を足すには、stage ファイルを書く — ランナーはオプトインの砂糖

この章の見出しはその拡張性の契約でもある: **stage を足すには、
stage ファイルを書く。** 他に構造的に要るものは無い。stage がグラフにコンパイルされて入る
（上のステップ 2〜4）と、スキルも登録も要さずに、それ単体で即座に走れる:

```bash
bun .claude/tools/aidlc-orchestrate.ts next --stage <your-slug> --single
```

エンジンの `--single` モードはその 1 つの stage を隔離して走らせる。stage のための単一の
`run-stage` ディレクティブ（その率いる agent、解決した consumes/produces のパス、rule、sensor
とともに）を発し、conductor がそれを走らせ、合成 id の
`STAGE_STARTED`/`STAGE_COMPLETED` のペアが audit ログにコミットされる。
ディレクティブは `single: true` を運ぶので、conductor は設定された本体、
トポロジ、reviewer、完了チェックを走らせ、
`report --single --stage <slug> --result completed` で一度報告し、`done` で止まる。
ワークフローの learnings は走らせず、ワークフローの承認 gate も開かない。
`--single` 実行は意図的に隔離される: それは**メインワークフローの
`Current Stage` に決して触れない** — ツールは single 実行からメインワークフローを進めることを
拒否するので、1 つの stage をそれ単体で走らせても進行中のワークフローを決して脱線させない。

### ランナースキルは任意のパッケージング

同梱される実行可能な各 stage も `skills/aidlc-<slug>/SKILL.md` に薄いランナースキルを得る
ので、`/aidlc-<slug>`（例: `/aidlc-application-design`）としてタイプ可能である。これらは
**`--single` フラグの上のオプトインの砂糖**である — `next --stage <slug> --single` を駆動する
~6 行のシェル。手書きではない: ジェネレータが実行可能なコンパイル済み stage slug ごとに 1 つ
emit するので、ランナーの集合が手作業で stage の集合からドリフトすることは決してない。
（3 つのブートストラップ初期化 stage は stage 別のランナーを得ない — それらに単独の `--single`
の意味は無い。init phase 全体が代わりに `/aidlc-init` コマンドで、エンジンの intent-create の
手をパッケージする。）stage を足した（または除いた）後、ランナーを再生成する:

```bash
# Regenerate every runner dir from the compiled stage list
bun .claude/tools/aidlc-runner-gen.ts write

# CI drift guard: exits 1 if the runner set != the compiled stage set
bun .claude/tools/aidlc-runner-gen.ts check
```

ランナーは **`hooks:` ブロックを運ばない** — 決定論的な背骨（audit、sensor、
runtime-graph の compile、状態検証）は `settings.json` にプロジェクト全体であるので、
すべてのランナーがそれを無料で継承する。ランナー別に複製するものは無い。そして
ランナーは conductor のペルソナを手でロード**しない**: エンジンがそれを、最初の `run-stage`
ディレクティブに焼き込んで届ける。ランナー本体はただ、何をするかと駆動する 1 つのコマンドを
述べるだけである。

すべてのランナースキルを削除しても、すべての stage はなお
`/aidlc --stage <slug> --single` 経由で走る — ランナーは既に走れる stage をパッケージし、stage ファイルが定義である。
著述の道は「stage ファイルを書く」であり、そのままである。

これらのランナーの背後の規範的な契約 — エンジン、conductor、
`run-stage` ディレクティブがコンパイル済みの stage をタイプ可能な `/aidlc-<slug>` スキルに
どう変えるか — は、開発者リファレンスの [スキルシステム §4（スキルとランナー）](../reference/17-skill-system.md) を
参照。

---

## 何が自動で検証されるか 対 自分で確認せねばならないもの

### 何が自動で検証されるか

- **グラフの配置。** `compile` すると、stage のエッジ（`requires_stage`、
  `consumes`、`produces`）はグラフに解決される。トポロジ順、
  producer/consumer のルックアップ、サイクル検出はすべて、さらなる編集なしに新しいノードを
  勘定に入れる。
- **コンパイル時のフィールド検証。** コンパイラはグラフを組む際に frontmatter を検証する
  — 著述エラーは `compile` で大きな音で失敗し、実行時に静かに失敗しない。`lead_agent` や
  `support_agents` の値は、実際の `.claude/agents/*.md` ファイルに対して `loadAgents()`
  経由で確認される。更新すべきハードコードの agent 列挙は無い。ファイルの無い agent を
  名指す stage は compile を落とす（`lead_agent "<name>" has no matching .claude/agents/*.md`）
  ので、タイプミスは実行時に 404 になるグラフを出荷できない。予約済みの `orchestrator`
  slug（conductor 自身。ブートストラップ初期化 stage で使われる）は
  免除される — それに agent ファイルは無い。
- **CI ドリフトガード。** `bun .claude/tools/aidlc-graph.ts compile --check` は清潔な
  ツリーで `0`、いずれかの stage YAML が JSON を再コンパイルせずに編集されたら `1` を
  exit する。CI はこれを走らせるので、忘れた `compile` は古いグラフを出荷するのではなく
  明確なメッセージでマージをブロックする。
- **phase rule の付与。** stage はディレクトリで phase を宣言するので、
  合致する `phases/<phase>.md` rule レイヤーがコンパイル時に付く —
  そのエッジを自分で配線することはない。

### 自分で確認せねばならないもの

- **scope への参加。** コンパイラは stage をグラフに配置する。どの scope がそれを走らせるか
  は**決めない**。stage 自身の `scopes:` frontmatter リストに各 scope 名を足す（そして
  転置が `scope-grid.json` を更新するよう再コンパイルする）まで、新しい stage はグラフに
  存在するがどこでも走らない。気にする各 scope について `aidlc-graph.ts scope <scope-name>`
  で確認する。
- **本体の散文。** frontmatter だけがパースされる。`## Steps` 本体は stage が起動するとき
  率いる agent が読む — 他の stage ファイルの構造に合わせて書く。パーサーは曖昧な、または
  欠けた指示を捕まえない。
- **散文とエッジの整合。** `requires_stage` と `## Steps` の散文はドリフトしうる — パーサーは
  エッジだけを見て、散文は見ない。手順が「intent statement を読む」と言うなら、合致する
  producer stage が実際に `requires_stage` にあらねばならない。手で同期を保つこと。
- **あなたの scope 下の `required` の意味論。** `required: true` の consume は、producer を
  飛ばすどの scope でも無意味になる — それは正当でありバグではないが、stage 本体が producer の
  不在を優雅に扱うことを確認するのはあなたの責任である（「利用可能なら」のフォールバック
  パターン）。
- **ドキュメント。** 新しい stage が docs が手で列挙するカウントやテーブル（stage 数、
  phase 一覧）を変えるなら、ドキュメントポリシーに従い、同じ変更でそれらを更新する。

---

## 境界のケース: データの仕事 対 コードの仕事

stage ファイルを著述しグラフを再コンパイルすることは、完全に
harness-engineer のデータの仕事である — Markdown、YAML、JSON、`.ts` は無い。静かに
越えてはならない線: あなたの stage を動かすためにグラフ*コンパイラ*が異なる振る舞い
（認識しない frontmatter キー、新しいエッジ型、新しい探索ルール）を要するなら、それは
データを読むコードへの変更であり、ここではなく
[開発者リファレンス](../reference/15-stage-definition.md) に属す。スペックの
予約キー名前空間は、まさに将来の構造的拡張が場当たりの追加としてではなく予測どおりに
着地するために存在する。それらのキーの 1 つに消費者が出荷されるまで、スキーマはそれを
拒否する。コンパイラがまだ実装しないキーが欲しいと気づいたら、止まる — それは
フレームワークの変更であり、検証の規律については
[Agent を足す](../reference/11-contributing.md#adding-an-agent) とその兄弟の
contributing レシピに従うが、実装はコードに住む。

---

## 次へ

[Agent を足す](03-adding-an-agent.md) — 新しい stage が `lead_agent` として名指す
ペルソナを著述し、それが率いる／支える stage に束ねる。
