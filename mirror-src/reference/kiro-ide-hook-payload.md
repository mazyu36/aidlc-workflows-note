# Kiro IDE hook payload — 実証リファレンス

Kiro IDE がコマンド hook にどうコンテキストを届けるか。2 つの IDE 世代でライブに捕捉した:
0.12-main（stdin・argv・完全な環境をダンプする probe `.kiro.hook` ファイル）と 1.0.165
（probe v2 hook JSON ファイル; upstream #543/#555）。これは `harness/kiro-ide/` アダプタの
根拠であり、CLI harness（`harness/kiro/`）は別の、kiro-cli 形の stdin 機構を使う。

## チャネルは IDE 世代をまたいで変わった

| | Kiro IDE 0.12 | Kiro IDE 1.x（≥1.0.1xx） |
|---|---|---|
| Hook 登録 | `.kiro/hooks/*.kiro.hook`（`{"version":"1.0.0","when":{...},"then":{...}}`） | `.kiro/hooks/*.json` v2 スキーマ（`{"version":"v1","hooks":[{name,trigger,matcher,action}]}`、PascalCase の trigger）。レガシーの `.kiro.hook` ファイルは**静かに不活性**である — 決して実行されない。 |
| コンテキストチャネル | `USER_PROMPT` 環境変数（JSON 文字列） | **stdin**（JSON、書き込まれて閉じられる）。`USER_PROMPT` は空で届く。 |
| stdin の振る舞い | 開かれるが決して書き込まれ／閉じられない — 素の read はハングする | 書き込まれて閉じられる — read は速やかに解決する |
| フィールドの命名 | camelCase: `{ toolName, toolArgs, toolResult, toolSuccess }` | snake_case: `{ session_id, hook_event_name, cwd, tool_name, tool_input, tool_response }` — **success フラグが無い** |

1.0.165 のライブな PostToolUse キャプチャ、フィールド逐語:

```json
{"session_id":"sess_…","hook_event_name":"PostToolUse","cwd":"/path/to/project","tool_name":"execute_bash","tool_input":{},"tool_response":"Output:\n…\nExit Code: 0"}
```

アダプタは空でない `USER_PROMPT` を即座に使う（0.12 のチャネルで、その stdin は決して
閉じない）。その変数が空のとき、1.x のチャネル用に stdin を読む — broken-channel
タイムアウトと競争させながら。本番の既定は 2 秒である; 正の
`AIDLC_IDE_STDIN_TIMEOUT_MS` の値は、診断や決定論的なレイテンシテストのために
ミリ秒単位でこの上限を上書きする。両方のフィールドの綴りが受理される。取得は
2 つの payload に依存するターゲット（`audit-and-sensors`・`log-subagent`）に限定して
ゲートされる; 他のすべてのターゲット（tool 呼び出しごとの `block` の床を含む）は
どちらのチャネルにも触れず、ゼロレイテンシの経路を保つ。

`VSCODE_IPC_HOOK` / `VSCODE_PID` も IDE には存在する（CLI には無い）が、アダプタは
上記の payload チャネルを手がかりにする。

## イベントごとのキャプチャ

結果の散文はどちらのチャネルでも同一である（0.12 では `toolResult`、1.x では
`tool_response`）:

| イベント | tool 名 | tool の入力 | 結果の散文 | 復元可能か？ |
|-------|-----------|-------------|--------------|--------------|
| PostToolUse（write） — create | `fs_write` | `{}`（空） | `Created the <PATH> file.` | path: 結果の散文からのみ |
| PostToolUse（write） — edit | `str_replace` | `{}`（空） | `Replaced text in <PATH>` | path: 結果の散文からのみ |
| PostToolUse（write） — append | `fs_append` | `{}`（空） | `Appended the text to the <PATH> file.` | path: 結果の散文からのみ |
| PostToolUse（shell） | `execute_bash` | `{}`（空） | `Output:\n<stdout>\n\nExit Code: 0` | command: **復元不可**（stdout のみ） |

### 重大な制限

