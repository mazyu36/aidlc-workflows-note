# コントリビューション

## 概要

この実装へのコントリビューションを歓迎する。本ガイドは、前提条件、開発ワークフロー、テスト、そして変更の提出方法を扱う。

> **パス規約。** 以下の `<record>/` = 生まれた intent の record dir、
> `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` — intent ごとの state、audit
> シャード、knowledge、成果物が住む場所である。

## 前提条件

- **Claude Code** -- ネイティブインストール（推奨、自動更新）: macOS/Linux/WSL は `curl -fsSL https://claude.ai/install.sh | bash`; Windows PowerShell は `irm https://claude.ai/install.ps1 | iex`。あるいは `brew install --cask claude-code`。（[Claude Code docs](https://code.claude.com/docs/en/quickstart) を参照）
- **bun** -- すべての CLI ツールと 16 個すべての hook に必須。`curl -fsSL https://bun.sh/install | bash` でインストールする。Windows では: `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 | iex"`。非対話シェルでは PATH 上に在る必要がある（zsh は `~/.zshenv`、bash / Windows の Git Bash は `~/.bashrc`）。
- **timeout**（GNU coreutils）-- LLM テストのタイムアウト（L2/L3）のためにテストスイートが必要とする。Linux にはプリインストール済み。macOS: `brew install coreutils` の後、gnubin を PATH に足す: `export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"`（`~/.zshenv` または `~/.zshrc` で）。
- **Bash** -- POSIX 互換ラッパー（`tests/run-tests.sh`）向けに任意。主要なテストランナーは `bun tests/run-tests.ts` である; 実行時には、配布される hook のいずれも Bash を必要としない。
- **Bedrock access** -- ライブの integration および e2e テスト（L2/L3）を走らせるのに必須。L1 の protocol テストには不要。

clone 後、packager、type checker、テストが使う、ピン留めされた開発依存関係をインストールする:

```bash
bun install --frozen-lockfile
```

## リポジトリ構成

```
core/                # Hand-authored, harness-neutral source (tools, stages, agents, rules, knowledge, hooks)
harness/<name>/      # Per-harness authored surfaces; claude/, kiro/, kiro-ide/, codex/, opencode/, copilot/
scripts/package.ts   # The build: regenerates dist/<harness>/ from core/ + harness/ (`--check` drift-guards it)
scripts/build-binaries.ts # Release-only compiled CLI artifacts in ignored build/binaries/ after package --check
dist/<harness>/      # GENERATED: dist/claude/, dist/kiro/, dist/kiro-ide/, dist/codex/, dist/opencode/, dist/copilot/ — never hand-edit
tests/               # All-TypeScript test suite (t*.test.ts, run via bun)
docs/                # Documentation
  guide/             # User guide (how to use AI-DLC)
  harness-engineering/  # Harness engineer guide (configure AI-DLC without code)
  reference/         # Developer reference (how it works internally)
```

完全なアーキテクチャは [reference/01-architecture.md](01-architecture.md) を参照。

## 開発ワークフロー

1. **Fork してブランチを切る** — `main` から。その後 `bun install --frozen-lockfile` を走らせる
2. **アーキテクチャを読む** -- [reference/01-architecture.md](01-architecture.md) は実行モデル、agent 委譲、hook システムを説明する
3. **エントリポイントを理解する** -- 決定論的な engine `core/tools/aidlc-orchestrate.ts`（正確に 4 つのサブコマンド: `next`、`continue`、`report`、`park` を持ち、`continue` は内部の steering 用トランスポート）がルーティングを所有する; conductor `harness/claude/skills/aidlc/SKILL.md` は、その directive に基づいて動作する薄い転送ループである。規範的な engine / directive / conductor / swarm の契約は [The Skill System](17-skill-system.md) を参照
4. **変更を加える** -- `core/` の harness 中立なソース（tools、stages、agents、hooks、rules、knowledge）、または `harness/<name>/` の harness サーフェス（orchestrator skill、settings）を編集する。その後 `bun scripts/package.ts` を走らせて `dist/` を再生成する — `dist/` を決して手で編集しないこと。drift guard（`package.ts --check`）が CI を失敗させる
5. **テスト** -- 提出前に `bun tests/run-tests.ts` を走らせる
6. **提出** -- `main` に対して PR を開く

リリースのバイナリ成果物は `dist/` の一部ではなく、packager によって生成されない。`bun scripts/package.ts --check` がクリーンになった後、ネイティブ成果物には `bun scripts/build-binaries.ts` を走らせるか、リリースマトリクスには `--all-targets` を足す。このスクリプトは各実行ファイルを `build/binaries/<target>/` の下に書き、そのターゲットの `runtime/<harness>/` ディレクトリの下に完全な生成ディストリビューションをステージし、`build/binaries/` に `build-results.json` を書く。ネイティブ gate は、`PATH` 上に `bun` 実行ファイルが無い状態で、sensor、グラフコンパイル、検証、生成サーフェスのチェック、plugin の選択/合成、オーケストレーション、Bolt/Swarm の合成、パッケージ済みランタイムの不変性、hook、statusline、アダプタ、明示的なプロジェクトルーティングを走らせる。ステージされた `runtime/<harness>/` ツリーは読み取り専用のフォールバックである; 変更を伴うコマンドは、インストール済みのプロジェクト harness を対象にしなければならない。失敗した gate はどれもビルドを失敗させる。

## テスト

テストスイートは完全に TypeScript（`t*.test.ts`、`bun` 経由で走る）で、4 つのレベル — `smoke`、`unit`、`integration`、`e2e` — にわたり、3 層ピラミッド（smoke + unit = L1 Protocol、integration = L2 Stage、e2e = L3 Acceptance）に対応する。ピン留めされた開発依存関係がインストールされた後、L1 は外部サービス無しでローカルに走る; ライブの integration および e2e ファイルは `claude` CLI ツール（および Bedrock 資格情報）を必要とし、それが無いときはきれいにスキップする。

**クイックリファレンス:**

```bash
# L1 Protocol -- runs in seconds, no dependencies
bun tests/run-tests.ts

# L2 Stage -- CI pipeline (requires claude CLI tool)
bun tests/run-tests.ts --ci

# L3 Acceptance -- release gate (requires claude CLI tool)
bun tests/run-tests.ts --release

# POSIX compatibility wrapper
bash tests/run-tests.sh --ci

# Individual levels
bash tests/run-tests.sh --smoke        # File structure validation
bash tests/run-tests.sh --unit         # Hook behavior, stage content
bash tests/run-tests.sh --integration  # Cross-component and stage/CLI tests
bash tests/run-tests.sh --e2e          # Workflow, worktree, and terminal journeys
```

完全なテスト戦略、スタブ、新しいテストの追加方法は [reference/09-testing.md](09-testing.md) を参照。

## Utility ハンドラの追加

> **audit イベントを足す前に**、[State Machine](12-state-machine.md) を読むこと。この章はタクソノミ内のすべてのイベント、その emitter、そして「same-commit rule」を列挙する — コードとその章の表を同じ PR で更新すること。さもなければ drift テストが失敗する。

Utility ハンドラは 2 つのカテゴリに分かれる:

### 決定論的ハンドラ（推奨）
LLM の推論を必要としないハンドラ（テキストを出力する、ファイルを読む/整形する、前提条件をチェックする、ディレクトリを作成する）向け:
1. `core/tools/aidlc-utility.ts` にサブコマンドを足す
2. SKILL.md から単一の Bash 呼び出しでディスパッチする: `bun .claude/tools/aidlc-utility.ts <subcommand>`
3. タスクトラッキングは不要 -- スクリプトは 1 秒未満で走る
4. audit ログ記録は、`aidlc-audit.ts` の `appendAuditEntry` 経由でスクリプト内で処理する（`**Event**:` の markdown ブロックを決して手書きしない）
5. verb を `aidlc-utility` の usage 文字列に足す。それが生成される SKILL.md リージョンをレンダリングするなら、対応する `--check` guard もこの章に文書化する。

`--help`、`--version`、`--status`、`--doctor` の各ハンドラはリファレンス実装である。`--doctor` は `--export`（任意の `--output <dir>` 付き）も受理し、これは新規の doctor パスを走らせてから、小さくリダクトされた診断レポートを書く; 共有の `DoctorFinding` モデルとレポート組み立てロジックは `core/tools/aidlc-doctor-bundle.ts` に住むので、ライブのレポートとエクスポートされたレポートは 1 つの findings 集合から引く。

`codekb-path` ハンドラは読み取り専用の **直接 utility verb** である: stage の散文は `/aidlc codekb-path` ではなく `bun <harness-dir>/tools/aidlc-utility.ts codekb-path` を起動する。これは audit イベントを一切発せず、SKILL.md のタスクトラッキングを一切駆動せず、ディレクトリ（`mkdir`）を一切作成しない。これは単に、reverse-engineering stage が成果物を書き込む正規のリポジトリごとの codekb ディレクトリを出力するだけなので、散文はそのパスを決して手で導出しない。

### LLM 駆動ハンドラ
agent の推論から恩恵を受けるハンドラ（ファイルシステムの走査、意思決定）向け:
1. **タスクトラッキング** -- 各論理ステップについて `TaskCreate` でタスクを作成し、作業が進むにつれて `TaskUpdate`（`in_progress` -> `completed`）でそれらを遷移させる。これが Claude Code のタスクサイドバーを駆動する。
2. **Statusline の更新** -- アクティブな intent の `aidlc-state.md` が存在するなら、走っている utility を記述するように `Current Stage` を一時的に設定し（例: `running health check`）、完了時に元の値へ復元する。`aidlc-statusline.ts` hook はターミナルのステータスバー向けにこのフィールドを読む。
3. **audit ログ記録** -- 適切なツールのサブコマンド（例: 内部で `appendAuditEntry` を呼ぶ `bun .claude/tools/aidlc-utility.ts <handler>`）を起動する。`**Event**:` の markdown ブロックを LLM の散文から決して手書きしない — [State Machine: Forbidden patterns](12-state-machine.md) を参照。

`intent-create` ハンドラは完全に決定論的である: 3 つの init stage すべて（workspace-scaffold、workspace-detection、state-init）が単一の `aidlc-utility intent-create` 呼び出しの内側で走る。ウェルカムメッセージは `settings.json` の `companyAnnouncements` 経由でセッション開始時にレンダリングされ、stage ではない。

## Scope の追加

scope は、ファイル（そのアイデンティティ）に加えて stage ごとのメンバーシップタグとして著述される。アイデンティティは `core/scopes/aidlc-<name>.md` に住む; メンバーシップは `core/aidlc-common/stages/` の下の各 stage の frontmatter `scopes:` リストに住む。`init`、`scope-change`、`resolve-env-scope`、`doctor`、そして state ツーリングにわたる検証ロジックは、有効な scope のリストを、`core/tools/aidlc-lib.ts` の `validScopes()` 経由で実行時に `.claude/scopes/*.md` ファイルから導出する; EXECUTE/SKIP グリッドは各 stage の `scopes:` リストの転置であり、`tools/data/scope-grid.json` にコンパイルされる。scope の追加に TypeScript の編集は不要である。

### 手順

1. **`core/scopes/aidlc-hotfix.md` を作成する** — scope のアイデンティティ。frontmatter:
   - `name`（必須）: scope 名; ファイル名の語幹に等しくなければならない。
   - `depth`（必須）: `Minimal` | `Standard` | `Comprehensive`。
   - `keywords`（任意）: `/aidlc <freeform text>` 自動検出のための NL トリガ。単語境界でマッチし、アルファベット順 scope でタイブレークする。空リストは推論からオプトアウトする。
   - `description`（任意）: `/aidlc --help` と SKILL.md のコンパイル済み scope-table でレンダリングされる 1 行の要約。
   - `testStrategy`（任意）: depth から独立して test strategy をオーバーライドする（例: workshop には `Minimal`）。既定では depth に一致する。
   - `review_cap`（任意）: `adversarial` | `advisory` | `none`。この scope の stage review クラスを cap する; 不在は scope レベルの引き下げが無いことを意味する。cap はクラスを下げることはできるが、決して上げることはできない。自律的な swarm review は免除される。
   - `runner`（任意）: 既定の生成 runner 集合に scope を含めるには `true` に設定する。
   - `freeform_default`（任意）: 望ましい core の既定（`feature`/`poc`）が有効でないとき、この scope を指名するには `true` に設定する。有効な scope のうち最大 1 つだけがそれを主張でき、グラフのコンパイルは曖昧な選択済み plugin 集合を却下する。未知の明示的な `AWS_AIDLC_DEFAULT_SCOPE` 値は依然として検証に失敗する。

   本体は散文の intent である — 「なぜこれらの stage か、なぜそれらをスキップするか」。`validScopes()` は `.claude/scopes/*.md` の存在から導出するので、ファイルが着地した瞬間に scope は有効になる。構造的な問題を捕らえるには、編集後に `/aidlc --doctor` を走らせる。

   ```yaml
   ---
   name: hotfix
   depth: Minimal
   keywords:
     - hotfix
     - urgent
   description: Urgent production fix
   runner: true
   ---

   # hotfix scope

   Lean path for the urgent production patch — regression test and deploy, nothing else.
   ```

2. **メンバー stage にタグ付けする** — `hotfix` の下で走るべき各 stage（`core/aidlc-common/stages/<phase>/` の下）で、その frontmatter `scopes:` リストに `hotfix` を足す。タグ付けしない stage はその scope で `SKIP` になる。3 つの初期化 stage（`workspace-scaffold`、`workspace-detection`、`state-init`）はそれを含まねばならない — それらは常に走る。

3. **再コンパイル + scope-table を再生成する** — `bun .claude/tools/aidlc-graph.ts compile` が `scopes:` タグを `tools/data/scope-grid.json` に転置する。次に `bun .claude/tools/aidlc-utility.ts scope-table` が、SKILL.md のコンパイル済み scope テーブル向けの正規の Markdown リージョンを出力する。リージョンを `<!-- BEGIN: compiled ... -->` / `<!-- END: compiled ... -->` マーカーの間で生成された状態に保ち、その後 `bun .claude/tools/aidlc-graph.ts compile --check` と `bun .claude/tools/aidlc-utility.ts scope-table --check` を走らせて exit 0（drift 無し）を確認する。

4. **scope が解決することを検証する** - `bun core/tools/aidlc-utility.ts intent-create --scope hotfix --project-dir /tmp/scope-smoke` は成功し、`Scope: hotfix` を持つ state ファイルを生成するはずである。

5. **`doctor` がそれを env の既定として受理することを検証する** — `AWS_AIDLC_DEFAULT_SCOPE=hotfix bun aidlc-utility.ts doctor` は env var を有効と報告するはずである。

6. **keyword 推論を検証する**（`keywords` が populate されている場合）— `bun aidlc-utility.ts detect-scope --from-text --input "urgent customer issue" --project-dir /tmp/scope-smoke` は `{"scope":"hotfix","source":"keyword","matches":["urgent"]}` を返すはずである。

7. **plan の一致を検証する（任意だが推奨）** — `AIDLC_GRAPH_RESOLVE=1 bun .claude/tools/aidlc-graph.ts resolve hotfix --stdout` が scope の plan を発する; EXECUTE 集合がタグ付けしたものに一致することを目視する。

8. **scope を意識したドキュメントを更新する** — `docs/guide/05-scopes-and-depth.md`（完全な scope リファレンス。scope 別 stage マトリクスを含む — そのセルはコンパイル済み `scope-grid.json` に対して `tests/unit/t244-scope-matrix-doc-sync.test.ts` で drift ガードされている）、`docs/guide/13-customization.md`（有効値のリストと scope テーブル）、`docs/reference/03-orchestrator.md`（scope から stage へのマッピング）はすべて scope を明示的に列挙する。本章末尾のドキュメントポリシーに従い、同じ PR で更新する。

9. **scope ルーティングのワークフローテストを足す** — scope が既存の scope と異なる振る舞い（新しい phase スキップパターン、新しい depth の組み合わせ）を持つなら、`tests/e2e/t53.test.ts`（sdk scope ルーティング）または `tests/e2e/t-tui-t50-bugfix-scope.serial.test.ts`（tui scope の通し）を手本にしたルーティング済み journey テストを足す。

### 自動で検証されるもの

- `validScopes().has("hotfix")` は `.claude/scopes/aidlc-hotfix.md` ファイルが着地した瞬間に `true` を返す — すべての検証サイトがこのヘルパーを使う。
- エラーメッセージは、いかなるコード変更も無しに、新しい scope をアルファベット順で列挙する。
- `/aidlc --doctor` は `AWS_AIDLC_DEFAULT_SCOPE=hotfix` を有効として扱う。
- 進行中のワークフローに対する `aidlc-utility scope-change --scope hotfix` は、新しい scope を受理する。
- 転置 drift guard: stage の `scopes:` タグが `scope-grid.json` を再コンパイルせずに編集された場合、`aidlc-graph compile --check` がビルドを失敗させる。SKILL.md のコンパイル済み scope-table は独自の `--check` drift guard を持つ（t67）。
- フリーフォームの `/aidlc <text>` 起動に対する keyword 検出は、各 scope の `keywords` をその `.claude/scopes/*.md` frontmatter から読む。独自の NL トリガを持つカスタム scope は、`keywords` リストが populate されるとすぐに自動検出される（SKILL.md の変更は不要）。ユーザーは依然として `--scope hotfix` を明示的に渡して推論をバイパスできる。

### 自動で検証されないもの

- scope 名をタイポした `scopes:` タグでも依然としてコンパイルされる — それは単に誰も求めないグリッド列を生み、その stage を本物の scope から静かに落とすだけである。`/aidlc --doctor` と scope ごとのテストがガードレールである。
- Stage スキップのセマンティクス（`PHASE_SKIPPED` イベント）。`tests/integration/t39.test.ts` は 9 個の既知の scope 名を scope ごとのループにハードコードする — 新しい scope は、そのリストが拡張されるまで実行されない。同じ PR の一部として、新しい scope をそのループに足す。

## Stage の追加

stage は、`core/aidlc-common/stages/<phase>/<slug>.md` の下に YAML frontmatter 付きの Markdown ファイルとして著述される。コンパイラは frontmatter を `tools/data/stage-graph.json` に読み込み、runner ジェネレータは core stage についてコンパイル済み stage リストからタイプ可能な `/aidlc-<slug>` skill を発する（plugin 所有の stage は、その裸の plugin プレフィックス付き slug を使う）。拡張性の契約は「stage を足すには、stage ファイルを書く」である — engine はコンパイル済みグラフからルーティングするので、それを登録するのに engine の編集は不要である。（完全なフィールドリファレンスと 3 区画の本体フォーマットは、Harness Engineer Guide の [Anatomy of a Stage](../harness-engineering/01-anatomy-of-a-stage.md) と [Adding a Stage](../harness-engineering/02-adding-a-stage.md) に住む; スキーマは [Stage Definition](15-stage-definition.md) である。）

### 手順

1. **stage ファイルを書く** - `core/aidlc-common/stages/<phase>/<slug>.md` を作成する。frontmatter は次を宣言する: `slug`、`phase`、`execution`/`condition`、`lead_agent` と任意の `support_agents`（agent slug で）、`mode`（`inline`、`subagent`、`pipeline`、または `mob`; `agent-team` は予約済みでまだ未実装）、`consumes` / `produces`（artifact vocabulary 名）、stage が unit ごとに条件付きでのみ書く成果物向けの `optional_produces`（unit ごとのカバレッジから免除）、`requires_stage`（順序エッジ）、`scopes:` メンバーシップリスト、束ねる任意の `sensors:`、Unit ごとに反復するなら `for_each`、そして（unit ごとの stage では）produces 成果物を各 Unit の kind に刈り込む任意の `produces_kinds` マップ。本体は stage の 3 区画を運ぶ。完全なフィールド契約は [Stage Definition](15-stage-definition.md) を参照。

2. **グラフを再コンパイルする** — `bun .claude/tools/aidlc-graph.ts compile` が新しい frontmatter を `tools/data/stage-graph.json` に読み込み、`scopes:` タグを `tools/data/scope-grid.json` に転置する。`bun .claude/tools/aidlc-graph.ts compile --check` を走らせて exit 0（drift 無し）を確認する。次に `bun .claude/tools/aidlc-utility.ts stage-table` と `bun .claude/tools/aidlc-utility.ts scope-table` で生成された SKILL.md のミラーをリフレッシュし、`bun .claude/tools/aidlc-utility.ts stage-table --check` と `scope-table --check` の両方が exit 0 になることを確認する。stage は `bun .claude/tools/aidlc-orchestrate.ts next --stage <slug> --single` 経由で直ちに実行可能である。

3. **runner を再生成する** — `bun .claude/tools/aidlc-runner-gen.ts write` が実行可能なコンパイル済み stage ごとに `/aidlc-<slug>` runner skill を発するので、新しい stage は手作業の著述無しにそのタイプ可能なコマンドを得る。`bun .claude/tools/aidlc-runner-gen.ts check` を走らせて、ディスク上の runner 集合がコンパイル済み stage 集合に一致することを確認する（drift guard; bootstrap の初期化 stage は設計上除外される）。

4. **stage がルーティングされることを検証する** — その stage を scope に含むワークフローに対して `bun .claude/tools/aidlc-orchestrate.ts next` を駆動し、engine が、解決された `lead_agent`、gate、`consumes`、`produces` とともにあなたの slug を名指す `run-stage` directive を発することを確認する。

5. **scope を意識した・stage を意識したドキュメントを更新する** — 新しい stage は stage 数と scope ごとの plan を変える。`docs/guide/05-scopes-and-depth.md`（scope 別 stage マトリクス — そのセルは `tests/unit/t244-scope-matrix-doc-sync.test.ts` で drift ガードされている）、`docs/reference/16-artifact-vocabulary.md`（初期化以外の stage 数）、Harness Engineer Guide の stage の章、そして plan を列挙する任意の scope リファレンスを更新する。本章末尾のドキュメントポリシーに従い、同じ PR で行う。

6. **テストを足してカバレッジをリフレッシュする** — stage の振る舞いのための `t*.test.ts` を著述する（スイートは発見されるので、正しいレベルのディレクトリの下にファイルを落とすことがランナーに必要なすべてである — 足すべきレジストリ行は無い）。次に `bun tests/gen-coverage-registry.ts` でカバレッジインデックスを再生成し、`bun tests/gen-coverage-registry.ts --check` がクリーンであることを確認する。stage-runner drift guard `tests/unit/t129-stage-runner-drift.test.ts` は、生成された runner 集合がコンパイル済み stage 集合に等しいことをアサートし、`tests/integration/t55-test-suite-drift.test.ts` は古いパスとマーカーを掃引する。

### 自動で検証されるもの

- **グラフ配置。** いったん `compile` すると、stage のエッジ（`requires_stage`、`consumes`、`produces`）が解決され順序付けられる; ディスク上の `stage-graph.json` が frontmatter から drift すると、`compile --check` がビルドを失敗させる。
- **生成される stage テーブル。** SKILL.md の Stage Graph テーブルはコンパイル済みの `stage-graph.json` からレンダリングされる; 生成されたリージョンが drift すると `aidlc-utility stage-table --check` が失敗する（t32）。
- **スキーマ + 参照。** `aidlc-graph.ts compile` は `aidlc-stage-schema.ts` 経由ですべての stage の frontmatter を検証し、`/aidlc --doctor` は `validateStageFrontmatter` に加えて、すべての `lead_agent` / `support_agents` / `consumes` slug が解決するという「Graph references」チェックを再実行する。
- **Runner の一致。** コンパイル済み stage に runner が無い、または消えた stage に runner が存在する場合、`aidlc-runner-gen.ts check`（および `t129`）が失敗する。

### 自動で検証されないもの

- **コンパイラが認識しない新しい frontmatter キー。** スキーマが実装しないキーを欲することはフレームワークの変更である: それはデータを読むコードを編集するので、このレシピではなく engine / compile パイプラインの経路をたどる。[Stage Definition](15-stage-definition.md) の予約キー名前空間は、将来の構造的拡張が予測可能に着地するために存在する。
- **ドキュメントの列挙。** `docs/` にわたる stage 数と scope ごとの plan テーブルは手で保守される; 同じ PR で更新する（下記のドキュメントポリシーを参照）。

## Agent の追加

Agent のメタデータ（display name、example の knowledge ファイル）は、`core/agents/` の下の各 agent の `.md` frontmatter から読まれる。`core/tools/aidlc-lib.ts` の `loadAgents()` ヘルパーは、そのディレクトリ内のすべての `.md` ファイルを発見し、statusline hook が消費する（display name をレンダリングするための）メタデータマップを導出する。agent の追加に TypeScript の編集は不要である。

### 手順

1. **agent ファイルを作成する** — 必須の frontmatter を持つ新しい `core/agents/<slug>-agent.md` を落とす:

   ```yaml
   ---
   name: <slug>-agent
   display_name: <Human-Readable Name>
   examples:
     - example-knowledge-file-one.md
     - example-knowledge-file-two.md
   description: >
     One-paragraph description of the agent's responsibilities and which stages it leads or supports.
   disallowedTools: Task
   tier: judgment
   ---
   ```

   `name` フィールドはファイル名の語幹に正確に一致しなければならない。`display_name` は statusline が使う人間向けのラベルである。`examples` は、agent→examples テーブルに文書化された推奨 knowledge ファイル名を列挙する — それらはユーザーへの提案であり、実行時にロードされず、ディスクにも書かれない。`tier`（`judgment` | `balanced` | `templated`）は、packager が各 harness の model/effort キーに投影する著述用のダイヤルである — core frontmatter に生の `model:`/`effort:` を決して著述しない（[Agent System](05-agent-system.md) を参照）。

2. **agent が発見されることを検証する** — `bun -e "import { loadAgents } from 'core/tools/aidlc-lib.ts'; console.log(loadAgents().find(a => a.slug === '<slug>-agent'));"` は新しい agent のメタデータを出力するはずである。

3. **intent birth が space の knowledge ディレクトリを作成することを検証する** — `bun core/tools/aidlc-utility.ts intent-create --scope poc --project-dir /tmp/agent-smoke` は、空の space レベルの `aidlc/knowledge/` ディレクトリ（space の `intents/` の兄弟）を作成するはずである。Birth は agent ごとのサブディレクトリや README をシードしない — チームは、コンテンツができたときに `aidlc/knowledge/<slug>-agent/` 自体を作成する。

4. **statusline がレンダリングされることを検証する** — `Active Agent: <slug>-agent` を持つ state ファイルをシードし、statusline hook を起動する; 出力は `--` セパレータの後に display name を含むはずである。

5. **agent を stage に配線する** — stage をリードまたはサポートすべき新しい agent は、各 stage の frontmatter、すなわち `core/aidlc-common/stages/<phase>/` の下の stage `.md` ファイルの `lead_agent` / `support_agents` フィールドで名指される。次に `bun .claude/tools/aidlc-graph.ts compile`（および drift guard としての `compile --check`）を走らせて、その frontmatter から `tools/data/stage-graph.json` を再生成する。`stage-graph.json` を手で編集しないこと — それはコンパイル済みの成果物であり、次の `compile` が手作業の変更を上書きする。これは発見とは別である — `loadAgents()` は agent を可視にする; stage frontmatter（グラフにコンパイルされる）がそれをアクティブにする。

### 自動で検証されるもの

- `loadAgents()` は、次の起動時に `.claude/agents/` 内の任意の新しい `.md` ファイルを発見する — コード編集は無い。
- `name` または `display_name` が欠けている場合、parser はファイルと欠けているフィールドを名指して投げる。
- agent は slug でアルファベット順にソートされて返されるので、任意のプラットフォームでの `readdirSync` の順序は同じ出力を生む。
- Intent birth は空の space レベルの `aidlc/knowledge/` ディレクトリを作成する（agent ごとのサブディレクトリや README はシードしない）。
- Statusline のレンダリングは、同じメタデータソースから display name を導出する。
- `tests/unit/t61.test.ts` は、fixture agent に対して 5 つの性質すべてを end-to-end でアサートする。

### 自動で検証されないもの

- **Stage-graph への参加**。Stage frontmatter は、その `lead_agent` / `support_agents` フィールドで slug によって agent を参照し、`aidlc-graph.ts compile` がそれらを `stage-graph.json` に運ぶ。どの stage の frontmatter でも名指さずに新しい agent を足すことは、agent は存在するが決して走らないことを意味する。Stage-graph のスキーマ検証（`core/tools/aidlc-stage-schema.ts`）は配線済みである: `aidlc-graph.ts compile` はすべての stage の frontmatter を検証し（そして `compile --check` が CI の drift guard である）、`/aidlc --doctor` は同じ `validateStageFrontmatter` に加えて、すべての `lead_agent` / `support_agents` slug が解決するという「Graph references」チェックを再実行する。
- **Knowledge ファイルの存在**。`examples` は、agent→examples テーブルに文書化された推奨ファイル名のリストである — それらは作成も検証もされない。ユーザーは実際のコンテンツを `aidlc/knowledge/<agent>/`（space レベルの knowledge dir）に置く。
- **agent を列挙する doc テーブル**。`docs/reference/05-agent-system.md:119-131` の Phase Participation マトリクスと、`core/knowledge/aidlc-shared/knowledge-readme-template.md:16-29` の agent→examples テーブルは手で保守される。agent を足すのと同じ PR でそれらを更新する（下記のドキュメントポリシーを参照）。
- **`.claude/agents/<new-agent>.md` の本体コンテンツ**。frontmatter だけがパースされる。本体の散文（Core Responsibilities、Knowledge Loading シーケンス、等）は、アクティブ化されたときに agent 自身によって読まれる — 既存の agent ファイルの構造に合わせて書く。

## ドキュメントポリシー

ファイル、ディレクトリ、コマンド、またはフラグを追加・削除・リネームするとき:

1. `docs/` と `README.md` を古い参照について grep する
2. すべての参照を同じコミットで更新する

## 変更の提出

1. 何が変わったか・なぜかを明確に記述して、`main` に対して PR を開く
2. L1 テストが通ることを確認する: `bash tests/run-tests.sh`
3. hook の変更には: `bash tests/run-tests.sh --unit` を走らせる
4. integration テストには: `bash tests/run-tests.sh --integration` を走らせる（`claude` CLI ツールが必要）
5. 変更がファイル、コマンド、またはフラグに影響する場合はドキュメントを更新する（上記のドキュメントポリシーを参照）
