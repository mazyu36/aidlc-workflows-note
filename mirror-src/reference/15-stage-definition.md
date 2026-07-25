# ステージ定義

この章は AI-DLC のステージ定義の **ファイル形式** を文書化する — YAML frontmatter の
契約、3 区画のボディモデル、そしてそれらのソースを `stage-graph.json` に変える compile
pipeline である。[Stage Protocol](04-stage-protocol.md) を補完するもので、そちらはランタイム
の振る舞いの契約（承認 gate、質問フロー、状態追跡）を扱う。この章は stage ファイルが
*何を含むか* についてであり、Stage Protocol の章は stage が *何をするか* についてである。

コントリビューターはこの形式を理解するためにこれを読む。stage ファイルを書くか編集する
ときは、`dist/claude/.claude/aidlc-common/protocols/stage-definition.md` にある正典の契約を
参照すること。そのファイルが正典の spec であり — この章はナラティブと「いつ使うか」の
ガイダンスを足す。

---

## 2 つの読み手、1 つのファイル

すべての stage の `.md` ファイルは 2 人の読み手に仕える:

- **parser**（`lib.ts` の `parseStageFrontmatter`、マイルストーン 7 で出荷）。YAML
  frontmatter を読み、構造化された `StageEntry` を生む。ボディには触れない。
- **LLM agent**（stage を実行する）。ボディを読み、散文の指示に従い、成果物を生成する。
  frontmatter には触れない。

両方を 1 つのファイルに保つことは、コントリビューターがグラフのエッジと実行ステップを
並べて見ることを意味する。それらを別々のファイル（グラフ用に 1 つの YAML、agent 用に 1 つの
散文）に分割することは、stage をレビュー可能にする inline の可視性を壊すだろう。

---

## なぜ Variant A3 か

この形式は "Variant A3" と呼ばれる — v0.3.0 の計画中に検討された 3 つの著述バリアントの
うちの 3 番目である:

- **1 つのファイルは分割されたファイルに勝る。** 1 つの `.md` の中の frontmatter と散文は、
  グラフ構造と実行ステップを一緒に保つ。stage を読む reviewer は両方を見る。
- **Grep に優しい。** プレーンテキストである。バイナリ形式は無く、著述時の YAML 対 JSON の
  変換も無い。
- **Diff に優しい。** フィールドの追加、リネーム、ボディの編集は、すべてコードレビューで
  綺麗に現れる。

却下された代替案は、散文のみの stage を伴う中央のグラフファイル（手で編集する
`stage-graph.json`）だった。stage の散文を編集しながら、その stage がどの成果物を生成するかを
知る inline の可視性を失う。

---

## 著述フロー

```
┌─────────┐         ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ Edit    │  ───→   │ Pre-commit hook  │  ───→   │ stage-graph.json │  ───→   │ loadStageGraph() │
│ stage   │         │ aidlc-graph      │         │ (build artifact, │         │ (runtime,        │
│ .md YAML│         │ compile          │         │  checked in)     │         │  unchanged)      │
└─────────┘         └──────────────────┘         └──────────────────┘         └──────────────────┘
     │                                                                                 ▲
     │                              ┌──────────────────┐                               │
     └────────────────────────────→ │ CI drift check   │ ──── blocks merge on drift ───┘
                                    │ compile --check  │
                                    └──────────────────┘
```

YAML が正典である。JSON はビルド成果物である。CI がその関係を強制する。

`aidlc-graph compile` と `compile --check` は CLI サブコマンドとして出荷される（マイルストーン
9）; stage の YAML を編集した後は手で compile を走らせ、CI は drift を捕らえるために
`compile --check` を強制する。これを自動化する pre-commit hook は後の PR に先送りされている。
`stage-graph.json` はコンパイル済みの成果物である — 手で編集しないこと; YAML を編集して
再コンパイルすること。

---

## フィールドリファレンス — いつ使うか

正典の spec は、型と制約を伴う完全なフィールド表を持つ。この節は、判断を要するフィールドに
ついてのナラティブを足す。

### `requires_stage`

依存エッジを符号化する。2 つの役割がある:

1. **意味的なデータ依存。** 「私は成果物 X を消費し、それは stage Y が生成する」 → `Y` を
   `requires_stage` に足す。
