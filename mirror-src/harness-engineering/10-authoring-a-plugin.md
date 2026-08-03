# Plugin を著述する

> [Harness Engineer Guide](00-overview.md) の一部。前提:
> [Stage の解剖](01-anatomy-of-a-stage.md)。設計リファレンス（メカニズム、
> インストール時の論拠、ハイブリッドなディストリビューションモデル、そして as-built ステータス）:
> [Plugin Mechanism](../reference/18-plugin-mechanism.md)。

**AIDLC plugin**（**plugin**）は、再利用可能で任意な AIDLC contribution の集合である —
新しい stage、agent、scope、method/rules（memory レイヤー）、sensor、methodology 知識、そして
既存の core stage への追加的な変更 — であり、自身のディレクトリにパッケージされ、
自身のリポジトリから公開され、ユーザーが選んだ plugin の集合にわたって、そのインストールへと
**compose される**。plugin は決して `core/` を編集しない; すべての plugin を無効にすれば、
インストールは素の core とバイト同一である。

ファーストパーティ plugin（AIDLC チームが出荷する）とサードパーティ plugin（それ以外の誰か）は
**機構的に同一** である — 同じ構造、同じ seam、同じ composer、同じ保証。唯一の違いは出所である:
plugin が誰のリポジトリに住み、誰がレビューしたか。

この章は `test-pro` plugin を端から端まで辿る。あなた自身のもののために、その形を写せばよい。

## plugin を書くか、素の stage/rule を書くか

- **stage/agent/rule**（[chapters 2–6](00-overview.md)）は、全員が得るフレームワークの恒久的な
  一部である。
- **plugin** は _任意で所有される_ — 自身のリポジトリで出荷され、オプトインの scope（および/または
  `when:` 述語）の下でのみ有効化され、消費者はそれを自身のインストールに compose することを選ぶ。
  すべてのプロジェクトが欲しいわけではないドメインパック（完全な operation phase、
  コンプライアンス plugin、テスト plugin）に使う。

## 1. ディレクトリと manifest

plugin は、宣言的な manifest と core 形状のサブツリーを持つディレクトリ（かつ git リポジトリ）で
ある:

```text
test-pro/
  .aidlc-plugin/plugin.json                          # the manifest
  stages/construction/test-pro-integration.md        # NEW stages
  stages/operation/test-pro-full-suite.md
  contributions/construction/nfr-requirements.md      # MODIFY existing core stages (§3)
  contributions/construction/nfr-design.md
  contributions/construction/build-and-test.md
  contributions/operation/performance-validation.md
  sensors/aidlc-coverage-threshold.md                 # NEW sensor manifests
  sensors/aidlc-requirement-coverage.md
  tools/aidlc-sensor-coverage-threshold.ts            # the sensor scripts
  tools/aidlc-sensor-requirement-coverage.ts
  scopes/test-pro-validation.md                       # NEW plugin scope
  agents/test-pro-metrics-agent.md                    # NEW support persona
  knowledge/test-pro-metrics-agent/methodology.md     # plugin methodology knowledge
```

`.aidlc-plugin/plugin.json` は **宣言的な** manifest である。そのトップレベルは共通の
plugin-manifest 形状を鏡写しにする（その結果、marketplace やホストのツーリングがそれを
list/version/trust できる）; AIDLC 固有の設定は、ネストされた `aidlc` ブロックに住む:

```jsonc
{
  "name": "test-pro",                 // == dir name; "core", "aidlc", and "aidlc-*" are reserved
  "version": "0.1.0",                 // semver; checked by dependents
  "description": "Full-featured testing plugin — unit/branch coverage, functional, integration, regression, edge, and API positive+negative.",
  "author": { "name": "AWS AIDLC" },
  "dependencies": ["core"],           // other plugins, e.g. ["compliance@^1.2.0"]
  "aidlc": {
    "contributes": {                  // which subtrees this plugin ships
      "stages": "stages/",            // NEW stage files
      "overlays": "contributions/",   // CONTRIBUTION files (§3 — modify existing)
      "agents": "agents/",            // NEW personas
      "scopes": "scopes/",            // NEW scope identities
      "knowledge": "knowledge/",      // methodology knowledge for agents
      "sensors": "sensors/",          // sensor manifests
      "tools": "tools/"               // sensor scripts (so a sensor can run)
    }
  }
}
```

