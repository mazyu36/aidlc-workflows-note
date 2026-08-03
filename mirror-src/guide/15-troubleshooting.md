# トラブルシューティング

本章では、よくある問題とその解決策を症状別に整理する。

> **Harness に関する注記。** 以下の症状と対処は **Claude Code** 向けに書かれている
>（hook のファイル名、`settings.json` のブロック、コンパクションの挙動）。決定論の中核
> — 状態・audit・エンジン — はどの harness でも同一に振る舞うが、シェルレベルの
> サーフェスは異なる: 他の harness は hook と設定を独自の方法で束線する
>（[他の harness で動かす](harnesses/README.md) を参照）。対処が `.claude/` のパスや
> Claude の機構を名指しする箇所は、利用 harness の設定ディレクトリに同等物がある。

---

## クイックフィックス表

| 症状 | クイックフィックス |
|---------|-----------|
| audit エントリが現れない | `bun` がインストール済みで PATH にあることを確認 |
| 状態ファイルの破損 | `/aidlc --doctor` を実行し、状態テンプレートと比較 |
| 承認 gate で詰まる | 応答を入力する。飛ばすには `/aidlc --stage <target>` でジャンプ |
| セッション途中でコンテキストがコンパクション | `/aidlc` を実行してチェックポイントから再開 |
| audit ログが大きすぎる | `audit-YYYY-MM.md` にリネームする。新しいものが自動で作られる |
| hook がハングして見える | システム一時ディレクトリの古いロックディレクトリを削除（下記参照） |
| ステータスラインが "ready" を表示 | `aidlc-state.md` に `**Lifecycle Phase**` フィールドがあるか確認 |
| ステータスラインが出ない | `bun` が PATH にあり、`settings.json` の `statusLine.command` が `aidlc-statusline.ts` を参照しているか確認 |
| subagent がタイムアウト | `/aidlc` を実行して再試行するか、stage を inline で実行 |
| ワークフローが詰まる・挙動不審で助けが要る | `/aidlc --doctor --export` を実行し、生成された `.tar.gz` を共有（マスキング済み・作業成果物は含まない） |

---

## hook が発火しない

**症状**: ファイル書き込み後に intent の `audit/` シャードにエントリが現れない。または subagent の完了ログが無い。

### `bun` が未インストール、または PATH に無い

14 の TypeScript hook（`aidlc-mint-presence.ts`、`aidlc-dispatch-rules.ts`、`aidlc-state-transition-guard.ts`、`aidlc-reviewer-scope.ts`、`aidlc-audit-logger.ts`、`aidlc-sensor-fire.ts`、`aidlc-runtime-compile.ts`、`aidlc-log-subagent.ts`、`aidlc-stop.ts`、`aidlc-validate-state.ts`、`aidlc-sync-statusline.ts`、`aidlc-session-start.ts`、`aidlc-session-end.ts`、`aidlc-statusline.ts`）はすべて `bun` を必要とする。`bun` が無い、または非対話シェルの PATH に無い場合、これらの hook は発火しない。

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
npm install -g bun
# or: powershell -c "irm bun.sh/install.ps1 | iex"

