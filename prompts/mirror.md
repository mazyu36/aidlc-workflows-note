このリポジトリは awslabs/aidlc-workflows の v2 ブランチを解説する日本語ノートです。上流 `docs/` が変わったので、逐語日本語訳（ミラー）を追随させてください。

この作業では**ミラーだけ**を扱います。解説ページ（`docs/aidlc-workflows/**`）と基点の更新（`meta.json` / `docs/assets/base.js`）は後続が担当するので、触らないでください。

## 前提
- 上流の clone: `/tmp/aidlc-upstream`（新基点を checkout 済み）
- 旧基点: `${OLD_SHA}`
- 新基点: `${NEW_SHA}`
- 変更された原文: ${DOCS_COUNT} ファイル
- 作業ブランチは既に作成済み。ブランチを切り直さないでください
- 規約は `AGENTS.md` の「docs ミラー（逐語日本語版）の規約」が正

## Step 1: 対象を確認する
```bash
node scripts/check-staleness.mjs
```
`docs changed` に挙がったファイルだけが作業対象です。それ以外は触らないでください。

## Step 2: 1 ファイルずつ追随させる
ファイルごとに次を繰り返します。原文や訳文の全体を読み直す必要はありません。差分が示した箇所の周辺だけを見てください。
```bash
git -C /tmp/aidlc-upstream diff ${OLD_SHA}..${NEW_SHA} -- docs/<path>
```
対応する `mirror-src/<同じ相対パス>` の該当箇所だけを訳し直します。規約は厳格です。

- 構造（見出し・コードフェンス・表）は原文と 1:1。パリティが崩れるとビルドが exit 2 で落ちる
- 逐語訳。原文の強調や構造をそのまま写す。解説ページの文章規約（bold 禁止など）はミラーには適用しない
- `docs/mirror/**.html` を直接編集しない。必ず `mirror-src/` を直す

## Step 3: 再生成して検証する
全ファイルを直し終えてから 1 回だけ実行します。ファイルごとに再ビルドしないでください。
```bash
MIRROR_ORIG=/tmp/aidlc-upstream/docs node scripts/mirror-build/build-mirror.mjs
```
exit 0 と `built 91 page(s) + index` を確認します。落ちたらパリティ不一致なので直してください。

## Step 4: コミットする
```bash
git add -A
git commit -m "feat(mirror): 上流 docs の変更に追随"
```
push も PR 作成もしないでください。後続のステップが行います。

## 終われない場合
時間内に全部終わらないと判断したら、そこまでの成果をコミットしてください。コミットメッセージの本文に、未処理として残したファイルを列挙してください。何も残らないより部分的に進んだ方が有用です。
