# Construction と swarm

Construction は AI-DLC が物を作るところである — Unit ごとの stage が走り、**swarm** が
その仕事を一度に多くの Unit にまたがってファンアウトできるところ。それはまた、「私は何を、
どう形作れるか？」への最も清潔な答えが、どのつまみが誰のものかについて正直であることを要する、
harness の部分でもある。ここでのレバーのいくつかは、他のすべての章が教えるやり方でデータとして
著述される、harness engineer としてのあなたのものである。他のつまみは、gate の人間と、実行を
起動するオペレーターのもとにある。この章はそれらすべてを歩き、線を正確に印す。そうすればあなたは
正しいサーフェスに手を伸ばし、押すのがあなたの役目でないものを押すのをやめられる。

通底するのは、このガイドの残りが運ぶのと同じものである: あなたは `core/` 下の**データ**を
編集することで Construction を作り直す — rule、stage、sensor のチェックコマンド — 決してコード
を編集することによってではない。Construction を違って感じさせるのは、その最も目に見える振る舞い
の 2 つ（autonomy の grant、swarm の driver）が、意図的にデータファイル*でない*関心によって
統べられていることであり、それを認識することが、存在しない設定を著述することからあなたを守る。

---

## 3 つの関心、3 人のオーナー

フレームワークの設計原則は、すべての決定を、それがどんな種類のものかで分ける: 決定論は
ツールに属し、knowledge は agent に属し、判断は人間に属す。Construction の swarm はその分割を
具体化したものであり、どの 1 つのつまみに触れる前にも、全体像を保つ価値がある。

| Construction における関心 | オーナー | どこに住むか |
|---|---|---|
| チームの autonomy の **posture**（恒常的な既定） | あなた、harness engineer | `core/memory/{team,project}.md` の rule（データ） |
| Unit が並列化**できる**もの | あなた、harness engineer | `units-generation` stage とその依存 DAG（データ） |
| swarm が信頼する **convergence check** | あなた、harness engineer | あなたのプロジェクト自身の build/test コマンド + 保護された spec（データ + プロジェクト設定） |
| このプロジェクトの実際の autonomy **grant** | 人間 | ランタイムの ladder prompt |
| swarm の **driver** 選択 | オペレーター | `AIDLC_USE_SWARM` 環境変数 |
| convergence の **verdict**、merge-back、audit | ツール | `aidlc-swarm.ts`（コード → 開発者リファレンス） |

「あなた」と印された 3 行が、この章の本体である。他の 3 つは、あなたのデータが形作る
ランタイムを理解する必要があるので扱うが、あなたはそれらのどれも著述しない。

---

## autonomy の posture — rule として書かれる、あなたの本物のレバー

チームが制御したい最初のものは、Construction がどれだけの手取り足取りを要求するかである。
同梱の既定は、あなたが `core/memory/org.md` の `## Walking Skeleton` 見出しの下に著述する org
rule に住む（`org.md:28-42`）。それをフレームワークのスタンスとして読む:

- greenfield の scope — `mvp`、`enterprise`、`feature`、`poc`、`workshop`、`infra` — では
  **walking-skeleton Bolt が最初に走る**。Bolt 1 は単独でゲートされ、残りの Bolt が走る前に
  ユーザーがそれを承認する。
- incremental の scope — `bugfix`、`refactor`、`security-patch` — では **skeleton の儀式は
  飛ばされる**。既存のコードベースにブートストラップするものは無いので、最初の Bolt は他と
  同じように走る。
- Bolt 1 が出荷された後、**ladder prompt** が一度発火する:「残りの Bolt はどう走るべきか？」
  2 つの選択肢とともに、自律的に続けるか、すべての Bolt をゲートするか。選ばれた答えは、intent の
  `aidlc-state.md`（その record dir の下）に `Construction Autonomy Mode` として永続する。

この posture を、あなたは任意の rule を形作るのと同じやり方で、
[Rule と学習ループ](05-rules-and-the-loop.md) の strict-additive レイヤーを通して形作る:
チーム全体のスタンスには `team.md` を、1 つのプロジェクトの恒常的な逸脱には `project.md` を
編集する。`org.md` には触れない — それはフレームワーク同梱で、継承される。

