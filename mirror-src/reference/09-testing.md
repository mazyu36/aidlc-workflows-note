# テスト

## 概要

AI-DLC のテストスイートは **完全に TypeScript** である — すべてのテストは `bun` の下で実行される
`t*.test.ts` ファイルであり、shell（`.sh`）のテストファイルは 1 つも無い。これは構成による
platform 不変性の保証である: 同じファイルが macOS・Linux・ネイティブ Windows で同一に実行される。

スイートは **4 つの level** に編成される — `smoke`・`unit`・`integration`・`e2e` — それぞれ
`tests/` 配下に 1 ディレクトリずつ。4 つの level は、速度 対 網羅性のバランスを取る古典的な
3 層のテストピラミッドに対応する:

```
            /\
           /  \    ACCEPTANCE — full workflows, artifact + experience verification
          / L3 \   Level: e2e  ·  When: before releases (--release / --all)
         /------\
        /        \
       /   L2     \  STAGE — individual stages with stub input, verify artifacts
      /------------\ Level: integration  ·  When: CI push (--ci, every PR)
     /              \
    /      L1        \  PROTOCOL — contracts, structure, cross-references
   /------------------\ Levels: smoke + unit  ·  When: every local change
```

`--ci` プロファイルとフラグ無しの既定はどちらも **smoke + unit + integration** を実行する
（そのため integration level はローカルの `bun tests/run-tests.ts` ごとに便乗する）; `--release`
/ `--all` は `e2e` を加える。上のピラミッドは各 level が概念的にどこに位置するかを示す — 実際に
それらを選択する方法は下のプロファイルフラグである。

