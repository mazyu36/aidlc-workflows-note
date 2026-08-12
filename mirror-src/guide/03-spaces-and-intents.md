# Space と Intent

[最初のワークフロー](02-your-first-workflow.md) では 1 つの実行を最初から最後まで追った。
しかし実際の仕事が一度に 1 つであることは稀だ。作りかけの機能があり、緊急のバグが降ってきて、
別のチームがリポジトリを共有する。本章では AI-DLC が**多数の**作業を**1 つの**場所 — *ワークスペース* —
にどう整理するか、そしてそこを移動するための 2 つの概念 — **space** と **intent** — を説明する。

短く言えば: **intent** は 1 件の作業（ライフサイクルの 1 実行）であり、
**space** は 1 チームの intent・ナレッジ・practices の世界である。ほとんどの人は
単一の space（`default`）で作業し、space のことは一切考えない —
intent を開始し、切り替えるだけだ。本章の残りでその仕組みと、すべてがどこに住むかを示す。

---

## 1 つのワークスペース、作業対象で整理する

AI-DLC をインストールするとき、エンジンをプロジェクトにコピーする — harness 固有の
ディレクトリ 1 つ（Claude Code なら `.claude/`、Kiro なら `.kiro/`、
Codex なら `.codex/`、opencode と GitHub Copilot なら `.aidlc/`）である。harness によって異なるのはレイアウトの中で
そのディレクトリ*だけ*だ。以後、AI-DLC が生み出すすべてはプロジェクトルートの
中立な `aidlc/` ディレクトリの下に住む — どの harness で動かしているかではなく、
*何に取り組んでいるか*で整理される。ブラウズするのは `aidlc/` であり、
エンジンのディレクトリを開く必要はない。

これが 2 チームといくつかの進行中 intent を持つ完全なワークスペースである（エンジンの
ディレクトリは `.claude/` と表示している — 該当 harness では `.kiro/` や `.codex/` と
読み替える）。上から下へ読んでほしい — 本章の残りが積み上がるメンタルモデルである:

```
my-project/
│
├── .claude/                      THE ENGINE — tools, hooks, skills, agents.
│                                 (or .kiro/ / .codex/ — the one harness-specific dir)
│                                 You never browse this; it just runs /aidlc.
│
├── aidlc/                        EVERYTHING AI-DLC — neutral, browsable, committed to git
│   ├── active-space              ← cursor: which space you're in (gitignored, per-user)
│   └── spaces/
│       ├── default/              ★ the only space most people ever see
│       │   ├── memory/           THE METHOD — how this team works (committed)
│       │   │   ├── org.md          framework defaults
│       │   │   ├── team.md         your team's practices  (overrides org)
│       │   │   ├── project.md      project-specific practices (overrides team)
│       │   │   ├── phases/         phase-scoped rules
│       │   │   └── templates/      your output-format overrides, one per artifact
│       │   │
│       │   ├── knowledge/        DOMAIN KNOWLEDGE — standards an agent reads (committed)
│       │   │                       free-form; empty until you add files
│       │   ├── codekb/           CODE KNOWLEDGE — what each repo is (committed, per-repo)
│       │   │   └── <repo>/          architecture, component inventory, freshness marker
│       │   │
│       │   └── intents/          THE RECORD — one subdir per piece of work
│       │       ├── active-intent   ← cursor: which intent is current (gitignored)
│       │       ├── intents.json    the registry: every intent + its scope/repos/status
│       │       ├── 260620-inventory-api/        ✓ a completed intent
│       │       └── 260624-export-bug/           ◷ an in-flight intent
│       │           ├── aidlc-state.md             where this intent is in the lifecycle
│       │           ├── audit/                     the decision trail
│       │           └── inception/requirements-analysis/requirements.md   …artifacts
│       │
│       └── payments-team/        another SPACE (another team) — identical shape
│           └── memory/  knowledge/  codekb/  intents/
│
├── repo-a/                       YOUR CODE REPOS live as siblings (each its own git)
└── repo-b/                       an intent can span more than one
```