あなたが設定するのは **既定とガイダンス** である。grant は ladder prompt の人間のもとに残り、
その人がプロジェクトごとの判断を下す。あなたの rule の散文は agent がそのプロンプトに入るときに
読むものであり、だから推奨を枠づける; *この*プロジェクトが hands-off で走るかどうかの判断は、
gate の人のもとに残る。それが 1 つのプロンプトをまっすぐ貫いて引かれた、決定論-knowledge-判断の
線である: あなたが恒常的なガイダンスを著述し（データ）、agent がそれを提示し（knowledge）、
人間が決める（判断）。

### Worked example — チームが既定ですべての Bolt をゲートするようにする

あなたのチームが自律的な Construction に不慣れで、保守的な posture を望むとしよう: 信頼が
獲得されるまで、すべての Bolt をレビューし、hands-off の実行は無し。`core/memory/team.md` の
`## Walking Skeleton` の下に箇条書きを足す:

```markdown
## Walking Skeleton

Until our team has shipped three clean autonomous batches, the recommended
answer at the ladder prompt is **gate every Bolt**. Reviewers see each Bolt's
diff before the next one starts. Revisit this default once our convergence
checks have proven reliable.
```

これは org の既定の上に積み重なる — skeleton-first / skip-ceremony の分割は変わらず、あなたの
チームの散文は ladder prompt で agent のコンテキストに加わる。あるプロジェクトがそれに値するなら
人間はなお「自律的に続ける」を選べる; あなたの rule は選択を開いたまま推奨を形作る。変更は次の
ワークフローの compile 境界で効く。他のすべての rule 編集とちょうど同じである — ワークフローの
途中の編集は、進行中の実行を遡って変えはしない。

信頼された scope について hands-off の Construction に移行するチームは、鏡像の箇条書きを書く:
「このコードベースの `feature` scope については、walking skeleton が green になったら推奨の
ladder の答えは自律的に続けるである。」同じファイル、同じ見出し、反対の推奨。

---

## 並列に走れるものを形作る — Bolt-DAG

swarm は仕事を Unit にまたがってファンアウトするので、「一度に何が走れるか？」という問いは、
上流の inception で、`units-generation` stage によって決められる。その stage は
`unit-of-work-dependency.md` を生産し（`core/aidlc-common/stages/inception/units-generation.md`
が `produces: unit-of-work-dependency` を宣言する）、その成果物の中で、必須のフェンスされた
`yaml` エッジブロックが、すべての Unit をその `depends_on` リストとともに挙げる。

コンパイラはそのブロックを `runtime-graph.json` の `bolt_dag` ノードに読む。ノードが在るのは、
エッジブロックが well-formed かつ非巡回である **ときだけ** である; 不在・不正・巡回のブロックは
ノードを完全に省く（[Runtime Graph](../reference/13-runtime-graph.md)、44 行目のスキーマ注記）。
`bolt_dag` ノードはまた `batches` を運ぶ — すべての Unit の依存が先行するレベルによって満たされる
トポロジのレベルであり、だから 1 つの batch の Unit はそれらの間にエッジを持たず、一緒に
ファンアウトできる。

並列サーフェス自身は、5 つの **Unit ごと** の Construction stage であり、各々がその
frontmatter で `for_each: unit-of-work` を宣言する:

| Stage | 走る |
|---|---|
| `nfr-requirements` | Unit ごとに 1 回 |
| `functional-design` | Unit ごとに 1 回 |
| `nfr-design` | Unit ごとに 1 回 |
| `infrastructure-design` | Unit ごとに 1 回 |
| `code-generation` | Unit ごとに 1 回 |

4 つの design stage については、Unit ごとのカバレッジはさらに **kind でフィルタ** される:
各 Unit の `kind`（2.7 のエッジブロックでタグされる）が、stage の `produces_kinds` マップを
通して、その produces する成果物のうちどれをその Unit が実際に負うかを選ぶ。エンジンは run-stage
ディレクティブの produces パスと、カバレッジチェックの両方をその集合に剪定するので、`spec` Unit
はデプロイメント文書無しで infrastructure-design について完了し、`packaging` Unit はファイル
ゼロで functional-design について完了する。タグの無い Unit は完全なマトリクスを保つ。

（残りの 2 つの Construction stage、`build-and-test` と `ci-pipeline` は、最後にすべてに
またがって 1 回走るので、Unit ごとのファンアウトの一部ではない。）