2. **提示順のエッジ。** 意味的な依存は無いが固定の順序を持つ、同じ phase の 2 つの stage
   （例: Ideation で `feasibility` の前の `market-research`）。計算される `display_order` が
   安定して落ち着くように、弱いエッジを足す。

compile ステップの slug のアルファベット順のタイブレークはセーフティネットである。特定の
順序に落ち着かねばならない stage については、アルファベット順の偶然に頼るのではなく、
エッジを明示的に著述すること。

### `for_each`

インスタンスがイテレーションを駆動する成果物を名指す。stage はインスタンスごとに 1 回走る。

今日のユースケース: 5 つの Construction stage（`functional-design`、`nfr-requirements`、
`nfr-design`、`infrastructure-design`、`code-generation`）が Unit ごとに 1 回走る — それらは
それぞれ `for_each: unit-of-work`（`units-generation` が生成する成果物）を宣言する。

明日のユースケース: 環境ごと、テナントごと、リージョンごと、コンプライアンス管轄ごとに走る
stage。このプリミティブは workflow-engine として汎用であり; Construction がたまたま最初に
それを行使する。

**集約は宣言されるのではなく推論される。** `for_each` stage が生成する成果物を消費し、自身の
`for_each` を宣言しない stage は、定義により集約ステップである。`build-and-test` が正典の例で
ある — それは 5 つの Construction `for_each` stage すべてが Unit を跨いでイテレートし終えた
後に 1 回走り、それらの集約された出力を消費する。明示的な `fan_in` や集約フィールドは無い —
グラフ走査がそれを解き明かす。

### `workspace_requires`

ブール値、既定 `false`。intent ごとの record dir の下の計画文書だけでなく、**ソースコードを
workspace ルートに** 書かねばならない stage に `true` を設定する。

なぜ存在するか: stage の `produces[]` 成果物は常に record dir の下の markdown に解決される
（path resolver がそれらを書く唯一の場所である）。だから「produces は存在するか？」チェックは、
`code-generation-plan.md` と `code-summary.md` を書いたが実際のコードを 1 行も出さなかった
`code-generation` stage によって満たされてしまう（issue #366）。`workspace_requires: true` は
そのギャップを閉じる: stage 完了の成果物 guard（`aidlc-state.ts` の approve/advance/finalize/
complete-workflow）は、stage が完了できる前に、`aidlc/` workspace ツリーと harness ディレクトリ
の外の本物のソース作業の証拠を追加で要求する。

「ソース作業」がどう検出されるかは workspace に依存する:
- **Git workspace** - guard は git に尋ねるので、このセッションのコードを brownfield リポジトリ
  の既存の `src/` と区別できる。コミットされていないか追跡されていない非ドキュメントの変更が
  ある（`git status --porcelain`）か、最後のコミットが非ドキュメントのパスに触れた
  （`git diff --name-only HEAD~1 HEAD`）ときに通過する。2 番目の節は、commit してから approve
  すること（クリーンな作業ツリー、最後のコミットにコード）でも通過することを意味し、#366
  Update 3 のクリーンツリーの誤ブロックを閉じる。
- **Non-git workspace**（または任意の git エラー） - guard は shell を使わないファイルシステム
  存在チェックにフォールバックする: 少なくとも 1 つのファイルが `aidlc/` workspace ツリーと
  harness ディレクトリの外に存在せねばならない。

今日それを宣言するのは `code-generation` だけである（それは、そのボディがアプリケーション
コードを workspace ルートに書く唯一の stage である）。自身のコードや config を出す stage
（コントラクトジェネレータ、IaC エグゼキュータ）を足すチームは、同じ guard が適用されるよう、
それに `workspace_requires: true` を設定すべきである。CI 用には `AIDLC_SKIP_ARTIFACT_GUARD=1`
でそれをバイパスする。

### `produces_kinds`

`for_each: unit-of-work` stage の任意のマップ: 各キーは stage の `produces` または
`optional_produces` 成果物名の 1 つ、各値はその成果物が適用される Unit の **kind** のリストで
ある。kind は units-generation のエッジブロックで Unit ごとに宣言され（[Runtime
graph](13-runtime-graph.md) の `bolt_dag.units[].kind` を参照）、
`service | spec | ui | packaging | library` の 1 つである。

