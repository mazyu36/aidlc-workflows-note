# Kiro CLI で AI-DLC を動かす

> [!NOTE]
> Kiro CLI 上の AI-DLC は **Claude Opus 4.8** で最もよく動き、これには
> **Kiro の有償プラン**が必要である。弱いモデルでは conductor が任意の stage 手順
>（reviewer のパス、learnings の儀式）を飛ばしたり、承認 gate を急いだりすることがある。
> IDE 向けディストリビューションは別に文書化されている:
> [Kiro IDE で AI-DLC を動かす](kiro-ide.md)。

フレームワークの harness のひとつ: `dist/kiro/` は同じ AI-DLC の方法論を
[Kiro CLI](https://kiro.dev/docs/cli/) で動かす。1 つの決定論的な core
— ツール・32 の stage ファイル・プロトコル・knowledge・sensor・scope・rule —
はすべての harness でバイト共有され、シェル（skills・エージェント設定・
hook の束線・アクティベーション）だけが異なる。

## 前提条件

- **Kiro CLI ≥ 2.6**（`kiro-cli --version`）、ログイン済み（`kiro-cli login`）
- **bun** が PATH にあること（`curl -fsSL https://bun.sh/install | bash`）

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
cp -R dist/kiro/.kiro/. your-project/.kiro/
cp -R dist/kiro/aidlc/. your-project/aidlc/    # the workspace shell (spaces/default/memory) — a sibling of .kiro/, not inside it
cp dist/kiro/AGENTS.md your-project/AGENTS.md  # merge if you already have one
```

`aidlc/` ディレクトリはワークスペースシェルである — エンジンが読む構築済みの
`aidlc/spaces/default/memory/` メソッドツリーを同梱する。`.kiro/` の**兄弟**なので
別にコピーする（もしくは `dist/kiro/` ツリー全体を一度にコピーする）。
これが無いと `/aidlc --doctor` の「workspace shell ready」チェックが失敗する。

次に、プロジェクトでセッションを開始する:

```bash
cd your-project && kiro-cli chat
```

インストールは `chat.defaultAgent: "aidlc"` を持つ `.kiro/settings/cli.json` を同梱するため、
AI-DLC の conductor エージェントが既定で有効になる — `/aidlc` がそのまま動く。
**このワークスペース設定は、あなたが設定済みかもしれないグローバルの既定エージェントより
優先される**。自分の既定を使いたければ、この設定を削除して代わりに
`kiro-cli chat --agent aidlc` を使う。

どの同梱エージェントもモデルを固定しない: 固定した ID はそのモデルがユーザーの
Kiro インストールで有効なときにしか解決しないため、conductor と全 14 ペルソナは
セッションのモデル（`/model`）を継承する。同じ `cli.json` は
`chat.modelDefaults` 経由で、モデル別の推論 effort の CONDITIONAL な既定を 1 つ同梱する:
`claude-opus-4.8` には `xhigh`。これはセッションが実際にそのモデルで走るとき
（推奨セットアップ）にだけ適用され、そうでなければ不活性である。
Kiro にはエージェント別の effort サーフェスが無いため、effort はこの方法でモデルに
乗せるしかない。このファイルを読むのは Kiro CLI だけである — Kiro IDE は
`cli.json` を無視し、代わりに拡張のモデル別既定を適用する。セッション単位の上書きは
チャットの `/effort <level>` または `kiro-cli chat --effort <level>`
（low|medium|high|xhigh|max）で行う — セッションフラグとユーザーレベルの
`~/.kiro/settings/cli.json` は、どちらもワークスペースの既定より優先される。

## 使い方

プロジェクトで `kiro-cli chat` を開始し、`/aidlc <description>` で conductor を呼び出す。
`/aidlc --status` が位置を報告し、`/aidlc --doctor`・`--stage`・`--phase`・`--depth`・
`--test-strategy` はすべて動く。ワークスペースの移動は `/aidlc intent [name]`・
`/aidlc space [name]`・`/aidlc space-create <name>` を使う。stage 別
（`/aidlc-application-design`）と scope 別（`/aidlc-feature`）のランナースキルも
インストールされている。

## Kiro での違い

| 領域 | Claude Code | Kiro CLI |
|------|-------------|----------|
| gate と質問 | `AskUserQuestion` ウィジェット | 番号付きの散文の選択肢（番号で回答）。`[Answer]:` タグ付きの質問ファイルが正であることは変わらない |
| ステータスライン | 現在の stage + モデル + コンテキスト % | 利用不可 — `/aidlc --status` と各 gate の進捗行を使う |
| dispatch される stage（2.1 pipeline・2.2 subagent・2.4 mob・3.5 subagent） | `Task` ツール | Kiro の `subagent` ツール → エージェント設定（全 14 ペルソナが設定を同梱） |
| Construction の swarm | 並列 `Task` の床、任意の ultracode Workflow | subagent のファンアウトのみ。`AIDLC_USE_SWARM=1` は no-op として告知される |
| セッションの audit イベント | `SESSION_STARTED/RESUMED/ENDED`、`SESSION_COMPACTED` | `SESSION_STARTED` のみ（Kiro には session-end / pre-compaction の hook が無い） |
| forwarding loop の強制（Stop hook） | 対話 + ヘッドレス | 対話セッションのみ — `--no-interactive` の実行は stop-hook のブロックを尊重しない |
| 権限 | `settings.json` の許可リスト | `aidlc` エージェント設定: 事前承認は `bun .kiro/tools/*` だけ。他のシェルコマンドはプロンプトが出る |
| ウェルカムメッセージ | セッション開始時に `settings.json` の `companyAnnouncements` から描画 | 無し — Kiro にはウェルカム描画の同等物が無い。session-start の hook は再開の文脈だけを注入する |
| MCP サーバー | 5 つ同梱（`.mcp.json`: `context7` + 4 つの AWS サーバー） | 同梱なし。Kiro の MCP 設定機構はここではまだ文書化されていない — 実務上は今日 Claude 専用 |

それ以外のすべて — 状態機械、audit トレイル、intent record dir
（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）配下の成果物、learnings の儀式、
sensor、scope、depth / テスト戦略 — は同一に振る舞う。同一*である*からだ:
同じツールが `.kiro/tools/` から走る。

プロジェクトの `aidlc/` ワークスペースは harness 非依存である。プロジェクトを harness 間で
移す（または並走させる）ことはサポートされているが未テストである。アクティブなワークフローを
持つ衝突した harness セットアップを検出すると `/aidlc --doctor` が警告する。

## フレームワーク開発者向け

`dist/kiro` は `core/` + `harness/kiro/` から `bun scripts/package.ts kiro` で
**生成**される（`{{HARNESS_DIR}}` トークンを `.kiro` に置換し、`rules/` → `steering/` に
リネームした core のコピー）。`bun scripts/package.ts --check` がドリフトガードで、
CI（t145）で走る。authored な Kiro のサーフェスは `harness/kiro/` に住む:
orchestrator のスキル（`skills/aidlc/`）、エージェントの JSON（`agents/`）、
hook アダプタ（`hooks/aidlc-kiro-adapter.ts`）、`settings/cli.json`、`AGENTS.md` —
編集するのはそれら（または `core/`）であり、生成された `dist/kiro` では決してない。
[新しい harness への移植](../../harness-engineering/09-porting-to-a-new-harness.md) を参照。

Claude の双子と並ぶライブの TUI ジャーニーテストが存在する:
`tests/e2e/t-tui-kiro-intent-capture.serial.test.ts` は、同梱ツリーに対して
`kiro-cli chat` をキーストロークで駆動する（番号付き散文の gate に「1」= 推奨の選択肢で
回答し、ディスク上の状態で終了判定する）。`AIDLC_KIRO_TUI_LIVE=1` でオプトインし、
tmux・`kiro-cli`・ログイン済み Kiro セッションが無ければ理由付きでスキップする。

## 次のステップ

インストールとアクティベーションは済んだ？ 方法論はどの harness でも同じである —
中立の章で続きを:

- [最初のワークフロー](../02-your-first-workflow.md) — 注釈付きの end-to-end 実行。
- [Phase と Stage](../04-phases-and-stages.md) — 5 つの phase と 32 の stage。
- [Scope・Depth・テスト戦略](../05-scopes-and-depth.md) — 実行の適切なサイズ選び。
- [用語集](../glossary.md) — すべての用語の定義。

他の harness: [Codex CLI 上の AI-DLC](codex-cli.md) · [harness ファミリーの索引](README.md)。