**この並列サーフェスは、`units-generation` が走る scope — `enterprise`、`feature`、`mvp`、
`workshop` — でだけ存在する。** incremental の scope（`bugfix`、`refactor`、
`security-patch`）と `poc`/`infra` は `units-generation` を決して走らせないので、エッジブロック
を生産せず、`bolt_dag` を運ばず、swarm がファンアウトする対象が何も無いまま Construction を
single-pass で走らせる。仕事が本当にマルチ Unit であるところで swarm を形作り、hands-off の
Construction を、すべての scope ではなくマルチ Unit の greenfield scope の性質として扱う。

ここでの harness レバーは間接的だが本物である: **あなたは、`units-generation` が捉える依存
構造を形作ることで、何が並列化するかを形作る。** 交差依存の少ない粗い Unit を好むチーム
ガイダンスを著述すれば、より多くの Unit が同じ batch に着地して並行して走る。密で深く連鎖した
依存は、仕事を多くの小さな batch に直列化する。あなたはこれに、`units-generation` stage の散文と、
architect agent が分解しながら読む rule を通して影響する — 分解自身は agent が人間とともに行う
knowledge の判断であり、それが書くトポロジがコンパイラが batch に変えるものである。

エッジブロックを `bolt_dag` に変える compile とパースはコードであり、あなたが著述するもの
ではない。そのパーサーを形作ることはコードの変更である →
[開発者リファレンス](../reference/13-runtime-graph.md) を参照。

---

## convergence を配線する — あなたのプロジェクト自身のチェックが信頼されるシグナル

swarm ワーカーは、その Unit が収束したと主張できる。フレームワークはその主張を決して鵜呑みに
しない。権威あるシグナルは、referee が走らせる、あなたのプロジェクト**自身のチェックコマンド**で
ある: exit `0` は真に収束を意味し、それ以外の exit はまだを意味する。これは harness engineer が
自律的な Construction のために保証する唯一最も重要なことである — プロジェクトが実際に本物の
チェックコマンドと保護された spec を*持つ*こと、そうすれば swarm には収束の対象となる信頼できる
ものがある。

2 つのサーフェスがシグナルを運ぶ:

- **チェックコマンド。** あなたの Unit が完了したことを証明するもの何でも — `npm test`、
  `pytest`、build-and-lint スクリプト、あなたの CI のローカル相当物。referee はループ中に Unit
  ごとにそれを走らせ、finalize でも再び走らせる。green の exit だけが、Unit の仕事をマージ
  させる。
- **保護された spec ファイル。** referee は指定された `--test-file` を、その fork された git の
  ベースラインに対して改竄防止で比較できるので、ワーカーは「完了」を定義するテストを、赤い
  チェックを green にするために静かに弱めることはできない。あなたは受け入れ基準を符号化する
  spec が存在し、それが指されるファイルであることを保証する。

あなたの harness への貢献は、両方を本物で意味あるものにすることである。常に通るチェック、
または空の spec は、swarm にゴム印を手渡す。`org.md:44-58` の `## Testing Posture` rule は
既に scope ごとのテストの下限を設定する（例えば、`mvp`/`feature` は 80% カバレッジで
tests-alongside-code を得る）; `team.md` でより厳格な posture を著述することが、チェックが
強制するバーを上げる方法である。

sensor は散文の側でチェックを補完する。`units-generation` が既にインポートする
`required-sections` と `upstream-coverage` sensor は、成果物の形状とカバレッジを gate で検証する;
あなたは [Sensor](06-sensors.md) の筋力で、プロジェクト固有の convergence または
required-sections sensor を著述し、それを、同じギャップを求めて出力を見続ける Construction
stage に束ねられる。sensor は各書き込みで発火する助言的なテレメトリである; プロジェクトの
チェックコマンドは硬い convergence gate である。それらは 2 つの半分を担う — sensor は agent が
書くにつれ形状を見張り、チェックは Unit がマージしてよいかを決める。

---

## driver の継ぎ目 - `AIDLC_USE_SWARM`

swarm が物理的にどうファンアウトするかは環境変数によって選ばれ、これが **オペレーターの
つまみ** であることをはっきりさせる価値がある。それは `.claude/` のデータファイルではなく、
`settings.json` にもない（ファンアウト時に conductor 側で読まれる）。あなたはそれを著述しない;
あなたのデータが形作るランタイムを知るために、それを理解する。

