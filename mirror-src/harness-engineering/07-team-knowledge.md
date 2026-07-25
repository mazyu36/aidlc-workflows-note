# チーム Knowledge

knowledge は、agent が働く前に読むドメインのコンテキストである: あなたのコーディング標準、
アーキテクチャの好み、ドメインの用語集、チームが定めたパターン。それは、フレームワークが
強制する制約ではなく、agent が読むファイルを足すことであなたが形作る harness の一部分である。
この章は、agent にそのコンテキストを与えるためのワークフローを歩く — ファイルがどこへ行くか、
どの agent がそれらを見るか、そして knowledge と rule のあいだの判断。

[Rule と学習ループ](05-rules-and-the-loop.md) を読んだなら、その区別を通して念頭に置く
こと: rule はフレームワークが強制する恒常的な決定である; knowledge は agent が働きながら量る
参照材料である。両者は agent の振る舞いを形作るが、異なる plane に座り、異なる形でロードされる。

---

## 2 つの層: フレームワークの knowledge とあなたの

AI-DLC の knowledge は 2 つの層に分かれ、そのうち 1 つだけがあなたが編集するものである。

**Tier 1 — methodology knowledge** は、この実装に `.claude/knowledge/` の下で同梱される。
それは各 agent が stage を走らせるのに使う方法論の参照を保持する —
`aidlc-architect-agent/architecture-guide.md`、
`aidlc-developer-agent/code-generation-guide.md`、そして `aidlc-shared/` の agent 横断の
材料。**触れないこと。** これらのファイルはフレームワークのアップグレードのたびに上書きされる。
そこに足したものは、チームが次に新しいバージョンを pull するとき消える。

**Tier 2 — team knowledge** はあなたのものである。それは space レベルの
`aidlc/knowledge/`（`aidlc/spaces/<space>/knowledge/` の略記）の下に住み、space の
`memory/`・`codekb/`・`intents/` の兄弟である — なので、1 つの intent の record に閉じ込め
られるのではなく、space 内のすべての intent にまたがって蓄積する。それはあなたの会社固有の
標準、ポリシー、規約を保持する。フレームワークはそれを決して上書きしない; エンジンは最初の
`/aidlc` で空の `aidlc/knowledge/` ディレクトリを作るだけで、中身はあなたに委ねる。これが
あなたが populate するディレクトリである。（フレームワークが*強制*すべき恒常的なプラクティス
— agent が量る参照材料ではなく — は、代わりに `aidlc/spaces/<active-space>/memory/` の
space の memory レイヤーに住む。）