このツリーから 3 点を取り出す価値がある。これが考え方のすべてだからだ:

- **`aidlc/spaces/<space>/`** は 1 チームの自己完結した世界である: そのメソッド
  （`memory/`）、ナレッジ、コードナレッジ、そして全 intent の記録。
  `spaces/default/` は最初から与えられ、ソロ開発者や単一チームなら
  その先を見ることはない。
- **`intents/<YYMMDD>-<label>/`** は 1 件の作業 — [最初のワークフロー](02-your-first-workflow.md)
  が書き込んでいた、実行ごとの記録である。`<YYMMDD>` はコンパクトな UTC 日付で
  記録が時系列に並び、`<label>` は短い人間可読の名前になる。同一性そのものは
  ディレクトリ名ではなくレジストリの UUIDv7 が担うため、同じ日の同じラベルの
  intent が 2 つあっても区別が保たれる。
- **2 つのカーソル** — `active-space` と `active-intent` — が*いまどこにいるか*を
  記録する。ユーザーごと（gitignore 済み）なので、2 人のチームメイトが同時に
  別の intent に座っていても、共有ファイルを取り合うことはない。

> **古いバージョンからのアップグレード？** 以前のリリースは単一のワークフローを
> プロジェクトルートの平坦なディレクトリ 1 つに置いていたため、新しい実行が上書き
> していた。ワークスペースモデルはそれを上記の intent 別 record dir に置き換えたので、
> 複数の作業を互いに壊すことなく並置できる。

---

## Intent — 作業 1 件につき 1 つ

**intent** は 1 つのタスクにスコープされた AI-DLC ライフサイクルの 1 実行である。
すべての intent は space の `intents.json` レジストリに 1 行 — `{uuid, slug, dirName,
scope, repos, status}` — を持ち、その実行の状態・audit トレイル・成果物を保持する
**record dir** を持つ。`uuid`（UUIDv7）が正準で衝突しない同一性であり、
`dirName` は人間可読な record dir 名をそのまま記録する。

特別なコマンドで intent を作ることはない。作業を初めて記述したとき、エンジンが
intent を**自動 birth** する:

```
/aidlc Build a REST API for inventory management
```

新規ワークスペースではこれが intent を発行し、record dir を
`aidlc/spaces/default/intents/260624-inventory-api/` に作り、アクティブ intent にして、
最初の stage を開始する — 前章で見た実行そのものである。

### 2 件目の作業を始める

ここでワークスペースが真価を発揮する。機能開発の途中で、無関係なバグに対応が
必要になったとしよう。何かをアーカイブしたり init コマンドを実行したりはしない —
新しい作業をそのまま記述する:

```
/aidlc Fix the timeout on the export endpoint
```

intent が既にアクティブなとき、AI-DLC はこれが現在の機能の続きではなく*新しい無関係な*
作業だと認識し、1 件目と並走する 2 件目の intent の開始を**提案**する:

```
▸ This looks like new work, separate from "inventory-api". Start a second intent?
  (1) Yes — start a second intent (scope: bugfix)
  (2) No — this continues the inventory-api work
```

- **Yes** を選ぶと、AI-DLC は 2 件目の intent（ここでは `bugfix`）を birth して
  そちらへ切り替え、最初の stage を始める。inventory-api の intent は無傷 —
  record dir・状態・進捗はすべて置いた場所にそのまま保たれる。
- **No** を選ぶと、AI-DLC はメッセージをアクティブ intent の一部として扱う。

AI-DLC が確認なしに 2 件目の intent を birth することはない。プロンプトが本当に
現在の作業のフォローアップ — gate への回答、要件の修正 — であればアクティブ intent に
留まり、提案が現れるのは作業が明確に別物のときだけである。

### intent 間の切り替え

space 内の intent を一覧し、名前（slug）で切り替える:

```
/aidlc intent                     List all intents in the active space
/aidlc intent export-bug          Switch the active intent to "export-bug"
```

