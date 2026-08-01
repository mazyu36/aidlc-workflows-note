# AI-DLC Workflows v2 ノート

[awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) の `v2` ブランチを読んで書いた日本語ノート。記述はすべて基点コミットに固定した参照リンクを持つ。

**公開先: https://mazyu36.github.io/aidlc-workflows-note/**

AI-DLC は AI 主導開発を承認ゲート付きの反復可能なフェーズへ構造化する AWS 定義の方法論である。上流リポジトリはその公式実装にあたり、単一の `core/` から Claude Code / Kiro CLI / Kiro IDE / Codex CLI / opencode の 5 配布物を生成する。

## 内容

| 区分 | 内容 |
|---|---|
| 解説 7 ページ | 方法論仕様・方法論モデル・リポジトリ構成・実行モデル・エージェントと検証・FAQ |
| 公式 docs 日本語版 | 上流 `docs/` 全 91 ファイルの逐語訳を構造 1:1 で HTML 化 |

解説ページはコード参照チップと実コード抜粋を持つ。参照リンクはページ内では可動の `blob/v2` 形式で書かれ、表示時に `docs/assets/base.js` の基点コミット（40 桁 SHA）へ張り替えられる。読者が開く URL は基点固定なので、上流が進んでも行番号がズレない。基点をページに直書きしないため、基点更新の差分は base.js と meta.json の 2 ファイルに閉じる（JS 無効環境ではブランチリンクのまま開く）。

## 構成

```
docs/            公開される静的サイト（GitHub Pages の配信元）
  index.html       トップ
  aidlc-workflows/ 解説 7 ページ（meta.json = 分析基点の正）
  mirror/          公式 docs 日本語版（生成物。手で編集しない）
  diagrams/        図のソース（.drawio）
  assets/base.js   分析基点の写し。表示時のリンク合成に使う
mirror-src/      逐語訳の正（原文と同じ相対パスの .md）
scripts/         ビルドと検証
AGENTS.md        執筆・作図・参照の規約
```

サイトはビルドステップなしの素の HTML と CSS で、`file://` で開いても動く。

## ローカルでの再生成

ミラー HTML は `mirror-src/` から生成する。原文とのパリティ検証にあたり、上流の基点コミットを worktree で用意する。

```bash
# 上流を基点コミットで取得（SHA は docs/aidlc-workflows/meta.json の analyzedCommit）
git clone https://github.com/awslabs/aidlc-workflows /tmp/aidlc-upstream
git -C /tmp/aidlc-upstream worktree add --detach /tmp/aidlc-v2 <analyzedCommit>

cd scripts/mirror-build && npm install && cd ../..
node scripts/mirror-build/build-mirror.mjs   # 見出し・フェンスのパリティ不一致で exit 2
bash scripts/validate-refs.sh                # 参照リンクの実在確認（missing: 0 を要求）
```

閲覧は `docs/` を静的配信すればよい。

```bash
python3 -m http.server 8000 --directory docs
```

## 更新

`.github/workflows/update.yml` が毎日、上流 `origin/v2` の HEAD に対して決定論の検査（docs 差分・抜粋の行ズレ・実数値・参照パスの実在）を走らせる。検査可能な主張がすべて成立していれば、上流が進んでいても何もしない。記述が実際に古くなった場合にかぎり Claude Code Action が更新 PR を作り、基点の更新（`meta.json` + `docs/assets/base.js`）もその PR に同乗する。PR の差分は内容が変わったページに閉じる。マージは人間が判断する。

## ライセンスと出典

上流 awslabs/aidlc-workflows は MIT No Attribution。本リポジトリの訳文と解説も同じ [MIT-0](LICENSE) で配布する。上流ドキュメントの著作権は Amazon.com, Inc. またはその関連会社に帰属する。本ノートは非公式であり、AWS の公式見解ではない。
