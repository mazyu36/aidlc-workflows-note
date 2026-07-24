# AI-DLC ドキュメント

**AI-DLC は方法論である** — AI 駆動のソフトウェア開発に対する、構造化された gate 付きのアプローチである（AWS が定義）。**このリポジトリは、そのネイティブかつ複数 harness 対応の実装である:** 方法論を単一の harness 非依存な `core/` から skills・agents・hooks・tools として具現化したものであり、利用する CLI harness 上でネイティブに動作する — 現時点では Claude Code・Kiro CLI・Kiro IDE・Codex CLI・opencode、および移植先となる任意の対応 CLI である。方法論は *何を* に当たり、各 harness ディストリビューションは 1 つのランタイムに対する *どのように* に当たる。そして、すべてのディストリビューションは同一のソースから生成される。

初めてだろうか？ [README](../README.md) にインストールの Quick Start と「pick your harness」の表がある。このページはドキュメントそのものの地図である。

## 3 つのガイド、読者ごとに 1 つ

変更しようとしている対象で選ぶ:

| ガイド | あなたは… | 変更するのは… |
|-------|----------|-------------|
| **[ユーザーガイド](guide/00-introduction.md)** | AI-DLC を *使って* ソフトウェアを構築する | フレームワーク内は何も変更しない — `/aidlc` を実行し、gate で回答し、成果物をレビューする |
| **[Harness Engineer ガイド](harness-engineering/00-overview.md)** | AI-DLC がチーム向けに *どのように* 振る舞うかを作り変える | フレームワークが読み取る **データ**: stage・agent・scope・rule・sensor・knowledge、そして新しい harness への移植 |
| **[開発者リファレンス](reference/00-overview.md)** | AI-DLC *それ自体* を変更する | そのデータを読み取る **コード**: engine・hooks・CLI ツール・コンパイル pipeline・テストスイート |

Harness Engineer ガイドと開発者リファレンスの境界は **データ対コード** であり、ユーザーガイドとその他の境界は **使う** か **形作る** かである。

## 特定の harness 上で動かす

各ガイドは harness 非依存である。各 harness のインストール手順と、異なるわずかな挙動は [他の harness で動かす](guide/harnesses/README.md) にまとめられている（Claude Code はユーザーガイド全体で扱われており、その例は Claude Code 上で動作する）。

## ビルドとコントリビュート

メンテナは `core/` で執筆し、`bun scripts/package.ts` で `dist/<harness>/` ツリーを再生成する — ビルドとテストの一連のループについては [コントリビューションガイド](reference/11-contributing.md) を、harness を追加するには [新しい harness への移植](harness-engineering/09-porting-to-a-new-harness.md) を参照。