`contributes` のキーは core のサブツリー（`stages`、`agents`、`scopes`、`memory`、`sensors`、
`knowledge`、`tools`）に対応する — それらは compose 時に core と並んでマージされる。`tools` は
CLI スクリプトを harness の `tools/` ディレクトリに配置し、その結果 plugin は **走行可能な
sensor**（その manifest は `sensors/` に + そのスクリプトは `tools/` に）を出荷できる。`memory` は
`rules/` ディレクトリ **ではなく**、default-space の method seed にマージされる（そのディレクトリは
もはや読まれない — §4 を参照）。`overlays` は特別である: それはコピー **されない**; それは
マージが消費する stage ごとの contribution を保持する（§3）。

あなたの plugin が使うキーだけを出荷する。`test-pro` は support agent、plugin scope、そして agent
ごとの methodology 知識を出荷する; それでも lead としては `aidlc-quality-agent` を再利用する。

> **番号範囲は無い。** Stage の番号は表示専用なので、plugin はその manifest で番号範囲を主張
> **しない**。§2 を参照。

## 2. 新しい stage を足す

plugin stage は、2 つの追加ルールを持つ普通の stage ファイルである（[Stage の解剖](01-anatomy-of-a-stage.md)
を参照）:

- その `plugin:` フィールドがあなたの plugin を名指す。
- それが `produces:` する任意の artifact は `<plugin>-` でプレフィックスされねばならない（例:
  `test-pro-integration-test-results`）。

同じ論理的な plugin 名が、所有するすべての stage・scope・agent・contribution に現れなければ
ならない。compose はその identity を、発行される host manifest から導出する
（host レイヤーでは `aidlc-<name>`、AIDLC frontmatter では `<name>`）。content が自分の
package を改名したり詐称したりすることはできない。不一致は drop され `/aidlc --doctor`
向けに記録される。

`bundle:` はリネーム前の所有権キーであり、修正を名指すエラーで拒否される - `plugin:` と書く。
この語は、将来ありうる collection-of-plugins のコンセプトのために予約されている。

Stage の **identity は slug である**。重要なところ（edge、jump、解決）のすべてでそうである。
`number:` は **表示ヒント** にすぎない — stage のグラフ上の位置は slug ベースの
`requires_stage` edge から来て、コンパイル後の番号値はあなたではなく ENGINE が割り当てる:
初回コンパイル時、あなたの plugin の新しい stage は自分自身の `requires_stage` edge で
順序づけられ、あなたが著述した `number:` の値は独立した stage 間のタイブレークにのみ使われ、
その phase の中で次に空いているインデックスが与えられる。だから、理にかなって読み、edge と
一致する番号を著述する（`test-pro-integration` は `3.85`、`3.6` の `build-and-test` の後）
—運ばれるのは RELATIVE な順序である— が、絶対値がグラフに載ることは決してなく、stage を
挿入しても core が再番号付けされることは決してなく、範囲を主張することもない（これが、
未協調の 2 つの plugin が番号で決して衝突しない理由である）。

`scopes:` で stage を scope にゲートする（それ以外のあらゆる場所では SKIP である）。任意で
`when:` 述語を宣言する。`test-pro-full-suite` は、その上流の producer がプランに載っているときに
だけ走ることが *意図されている*:

```yaml
scopes:
  - enterprise
when:
  producer-in-plan: test-pro-regression-suite
```

> **`when:` はパースされるが、まだ評価されない。** スキーマは述語を検証し、parser はそれを読むが、
> 今日それに作用する engine 消費者は無い — `when:` を運ぶ stage は、宣言された `scopes:` の下で
> 無条件に EXECUTE である。前方互換性のためにそれを著述してよいが、今のところ本物の振る舞いは
> `scopes:` にゲートする。

scope のメンバーシップと `when:` 述語については [Scope](04-scopes.md) を参照。

## 3. 既存の core stage を変更する（contribution）

これが contribution seam である — core stage を、**それを編集せずに** 追加的に変更する。
contribution は `<plugin>/contributions/<phase>/<slug>.md` に住む。以下は `test-pro` の
`nfr-requirements` への contribution である:

```markdown
---
target: nfr-requirements      # the existing core stage you're enriching
plugin: test-pro
adds:                         # STRUCTURAL — set-unioned into the stage node
  produces:
    - test-pro-testability-requirements   # <plugin>- prefixed
  required_sections:
    - "Testability Requirements"          # machine-enforced
    - "Coverage Targets"
fragments:                    # PROSE — spliced into the stage body
  - anchor: after-step:6
    order: 100
---

## fragment: after-step:6

### Step 6b (test-pro): Capture testability NFRs

…prose the agent will see, appended after the target stage's Step 6…
```