2 層の分割は、このガイドの残りが乗るのと同じデータ対コードの線を、knowledge に適用したもの
である: フレームワークはその方法論を所有し、あなたはあなたのコンテキストを所有し、アップグレード
は一方に触れず他方を置き換えられる。両層の完全なディレクトリ形状は
[Knowledge System → 2 層アーキテクチャ](../reference/10-knowledge-system.md#two-tier-architecture)
にある。

---

## チーム全体 対 agent 固有の配置

Tier 2 は慣習として agent のレイアウトに従う: `aidlc-shared/` ディレクトリと、agent ごとの
1 ディレクトリ、すべて space レベルの `aidlc/knowledge/` の下。ファイルをどこに落とすかが、
どの agent がそれをロードするかを決める。

| 配置 | ロードする者 | 用途 |
|-----------|-----------|------------|
| `aidlc/knowledge/aidlc-shared/` | **すべての** agent、すべての stage で | 横断的な標準 — 命名規約、commit フォーマット、プロジェクトのドメイン用語集 |
| `aidlc/knowledge/<agent>-agent/` | **その agent のみ**、それがアクティブな lead のときだけ | 1 つの役割のためのドメインコンテキスト — architect のアーキテクチャパターン、devsecops のセキュリティポリシー |

ディレクトリ名は agent の slug と正確に一致せねばならない — `architect/` ではなく
`aidlc-architect-agent/`。ディレクトリ名のタイプミスは、ファイルが静かに無視される最も一般的な
理由である: フレームワークは agent 自身のディレクトリを名前で歩き、何も見つけず、エラー無しに
進む。エンジンはこれらのサブディレクトリをあなたのために作らない — `aidlc/knowledge/` は
ブートストラップ時は空である（下を参照）ので、各ディレクトリを正確な slug で自分で作る。

標準が本当に 11 の agent すべてにまたがって適用されるときだけ `aidlc-shared/` に手を伸ばす。
architect にとって重要で他の誰にとってもそうでないパターンは `aidlc-architect-agent/` に属し、
そこで他のすべての agent のウィンドウを薄めずにアーキテクチャ stage にコンテキストを足す。
ユーザーガイドの [会社標準を足す worked example](../guide/08-knowledge.md) は完全な end-to-end
のウォークスルーを運ぶ — ディレクトリを作り、書き、検証する — 最初のファイルを著述する前に
一度読む価値がある。

各ディレクトリが何のためかの agent ごとのテーブルは、
[Knowledge System → チーム Knowledge を足す](../reference/10-knowledge-system.md#adding-team-knowledge)
を参照。

---

## agent が knowledge をどうロードするか

knowledge ファイルを登録したり、どこかに配線したりはしない。正しいディレクトリでのその存在が
登録である。stage が始まるとき、conductor は固定の 6 ステップ順でコンテキストをロードし、
あなたの Tier 2 ファイルはステップ 4 と 5 で入ってくる:

1. Rule — 解決された `aidlc/spaces/<active-space>/memory/` チェーン（最初にロード）
2. Tier 1 の共有方法論 — `.claude/knowledge/aidlc-shared/`
3. Tier 1 の agent 方法論 — `.claude/knowledge/<agent>-agent/`
4. **Tier 2 の team 共有** — `aidlc/knowledge/aidlc-shared/`
5. **Tier 2 の team agent 固有** — `aidlc/knowledge/<agent>-agent/`
6. 先行 stage の成果物 — 現在の stage が消費すると宣言する出力

ステップ 4 と 5 は、ディレクトリが存在しファイルを含むときにだけ発火する。だから team
knowledge の無いプロジェクトはそれらを単に飛ばす。ロードはすべての stage 開始時に起きるので、
ファイルの編集はクリアすべきキャッシュも再起動も無しに、次の `/aidlc` 実行で効力を持つ。
ファイルの削除も同じく直接的である — 削除すれば、以降の実行はそれを見なくなる。同期を保つべき
レジストリは無い。

内面化する価値のある 1 つの帰結: agent は knowledge ファイルを **文字どおり、等しい重みで**
読む。古いまたは矛盾するファイルは agent を積極的に誤らせる — それは現行のものと同じ権威を運ぶ。
Tier 2 ツリーを剪定を要するコードのように扱う; retro での短いレビューがそれを正直に保つ。

完全なステップごとの契約、優先順位ルール、シーケンス図は
[Knowledge System → 6 ステップ knowledge ロード順](../reference/10-knowledge-system.md#6-step-knowledge-loading-order)
にある。

---

## knowledge か rule か？

最も一般的な harness engineer の誤りは、意図が rule であるときに knowledge に手を伸ばす、
あるいはその逆である。両者は交換可能ではなく、上のロード順がなぜかを示す: rule はフレームワークが
実行に先立ってコンパイルする strict-additive チェーンとして最初に解決する; knowledge は agent が
stage 中に量る参照材料である。

有用なテスト: **指示が違反されたときに人間の reviewer が stage の出力を却下するなら、それは
rule に属す。** レビュー時に背景として使うものなら、それは knowledge である。

| knowledge に手を伸ばすのは… | rule に手を伸ばすのは… |
|---------------------------|------------------------|
| agent が参照すべき参照材料を供給しているとき | agent が従わねばならない振る舞いの決定を述べているとき |
| 「これらが我々の使うパターンである」 | 「X を決してするな」/「常に Y をせよ」 |
| 内容が情報的で文脈的 | 内容が規範的で交渉の余地が無い |
| 長文の散文、テーブル、図でありうる | 短く、命令形で、各々 1 行であるべき |
| 例: API Gateway 標準、ドメイン用語集 | 例: 「PII を決してログしない」、「すべてのデータアクセスは repository レイヤーを通る」 |

なので、あなたのチームが API をどう設計するかを記述する文書は knowledge である:
`aidlc/knowledge/aidlc-architect-agent/` に落とす。「すべてのアーキテクチャ決定は少なくとも
2 つの代替案を記録せねばならない」のような交渉の余地の無いものは rule である: それは space
memory レイヤー（`aidlc/spaces/<active-space>/memory/`）に属し、そこでフレームワークが agent を
それに従わせる。レイヤーチェーンにまたがる rule の著述と、学習ループが訂正をそれらへ昇格させる
ことについては、[Rule と学習ループ](05-rules-and-the-loop.md) を参照。ユーザーガイドの
[Knowledge 対 Rule テーブル](../guide/08-knowledge.md) は、同じ判断をより多くの例で扱う。

---

## Tier 2 ツリーはどこから来るか

チームがそれを作る。最初の `/aidlc` でエンジンは 1 つの空のディレクトリ —
`aidlc/knowledge/` — を作り、そこで止まる。ツリーをスキャフォールドせず、agent ごとの
サブディレクトリを作らず、README を種付けもしない。Tier 2 のレイアウト（`aidlc-shared/` と
agent ごとの 1 ディレクトリ）は、エンジンが書く構造ではなく、ペルソナが探す慣習である;
あなたは内容のあるディレクトリを作る。ローダーは各 agent 自身のディレクトリを名前で歩くので、
ローダーが期待する正確な slug でそれらを作る（`architect/` ではなく
`aidlc-architect-agent/`）— タイプミスした名前はエラー無しに静かにスキップされる。

ディレクトリの中に命名規約は無い: 任意の `.md` ファイルがロードされる。記述的な、ファイル
ごとに 1 トピックの名前（`architecture.md` ではなく `api-gateway-standards.md`）はローダーに
要求されないが、四半期ごとの剪定をはるかに容易にする。ディレクトリの出発点となる README が
欲しければ、Tier 1 は手でコピーして入れられる任意のテンプレートを同梱する —
[Knowledge System → テンプレートシステム](../reference/10-knowledge-system.md#template-system)。

このガイドの残りとの境界についての注記: ここであなたが populate する agent ディレクトリは、
agent がそのペルソナファイルで宣言するものと同じである。[agent を足す](03-adding-an-agent.md)
とき、その Tier 2 knowledge ディレクトリは `aidlc/knowledge/<new-agent-slug>/` である — チーム
が作り、同じステップ 4 と 5 でロードされるディレクトリ。[overview](00-overview.md) のメンタル
モデルが成り立つ: stage が agent を名指し、agent が knowledge を読み、あなたはコードを書くのでは
なくデータを編集することでそのすべてを形作る。

---

## Space: 複数チームのための knowledge

上のすべては 1 つのチームを前提とする。**複数のチームが 1 つのプロジェクトを共有する**とき、
AI-DLC は各チームの method、knowledge、record を、それ自身の **space** — 同一形状の
`aidlc/spaces/<name>/`（`memory/`、`knowledge/`、`codekb/`、`intents/`）— に保つ。この章を通して
あなたが使ってきた `aidlc/knowledge/` の略記は、実は `aidlc/spaces/<active-space>/knowledge/`
である; 単一チームでは、そのアクティブな space は常に `default` であり、区別は決して表面化しない。
（[ユーザーガイドの Space・Intent の章](../guide/03-spaces-and-intents.md) はエンドユーザー向けの
オリエンテーションである; この節は harness-engineering の角度である。）

これがあなたの著述する knowledge と rule に意味すること:

- **team knowledge は space ごとである。** あなたが populate する
  `aidlc/knowledge/aidlc-<agent>-agent/` ファイルは 1 つの space の中に住む。2 つ目のチームは
  埋めるべき自分の空の `knowledge/` ツリーを得る — あなたのファイルは境界を越えて漏れず、
  彼らのものはあなたの agent のコンテキストを薄めない。
- **method レイヤーも space ごとである。** `aidlc/spaces/<active-space>/memory/` の rule
  （`org.md` → `team.md` → `project.md`）はアクティブな space の中で解決する。新しい space は
  フレームワークのベースラインから種付けされる — `org.md` がコピーされ、まっさらな空の
  `team.md` / `project.md` — なので新しいチームはフレームワークの既定から始まり、別のチームの
  ものを継承するのではなく自分のプラクティスを獲得する。
- **space を `core/` で著述しない。** space はランタイムのチームデータであり、インストール済み
  のプロジェクトで `/aidlc space create <name>` で作られる — team knowledge をフレームワーク
  ソースから分けるのと同じデータ対コードの線。複数チームをサポートするために `core/` に足したり
  再生成したりするものは無い; その能力はエンジンに同梱される。

この章のメンタルモデルは各 space の中で変わらず成り立つ: stage が agent を名指し、agent が
knowledge を読み、あなたはデータを編集することでそのすべてを形作る。space は単に*誰の*データ
かをスコープする — なので 2 つのチームが、コンテキスト・プラクティス・record を衝突させずに、
1 つのプロジェクトで AI-DLC を走らせられる。

## 次へ

- コード無しで変えられるものの完全なマップは
  [Harness Engineer ガイドの overview](00-overview.md) へ戻る。
- コードレベルの変更 — orchestrator、hook、このデータを読む compile パイプライン — は
  [開発者リファレンス](../reference/00-overview.md) へ。
