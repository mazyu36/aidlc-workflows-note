# Skill とランナーコマンド

**AI-DLC はコマンドの一族である。** `/aidlc` orchestrator の隣に、打ちやすい一語のランナーコマンド一式 — scope ごとに 1 つ、stage ごとに 1 つ、セットアップ用に 1 つ — が付いてくる。これらは orchestrator が既に公開しているスライスへの便利な扉であり、`/aidlc` だけでフレームワーク全体に届くし、フラグを飛ばして欲しい扉を直接打つこともできる。

> **Harness に関する注記。** 本章は Claude Code のサーフェス — `.claude/skills/` 配下の
> skill を、ピッカーから先頭 `/` で打つ — を使う。Kiro は同じランナー一式を
> `.kiro/skills/` に同梱し（同じく `/` で打つ）、Codex は `.agents/skills/` へ出荷して
> `$` で打つ（`$aidlc-bugfix`）。ランナーの*集合*と各々の役割は harness 間で同一で、
> 異なるのはディレクトリとプレフィクスだけである。[他の harness で動かす](harnesses/README.md) を参照。

---

## 多くの skill、1 つのエンジン

この実装が同梱するすべてのコマンドは `.claude/skills/` 配下の skill である。すべて同じ決定論エンジンを駆動し、違うのは開始前に何を焼き込むかだけである:

- **`/aidlc`** — 完全な orchestrator。フラグの焼き込みなし。scope を検出し（または作りたいものを記述し）、scope 内のすべての stage を完了まで駆動する。最も手が伸びるのはこれである。
- **scope ランナー** — `/aidlc-bugfix`、`/aidlc-feature`、`/aidlc-mvp`、`/aidlc-security-patch`。同じ完全なワークフローで、scope が固定され scope 検出がスキップされる。
- **stage ランナー** — `/aidlc-application-design`、`/aidlc-code-generation` ほか 27 個。1 つの stage を隔離して実行し、メインのワークフローには決して触れない。plugin 所有の stage は素の plugin プレフィクス付きコマンド名を使う（例: `/test-pro-integration`）。
- **`/aidlc-init`** — 最初の intent を 1 手で birth する（Initialization phase 全体を実行）。エンジンの自動 birth に対するオプトインのパッケージング。
- **セッションスキル** — `/aidlc-session-cost`、`/aidlc-replay`、`/aidlc-outcomes-pack`。ワークフローの読み取り専用ビュー。[セッション管理](11-session-management.md) で扱う。

ランナーができることはすべて `/aidlc` のフラグから届く。ランナーはパッケージングである — `/aidlc-bugfix` と打てて `/` メニューに見えるのは良いエルゴノミクスであり、それ以上ではない。全ランナーを消せばショートカットは消えるが、能力は残り、`/aidlc` のフラグから届く。

---

## scope ランナー — 問題クラスごとの名前付きの扉

scope ランナーは 1 つの scope を固定して完全なワークフローを駆動する。どの種類の仕事か既に分かっていて、scope 検出を飛ばしたいときに使う。

```
/aidlc-bugfix          Fix a specific bug — minimal depth, streamlined path
/aidlc-feature         Build a new feature — standard depth, all stages
/aidlc-mvp             Ship the core — skips late operations stages
/aidlc-security-patch  CVE / vulnerability response
```

それぞれ orchestrator に `--scope` を渡すのと同一である:

```
/aidlc-bugfix          ==  /aidlc --scope bugfix
/aidlc-feature         ==  /aidlc --scope feature
```

記述とフラグは `/aidlc` に渡すのとまったく同じように素通しできる:

```
/aidlc-bugfix The profile API returns 500 when display_name is null
/aidlc-feature --status
```

**ランナーを同梱するのはコア scope のうち 4 つだけ** — scope ファイルで `runner: true` の印が付いた、往来の多いものである。フレームワークは全部で 9 つの scope を定義しており（[Scope・Depth・テスト戦略](05-scopes-and-depth.md) を参照）、それ以外 — `enterprise`・`poc`・`infra`・`refactor`・`workshop` — は常に orchestrator から届く。plugin 所有の scope も `runner: true` を設定でき、そのランナーは素の plugin プレフィクス付き scope 名を使う（例: `/test-pro-validation`）。

```
/aidlc --scope enterprise
/aidlc --scope poc
```

ワークフローが始まると scope は `aidlc-state.md` に固定されるため、同じランナーの再実行はワークフローを再起動せず再開する。別の scope で走らせるには `/aidlc --scope <name>` を使う。

---

## stage ランナー — 1 stage だけ実行し、ワークフローには触れない

stage ランナーは**単一の stage を隔離して**実行する。stage の構成済みエージェントとレビュアーを使い、合成の完了を記録し、ワークフローの learnings も承認 gate も無しに停止する。メインワークフローの `Current Stage` を決して前進させない — その隔離はツール自身が強制する。

```
/aidlc-application-design
/aidlc-code-generation
/aidlc-requirements-analysis
/aidlc-reverse-engineering
```

それぞれ `/aidlc --stage <slug> --single` をパッケージしている:

```
/aidlc-code-generation    ==  /aidlc --stage code-generation --single
```

### 使いどころ