追加できるもの（すべて追加的 — 設計上、**上書きも削除も無い**）。「Status」は、compose hook が
今日マージするものと、設計されたが延期されたものを標す（doc 18 §5/§8 を鏡写しにする — 実装するか
降格するか、決して静かな no-op ではない）:

- `adds.produces` / `adds.consumes` / `adds.sensors` — ✅ 対象 stage のソース frontmatter に
  set-union される。
- `adds.required_sections` — ✅ stage の `required_sections` にマージされる。ただしそれは
  **今日は機械強制されない**: フィールドは書かれ検証されるが、コンパイルされたグラフノードには
  到達せず、出荷される `required-sections` sensor はその期待をテンプレートから導くので、欠けた
  セクションのために stage を失敗させるものはまだ無い。今のところ、それを宣言的な intent として
  扱う。
- `adds.scopes` — ✅ 対象 stage の `scopes:` リストに set-union される。2 つのガードレールが
  ある（違反はそれぞれ dropped-with-log であり、決してマージされない）: その scope の
  identity ファイルがインストールされていること（`scopes/<name>.md` が同じ plugin で
  出荷されること）、そしてそのファイルの `plugin:` frontmatter があなたの plugin を正確に
  名指していること — core stage を core または他 plugin の scope の下に置くことはできず、
  所有権はインストールされたファイルの宣言された所有者から読まれ、名前のプレフィックスから
  推論されることはない。既存の core stage をあなたの plugin の scope の下にルーティングする
  ために使う — 例えば、自身の discovery stage と core Inception 以降を運ぶ scope を持つ
  methodology plugin。
- `adds.requires_stage` — ⏳ **延期**: contribution はそれを宣言してよいが、compose はマージ
  するのではなく drops ログにそれを記録する（それはまだ DAG edge ではない）。振る舞いをゲート
  するためにまだそれに頼ってはならない。
- `fragments` — ✅ stage の本体に継ぎ合わされる散文ブロック。各 fragment の散文は、contribution
  ファイル中の `## fragment: <anchor>` ブロックである。

### Fragment のアンカー

| Anchor             | Inserts the fragment…                                              | Status |
| ------------------ | ------------------------------------------------------------------ | ------ |
| `after-step:<n>`   | `### Step <n>` の直後（次の `###`/`##` の前）            | ✅ |
| `before-step:<n>`  | `### Step <n>` の直前                                  | ✅ |
| `end-of-steps`     | `## Steps` ブロックの末尾                                 | ✅ |
| `in:<Compartment>` | 名前付きの `## <Compartment>` ブロックの末尾（例: `in:Sensors`） | ✅ |
| `after-questions`  | questions を生成するステップの後                                | ⏳ 未実装 — `locateAnchor` にケースが無い; "unknown anchor" をドロップする。`after-step:<n>` を使う。 |

Fragment は `(order, plugin)` によって決定論的に順序づけられる。同一の `(plugin, anchor, order)`
の衝突 — 1 つのファイル内であれ、この実行での 2 つの contribution ファイルにまたがってであれ —
は **ドロップされてログされる**（last-writer-wins ではない）。2 つの *異なる* plugin が同じ stage
に contribute するとき、それらの構造的追加は set-union され、それらの fragment はこの同じ順序で
交互に並ぶ — 真にマージされる。

継ぎ合わされた各 fragment は、コンテンツハッシュを運ぶ sentinel コメント（`<!-- plugin:<plugin>:<anchor>:<order>:<hash> --> … <!-- /plugin:… -->`）
で包まれる。それが、再 compose が冪等のままであり、アップグレードされた fragment がその以前の
ブロックを置き換える仕組みである。そこから 2 つの著述ルールが従う:

- **fragment の散文の中に sentinel そっくりの行を書くな。** あなたの散文の中で
  `<!-- /plugin:… -->` に合致する行は、ブロック終端子と誤認され、アップグレード時に splice を破損
  させる。