# Verify
bun --version
```

`bun` が `~/.zshenv`（zsh）や `~/.bashrc`（bash / Windows の Git Bash）で PATH に載っていることを確認する -- `~/.zshrc` だけでは不十分。ネイティブ Windows PowerShell では、`npm install -g bun` が設定するシステム PATH エントリで足りる。

### レビュアーのツール呼び出しが拒否される（"reviewer read-scope: ..."）

unit 単位の Construction レビュー中、reviewer-scope hook は、dispatch されたレビュアーが兄弟 unit の `construction/` パスへ届くツール呼び出しを拒否する（stage-protocol §12a の読み取りスコープ境界）。拒否メッセージはスコープ対象の unit と渡された契約パスを名指しし、各拒否は `REVIEWER_SCOPE_BLOCKED` の audit 行を記録する。自分のソースツリーに AI-DLC の unit と無関係な `construction/` ディレクトリがあり、正当なレビュアーの読み取りが拒否される場合は、`AIDLC_DISABLE_REVIEWER_SCOPE_HOOK=1` で強制を無効化できる。散文の境界は引き続き有効である。レビューが走っていないのにレビュアーが拒否される場合は古い dispatch 記録を意味する - `/aidlc --doctor` の hook ドロップカウンタ（`reviewer-scope.drops`）を確認し、`<record>/.aidlc-reviewer-dispatch.json` があれば削除する（6 時間より古い記録は無視され自動で掃除される）。

### hook が設定されていない

hook はプロジェクト全体で `.claude/settings.json` に登録される（v0.6.0 以降。以前のバージョンはワークフローの背骨の hook を SKILL.md の frontmatter で宣言していた）。`settings.json` に `PreToolUse`・`PostToolUse`・`PreCompact`・`SubagentStop`・`Stop`（加えて `SessionStart`/`SessionEnd`）のエントリを持つ `hooks` ブロックがあることを確認する。これらを移動したアップグレードを取り込んだのにディスク上の `settings.json` がそれ以前のものである場合は、同梱の `settings.json` の hooks ブロックを再コピーする。

---

## 状態ファイルの問題

**症状**: orchestrator が状態の破損を報告する。またはワークフローの挙動がおかしい。

### 状態ファイルが無い

状態ファイルは Initialization 中、または `/aidlc` に scope が渡されたときに作られる。

- `/aidlc --status` でアクティブなワークフローが無いことを確認する
- `/aidlc` または `/aidlc <scope>` で新しいワークフローを開始する

### 状態ファイルの破損

`validate-state.ts` hook はコンパクションのたびに 2 つの必須セクション — `## Stage Progress` と `## Current Status` — を確認する。修復手順:

1. `/aidlc --doctor` を実行し、報告された状態・グラフ・hook の問題に対処する
2. 生成された Stage Progress の行が古い場合、状態の再同期を担うエンジン経路を再実行する: `/aidlc` でワークフローを開始・再開するか、`/aidlc --scope <scope>` で scope を変えてコンパイル済みグラフと scope グリッドを再適用させる
3. `.claude/knowledge/aidlc-shared/state-template.md` はセクションとフィールドの契約としてのみ使う。テンプレートから stage の行を手で復元しないこと

---

## dispatch された stage のタイムアウト

**症状**: dispatch される stage（Reverse Engineering・Practices Discovery・User Stories・Code Generation）がエラーや途切れた出力を返す。

### 何が起きるか

フレームワークは組み込みの再試行プロトコルに従う:

1. コンテキストを減らしたプロンプトで**自動再試行**
2. **再試行も失敗した場合**、2 つの選択肢:
   - **inline で実行** — subagent の境界なしに、メインの会話で stage を直接実行する
   - **スキップして後で戻る** — stage を未完了のまま印を付け、後で戻る

### 手動での復旧

`/aidlc` を再実行する — `[-]`（進行中）の状態を検出し、再開かやり直しを提案する。何が失敗したかは `audit/` シャードのエラーエントリで確認する。

---

## 承認 gate で詰まる

**症状**: ワークフローが承認 gate であなたの応答を待っている。

### 進め方

促されたら応答を入力する。選択肢:

- **Approve** — 次の stage へ続行
- **Request Changes** — 修正のためのフィードバックを渡す

### 修正ループのエスケープハッチ

同じ stage で 3 回の修正サイクルの後、3 つ目の選択肢 **Accept as-is** が現れる。現行版をアーカイブして先へ進む。

### stage のスキップ

`/aidlc --stage <target>` で別の stage へジャンプする。間の stage は状態ファイルで `[S]`（スキップ）になる。

---

## コンテキストコンパクション

**症状**: Claude Code が以前の会話コンテキストを要約した。セッションが直近の議論を「忘れた」ように感じられることがある。

### 保たれるもの

record dir のすべての成果物、`aidlc-state.md`、`audit/` シャード、`.aidlc-recovery.md` はディスクに永続する。失われるのは、メモリ内の会話コンテキストと、まだファイルに書かれていない途中の作業だけである。

### 復旧方法

コンパクション後に `/aidlc` を実行する。フレームワークは:

