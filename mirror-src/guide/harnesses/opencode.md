# opencode 上の AI-DLC

`dist/opencode/` は、オープンソースの **opencode** harness（opencode.ai）向けの、フレームワークの harness ディストリビューションのひとつである。1 つの決定論的 core、多くの harness: エンジン、状態機械、audit ログ、グラフ、swarm の referee、learnings の gate はすべてのディストリビューションでバイト同一 — 異なるのはシェルだけである。このツリーは `core/` + `harness/opencode/` から `bun scripts/package.ts opencode` で**生成**される。決して手で編集しないこと（ドリフトガードが CI を落とす）。

## レイアウト: 意図的な 2 つの dot ディレクトリ

opencode は `.opencode/tools/` と `.opencode/tool/` 配下のすべての `*.ts` をカスタムツール定義として自動インポートし、CLI 形式のエンジンスクリプト（トップレベルの dispatch・`process.exit`）のインポートはセッションをクラッシュさせる（opencode 1.17.18 でライブ再現済み）。そのためこのディストリビューションは分割する:

- **`.aidlc/`** — AIDLC のエンジンツリー（tools・hooks・skills・agents・
  knowledge・scopes・sensors・aidlc-common）。opencode はここを決してスキャンしない。
  同梱の `opencode.json` が `skills.paths: [".aidlc/skills"]` を登録するため、
  orchestrator のスキルと生成された全ランナーはそこから発見される。
- **`.opencode/`** — ネイティブに消費されるサーフェスだけ: 14 のペルソナ subagent
  （`agents/*.md`・`mode: subagent`）、`/aidlc` コマンド（`command/aidlc.md`）、
  hook アダプタのプラグイン（`plugin/aidlc-opencode-adapter.ts`。opencode が自動発見）。

## 前提条件

- **opencode ≥ 1.17** — このインストールが依存するプラグインの hook サーフェス
  （`tool.execute.before`・`tool.execute.after`・`chat.message`・`session.idle`・
  `experimental.session.compacting`）と、プロジェクトローカルの skill / エージェント発見。
  `opencode --version` で確認する。
- **bun** — どの harness とも同じ要件。すべてのツールと hook は bun 経由で走る。
  アダプタのプラグインは bun を `PATH`、次に `~/.bun/bin/bun` から解決する。
- **モデルプロバイダ** — 同梱のプロジェクト `opencode.json` はセッションモデルを
  固定しない。グローバルの opencode 設定が供給する。tier 付きのペルソナは
  `amazon-bedrock/global.anthropic.claude-sonnet-4-6` を固定する — プロバイダが違うなら
  プロジェクトの `opencode.json` でエージェント別に上書きする。

## インストール

以下のコピーは
[aidlc-workflows](https://github.com/awslabs/aidlc-workflows) リポジトリの
`v2` ブランチの clone から行う:

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

1. ディストリビューションをプロジェクトへコピーする:

   ```bash
   cp -r dist/opencode/.aidlc/    your-project/.aidlc/
   cp -r dist/opencode/.opencode/ your-project/.opencode/
   cp -r dist/opencode/aidlc/     your-project/aidlc/      # the workspace shell — a sibling of .aidlc/, not inside it
   cp dist/opencode/opencode.json your-project/opencode.json  # or merge into yours
   cp dist/opencode/AGENTS.md     your-project/AGENTS.md      # or merge into yours
   ```

   `opencode.json` は 3 つの荷重を受けるブロックを運ぶ: `skills.paths`（`.aidlc/skills`
   からのスキル発見）、`instructions`（メソッドツリーの取り込み — `/aidlc space <name>`
   が向け直す）、そして AIDLC の bash エントリポイントと `.aidlc/tools/`・`.aidlc/hooks/`
   配下の編集に対する権限ルール。既存の `opencode.json` や `opencode.jsonc` にマージする
   場合は、3 つとも保つこと。アダプタが権限境界を強制する: 対象はパッケージ済みツリーから
   埋め込まれたエントリポイントであり、連結・リダイレクト・展開・コマンド置換なしの
   1 つの直接コマンドとして呼び出されなければならない。エンジンコードの編集は承認を求める。

2. ワークフローを始める前に、同梱 `AGENTS.md` の「Git Integration」節にある
   `.gitignore` エントリを適用する（クローン別の audit シャードは意図的にコミットされ、
   カーソルとマシンローカルのランタイムは無視されたままになる）。

3. プロジェクトで opencode を起動し、`/aidlc --doctor` を実行し、続けて `/aidlc` と
   作りたいものを打つ。

## この harness での違い

- **質問は番号付きの散文の選択肢として描画される**（構造化質問のウィジェットは無い）。
  `[Answer]:` タグ付きの質問ファイルが正であることは変わらない。
- **hook はアダプタのプラグインに乗る。** opencode には hooks.json / settings の hook
  レジストリが無い。`.opencode/plugin/aidlc-opencode-adapter.ts` が opencode のプラグイン
  hook の瞬間を `.aidlc/hooks/` の core hook 本体（bun のサブプロセスとして実行）へ
  対応付ける: ツール実行前の reviewer 読み取りスコープと AIDLC bash 境界、
  write / edit / apply_patch での audit + sensor、bash での runtime-compile、
  todowrite での statusline 同期、task での subagent 記録、human turn ごとの presence の
  記録、コンパクション前の状態検証。
- **forwarding loop の強制は助言的。** Stop の継ぎ目は `session.idle` イベント —
  反応的であってブロックではない。core の stop hook が `block` と答えると、プラグインは
  ナッジのプロンプトを注入してループを再係合させる（human presence を決して記録しないよう
  センチネルで印を付ける）。チャット中・停止中の人間は hook の対話上限が解放する。
- **ペルソナはネイティブの subagent**（`mode: subagent`）。conductor は大半の stage で
  inline に纏い、2 つの subagent stage（2.1 reverse-engineering・3.5 code-generation）では
  `task` ツールで委譲する。ネイティブの権限マップが `task` を拒否するため、委譲された
  エージェントが再委譲することはできない。plugin の合成は、plugin のペルソナにも同じ
  `.opencode/agents/` の双子を出力する。
- **space の切り替えは JSONC を保つ。** `/aidlc space <name>` は `opencode.json` でも
  `opencode.jsonc` でも、コメントや末尾カンマを剥がさずにメソッドの glob を更新し、
  明示的なペルソナの memory パスも揃えて保つ。
- **Construction の swarm は task ツールのファンアウトのみ**（`AIDLC_USE_SWARM=1` は
  大きな音の no-op — Workflow ツールは存在しない）。
- **session-end の瞬間が無い** — `SESSION_ENDED` の audit イベントは発行されない。
  コンパクション前の検証は発火する（`experimental.session.compacting`）。
- **ステータスライン / ウェルカムメッセージは無い** — `/aidlc --status` と gate の
  進捗行を使う。
- **MCP サーバー**: 同梱なし。必要なら `opencode.json` の `mcp:` 配下に自分で設定する。

## インストールの検証

```bash
bun .aidlc/tools/aidlc-utility.ts doctor    # all checks pass on a fresh copy
opencode run --command aidlc -- "--status"  # /aidlc --status through the harness
```

doctor の opencode 固有チェック: `.opencode/plugin/` にアダプタのプラグインがあること、
プロジェクトルートに `opencode.json` か `opencode.jsonc` があること、
`.opencode/command/aidlc.md` があること。
