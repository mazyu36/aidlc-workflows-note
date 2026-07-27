# Kiro IDE hook payload - 実証リファレンス

Kiro IDE が `runCommand` hook にどうコンテキストを届けるか。チャネルは IDE の
世代によって異なる:

- **1.0 以前（0.12-main）:** コンテキストは **`USER_PROMPT` 環境変数**
  （camelCase の JSON）を通じて届く。stdin は開かれるが書き込まれることも
  閉じられることもない - 読むとハングする。
- **IDE >= 1.0（1.x）:** コンテキストは **stdin 上の JSON**（snake_case:
  `{ tool_name, tool_input, tool_response }`）として届く。`USER_PROMPT` は空である。

**現在のアダプタの振る舞い:** 同梱のアダプタは `USER_PROMPT` 環境変数
（1.0 以前のチャネル）だけを読む。stdin を決して読まない。`USER_PROMPT` が空になる
IDE 1.x では、ペイロードに依存する 2 つの対象
（`audit-and-sensors`・`log-subagent`）は発火するが、可視の hook drop を残して no-op になる。
残りの hook はペイロード非依存で、どちらの世代でも動く。stdin の
コンテキストチャネルはフォローアップの機能拡張として計画されている。

## 1.0 以前のチャネル: `USER_PROMPT` 環境変数

stdin・argv・完全な環境をダンプする probe `.kiro.hook` ファイルを登録し、
Kiro IDE 0.12-main 上でライブに捕捉した。

- **stdin** は開かれるが、書き込まれることも閉じられることもないため、`Bun.stdin.text()` はハングする。
- **`USER_PROMPT`** は次の形の JSON 文字列である:
  ```json
  { "toolName": "fs_write", "toolArgs": {}, "toolResult": "Created the /abs/path/file.md file.", "toolSuccess": true }
  ```

## IDE 1.x のチャネル: stdin（snake_case）

Kiro IDE 1.0.165 上でライブに捕捉した。stdin の payload の形（probe から
フィールドを逐語で写したもの）:

```json
{ "session_id": "sess_...", "hook_event_name": "PostToolUse", "cwd": "/path/to/project", "tool_name": "execute_bash", "tool_input": {}, "tool_response": "Output:\n...\nExit Code: 0" }
```

- 1.x では `USER_PROMPT` は空である。
- `toolSuccess` / `tool_success` のフィールドは無い - 明示的な `false`（1.x は
  決して送らない）だけが #417 の失敗書き込みガードを起動する; 不在は素通りする。
- `tool_input` はどちらの世代でも常に `{}` である - IDE は tool の入力を
  決して渡さない。

> **注記:** アダプタはまだ 1.x の stdin チャネルを消費しない。この節は
> フォローアップの実装のために観測された payload の形を文書化している。

`VSCODE_IPC_HOOK` / `VSCODE_PID` も IDE には存在する（CLI には無い）が、アダプタは
コンテキストチャネルとして `USER_PROMPT` を手がかりにする。

## イベントごとのキャプチャ

| イベント | `toolName` | `toolArgs` | `toolResult` | 復元可能か？ |
|-------|-----------|-----------|-------------|--------------|
| postToolUse(write) - create | `fs_write` | `{}`（空） | `Created the <ABS_PATH> file.` | path: `toolResult` の散文からのみ |
| postToolUse(write) - edit | `str_replace` | `{}`（空） | `Replaced text in <ABS_PATH>` | path: `toolResult` の散文からのみ |
| postToolUse(write) - append | `fs_append` | `{}`（空） | `Appended the text to the <ABS_PATH> file.` | path: `toolResult` の散文からのみ |
| postToolUse(shell) | `execute_bash` | `{}`（空） | `Output:\n<stdout>\n\nExit Code: 0` | command: **復元不可**（stdout のみ） |

### 重大な制限

1. **`toolArgs` は常に `{}` である。** IDE は tool の入力を決して渡さない。したがって、書き込まれたファイルパスは `toolResult` の散文から解析せねばならず、shell コマンドはまったく存在しない（stdout と exit code のみ）。
2. **stdin は現在のアダプタに読まれない。** 1.0 以前ではハングし（書き込まれず / 閉じられない）、
   1.x では payload を運ぶがアダプタはまだそれを消費しない。アダプタは
   `process.env.USER_PROMPT` だけを読む。
3. **`toolResult` 中のパスは workspace 相対である**が、core hook は絶対の record root と比較する - そこでアダプタは、転送する前にそれらを絶対パスに解決する。

## 各 hook への帰結

- **audit-logger / sensor-fire** - 1.0 以前では復元可能: `toolResult` からファイルパスを掻き取り、絶対パスに解決し、core hook に Claude 形の `{tool_input:{file_path}}` を渡す。既知のパターンに文言が合致しない write クラスの tool は、可視の hook-drop を記録する（静かな no-op には決してならない）。IDE 1.x ではこれらの対象は no-op になる（USER_PROMPT が空で、stdin は読まれない）。
- **runtime-compile** - shell コマンドは復元不可なので、IDE 経路は command フィルタを落とし、純粋に audit tail でゲートする（mtime の冪等性ガード付きで、残存する遷移 - 例えば `WORKFLOW_COMPLETED` の後 - が後続のすべての shell コマンドで再コンパイルを起こさないようにする）。
- **sync-statusline** - IDE は task payload を与えないので、audit tail 中の最新の `STAGE_STARTED` から現在の stage を導出する。これは **forward-only** のミラーである: `Current Stage` を完了済みまたはスキップされた stage に巻き戻すことは決してなく、ワークフローが `Running` でないときには決して発火しない（完了したワークフローの復活を防ぐ）。`shell` イベントに配線されている - `spec` イベントは IDE では決して発火しない。
- **session-start / stop** - payload を必要としない; 変更なし。（`session-end` に v2 の
  登録は無い - 根拠は harness ガイドを参照。）
- **log-subagent** - 1.0 以前では `toolResult` から委譲先の同一性を復元する。
  IDE 1.x では可視の hook drop を残して no-op になる（USER_PROMPT が空で、
  stdin は読まれない）。

## toolResult パス抽出パターン

| toolName | 文言 | 正規の tool |
|----------|---------|----------------|
| `fs_write` | `Created the <PATH> file.` | Write |
| `str_replace` | `Replaced text in <PATH>`（末尾に ` (N occurrences)` を伴うことがある） | Edit |
| `fs_append` | `Appended the text to the <PATH> file.` | Edit |