1. `aidlc-state.md` を読んでワークフローの位置を読み込む
2. `.aidlc-recovery.md` を状態ファイルと比較する — 食い違えば警告する
3. 4 つの再開オプションを提案する

復旧ブレッドクラムが不一致を警告したら、**Redo current stage** を選び、コンパクション中に進行していた stage を安全に再実行する。

---

## audit ログが大きくなりすぎる

**症状**: 長いプロジェクトで、このクローンの audit シャードが数千行に育った。

### アーカイブの方法

```bash
# from the intent's record dir; <host>-<clone>.md is this clone's shard
mv audit/<host>-<clone>.md audit-archive/<host>-<clone>-2026-02.md
```

次の `/aidlc` 呼び出し（または hook が引き起こす任意の書き込み）が新しいシャードを作る。audit の内容はすべて安全にアーカイブできる — エンジンはルーティング判断のために `audit/` シャードを読まない。

### git 上の考慮

`audit/` シャードはコミットされる（gitignore ではない）— [コミットするもの・gitignore するもの](14-artifacts-reference.md#what-to-commit-vs-gitignore) を参照。各クローンは自分の `<host>-<clone>.md` シャードに書くため、並行追記がマージコンフリクトすることはない。diff を扱いやすく保つため、コミット前のアーカイブ（上記）を検討する。

---

## 残されたロックファイル

**症状**: hook が短時間ハングしてからスキップするように見える。以後の audit エントリが書かれない。

audit の hook は並行書き込みを防ぐために `mkdir` ベースのロック（`lib.ts` 経由）を使う。hook が中断されるとロックディレクトリが残ることがある。ロックファイルはシステム一時ディレクトリ（`os.tmpdir()` -- macOS/Linux では通常 `/tmp/`、Windows では `%TEMP%`）に作られる。

### 古いロックを見つける

```bash
# macOS / Linux
ls -la /tmp/.aidlc-*

# Windows (PowerShell)
Get-ChildItem $env:TEMP -Filter ".aidlc-*"
```

ロックディレクトリの名前は、システム一時ディレクトリ内の `.aidlc-audit-<hash>.lock` と `.aidlc-subagent-<hash>.lock` である。

### 古いロックの掃除

```bash
# macOS / Linux
rm -rf /tmp/.aidlc-audit-*.lock /tmp/.aidlc-subagent-*.lock

# Windows (PowerShell)
Remove-Item "$env:TEMP\.aidlc-audit-*.lock", "$env:TEMP\.aidlc-subagent-*.lock" -Recurse -Force
```

AI-DLC のワークフローが実行中でなければ、いつ実行しても安全である。ロックは一時的なもので、hook の呼び出しごとに再作成される。

---

## ステータスラインの問題

### ワークフローが動いているのに "ready" と表示される

ステータスラインは `aidlc-state.md` の `**Lifecycle Phase**` フィールドを読む。フィールドが無いか空だと `[AIDLC] ready` へフォールバックする。

**対処:** `/aidlc --doctor` で状態ファイルの整合性を確認する。`## Current Status` セクションに `**Lifecycle Phase**` のエントリがあることを確認する。

### 古いデータが表示される

想定どおりの挙動 — ステータスラインは状態ファイルが次に書かれたとき、典型的には stage の遷移で更新される。

### まったく表示されない

1. `bun` が PATH に無い -- ステータスラインは `bun .claude/hooks/aidlc-statusline.ts` として起動される
2. `settings.json` のブロックが無い -- `statusLine` の設定が存在するか確認する
3. 状態ファイルが無い -- ワークフローが無いとき、ステータスラインは正しく `[AIDLC] ready` を表示する

---

## `--doctor` の使い方

`--doctor` ユーティリティコマンドはセットアップを検証する。何かがおかしいと感じたらいつでも実行する:

```
/aidlc --doctor
```

チェック内容: 前提条件（`bun`）、hook の存在（`settings.json` が束線するすべての hook — フレームワークの全 14 hook — が `.claude/hooks/` に存在すること。束線済みなのに無い hook は大きく失敗する）、プロジェクト構造（`settings.json`）、ワークスペースシェルの準備（`.claude/` + `aidlc/spaces/default/memory/`）、状態と audit の一貫性、hook のハートビート、グラフ整合性（サイクル無し・全グラフエントリにファイルがある）、全 9 scope の scope 検証、stage スキーマ + グラフ参照、scope 間のキーワード重複。合格する advisory 行には **Rule drift**、**Paired sensor coverage**、未コミットのワークスペース記録、そして `repos.json` が存在する場合の宣言済みリポジトリと管理下 `.gitignore` の drift が含まれる。**Hook drops** は条件付きである: 静かに劣化した hook（例: contribution を適用できなかった plugin compose、失敗した再コンパイル）は、重大度タグ付きの行を `<hooks-health>/<hook>.drops` に記録する。`[degraded]` のドロップは doctor を**失敗**させ（CI の gate が中途半端に適用された plugin を捕まえられる）、`[advisory]` のドロップ（想定内・無害な状態）は合格の行になる。plugin compose の hook は実行のたびに drops ファイルを書き直すため、原因を直して再 compose すれば自己クリアする。全合格で 0、いずれかの失敗で 1 で終了し、レポートはどちらでも stdout に書かれる。`--doctor` は**読み取り専用**である: intent がまだ無い新しいシェルでは何も作らない — 最初の intent が生まれる前でも安全に実行でき、何かがおかしいと感じたら最初に試すものである。intent が存在するようになると、`HEALTH_CHECKED`（と `GUARDRAIL_LOADED`）の audit 行を記録する。

ワークフローに問題があるとき、`--doctor` は構造化された指摘（未解決の gate、古い・欠けた runtime グラフ、冷えた hook、その他の「前に進まない」原因）を列挙する **Workflow diagnosis** セクションも表示する — `--doctor --export` がレポートに書くのと同じ分析である。

各チェックが何を検証し、失敗をどう直すかの詳細は [CLI コマンド](12-cli-commands.md#aidlc-doctor-health-check) を参照。

---

## 診断レポートの共有

ワークフローが詰まる・挙動不審 — 開かない gate、進まない stage、承認済みレポートの
繰り返し拒否 — でメンテナに見てほしいときは、次を実行する:

```
/aidlc --doctor --export
```

これは新しい `--doctor` パスを実行し、小さな**マスキング済み**の診断レポートを
`aidlc/diagnostics/` に書く（`--output <dir>` で変更可）。システムの `tar` が
使えるときはタイムスタンプ付きの `.tar.gz` にまとめ、無ければレポートディレクトリを
残して自分で圧縮するよう伝える。そのアーカイブ（またはディレクトリ）を共有する —
診断とマスキング済みの証拠を運ぶが、**あなたの作業成果物は運ばない**。ワークスペースの
ソース、生の状態 / audit / runtime グラフのファイル、成果物 / contribution / 質問 /
memory の本文は含まれない。パスは正規化され、intent の id はハッシュ化され、
秘密らしき値はスクラブされる。

レポートは audit トレイルからワークフローのタイムラインを再構成し、決定論的な
条件→対処のルールを実行する。捕まえる最も多い 2 つの原因:

- **未解決の承認 gate** — gate が解決されないままの stage は、「前に進まない」原因として
  単独で最も多い。
- **古い・欠けた runtime グラフ / 冷えた hook** — authored な入力より古い（または無い）
  runtime グラフ、長時間発火していない hook は、走らなかった再コンパイルを指す。

レポート内の `report.md` はすべての指摘を対処付きで列挙する。復旧バイパス
（`AIDLC_DISABLE_*` の env 変数のような）を名指しする対処には、自動化は安全でない
というフラグが付く。レポートの完全な内容と安全モデルは
[CLI コマンド](12-cli-commands.md#aidlc-doctor-export-write-a-diagnostic-report) を参照。

---

## 次のステップ

- [状態の追跡と audit トレイル](10-state-and-audit.md) — 状態ファイルの構造
- [セッション管理](11-session-management.md) — コンパクション後の再開オプション
- [CLI コマンド](12-cli-commands.md) — `--doctor`・`--status`・`--stage` の使い方
- [用語集](glossary.md) — コンパクション・復旧ブレッドクラム・hook の定義
