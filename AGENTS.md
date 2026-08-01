# aidlc-workflows-note 運用規約（エージェント向け）

このリポジトリは [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) の `v2` ブランチを解説するコードベースノート。サイト名は「AI-DLC Workflows v2 ノート」（masthead は `AI-DLC WORKFLOWS NOTE`）で、アトラスという呼称は使わない。kiro-notes 由来の形式（基点コミット固定のコード参照つき自己完結 HTML）を移植したもので、ここに書かれた規約はこのリポジトリで作業するすべてのコーディングエージェントに適用される。

ページの作成・更新・移植の実行手順は codebase-atlas-html スキル（`~/.claude/skills/codebase-atlas-html/SKILL.md`）にある。規約を変えたら同じコミットでスキル側の追従要否も確認すること。ただし基点の扱いはスキルの標準（40 桁 SHA をページに直書き）から意図的に離れている: このリポジトリは自動更新の差分をページ単位に保つため、リンクを可動の `blob/v2` 形式で書き、表示時に app.js が `docs/assets/base.js` の基点コミットへ合成する（後述「コード参照の規約」）。

## 対象リポジトリと分析基点

| 項目 | 値 |
|---|---|
| 対象 | github.com/awslabs/aidlc-workflows（public） |
| 基点ブランチ | `origin/v2`（ユーザー指定。v2.x タグのリリースラインで、活発な開発ブランチ） |
| 基点 SHA | `docs/aidlc-workflows/meta.json` の `analyzedCommit` が正。`docs/assets/base.js` はその写し（表示時のリンク合成用）で、両者は `scripts/bump-base.sh` が同時に更新する |
| ローカル clone | `<ghq-root>/github.com/awslabs/aidlc-workflows`（`ghq root` で解決。固定パスを書かない） |

main ブランチは v1 系のツリーを保持しており、v2 とはディレクトリ構成が異なる。基点を main に切り替えないこと。基点で読むときはローカル checkout を動かさず一時 worktree を使う:

```bash
git -C "$(ghq root)/github.com/awslabs/aidlc-workflows" worktree add --detach /tmp/aidlc-v2 origin/v2
# 作業後: git -C ... worktree remove /tmp/aidlc-v2
```

## ページ構成

| ページ | 内容 |
|---|---|
| `docs/index.html` | トップ。TL;DR・リポジトリ全体図・ページ索引・一次資料 |
| `docs/aidlc-workflows/spec.html` | 方法論仕様: 同梱 Specification PDF の 9 原則・三区画モデル・orchestrator 5 機能・仕様 → v2 実装の対応表 |
| `docs/aidlc-workflows/concepts.html` | 方法論モデル: 5 フェーズ 32 ステージ、スコープ / ユニット / ボルトの概念モデル |
| `docs/aidlc-workflows/architecture.html` | リポジトリ構成: core → harness → dist の三層、パッケージングパイプライン、プレーンアーキテクチャ |
| `docs/aidlc-workflows/runtime.html` | 実行モデル: セッションの流れ、conductor、ステージプロトコル、状態機械、フック |
| `docs/aidlc-workflows/quality.html` | エージェントと検証: 14 エージェント、knowledge、センサー、swarm、学習ループ |
| `docs/mirror/**` | 公式 docs 全 91 ファイルの逐語日本語版（生成物。手で編集しない） |

## docs ミラー（逐語日本語版）の規約

- 訳文の正は `mirror-src/`（原文と同じ相対パスの .md）。翻訳ルールは `mirror-src/TRANSLATION.md`
- `docs/mirror/**.html` は `node scripts/mirror-build/build-mirror.mjs` の生成物。手で編集せず、直すときは mirror-src か build スクリプトを直して再生成する
- ビルド前提: `/tmp/aidlc-v2` に基点コミットの worktree があること（原文パリティ検証・アンカー計算に使う）、`scripts/mirror-build/` で `npm install` 済みであること
- 忠実性: 構造（見出し・フェンス・表）は原文と 1:1。ビルドが見出し・フェンスのパリティを検証し、不一致はビルド失敗。見出しアンカー id は原文英語から GitHub 互換 slug を計算して位置対応で付与
- 唯一の内容改変は Mermaid のセミコロン 5 行の修正（upstream PR #651 相当。build-mirror.mjs の MERMAID_FIXES が正）
- ノート本文の文章規約（bold 禁止・ウィーゼルワード禁止）は逐語ミラーには適用しない — 原文の構造・強調を忠実に写す方が優先
- update_mode では: 新基点で `git diff 旧..新 -- docs` を取り、変更のあった原文だけ mirror-src を再翻訳 → 全体を再ビルド → validate-refs.sh