```yaml
produces:
  - performance-requirements
  - security-requirements
  - scalability-requirements
produces_kinds:
  performance-requirements: [service, ui]
  scalability-requirements: [service]
```

なぜ存在するか: 4 つの construction 設計 stage は、すべての Unit に同一に適用される固定の
produces リストで走っていたので、spec Unit は scalability ドキュメントを、packaging Unit は
business-logic モデルを負っていた - 人間が書かねばならない N/A スタブである。`produces_kinds`
はエンジンが Unit ごとにマトリクスを刈り込むことを可能にする: Unit が `kind` を運ぶとき、
エンジンは、その kind をその kind リストに含む produces エントリだけを保つ。マップに
**載っていない** 成果物はすべての kind に適用される（kind 固有のものだけを注記する）。kind を
**持たない** Unit、または `produces_kinds` マップをまったく持たない stage は、完全なマトリクス
を保つ - だからこれは既存のあらゆるワークフローに対して不活性である。

刈り込みは対称である: それは `run-stage` ディレクティブの `produces` パス（conductor が書く
もの）と per-unit のカバレッジチェック（approve 経路の guard が要求するもの）の両方をフィルタ
する。それは `optional_produces` と組み合わさる: ディレクティブのパスは両リストの kind で
フィルタされた和集合であり、一方カバレッジは必須の `produces` だけをキーに保つ（任意の成果物
は、適用されない kind についてはディレクティブから刈り込まれ、いずれにせよカバレッジ免除の
ままである）。必須集合が **空** に刈り込まれる Unit は定義によりカバーされ - stage はそれに
適用されない - そして *すべての* Unit が空に刈り込まれる per-unit stage は、artifact guard で
デッドロックするのではなく no-op として approve する。4 つの stage の既定 kind マトリクスは
stage frontmatter のデータであり、エントリごとにレビュー可能・差し戻し可能である; 誤った
エントリを除くと、その成果物の完全なマトリクスが復元される。

1 つの信頼上の注記: `kind:` 値は units-generation の gate で enum チェックされる
（`required-sections` sensor がタイポに対して大きな音で失敗する）が、コンパイル済みの
ランタイムグラフはその後は信頼される - エンジンは `bolt_dag.units[].kind` を読むときに kind を
形状チェックするだけである（コンパイル済みバッチを信頼するのと同じやり方）。コンパイル済み
グラフの中で有効だが誤った kind に手で編集された unit は、静かにその誤った kind の集合に
刈り込まれる。

### `consumes[].required`

consume エントリごとのブール値。意味的には **アクティブな plan にスコープされる** もので、
その成果物が常にどこかに存在するというグローバルな主張ではない:

> `required: true` は *「生成する stage がアクティブな plan で走るなら、この consume は満たされ
> ねばならない」* を意味する。それは「producer が常に走る」ことを **意味しない**。scope が
> producer を除外するとき（例: `bugfix` は `units-generation` をスキップする）、その producer の
> 成果物の `required: true` consume はすべて意味を失う — 要求すべきものが何も無い。

**なぜスコープされた読みか。** `all` 実行のもの（`enterprise`、`feature`、`workshop`）を除く
すべての scope は、上流の stage を意図的にスキップする。フラットでグローバルな
`required: true` は、それらの scope を構造的に無効にしてしまうが、それは誤りである — それらは
正当な運用モードである。本当の契約は条件付きである: 「上流が走るなら、下流に私を供給せよ」。
stage のボディは既に不在のケースを優雅に扱う（「利用可能なら」のような散文の指示や、
コンテキストからのフォールバック）。

**これが doctor の lint にとって意味すること。** lint は各アクティブな scope を歩き、「stage X
の成果物 Y に対する `required: true` consume は、Y の producer がこの scope で SKIP なので意味を
失う」と報告する。それは助言的であり、ブロックしない — user は scope を選ぶことで既にその
切り詰めを選択済みである。