- **プレリリースビルドからのアップグレード:** このブランチの *review build*（sentinel にハッシュが
  足される前）から compose されたインストールは、古いハッシュ無しのマーカーを運ぶ; アップグレードは
  それを認識せず、2 つ目のコピーを splice してしまう。影響を受けるのは PR ブランチのインストール
  だけである — クリーンなベースから再 compose するか、あるいは古いブロックを手で、一度だけ削除
  する。

## 4. 他のプリミティブをパッケージする

`test-pro` は stage、contribution、sensor、support agent、scope、そして methodology 知識を出荷
する。より豊かな plugin は、後に method/rules も足すかもしれない; memory の射影は延期のままである
（doc 18 §8 Status）。

- **Agent。** `plugin:` を設定した `agents/<plugin>-<role>-agent.md` を落とす。plugin プレフィックスは
  core の `aidlc-` ファイル名プレフィックスを置き換え、ファイル名の語幹は frontmatter の `name` に
  等しくねばならない（例えば `agents/test-pro-metrics-agent.md` は `name: test-pro-metrics-agent` を
  持つ）。それは compose の後に自動で発見され、あなたの plugin の stage はそれを
  `lead_agent`/`support_agents` として名指してよい。異なるコンテンツでの同一パスの衝突は上書き
  されない; compose は drop ログを記録する。OpenCode の composition はさらに、ネイティブの
  `.opencode/agents/` subagent の双子を作り、ネストされた `task` の委任を拒否する。
  [Agent を足す](03-adding-an-agent.md) を参照。
- **Sensor。** manifest `sensors/aidlc-<id>.md` **と** そのスクリプトを `tools/` の下に出荷する
  （両方 — manifest だけでも発見可能だが、走るにはそのスクリプトが `tools/` に住まねばならない）。
  `sensors/` の先頭にある `aidlc-<id>.md` という名前は慣習ではなく厳格な要件である: sensor の
  発見は `sensors/` をフラットにスキャンし、`aidlc-<id>.md` にマッチする basename だけを
  索引する。したがって他の名前の manifest（またはサブディレクトリにネストされたもの）は
  compose されても決して発火しない。Compose は今、そのような manifest を、死んだまま着地
  させるのではなく、ファイルと必須の形を名指す degraded drop（`--doctor` が表面化する）で
  却下する。sensor を `sensors:` 経由であなた自身の stage に、あるいは contribution の
  `adds.sensors` 経由で core stage に束ねる。[Sensor](06-sensors.md) を参照。
- **Method/rules。** *(⏳ 延期。)* `contributes.memory` 経由で `memory/` サブツリー —
  `memory/phases/<phase>.md`（または `memory/{org,team,project}.md`）— を出荷する。設計上それは
  **default-space の method seed にマージされる**（`aidlc/spaces/default/memory/`）が、
  packager/compose hook はまだ `memory/` を射影もマージもしない。`rules/` ディレクトリを出荷しては
  **ならない** — そのパスはもはや読まれない（rule レイヤーは space ごとの memory に移った）。
  [Rule と学習ループ](05-rules-and-the-loop.md) を参照。
- **Knowledge。** agent ごとの **methodology** 知識を `knowledge/<agent-slug>/` の下に出荷する。
  それはフレームワークが出荷する `<harness>/knowledge/` ツリーに射影され、その agent が stage を
  lead または support するときにロードされる。注意: **ドメイン/チーム知識**
  （`aidlc/spaces/<space>/knowledge/`）は、bootstrap 時に空のユーザーランタイム状態である —
  plugin はそれを出荷しない。[チーム Knowledge](07-team-knowledge.md) を参照。
- **Scope。** scope の **identity** は、`scopes/<plugin>-<name>.md` の下に出荷する 1 つのファイルで
  ある。plugin プレフィックスは core の `aidlc-` ファイル名プレフィックスを置き換え、ファイル名の
  語幹は frontmatter の `name` に等しくねばならない（例えば `scopes/test-pro-validation.md` は
  `name: test-pro-validation` を持つ）。core の `feature`/`poc` の既定が無効なときのフォールバックとして
  plugin の scope を指名するには `freeform_default: true` を設定する。選択された core/plugin
  集合をまたいで有効な scope のうち最大 1 つだけがそれを主張でき、曖昧な集合はグラフの
  コンパイルが却下する。plugin が著述した stage のメンバーシップは、それらの
  `scopes:` frontmatter リストである。既存の core stage にあなたの scope を足すことは、
  contribution の `adds.scopes`（§3）を通して機能する。[Scope](04-scopes.md) を参照。

## 5. ディストリビューションとインストール

