# Harness Engineer ガイド

> [AI-DLC ドキュメント](../README.md) の一部 · [ユーザーガイド](../guide/00-introduction.md) · **Harness Engineer ガイド** · [開発者リファレンス](../reference/00-overview.md)

AI-DLC は方法論であり、この実装はそれを、あなたが使う harness — Claude Code、Kiro CLI、
Kiro IDE、Codex CLI、opencode — の上で箱から出してすぐ動く形で同梱する: 14 のエージェント
（11 のドメインエキスパート、2 の reviewer、composer）、32 の stage、9 の scope、
rule と sensor の一式。このガイドは、その方法論を**再形成**したい人のためのものである —
どの stage が走るかを変える、フレームワークが扱わないドメインのエージェントを足す、scope を
締める、フレームワークに恒常的な rule を教える、決定論的チェックを stage に束ねる。

そのすべてを、**コードを書かずに**行う。

---

## 3 種の読者、3 つのガイド

AI-DLC のドキュメントは、トピックではなく「あなたが何をしようとしているか」で分かれている:

| ガイド | あなたは… | あなたが変えるもの… |
|-------|----------|-------------|
| [ユーザーガイド](../guide/00-introduction.md) | AI-DLC *で*ソフトウェアを作る | `.claude/` の中は何も変えない — `/aidlc` を走らせ、gate で答え、成果物をレビューする |
| **Harness Engineer ガイド**（これ） | AI-DLC がチームのためにどう振る舞うかを形作る | フレームワークが読む**データ**: stage、agent、scope、rule、sensor、knowledge |
| [開発者リファレンス](../reference/00-overview.md) | AI-DLC *そのもの*を変える | そのデータを読む**コード**: orchestrator、hook、CLI ツール、compile パイプライン、テストスイート |

このガイドと開発者リファレンスの境界は**データ対コード**である。
harness engineer が触れるものはすべて、YAML frontmatter 付きの Markdown ファイルか
JSON 設定 — フレームワークがランタイムに読み込む宣言的なデータである。stage の追加、
agent の追加、scope の定義: フレームワーク自身の設計原則は、これらが *TypeScript 編集を
要しない*ことである。変更が `.ts`（orchestrator、hook、ツール）の編集を意味した瞬間、
あなたは開発者リファレンスの側に踏み込んでいる。

---

## メンタルモデル: stage は *what*、agent は *who*

2 つのプリミティブがフレームワークの大半を担い、これらを取り違えないことが仕事のすべてである:

- **stage** は仕事の単位 — *何が*起きるか。消費・生産する成果物、それを率いる agent、
  どう実行するかを宣言する。stage はワークフローグラフのノードである。
- **agent** はペルソナ — *誰が*仕事をするか。ドメインの専門性、ツールの許可リスト、モデルを
  運ぶ。agent は stage の*中へ*ロードされる。

stage は率いる agent を名指すが、agent は自分の stage を決して名指さない。この非対称性は
意図的である: 仕事を再割り当て（stage を編集）しても働き手を書き直さずに済み、働き手を追加
（agent ファイルを置く）しても、ある stage がそれを使うと選ぶまでワークフローを乱さない。

これらの stage を通して仕事を動かす機構は 2 つあり、harness engineer としてあなたは両者が
読む**データ**を形作る。決定論的な**エンジン**
（`core/tools/aidlc-orchestrate.ts`。サブコマンドは厳密に 4 つ: `next`、
`continue`、`report`、`park`。`continue` は内部の steering 用トランスポート）は
`aidlc-state.md` とコンパイル済みの `stage-graph.json` を読み、
次に何が走るかを決め、型付きのディレクティブを 1 つ発する。**conductor**
（`skills/aidlc/SKILL.md`）は各ディレクティブを運び出す薄い forwarding ループである。
ルーティングはエンジンにある。あなたの stage ファイル、scope、rule はそれを操舵する入力である。

harness engineer が設定するその他すべては、この 2 つにぶら下がる:

- **Scope** は、ある種の仕事に対して*どの* stage が走るかを決める（bugfix は 32 のうち
  7 stage を走らせる。enterprise feature は全部を走らせる）。
