# AI-DLC を新しい harness へ移植する

AI-DLC は **one core, many harnesses** から出荷される — 今日は Claude Code、Kiro CLI、
Kiro IDE、Codex CLI、Cursor、opencode、そして GitHub Copilot であり、その集合は開いている。手著述のソースは、
harness 中立な `core/` に加え、CLI ごとの薄い `harness/<name>/` サーフェスである; packager
（`scripts/package.ts`）はコミット済みの各 `dist/<harness>/` ツリーを再生成する。別の harness を
足すことは **1 つのディレクトリと 1 つの manifest 行** である — engine、methodology、そして
harness-dir/rules の解決は `core/` の編集を一切要さない; 唯一の任意の例外は、harness ごとの
`--doctor` アームである（Step 2 を参照）。このページはその契約を辿る。

> このリポジトリにおける "harness" の 3 つの意味: **`harness/`**（トップレベル — この
> ページが扱う CLI ごとのディストリビューションサーフェス）、**`docs/harness-engineering/`**
>（このガイド）、そして **`tests/harness/`**（テストスイートのヘルパーライブラリ）。
> 無関係である; ディストリビューションは最初のものだけである。

## その形

```
core/                      # harness-neutral source — not edited to add a harness (save the optional --doctor arm)
harness/
  claude/  manifest.ts · skills/aidlc/ · CLAUDE.md · settings.json
  kiro/    manifest.ts · skills/aidlc/ · agents/*.json · hooks/aidlc-kiro-adapter.ts · settings/cli.json · AGENTS.md
  codex/   manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-codex-adapter.ts
  opencode/ manifest.ts · emit.ts · skills/aidlc/ · command/ · plugin/
  copilot/ manifest.ts · emit.ts · skills/aidlc/ · hooks/aidlc-copilot-adapter.ts
scripts/
  package.ts               # bun scripts/package.ts [<name>] [--check]
  manifest-types.ts        # the HarnessManifest contract every manifest implements
dist/<name>/               # GENERATED, committed, drift-guarded
```

`core/` の散文は `{{HARNESS_DIR}}` トークンで harness ディレクトリを名指す; packager は
manifest が宣言する `harnessDir` が何であれ（`.claude` / `.kiro` / `.codex` / あなたの `.foo`）
それに置換する。`.ts` は無変換でバイトコピーされる — `core/tools/aidlc-lib.ts` のランタイムの
`harnessDir()` seam が、実行時に出荷されたレイアウトからディレクトリを導く（open-set:
ハードコードされたリストではなく、ツール自身のパスからディレクトリ名を読む）ので、同じツール
ソースがすべてのツリーで走る。受理 gate は **byte-parity** である: harness を再生成するとき、
そのコミット済み dist を正確に再現せねばならない（`package.ts --check`）。

packager は `harness/` を `manifest.ts` について走査することで harness を **発見する** ので、
新しいディレクトリは packager 自身への編集無しに、既定の `bun scripts/package.ts` と `--check`
によってビルドされる — 「1 つのディレクトリと 1 つの manifest 行、共有コードの編集ゼロ」の
文字どおりの意味である。

## Step 1 — manifest（宣言的な 80%）

`HarnessManifest`（`scripts/manifest-types.ts`）をエクスポートする
`harness/<name>/manifest.ts` を作る。そのフィールドは:

- `name` / `harnessDir` — トークンが置換される先のディレクトリ（例: `.foo`）。
- `coreDirs: DirMap[]` — どの `core/<src>` ディレクトリが `<harnessDir>/<dst>` に射影されるか。
  ここでディレクトリをリネームまたはドロップする（Kiro は `rules → steering`; Codex は
  `rules → aidlc-rules` かつ `skills/` をドロップする — emit を参照）。3 つの session skill は、
  in-tree の harness（claude、kiro、kiro-ide）にとって core ディレクトリである; codex は代わりに
  それらを emit する。
- `harnessFiles: FileMap[]` — `harness/<name>/<src>` から dist へ逐語的にコピーされる、
  著述されたサーフェス（`.md` はトークン置換を受ける）。`projectRoot: true` は harness
  ディレクトリの傍らにファイルを配置する（例: `AGENTS.md`）。
