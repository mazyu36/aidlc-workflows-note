# GitHub Copilot（CLI + VS Code）上の AI-DLC

`dist/copilot/` は、**GitHub Copilot** 向けのフレームワークの harness ディストリビューションのひとつであり、1 つのインストールが両方の Copilot サーフェス — スタンドアロンの Copilot CLI（`copilot`）と VS Code のエージェントモード — に対応する。GitHub は両者を同じプロジェクト発見パス（`.github/skills/`、`.github/agents/`、`.github/hooks/`、ルートの `AGENTS.md`）に収束させたため、フレームワークは両方が読む 1 つのツリーを同梱する。1 つの決定論的 core、多くの harness: エンジン、状態機械、audit ログ、グラフ、swarm の referee、learnings の gate はすべてのディストリビューションでバイト同一 — 異なるのはシェルだけである。このツリーは `core/` + `harness/copilot/` から `bun scripts/package.ts copilot` で**生成**される。決して手で編集しないこと（ドリフトガードが CI を落とす）。

## レイアウト: エンジンディレクトリと .github シェル

- **`.aidlc/`** — AIDLC のエンジンツリー（tools・hooks + Copilot アダプタ・agents・knowledge・scopes・sensors・aidlc-common）。どちらの Copilot サーフェスもこれをスキャンしない。ユーザーに見えるものはすべて `.github/` に乗る。
- **`.github/`** — ネイティブに消費される、`aidlc` 名の出力物のみ: hook の配線（`hooks/aidlc.json`）、14 のペルソナカスタムエージェント（`agents/aidlc-*-agent.md`）、そしてスキルツリー全体（`skills/aidlc*/` — orchestrator、stage 別ランナー、scope ランナー、セッションスキル）。リポジトリ自身の `.github/` の内容（workflows、templates）は無変更のままである: インストールはこれらのファイルを MERGE する。すべて prefix によって衝突フリーである。

## 前提条件

- **Copilot CLI ≥ 1.0.74 かつ/または VS Code ≥ 1.130** — PascalCase の hook 登録（両サーフェスとも同一の snake_case ペイロードを配送する）、ブロッキングの PreToolUse deny チャネル、ブロッキングの Stop hook、`.github` の skills/agents 発見の検証済みラインである。`copilot --version` / `code --version` で確認する。（VS Code のエージェント hook はプレビュー機能である — doctor が下限を固定する。）
- **bun** — 他のすべての harness と同じ要件。すべてのツールと hook は bun 経由で走り、Copilot が spawn するシェルの PATH に bun が乗っていなければならない。
- **フォルダの信頼** — リポジトリの hook は、プロジェクトの絶対パスが `~/.copilot/config.json` の `trustedFolders` にあるときのみ実行される（CLI は最初の対話的使用時にプロンプトを出す）。ヘッドレスの `copilot -p` 実行にはさらに `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=1` が必要である。**未信頼 = すべての hook がどこにも警告を出さず黙って no-op になる** — `/aidlc --doctor` が両方を確認するサーフェスである。
- **モデルプロバイダ** — このインストールはモデルを何もピンしない。サインイン済みの Copilot はそのまま動く。BYOK は GitHub 認証を一切必要とせずに動く（例: Amazon Bedrock の Anthropic 互換エンドポイント: `COPILOT_PROVIDER_BASE_URL=https://bedrock-runtime.<region>.amazonaws.com/anthropic`、`COPILOT_PROVIDER_TYPE=anthropic`、bearer トークン、そして `COPILOT_MODEL=<catalog name>` + `COPILOT_PROVIDER_WIRE_MODEL=<Bedrock model id>` — `copilot help providers` がこの集合を文書化する）。VS Code では、モデルピッカーか Custom Endpoint プロバイダを使う。

## インストール

