# Rule と学習ループ

rule は、チームがすべてのワークフローに持ち込む恒常的な決定である — さもなくば各実行の
開始時に説明し直すことになる「いつもこうやる」。harness engineer として、あなたはそれを
2 通りで著述する: rule ファイルを直接編集するか、**学習ループ**にワークフロー内の訂正を
永続的な rule へ昇格させてもらうか。この章は、ユーザーガイドの
[Rule と学習ループ](../guide/09-rules-and-the-learning-loop.md) の章の著述側の伴走である —
その章はループを概念的に扱い、ANZ 銀行の例を end to end で歩く。ここでの焦点は運用である:
何のためにどのファイルを編集するか、rule を積み重ねるとき strict-additive モデルがどう
振る舞うか、そして一度きりの修正が恒常的な rule になるようループをどう走らせるか。

rule は制御ループのフィードフォワードの半分である — agent が働く*前に*読む散文。
[Sensor](06-sensors.md) はフィードバックの半分である — 書き込みの*後に*発火する決定論的な
チェック。rule は sensor を伴走者として名指せる; 2 つの半分はペアになるよう設計されている。

---

## 5 つのレイヤーと、どのファイルを編集するか

rule は `core/memory/` の下に Markdown ファイルとして住む（space memory レイヤーの著述された
ソース）。scope ごとに 1 ファイル。`scope:` frontmatter フィールドは無い — この実装は
ファイル名から scope を導くので、あなたが選ぶファイルこそが、あなたが著述する scope*である*:

| こういう rule が欲しい… | 編集 | Scope |
|---|---|---|
| 組織のすべてのプロジェクト | `org.md` | org（フレームワーク既定） |
| チームが走らせるすべてのプロジェクト | `team.md` | team |
| この 1 つのプロジェクト | `project.md` | project |
| 1 つの phase のすべての stage | `phases/<phase>.md` | phase |

4 つの phase ファイルは `phases/ideation.md`、`phases/inception.md`、
`phases/construction.md`、`phases/operation.md` である（initialization は
ブートストラップ専用で、rule ファイルを同梱しない）。5 つ目のレイヤー — stage ごとの rule
（`aidlc-stage-<slug>.md`）— は将来のリリースに予約されている; まだ著述できない。

どのファイルに手を伸ばすかを、2 つの判断が駆動する:

- **`org.md` はフレームワーク同梱である。** それはすべてのプロジェクトが継承する既定を運ぶ
  — trunk-based development、walking-skeleton ポリシー、scope ごとのテスト姿勢。upstream と
  して扱う。ほとんどの harness engineer はそれに触れず、team か project で著述する。
- **project scope は恒常的な逸脱のためであり、何にでもではない。** *この*プロジェクトが
  チーム全体のプラクティスから安定して逸れるとき — チームが squash するところで rebase する
  monorepo、テストの下限を飛ばすレガシープロジェクト — にだけ `project.md` に手を伸ばす。
  その rule がチームの走らせるすべてのプロジェクトを助けるなら、それは `team.md` に属す。

