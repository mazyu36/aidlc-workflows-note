#!/usr/bin/env bash
# 基点コミットを張り替える。参照リンク（40 桁 SHA）・masthead バッジ（短縮 7 桁）・
# ビルド定数・meta.json をまとめて更新し、ミラーを再生成して参照を検証する。
#
# 使い方: bash scripts/retarget-sha.sh <旧 SHA 40桁> <新 SHA 40桁>
# 前提: UPSTREAM が上流 clone を指し、新基点が checkout 済みであること。
set -euo pipefail

OLD="${1:?旧 SHA を指定してください}"
NEW="${2:?新 SHA を指定してください}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="${UPSTREAM:-/tmp/aidlc-upstream}"
cd "$ROOT"

SHORT_OLD="${OLD:0:7}"
SHORT_NEW="${NEW:0:7}"

echo "基点を ${SHORT_OLD} → ${SHORT_NEW} に張り替えます"

# 40 桁 SHA（参照リンク・ビルド定数）
# ファイル名に空白を含むものがあるため、xargs の区切りは改行に固定する。
grep -rl "$OLD" docs mirror-src scripts AGENTS.md README.md 2>/dev/null \
  | grep -v '^scripts/retarget-sha.sh$' \
  | xargs -r -d '\n' sed -i "s/${OLD}/${NEW}/g"

# 短縮 7 桁（masthead バッジの表示テキストなど）
grep -rl "$SHORT_OLD" docs 2>/dev/null | xargs -r -d '\n' sed -i "s/${SHORT_OLD}/${SHORT_NEW}/g"

# meta.json（基点の正）。analyzedAt はミラー footer の日付にも使われる。
node -e '
  const fs = require("fs");
  const p = "docs/aidlc-workflows/meta.json";
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  m.analyzedCommit = process.argv[1];
  m.analyzedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
' "$NEW"

# 生成物を作り直す。パリティ不一致ならここで exit 2 になる。
MIRROR_ORIG="$UPSTREAM/docs" node scripts/mirror-build/build-mirror.mjs

# 張り替えたリンクが新基点に実在するか
UPSTREAM="$UPSTREAM" bash scripts/validate-refs.sh

echo "張り替え完了"
