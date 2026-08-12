# Scope

scope は、ある種の仕事に対してフレームワークの 32 stage の*どれ*が走り、どれが座るかを決めるダイヤルである。bugfix に market research やデプロイパイプラインは要らない。規制下の enterprise feature にはそのすべてが要る。毎回ユーザーに stage を手で選ばせるのではなく、AI-DLC は名前付きの 9 scope を同梱する — それぞれが全 stage 集合に対する EXECUTE/SKIP の判定を厳選したもので、depth、テスト戦略、任意の review 上限のようなワークフロー既定とペアになっている。scope を選べば、残りはカスケードする。

harness engineer にとって、scope は純粋なデータであり、他のすべてのプリミティブと同じ方法 — ファイルとして — で著述される。2 つの半分から成る: 1 つの `core/scopes/aidlc-<name>.md` ファイル（その同一性、ルーティングメタデータ、ワークフロー既定）に、stage 別のメンバーシップタグ（各 stage の frontmatter の `scopes:` リストが、それが走る scope を名指す）を加えたもの。scope の追加や調律に TypeScript は要らない。この章はワークフローを歩く: scope が何でできているか、チーム scope をどう足すか、既存のものをどう調律するか、ツールが何を確認し何をあなたに委ねるか。

ユースケースとユーザーが読むルーティング表を含む 9 scope の完全なカタログは、ユーザーガイドの [Scope・Depth・テスト戦略](../guide/05-scopes-and-depth.md) を参照。この章は同じデータの著述側である。

---

## scope が何でできているか

scope は 2 箇所で著述され、その分割こそがアイデアのすべてである: scope の*同一性*は自分のファイルに住み、その*メンバーシップ*（どの stage がその下で走るか）は stage の上に転置されて住む。

**1. scope ファイル — `core/scopes/aidlc-<name>.md`。** scope ごとに 1 ファイルで、`core/sensors/` を映す。`feature` scope の frontmatter はこう見える:

```yaml
---
name: feature
depth: Standard
keywords: []
description: Default for new features, practical depth
skeleton: on
---

# feature scope

Prose intent: why these stages, why skip those.
```

scope の frontmatter フィールドは次のとおりである:

| フィールド | 必須 | 何をするか |
|-------|----------|--------------|
| `name` | Yes | scope 名。core ファイルは `aidlc-<name>.md` を使う。plugin scope ファイルは `name` と等しい語幹を使う。 |
| `depth` | Yes | 既定の詳細レベル — `Minimal`、`Standard`、`Comprehensive`。 |
| `testStrategy` | No | depth と独立にテスト量を上書きする。既定は `depth` に一致。 |
| `review_cap` | No | この scope の下での最大 review クラス: `adversarial`、`advisory`、`none`。不在は scope レベルの格下げが無いことを意味する。cap は stage の `review_class` を格下げできるが決して格上げしない; 自律的な swarm review は stage の宣言されたクラスを保つ。 |
| `keywords` | No | `/aidlc <freeform text>` の自動検出のための自然言語トリガ。空リストはオプトアウト。 |
| `description` | No | `/aidlc --help` に描画される 1 行。（SKILL.md のコンパイル済み scope テーブルは Scope / Depth / TestStrategy / EXECUTE / Total のみを表示し、description は省く。） |
| `skeleton` | No | practice が scope 依存のとき、`on` は scope を walking-skeleton の儀式にオプトインさせる。`off` または不在はオプトアウト。 |
| `runner` | No | `true` は scope を既定生成される scope-runner 集合に含める。 |
| `freeform_default` | No | `true` は、望ましい core の既定（`feature` や `poc`）が plugin 選択後に有効でないときの、selection-aware なフォールバックとしてこの scope を指名する。 |

ローダーはファイル間で重複した scope の `name` 値を拒否し、エラーで両方の
ファイルを名指す。

### Freeform default

`freeform_default: true` は、`feature` や `poc` のような内部既定が plugin 選択後に
使えないときに使われる scope を、インストールに指名させる。この指名は
sole-enabled-plugin フォールバックより前にチェックされるので、複数の scope を持つ
plugin は、アルファベット順で先頭の scope を受け入れる代わりに、自分の軽量な既定を
選べる。

