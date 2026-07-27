#!/usr/bin/env node
// ノートが上流に対して実際に古くなったかを機械的に判定する。
//
// 「上流が動いた」ではなく「ノートの検査可能な主張が壊れた」を検出するのが目的。
// 上流 v2 は活発なので、テスト修正だけのコミットで LLM を起動しないための門になる。
//
// 使い方:
//   UPSTREAM=/path/to/upstream/clone node scripts/check-staleness.mjs [--json]
//   UPSTREAM は origin/v2 を fetch 済みの clone。新 HEAD は origin/v2 から解決する。
//
// 終了コード: 0 = 追随済みまたは機械更新で済む / 1 = LLM による更新が必要 / 2 = 実行エラー

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = process.env.UPSTREAM ?? "/tmp/aidlc-upstream";
const META = path.join(REPO, "docs/aidlc-workflows/meta.json");
const JSON_OUT = process.argv.includes("--json");

const git = (...args) =>
  execFileSync("git", ["-C", UPSTREAM, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

// 上流の指定コミットからファイル内容を読む。存在しなければ null。
function show(sha, file) {
  try {
    return execFileSync("git", ["-C", UPSTREAM, "show", `${sha}:${file}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

// 指定コミットでのディレクトリ配下のファイル数
function countFiles(sha, dir, ext) {
  try {
    const out = execFileSync("git", ["-C", UPSTREAM, "ls-tree", "-r", "--name-only", sha, "--", dir], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter((l) => l.trim() && (!ext || l.endsWith(ext))).length;
  } catch {
    return 0;
  }
}

function countDirs(sha, dir) {
  try {
    const out = execFileSync("git", ["-C", UPSTREAM, "ls-tree", "--name-only", "-d", sha, `${dir}/`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const norm = (s) => s.replace(/\r/g, "").replace(/[ \t]+$/gm, "").replace(/\n+$/, "");

function authoredPages() {
  const dir = path.join(REPO, "docs/aidlc-workflows");
  const pages = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(dir, f));
  pages.push(path.join(REPO, "docs/index.html"));
  return pages.filter((p) => fs.existsSync(p));
}

// ---- 信号 B: 行番号つきコード抜粋が新 HEAD でも一致するか ----
function checkExcerpts(newSha) {
  const re =
    /<figure class="excerpt">[\s\S]*?href="[^"]*blob\/[0-9a-f]{40}\/([^"#]+)#L(\d+)-L(\d+)"[\s\S]*?<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g;
  const drifted = [];
  let total = 0;
  for (const page of authoredPages()) {
    const html = fs.readFileSync(page, "utf8");
    for (const m of html.matchAll(re)) {
      total++;
      const file = decodeURIComponent(m[1]);
      const from = Number(m[2]);
      const to = Number(m[3]);
      const quoted = norm(decode(m[4]));
      const src = show(newSha, file);
      if (src === null) {
        drifted.push({ page: path.basename(page), file, range: `${from}-${to}`, reason: "file missing upstream" });
        continue;
      }
      const actual = norm(src.split("\n").slice(from - 1, to).join("\n"));
      if (actual !== quoted) {
        drifted.push({ page: path.basename(page), file, range: `${from}-${to}`, reason: "content differs at those lines" });
      }
    }
  }
  return { total, drifted };
}

// ---- 信号 C: ノートが主張する実数値が新 HEAD でも成り立つか ----
function checkCounts(newSha) {
  const facts = [
    { label: "stages", claimed: 32, actual: countFiles(newSha, "core/aidlc-common/stages", ".md") },
    { label: "agents", claimed: 14, actual: countFiles(newSha, "core/agents", ".md") },
    { label: "hooks", claimed: 13, actual: countFiles(newSha, "core/hooks", ".ts") },
    { label: "tools", claimed: 30, actual: countFiles(newSha, "core/tools", ".ts") },
    { label: "knowledge", claimed: 59, actual: countFiles(newSha, "core/knowledge", ".md") },
    { label: "scopes", claimed: 9, actual: countFiles(newSha, "core/scopes", ".md") },
    { label: "sensors", claimed: 4, actual: countFiles(newSha, "core/sensors", ".md") },
    { label: "docs", claimed: 91, actual: countFiles(newSha, "docs", ".md") },
    { label: "harnesses", claimed: 5, actual: countDirs(newSha, "harness") },
  ];
  return facts.filter((f) => f.claimed !== f.actual);
}

// ---- 信号 D: 参照している上流パスが新 HEAD にも存在するか ----
function checkPaths(newSha) {
  const re = /https:\/\/github\.com\/awslabs\/aidlc-workflows\/(?:blob|tree)\/[0-9a-f]{40}\/([^"#]*)/g;
  const seen = new Set();
  const missing = [];
  for (const page of [...authoredPages(), ...walk(path.join(REPO, "docs/mirror"))]) {
    const html = fs.readFileSync(page, "utf8");
    for (const m of html.matchAll(re)) {
      const p = decodeURIComponent(m[1]).replace(/\/$/, "");
      if (!p || seen.has(p)) continue;
      seen.add(p);
      try {
        execFileSync("git", ["-C", UPSTREAM, "cat-file", "-e", `${newSha}:${p}`], { stdio: "ignore" });
      } catch {
        missing.push(p);
      }
    }
  }
  return { checked: seen.size, missing };
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// ---- 本体 ----
let result;
try {
  const meta = JSON.parse(fs.readFileSync(META, "utf8"));
  const oldSha = meta.analyzedCommit;
  const newSha = git("rev-parse", "origin/v2");

  if (oldSha === newSha) {
    result = { verdict: "up-to-date", oldSha, newSha, commits: 0 };
  } else {
    const commits = Number(git("rev-list", "--count", `${oldSha}..${newSha}`));
    const docsChanged = git("diff", "--name-only", `${oldSha}..${newSha}`, "--", "docs/")
      .split("\n")
      .filter(Boolean);
    const excerpts = checkExcerpts(newSha);
    const counts = checkCounts(newSha);
    const paths = checkPaths(newSha);

    // 作業は 2 系統に分かれる。ミラー（逐語訳）は上流 docs の変更にのみ従い、
    // 解説ページは抜粋の行ズレ・実数値・参照パスの破れに従う。
    // ワークフローが片方だけを起こせるよう、系統ごとのフラグを出す。
    const needsMirror = docsChanged.length > 0;
    const needsPages = excerpts.drifted.length > 0 || counts.length > 0 || paths.missing.length > 0;
    result = {
      verdict: needsMirror || needsPages ? "needs-update" : "sha-bump-only",
      needsMirror,
      needsPages,
      oldSha,
      newSha,
      commits,
      signals: {
        docsChanged,
        excerptDrift: excerpts.drifted,
        excerptsChecked: excerpts.total,
        countDrift: counts,
        missingPaths: paths.missing,
        pathsChecked: paths.checked,
      },
    };
  }
} catch (err) {
  if (JSON_OUT) console.log(JSON.stringify({ verdict: "error", message: String(err.message ?? err) }));
  else console.error(`error: ${err.message ?? err}`);
  process.exit(2);
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const s = result.signals;
  console.log(`verdict : ${result.verdict}`);
  if (result.verdict !== "up-to-date") {
    console.log(`work    : mirror=${result.needsMirror ? "要" : "不要"} / pages=${result.needsPages ? "要" : "不要"}`);
  }
  console.log(`old     : ${result.oldSha}`);
  console.log(`new     : ${result.newSha}  (${result.commits} commit(s) ahead)`);
  if (s) {
    console.log(`docs changed     : ${s.docsChanged.length}`);
    s.docsChanged.slice(0, 10).forEach((f) => console.log(`  ${f}`));
    if (s.docsChanged.length > 10) console.log(`  ... and ${s.docsChanged.length - 10} more`);
    console.log(`excerpt drift    : ${s.excerptDrift.length} / ${s.excerptsChecked} checked`);
    s.excerptDrift.forEach((d) => console.log(`  ${d.page}: ${d.file}:${d.range} (${d.reason})`));
    console.log(`count drift      : ${s.countDrift.length}`);
    s.countDrift.forEach((c) => console.log(`  ${c.label}: note says ${c.claimed}, upstream has ${c.actual}`));
    console.log(`missing paths    : ${s.missingPaths.length} / ${s.pathsChecked} checked`);
    s.missingPaths.slice(0, 10).forEach((p) => console.log(`  ${p}`));
  }
}

process.exit(result.verdict === "needs-update" ? 1 : 0);