| `AIDLC_USE_SWARM` | Driver | 振る舞い |
|---|---|---|
| unset または `"1"` でない | subagent floor | conductor は 1 つのメッセージで N 個の並列 `Task` 呼び出しを、Unit ごとに 1 つ発する。 |
| `"1"` | inline Dynamic Workflow | conductor は、その JS が Unit ごとのパイプラインと反復上限を所有する `Workflow` を著述する。 |
| `"1"` だが Workflow ツールが利用不可 | floor へ loud-degrade | conductor は floor にフォールバックし、`--degraded-from ultracode` を渡すので referee は `SWARM_DEGRADED` を発する。 |

どちらの driver も同じ 5 つの Unit ごとの stage を走らせ、同じプロジェクトのチェックに対して
収束する。違いは純粋に、並列の仕事がどうディスパッチされるかである。暴走の歯止めは、swarm ツール
自身の外、harness の **Stop-hook の上限**（`core/hooks/aidlc-stop.ts`、`blockCap()` /
`defaultBlockCap()` のペア、`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` として露出）に住む。この
autonomous-Construction の経路では既定の上限は **8 ブロック** である（インタラクティブの既定は
2; 明示的な `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` は両方を上書きする）。driver の継ぎ目の契約は
[Skill System § 6](../reference/17-skill-system.md#6-the-swarm-referee-the-driver-seam-and-the-bolt-dag)
にある。

1 つの判断は driver とともに決して動かない: 失敗は autonomy モードに関わらず、
`aidlc-common/protocols/stage-protocol.md:125`（「失敗時は halt-and-ask」）に従い、**常に
halt して人間を再び関与させる**。referee の `finalize` がその exit-2 のエンベロープを返すと、
conductor はバトンを人間へ戻す。hands-off モードは happy-path の gate を除くが、失敗の halt は
大きな音のまま保つ。

---

## どこでコードの変更になるか

線は清潔である。上のすべて — autonomy posture rule、エッジブロックを生産する Unit の分解、
プロジェクトのチェックコマンドと保護された spec、補完的な sensor — は、あなたが `core/` または
あなたのプロジェクト設定の下に著述するデータである。あなたはコードに触れずに Construction を
形作る。

swarm の機構はコードであり、それを形作ることは開発者リファレンスの領域である:

- **referee** `aidlc-swarm.ts` — worktree を fork し、verdict を走らせ、マージ前に主張された
  すべての Unit を再検証し（嘘つき conductor のガード）、merge-back を直列化し、6 つの `SWARM_*`
  audit イベントを発する、ステートレスな `prepare` / `check` / `finalize` サブコマンド。
- **engine** `aidlc-orchestrate.ts` — 厳密に 3 つのサブコマンド `next`・`report`・`park` を
  持つ決定論的なルーター; それは Construction の batch がいつ swarm の適格になるかを決める。
- **Bolt-DAG パーサー** — エッジブロックを `runtime-graph.json` に読む compile ステップ。

3 つすべての規範的な契約は
[Skill System § 6](../reference/17-skill-system.md#6-the-swarm-referee-the-driver-seam-and-the-bolt-dag)
であり、`bolt_dag` ノードのスキーマは [Runtime Graph](../reference/13-runtime-graph.md) にある。
conductor 自身の章は [Orchestrator](../reference/03-orchestrator.md) である。

あなたの posture rule が統べるもののユーザー向けの側 — walking-skeleton gate、ladder prompt、
autonomy モード — は、ユーザーガイドの
[Phase と Stage § Construction](../guide/04-phases-and-stages.md) で歩かれ、ログで目にする
6 つの `SWARM_*` audit イベントは [状態と Audit](../guide/10-state-and-audit.md) にカタログ化
されている。

---

## 次へ

- **[新しい harness への移植](09-porting-to-a-new-harness.md)** — このガイドの集大成。
  あなたは `core/` のすべてのデータサーフェスを形作った; 最後のステップは、その core を*新しい*
  CLI に描画することである: 1 つの `harness/<name>/` ディレクトリ、manifest の行、hook アダプタ、
  そして byte-parity gate。
- あなたが形作るデータサーフェスの完全なマップは
  [Harness Engineer ガイドの overview](00-overview.md) へ戻る。
- コードレベルの swarm、engine、Bolt-DAG の契約は
  [開発者リファレンス § Skill System](../reference/17-skill-system.md) — Construction を形作る
  ことがデータ編集であることをやめ、コードの変更になる線。