**v0.10.0 が足すもの。** 予約された `when:` プリミティブ（下の「予約済み」の節を参照）は、
著者がより豊かな述語を表現することを可能にする — `when: producer-in-plan`、
`when: mode == brownfield`、`when: scope != poc`。今日の `required: true` +
`conditional_on: brownfield|greenfield` のペアは v0.3.0 が必要とする 2 つの次元をカバーする;
`when:` はそれを一般化する。

### `consumes[].conditional_on`

brownfield/greenfield の分岐を捉える。例: `reverse-engineering` は brownfield モードでのみ
成果物を生成する; それらの成果物を消費する stage は、scope resolver に「この consume は
brownfield のときにのみ必須である」と伝えるために、consume を `conditional_on: brownfield` と
マークする。

無条件の consume については、**フィールドを完全に省く**。`always` 値は無い — 無条件の consume
は単に `conditional_on` キーを持たない。

### `optional_produces`

`produces:` と並行な、プレーンな kebab-case の文字列リスト。それは、stage が unit ごとに書く
**かもしれない** が、書くことを **要求されない** 成果物を名指す。不在は無しを意味する; それを
必要とする 2 つの stage だけがそれを宣言するので、コンパイル済みの `stage-graph.json` は最小の
ままである。

なぜ存在するか: per-unit の Construction stage（`for_each: unit-of-work`）は、すべての
`produces[]` 成果物がその unit の record dir の下でディスク上に存在するときにのみ、その unit に
ついて COVERED である（`aidlc-orchestrate.ts` の per-unit カバレッジチェック）。いくつかの成果物
は本当に unit に条件付きである - `functional-design` は unit が UI を持つときにのみ
`frontend-components` を書く; `infrastructure-design` は unit がインフラを共有するときにのみ
`shared-infrastructure` を書く。それらを `produces:` の下に列挙すると、backend のみの unit が
カバレッジを満たすためだけに N/A スタブを書くことを強いられ、そうするまで stage の gate に
到達できないままだった。それらを `optional_produces:` に移すと、それらは免除される:

- **カバレッジ免除。** `optional_produces` エントリは per-unit のカバレッジループに無視される。
  unit は、その **必須の** `produces[]` 成果物が存在すればカバーされる; 任意のものは、`next` が
  進むことも `approve` がコミットすることも決してブロックしない。
- **なお conductor 用に解決される。** `run-stage` ディレクティブの `produces` パスは
  `produces` + `optional_produces` を和集合するので、unit が条件付きの成果物を実際に書くとき、
  conductor はそれがどこに落ちるかをなお知る。stage が `produces_kinds` も宣言するとき、その
  和集合は解決される前に kind でフィルタされる（上の `produces_kinds` を参照）ので、任意の
  成果物が適用されない kind は、そのパスを決して見ない。
- **なお語彙の中にある。** `artifactsRegistry()` と `producersOf()` は両リストを和集合するので、
  成果物名とその producer stage は登録されたままである。

**ペアリングの規約。** すべての `optional_produces` エントリは、それをいつ書くかを agent に
伝える `(CONDITIONAL - ...)` マーカーを stage のボディの散文（と `outputs:` 文字列）に持たね
ばならない。frontmatter のキーはエンジンのカバレッジのビューである; 散文は agent の指示で
ある。それらを同期させておくこと。

**警告。** `optional_produces` とマークされた成果物は、per-unit のカバレッジ台帳に不可視で
ある - エンジンは unit がそれを生成したことを証明できない。それは、正当に unit に条件付きで
ある成果物にのみ使い、stage が unit ごとに常に書くべき成果物のカバレッジを静かに緩めるために
使ってはならない。

### `mode`

stage の **通信トポロジ** — ボディが走る間、誰が誰に話すか。5 つの値、4 つがアクティブ:

- `inline` — conductor は自身のコンテキストで stage を走らせる; support agent はそれが採用する
  視点（声）である。dispatch はゼロ。短い stage、実行が速い、コンテキスト圧力が無い。
- `subagent` — ハブアンドスポーク。lead は新鮮な subagent コンテキストに dispatch される
  （conductor のコンテキストを吹き飛ばすであろう長い stage、例: Construction のコード生成）。
  stage が `support_agents` も宣言するとき、各々は lead が返したドラフトに対して本物のスポーク
  として dispatch され — 相互に盲目で、パスのみのブリーフ — そして lead は統合のためにもう 1 回
  dispatch される。
