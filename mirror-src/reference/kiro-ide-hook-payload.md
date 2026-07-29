# Kiro IDE hook payload — 実証リファレンス

Kiro IDE が command hook にどうコンテキストを届けるか。IDE の 2 つの世代でライブに捕捉した:
0.12-main（stdin・argv・完全な環境をダンプする probe `.kiro.hook` ファイル）と 1.0.165
（probe v2 hook JSON ファイル; upstream #543/#555）。これは `harness/kiro-ide/` アダプタの
根拠であり、CLI harness（`harness/kiro/`）は別の、kiro-cli 形の stdin 機構を使う。

## IDE の世代を通じてチャネルは変わった

| | Kiro IDE 0.12 | Kiro IDE 1.x（≥1.0.1xx） |
|---|---|---|
| Hook 登録 | `.kiro/hooks/*.kiro.hook`（`{"version":"1.0.0","when":{...},"then":{...}}`） | `.kiro/hooks/*.json` v2 schema（`{"version":"v1","hooks":[{name,trigger,matcher,action}]}`、PascalCase の trigger）。レガシーの `.kiro.hook` ファイルは**静かに不活性**である — 決して実行されない。 |
| コンテキストチャネル | `USER_PROMPT` 環境変数（JSON 文字列） | **stdin**（JSON、書き込まれて閉じられる）。`USER_PROMPT` は空で届く。 |
| stdin の振る舞い | 開かれるが決して書き込まれ / 閉じられない — 素朴な読み取りはハングする | 書き込まれて閉じられる — 読み取りは速やかに解決する |
| フィールド命名 | camelCase: `{ toolName, toolArgs, toolResult, toolSuccess }` | snake_case: `{ session_id, hook_event_name, cwd, tool_name, tool_input, tool_response }` — **success フラグは無い** |

ライブの 1.0.165 PostToolUse キャプチャ、フィールド逐語:

```json
{"session_id":"sess_…","hook_event_name":"PostToolUse","cwd":"/path/to/project","tool_name":"execute_bash","tool_input":{},"tool_response":"Output:\n…\nExit Code: 0"}
```

アダプタは非空の `USER_PROMPT` をただちに使う（stdin が決して閉じられない 0.12 のチャネル）。
その変数が空のとき、アダプタは 1.x のチャネルのために stdin を読み、broken-channel タイムアウト
と競わせる。本番デフォルトは 2 秒であり、`AIDLC_IDE_STDIN_TIMEOUT_MS` に正の値を設定すると、
診断や決定論的なレイテンシテストのためにその上限をミリ秒単位で上書きする。どちらのフィールド
表記も受け入れられる。取得はペイロードに依存する 2 つのターゲット（`audit-and-sensors`・
`log-subagent`）に限定してゲートされている。それ以外のすべてのターゲット（ツール呼び出しごと
の `block` の床を含む）はどちらのチャネルにも触れず、ゼロレイテンシのパスを保つ。

`VSCODE_IPC_HOOK` / `VSCODE_PID` も IDE には存在する（CLI には無い）が、アダプタは上記の
payload チャネルを手がかりにする。

## イベントごとのキャプチャ

結果の散文はどちらのチャネルでも同一である（0.12 では `toolResult`、1.x では
`tool_response`）:

| イベント | tool 名 | tool 入力 | 結果の散文 | 復元可能か？ |
|-------|-----------|-------------|--------------|--------------|
| PostToolUse（write）— create | `fs_write` | `{}`（空） | `Created the <PATH> file.` | path: 結果の散文からのみ |
| PostToolUse（write）— edit | `str_replace` | `{}`（空） | `Replaced text in <PATH>` | path: 結果の散文からのみ |
| PostToolUse（write）— append | `fs_append` | `{}`（空） | `Appended the text to the <PATH> file.` | path: 結果の散文からのみ |
| PostToolUse（shell） | `execute_bash` | `{}`（空） | `Output:\n<stdout>\n\nExit Code: 0` | command: **復元不可**（stdout のみ） |

### 重大な制限

