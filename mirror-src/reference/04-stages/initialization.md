# Initialization Phase の Stage（0.1-0.3）

## Phase 概要

Initialization phase は AI-DLC ワークフローの 5 つの phase のうちの最初である。stage 0.1 から
0.3 を走らせ、**intent を誕生させる**。その record dir を
`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`（以下 `<record>/` と書く）に、状態ファイル、
in-scope の phase ごとに 1 つのディレクトリ、workspace 分類、ルーティング設定とともに鋳造する。
別個の scaffold コマンドは無い: workspace shell は `dist/<harness>/` に事前ビルドされて出荷され、
エンジンは最初の `/aidlc`（または何をビルドするかを記述したとき）で最初の intent を自動誕生
させる。

この phase の 3 つの stage すべてが、すべての scope に対して実行される — 条件付きの stage は
無い。すべての stage は承認 gate 無しで auto-proceed する。

ウェルカムメッセージはセッション開始時に `settings.json` の `companyAnnouncements` エントリを
介してレンダリングされる。それは stage ではない — stage ファイルも、audit イベントも、
チェックボックスも無い。

3 つの stage すべては、1 秒を十分に下回って完了する単一の決定論的な
`bun .claude/tools/aidlc-utility.ts intent-create --scope <scope>` 呼び出しの内側で走る。
conductor は可観測性のためにサイドバーに 3 つの task（Workspace Scaffold、Workspace Detection、
State Init）を作り、ツールが返ると、それらすべてを completed とマークする。

## Scope 駆動の Stage 包含

| Scope | 含まれる Stage |
|-------|----------------|
| enterprise | 0.1-0.3 すべて |
| feature | 0.1-0.3 すべて |
| mvp | 0.1-0.3 すべて |
| poc | 0.1-0.3 すべて |
| bugfix | 0.1-0.3 すべて |
| refactor | 0.1-0.3 すべて |
| infra | 0.1-0.3 すべて |
| security-patch | 0.1-0.3 すべて |
| workshop | 0.1-0.3 すべて |

## Stage サマリ

| Slug | # | Stage 名 | 条件 | Lead Agent | Mode |
|------|---|------------|-----------|------------|------|
| workspace-scaffold | 0.1 | Workspace Scaffold | ALWAYS | (orchestrator) | auto-proceed |
| workspace-detection | 0.2 | Workspace Detection | ALWAYS | (orchestrator) | auto-proceed |
| state-init | 0.3 | State Initialization | ALWAYS | (orchestrator) | auto-proceed |

---

## Stage 0.1 — Workspace Scaffold

| Field | Value |
|-------|-------|
| Stage # | 0.1 |
| Slug | workspace-scaffold |
| Phase | Initialization |
| Lead Agent | (orchestrator) |
| support_agents    | — |
| Execution | ALWAYS |
| Mode | Auto-proceed（承認 gate 無し） |

### 手順
1. 必要なら `<record>/` ディレクトリを作成する
2. scope が走らせる各 phase の成果物ディレクトリ 1 つ + `<record>/verification/` を作成する
3. 空の space レベルの `aidlc/knowledge/` ディレクトリを作成する（自由形式; agent ごとの
   サブディレクトリも READMEs も無い）
4. intent の `audit/` シャード dir ヘッダを作成 + `WORKFLOW_STARTED` を emit する
5. `STAGE_STARTED` + `WORKSPACE_SCAFFOLDED` + `STAGE_COMPLETED` イベントを追記する

### 入力
- 無し（エントリポイント）

### 出力
- scope が走らせる各 phase につき成果物ディレクトリ 1 つ: `<record>/initialization/`、
  加えて少なくとも 1 つの EXECUTE stage を持つ `ideation/`、`inception/`、`construction/`、
  `operation/` の各々。scope が除外する phase はディレクトリを得ない（bugfix の record には
  `ideation/` も `operation/` も無い）。stage ごとのサブディレクトリはここでは作られない:
  stage のディレクトリは、それが最初に成果物を書いたときに現れる
- `<record>/verification/`（すべての scope で作成される）
- 空の space レベルの `aidlc/knowledge/` ディレクトリ（space の `intents/` の兄弟）
- intent の `audit/` シャード dir（ヘッダ + セッション + scaffold イベント）

### メモ
- 冪等 — 既に存在するディレクトリとファイルをスキップする
- LLM を介さず、`aidlc-utility intent-create` の内側で走る

---

## Stage 0.2 — Workspace Detection

| Field | Value |
|-------|-------|
| Stage # | 0.2 |
| Slug | workspace-detection |
| Phase | Initialization |
| Lead Agent | (orchestrator — 決定論的な rule ベースのスキャナ) |
| support_agents    | — |
| Execution | ALWAYS |
| Mode | Auto-proceed（承認 gate 無し） |

### 手順
1. プロジェクトディレクトリを 1 階層深く歩き、加えて存在するなら既知のソースディレクトリ
   （`src/`、`app/`、`lib/`、`pages/`、`components/`、`tests/`）も歩く。トップレベルのシグナル
   が何も発火しないときは、同じシグナルセットで任意の名前の各サブディレクトリに 1 階層入って
   走査することにフォールバックし、コンテナフォルダ（例: `wordbook/`）にネストされた
   プロジェクトが greenfield と誤分類される代わりに検出されるようにする