**ファイル名の規約。** テストのファイル名は `t<NN>[-description].test.ts` である — それが属する
level ディレクトリと、任意の人間向けの説明だけ。名前に **mechanism のセグメントは無い**: テストの
mechanism（CLI を spawn するか、SDK を駆動するか、ライブ TUI を描画するか）は、ファイル名で宣言
されるのではなく、その本体が実際に呼び出す driver から計算される *導出された集合* である。各テストが
何をカバーするかの機械チェック済みインデックスは、ここの手作業のテーブルではなく
`tests/.coverage-registry.json` に住む（ディスク上の `covers:` ヘッダから
`tests/gen-coverage-registry.ts` が生成する） — 下の [Test Registry](#test-registry) を参照。

## Layer 1: Protocol（変更ごと・LLM 不使用・秒単位）

LLM を呼び出さずに orchestrator の構造的な正しさを検証する。これらが通れば protocol は内部的に一貫している — stage は有効なファイルを参照し、入力/出力は正しく連鎖し、routing テーブルは stage ファイルと一致する。

**Level:** smoke, unit, integration

**テスト対象:**
- ファイルの存在、パーミッション、命名規約（smoke）
- hook スクリプト（bun 経由の 11 の TypeScript）、stage frontmatter、knowledge インベントリ（unit）
- scope-stage マッピング、グラフの一貫性、stage I/O 契約チェーン、protocol 準拠（integration）
- stage の output-to-step 検証: 宣言されたすべての output が instruction のステップで参照される（integration、`aidlc-validate.ts` CLI ツール経由で決定論的）

**実行:** `bun tests/run-tests.ts`（既定、フラグ不要）。`bash tests/run-tests.sh` は既存の POSIX コマンド向けの互換ラッパーである。

## Layer 2: Stage（CI push・LLM 使用・分単位）

既知の workspace + state fixture とともに個々の stage を分離して実行する。決定論的な入力を与えられたとき各 stage が正しい成果物を生成することを検証する。

**Level:** integration

**テスト対象:**
- Preflight ヘルス gate: Claude CLI が PATH 上にある、AWS 認証情報が有効、Claude が応答する（exit 0）、応答が空でない（preflight）
- CLI ツールのユーティリティハンドラ: intent-create, --doctor, --status, --stage, --phase（integration）
- greenfield/brownfield スタブを用いた個々の stage、成果物の検証（integration）

**実行:** `bun tests/run-tests.ts --ci`

## Layer 3: Acceptance（release・LLM 使用・時間単位）

完全なワークフローを実行し、体験を検証する: state 遷移を超えて、成果物の内容、stage をまたぐ整合性、ドメインの正しさを確認する。

**Level:** e2e

**テスト対象:**
- brownfield スタブ + 成果物アサーションを用いた完全な bugfix ライフサイクル
- greenfield スタブ + 成果物アサーションを用いた完全な POC ライフサイクル
- state の進行、scope routing、audit の完全性、jump の仕組み
- stage instruction の品質の LLM による意味的レビュー（明快さ、論理の流れ、曖昧さの検出）

**実行:** `bun tests/run-tests.ts --release`

## クロスプラットフォームのカバレッジ

テストスイートはネイティブの Bun runner を通じて macOS・Linux・Windows で実行される:

```bash
bun tests/run-tests.ts [--ci | --all --debug -P 8]
```

`bash tests/run-tests.sh ...` は POSIX 互換ラッパーとして残り、同じ TypeScript runner に委譲する。実行時、この実装の hook・CLI ツール・テスト runner は `bun` を要求する; Bash はもはや主要な runner の基盤ではない。

**スイートに焼き込まれた移植性の制約:**

- **Paths**: `tests/harness/fixtures.ts` の `createTestProject` は一時的なプロジェクトパスを正規化し、JSON とネイティブ `bun` を通じてクリーンにラウンドトリップさせる。
- **In-place edits**: テストでは TypeScript のファイル書き込みを優先する。shell ヘルパーが避けられない場合は、BSD/GNU 固有の `sed -i` 形式を避ける。
- **`grep -qiF`**: Git Bash には `-i` と `-F` を組み合わせた既知のバグがある。パターンに正規表現メタ文字が無ければ `-i` 単独を使う。修正前は t16 でこれに当たっていた。
- **`tar` アーカイブ**: macOS の `tar` は既定で `._*` の AppleDouble サイドカーファイルを注入する。クロスプラットフォームのテスト実行向けにソースをバンドルするときは、`COPYFILE_DISABLE=1 tar …` または `git archive` を使う。
- **Windows での LLM タイミング**: Windows EC2 からの Bedrock 呼び出しは macOS からより有意に遅くなりうる（初回呼び出しのコールドスタート、MSYS のプロセス fork オーバーヘッド）。SDK/tui テストは driver の結果サーフェスでアサートし、基盤の欠如と実際の失敗との切り分けは runner の preflight/ファイルごとの Claude gate に任せるべきである。

**Windows でスイートを手動実行する:**

1. `bun`・Node.js・Claude Code CLI をインストールする。
2. 完全なスイートまたは POSIX ラッパー互換の smoke を実行する場合は Git for Windows をインストールする; ネイティブ runner の経路自体は Bash を要求しない。
3. e2e の TUI テストでは、node が `node-pty` と `@xterm/headless` を解決できるよう、npm で開発依存をインストールする。
4. `AIDLC_NODE_BIN` を具体的な `node.exe` のパスに設定し、完全な acceptance 実行のため `AIDLC_TUI_LIVE=1` を設定する。
5. `bun tests/run-tests.ts --all --debug -P 8` を実行する。

WSL や Docker は不要である; サポートされる検証基盤はネイティブ Windows である。

**再現可能な MR10 Windows EC2 runbook:**

1. SSM アクセスを持つ使い捨ての Windows Server 2022 ホストを立ち上げる:

   ```bash
   aws cloudformation deploy \
     --stack-name aidlc-windows-test \
     --template-file tests/harness/windows/windows-test.cfn.yaml \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides VpcId=vpc-... SubnetId=subnet-...
   ```

2. テスト対象のコミット済み git ツリーを同期する:

   ```bash
   bun tests/harness/windows/sync.ts --stack-name aidlc-windows-test HEAD
   ```

3. そのマシンにリポジトリの開発依存をインストールする:

   ```bash
   bun tests/harness/windows/ssm-run.ts --stack-name aidlc-windows-test -- \
     powershell -ExecutionPolicy Bypass -File C:\aidlc\tests\harness\windows\setup.ps1 -ProjectDir C:\aidlc
   ```

4. ライブ TUI を有効にして Windows の `--all` gate を実行する:

   ```bash
   bun tests/harness/windows/ssm-run.ts --stack-name aidlc-windows-test -- \
     powershell -ExecutionPolicy Bypass -File C:\aidlc\tests\harness\windows\run-all.ps1 -ProjectDir C:\aidlc -Parallel 8
   ```

5. ホストを撤去する:

   ```bash
   aws cloudformation delete-stack --stack-name aidlc-windows-test
   ```

`run-all.ps1` は `bun tests/run-tests.ts --all --debug -P <N>` を呼び出す前に `AIDLC_NODE_BIN` と `AIDLC_TUI_LIVE=1` をエクスポートするので、green の結果がライブ TUI のジャーニーを静かにスキップして得られることはありえない。ネイティブインストーラが `claude.exe` を CloudFormation の UserData ブートストラップを実行したユーザー（EC2Launch v2 では Administrator）の下に置くため、claude バイナリを `C:\Users\Administrator\.local\bin` と systemprofile のホームにわたって探索する。

スタックは既定で **`c5.4xlarge`** である — 完全な `--all -P 8` のライブ実行で実証済みのサイズ。e2e tier はテストごとの `bun:test` タイムアウトを持ち（Bolt-worktree ライフサイクルテストは c5.4xlarge で 5s の予算に対して約 5.5s に達する）、より小さいマシン（例: `t3.large`）は並列負荷下で決定論的な Bolt/ランタイムのテストを見せかけのタイムアウトへ傾ける。より軽い tier の選択を実行するときだけ `InstanceType` パラメータを縮小する。

## Preflight 検証

フィルタ無しでライブ可能な level（integration または e2e）を実行する前に、runner は gate として `tests/integration/t19.test.ts` を実行する。これは **Claude Agent SDK** を通じて小さな実ターンを駆動し（integration tier が使うのと同じライブ経路）、決定論的なサーフェスにだけアサートする。preflight が失敗した場合でも決定論的なファイルは実行され、Claude 依存のファイルはファイルごとの `SKIP` エントリとともにスキップされる。

SDK driver は、`driveAidlc()` の各呼び出しに一時的な `CLAUDE_CONFIG_DIR`
を与え、session の永続化を無効にする。したがって、ホームディレクトリが
コマンドサンドボックス内で読み取り専用であるときも含めて、ライブテストは
ユーザーの `~/.claude.json` と Claude のトランスクリプトに触れないままである。
呼び出しごとの `env.CLAUDE_CONFIG_DIR` は、絞り込んだキャリブレーションのために
利用可能なままである。

| アサーション | サーフェス | 失敗時 |
|-----------|---------|---------|
| AWS 認証情報が有効 | `aws sts get-caller-identity` が exit 0（`aws` CLI が無い場合は PASS-by-skip） | bail — Bedrock は IAM 認証を必要とする |
| ライブターンが終端の結果に到達する | SDK 実行が非 `undefined` の `resultEvent` を生成する（tier が必要とするバイナリが存在し到達可能） | bail — 基盤/API に到達不能 |
| ターンがエラー無く完了する | `resultEvent.is_error === false`（`claude -p` の exit 0 に相当する決定論的な等価; 124/137 のハングでは undefined のまま） | bail — API が無応答 |
| 応答が空でない | 実行が *何らかの* 出力を捕捉した — `tool_result` または assistant のテキスト（存在のみ、内容は問わない） | bail — API が何も生成しなかった |

ここでの red は本物の環境上の発見（`claude` の欠如、期限切れの認証情報）であり、和らげるべき flake では決してない — 下流の LLM tier を速やかに bail するという、まさに gate の仕事である。

## Test Registry

スイートは **登録ではなく発見される**: `bun tests/run-tests.ts` は 4 つの level ディレクトリ
（`tests/{smoke,unit,integration,e2e}/`）を歩き、見つけた `t*.test.ts` をすべて実行する。同期を
保つべき手作業のテストごとのテーブルは無い — テストファイルを足すだけで runner がそれを拾い上げる。

各テストが *何をカバーするか* は **`tests/.coverage-registry.json`** に機械的に追跡され、テスト
ファイルの先頭コメントブロックの `covers:` ヘッダ（通常は 1 行目; いくつかのファイルは正当に何も
宣言せず、単にカバレッジの主張に寄与しない）から `bun tests/gen-coverage-registry.ts` が生成する。
ジェネレータはフレームワークの unit を 7 つのクラス（`function`・`audit`・`scope`・`stage`・`hook`・
`subcommand`・`render-surface`）にわたって列挙し、各 `covers:` の主張を列挙された unit に対応づけ、
カバレッジ数に加えて ratchet の下限を出力する。再生成と drift の検証は次で行う:

```bash
bun tests/gen-coverage-registry.ts          # rewrite the registry from disk
bun tests/gen-coverage-registry.ts --check  # fail if the committed registry is stale
```

`tests/.coverage-registry.json` は権威ある機械チェック済みのインデックスである — 特定の function・
audit イベント・scope・stage・hook・subcommand・render surface をどのテストが動かすかを見つけるには、
それを参照する（または `covers:` ヘッダを直接 grep する）。`--check` モードはスイートに組み込まれて
おり、ディスクから drift したレジストリは gate を red にする。

> **Note:** t19 は unit（`tests/unit/t19.test.ts`、jump CLI ツール）と integration
> （`tests/integration/t19.test.ts`、ライブ preflight gate）の両方に現れる — 素の ID
> ではなく level/ファイルパスが、こうした衝突を曖昧さなく区別する。

## トリガーポイント

| トリガー | Layer | コマンド | 場所 |
|---------|-------|---------|-------|
| `git commit` | L1 | `bun tests/run-tests.ts` | ローカル（pre-commit hook） |
| CI pipeline | L2 | `bun tests/run-tests.ts --ci` | CI/CD pipeline |
| main への Release / merge | L3 | `bun tests/run-tests.ts --release` | CI/CD pipeline |

L1 は git の pre-commit hook で強制できる: `bun tests/run-tests.ts || exit 1`。

## スタブ

### Greenfield スタブ: `tests/fixtures/greenfield-todo/`

ソースコードの無いプロジェクト記述。Workspace-detection は greenfield に分類する。ideation stage 向けに、LLM へ決定論的な intent コンテキストを与える。

内容: TypeScript と Vite の React Todo App を記述する `README.md` のみ。

### Brownfield スタブ: `tests/fixtures/brownfield-todo/`

最小限の React+TypeScript+Vite ソース（約 10 ファイル、約 200 LOC）。Workspace-detection は brownfield に分類する。RE・requirements・design の stage が分析する具体的なコードを持つ。

内容:
- `package.json` — react, react-dom, typescript, vite, vitest
- `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.tsx`, `src/App.tsx`
- `src/types/todo.ts` — Todo interface（id, title, completed）
- `src/components/TodoList.tsx` — リスト + 追加フォーム（約 40 行）
- `src/components/TodoItem.tsx` — チェックボックス + タイトル + 削除ボタン
- `src/hooks/useTodos.ts` — addTodo, toggleTodo, deleteTodo

### RE 成果物 Fixture: `tests/fixtures/re-artifacts/`

下流の stage テスト向けに事前投入された reverse-engineering の出力。セットアップ中に、テストプロジェクトの space レベルのリポジトリストア `$PROJ/aidlc/spaces/default/codekb/<repo>/` にコピーされる。

内容: brownfield-todo アプリを記述する 4 つの最小限の .md ファイル（architecture-overview, technology-stack, codebase-analysis, integration-points）。

### Inception 成果物 Fixture: `tests/fixtures/inception-artifacts/`

construction へ jump するテスト向けに事前投入された inception phase の出力。セットアップ中に `$PROJ/aidlc/spaces/default/intents/<record>/inception/{requirements-analysis,application-design,units-generation}/` にコピーされる。

内容: Todo アプリを記述する 7 つの最小限の .md ファイル（requirements, components, component-methods, services, component-dependency, unit-of-work, unit-of-work-story-map）。Unit 名: `todo-core`。

### Construction 成果物 Fixture: `tests/fixtures/construction-artifacts/`

construction 途中の stage（例: code-generation）へ jump するテスト向けに事前投入された construction phase の出力。セットアップ中に `$PROJ/aidlc/spaces/default/intents/<record>/construction/todo-core/functional-design/` にコピーされる。

内容: todo-core unit のコンポーネント仕様と state 管理を記述する 1 つの最小限の .md ファイル（functional-design）。

## State Fixtures

| Fixture | Project Type | Scope | State | Used By |
|---------|-------------|-------|-------|---------|
| `state-pre-workspace-detection.md` | -- | feature | Welcome+scaffold 完了、次は workspace-detection | t70, t71 |
| `state-initialization-done.md` | Greenfield | feature | Init 完了、次は intent-capture | t73 |
| `state-brownfield-init-done.md` | Brownfield | bugfix | Init 完了、次は RE | t72 |
| `state-mid-inception.md` | Brownfield | bugfix | RE 完了、次は requirements-analysis | t74 |
| `state-mid-ideation.md` | Greenfield | feature | Intent+market 完了、次は feasibility | t08, t10, t11, t12, t20, t22, t24, t25, t37 |
| `state-construction.md` | -- | -- | Construction phase | t07, t10, t11, t26, t57 |
| `state-operation.md` | -- | -- | Operation phase | t07, t10, t11 |
| `state-completed.md` | -- | -- | 全 stage 完了 | t08, t11 |
| `state-jumped.md` | Brownfield | bugfix | jump 履歴を持つワークフロー途中 | t11, t37, t42 |
| `state-corrupted.md` | -- | -- | 不正/破損した state | t08, t10 |

## Stage テストの追加方法

1. テストする stage を選び、それがどの state fixture を必要とするかを特定する（その state はその stage を現在/次の stage として示していなければならない）
2. `tests/fixtures/` に state fixture を作成するか再利用する
3. `tests/integration/tNN-stage-SLUG.test.ts` を作成し、shell の TAP ヘルパーではなく共有の TypeScript harness ヘルパー（`tests/harness/fixtures.ts`、`tests/harness/sdk-drive.ts`、または `tests/harness/tui-drive.ts`）を使う。
4. `bun tests/run-tests.ts --integration` で実行するか、直接: `bun test tests/integration/tNN-stage-SLUG.test.ts`

## Acceptance アサーションの追加方法

`tests/e2e/` 配下の既存の e2e ワークフローテストに成果物アサーションを足すには:

1. 現在のテストを読み、それが既に何を確認しているかを理解する
2. 既存の `test(...)` ブロック内に `expect(...)` アサーションを足す（bun:test は呼び出し自体から
   アサーションを数える — 同期を保つべき `plan` 行は無い）
3. 柔軟なパターンを使う: 厳密な文字列ではなく `readFileSync` の内容に対して `/[Tt]odo/` を
   マッチさせる
4. 非決定論的な LLM の出力形式に依存するアサーションには `test.skipIf(...)` / 早期 return を使う
5. サイズに基づくチェックには `expect(statSync(path).size).toBeGreaterThan(minBytes)` を使う

## アサーション設計の原則

- **Keyword classes** — 大文字小文字を区別しない正規表現を使う: `[Tt]odo`, `[Rr]eact`, `[Bb]rownfield`
- **Flexible discovery** — 厳密な名前を確認するのではなく `find` + `wc -l` でファイルを数える
- **Size bounds** — 最小限の内容には `statSync(path).size` を `toBeGreaterThan()` とともに使う
- **Graceful degradation** — アサーションが非決定論的な LLM 出力に依存するときは `skip` を使う
- **Structure over content** — 内容を確認する前に markdown 見出し（`^#`）、ファイルの存在、ディレクトリの作成を確認する

## 環境変数

| 変数 | 既定 | 説明 |
|----------|---------|-------------|
| `AIDLC_TEST_TIMEOUT` | `1800` | `claude -p` 呼び出しごとのタイムアウト（秒）。無効化するには `0` に設定する。 |
| `AIDLC_TUI_SETTING_SOURCES` | `project` | ライブの `claude` TUI 起動に注入される設定ソース。user/local の Claude 設定を意図的に含める焦点を絞ったキャリブレーションのときだけ `default` または空値を使う。 |
| `AIDLC_TUI_TRACE_POLL_MS` | `10000` | 長いジャーニーが次のメニューまたはディスクのターミネータを待つ間の、TUI NDJSON トレースにおける `answer_gate_poll` スナップショット間の最小間隔。 |

## CLI リファレンス

```bash
# Entrypoints
bun tests/run-tests.ts        # Native cross-platform runner
bash tests/run-tests.sh       # POSIX compatibility wrapper

# Level flags (combinable)
--smoke         # Structural validation
--unit          # Single-component isolation
--integration   # Cross-component contracts and stage/CLI utilities
--e2e           # Full lifecycle, worktree, and rendered terminal journeys

# Profile flags (shortcuts)
(default)       # smoke + unit + integration
--ci            # smoke + unit + integration
--release       # smoke + unit + integration + e2e
--all           # Same as --release

# Output modifiers
--verbose       # Write per-test logs to tests/logs/
--no-llm        # Force all live-model gates closed while deterministic
                # integration/e2e tests still run. Also via AIDLC_NO_LLM=1.
--debug         # Implies --verbose; streams per-test output and writes SDK/TUI
                # driver traces to tests/logs/
--filter PAT    # Only run tests whose filename matches extended regex PAT
--parallel N    # Run up to N test files concurrently within a tier (alias: -P N).
                # Default: 1 (serial). Smoke and unit tiers are always serial.
```

`--no-llm`（または `AIDLC_NO_LLM=1`）は導出された Claude gate を閉じ、すべての
ライブモデル opt-in を `0` に強制する: Claude TUI、Kiro ACP/TUI/IDE、Codex exec、
opencode run。これらの tier の決定論的なテストは、トークンフリーの TUI 基盤の
preflight を含めてなお走る。これにより CI は、CLI がインストールされていて
ライブ変数が `1` として継承されていても、ライブモデルのコストやフレーキーさ無しの
完全な tier の決定論的プロファイルを得られる。

ライブの SDK と TUI harness の driver は、既定で project のみの Claude 設定ソースを用いる。つまり、
コピーされたテストの `.claude/` プロジェクト設定と hook をロードし、開発者の user レベルの hook/設定を
除外する。これはインストールされたフレームワークのサーフェスをミラーし、ローカルの対話的な好みが
テストの振る舞いを変えるのを防ぐ; 明示的な driver オプションまたは `AIDLC_TUI_SETTING_SOURCES` が
キャリブレーションのための escape hatch として残る。

`--all --debug`（および `--release --debug`）は、環境が既に設定していない限り `AIDLC_TUI_LIVE=1` を
既定にする。これにより「トレース付きですべて」のプロファイルは、既定でライブでトークンを消費する TUI
ジャーニーを実行する; それらのファイルをテスト内の SKIP 経路に留めるには `AIDLC_TUI_LIVE=0` を明示的に
設定する。

## 並列実行

`--parallel N`（または `-P N`）は tier 内で最大 N 個のテストファイルを同時に実行する。既定はシリアル（`1`）である。

**効果がある場面。** integration と e2e の level は、それぞれ実時間の大半を `claude -p` サブプロセスの起動と LLM ターンに費やす。これらのテストは既にファイルシステム的に分離されている — `setup_integration_project` がテストごとに新鮮な `$PROJ` をスキャフォールドする — ので、干渉なしに並んで実行できる。

**スパイクの結果（2026-05-06、Bedrock 経由の Opus 4.7）:**

| シナリオ | シリアル | `--parallel 4` | `--parallel 8` |
|---|---|---|---|
| 4 × `/aidlc --help` | 56s | 16s（3.5x） | — |
| 8 × `/aidlc --help` | — | — | 31s |

8 つの並列呼び出しすべてが `cache_read=73789` を観測した — Bedrock の prompt caching は同時 worker をまたいで warm を保つ。8-way でスロットリングや破損は観測されなかった。

**シリアルのままのもの。** smoke と unit の tier は `--parallel` を無視し、いずれにせよシリアルに実行される。それらは既に数秒で完了し、出力が交錯すれば実時間の利得なしにデバッグ性を損なう。preflight gate（`tests/integration/t19.test.ts`）も、LLM tier がその exit ステータスに依存するためシリアルに実行される。

**並列下での出力。** `START` マーカーはライブでストリームされる（最初の `DONE` の前に複数が立て続けに現れうる — それが worker が並行しているという可視のシグナルである）。normal/verbose モードでは、各 worker の TAP 本体はバッファされ、ディレクトリ mutex（`mkdir $LOG_DIR/.stdout.lock`、POSIX でアトミック — `flock` なしで macOS の bash 3.2 でも動く）の下で 1 つの連続したブロックとして stdout にフラッシュされる。そのため異なるファイルの `ok`/`not ok` 行が交錯することは決してない; stdout はシリアル実行のように上から下へ読め、ファイルの完了順序だけがディスパッチ順ではなく各テストにかかった時間で決まる。`--debug` モードでは、Bun の stdout/stderr がライブでストリームされつつ、なおテストごとのログにも書き込まれる; 並列の debug 出力はファイルの basename が接頭辞として付くので、重なり合うライブ worker も帰属可能なままである。SDK/TUI/Kiro-ACP の driver トレースは、ログの傍らに `$LOG_DIR/sdk-drive-*.ndjson`・`$LOG_DIR/tui-drive-*.ndjson`・`$LOG_DIR/kiro-acp-drive-*.ndjson` として書き込まれる; それらの正確なファイル名はプロセス ID と TUI セッション名に依存するので、runner は起動時と各テスト開始時に glob を出力する。Kiro-ACP トレースはライブの `kiro-cli acp` ターンをイベントごとに記録し（spawn、prompt 開始、逐語の出力プレビュー付きの各 `tool_call`/`tool_call_update`、パーミッションの回答、spawn されたプロセスの stderr、終端の `result`/`timeout`/`end`）、そのため `session/prompt` のタイムアウトを事後に診断できる — 進行していたターン（実際の tool 呼び出しが発火している）を、停滞したターンから区別する。

**Worker の協調。** 親は `run_bun_test_file` を `&` でバックグラウンド化し、`jobs -rp | wc -l` 経由でスロット gate を保持する。各 worker はアトミックな `.meta` サイドカーを `$LOG_DIR/_results/` に書き込む; 親は `wait` の後にそれらを読み、サマリテーブルを埋める。macOS は bash 3.2.57 を同梱する（`wait -n` は無い）ので、gate は 200ms ごとにポーリングする — 分単位の LLM 呼び出しの隣では無視できる。

**ガイダンス。** `--parallel 4` から始める。Bedrock のキャパシティと請求が許すなら `8` に上げる。単一の失敗するテストをデバッグするときはシリアルに戻す — または `--filter` でそれを分離する。