- `frontmatterAdditions`（任意）- 射影の間に、core 射影された `.md` の frontmatter に追記される
  ファイルごとの YAML 行。他の harness へ出荷してはならない harness ネイティブなフィールドの
  ためのものである（kiro-ide は自身の委任対象 agent ファイルに
  `tools: ["read", "write", "shell"]` を注入する - IDE は subagent のツール付与を `.md` の
  frontmatter から読む）。core が単一ソースのままであるよう manifest データとして宣言される;
  packager は、タイプミスのパス、欠けた frontmatter ブロック、または core が既に宣言するキーに
  対してエラーを出す。
- `rulesRename` — リネームされた rules ディレクトリ（`"steering"` | `"aidlc-rules"` | `null`）。
  packager はそれを、コピーされたディレクトリに、かつ散文中の `<harnessDir>/rules/` 参照に、かつ
  コンパイルされた stage-graph の rule パスに（`loadRules` がリネームされたディレクトリを
  見つけるよう、コンパイル時に `AIDLC_RULES_DIR` を設定する）、かつ manifest の name と rules
  ディレクトリの両方を記録する生成された `tools/data/harness.json` へそれを emit する形で
  適用する。ランタイムのパス解決は、engine ディレクトリを共有する harness を判別するために
  name を使い、`rulesSubdir()` がリネームを読む — その結果、実際のインストールはハードコード
  無しに両方の事実を解決する。これが
  `rulesRename` を純粋な manifest データにする seam である: ここで設定すれば、あらゆるレイヤー
  （build 散文、コンパイルされたパス、ランタイム）が `core/` の編集無しに追随する。
- `skipRunnerGen` — harness が `<harnessDir>/skills/` を出荷しないときに設定する（Codex は自身の
  skill ツリーを `emit` 経由で `.agents/skills/` に emit する）; そのとき packager は標準の
  runner-gen ステップをスキップする。
- `emit` — 任意のプラグイン（Step 3）、必要としない harness には `null`。

Claude の manifest は最小のリファレンスである（リネーム無し、emit 無し）; Kiro のものは
リネームと `harnessFiles`（agent の JSON 群、adapter、project-root の AGENTS.md）を足す。

## Step 2 — hook adapter（harness ごとの shim）

core hook は Claude 形状の stdin を正規形として消費する。新しい harness は、harness の hook
ペイロードをその契約へと正規化し、共有の core hook へ subprocess でパイプする **1 つの著述された
adapter**（`harness/<name>/hooks/aidlc-<name>-adapter.ts`、`harnessFiles` に列挙される）を
出荷する。core hook を logic+adapter に分割してはならない — core の本体はすべての harness を
跨いでバイト共有のままである（`--check` がそれを証明する: dist 中のすべての `.ts` は、その
`core/` ソースとバイト同一である）。

adapter を harness のイベントに、harness 自身のやり方で結線する: Kiro は `agents/aidlc.json` に
ターゲットを登録する; Codex は `hooks.json` を emit する。実際の core-hook 消費者があるイベント
だけを登録する。

6 つの hook はフローを変えるもので、単にパイプするだけでなく、その制御チャネルを転送する
必要がある。Stop hook は stdout で `{"decision":"block"}` を返す; dispatch-rules は委譲された
プロンプトを書き換える; そして PreToolUse の reviewer-scope、review-freeze、plan-approval、
state-transition のガードは stderr で exit 2 と理由を返す（adapter がその exit コードを中継するとき、そのツール呼び出しは
拒否されねばならない）。新しい harness が自身の pre-tool seam からツール呼び出しをハードブロックできないなら、
reviewer-scope と review-freeze の登録を省き、死んだ hook 群を結線するのではなくギャップを文書化する - stage-protocol §12a に
束縛された散文が依然そこを統べる。harness のペイロードが subagent の identity を運ばないときは、harness が agent
ごとの hook をサポートする場所で、reviewer-scope の登録を reviewer agent 自身にスコープする（Kiro CLI のパターン:
adapter はそのとき `agent_type` に合致させる代わりに `scoped_registration` をアサートする）。

