#!/usr/bin/env bash
# docs/ 内の GitHub blob/tree リンクを、ローカル clone の git オブジェクトと突き合わせて
# 検証する。missing: 0 になるまでページを直すこと。
# リンクは可動の blob/v2 形式が正（表示時に app.js が基点へ張り替える）。v2 リンクは
# meta.json の analyzedCommit（分析基点）で解決して実在を確認する。40 桁 SHA 直書きの
# リンクも検証はする（が、規約上は新規に書かないこと）。
# 対象 owner: awslabs（aidlc-workflows）。
#
# clone の探索順:
#   1. UPSTREAM 環境変数（CI 向け。aidlc-workflows の clone を直接指す）
#   2. <ghq-root>/github.com/awslabs/<repo>（ローカル作業向け）
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GHQ_ROOT="$(ghq root 2>/dev/null || echo "$HOME/ghq")"
BASE_SHA="$(node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).analyzedCommit' "$ROOT/docs/aidlc-workflows/meta.json")"
fail=0
total=0

while IFS= read -r url; do
  total=$((total + 1))
  rest="${url#https://github.com/awslabs/}"
  repo="${rest%%/*}"; rest="${rest#*/}"
  kind="${rest%%/*}"; rest="${rest#*/}"      # blob | tree
  sha="${rest%%/*}"
  path="${rest#*/}"
  path="${path%%#*}"                          # #Lnn アンカーを除去
  [ "$path" = "$sha" ] && path=""             # リポジトリルートへの tree リンク
  [ "$sha" = "v2" ] && sha="$BASE_SHA"        # 可動リンクは分析基点で解決する
  # URL エンコード（%20 等）を git オブジェクト名に合わせてデコードする
  [ -n "$path" ] && path=$(printf '%b' "${path//%/\\x}")

  if [ -n "${UPSTREAM:-}" ]; then
    d="$UPSTREAM"
  else
    d="$GHQ_ROOT/github.com/awslabs/$repo"
  fi
  if [ ! -d "$d/.git" ] && [ ! -f "$d/.git" ]; then
    echo "SKIP (clone なし): $url"
    continue
  fi
  if [ -n "$path" ]; then spec="$sha:$path"; else spec="$sha^{tree}"; fi
  if ! git -C "$d" cat-file -e "$spec" 2>/dev/null; then
    echo "MISS: $url"
    fail=$((fail + 1))
  fi
done < <(grep -rhoE 'https://github\.com/awslabs/[a-z-]+/(blob|tree)/(v2|[0-9a-f]{40})[^"]*' "$ROOT/docs" | sort -u)

echo "checked: $total, missing: $fail"
[ "$fail" -eq 0 ]
