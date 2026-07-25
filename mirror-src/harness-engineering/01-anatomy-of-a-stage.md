# Stage の解剖

stage は AI-DLC ワークフローの原子である — 1 ステップで*何が*起きるか。harness engineer が行う他のすべての変更は stage ファイルの上に乗るので、これは最初に読む章である。読み終える頃には、どの stage `.md` ファイルを開いても、その各部分を誰が読むかを知り、ファイルを編集して変えられるフィールドと、フレームワークのコードが固定する振る舞いを見分けられるようになっているはずだ。

stage ファイルは YAML frontmatter 付きの単一の Markdown ファイルである。frontmatter はグラフノードを宣言する — stage が消費・生産する成果物、率いる agent、どう実行するか。本体は agent が従う散文である。両者が意図的に 1 ファイルに住み、この章の残りはなぜかを解く。

---

## 2 種の読者、1 つのファイル

stage ファイルには 2 種の読者がいて、決して重ならない:

- **パーサー**は YAML frontmatter だけを読む。構造化されたグラフエントリ — エッジ、率いる agent、実行モード — を生み、本体は完全に無視する。
- stage を実行する **agent** は本体だけを読む。散文の手順に従い、成果物を生み、frontmatter には決して触れない。

両者を 1 ファイルに保つことは、ファイルを開いたときにグラフエッジと実行手順を並べて見られることを意味する。stage を読む reviewer は両方を一度に見る: どの成果物を生むか*と*それを生む指示を。両者を分割する — グラフ用の YAML ファイルと agent 用の散文ファイル — と、そのインラインの可視性が壊れる。それこそが stage をレビュー可能にする性質である。

この分割が、あなたが何を編集しているかを知る鍵である。frontmatter のフィールドを変えれば*グラフ*（依存エッジ、率いる agent、実行モード）を変えたことになる。本体を変えれば*仕事*（agent が実際に何をするか）を変えたことになる。両者は独立である。

本物の stage は `core/aidlc-common/stages/<phase>/<slug>.md` に著述される — 例えば `stages/inception/application-design.md`。この章と並べて 1 つ開くとよい。読み終える頃には形が馴染んでいるはずだ。

---

## frontmatter を一目で

frontmatter は YAML キーのフラットなブロックである。機械的なもの — `slug`、`phase` — は隣の stage からコピーする。一握りは本物の判断を運び、stage を著述または編集する前に理解する価値があるのはそれらである:

| フィールド | 何を決めるか | 判断のポイント |
|-------|-----------------|-------------------|
| `requires_stage` | 依存と順序のエッジ | この stage は本当に別の出力を消費するのか、それともその後に走る必要があるだけか？ |
| `consumes` | この stage が読む成果物 | 成果物ごと: それは `required` か、brownfield/greenfield に `conditional_on` か？ |
| `produces` | この stage が書く成果物 | これらは他の stage が発見する前方エッジである。 |
| `lead_agent` / `support_agents` | 誰が stage を走らせるか | 1 つのペルソナが所有し、支援者が視点を足す。 |
| `mode` | 通信トポロジ | `inline`（conductor のコンテキスト内の声）、`subagent`（ハブ&スポークの dispatch）、`pipeline`（連鎖）、`mob`（有界ラウンドのメッシュ）。 |
| `for_each` | 反復するか | インスタンスごとに 1 回の実行を駆動する成果物を名指す。 |

最も強く噛みつく判断についていくつか注記する:

- **`consumes[].required` はアクティブな計画にスコープされ、グローバルではない。** `required: true` は「生産する stage が*この*ワークフローで走るなら、この consume は満たされねばならない」を意味する — 「生産者が常に走る」ではない。scope は意図的に上流 stage を飛ばすので、フラットなグローバル要件はそうした scope を構造的に無効にしてしまう。stage 本体は入力が無いケースを優雅に扱う（「produced されていれば」のような散文）。
- **`consumes[].conditional_on` は brownfield/greenfield の分岐を捉える。** `conditional_on: brownfield` と印された consume は、ワークフローが brownfield のときにだけ required である。無条件の consume では、このフィールドを完全に省く — `always` の値は無い。
- **`mode` は通信トポロジである** — 本体が走る間、誰が誰に話すか。`inline` は短い stage を conductor 自身のコンテキストで、支援者を採用された声として走らせる。`subagent` は率いる仕事を新しいコンテキストに委譲し（Construction のコード生成のような長い stage）、支援者が宣言されていれば各々を相互に盲目なスポークとして dispatch する。`pipeline` は支援者を宣言順に連鎖させ、各々が上流の仕事すべてを見る。`mob` はすべての支援者を率いる者のドラフトに対して並列に、1 つの有界な異議ラウンドで走らせる。誰が参加するかは `support_agents`、どう参加するかは `mode`。`pipeline` と `mob` は空でない `support_agents` を要する。
- **`for_each` は反復の成果物を名指す。** Unit ごとに 1 回走る 5 つの Construction stage は `for_each: unit-of-work` を宣言する。他の stage はこのフィールドを省いて 1 回走る。集約はグラフから推論され、宣言されない。
- **`lead_agent` と `support_agents` は `core/agents/*.md` に対して検証される。** ハードコードされたリストは無い — agent を足すことは、そのファイルをそのディレクトリに置くことである（[Agent を足す](03-adding-an-agent.md) を参照）。

