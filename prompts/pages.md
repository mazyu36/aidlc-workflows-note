このリポジトリは awslabs/aidlc-workflows の v2 ブランチを解説する日本語ノートです。上流が進んで解説ページの記述が古くなったので、直してください。

この作業では**解説ページ（`docs/aidlc-workflows/**` と `docs/index.html`）**を扱います。ミラーの訳文（`mirror-src/**`）は先行セッションが追随済みなので、訳文の内容は触らないでください。

## 前提
- 上流の clone: `/tmp/aidlc-upstream`（新基点を checkout 済み）
- 旧基点: `${OLD_SHA}`
- 新基点: `${NEW_SHA}`
- 作業ブランチは既に作成済み。ブランチを切り直さないでください
- 規約は `AGENTS.md` が正。文章規約（BLUF・1 文 60 字目安・bold は見出しのみ）と参照規約に従う

## Step 1: 何が壊れているかを確認する
```bash
node scripts/check-staleness.mjs
```
`excerpt drift` / `count drift` / `missing paths` に挙がったものが作業対象です。`docs changed` は先行セッションの担当なので無視してください。

## Step 2: 抜粋の行ズレを直す
行番号が固定なので、新基点で実物を確認してから直します。
```bash
git -C /tmp/aidlc-upstream show ${NEW_SHA}:<path> | nl -ba | sed -n '<from>,<to>p'
```
行がずれただけなら href アンカー・表示テキスト・`data-copy` の 3 箇所の行番号を更新します。コード自体が変わったなら抜粋本文と「動作:」の解説を書き直します。抜粋は連続した実在行を一字一句写し、中略や創作をしないでください。

## Step 3: 実数値を直す
ノートが書いている数値が上流と食い違っています。本文・表・`stat-grid`・`tree-view`・埋め込み SVG の `<text>` まで grep して漏れなく直してください。`scripts/check-staleness.mjs` の `claimed` 値も同じ数に更新します。

## Step 4: 参照切れを直す
`missing paths` があれば、リンク先を新基点で存在するパスに差し替えるか、その記述自体を削ります。

## Step 5: 検証する
```bash
MIRROR_ORIG=/tmp/aidlc-upstream/docs node scripts/mirror-build/build-mirror.mjs   # exit 0 / 91 ページ
UPSTREAM=/tmp/aidlc-upstream bash scripts/validate-refs.sh                        # missing: 0
```
落ちたら直してから進んでください。この時点では基点 SHA がまだ旧のままなので、`check-staleness.mjs` は `up-to-date` になりません。張り替えは後続の決定論ステップが行います。

## Step 6: コミットする
```bash
git add -A
git commit -m "feat(pages): 上流の変更にあわせて解説ページを更新"
```
push も PR 作成もしないでください。後続のステップが行います。

## 図について
図の再生成には draw.io が必要で、この環境にはありません。図の更新が要ると判断した場合は、自分で作図せず `/tmp/manual-followup.md` に「要手動対応」として何をどう直すべきか書いてください。その内容が PR 本文に載ります。