**有効な** scope のうち `freeform_default: true` を宣言できるのは最大 1 つである。
選択された core / plugin 集合に 2 つ以上含まれると、グラフのコンパイルは失敗し、
すべての claimant を名指す。無効な plugin 上の claim は、それらの plugin が一緒に
有効化されるまで衝突しない。このフィールドは明示的なタイプミスを修復しない: 未知の
`AWS_AIDLC_DEFAULT_SCOPE` 値は依然として検証に失敗する。

### walking-skeleton の既定

任意の `skeleton:` フィールドは、scope 依存の walking-skeleton の
スタンスを制御する。`skeleton: on` は、チームの `## Walking Skeleton`
practice が `scope-dependent` に解決するとき、Construction がこの scope の
walking-skeleton の儀式で開くことを意味する。`skeleton: off` は最初の Bolt が
通常の Bolt として走ることを意味する。不在は off を既定にするので、compose された／
ランタイム承認された scope や plugin scope は、明示的にオプトインしない限り skeleton Bolt を
呼び出さない。

**2. メンバーシップタグ — 各 stage の `scopes:` frontmatter。** stage は、自身の frontmatter（`core/aidlc-common/stages/<phase>/<slug>.md`）で、それが走る scope を名指す:

```yaml
scopes:
  - enterprise
  - feature
  - mvp
```

scope を名指す stage はその下で `EXECUTE`、不在は `SKIP`。ビルドステップ `bun .claude/tools/aidlc-graph.ts compile` は、すべての stage の `scopes:` リストを `.claude/tools/data/scope-grid.json` のコンパイル済み EXECUTE/SKIP グリッドに*転置*する — 純粋な転置で、`stage-graph.json` と全く同じに `compile --check` でドリフトガードされる。グリッドがランタイムが読むものであり、それを手編集することは決してない。3 つの初期化 stage はすべての scope を名指す（常に走る）。