切り替えは `active-intent` カーソルを動かす。次の `/aidlc` はその intent を
止まった場所から再開する — 同じ stage、同じ状態、同じ audit トレイル。intent は
いくつでも並行して持て、自由に行き来できる。それぞれが独立した実行である。

> 裸の `/aidlc intent` は読み取り専用 — 一覧するだけである。機械可読の出力には
> `--json` を足す。フラグの完全なリファレンスは [CLI コマンド](12-cli-commands.md) を
> 参照。

---

## Space — チームにつき 1 つ

**space** は 1 チームの完全な世界である: 自分の `memory/`（メソッド）、`knowledge/`、
`codekb/`、`intents/` を持つ。本章のここまでのすべては、自動で作成される
`default` という名の単一 space の中で起きていた。**ソロ開発者や単一チームなら、
話はここで終わりだ — space に名前を付けることはなく、すべてがそのまま動く。**

space は「複数のチームが 1 つのプロジェクトを共有し、それぞれが衝突なしに自分の
メソッド・ナレッジ・記録を持ちたい」場合のために存在する。チームの追加は純粋に
加算的で、同一形状の新しい `spaces/<name>/` が `default/` の隣に現れる —
何も移動せず、何も移行しない。

space の作成・一覧・切り替えは、intent の動詞を正確に映した動詞で行う:

```
/aidlc space                      List all spaces
/aidlc space create payments-team Create a new space, seeded from the framework baseline
/aidlc space switch payments-team Switch the active space to "payments-team"
```

古い `/aidlc space-create <name>` と裸の `/aidlc space <name>` の形も
引き続き受け付けられる。

新しく作られた space はフレームワークの既定メソッド（`org.md`）と、新品で空の
`team.md` / `project.md` practice ファイルから始まる — 新しいチームは他チームの
practices を継承するのではなく、自分の practices を自分で獲得する。`knowledge/` と
`codekb/` も空から始まる。

space を切り替えると、2 つのものがカーソルに自動追従する:

1. **AI-DLC 自身のリゾルバ** — 次に開始する intent と、エージェントが読み込む
   practices・ナレッジは、すべて切り替え先の space から来る。
2. **harness がコンテキストに読み込むルール** — 切り替えは harness ネイティブの
   ルール取り込み（Claude の `@`-import、Kiro CLI の resources または IDE の steering、Codex の rules dir）を
   新しい space の `memory/` に向け直すため、次のターンはそのチームのメソッドの下で動く。

`default` ではこの向け直しは no-op であり、単一チームのワークスペースがコミット済み
ファイルを揺らさないのはこのためである。

### いまどの space にいるかを知る

space が複数あるとき、ステータスラインがアクティブな `space · intent` を常設の
「現在地」として表示する — シェルプロンプトがカレントディレクトリを示すのと同じ —
ので、作業が誤った space に落ちることはない。単一チームのユーザーは `default` しか
持たないため、space トークンは一切表示されない。

---

## 1 つの intent に複数のリポジトリ

intent は単一リポジトリに限定されない。コードリポジトリはワークスペースの兄弟
（どれか 1 つの中に入れ子ではない）なので、intent は必要なだけのリポジトリに
またがれる。

リポジトリの集合は **intent の誕生時に**捕捉される — 追加で何かを打つことはない。
既定では AI-DLC がすべての兄弟リポジトリ（ワークスペースルート直下で自分の `.git` を
持つ子）を自動発見し、その集合を intent の `intents.json` 行に記録する。Construction では
各 git 操作が自動的に正しいリポジトリへアンカーされる。

```
my-project/
├── aidlc/          # the workspace
├── checkout-api/   # repo-a   ┐ both auto-discovered as siblings;
└── checkout-web/   # repo-b   ┘ an intent here can touch either or both
```

リポジトリを記録しない intent は、通常の単一リポジトリのケースである。record dir の
詳細は [成果物リファレンス](14-artifacts-reference.md)、用語集の
[Multi-repo intent](glossary.md) を参照。