2. 拡張子ごとにファイルを数えて主要/副次の言語を決定する
3. 既知の config ファイル名（Next.js、Vite、Angular、Nuxt、Remix、Gatsby、Astro、Svelte、
   NestJS）を介してフレームワークを、`package.json` の依存関係を介して React を検出する
4. manifest + lockfile を介してビルドシステムを検出する
   （npm/yarn/pnpm/bun/poetry/uv/hatch/pip/cargo/go/maven/gradle/composer/bundler）
5. `.gitmodules`（存在するなら）を読んで宣言された submodule パスを取得し、各々の初期化を
   探査する
6. `stages/initialization/workspace-detection.md` の rule を使って greenfield 対 brownfield を
   分類する
7. `STAGE_STARTED` + `WORKSPACE_SCANNED` + `STAGE_COMPLETED` イベントを追記する

### 入力
- プロジェクトのファイルシステム（読み取り専用の走査）

### 出力
- Workspace 分類（greenfield/brownfield）
- 技術スタック（言語、フレームワーク、ビルドシステム）
- 走査結果を捕らえる `WORKSPACE_SCANNED` audit イベント

### メモ
- `aidlc-utility intent-create` の内側で決定論的なスキャナとして走る。LLM subagent の dispatch は
  無い。
- シンボリックリンクは辿らない（`lstatSync` によるサイクル保護）
- `.claude/`、`<record>/`、`node_modules/`、`.git/`、`dist/`、`build/`、`.next/`、`target/`、
  `vendor/` を除外する
- `devDependencies` のみの `package.json` は tooling/scaffolding として扱われ、それ単独では
  brownfield 分類を引き起こさない
- 少なくとも 1 つの submodule パスエントリを持つパース可能な `.gitmodules` は brownfield
  シグナルである（submodule dir が未初期化でも、リポジトリのメタデータがコードを宣言する）。
  submodule パスが未初期化のとき、走査は警告し、`git submodule update --init --recursive` を
  名指す - `WORKSPACE_SCANNED` イベント（`Submodules` フィールド + `Details` の是正策）と誕生時
  の stdout に表出され、conductor がそれを中継できる; 言語は走査されたままである

---

## Stage 0.3 — State Initialization

| Field | Value |
|-------|-------|
| Stage # | 0.3 |
| Slug | state-init |
| Phase | Initialization |
| Lead Agent | (orchestrator) |
| support_agents    | — |
| Execution | ALWAYS |
| Mode | Auto-proceed（承認 gate 無し） |

### 手順
1. state contract を読む
2. scope マッピング + depth + テスト戦略を適用する
3. greenfield については `reverse-engineering` を SKIP とマークする
4. 最初の post-init stage を `[-]` に設定して、完全な `<record>/aidlc-state.md` を書く
5. `STAGE_STARTED` + `WORKSPACE_INITIALISED` + `STAGE_COMPLETED` イベントを追記する

### 入力
- workspace-detection からの Workspace 分類（同じツール呼び出し）
- Scope 設定（`--scope` フラグまたは `poc` の既定から）
- 渡された場合の depth / テスト戦略の上書き
- `.claude/knowledge/aidlc-shared/state-template.md` からの state contract
- コンパイル済みの `tools/data/stage-graph.json` と `tools/data/scope-grid.json`

### 出力
- `<record>/aidlc-state.md`（完全に populate された）
- `WORKSPACE_INITIALISED` audit イベント

### メモ
- Brownfield のプロジェクトは reverse-engineering（Stage 2.1）にルーティングされる
- Greenfield のプロジェクトは最初の非 initialization stage にルーティングされる（feature/poc は
  intent-capture; bugfix/refactor は requirements-analysis; workshop は practices-discovery、
  workshop は Ideation のすべてをスキップし、reverse-engineering は greenfield では SKIP に
  降格されるため）
- `/aidlc-init`（明示的な誕生パッケージング）から呼び出されたとき、orchestrator はこの stage の
  後に停止する
- ワークフロー開始（`/aidlc <scope>` または何をビルドするかの記述）から呼び出されたとき、
  orchestrator は最初の post-init stage へ続く

---

## Re-initialization

re-init フラグは無い。最初の intent を誕生させることは intent ごとに 1 回走る; workspace shell
それ自体は事前ビルドされて出荷され、決して再 scaffold されない。やり直すには、新しい intent を
誕生させる（各々が自身の `<record>/` を得る）か、あるいは — まっさらな状態のためには —
アクティブな intent の record dir を `aidlc/spaces/<space>/intents/` の下にアーカイブし、
エンジンに新鮮なものを誕生させる。既存の intent に対する 2 回目の `/aidlc` は、再初期化するの
ではなくそれを再開する。

## Notes

- 3 つの stage すべてが auto-proceed する — Initialization phase に承認 gate は無い
- 決定論的な initialization ツールは完了した各 stage を報告する; エンジンは `Current Stage`、
  状態のチェックボックス、audit イベントをアトミックに更新する
- Conductor は initialization のライフサイクル状態を決して直接編集しない
- Initialization → Ideation の phase 遷移にはガバナンス境界チェックが無い

## Cross-References

- [Architecture](../01-architecture.md) — 実行モデルの概要
- [Orchestrator](../03-orchestrator.md) — ルーティングロジック
- [Stage Protocol](../04-stage-protocol.md) — 状態追跡の rule
- [Ideation Stages](ideation.md) — 次の phase