理解する価値のある唯一の判断は、`depth` と `testStrategy` の関係である。depth は各 stage の成果物がどれだけ詳細を運ぶかを制御する。テスト戦略はいくつのテストが生成されるかを制御する。両者は意図的に独立である。ほとんどの scope は `testStrategy` を off にするので、`depth` から継承する — Standard depth の scope は Standard 量でテストする。`workshop` scope はタイを破る同梱の例である: `"depth": "Standard"`（参加者が学んでいるのでフル成果物）を走らせつつ `"testStrategy": "Minimal"`（セッションを動かし続けるため速い Nyquist テスト）にする。あなたの scope がその分割を望むなら、両方を宣言する。各レベルの意味は、ユーザーガイドの [3 つの Depth レベル](../guide/05-scopes-and-depth.md#the-3-depth-levels) と [3 つのテスト戦略レベル](../guide/05-scopes-and-depth.md#the-3-test-strategy-levels) を参照。

`keywords` がどう単語境界でマッチされるか、そしてアルファベット順の scope タイブレークが曖昧な freeform 呼び出しをどう解決するかを含む、フィールドごとの網羅的な契約は、開発者リファレンスの [Contributing § Scope を足す](../reference/11-contributing.md#adding-a-scope) に住む。この章は決定を要約する。その節が規範的なスペックである。

---

## scope と stage の関係

scope と stage は反対の端から互いを指し、両方向を視界に保つと助けになる。

**stage** は自身の同一性を宣言する — その phase、率いる agent、消費・生産する成果物、そして今やそれが走る scope（その `scopes:` リスト）。**scope** は自身の `.md` ファイルで同一性、ルーティングメタデータ、ワークフロー既定を宣言する。その中に stage 別のメンバーシップは無い。メンバーシップは stage に住む。両者の束縛は scope 名である。新しい stage を足すとき（[Stage を足す](02-adding-a-stage.md) を参照）、scope メンバーシップを*その stage の上に*置く — その `scopes:` リストが、それを走らせるべきすべての scope を名指す。scope を名指さない stage はどこでも `SKIP` である。コンパイル時の転置がその stage 別リストをグリッドに変えるので、メンバーシップは 9 個の別々の scope ブロックで再宣言されるのではなく、stage の上で一度だけ著述される。

その分離は、このガイドの残りが乗るのと同じデータ対コードの線である（[Harness Engineer ガイド](00-overview.md) を参照）。scope ファイルは*同一性*についてのデータである。stage の `scopes:` リストは*メンバーシップ*についてのデータである。コンパイル済みグリッドは両者の転置である。

---

## チーム scope を足す

あなたのチームが `hotfix` scope を望むとしよう — `bugfix` より軽く、回帰テストとデプロイだけが欲しい緊急の本番パッチ用。変更は、新しい scope ファイル、走るべき各 stage の `scopes:` タグ、そして再コンパイルである。以下の規律を映す。検証ステップと完全なコマンドラインは [Contributing § Scope を足す](../reference/11-contributing.md#adding-a-scope) にある。

### Steps

1. **`core/scopes/aidlc-hotfix.md` を置く。** `aidlc-bugfix.md`（最も近い既存 scope）をコピーし、frontmatter を編集する: `name: hotfix` を設定、`depth` を選び、freeform 自動検出が欲しければ `keywords`（`[hotfix, urgent]`）、ヘルプ用の `description`、scope 依存の Construction 儀式の既定用に `skeleton: on|off`、これが選択されたインストールの唯一のフォールバック指名である場合のみ `freeform_default: true`、`depth` から分岐すべき場合のみ `testStrategy`、そして scope が stage の review を格下げすべき場合のみ `review_cap` を足す。意図を説明する短い散文の本体を書く。

2. **`hotfix` の下で走るべき stage にタグする。** `EXECUTE` にしたい各 stage（`core/aidlc-common/stages/<phase>/` 下）で、その frontmatter の `scopes:` リストに `hotfix` を足す。タグしない stage はその scope で `SKIP` である。3 つの初期化 stage はそれを含めねばならない（常に走る）。

3. **再コンパイル。** `bun .claude/tools/aidlc-graph.ts compile` を走らせてタグを `scope-grid.json` に転置し、続けて `bun .claude/tools/aidlc-utility.ts scope-table` から SKILL.md のコンパイル済み scope テーブルをリフレッシュする。`bun .claude/tools/aidlc-graph.ts compile --check` と `bun .claude/tools/aidlc-utility.ts scope-table --check` を走らせてドリフトが無いこと（exit 0）を確認する。

4. **scope が解決し受理されることを検証する。** `/aidlc --doctor` を走らせる。次に、新しい scope での init が正しい `Scope:` 行を持つ状態ファイルを生むこと、そしてそれが env 既定として、また mid-workflow の `--scope` 変更として受理されることを確認する。

5. **キーワード推論を検証する**（`keywords` を populated した場合のみ）。あなたのトリガの 1 つを含む freeform フレーズが、`feature` に落ちるのではなく新しい scope を検出することを確認する。

6. **scope を意識した docs を更新し、ルーティングテストを足す。** いくつかの docs は scope を手で列挙する — ユーザーガイドの scope リファレンスとルーティング表、customization 章の valid-values リスト、orchestrator リファレンスの scope-to-stage マッピング。同じ変更でそれらを更新する。あなたの scope が既存のどの scope も使わないパターンで stage を飛ばすなら、既存の scope 別テストをモデルにしたワークフローテストを足す。

7. **（任意）タイプ可能なランナーを生成する。** scope はファイルが着地した瞬間から `/aidlc --scope <name>` 経由で完全に使える — ランナーは不要。1 語のコマンド（`/aidlc-hotfix`）が欲しければ、scope frontmatter に `runner: true` を足し `bun .claude/tools/aidlc-runner-gen.ts scopes` を走らせる。`bun .claude/tools/aidlc-runner-gen.ts scopes --all` はそのフラグに関わらずすべての scope ファイルに `skills/aidlc-<scope>/SKILL.md` を emit する。各ランナーは、scope を焼き込んで `aidlc-orchestrate next --scope <name>` を `done` まで駆動する薄いシェルに、`/aidlc` orchestrator が持つのと同じ recognize、offer（`AskUserQuestion`、決して自動作成しない）、`next --new-intent --scope <name>` の指針を運ぶ「Starting unrelated new work?」節を加えたものである。ランナーは既に走れる scope をパッケージし、scope ファイルがその定義である。それは `hooks:` ブロックを運ばない: 決定論的な背骨（audit、sensor、rebuild-stage-graph、状態検証）は `settings.json` にプロジェクト全体で登録されているので、すべてのランナーがそれを無料で継承する。scope ファイルを足すかリネームするたびにジェネレータ（または `scopes --check`）を再実行する。

### 何が自動で検証されるか

この実装は、有効な scope のリストをランタイムに `.claude/scopes/*.md` の存在から `validScopes()` を通して導くので、ファイルが着地した瞬間に多くが所定の位置に嵌まる:

- scope は一度にどこでも有効になる — `init`、`--scope` 変更、env 既定の解決、`doctor` はすべて同じヘルパーを参照するので、どれもコード編集を要さない。
- エラーメッセージは変更なしにあなたの scope をアルファベット順に挙げる。
- `keywords` を与えたなら、frontmatter のリストが populated になり次第、freeform の `/aidlc <text>` がそれを自動検出する — SKILL.md の散文編集は不要、テーブル再生成だけである。
- 転置のドリフトガード（`compile --check`）は、stage の `scopes:` タグが再コンパイルなしに編集されたらビルドを落とす。

### 何が自動で検証されないか

- **タイプミスした scope 名の `scopes:` タグでもパースは通る。** `hotfix` の代わりに `hotfx` を名指す stage frontmatter はきれいにコンパイルされる — 誰も求めないグリッド列を生むだけである。落とし穴は、`validScopes()` が `.md` ファイルから導くので、ファイルの無い scope は呼び出し時に拒否されるが、stage 上のタイプミスしたタグはその stage を本物の scope から静かに落とすことである。`/aidlc --doctor` と scope 別テストがガードレールである。
- **コンパイル済み scope テーブルはドリフトしうる。** stage の `scopes:` を編集してステップ 3 の再コンパイル + テーブル再生成を飛ばすと、エンジンは古いグリッドを読み続ける。`--check` フラグ（テストスイートが走らせる）がこれを捕まえるが、あなたがそれを走らせた場合だけである。
- **scope 別の phase-sequence カバレッジ。** 同梱の phase-sequence テストは既知の scope 名のハードコードされたリストを反復する。新しい scope は、そのリストを拡張するまでそれによって行使されない。同じ変更であなたの scope をそれに足す。
- **手で保守される docs。** 何もあなたのために docs を grep しない。scope リファレンス、ルーティング表、customization の valid-values リストは散文である。scope ファイルと歩調を合わせて自分で保つこと。

---

## 既存 scope の調律

調律はより小さな編集だが、scope ではなく stage に着地する。2 つの変更がよく出てくる:

- **stage を出し入れする。** stage の `scopes:` リストから scope 名を足すか除く。これが、例えば、あなたのチームが最初の一手でも常に監視を配線するので `observability-setup` の `scopes:` に `mvp` を足す方法である。タグ 1 つ、続けて再コンパイル（`compile` + scope-table）と `--doctor`。
- **既定の depth、テスト戦略、または review 上限を変える。** scope の `core/scopes/aidlc-<name>.md` frontmatter で `depth` を調整するか、`testStrategy` を足す／除くか、`review_cap` を足す／除く。最初の 2 つは成果物とテストの量を再較正する; `review_cap` は stage の review クラスを `adversarial`、`advisory`、`none` へ格下げするが決して格上げしない。各 scope が自身の既定を運ぶので、この変更はその scope を選ぶすべてのワークフローに適用される。実行別の `--depth`、`--test-strategy`、`--review` は該当する振る舞いをさらに格下げできる。

いずれにせよ、上のステップ 3 の再コンパイルと doctor のペアが当てはまる。編集は小さく、検証は同じである。

レイヤーについての注記: 同梱の scope を調律することは、フレームワークが同梱するファイルを直接編集する — stage の `scopes:` タグや同梱の `core/scopes/aidlc-*.md`。それは異なる既定を望む fork にとって正当だが、`aidlc-` の系譜を運ぶファイルを変えていることを認識せよ。フレームワークのアップグレードがそれらを調停したがるかもしれない。同梱の 9 個と並べてまっさらな scope ファイルを足すのが、他のみんなが頼る既定に触れずにチーム固有の振る舞いが欲しいときのより清潔な道である。

---

## 次へ

[Rule と学習ループ](05-rules-and-the-loop.md) — すべてのワークフローに旅する恒常的な決定を著述し、ループが一度きりの訂正を永続的な rule に昇格させるに任せる。

規範的な scope-shape とランナーの契約 — `.claude/scopes/` ファイルがワークフローの訪れる stage をどう駆動するか、ジェネレータがそれをタイプ可能な `/aidlc-<scope>` スキルにどう変えるか — は、開発者リファレンスの [スキルシステム §5（scope shape）と §4（runner）](../reference/17-skill-system.md) を参照。
