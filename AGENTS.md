# aidlc-workflows-note 運用規約（エージェント向け）

このリポジトリは [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) の `v2` ブランチを解説するコードベースノート。kiro-notes の Codebase Atlas 形式（SHA 固定のコード参照つき自己完結 HTML）を移植したもので、ここに書かれた規約はこのリポジトリで作業するすべてのコーディングエージェントに適用される。

ページの作成・更新・移植の実行手順は codebase-atlas-html スキル（`~/.claude/skills/codebase-atlas-html/SKILL.md`）にある。規約を変えたら同じコミットでスキル側の追従要否も確認すること。

## 対象リポジトリと分析基点

| 項目 | 値 |
|---|---|
| 対象 | github.com/awslabs/aidlc-workflows（public） |
| 基点ブランチ | `origin/v2`（ユーザー指定。v2.x タグのリリースラインで、活発な開発ブランチ） |
| 基点 SHA | `docs/aidlc-workflows/meta.json` の `analyzedCommit` が正 |
| ローカル clone | `<ghq-root>/github.com/awslabs/aidlc-workflows`（`ghq root` で解決。固定パスを書かない） |

main ブランチは v1 系のツリーを保持しており、v2 とはディレクトリ構成が異なる。基点を main に切り替えないこと。基点で読むときはローカル checkout を動かさず一時 worktree を使う:

```bash
git -C "$(ghq root)/github.com/awslabs/aidlc-workflows" worktree add --detach /tmp/aidlc-v2 origin/v2
# 作業後: git -C ... worktree remove /tmp/aidlc-v2
```

## ページ構成

| ページ | 内容 |
|---|---|
| `docs/index.html` | Atlas トップ。TL;DR・リポジトリ全体図・ページ索引・分析基点テーブル |
| `docs/aidlc-workflows/concepts.html` | 概念: AI-DLC 方法論、フェーズ / ステージ / スコープ / ユニット / ボルトの概念モデル |
| `docs/aidlc-workflows/architecture.html` | つくり: core → harness → dist の三層、パッケージングパイプライン、プレーンアーキテクチャ |
| `docs/aidlc-workflows/runtime.html` | 仕組み: セッションの流れ、conductor、ステージプロトコル、状態機械、フック |
| `docs/aidlc-workflows/quality.html` | エージェントと品質: 14 エージェント、knowledge、センサー、swarm、学習ループ |

- ページ単体で「動き」と「実装の大枠」が掴めることをゴールにする。主要フローには図（draw.io / Mermaid シーケンス図）を付け、本文で主張した仕組みには実コード抜粋（`figure.excerpt`）で実体を見せる。目安: 各ページに抜粋 2〜4 個
- コンテンツはページ内に完結させる。リポジトリ内 .md への外部リンクで内容を代替しない（引用・出典表示としてのみ可）
- 全ページ末尾に `footer.meta`（基点 SHA / 生成日）を置く
- 生成後に `bash scripts/validate-refs.sh` を実行し、missing: 0 を確認してから完了とする

## コード参照の規約

1. コードに関する記述には参照チップを付ける。HTML での形:

```html
<span class="ref"><a href="https://github.com/awslabs/aidlc-workflows/blob/<40桁SHA>/core/tools/aidlc.ts#L42">core/tools/aidlc.ts:42</a><button class="copy" type="button" data-copy="core/tools/aidlc.ts:42" aria-label="パスをコピー">⧉</button></span>
```

2. リンク先は必ず `github.com/awslabs/aidlc-workflows` の blob/tree URL で、`meta.json` の `analyzedCommit`（40 桁 SHA）に固定する。ブランチ名リンク（`/blob/v2/...`）は行ズレ・リンク切れするので禁止
3. 表示テキストは文脈に応じて短縮してよいが、`data-copy` は常にリポジトリルートからの相対パス（+ `:行番号`）
4. 行番号アンカー（`#L…`）は実際に該当行を確認したものだけに付ける。未確認ならファイル単位で参照する
5. ディレクトリは `/tree/<SHA>/<path>` でリンクする
6. チップの置き場所: 本文の行内（p / li の文中・文末）に置かない。文・箇条書きの直下の `<div class="refrow"><span class="label">参照:</span> …</div>` にまとめる。行内配置を許すのは表のセル・figcaption・refrow の中だけ（チップは分割不能要素で、行末に大きな空きを作るため）