- **Rule** は、すべてのワークフローに旅する恒常的な決定である — チームの「いつもこうやる」。
- **Sensor** は stage に束ねられた決定論的チェックである — ファイル書き込みのたびに発火する
  助言的なセカンドオピニオン。
- **Knowledge** は、agent が仕事の前にロードするドメインのコンテキストである。

---

## コード無しで変えられるもの

これらはすべて `core/`（手で著述する、harness 中立のソース）で著述し、続けて
harness 別のツリーを再生成する（後述の [ビルドモデル](#the-build-model-author-in-core-regenerate-the-harnesses) を参照）。

| 変更 | どこで著述するか | 章 |
|--------|-------|---------|
| stage の振る舞いを編集 | `core/aidlc-common/stages/<phase>/<slug>.md` | [Stage の解剖](01-anatomy-of-a-stage.md) |
| 新しい stage を追加 | 正しい phase ディレクトリの新ファイル + グラフ配線 | [Stage を足す](02-adding-a-stage.md) |
| agent を追加または変更 | `core/agents/<name>-agent.md` | [Agent を足す](03-adding-an-agent.md) |
| scope を定義 | `core/scopes/aidlc-<name>.md` + stage 別の `scopes:` タグ | [Scope](04-scopes.md) |
| 恒常的な rule を教える | `core/memory/{team,project}.md` | [Rule と学習ループ](05-rules-and-the-loop.md) |
| 決定論的チェックを配線 | `core/sensors/` 下の sensor manifest + stage の `sensors:` import | [Sensor](06-sensors.md) |
| チームのドメイン knowledge を追加 | `aidlc/knowledge/<agent>-agent/`（space レベルの knowledge dir、ランタイム） | [チーム Knowledge](07-team-knowledge.md) |
| Construction と swarm の姿勢を形作る | `core/memory/` + `units-generation` stage | [Construction と swarm](08-construction-and-swarm.md) |

各章は*どうやるか*を語り、網羅的なスキーマは
[開発者リファレンス](../reference/00-overview.md) へリンクで降りる —
リファレンスは規範的な契約、このガイドは実務の語りである。

1 行は例外である: **チームのドメイン knowledge** は、あなたが自分のプロジェクトの
space レベル（`aidlc/knowledge/`。space の `memory/`・`codekb/`・`intents/` の兄弟）に、
ランタイムに足すコンテキストである — `core/` の一部ではなく、フレームワークが決して上書き
しない。上記のそれ以外はすべて、あなたが `core/` で著述するフレームワークのソースである。

## 命名規則とそれがどこで強制されるか

stage のファイル名の語幹は frontmatter の `slug` と等しくなければならない。`aidlc-graph compile`
は語幹の不一致と重複した stage slug をハードエラーとして拒否する。sensor のファイル名／id の
チェックはコンパイル時のハードエラーである。scope と agent の宣言名の重複はローダーエラーで、
両方のファイルを名指す。scope／agent のファイル名と name のドリフトは
`/aidlc --doctor` が助言として報告するので、著述者はファイルをリネームするか `name` を直せる。

---

## ビルドモデル: `core/` で著述し、harness を再生成する

harness engineer が著述するものはすべて **`core/`** に住む — 手で著述する、harness 中立の
ソースオブトゥルース（stage は `core/aidlc-common/stages/`、agent は `core/agents/`、
scope、rule、sensor、knowledge、ツール、hook）。あなたが実際に走らせる harness 別の
`dist/<harness>/` ツリー（`dist/claude/.claude/`、`dist/kiro/.kiro/`、`dist/kiro-ide/.kiro/`、
`dist/codex/`、`dist/opencode/`）は `core/` に薄い `harness/<name>/` サーフェスを加えて
**生成**され、**ドリフトガード**される — そこでの手編集は CI が拒否する。ループは常に:

```bash
# 1. edit the source in core/ (never dist/)
$EDITOR core/aidlc-common/stages/inception/my-stage.md

# 2. regenerate every harness tree from core/ + harness/
bun scripts/package.ts

# 3. confirm no drift (the CI guard; run before committing)
bun scripts/package.ts --check
```

`core/` の編集と再生成した `dist/` を一緒にコミットする。以下の章のレシピが
`bun .claude/tools/aidlc-graph.ts compile`（や別のツール）を走らせよと言うとき、その
コマンドは*インストール済み*のツリー — あなたのプロジェクトの `.claude/`（または `.kiro/` /
`.codex/`）— に対して走り、ランタイムにグラフを再コンパイルする。そこは著述の場所ではない。
**あなたは `core/` で著述し、ツールは harness ディレクトリで走る。** その分割 — 著述された
ソース対生成されたランタイム — が、このガイドを通して取り違えないでほしい 1 点である。完全な
ビルド契約は [新しい harness への移植](09-porting-to-a-new-harness.md) と、開発者リファレンスの
[アーキテクチャ § ソース対ディストリビューション](../reference/01-architecture.md#source-vs-distribution-one-core-many-harnesses) を参照。

---

## いつ開発者リファレンスに踏み込むか

変更がフレームワークのデータではなくコードに対するものなら、
[開発者リファレンス](../reference/00-overview.md) に手を伸ばす:

- orchestrator のルーティングや状態機械
  （[Orchestrator](../reference/03-orchestrator.md)、
  [状態機械](../reference/12-state-machine.md)） — 規範的な
  engine/conductor/directive/runner/scope-shape/swarm の契約は
  [スキルシステム](../reference/17-skill-system.md) を参照
- hook または CLI ツール（[Hook とツール](../reference/06-hooks-and-tools.md)）
- stage-graph の compile パイプライン、または audit イベントの分類
- テストスイート（[テスト](../reference/09-testing.md)）

stage や agent の追加はワークフローグラフに*触れる*が、それを読むコードは変えない — だから
ここに住む。グラフがどうコンパイルされるかを変える、または新しい audit イベントを足すのは
コードの変更 — それはあちらに住む。

---

## このガイドの構成

初回は順に読むこと:

1. **[Stage の解剖](01-anatomy-of-a-stage.md)** — stage ファイルの形式:
   frontmatter の契約、3 区画の本体、グラフがどうコンパイルされるか。
   何かを変える前に理解すべき最も重要な 1 つ。
2. **[Stage を足す](02-adding-a-stage.md)** — end-to-end: ファイルを著述し、
   依存エッジを配線し、コンパイルし、scope に現れるのを見る。
3. **[Agent を足す](03-adding-an-agent.md)** — ペルソナを著述し、それが率いる／支える
   stage に束ねる。
4. **[Scope](04-scopes.md)** — scope と stage のマッピングを定義し調律する。
5. **[Rule と学習ループ](05-rules-and-the-loop.md)** — レイヤーチェーンにまたがって rule を
   著述し、ループが訂正を rule に昇格させるに任せる。
6. **[Sensor](06-sensors.md)** — 決定論的チェックを著述し、stage に束ねる。
7. **[チーム Knowledge](07-team-knowledge.md)** — agent にあなたのドメインの
   コンテキストを与える。
8. **[Construction と swarm](08-construction-and-swarm.md)** — チームの Construction
   自律姿勢を rule レイヤーで設定し、Unit ごとの Bolt swarm が並列に走らせられるものを
   `units-generation` を通して形作る。
9. **[新しい harness への移植](09-porting-to-a-new-harness.md)** — もう 1 つの CLI harness を、
   1 つの `harness/<name>/` ディレクトリと manifest の行で、`core/` 編集なしに足す:
   manifest の契約、hook アダプタ、`emit.ts`。
10. **[プラグインの著述](10-authoring-a-plugin.md)** — 再利用可能な、任意の **AIDLC プラグイン**を
    `plugins/<name>/` にパッケージする: 新しい stage/agent/scope/
    sensor + 既存 core stage への加算的なコントリビューション。harness ごとに本物の
    ホストプラグインとして emit される。設計は開発者リファレンスの単一の章
    （[18 mechanism](../reference/18-plugin-mechanism.md)）にある。

## 次へ

[Stage の解剖](01-anatomy-of-a-stage.md) から始める — 他のすべての変更が乗る形式である。