以下のコピーは、[aidlc-workflows](https://github.com/awslabs/aidlc-workflows) リポジトリを
`v2` ブランチで clone した場所から行う:

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

1. ディストリビューションをプロジェクトにコピーする:

   ```bash
   mkdir -p your-project/.aidlc your-project/aidlc your-project/.github
   cp -R dist/copilot/.aidlc/.  your-project/.aidlc/
   cp -R dist/copilot/aidlc/.   your-project/aidlc/    # the workspace shell — a sibling of .aidlc/, not inside it
   cp -R dist/copilot/.github/. your-project/.github/  # MERGE — everything is aidlc-prefixed, nothing of yours is overwritten
   cp dist/copilot/AGENTS.md    your-project/AGENTS.md # or merge into yours — keep the @-import block (the method include)
   ```

2. ワークフローを始める前に、同梱 `AGENTS.md` の「Git Integration」節にある `.gitignore`
   エントリを適用する（クローン別 audit シャードは意図的にコミットされ、カーソルとマシンローカルの
   ランタイムは無視されたままになる）。

3. フォルダを信頼する: プロジェクトで `copilot` を対話的に 1 回起動し、trust プロンプトを
   承認する（もしくはプロジェクトの絶対パスを `~/.copilot/config.json` の `trustedFolders` に
   追加する）。

4. `/aidlc --doctor` を実行し、続けて `/aidlc` に続けて作りたいものを渡す — どちらのサーフェスでも。

## この harness での違い

- **1 つのインストール、2 つのサーフェス。** Skills・personas・instructions・hook は CLI と
  VS Code のエージェントモードで同一に振る舞う。以下の差異は明示的に述べる。
- **質問は番号付きの散文の選択肢として描画される。** 両サーフェスともネイティブのピッカーツールを
  備えるが、ピッカーの回答はツール結果として返るため、human-presence ガードが要求する
  信頼済みの `UserPromptSubmit` イベントを発火しない。人間の次のチャットメッセージはそれを
  発火する。`[Answer]:` タグ付きの質問ファイルが正であることは変わらない。
- **Hook はネイティブに強制する。** アダプタ（`.aidlc/hooks/aidlc-copilot-adapter.ts`、
  `.github/hooks/aidlc.json` で配線）は core-guard の block を Copilot の
  `permissionDecision: deny` へ変換する — reviewer の読み取りスコープ境界と状態遷移ガードが
  実際にツール呼び出しを拒否する。SessionStart と Stop の応答は、CLI のトップレベルフィールドと
  VS Code が要求する `hookSpecificOutput` エンベロープの両方を運ぶ。
  CLI 上でライブ検証済み。VS Code のエージェントモードでは同じ deny/block チャネルが
  文書化されており、アダプタは `runTerminalCommand`・`createFile`・`editFiles`・`readFile`
  のような文書化された名前を正規化するが、IDE 側はまだライブ検証されていない — 検証されるまでは
  IDE の強制をベストエフォートとして扱う。
- **Hook の配線は設計により matcher フリーである**: VS Code は hook の matcher を解析するが
  無視する。そのため各アダプタターゲットは代わりに `tool_name` で自己フィルタする — matcher は
  IDE 上で黙って広がってしまう。
- **reviewer の identity は配送ではなく相関で得る**: PreToolUse のペイロードは呼び出しごとの
  agent フィールドを運ばない。アダプタは SubagentStart/SubagentStop（VS Code の
  `agent_type`/`agent_id` フィールドを含む）で委譲を括り、subagent が正確に 1 つだけアクティブな
  ときに identity を転送する。曖昧な重複はその呼び出しに対して fail open する（§12a の散文の
  境界が依然として支配する）。
- **Personas は `model:` の pin を運ばない。** 両サーフェスは model 値の構文で一致しない
  （CLI は frontmatter の文字列を BYOK プロバイダへそのまま転送する。IDE の表示名はそこで
  400 になる）。エージェントはセッションモデルを継承する — この harness での tier 投影は
  型により model 省略になる。
- **Worker persona は明示的な組み込みの `tools:` 許可リストを使う。** これは入れ子の委譲を
  禁止するため Copilot の `agent` 委譲ツールを省く。Copilot には all-except-agent の形式が
  無いため、委譲された worker は任意の MCP ツールを継承しない。
- **AIDLC の plugin は Copilot ネイティブのサーフェスを使う。** 合成された plugin の persona と
  生成された stage/scope ランナーは `.github/{agents,skills}` に置かれる。plugin の選択は
  これらのパスを再生成し、`.aidlc/skills` や `.opencode/agents` を決して作らない。
- **Session-end**: VS Code は SessionEnd を文書化していないため、共有 hook manifest は
  両ホストでこれを省く。アダプタは次の SessionStart で、推定した provenance で前セッションを
  調停する（codex のパターン）。
- **メソッドの include は AGENTS.md の `@`-import に乗る**（CLI 上でライブ検証済み。VS Code は
  `@`-import の展開を文書化しているがそこではまだライブ検証されていない）。
  `/aidlc space <name>` はブロックをその場で再ポイントし、`.github/agents/` の persona twin も
  含む。
- **ステータスラインは無い**。`/aidlc --status` と各 gate の進捗行を使う。
- **Construction の swarm は subagent のファンアウトのみ**（`AIDLC_USE_SWARM=1` は大きな音の
  no-op である）。
- **MCP**: 同梱なし。サーバーを追加する場合、サーフェスがここで分岐することに注意する — CLI は
  `~/.copilot/mcp-config.json` を読み、VS Code は `.vscode/mcp.json` を読む。conductor は
  それらを使えるが、委譲された worker persona は使えない。

## 検証

```bash
cd your-project
copilot -p "/aidlc --doctor" -s --allow-all-tools   # or run /aidlc --doctor in VS Code chat
```

doctor はエンジンツリーとすべてのアダプタ依存、ルートの `AGENTS.md`、`.github` の配線ファイル、
CLI のバージョン下限、フォルダの信頼を確認し、ヘッドレスの env var についてリマインドする。
この harness の決定論的エンジンテストは `tests/unit/t248-copilot-packaging.test.ts`・
`t249-copilot-adapter.test.ts`・`t250-copilot-adapter-security.test.ts` である。ライブ
ジャーニーは `tests/e2e/t-exec-copilot-status.serial.test.ts` で、
`AIDLC_COPILOT_EXEC_LIVE=1` でゲートされている。
