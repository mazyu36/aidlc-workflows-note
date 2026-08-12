# Kiro IDE で AI-DLC を動かす

フレームワークの harness のひとつ: `dist/kiro-ide/` は同じ AI-DLC の方法論を
[Kiro IDE](https://kiro.dev/) の中で動かす。1 つの決定論的な core —
ツール・32 の stage ファイル・プロトコル・knowledge・sensor・scope・rule —
はすべての harness でバイト共有され、シェル（skills・エージェント設定・
hook の束線・アクティベーション）だけが異なる。

> [!IMPORTANT]
> **Kiro IDE 上の AI-DLC は Claude Opus 4.8 で動かすこと。** conductor は stage ごとに
> 複数手順の儀式 — 明確化質問、成果物の生成、reviewer のパス、learnings の儀式、
> そして承認 gate — を駆動する。Opus 4.8 は儀式の全体に従い、すべての gate で正しく
> 停止する。弱いモデルは任意の手順（reviewer のパスと learnings の儀式）を飛ばし、
> gate を急ぐことがある。ワークフローを始める前に、チャットのモデルを
> **Claude Opus 4.8** に設定する。

## 前提条件

- **Kiro IDE**、サインイン済み
- チャットのモデルとして **Claude Opus 4.8** を選択（上の注記を参照）
- **bun** が PATH にあること（`curl -fsSL https://bun.sh/install | bash`）

> [!TIP]
> bun は*非対話*シェルが見る PATH に載っていなければならない — IDE が hook や
> ツールを実行するのはそのシェルである。そうしたシェルは `~/.zshenv`（zsh）か
> `~/.bashrc`（bash）を読み、`~/.zshrc` は読まない。しかし bun のインストーラは
> `~/.zshrc` に書く。ターミナルでは `which bun` が動くのに hook が bun を見つけられない
> 場合は、`BUN_INSTALL`/`PATH` の export を `~/.zshenv`（または `~/.bashrc`）へ写す。

## インストール

以下のコピーは、[aidlc-workflows](https://github.com/awslabs/aidlc-workflows)
リポジトリを `v2` ブランチで clone した場所から行う:

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

```bash
mkdir -p your-project/.kiro your-project/aidlc
# Safe on fresh installs; required when upgrading from v2.5.56 or earlier.
for retired_hook in \
  audit-logger block mint runtime-compile stop sync-statusline
do
  rm -f \
    "your-project/.kiro/hooks/aidlc-${retired_hook}.json" \
    "your-project/.kiro/hooks/aidlc-${retired_hook}.kiro.hook"
done
cp -R dist/kiro-ide/.kiro/. your-project/.kiro/
cp -R dist/kiro-ide/aidlc/. your-project/aidlc/     # the workspace shell (spaces/default/memory) — a sibling of .kiro/, not inside it
cp dist/kiro-ide/AGENTS.md your-project/AGENTS.md   # merge if you already have one
```

削除ループは v2.5.57 の hook 名マイグレーションである。overlay コピーは廃止された
登録を削除できない。そのまま残せば旧名と新名の両方が登録されてしまう。このループは
新規インストールでは no-op である。そのクリーンアップの後、`cp -R <src>/. <dst>/` の形は
ツリーの**中身**をコピーする — `your-project/.kiro` が既にある場合も無い場合も同じである。
素の `cp -r dist/kiro-ide/.kiro your-project/.kiro` は既存の `.kiro/` の中に 2 つ目の
`.kiro` を入れ子にし、IDE は新しいファイルを決して見ない。

`aidlc/` ディレクトリはワークスペースシェルである — エンジンが読む構築済みの
`aidlc/spaces/default/memory/` メソッドツリーを同梱する。`.kiro/` の**兄弟**なので
別にコピーする（もしくは `dist/kiro-ide/` ツリー全体を一度にコピーする）。
これが無いと `/aidlc --doctor` の「workspace shell ready」チェックが失敗する。

`your-project/` を Kiro IDE で開く。インストールが同梱するもの:

- `.kiro/skills/aidlc/SKILL.md` — `/aidlc` の呼び出しで読み込まれる conductor。
  同梱の `.kiro/settings/cli.json` と agent-v1 の JSON ファイルは CLI 専用の
  互換サーフェスであり、IDE の既定エージェントを選択しない。
- `.kiro/steering/aidlc-active-memory.md` — 常時包含の IDE steering。そのライブ
  ファイル参照が、conductor と委譲先エージェントの両方に向けてアクティブ space の
  memory ファイルをプリロードする。
- `.kiro/hooks/aidlc-*.json` — IDE ネイティブの v2 hook 形式で登録されたフレームワークの
  hook。IDE の Agent Hooks パネルに現れる。（Kiro IDE 1.x は、harness が以前同梱していた
  レガシーの `.kiro.hook` 形式をもう実行しない。それらのビルドではレガシー hook は
  黙って不活性になる。）

チャットパネルで `/aidlc --doctor` を実行してセットアップを検証し、
`/aidlc <description>` でワークフローを開始する。

## 使い方

Claude Code の harness と同一である: `/aidlc <description>` がワークフローを開始し、
`/aidlc --status` が位置を報告し、`/aidlc --doctor`・`--stage`・`--phase`・`--depth`・
`--test-strategy` はすべて動き、stage 別（`/aidlc-application-design`）と scope 別
（`/aidlc-feature`）のランナースキルもインストールされている。init コマンドは無い —
同梱のシェルがワークスペースをスキャフォールドし、最初の `/aidlc` で最初の intent が
自動 birth する。

## Kiro IDE での hook の動き方

Kiro IDE は `.kiro/hooks/` 配下の v2 hook JSON ファイル
（`{"version":"v1","hooks":[{name,trigger,matcher,action}]}`、PascalCase の
trigger）で hook を登録する（エージェント JSON 内の `hooks` ブロックを読む Kiro CLI
とは別の機構）。各 hook は共有の `aidlc-kiro-adapter.ts` シムを経由するコマンドを
実行し、シムが IDE の hook イベントをバイト共有の core hook が期待する形に正規化する。

Kiro IDE 1.x は hook のコンテキストを **stdin 上の JSON**（snake_case:
`{ session_id, tool_name, tool_input, tool_response }`）で渡す。より古い 0.12 ビルドは代わりに
`USER_PROMPT` 環境変数を camelCase の等価物で設定し、アダプタは両方を受け入れる）。
捕捉される PostToolUse の write / shell イベントは、どちらのチャネルでもツールの
input を空のままにするので、書かれたパスは結果テキストから復元する必要があり、
audit tail の hook（`rebuild-stage-graph`・`sync-workflow-state`）は audit トレイルから
走る。graph-rebuild の経路はさらに shell の結果とセッション identity を保持するので、
成功した `intent-create` が呼び出したセッションに束縛される: モダンなイベントは
正確な `session_id` を運び、レガシーチャネルは SessionStart が保持する合成 identity を
再利用する。モダンな Stop も同様に自身の event-local な `session_id` を優先し、
並走する一方のチャットが他方のチャットの post-create 引き渡し receipt を消費して
しまうのを防ぐ。レガシーの agentStop は保持された identity へフォールバックする。
より新しい 1.x ビルドは一部の PreToolUse と委譲の input を populate する。
アダプタはそれらのフィールドに依存せずに保持する。

ペイロードの取得は**ペイロードに依存するターゲットに限定してゲートされる**
（`audit-and-sensors`・`log-subagent`・`rebuild-stage-graph`）に加え、モダンな
`session_id` のための `session-start` と `continue-workflow`。0.12 ビルド（一度も
書き込まずに stdin を開く）では、空でない `USER_PROMPT` が即座に消費される。それ以外では、
アダプタは 2 秒の broken-channel 上限付きで 1.x の stdin チャネルを読む。他のすべての
ターゲット — すべての `PreToolUse` で発火する `block` を含む — はどちらのチャネルにも
触れず、ゼロレイテンシの経路を保つ。

| Hook | trigger（matcher） | 目的 |
|------|-------------------|---------|
| `aidlc-session-start` | `SessionStart` | セッションごとに 1 度、ワークフローの再開文脈を注入（レガシーの 1.0 以前のファイルはプロンプトごとの `promptSubmit` に配線されたまま — その世代には session-start の trigger が無い） |
| `aidlc-mint` | `UserPromptSubmit` | すべてのプロンプトで human-turn イベントを記録（human-presence gate） |
| `aidlc-continue-workflow` | `Stop` | forwarding loop の audit（助言のみ。IDE では Stop の trigger はブロックできない — 強制は conductor 自身の Stop プロトコルに依る） |
| `aidlc-block` | `PreToolUse` | 承認 gate が開いていて以降に人間が行動していない間、ツール呼び出しをハードブロック（human-presence の床） |
| `aidlc-write-audit-log` | `PostToolUse`（`fs_write\|str_replace\|fs_append`） | 成果物の作成 / 更新を記録し、続けて適用される sensor を発火（パスはツールの結果から） |
| `aidlc-log-subagent` | `PostToolUse`（`^(subagent_.+\|invoke_sub_agent)$`） | 委譲先の identity 付きで `SUBAGENT_COMPLETED` を記録。matcher が広いのでどの委譲名もアダプタに届く。アダプタは補助的な `subagent_response` シェルを捨てる |
| `aidlc-rebuild-stage-graph` | `PostToolUse`（`execute_bash`） | runtime グラフを再コンパイル（audit 末尾で判定） |
| `aidlc-sync-workflow-state` | `PostToolUse`（`execute_bash`） | audit の最新 `STAGE_STARTED` から `Current Stage` を前方専用で同期（IDE は解析できる task ペイロードを一切出さない） |

`aidlc-session-end` には **v2 の登録が無い**: IDE の `Stop` trigger は会話の終了ではなく
アシスタントの各ターンの終わりに発火するため、登録すると同一セッション内のプロンプト間に
偽の `SESSION_ENDED` を追記してしまう。IDE が本物の session-end イベントを露出するまで
レガシー専用（`agentStop`、1.0 以前のビルド）にとどまる — IDE 1.x では `SESSION_ENDED` は
記録されない。

発火のたびにチャットに「Run Command Hook」の行が見える。

### hook のデバッグ

hook が期待どおりに振る舞わないときは、デバッグログを有効にすると各 hook が決定の経路
（どの分岐を通ったか、解決したパス、なぜ終了したか）を
`<record>/.aidlc-hooks-health/hook-debug.log` に追記する。**既定は無効** — 通常の実行では
ログは書かれず、オーバーヘッドも無い。有効化の方法は 2 つあり、どちらでも動く:

- **ファイルシステムのマーカー（Kiro IDE では最も簡単）:** プロジェクトで
  `touch aidlc/.aidlc-hook-debug`。次の hook 発火から即座に効く — IDE の再起動は不要 —
  `rm aidlc/.aidlc-hook-debug` で無効に戻る。
- **環境変数:** `export AIDLC_HOOK_DEBUG=1`。IDE は hook を非対話シェルで走らせるため、
  そのシェルが読む場所に設定する — export を `~/.zshenv`（zsh）か `~/.bashrc`（bash）に
  足して IDE を再起動する。

## Kiro IDE での違い

| 領域 | Claude Code | Kiro IDE |
|------|-------------|----------|
| hook の登録 | `settings.json` の `hooks` ブロック | `.kiro/hooks/aidlc-*.json` の v2 hook ファイル（IDE >= 1.0）+ `.kiro/hooks/aidlc-*.kiro.hook` のレガシーファイル（1.0 以前）。両方同梱で二重発火はしない |
| gate と質問 | `AskUserQuestion` ウィジェット | 番号付きの散文の選択肢（番号で回答）。`[Answer]:` タグ付きの質問ファイルが正であることは変わらない |
| ステータスライン | 現在の stage + モデル + コンテキスト % | 利用不可 — `/aidlc --status` と各 gate の進捗行を使う |
| dispatch される stage（2.1 pipeline・2.2 subagent・2.4 mob・3.5 subagent） | `Task` ツール | Kiro の `subagent` ツール → エージェント設定（全 14 ペルソナ）。IDE は委譲先のツール許可をエージェント `.md` の frontmatter（`tools:`）から読む。パッケージング時に注入され、agent-v1 の JSON は CLI 専用 |
| Construction の swarm | 並列 `Task` の床、任意の ultracode Workflow | subagent のファンアウトのみ。`AIDLC_USE_SWARM=1` は no-op として告知される |
| セッションの audit イベント | `SESSION_STARTED/RESUMED/ENDED`、`SESSION_COMPACTED` | IDE 1.x では `SESSION_STARTED` のみ（本物の session-end の trigger が無い — `SESSION_ENDED` は 1.0 以前のビルドでレガシー hook によってのみ記録される。pre-compaction のイベントは無い） |
| MCP サーバー | 5 つ同梱（`.mcp.json`: `context7` + 4 つの AWS サーバー） | 同梱なし |

それ以外のすべて — 状態機械、audit トレイル、intent 別 record dir
（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）配下の成果物、learnings の儀式、
sensor、scope、depth / テスト戦略 — は同一に振る舞う。同一*である*からだ:
同じツールが `.kiro/tools/` から走る。

プロジェクトの `aidlc/` ワークスペースは harness 非依存である。プロジェクトを harness 間で
移す（または並走させる）ことはサポートされているが未テストである。アクティブなワークフローを
持つ衝突した harness セットアップを検出すると `/aidlc --doctor` が警告する。

## フレームワーク開発者向け

`dist/kiro-ide` は `core/` + `harness/kiro-ide/` から `bun scripts/package.ts kiro-ide` で
**生成**される（`{{HARNESS_DIR}}` トークンを `.kiro` に置換し、`rules/` → `steering/` に
リネームした core のコピー）。`bun scripts/package.ts --check` がドリフトガードで CI で走る。
authored な Kiro IDE のサーフェスは `harness/kiro-ide/` に住む: orchestrator のスキル
（`skills/aidlc/`）、常時包含の active-memory steering（`steering/`）、CLI 互換の
エージェント JSON（`agents/`）、hook アダプタと v2 hook JSON ファイル（`hooks/`）、
CLI 専用の `settings/cli.json`、`AGENTS.md` —
編集するのはそれら（または `core/`）であり、生成された `dist/kiro-ide` では決してない。

IDE の harness は CLI の harness（`harness/kiro/`）と 4 点で異なる:
`/aidlc` スキルが（`settings/cli.json` で選択されるエージェントではなく）conductor である。
v2 hook JSON ファイルを同梱する（CLI はエージェント JSON の `hooks` ブロックに依存し、
IDE はそれを無視する）。常時包含の steering を通じて standing rule をプリロードする
（CLI 専用のエージェント resources ではなく）。そして manifest が委譲先エージェントの `.md`
ファイルに `tools:` の frontmatter 許可を注入する（`frontmatterAdditions`）。IDE は委譲された
subagent のツールを agent-v1 の JSON ではなく `.md` frontmatter から解決するためで、許可が
無いと IDE の委譲先はツール無しで走ることになる。frontmatter の許可はスコープ無しである点に注意
（IDE にはそこに `allowedCommands`/`allowedPaths` の同等物が無い）。CLI の JSON サンドボックス
より広い。
[新しい harness への移植](../../harness-engineering/09-porting-to-a-new-harness.md) を参照。

## 次のステップ

インストールとアクティベーションは済んだ？ 方法論はどの harness でも同じである —
中立の章で続きを:

- [最初のワークフロー](../02-your-first-workflow.md) — 注釈付きの end-to-end 実行。
- [Phase と Stage](../04-phases-and-stages.md) — 5 つの phase と 32 の stage。
- [Scope・Depth・テスト戦略](../05-scopes-and-depth.md) — 実行の適切なサイズ選び。
- [用語集](../glossary.md) — すべての用語の定義。

他の harness: [Codex CLI 上の AI-DLC](codex-cli.md) · [Cursor 上の AI-DLC](cursor.md) · [harness ファミリーの索引](README.md)。