- **ワークフローにコミットせず、方法論の一片だけを適用する。** ある問題に要件分析はしたいが、ライフサイクル全体を駆動する準備はない。`/aidlc-requirements-analysis` を実行し、成果物を得て、止める。
- **自分が orchestrator になる。** 手作業で仕事の順序を決めていて、目の前の stage だけをフレームワークに実行させたい — 人間が運転し、フレームワークが方法論の 1 stage を供給する。
- **メインワークフローが別の地点に park している間に、stage を隔離して再実行する** — 単一 stage の実行はそれを乱せない。

### なぜ安全か

`--single` の不変条件はツールが強制する。単一 stage 実行は合成のワークフロー id の下に作業を記録し、メインワークフローの `Current Stage` への書き込みを拒否する。ランナーがメインのポインタを前進させようとしたら、エンジンは代わりにエラーを返す。エンジンが保証するため、ドキュメントが間違っていてもこの安全性は保たれる。

3 つのブートストラップ **initialization** stage には stage ランナーが無い — intent を半分だけ birth することに独立した意味が無いからだ。代わりに initialization phase 全体が 1 つのコマンドとしてパッケージされている:

```
/aidlc-init [--scope <name>] [description]   birth the first intent (== running /aidlc on a fresh workspace)
```

---

## ランナー各族の一覧

| 族 | 例 | すること | orchestrator での等価 |
|---|---|---|---|
| Orchestrator | `/aidlc` | 完全なワークフロー。scope は検出 | — |
| scope ランナー | `/aidlc-bugfix`、`/aidlc-feature`、`/aidlc-mvp`、`/aidlc-security-patch` | 完全なワークフロー。scope 固定・検出なし | `/aidlc --scope <name>` |
| stage ランナー | `/aidlc-application-design`、`/aidlc-code-generation`、…（計 29） | 1 stage を隔離実行。ワークフローを決して前進させない | `/aidlc --stage <slug> --single` |
| init ラッパー | `/aidlc-init` | 最初の intent を birth（Initialization を実行） | 新しいワークスペースでの `/aidlc` |
| セッションビュー | `/aidlc-session-cost`、`/aidlc-replay`、`/aidlc-outcomes-pack` | 読み取り専用のワークフローレポート | [セッション管理](11-session-management.md) を参照 |

実行可能なライフサイクルの各 stage につき stage ランナーが 1 つある。完全な一覧は skills ディレクトリを見る:

```bash
ls .claude/skills/
```

---

## 自分のランナーを作る — stage ファイルを書く

フレームワークをカスタマイズするなら、ここが肝心である: **ランナーは手で書かない。** コンパイル済み stage グラフと scope ファイルから生成される。

stage ランナーを足すには、stage を足す。stage ファイルを書き、グラフを再コンパイルし、再生成する:

```bash
bun .claude/tools/aidlc-runner-gen.ts write
```

ジェネレータはコンパイル済み stage リスト（唯一の正）を読み、実行可能な stage ごとにランナーシェルを出力する。新しい stage の `/aidlc-<your-stage>` コマンドは自動で現れる — 書くべきランナーファイルも、コピーする定型文も無い。scope ランナーも、frontmatter が `runner: true` を宣言する scope について同じように動く。`scopes --all` はすべての scope ファイルのランナーを出力する。

```bash
bun .claude/tools/aidlc-runner-gen.ts scopes      # generate scope-runners
```

ランナー一式は手で維持されるのではなく導出されるため、カバーする stage や scope からドリフトできない。ディスク上の集合が正から乖離した瞬間、2 つのチェックが CI を落とす:

```bash
bun .claude/tools/aidlc-runner-gen.ts check            # stage-runner drift
bun .claude/tools/aidlc-runner-gen.ts scopes --check   # scope-runner drift
```

再生成されないままグラフに足された stage — あるいは消えた stage の孤児ランナー — は diff とともに大きく失敗する。stage ファイルを足して再生成することが執筆経路のすべてであり、ランナーはジェネレータが維持する帰結として付いてくる。

stage ファイルの書き方の実際は [カスタマイズ](13-customization.md) と [Phase と Stage](04-phases-and-stages.md) を参照。エンジン・directive の契約・ランナーシェルが内部で `next`/`report` をどう駆動するかは、リファレンスの [Skill システム](../reference/17-skill-system.md) の章を参照。

---

## クイックリファレンス

```
# Full workflow
/aidlc                              detect scope, run everything
/aidlc --scope enterprise           any of the 9 scopes

# Scope-runners (the 4 high-traffic doors)
/aidlc-bugfix · /aidlc-feature · /aidlc-mvp · /aidlc-security-patch

# One stage, isolated (never advances your workflow)
/aidlc-code-generation              == /aidlc --stage code-generation --single

# Birth the first intent (Initialization phase)
/aidlc-init [--scope <name>]        == /aidlc on a fresh workspace

# Add your own: write a stage/scope file, then
bun .claude/tools/aidlc-runner-gen.ts write
bun .claude/tools/aidlc-runner-gen.ts scopes
```

参照: [CLI コマンド](12-cli-commands.md) · [Scope・Depth・テスト戦略](05-scopes-and-depth.md) · [カスタマイズ](13-customization.md)
