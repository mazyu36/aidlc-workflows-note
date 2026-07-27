#!/usr/bin/env bash
# docs/ 内の GitHub blob/tree リンク（SHA 固定）を、ローカル clone の git オブジェクトと
# 突き合わせて検証する。missing: 0 になるまでページを直すこと。
# 対象 owner: awslabs（aidlc-workflows）。
#
# clone の探索順:
#   1. UPSTREAM 環境変数（CI 向け。aidlc-workflows の clone を直接指す）
#   2. <ghq-root>/github.com/awslabs/<repo>（ローカル作業向け）
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GHQ_ROOT="$(ghq root 2>/dev/null || echo "$HOME/ghq")"
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
done < <(grep -rhoE 'https://github\.com/awslabs/[a-z-]+/(blob|tree)/[0-9a-f]{40}[^"]*' "$ROOT/docs" | sort -u)

echo "checked: $total, missing: $fail"
[ "$fail" -eq 0 ]