- `pipeline` — チェーン。lead がドラフトする; 各 support agent が宣言された順序で肉付けし、各
  リンクはドラフトとそれ以前のすべての貢献を見る。順序が要点である。空でない `support_agents`
  を要求する。
- `mob` — メッシュ、境界のあるラウンドとして走る: すべての support agent が lead のドラフトに
  対して並行に貢献し（相互に盲目）、lead が統合し、未解決の反対者は他の参加者の立場とともに
  1 回の confirm-or-maintain ラウンドを得る。維持された異議は gate で逐語的に引用される。空で
  ない `support_agents` を要求する。出荷されたショーケースは `user-stories` である（Product
  Manager が lead; Design、Developer、Quality が協働者; Product Lead が reviewer — mob
  エラボレーションの儀式）。
- `agent-team` — **予約済み**。メッシュ協働のための将来のネイティブバス transport: Anthropic の
  実験的な `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` プリミティブが安定すると、ライブのピア
  メッセージングルームが、conductor が運ぶラウンド無しに `mob` の意味論を運べる。`mob` は
  ポータブルなモードである; どの stage も `agent-team` を宣言しない。

あらゆるトポロジで conductor がバスである: agent は互いを決して呼び出さない — conductor だけが
委譲する。この書き込みモデルは本物の作業セッションを鏡写しにする: 各人が自分の作業を書き、
オーナーが照合して編集する。dispatch された各 support agent は貢献ファイル
（`contributions/<agent-slug>.md`、identity マーカーを最初の行に持つ stage-protocol §11 の
形状）を書く; lead だけが stage の `produces[]` 成果物を編集する; pipeline のリンクは代わりに
成果物を直接進める。mob と subagent-with-supports の stage では、貢献ファイルが完了の証拠で
ある — エンジンは 1 つでも欠けている間は承認を拒む。review ループはモードでは無い: `reviewer`
+ `reviewer_max_iterations` は任意のモードの上に two-party の批評トポロジを届け、NOT-READY は
lead だけを再び呼び出す。

**消費者の契約。** `mode` フィールドを読む orchestrator のコードは `agent-team` を明示的に扱わ
ねばならない — 最低でも「mode agent-team not yet implemented」を投げる。既定の実行経路に
フォールスルーしないこと。enum の拡張での静かなフォールスルーは既知の foot-gun である。

**Swarm トリガの結合。** 自律的な Construction swarm は `for_each: unit-of-work` +
`mode: subagent` で発火する。per-unit のビルド stage を re-mode すると、静かにそれを swarm 経路
から外す; `aidlc-graph compile` はその形状を見ると stderr の助言を出す。

### `lead_agent` と `support_agents`

lead agent が stage を所有する。lead のペルソナ（skills、knowledge、ツールの allowlist）は
stage の開始時にロードされる。support agent は視点を足す — stage は要件作業のために
`aidlc-product-agent` で lead する一方、キャパシティの現実性チェックのために
`aidlc-delivery-agent` を support としてロードするかもしれない。