各ファイルはトピック別の見出しの下の素の散文である — `## Way of Working`、
`## Testing Posture`、`## Deployment`、`## Code Style`、など。rule を足すには、それが
属す見出しの下に箇条書きを足す。完全なファイル名-scope テーブルと resolver の仕組みが
規範的な契約である:
[Rule System § ファイル名由来の scope](../reference/08-rule-system.md#filename-derived-scope)
と [§ レイアウト](../reference/08-rule-system.md#layout)。

---

## strict-additive: レイヤーは積み重なり、どれも静かに上書きしない

チェーンはすべてのワークフローの開始時に 5 つのレイヤーを通して解決する:

```
org → team → project → phase → stage
```

モデルは **strict-additive** である。適用可能なすべての rule が一度に agent のコンテキストに
現れる — 実行時に落とされたり抑制されたりするものは無い。org の既定、team のプラクティス、
project の特化が連結する; 合致する phase rule が付くのは、stage が既にその `phase:` を
frontmatter で宣言しているからである（stage が他のすべてをインポートするのに使うのと同じ
pull 著述の方向）。解決したチェーンはワークフロー開始時に一度だけ各 stage ノードに焼き込まれる
— ランタイムはそれを再び歩かない。
[Rule System § strict-additive ランタイムモデル](../reference/08-rule-system.md#strict-additive-runtime-model)
と [§ 5 層の継承](../reference/08-rule-system.md#five-layer-inheritance) を参照。

これが著述者としてのあなたに意味すること: 設定すべき `overrides:` ブロックも
`enforcement:` キーワードも無い。より狭いレイヤーがより広いものに静かに勝つことはない。
代わりに、あなたが書くすべてのレイヤーが同時に agent の視界にある。それは著述の仕方を変える
— rule はそれが適用されるべき scope で肯定的に述べ、上のレイヤーを抑制するスイッチに手を
伸ばすのではなく、それらと積み重なることを信頼する。

### 衝突は書くときに拒否され、実行時に解決されるのではない

実行時に何も上書きしないので、より広い scope の rule に*矛盾する* rule は、resolver が
解きほぐせない問題になってしまう。フレームワークはそれを、実行時ではなく**書き込み時**に
チェックすることで未然に防ぐ。team scope の rule がある `## Heading` の下に足されようと
しているとき、admission gate が提案されたテキストを `org.md` の同じ見出しと比較する; 矛盾を
見つけると、gate は書き込みを止めて 3 つの選択肢を提示する — **revise**、**skip**、または
org-rule のオーナーへの **escalate**。project 層の書き込みは org に対してのみチェックする。
team 対 project の差異は正当な project の特化であり、ポリシー違反ではないからである。

このチェックは、フレームワークが所有する 2 つの admission gate — practices-discovery の
affirmation gate と learning gate（後述）— で走るので、rule が resolver に到達する頃には、
既に conflict-check を通過している。2 つの読み取り専用の `/aidlc --doctor` 行が事後に状態を
提示する: **rule-drift** 行は、team または project の内容が populated な org の見出しに
重なる見出しを（人間が検証すべき候補の矛盾として）フラグし、**paired-coverage** 行は、実際に
解決する sensor を名指す rule がいくつあるかを報告する。両者は助言であり、exit code を決して
変えない。[Rule System § rule-drift 検出](../reference/08-rule-system.md#rule-drift-detection) を参照。

---

## 学習ループを運用する

rule が著述されるもう 1 つの道は、あなたがファイルを決して開かないことである — ワークフロー
中に agent を訂正し、gate でその訂正を確認すると、フレームワークがあなたのために書く。それが
学習ループである。ほとんどの stage 実行は何も足さず、それは健全である; ループは stage 中の
何かが保つに値するときだけ発火する。

仕組みは [ユーザーガイドの章](../guide/09-rules-and-the-learning-loop.md) で扱う。
harness engineer の視点は、ループが何を生み、それがどこに着地するかである:

1. **日記が stage 中に記録する。** conductor（アクティブな stage を走らせるライブの
   `/aidlc` セッション）は `<record>/<phase>/<stage>/memory.md`（intent の record dir
   `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` の下）に観察ログを保つ。エントリは
   4 つの見出しの下に置かれる — Interpretations、Deviations、Tradeoffs、Open questions。
   それは自動作成され、あなたのために保守される; 決して手編集しない。日記を書くことは、この
   ループで言語モデルが持つ*唯一の*仕事である — stage の後のすべて（数える、提示する、経路
   づける、書く）は決定論的なツールか、gate でのあなたの明示的な選択である。
2. **gate が候補を提示する。** 承認 gate の前に、learning gate が `memory.md` を読み、
   空でない各日記行を逐語の候補として示す。加えて自由記述の「次回のために足すことは？」
   チャネルがあり、そこで観察をタイプし、それが 4 つの見出しのどれに属すかを選ぶ。
3. **何を保つかをあなたが確認し、それが書かれる。** 確認された learning は日付付きの
   エントリとして着地する — あなたはファイルパスを決して選ばない; 見出しが行き先を決める。

### 保たれた learning がどこに着地するか

確認された learning は practice *である*: それは practices-discovery が affirm するのと
同じ space memory ファイル（`aidlc/spaces/<active-space>/memory/team.md` /
`memory/project.md`）に着地する — 別個の `*-learnings.md` サーフェスは無い。gate はそれを
トピック別の見出しで経路づける:

| gate での見出し | 着地先 | Audit イベント |
|---|---|---|
| Interpretation / Deviation / Tradeoff | `aidlc/spaces/<active-space>/memory/project.md`（既定） | `RULE_LEARNED` |
| 同上、ワンクリックで昇格 | `aidlc/spaces/<active-space>/memory/team.md` | `RULE_LEARNED` |
| Open question | 何も無し — research 項目は昇格しない | — |

既定の scope は最も狭い **project** である。ワンクリックの「team に昇格」アフォーダンスが、
教訓がこのプロジェクトを越えて適用されるとき learning を `memory/team.md` へ広げる。org に
広げる道は無い — org のプラクティスはフレームワーク同梱か、別プロセスで組織が著述するので、
ループは org scope で決して書かない。既定を狭く保つことは、1 つのプロジェクトの驚きが偶然に
組織全体の rule になるのを止める。学習ループと practices-discovery は、これらの同じファイルに
2 つの異なるライフサイクルで書く: ループは日付付きエントリを一度に 1 つ追記し、
practices-discovery はセクション全体を affirm する。resolver はファイルを清潔な整数チェーン
org → team → project → phase でソートする。

### learning が rule ではなくチェックのとき（`SENSOR_PROPOSED`）

保つに値するものが*繰り返される手作業のチェック*であることがある — あなたは同じギャップを
求めて stage の出力を見続ける。その種の learning を gate で確認すると、フレームワークはそれを
rule ではなく sensor の束縛として扱う。それは 2 つの書き込みをアトミックにインストールする:
`.claude/sensors/` の下に sensor manifest をスキャフォールドし、新しい sensor の id を発生元の
stage の `sensors:` インポートリストに追記し、`SENSOR_PROPOSED` audit 行を残す。それが、
フレームワークのリリース外で stage ファイルへの認可された唯一の編集である — インポートリスト
だけが伸びる; stage 本体は決して触れられない。そこから、[Sensor](06-sensors.md) を使って
manifest を手で肉付けする — ループは束縛をスキャフォールドする; あなたはチェックを著述する。

### learning は進行中のものではなく、次のワークフローで適用される

gate で捕らえた learning は、現在の実行の残りの rule を **変えない**。あなたはこの
ワークフローについて既に会話で agent を訂正した; rule は次回のためである。新しい行はディスク上
にあるが、進行中のワークフローは開始時のコンパイル済みビューを保つ。あなたが走らせる*次の*
`/aidlc` が再コンパイルし、ディレクトリの走査が新しいファイルを拾い、rule は stage 1 以降から
適用される。

これは手で著述するときにも重要である: ワークフローの途中で `team.md` を編集しても、進行中の
実行を遡って変えはしない。rule は次の compile 境界で効力を持つ。変更を即座に効かせる必要が
あるなら、compile があなたの編集を再び読むように、ワークフローを終えるか再開する。

---

## 次へ

[Sensor](06-sensors.md) — 決定論的なチェックを著述し、それを走らせるべき stage に束ねる。
ループが `SENSOR_PROPOSED` learning を確認したときにスキャフォールドする manifest も含む。
