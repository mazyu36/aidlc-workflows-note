# docs 逐語日本語化の翻訳規約（mirror-src）

awslabs/aidlc-workflows v2（コミット ccf284b501591b90b4081a8e1c7b261cc6d2df46）の `docs/` 配下 Markdown を、構造を 1 対 1 で保った日本語版 Markdown にする。原文は `/tmp/aidlc-v2/docs/<相対パス>`、出力は本リポジトリの `mirror-src/<同じ相対パス>`（ファイル名・拡張子も同一。スペースを含む名前もそのまま）。

この訳文は後段の決定論コンバータが HTML 化する。コンバータは「見出しの数と順序が原文と一致」を前提に原文由来のアンカー id を位置対応で振るため、構造の保存が絶対条件になる。

## 変えないもの（1 バイトも変更禁止）

1. コードフェンス全体。開始行の info string（```bash など）、中身、終了行を含めて無変更。```mermaid ブロックも無変更（既知の描画バグ修正はコンバータ側で行う）
2. インラインコード `...` の中身
3. リンク・画像の URL / パス部分（`](...)` の括弧内）。アンカー `#...` も含めて無変更
4. 数値、コマンド、環境変数名、イベント名（STAGE_STARTED 等）、ファイルパス、JSON/YAML キー

## 構造の保存（コンバータの前提）

1. 見出し行（#〜######）の数・順序・レベルを原文と厳密一致させる。見出しテキストは翻訳する
2. コードフェンスの数と位置関係を保つ
3. 表は行数・列数を保ち、セル内テキストを翻訳する（ヘッダ行・区切り行の構造は不変）
4. リスト構造（ネスト・番号/記号）を保つ。項目の統合・分割をしない
5. blockquote（`>` 行。冒頭のパンくず行を含む）を構造ごと維持して翻訳する
6. 強調 `**...**` / `*...*` は原文で付いている語句に対応する訳語に付ける（忠実訳なので本文の bold は原文どおり残す）
7. 水平線 `---`、HTML タグ（<details> 等があれば）はそのまま

## 訳し方

- 文体は である調。簡潔・技術的に正確に。原文に無い説明を足さない、原文にある情報を落とさない
- 専門用語は原語のまま: Bolt, walking skeleton, conductor, engine, orchestrator, directive, stage, phase, scope, depth, unit, intent, space, workspace, harness, mob, subagent, pipeline, inline, sensor, rule, memory, audit, learnings, gate, halt-and-ask, ladder prompt, record dir, brownfield, greenfield, CodeKB, swarm, worktree, practices, skeleton, tier, plane（初出で「承認ゲート（gate）」のような併記は可）
- ステージ名・スコープ名・エージェント名・ツール名・ファイル名は原語のまま（例: intent-capture, bugfix, aidlc-product-agent）
- リンクテキストは自然な日本語に訳してよい（URL は不変）。章タイトルへの参照は訳語が多少揺れても許容
- UI 文言・プロンプト例・ユーザー入力例は、コードフェンス内なら不変、地の文中の引用なら自然に訳す

## 各ファイル完了時のセルフチェック（必須）

原文と訳文で次を比較し、全ファイル一致を確認してから完了報告する:

```bash
# 見出し数・フェンス行数・表行数（原文/訳文）
for f in <対象相対パス...>; do
  a=/tmp/aidlc-v2/docs/$f; b=mirror-src/$f
  echo "$f: H=$(grep -cE '^#{1,6} ' "$a")/$(grep -cE '^#{1,6} ' "$b") F=$(grep -c '^```' "$a")/$(grep -c '^```' "$b") T=$(grep -c '^|' "$a")/$(grep -c '^|' "$b")"
done
```

不一致が出たら訳文を直す（原文側に合わせる）。完了報告にはこのチェック結果の表を含める。
