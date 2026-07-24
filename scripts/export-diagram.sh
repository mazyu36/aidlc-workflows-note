#!/usr/bin/env bash
# .drawio → SVG(ページ埋め込み用) + PNG(エージェントの目視QA用) のエクスポート
# 使い方: bash scripts/export-diagram.sh docs/diagrams/foo.drawio [出力ディレクトリ]
# 前提: drawio / xvfb / fonts-noto-cjk がインストール済み (2026-07-23 導入)
set -euo pipefail
SRC="$1"; OUT="${2:-/tmp}"
BASE="$(basename "${SRC%.drawio}")"
xvfb-run -a drawio --no-sandbox --disable-gpu -x -f svg -o "$OUT/$BASE.svg" "$SRC" 2>/dev/null
# ダークサイト用後処理: light-dark() を authored 色に固定し、色スキーム反転を無効化
sed -E -i 's/light-dark\(([^,]+),[^)]*\)/\1/g; s/color-scheme: light dark;//' "$OUT/$BASE.svg"
# 同一ページに複数 SVG を並べても id が衝突しないよう名前空間化
SLUG="$(echo "$BASE" | tr -c 'a-zA-Z0-9' '-' | sed 's/-*$//')"
sed -i "s/id=\"/id=\"${SLUG}-/g; s/url(#/url(#${SLUG}-/g; s/xlink:href=\"#/xlink:href=\"#${SLUG}-/g; s/ href=\"#/ href=\"#${SLUG}-/g" "$OUT/$BASE.svg"
xvfb-run -a drawio --no-sandbox --disable-gpu -x -f png --scale 2 -o "$OUT/$BASE.png" "$SRC" 2>/dev/null
echo "exported: $OUT/$BASE.svg ($(stat -c%s "$OUT/$BASE.svg") bytes) / $OUT/$BASE.png"