1. **PostToolUse の write / shell キャプチャは、どちらのチャネルでも tool 入力が空である。**
   したがって、書き込まれたパスは結果の散文から解析せねばならず、shell コマンドは不在である
   （stdout と exit code のみが存在する）。これは IDE 全般の規則ではない: より新しい 1.x の
   ビルドは一部の PreToolUse の入力と委譲の入力を投入する（#543）。
2. **1.x には success フラグが無い。** 0.12 のチャネルの明示的なブーリアン
   `toolSuccess: false` だけが、正しい形の write を audit から落とす（#417）。そのフィールドが
   不在の 1.x の payload は path のチェックにすり抜け、既知のパターンに合致しないエラーの
   散文は可視の hook-drop を記録する。存在するが null でない payload のフィールドが誤った
   実行時型を持つ場合は不正な形として扱われる: 助言のみの hook は正常に終了し、可視の drop を
   記録し、audit や subagent のイベントを一切転送しない。`null` は、そのチャネルの既存の
   不在値の契約に合わせて、利用不能なフィールドと同様に扱われる。
3. **結果の散文中のパスは workspace 相対である**が、core hook は絶対の record root と比較する
   — そこでアダプタは、転送する前にそれらを絶対パスに解決する。

## 各 hook への帰結

- **audit-logger / sensor-fire** — 復元可能: 結果の散文からファイルパスを掻き取り、絶対パスに
  解決し、core hook に Claude 形の `{tool_input:{file_path}}` を渡す。既知のパターンに文言が
  合致しない write クラスの tool は、可視の hook-drop を記録する（静かな no-op には決してならない）。
- **runtime-compile** — shell コマンドは復元不可なので、IDE 経路は command フィルタを落とし、
  純粋に audit tail でゲートする（mtime の冪等性ガード付きで、残存する遷移 — 例えば
  `WORKFLOW_COMPLETED` の後 — が後続のすべての shell コマンドで再コンパイルを起こさないように
  する）。
- **sync-statusline** — IDE は task payload を与えないので、audit tail 中の最新の
  `STAGE_STARTED` から現在の stage を導出する。これは **forward-only** のミラーである:
  `Current Stage` を完了済みまたはスキップされた stage に巻き戻すことは決してなく、
  ワークフローが `Running` でないときには決して発火しない（完了したワークフローの復活を
  防ぐ）。`execute_bash` に一致させている — IDE は sync が解析できる task イベントを一切
  出さない。
- **log-subagent** — payload に依存する。IDE 0.12 は `invoke_sub_agent` を送っていた;
  1.x（1.0.89-1.0.138）は代わりに `subagent_<agent>` を送り、それぞれの前に空の
  `subagent_response` シェル（`"Response recorded."`）が来る。したがって登録の matcher は
  広く取られており（`^(subagent_.+|invoke_sub_agent)$`）、どの委譲先名でもアダプタに届き、
  アダプタは `subagent_response` を捨てる — そのシェルは散文を運ぶが identity を運ばないので、
  それを転送すると `Agent Type: unknown` の `SUBAGENT_COMPLETED` 行を偽造してしまう。identity
  は構造化された 1.x の `subagent_<agent>` という tool 名（#543）を優先する — これは
  プラットフォームが提供するものなので、agent が書いた結果の散文が audit 行を誤帰属させる
  ことはない — そして 0.12 の `invoke_sub_agent` の形での唯一の identity 信号である、#459 由来
  の `**Reviewer:**` / `**Agent:**` の結果マーカーにフォールバックする。
- **session-start / session-end / stop / mint / block** — payload を必要としない; stdin を
  決して読まない。

## toolResult パス抽出パターン

| toolName | 文言 | 正規の tool |
|----------|---------|----------------|
| `fs_write` | `Created the <PATH> file.` | Write |
| `str_replace` | `Replaced text in <PATH>`（末尾に ` (N occurrences)` を伴うことがある） | Edit |
| `fs_append` | `Appended the text to the <PATH> file.` | Edit |

抽出器はマッチの前に末尾の空白 / 改行をトリムし、`str_replace` の形から末尾の括弧書きを
取り除く。`fs_write` は `Write` に対応する; `str_replace` / `fs_append` は `Edit` に対応する
（どちらも既存ファイルを対象とする → core の audit-logger は `ARTIFACT_UPDATED` を記録する）。