両フィールドは `loadAgents()`（マイルストーン 3 で導入）を介して `.claude/agents/*.md` に対して
動的に検証される — `aidlc-graph.ts compile` は発見した agent の slug を
`validateStageFrontmatter` に渡すので、合致するファイルの無い agent を名指す `lead_agent` または
`support_agents` 値は、未登録 subagent の `Task` エラーとしてランタイムに表出するのではなく、
compile を大きな音で失敗させる（`lead_agent "<name>" has no matching .claude/agents/*.md`）。
唯一の免除は予約された `orchestrator` 擬似 agent（conductor 自身、bootstrap の initialization
stage で `lead_agent` として名指される）である; それは設計上 agent ファイルを持たない。スキーマ
にハードコードされた enum は無い — agent を足すことは、必須の frontmatter を伴う `.md` ファイル
を `.claude/agents/` に落とすことを意味する。[Contributing: Adding an
Agent](11-contributing.md#adding-an-agent) を参照。

### `reviewer` と `reviewer_max_iterations`

任意。`reviewer` は、stage のボディがその成果物を生成した後、承認 gate の前に呼び出される
quality-gate agent を名指す（[Stage Protocol](04-stage-protocol.md) を参照）。今日 2 つの
reviewer が出荷される — `aidlc-product-lead-agent` と `aidlc-architecture-reviewer-agent` —
そして compile は、`lead_agent` が検証されるのと同じやり方で、発見された agent の名簿に対して
値を検証する。

`reviewer_max_iterations` は、ワークフローが未解決の指摘とともに gate へ進む前の review/revise
ループに上限を設ける。`reviewer` が宣言されているが上限が与えられていないとき、それは **既定で
2** になる; コンパイラは欠けているか非正の値を 2 に強制する。`reviewer` を宣言しない stage では
フィールドを省くこと: コンパイラは `reviewer` 無しで宣言された `reviewer_max_iterations` を拒む
（スキーマエラー `reviewer_max_iterations requires a reviewer` がグラフの compile を失敗させる）
ので、それは決して静かに無視されない。

---

## agent frontmatter との関係

stage と agent は同じ YAML 優先の規律に従う。agent frontmatter（[Agent
System](05-agent-system.md#frontmatter-contract) を参照）は *誰* を宣言する — agent の名前、
許可されたツール、tier。stage frontmatter は *何* を宣言する — stage がどの成果物を生成・消費
するか、どの agent に委譲するか、どう実行するか。

両方の形式は:

- それらのドメインの正典のソースである（並行するハードコードされたマップは無い）。
- 型付きの構造を返す `loadX()` ヘルパーとともに出荷される。
- ハードコードされた enum に対してではなく、ファイルシステムに対して動的に検証する。

新しい stage を足すことは、新しい agent を足すことと同じ形状である: `.md` ファイルを落とし、
必須の frontmatter を足すと、ヘルパーがランタイムでそれを拾う。

---

## 実例

正典の例は `scope-definition` である。規範的な YAML ブロックは
`dist/claude/.claude/aidlc-common/protocols/stage-definition.md` に住む — ここで複製するので
はなく、そちらを参照すること。

この例は、今日の散文が記述するものを、構造化された形で符号化する:

- `requires_stage: [intent-capture]` は散文の指示「intent の `ideation/intent-capture/`
  （その record dir の下）から intent statement を読む」を符号化する。parser は散文を気にしない
  — グラフのエッジを見るだけである — が、人間の読み手はそれらを同期させておくべきである。
- `consumes: [{artifact: intent-statement, required: true}]` は、この stage が
  `intent-statement` が存在するまでブロックされると言う。scope の resolver が `intent-statement`
  の producer を見つけられないなら、doctor の missing-producer チェックが失敗する。
- `produces: [scope-document, intent-backlog, scope-definition-questions]` は前向きのエッジで
  ある — 「誰が `scope-document` を生成するか？」を探す他の stage は、`aidlc-graph.ts
  producersOf()` を介してこれを見つける。
- `for_each` フィールドは無い — `scope-definition` はワークフローごとに 1 回走る。

---

## 3 区画のボディモデル

stage ファイルのボディは 3 つの区画を持ち、この順序で宣言される。v0.3.0 で populate されるのは
`## Steps` だけである。

| 区画 | v0.3.0 | v0.5.0 | ここに入るもの |
|-------------|--------|--------|----------------|
| `## Steps` | 必須・populate 済み | 不変 | agent が従う命令形の散文 |
| `## Sensors` | 予約済み・不在 | populate 済み | 決定論的な sensor 束縛（フラットな `.claude/sensors/` レジストリの ID） |
| `## Learn` | 予約済み・不在 | populate 済み | ループドライバの束縛と observer rule |

v0.3.0 で 3 つの区画を事前宣言したことは、v0.5.0 の追加がボディの再構築ではなくスロットイン
変更であることを意味した。`## Sensors` の束縛の意味論と pull-import モデルについては [Sensor
System](07-sensor-system.md) を参照。

**マイルストーン 8 の移行ルール:** 既存のボディを `## Steps` の下に包む、それだけである。
ほとんどの stage ファイルは既に `## Steps` を最初のボディ見出しとして使っている。

---

## YAML 移行 — 出荷済み

マイルストーン 7 は `lib.ts` に `parseStageFrontmatter` と `emitStageFrontmatter` を出荷した —
YAML のみで、散文の後方互換経路は無い。マイルストーン 8 は 31 個すべての stage ファイルを、
1 つのアトミックな変更で YAML frontmatter に移行した。マイルストーン 9 は `aidlc-graph.ts` を
拡張して YAML を `stage-graph.json` に compile し、CI の drift guard として `compile --check` を
足した。クリーンなツリーで `bun aidlc-graph.ts compile --check` を走らせると 0 で終了する;
JSON を再コンパイルせずに任意の stage の YAML を編集すると、明確なメッセージとともに 1 で終了
する。

---

## v0.3.0 での既知の限界

- **`for_each` は新しい。** `**Per-Unit**: Yes` を持つ 5 つの Construction stage は
  `for_each: unit-of-work` に移行する; 他の 26 の stage はフィールドを完全に省く。
- **Sensors / Learn 区画は宣言されるが空。** parser はそれらの不在を許容する; v0.5.0 はそれらを
  populate した（[Sensor System](07-sensor-system.md) を参照）。
- **drift チェックを超えるランタイム検証は無い。** parser は有効な `StageEntry` を生む任意の
  YAML を受理する; doctor の後の拡張が、その上に助言的な rule/sensor チェックを足す。

---

## 将来の拡張 — 予約済み名前空間

spec は、AI-DLC が後のリリースでおそらく足すであろうプリミティブのために名前を予約する。
スキーマは未知のキーを拒む — ここで名前を予約することは、将来のコントリビューションがその場
しのぎの追加と衝突するのを防ぐ。

| キー | 見込みリリース | 何をするか |
|-----|----------------|-----------------|
| `when` | v0.10.0 fitness compiler | 構造化された条件。`condition` の散文を機械が強制可能なロジックに compile する。`consumes[].conditional_on` を置き換え、今日の scope 対応の `consumes[].required` をより豊かな述語（`producer-in-plan`、`mode == brownfield`、`scope != poc`）で一般化する |
| `on_failure` | v0.8.0 Ralph loop | 宣言的なエラー回復 — 「この stage が失敗したら X に戻る」または「調整された入力でリトライする」。修正の意味論を `stage-protocol-recovery.md` の散文から移す |
| `blocks_on` | v0.4.0 Construction（表出すれば） | データ読み取り無しの完了依存 — 今日の過負荷な `requires_stage`（「私はあなたの出力を消費する」と「私はあなたの後に走る」を混同する）を分割する |
| `timeout` | v0.5.0 sensor binding | 実行予算（デッドライン）。stage frontmatter ではなく sensor 束縛にホームを持つ |
| `retry` | v0.8.0 Ralph loop | 失敗時のリトライポリシー。stage frontmatter ではなくループ設定にホームを持つ |

設計の論拠: Claude Code 自身の task プリミティブ（TaskCreate ファミリと `/loop`、cron）は、依存、
blocks、リトライ、timeout を省く — すべての多段の orchestration はクライアント側のコードに
押しやられる。この実装は、実行の振る舞い（リトライ、timeout、失敗の扱い）を stage spec では
なくループと sensor のサブシステムにホームを持たせることで、その選択を鏡写しにする。上記の
フィールドは、消費者が現れれば、新しいパラダイムではなく控えめな構造的拡張になるだろう。

予約済み名前空間のパターンは audit の分類法（[State Machine](12-state-machine.md)）に先例を
持ち、そこはイベント名を `Reserved (v0.x PR N)` の Emitter セルで事前登録する — 名前は
レジストリに存在するが、消費者の PR が出荷されるまでどのコードもそれを emit しない、そして
その時点で同じコミットが `Reserved` マーカーを本物の emitter パスに置き換える。

---

## クロスリファレンス

- `dist/claude/.claude/aidlc-common/protocols/stage-definition.md` — この章がナラティブにする
  正典の spec。
- [Stage Protocol](04-stage-protocol.md) — ランタイムの実行の振る舞い。
- [Agent System](05-agent-system.md) — agent ファイルのための並行する YAML 優先の契約。
- [State Machine](12-state-machine.md) — stage の実行が audit イベントを emit する場所。