> **唯一認可された `core/` の編集: doctor アーム。** `/aidlc --doctor`
> （`core/tools/aidlc-utility.ts`）はインストール済みツリーをヘルスチェックし、新しい harness は
> 自身のインストールサーフェス（adapter と結線ファイルの存在、任意のバイナリバージョンの下限）の
> ために、そこへ harness ごとのアームを足す。これは意図的な harness ごとの *ロジック* であり、
> データではない — バージョンチェックは CLI を spawn して semver を比較するが、それはどの
> manifest 行も表現できない（three-concerns ルール: 知識はコードに住む） — ので、これは
> 「`core/` の編集ゼロ」への祝福された例外であって、違反ではない（意図的な設計上のトレードオフ）。
> それは優雅に劣化する: アームの無い harness は、失敗するのではなく単に汎用チェックを得る。
> それ以外のすべて — ディレクトリ解決、rules-dir のリネーム、パッケージング — は純粋な manifest
> データのままである。

## Step 3 — `emit.ts`（命令的な 20%、必要な場合のみ）

宣言的な行が表現できない構造的な分岐が `emit.ts` である — manifest が参照し、packager が
`EmitContext`（`coreRoot`、`harnessRoot`、`distRoot`、`harnessDir`、`substituteToken`、
`tierCap`）とともに呼ぶプラグインである。emitter はその出力を `distRoot` の下に書く。Codex の
ものが実践例である: `config.toml`、`hooks.json`、hook-trust の事前シード、`AGENTS.md` の
マージ、agent-TOML の転置、そして `.agents/skills/` ツリー（`AIDLC_HARNESS_DIR` の下で
`core/tools/aidlc-runner-gen.ts` のエクスポートされた render 関数から合成され、決して再実装
されない）。サーフェスがすべて著述されたファイルである harness（Claude、Kiro）は `emit: null` を
設定する。

`--check` の下では、packager は一時的な `distRoot` を供給し、同じ emitter を走らせ、それから
生成されたルート全体をコミット済みディストリビューションと比較する。`<harnessDir>` の外にある
emit 所有のファイル（例えば `.agents/skills/` とルートの `AGENTS.md`）は、それゆえ宣言的な出力と
同じ missing、differing、orphan のチェックに参加する。

## Step 4 — 唯一の transform クラス

許される唯一のテキスト transform は、スラッシュアンカーされた harness-dir ファミリである: `.md`
散文中の `{{HARNESS_DIR}}` → harness ディレクトリ、加えて rules-dir のリネーム。盲目的な `sed`
は無い。`core/` 中の真正な harness 固有のリテラル（`$CLAUDE_PROJECT_DIR` の注記、
workspace-detection 中の harness-dir 列挙）はトークンを運ばず、無変更で通過する — core-hygiene
テスト（`t146-core-hygiene`）が、新しい生のパスリテラルの紛れ込みを防ぐ。

## Step 5 — テストと gate

- パッケージング parity テスト（`t145`）は `package.ts --check` を走らせる; それは manifest を
  持つすべての harness を自動でカバーする。
- `<name>` hook-adapter 契約テストは、ライブキャプチャされたペイロードを adapter を通してパイプ
  し、観測可能な core-hook の効果をアサートする。
- ライブジャーニーは `skipReason()`（`AIDLC_<NAME>_*_LIVE=1` env とバイナリの存在と認証済み）で
  ゲートされた e2e として出荷され、その結果、決定論的な tier ではきれいにスキップし、port が
  マージされる前にローカルで green に走る。

再生成には `bun scripts/package.ts <name>` を、drift-guard には `--check` を、そしてゲートには
決定論的スイート（`bash tests/run-tests.sh --smoke --unit --integration
-P 8`）とライブジャーニーを走らせる。

## 次へ

それがアークを閉じる: あなたはデータサーフェスを形作り（chapters 01–08）、そして今 core を
新しい CLI 上にレンダリングした。ここから:

- 全体像は [Harness Engineer Guide overview](00-overview.md) へ戻る。
- 新しい harness は他のものと並んで **ユーザー向けの章** を得る — 既存のものがどう読めるかは、
  User Guide の [Running on other harnesses](../guide/harnesses/README.md) ファミリを参照。
- 規範的なビルド契約（manifest 型、`emit` プラグイン API、`harnessDir()` seam）は、Developer
  Reference の [Architecture § Source vs distribution](../reference/01-architecture.md#source-vs-distribution-one-core-many-harnesses)
  に住む。