packager はあなたの plugin を **本物の host plugin** として emit する（harness ごとに 1 つの射影
ターゲット: `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`、加えて Kiro のフォルダ射影）。
あなたはその出力を semver タグと `marketplace.json` を付けて git リポジトリに公開し、チームは host
のネイティブコマンドを通してインストールする。

### Claude / Codex（host store）

```bash
# teams run these in their host CLI:
/plugin marketplace add <your-org>/<your-plugin-repo>    # Claude
/plugin install test-pro@<marketplace>                   # Claude

codex plugin marketplace add <your-org>/<your-plugin-repo>   # Codex
codex plugin add test-pro@<marketplace>                      # Codex
```

**SessionStart hook**（emit された plugin に同梱される）が自動で compose する — 選ばれたすべての
plugin のサブツリーと contribution をマージし、マージされた集合を検証し、stage graph と scope grid
をコンパイルし、結果を射影する。orchestrator は完全にそのコンパイルされたグラフから経路を決めるので、
plugin stage は compose された瞬間に走る — 編集すべき散文や skill ファイルは無い。

### Kiro（store 無し — folder-drop してから composer を明示的に走らせる）

```bash
# git pull your plugin repo, copy the Kiro projection into the project:
cp -r dist/plugins/<name>/kiro/. <project>/
# preferred when aidlc is on PATH:
AIDLC_PLUGIN_ROOT="<plugin-root>" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro aidlc plugin sync

# fallback: run the composer explicitly:
AIDLC_PLUGIN_ROOT="<plugin-root>" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro bun "<plugin-root>/hooks/compose.ts"
# open in Kiro IDE or kiro-cli chat → /aidlc
```

> **Kiro の注記。** emit された `.kiro.hook` は、plugin-root の env var についてのホストのサポートに
> 依然依存する。バイナリが利用可能なときは `AIDLC_PLUGIN_ROOT` を付けた `aidlc plugin sync` を使い、
> そうでなければフォールバックとして上記の明示的な `bun compose.ts` の起動を使う。

### 信頼

信頼は **host-native** である — あなたは何も作らない:
- Claude: org 管理者が `strictKnownMarketplaces` を設定する（マネージド、上書き不可）。
- Codex: plugin ごとに一度きりの trust プロンプト、content-hash でピン留めされる。
- Kiro: 該当なし（folder-drop、host gate 無し）。

> **具体例** — `plugin.json`、`marketplace.json`、`managed-settings.json`（org の trust 設定）、
> `aidlc.lock.json` — は [`examples/test-pro/`](../reference/examples/test-pro/) にある。完全な
> プラットフォームチームの実践例については、[Plugin Mechanism §8](../reference/18-plugin-mechanism.md)
> も参照。

## 基本のルール

- **番号は表示専用。** 理にかなった `number:` を著述する; 範囲を主張しない; stage を挿入しても core
  が再番号付けされることは決してない。
- **Artifact の名前空間化。** あなたが produce する artifact はすべて `<plugin>-` プレフィックス
  される; それは core の artifact や別の plugin のものと衝突してはならない。
- **プリミティブ名は一意。** あなたの scope/agent/sensor は core や別の plugin と衝突してはならない —
  衝突は帰属付きの compose エラーである。（method ファイルは、ファイル単位で追加的に memory seed に
  マージされる。）
- **Dependencies** *(⏳ 延期)。* `dependencies` は、依存の `version` に対して `name@^x.y.z` 制約を、
  サイクル拒否とともに解決するように設計されているが、**まだそのフィールドを読むものは無い** —
  それを宣言しても今日は効果が無い（doc 18 §8 Status）。
- **追加のみ。** contribution は足す — それらは core stage のフィールド、agent、散文を上書きも削除も
  できない。（上流の振る舞いを _変える_ 本物の必要は、plugin の関心事ではなくフレームワークの設計
  判断である。）

## あわせて参照

- [Plugin Mechanism](../reference/18-plugin-mechanism.md) — 規範的な設計: manifest、composition
  モデル、contribution seam、インストール時の論拠、ハイブリッドなディストリビューションモデル、
  マルチテナントのガード、そして as-built ステータス（すべてこの 1 つの章に統合されている）。
- [Stage の解剖](01-anatomy-of-a-stage.md)、[Scope](04-scopes.md)、[Sensor](06-sensors.md) — plugin
  が compose する構成要素。