## デザイン規約

- 素の HTML + CSS + 最小限の JS。ビルドステップ禁止。`file://` で開けること
- スタイルは `docs/assets/style.css` のトークンだけを使う
- 色は AI-DLC のフェーズ識別にのみ使う: ideation=青 / inception=紫 / construction=琥珀 / operation=緑。サイト全体のアクセントは inception の紫（`<body data-repo="aidlc">`）。琥珀は警告バナー兼用。装飾目的の色は追加しない
- 書体の意味論: sans = 文章・見出し・ナビ・UI テキスト / mono = コード・パス・数値データ + masthead のブランドマークのみ。見出しを mono にしない
- 図: 構造図・フロー図は draw.io で作る。ソース `.drawio` を `docs/diagrams/` に置き、`bash scripts/export-diagram.sh <src>` で SVG（埋め込み用）と PNG（目視 QA 用）を出力し、PNG を確認してからインライン SVG として `<figure class="diagram">` + figcaption で埋め込む
- draw.io のスタイル規約: ノード fillColor=#1e2736 + stroke はフェーズ色、ゾーン背景 #10141d + dashed、エッジ #9aa7bf + labelBackgroundColor=#10141d、フォント色 #e8ecf4 / #aab6cc。必ず `html=0`（`whiteSpace=wrap` 禁止。改行は `&#10;` で明示）。モデルに `background="#161d29"`。エッジは waypoint で箱の貫通を避け、ラベルは offset で線上から退避
- Mermaid（`<pre class="mermaid">`）はシーケンス図のみ可。ラベルに `<br/>` を使わない。全図ともライトボックスでクリック拡大される
- コード抜粋: `<figure class="excerpt">`。figcaption に行番号つき ref チップ、`<pre><code class="language-xxx">`、末尾に `excerpt-note` で「動作: 〜」の解説。抜粋は連続した実在行 4〜20 行を一字一句写す（中略・創作禁止）。必ず `git show <SHA>:<path>` で確認してから貼る
- ページの `<head>` は style.css → mermaid.min.js / highlight.min.js / app.js（defer）→ budoux-init.js（module）の順
- 文章は日本語。本文で bold を強調に使わない（見出しのみ）
- 折り返し幅に ch 単位を使わない（全角は半角の約 2 倍幅）。本文に `text-align: justify` と `text-wrap: pretty` を使わない（分割不能要素の多い行で字間・改行位置が破綻する。kiro-notes で 2026-07-23 撤回済み）
- 可読性部品: 数値ハイライトは `.stat-grid`、注意書きは `.callout`（info/warn）、ディレクトリ構造は `.tree-view`。図の figure には `<figcaption>` を必ず付ける（図番号は CSS カウンターが自動付与）

## 文章規約（amazon-writing 準拠）

- BLUF: ページの lede と各 h2 セクションは結論から書く。背景説明から始めない
- Pyramid Principle: 結論 → 論拠 → 詳細の順。詳細（列挙・数値）はテーブルに逃がし、本文はその So What を書く
- ウィーゼルワード禁止: 「など」「様々な」「柔軟な」「適切に」「基本的に」を使わず、具体的に列挙するか数値で言う
- 能動態・短文（1 文 60 字目安）。形容詞ではなくデータで裏付ける
- 各セクションを書き終えたら So What テスト（この節は読者の何の判断を助けるか）に答えられるか確認する

## 更新手順（update_mode)

1. `docs/aidlc-workflows/meta.json` の `analyzedCommit` を読む
2. `git fetch origin` して新基点（`origin/v2` の HEAD）を決める。`git ls-remote origin v2` で fetch がリモートに届いたことを確認する
3. 新旧が同一なら差分ゼロで完了
4. `git log --stat <旧基点>..<新基点>` で変更領域を把握し、影響のあるセクションだけ書き換える
5. ページ内の全参照 URL の SHA を新基点に張り替え、`scripts/validate-refs.sh` で検証する
6. コード抜粋は行番号固定なので全数再検証: 新基点 worktree で `nl -ba <path> | sed -n '<開始>,<終了>p'` を再実行し、(a) 同一なら据え置き、(b) 行ズレなら href アンカー・表示・data-copy の行番号を更新、(c) コード変更なら抜粋本文と note を書き直す
7. `meta.json`・`docs/index.html` の分析基点テーブル・各ページ footer.meta を更新する