これはオリエンテーションであり、契約ではない。型・制約・AI-DLC が後で足す予約名前空間フィールドを含む完全なフィールド表は、開発者リファレンスの [フィールドリファレンス — いつ使うか](../reference/15-stage-definition.md#field-reference-when-to-use) を読むこと。

---

## 3 区画の本体

frontmatter の下、本体は 3 つの区画を持ち、常にこの順である: `## Steps`、`## Sensors`、`## Learn`。`application-design.md` を見ると 3 つとも populated なのがわかる。

- **`## Steps`** は agent が従う命令形の散文である — ペルソナをロードし、事前コンテキストを読み、質問ファイルを作り、成果物を生成し、承認 gate を提示する。ここに stage のドメインの仕事が住み、グラフに触れずに*stage が何をするか*を変えるときに最も編集する区画である。
- **`## Sensors`** は stage の出力に束ねられた決定論的チェックを文書化する。`application-design.md` では、`required-sections` と `upstream-coverage` が stage の markdown 成果物に発火することと、各々が何を検証するかを説明する。束縛自体は frontmatter 上方の `sensors:` リストである。この区画はその束縛が何をするかの人間可読な記述である。sensor は [Sensor](06-sensors.md) で完全に扱う。
- **`## Learn`** は学習ループの儀式を文書化する — stage の実行中に agent が保つ `memory.md` 日記と、保たれた観察が承認 gate で practice と sensor へどう経路づくか。決定的に、この儀式は*space の memory レイヤー*（`aidlc/spaces/<active-space>/memory/`）と harness の sensor 設定（`.claude/sensors/`）に書き、stage ファイル自身には決して書き戻さない。

これら 3 区画は事前宣言されていたので、v0.5.0 の追加 — populated な Sensors と Learn の束縛 — は本体の再構築を強いるのではなくきれいに嵌まった。完全な本体モデルと各区画が含みうるものは [3 区画の本体モデル](../reference/15-stage-definition.md#three-compartment-body-model) にある。

内面化する価値のある境界が 1 つ: stage ファイルはフレームワークの成果物であり、形は不変である。本体の `## Steps` / `## Sensors` / `## Learn` の構造は、ワークフローによって決して書き換えられない。認可された唯一のワークフロー内編集は、学習ループが frontmatter の `sensors:` import リストに新しい sensor id を追記することである。stage ファイルで変えるそれ以外のすべては、harness engineer として意図的に変えるものである。

---

## グラフから見る consumes と produces

依存グラフはどこにも直接書かれていない — すべての stage にまたがる `consumes` と `produces` の宣言から立ち現れる。stage の `produces` リストはその前方エッジである: 別の stage が「誰が `scope-document` を生産するか？」と尋ねたとき、答えはそれを宣言した stage である。stage の `consumes` リストはその後方エッジである: それらの成果物が存在するまで走れない。

`requires_stage` は依存を明示し、純粋な順序も符号化する。2 つの役割を運ぶ:

1. **意味的なデータ依存** — 「私は成果物 X を消費し、それを stage Y が生産する」なので Y が `requires_stage` に入る。
2. **提示順序のエッジ** — 同じ phase の 2 つの stage で、データ依存は無いが順序が固定。弱いエッジを著述し、計算された表示順がアルファベット順のタイブレークに頼らず安定して着地するようにする。

stage を著述または移動するとき、この 3 つのリストがそれをワークフローに配線するものである。正しくすれば、stage は正しい scope に、正しい順序で、入力を満たされて現れる。まっさらな stage を配線する仕組みは [Stage を足す](02-adding-a-stage.md) で 1 ステップずつ扱う。

---

## stage-graph.json はコンパイルされる — 決して手編集しない

この実装は `dist/claude/.claude/tools/data/stage-graph.json` の JSON ファイルからグラフを走らせる。そのファイルは**ビルド成果物**であり、ソースファイルではない。stage ファイルにまたがる YAML frontmatter が正であり、JSON はそれをコンパイルして得られるものである。

流れは:

```
edit stage .md YAML  →  compile  →  stage-graph.json  →  runtime reads it
```

どの stage の frontmatter を編集した後も、compile を走らせて `stage-graph.json` を再生成し、続けて両方を一緒にコミットする。CI は、JSON が YAML のコンパイル結果と一致しなければマージを落とすドリフトチェックを走らせる — だから再コンパイル忘れは捕まえられ、出荷されない。

続くルール: **`stage-graph.json` を手編集しない。** YAML を編集し、再コンパイルする。手編集は次の compile で潰されるか、ドリフトチェックに引っかかる。compile コマンドとドリフトガードは [著述フロー](../reference/15-stage-definition.md#authoring-flow) に文書化されている。

---

## stage が*含む*もの対 stage が*する*こと

この章は stage ファイルが*含む*もの — その形式 — についてである。stage がランタイムに*する*ことについての姉妹契約がある: 承認 gate、質問フロー、状態チェックボックス、完了メッセージ。その振る舞いの契約はドメインを問わずすべての stage で同じで、[Stage プロトコル](../reference/04-stage-protocol.md) に住む。stage 本体が「承認 gate は stage-protocol.md に従え」と言うとき、それが指している契約である。

頭の中で両者を分けておくこと: stage の*定義*（この章、[リファレンス 15](../reference/15-stage-definition.md)）はファイル形式である。stage の*プロトコル*（[リファレンス 04](../reference/04-stage-protocol.md)）は、すべての stage の仕事を包むランタイムの振る舞いである。定義は編集する。プロトコルはたいてい触れずにおく。

frontmatter と本体を結びつける完全な注釈付きの例は [Worked example](../reference/15-stage-definition.md#worked-example) を参照。

---

## 次へ

- [Stage を足す](02-adding-a-stage.md) — 新しい stage ファイルを end to end で著述し、`consumes`/`produces` エッジを配線し、グラフをコンパイルし、scope に現れるのを見る。