1. **PostToolUse の write/shell キャプチャは、どちらのチャネルでも tool の入力が空である。**
   したがって、書き込まれたパスは結果の散文から解析せねばならず、shell コマンドは
   不在である（stdout と exit code のみが存在する）。これは IDE 全体に普遍的な規則では
   ない: より新しい 1.x ビルドは一部の PreToolUse の入力と委譲の入力を populate する
   （#543）。
2. **1.x は success フラグを運ばない。** 0.12 のチャネルの明示的なブーリアン
   `toolSuccess: false` だけが、整った書き込みを audit から落とす（#417）; フィールドが
   不在の 1.x の payload はパスチェックへすり抜け、既知のパターンに合致しないエラーの
   散文は可視の hook-drop を記録する。存在するが非 null で誤ったランタイム型を持つ
   payload フィールドは不正な形として扱われる: advisory hook は正常終了し、可視の
   drop を記録し、audit も subagent イベントも転送しない。`null` は不在の値として
   扱われる — チャネルの既存の不在値契約に一致する。
3. **結果の散文中のパスは workspace 相対である**が、core hook は絶対の record root と
   比較する — そこでアダプタは、転送する前にそれらを絶対パスに解決する。

## 各 hook への帰結

- **audit-logger / sensor-fire** — 復元可能: 結果の散文からファイルパスを掻き取り、
  絶対パスに解決し、core hook に Claude 形の `{tool_input:{file_path}}` を渡す。
  既知のパターンに文言が合致しない write クラスの tool は、可視の hook-drop を
  記録する（静かな no-op には決してならない）。
- **runtime-compile** — shell コマンドは復元不可なので、IDE 経路は command
  フィルタを落とし、純粋に audit tail でゲートする（mtime の冪等性ガード付きで、
  残存する遷移 — 例えば `WORKFLOW_COMPLETED` の後 — が後続のすべての shell
  コマンドで再コンパイルを起こさないようにする）。
- **sync-statusline** — IDE は task payload を与えないので、audit tail 中の最新の
  `STAGE_STARTED` から現在の stage を導出する。これは **forward-only** のミラーである:
  `Current Stage` を完了済みまたはスキップされた stage に巻き戻すことは決してなく、
  ワークフローが `Running` でないときには決して発火しない（完了したワークフローの
  復活を防ぐ）。`execute_bash` にマッチされている — IDE は sync が解析できる task
  イベントを一切表面化しない。
- **log-subagent** — payload に依存する。IDE 0.12 は `invoke_sub_agent` を送っていた;
  1.x（1.0.89-1.0.138）は代わりに `subagent_<agent>` を送り、それぞれの前に空の
  `subagent_response` シェル（`"Response recorded."`）が来る。したがって登録の
  matcher は広い（`^(subagent_.+|invoke_sub_agent)$`）ので、どの委譲名もアダプタに
  届き、アダプタは `subagent_response` を捨てる — そのシェルは散文を運ぶが identity
  は運ばないので、それを転送すれば `Agent Type: unknown` の `SUBAGENT_COMPLETED` 行を
  捏造してしまう。Identity は構造化された 1.x の `subagent_<agent>` という tool 名
  （#543）を優先する — それは platform が提供するものなので、agent が著述した
  結果の散文が audit 行を誤帰属させることはできない — そして #459 由来の
  `**Reviewer:**` / `**Agent:**` の結果マーカーへフォールバックする。これは 0.12 の
  `invoke_sub_agent` の形における唯一の identity 信号である。
- **session-start / session-end / stop / mint / block** — payload を必要としない;
  stdin を決して読まない。

## toolResult パス抽出パターン

| toolName | 文言 | 正規の tool |
|----------|---------|----------------|
| `fs_write` | `Created the <PATH> file.` | Write |
| `str_replace` | `Replaced text in <PATH>`（末尾に ` (N occurrences)` を伴うことがある） | Edit |
| `fs_append` | `Appended the text to the <PATH> file.` | Edit |

抽出器はマッチの前に末尾の空白／改行をトリムし、`str_replace` の形から末尾の
括弧書きを剥ぐ。`fs_write` は Write にマップされる; `str_replace`/`fs_append` は
Edit にマップされる（両方とも既存のファイルを対象とする → core の audit-logger は
`ARTIFACT_UPDATED` を記録する）。
