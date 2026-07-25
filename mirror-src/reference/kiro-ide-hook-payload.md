# Kiro IDE hook payload — 実証リファレンス

Kiro IDE が `runCommand` hook にどうコンテキストを届けるか。stdin・argv・完全な
環境をダンプする probe `.kiro.hook` ファイルを登録し、Kiro IDE 0.12-main 上でライブに
捕捉した。これは `harness/kiro-ide/` アダプタの IDE ブランチの証拠ベースである;
CLI harness（`harness/kiro/`）は、異なる stdin ベースの機構を使う。

## チャネル: stdin ではなく `USER_PROMPT` 環境変数

Kiro IDE の `runCommand` hook は、そのイベントコンテキストを stdin ではなく
**`USER_PROMPT` 環境変数** を通じて受け取る。

- **stdin** は開かれるが、書き込まれることも閉じられることもないため、`Bun.stdin.text()` はハングする。旧アダプタの stdin 読み取りは IDE では決して動作し得なかった（2 秒のタイムアウトに落ち、空の payload で進行した）。
- **`USER_PROMPT`** は次の形の JSON 文字列である:

  ```json
  { "toolName": "fs_write", "toolArgs": {}, "toolResult": "Created the /abs/path/file.md file.", "toolSuccess": true }
  ```

`VSCODE_IPC_HOOK` / `VSCODE_PID` も IDE には存在する（CLI には無い）が、アダプタは
コンテキストチャネルとして `USER_PROMPT` を手がかりにする。

## イベントごとのキャプチャ

| イベント | `toolName` | `toolArgs` | `toolResult` | 復元可能か？ |
|-------|-----------|-----------|-------------|--------------|
| postToolUse(write) — create | `fs_write` | `{}`（空） | `Created the <ABS_PATH> file.` | path: `toolResult` の散文からのみ |
| postToolUse(write) — edit | `str_replace` | `{}`（空） | `Replaced text in <ABS_PATH>` | path: `toolResult` の散文からのみ |
| postToolUse(write) — append | `fs_append` | `{}`（空） | `Appended the text to the <ABS_PATH> file.` | path: `toolResult` の散文からのみ |
| postToolUse(shell) | `execute_bash` | `{}`（空） | `Output:\n<stdout>\n\nExit Code: 0` | command: **復元不可**（stdout のみ） |

### 重大な制限

1. **`toolArgs` は常に `{}` である。** IDE は tool の入力を決して渡さない。したがって、書き込まれたファイルパスは `toolResult` の散文から解析せねばならず、shell コマンドはまったく存在しない（stdout と exit code のみ）。
2. **stdin は死んでいる。** アダプタは `process.env.USER_PROMPT` を読む。
3. **`toolResult` 中のパスは workspace 相対である**が、core hook は絶対の record root と比較する — そこでアダプタは、転送する前にそれらを絶対パスに解決する。

## 各 hook への帰結

- **audit-logger / sensor-fire** — 復元可能: `toolResult` からファイルパスを掻き取り、絶対パスに解決し、core hook に Claude 形の `{tool_input:{file_path}}` を渡す。既知のパターンに文言が合致しない write クラスの tool は、可視の hook-drop を記録する（静かな no-op には決してならない）。
- **runtime-compile** — shell コマンドは復元不可なので、IDE 経路は command フィルタを落とし、純粋に audit tail でゲートする（mtime の冪等性ガード付きで、残存する遷移 — 例えば `WORKFLOW_COMPLETED` の後 — が後続のすべての shell コマンドで再コンパイルを起こさないようにする）。
- **sync-statusline** — IDE は task payload を与えないので、audit tail 中の最新の `STAGE_STARTED` から現在の stage を導出する。これは **forward-only** のミラーである: `Current Stage` を完了済みまたはスキップされた stage に巻き戻すことは決してなく、ワークフローが `Running` でないときには決して発火しない（完了したワークフローの復活を防ぐ）。`shell` イベントに配線されている — `spec` イベントは IDE では決して発火しない。
- **session-start / session-end / stop** — payload を必要としない; 変更なし。

## toolResult パス抽出パターン

| toolName | 文言 | 正規の tool |
|----------|---------|----------------|
| `fs_write` | `Created the <PATH> file.` | Write |
| `str_replace` | `Replaced text in <PATH>`（末尾に ` (N occurrences)` を伴うことがある） | Edit |
| `fs_append` | `Appended the text to the <PATH> file.` | Edit |

extractor はマッチ前に末尾の空白/改行をトリムし、`str_replace` 形式からは末尾の括弧を剥ぐ。`fs_write` は `Write` に対応づけられる; `str_replace`/`fs_append` は `Edit` に対応づけられる（どちらも既存のファイルを対象にする → core audit-logger は `ARTIFACT_UPDATED` を記録する）。
