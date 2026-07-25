# `test-pro` — 具体的な config/JSON の例

これらは、plugin 設計における **設定ドキュメント** であり、同梱の `test-pro` fixture 向けに
具体化したものである。これらは、唯一の plugin-mechanism 章である [doc 18](../../18-plugin-mechanism.md)
を例示する。**これらが描くもののほとんどは deferred であり**、shipped ではない — 今日何が
結線されているか（plugin manifest + compose の継ぎ目）と、設計済みだが将来のもの（marketplace の
解決、managed-settings の信頼、lockfile、`aidlc plugin add`/`sync` インストーラ）とを正確に知るには、
doc 18 §8「Status」を参照。これらは、現在の挙動ではなく、意図されたライフサイクルを示す。

| ファイル | 役割 | 著述者 | どこに在るか |
|---|---|---|---|
| [`../../../../plugins/test-pro/.aidlc-plugin/plugin.json`](../../../../plugins/test-pro/.aidlc-plugin/plugin.json) | **Plugin manifest** — plugin が何であるか + 何を同梱するか | plugin 作者 | plugin リポジトリ内（実在のファイル、作成済み） |
| [`marketplace.json`](marketplace.json) | **Catalogue entry** — plugin がどう発見/バージョン付けされるか | marketplace メンテナ | marketplace リポジトリ |
| [`managed-settings.json`](managed-settings.json) | **Trust allowlist** — org がどのソースを許可するか | org 管理者（managed scope） | マシンの managed-settings パス |
| [`aidlc.lock.json`](aidlc.lock.json) | **Install lock** — 再現性のために compose 結果を固定する | `aidlc plugin` インストーラ | 消費者のプロジェクト |

## これらのファイルの状態

- `plugin.json` はリポジトリ内の **実在の、作成済みファイル** である — 同梱の `test-pro`
  fixture 向けの manifest である。（注: packager は今日、ディレクトリ規約によって plugin
  コンテンツを発見し、manifest の `aidlc.contributes` ブロックはまだ読まない — doc 18 §3 を参照。）
- `marketplace.json`、`managed-settings.json`、`aidlc.lock.json` は、設計レビューのため
  だけの **説明用の例** である。それらを *生成* し *消費* するであろう installer、marketplace の
  解決、lockfile writer は **将来の作業** である（doc 18 §8「Status」）。lockfile 中のすべての
  `sha256:…` と `commit` の値は **プレースホルダ** であり、計算されたハッシュではない。

## これらのファイルが辿るライフサイクル

1. **Author** が `plugin.json` と plugin のサブツリーを書き、git タグを公開する。
2. **Marketplace**（任意）が、発見のために `marketplace.json` に plugin を列挙する。
3. **Org admin** が `managed-settings.json` を設定し、承認されたソースだけがインストール
   され得るようにする — 開発者はそれを上書きできない（managed scope、最高の優先順位）。
4. **Developer** が `aidlc plugin add test-pro` を実行する: バージョンを解決し、allowlist に
   照合し、取得 + 検証し、`bare core + test-pro` を compose し、`aidlc.lock.json` を書く。
5. **Teammate** が、コミット済みの `aidlc.lock.json` に対して `aidlc plugin sync` を実行し、
   バイト単位で同一のインストールを得る。