### リポジトリ集合の宣言（任意のマニフェスト）

自動発見は、兄弟リポジトリが既にクローンされていることを前提とする。共有ワークスペースを
新規チェックアウトした直後はまだクローンされていないので、チームメイトはどのリポジトリを
どこにクローンすればよいかを知っている必要がある。ワークスペースルートに置く**任意の**
`repos.json` マニフェストがその期待される集合を記録し、1 コマンドで再現できるようにする:

```json
{
  "org": "your-github-org",
  "repos": [
    { "name": "checkout-api", "branch": "main" },
    { "name": "checkout-web" }
  ]
}
```

`org` は既定のクローン先ホストを与える（`url` を指定しないリポジトリは
`git@github.com:<org>/<name>.git` からクローンされる。エントリに `url` を設定すれば
上書きできる）。`branch` は新規クローン時のチェックアウト先を選び、既にディスク上にある
リポジトリに対しては助言的な期待値になる。省略した場合はリポジトリ自身の既定ブランチを
使う。リポジトリ名は安全な単一パスセグメントでなければならず、これはランタイムの
直下子発見モデルに合致する。[CLI コマンド](12-cli-commands.md#aidlc-workspace-sync-clone-and-reconcile-the-declared-repo-set)
ガイドは、このファイルを読んで不足しているリポジトリをクローンし、gitignore ブロックを
最新に保ち、VSCode マルチルートワークスペースを生成する `aidlc-workspace-sync` ツールを
説明している。

このマニフェストは便宜であり、第 2 の正となるものではない。**実行時はディスクが勝つ**:
intent の誕生は宣言の有無にかかわらず実際に存在する兄弟をすべて自動発見するので、
リポジトリは宣言されているかどうかにかかわらずクローンされた瞬間に機能し、クローンされて
いない宣言済みリポジトリは単にその集合の一部にならない。マニフェストが駆動するのは
sync ツールと、宣言済み集合とディスクが食い違ったときにそれを示す助言的な `--doctor` の
行だけである。（この「ワークスペースマニフェスト」は、パッケージングファイルである
harness の `manifest.ts` とは無関係である。）

---

## 何がコミットされ、何がされないか

`aidlc/` は git にチェックインされ、チームは作業を**共有**する — メソッド、intent
レジストリ、各 intent の状態・audit トレイル・成果物がリポジトリとともに移動する。
2 種類のファイルだけは意図的に **gitignore** される:

| gitignore（ユーザーごと・マシンローカル） | 理由 |
|---|---|
| `aidlc/active-space`、`…/intents/active-intent` | カーソル — 「いま自分はどこか」。コミットすると個人ごとのナビゲーションが共有リポジトリの状態になってしまい、intent の birth やカーソルの切り替えのたびにチームメイトが競合することになる。 |
| `…/intents/<id>/runtime-graph.json`、`.aidlc-*`、`aidlc/.aidlc-sessions/`、`aidlc/.aidlc-active-space-*.tmp` | 導出された、マシンローカルのランタイム状態。 |

space 配下のそれ以外すべて — `memory/**`、`knowledge/**`、`codekb/**`、
`intents.json`、各記録の `aidlc-state.md`、`audit/` シャード、成果物 — は
コミットされる。経験則: **カーソルとランタイムの一時物はローカル、共有する仕事は
コミット。**

---

## 次のステップ

- [Phase と Stage](04-phases-and-stages.md) — 1 つの intent の実行の中で何が起きるか
- [ナレッジ](08-knowledge.md) — space の `knowledge/` にチームの標準を足す
- [Rule と学習ループ](09-rules-and-the-learning-loop.md) — space の `memory/` メソッドの書き方と学ばれ方
- [成果物リファレンス](14-artifacts-reference.md) — intent 別 record dir の詳細
- [CLI コマンド](12-cli-commands.md) — `space` / `intent` 動詞の完全リファレンス
- [用語集](glossary.md) — Space・Intent・Record dir・Multi-repo intent の定義
```
