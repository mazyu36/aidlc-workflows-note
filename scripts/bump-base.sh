#!/usr/bin/env bash
# 分析基点を進める。ページは基点 SHA を直書きせず（リンクは blob/v2 形式、表示時に
# app.js が合成する）、基点の実体は meta.json と docs/assets/base.js の 2 ファイルだけ。
# したがって基点更新の差分もこの 2 ファイルに閉じる。
#
# 使い方: bash scripts/bump-base.sh <新基点 40 桁 SHA>
set -euo pipefail

NEW="${1:?新基点の 40 桁 SHA を指定してください}"
[[ "$NEW" =~ ^[0-9a-f]{40}$ ]] || { echo "40 桁の SHA ではありません: $NEW" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node -e '
  const fs = require("fs");
  const sha = process.argv[1];
  const today = new Date().toISOString().slice(0, 10);

  const metaPath = "docs/aidlc-workflows/meta.json";
  const m = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  m.analyzedCommit = sha;
  m.analyzedAt = today;
  fs.writeFileSync(metaPath, JSON.stringify(m, null, 2) + "\n");

  const base = [
    "// 分析基点（上流 awslabs/aidlc-workflows のコミット）。値の正は docs/aidlc-workflows/meta.json。",
    "// このファイルはページ表示時に app.js が blob/v2・tree/v2 リンクへ合成するための写しで、",
    "// scripts/bump-base.sh が meta.json と同時に更新する。手で編集しない。",
    "window.AIDLC_BASE = {",
    `  sha: "${sha}",`,
    `  analyzedAt: "${today}",`,
    "};",
    "",
  ].join("\n");
  fs.writeFileSync("docs/assets/base.js", base);
' "$NEW"

echo "基点を ${NEW:0:7} へ更新しました（meta.json / base.js の 2 ファイル）"