- ページ単体で「動き」と「実装の大枠」が掴めることをゴールにする。主要フローには図（draw.io / Mermaid シーケンス図）を付け、本文で主張した仕組みには実コード抜粋（`figure.excerpt`）で実体を見せる。目安: 各ページに抜粋 2〜4 個
- コンテンツはページ内に完結させる。リポジトリ内 .md への外部リンクで内容を代替しない（引用・出典表示としてのみ可）
- 基点の提示は masthead 右端の GitHub バッジ（`a.gh-link`: GitHub アイコン + `<span class="gh-hash">v2</span>`、href は `tree/v2`）。短縮ハッシュと title は表示時に app.js が base.js から埋めるので、ページには書かない。ノートのページは `footer.meta` を置かない。例外は spec.html の原典（PDF）footer と、生成物であるミラーの footer（原文リンク + 基点表示）
- 生成後に `bash scripts/validate-refs.sh` を実行し、missing: 0 を確認してから完了とする

## コード参照の規約

1. コードに関する記述には参照チップを付ける。HTML での形:

```html
<span class="ref"><a href="https://github.com/awslabs/aidlc-workflows/blob/v2/core/tools/aidlc.ts#L42">core/tools/aidlc.ts:42</a><button class="copy" type="button" data-copy="core/tools/aidlc.ts:42" aria-label="パスをコピー">⧉</button></span>
```

2. リンク先は必ず `github.com/awslabs/aidlc-workflows` の blob/tree URL で、ref 部分は `v2` と書く。表示時に app.js が `docs/assets/base.js` の基点コミット（40 桁 SHA）へ張り替えるので、読者が開く URL は基点固定になり行ズレしない。40 桁 SHA をページに直書きしない（基点更新のたびに全ページが差分になるのを防ぐため。verify.yml が直書きを検出して落とす）
3. 記述内容と行番号は基点コミットの実体で確認する。確認は `git show <analyzedCommit>:<path>`（meta.json の値）で行い、ブランチの最新で確認しない
4. 表示テキストは文脈に応じて短縮してよいが、`data-copy` は常にリポジトリルートからの相対パス（+ `:行番号`）
5. 行番号アンカー（`#L…`）は実際に該当行を確認したものだけに付ける。未確認ならファイル単位で参照する
6. ディレクトリは `/tree/v2/<path>` でリンクする
7. チップの置き場所: 本文の行内（p / li の文中・文末）に置かない。文・箇条書きの直下の `<div class="refrow"><span class="label">参照:</span> …</div>` にまとめる。行内配置を許すのは表のセル・figcaption・refrow の中だけ（チップは分割不能要素で、行末に大きな空きを作るため）

## デザイン規約

- 素の HTML + CSS + 最小限の JS。ビルドステップ禁止。`file://` で開けること
- スタイルは `docs/assets/style.css` のトークンだけを使う
- 色は AI-DLC のフェーズ識別にのみ使う: ideation=青 / inception=紫 / construction=琥珀 / operation=緑。サイト全体のアクセントは inception の紫（`<body data-repo="aidlc">`）。琥珀は警告バナー兼用。装飾目的の色は追加しない
- 書体の意味論: sans = 文章・見出し・ナビ・UI テキスト / mono = コード・パス・数値データ + masthead のブランドマークのみ。見出しを mono にしない
- 図: 構造図・フロー図は draw.io で作る。ソース `.drawio` を `docs/diagrams/` に置き、`bash scripts/export-diagram.sh <src>` で SVG（埋め込み用）と PNG（目視 QA 用）を出力し、PNG を確認してからインライン SVG として `<figure class="diagram">` + figcaption で埋め込む
- draw.io のスタイル規約: ノード fillColor=#1e2736 + stroke はフェーズ色、ゾーン背景 #10141d + dashed、エッジ #9aa7bf + labelBackgroundColor=#10141d、フォント色 #e8ecf4 / #aab6cc。必ず `html=0`（`whiteSpace=wrap` 禁止。改行は `&#10;` で明示）。モデルに `background="#161d29"`。エッジは waypoint で箱の貫通を避け、ラベルは offset で線上から退避
- Mermaid（`<pre class="mermaid">`）はシーケンス図のみ可。ラベルに `<br/>` を使わない。全図ともライトボックスでクリック拡大される
- コード抜粋: `<figure class="excerpt">`。figcaption に行番号つき ref チップ、`<pre><code class="language-xxx">`、末尾に `excerpt-note` で「動作: 〜」の解説。抜粋は連続した実在行 4〜20 行を一字一句写す（中略・創作禁止）。必ず `git show <analyzedCommit>:<path>` で確認してから貼る
- ページの `<head>` は style.css → base.js（同期。リンク合成の基点）→ mermaid.min.js / highlight.min.js / app.js（defer）→ budoux-init.js（module）の順
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
5. コード抜粋は行番号固定なので全数再検証: 新基点 worktree で `nl -ba <path> | sed -n '<開始>,<終了>p'` を再実行し、(a) 同一なら据え置き、(b) 行ズレなら href アンカー・表示・data-copy の行番号を更新、(c) コード変更なら抜粋本文と note を書き直す。リンクは `blob/v2` 形式のままにする（SHA を書き込まない）
6. `bash scripts/bump-base.sh <新基点>` で基点を進める（更新されるのは `meta.json` と `docs/assets/base.js` の 2 ファイルだけ。ページの張り替えは不要）
7. 上流 docs に差分があれば mirror-src を追随させて `build-mirror.mjs` で再ビルドし、最後に `scripts/validate-refs.sh` で missing: 0 を確認する
