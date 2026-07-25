// mirror-src/（逐語日本語訳 md）→ docs/mirror/（Atlas スタイル HTML）の決定論コンバータ。
// 前提: 訳文は原文と見出し数・順序・フェンス数が 1:1（TRANSLATION.md の規約）。
// 見出し id は原文（英語）テキストから GitHub 互換 slug を計算し、位置対応で訳文に振る。
// 使い方: node scripts/mirror-build/build-mirror.mjs
import { marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA = "ccf284b501591b90b4081a8e1c7b261cc6d2df46";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_ORIG = process.env.MIRROR_ORIG ?? "/tmp/aidlc-v2/docs";
const SRC_JA = process.env.MIRROR_SRC ?? path.join(REPO, "mirror-src");
const OUT = process.env.MIRROR_OUT ?? path.join(REPO, "docs/mirror");
const GH = `https://github.com/awslabs/aidlc-workflows/blob/${SHA}/`;
const GH_TREE = `https://github.com/awslabs/aidlc-workflows/tree/${SHA}/`;
const TODAY = process.env.MIRROR_DATE ?? new Date().toISOString().slice(0, 10);

// 上流の Mermaid はライトテーマ前提の Material 配色（薄い塗り + 濃い線）を style/classDef 行に
// ハードコードしており、ダーク地では文字が読めない。色相の意味（カテゴリ識別）を保ったまま
// サイトのダークパレットへ写像する。fill 系 → 暗色ティント、stroke 系 → 明るいアクセント。
const MERMAID_COLOR_MAP = new Map(Object.entries({
  // purple
  "#e1bee7": "#2a2440", "#f3e5f5": "#2a2440", "#7b1fa2": "#b895ff", "#9c27b0": "#b895ff",
  // green
  "#c8e6c9": "#1d332b", "#e8f5e9": "#1d332b", "#a5d6a7": "#1d332b",
  "#388e3c": "#57d9a9", "#2e7d32": "#57d9a9", "#4caf50": "#57d9a9",
  // blue
  "#bbdefb": "#1b2c47", "#e3f2fd": "#1b2c47", "#e8eaf6": "#1b2c47",
  "#1565c0": "#6db3ff", "#2196f3": "#6db3ff", "#3f51b5": "#6db3ff",
  // orange
  "#fff3e0": "#38291a", "#ffccbc": "#38291a", "#ffcc80": "#38291a",
  "#e65100": "#f2b35c", "#ff9800": "#f2b35c", "#bf360c": "#f2b35c", "#ef6c00": "#f2b35c",
  // yellow
  "#fff9c4": "#35301b", "#fff59d": "#35301b", "#f9a825": "#e5cf63", "#f57f17": "#e5cf63",
  // red / pink
  "#fce4ec": "#3a1f27", "#ffcdd2": "#3a1f27", "#f8bbd0": "#3a1f27", "#ef9a9a": "#3a1f27",
  "#c62828": "#ff8f8f", "#c2185b": "#ff8f8f", "#e91e63": "#ff8f8f",
}));

// 既知の Mermaid 描画バグ（メッセージ文中の ; は文区切りになる）の修正。upstream PR #651 相当。
const MERMAID_FIXES = [
  ["O->>ST: Report approved; engine marks [x] and routes", "O->>ST: Report approved — engine marks [x] and routes"],
  ["O->>O: Report outcome; engine completes and advances", "O->>O: Report outcome — engine completes and advances"],
  ["O->>O: Report outcome; engine updates state + advances", "O->>O: Report outcome — engine updates state + advances"],
  ["Note over A: Inline lead/support; mob lead-only persona + knowledge paths", "Note over A: Inline lead/support — mob lead-only persona + knowledge paths"],
  ["O->>O: Write Construction Autonomy Mode: autonomous; emit AUTONOMY_MODE_SET", "O->>O: Write Construction Autonomy Mode: autonomous — emit AUTONOMY_MODE_SET"],
];

const warnings = [];
const warn = (m) => { warnings.push(m); };

// ---- md の字句処理（フェンス対応） ----

// 行配列を [{type:'text'|'fence', lines, info}] に分割
function segment(md) {
  const lines = md.split("\n");
  const segs = [];
  let cur = { type: "text", lines: [] };
  let fence = null; // 開始フェンスの ``` 列
  for (const line of lines) {
    const m = line.match(/^(\s*)(`{3,})(.*)$/);
    if (!fence && m) {
      segs.push(cur);
      fence = m[2];
      cur = { type: "fence", lines: [line], info: m[3].trim() };
    } else if (fence && m && m[2].length >= fence.length && m[3].trim() === "") {
      cur.lines.push(line);
      segs.push(cur);
      fence = null;
      cur = { type: "text", lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (fence) {
    // 閉じ相手のないフェンス（upstream 末尾の typo 等）: 開始 ``` 行を捨て、残りは通常テキスト
    // として流す。空なら下の filter で消えるので、空の <pre> を出さない。mid-doc の孤立フェンスが
    // 後続本文を丸ごとコードブロックに飲み込む潜在バグも、これで同時に塞ぐ。
    warn(`unclosed fence (dropped stray opener)`);
    cur = { type: "text", lines: cur.lines.slice(1) };
  }
  segs.push(cur);
  return segs.filter((s) => s.lines.length > 0);
}

function headings(md) {
  const out = [];
  for (const seg of segment(md)) {
    if (seg.type !== "text") continue;
    for (const line of seg.lines) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ level: m[1].length, text: m[2] });
    }
  }
  return out;
}

// GitHub 互換 slug（近似）: 小文字化、md 装飾除去、英数・スペース・ハイフン・_ 以外を除去、スペース→-
function slugify(text, used) {
  let t = text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1");
  // MkDocs（Python-Markdown toc）準拠: 記号除去 → トリム → 連続する空白/ハイフンを 1 つに畳む → 前後ハイフン除去
  let s = t.toLowerCase()
    .replace(/[^\p{L}\p{N} \-_]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (used.has(s)) {
    let i = 1;
    while (used.has(`${s}-${i}`)) i++;
    s = `${s}-${i}`;
  }
  used.add(s);
  return s;
}

// ---- テキストセグメント処理 ----

// 見出しの明示アンカー <a id="x"></a>（原文で 1 箇所）: id 抽出用
const explicitId = (text) => text.match(/<a id="([^"]+)"><\/a>/)?.[1] ?? null;

// コードスパン外の処理: 明示アンカー除去 → スパン退避 → リンク書換 + 裸の < をエスケープ → 復元
// （docs に autolink <http…> と実 HTML は存在しないことを事前走査で確認済み）
function processText(text, relDir, fileSet) {
  text = text.replace(/<!--[\s\S]*?-->/g, ""); // HTML コメント（mermaid の Text fallback 等）は原文でも不可視
  text = text.replace(/<a id="[^"]*"><\/a>/g, "");
  const spans = [];
  text = text.replace(/(`+)([\s\S]*?)\1/g, (m) => {
    spans.push(m);
    return `\x00S${spans.length - 1}\x00`;
  });
  text = rewriteLinks(text, relDir, fileSet);
  text = text.replaceAll("<", "&lt;");
  text = text.replace(/\x00S(\d+)\x00/g, (m, i) => spans[+i]);
  return text;
}

// docs 内 .md への相対リンク → .html（アンカー維持・スペースは %20）
// docs 外・非 md → GitHub blob/tree URL（SHA 固定）
function rewriteLinks(text, relDir, fileSet) {
  return text.replace(/(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (all, pre, target, post) => {
    if (/^(https?:|mailto:|#)/.test(target)) return all;
    const [rawPath, anchor] = target.split("#");
    const decoded = decodeURIComponent(rawPath);
    const abs = path.posix.normalize(path.posix.join(relDir, decoded)); // docs ルート相対
    const anchorSuf = anchor ? `#${anchor}` : "";
    if (!abs.startsWith("..")) {
      if (abs.endsWith(".md") && fileSet.has(abs)) {
        const htmlRel = path.posix.relative(relDir, abs).replace(/\.md$/, ".html");
        return pre + encodeURI(htmlRel) + anchorSuf + post;
      }
      // docs 内だが対象外（非 md、または訳が無い）→ GitHub
      const ghPath = `docs/${abs}`;
      warn(`gh-fallback: ${relDir || "."} -> ${target}`);
      return pre + GH + ghPath.split("/").map(encodeURIComponent).join("/") + anchorSuf + post;
    }
    // docs 外（../../core/... 等）→ リポジトリルート相対に解決して GitHub
    const repoRel = path.posix.normalize(path.posix.join("docs", relDir, decoded));
    if (repoRel.startsWith("..")) { warn(`link out of repo: ${target}`); return all; }
    const isDir = !/\.[a-z0-9]+$/i.test(repoRel);
    const base = isDir ? GH_TREE : GH;
    return pre + base + repoRel.split("/").map(encodeURIComponent).join("/") + anchorSuf + post;
  });
}

// ---- HTML テンプレート ----

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// 言語なしフェンス = ターミナル出力。行単位の軽量トークン付けで読みやすくする。
function termHtml(body) {
  const lines = body.split("\n").map((raw) => {
    const t = raw.trimStart();
    const wrap = (cls) => `<span class="${cls}">${esc(raw)}</span>`;
    if (t.startsWith("▸")) return wrap("t-prompt");
    if (t.startsWith("> ") || t === ">") return wrap("t-input");
    if (t.startsWith("✓")) return wrap("t-ok");
    if (/^[─═┄]{3,}/.test(t) || /^[│├└┌┐┘┬┴]/.test(t)) {
      // 罫線・ツリー枝: 行内の `# 注釈` は faint に
      const m = raw.match(/^(.*?)(\s#\s.*)$/);
      if (m) return `${esc(m[1])}<span class="t-comment">${esc(m[2])}</span>`;
      return /^[─═┄]{3,}/.test(t) ? wrap("t-rule") : esc(raw);
    }
    if (t.startsWith("[AIDLC]")) return wrap("t-status");
    if (t.startsWith("# ") || t.startsWith("## ")) return wrap("t-hdr");
    const m = raw.match(/^(.*?)(\s{2,}(?:#\s.*|\(.+\)\s*))$/);
    if (m) return `${esc(m[1])}<span class="t-comment">${esc(m[2])}</span>`;
    return esc(raw);
  });
  return `<pre class="term"><code>${lines.join("\n")}</code></pre>`;
}
const stripMd = (s) => s.replace(/<a id="[^"]*"><\/a>/g, "").replace(/`([^`]*)`/g, "$1").replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*([^*]*)\*/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();

// セクション構成（ナビ生成用）
const SECTIONS = [
  { key: "guide", label: "USER GUIDE", match: (f) => f.startsWith("guide/") },
  { key: "harness-engineering", label: "HARNESS ENGINEERING", match: (f) => f.startsWith("harness-engineering/") },
  { key: "reference", label: "DEVELOPER REFERENCE", match: (f) => f.startsWith("reference/") },
  { key: "top", label: "docs", match: () => true },
];
const sectionOf = (f) => SECTIONS.find((s) => s.match(f)).key;

// ナビのサブグループ: セクション直下 / サブディレクトリごと
function navGroups(files, section) {
  const inSec = files.filter((f) => sectionOf(f) === section);
  const groups = new Map();
  for (const f of inSec) {
    const rest = section === "top" ? f : f.slice(section.length + 1);
    const sub = rest.includes("/") ? rest.slice(0, rest.lastIndexOf("/")) : "";
    if (!groups.has(sub)) groups.set(sub, []);
    groups.get(sub).push(f);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function pageHtml({ rel, title, body, pagetoc, files, titles }) {
  const depth = rel.split("/").length; // mirror/ 配下の深さ
  const up = "../".repeat(depth); // → docs/ ルート
  const assets = `${up}assets`;
  const mirrorRoot = "../".repeat(depth - 1);
  const section = sectionOf(rel);
  const relHref = (f) => mirrorRoot + f.replace(/\.md$/, ".html").split("/").map(encodeURIComponent).join("/");
  let toc = `  <div class="group">docs 日本語版</div>\n`;
  toc += `  <a href="${mirrorRoot}index.html">総合索引</a>\n`;
  toc += `  <a href="${up}index.html">Atlas トップ</a>\n`;
  for (const [sub, fl] of navGroups(files, section)) {
    const secLabel = SECTIONS.find((s) => s.key === section).label;
    toc += `  <div class="group">${esc(sub ? `${secLabel} / ${sub}` : secLabel)}</div>\n`;
    for (const f of fl.sort()) {
      const here = f === rel ? ` class="here"` : "";
      toc += `  <a href="${relHref(f)}"${here}>${esc(titles.get(f))}</a>\n`;
    }
  }
  const ptoc = pagetoc.map((h) => `  <a href="#${h.id}">${esc(h.text)}</a>`).join("\n");
  const origPath = `docs/${rel}`;
  const eyebrow = `AI-DLC DOCS 日本語版 / ${section === "top" ? "DOCS" : section.toUpperCase()}`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — AI-DLC docs 日本語版</title>
<link rel="stylesheet" href="${assets}/style.css">
<script defer src="${assets}/mermaid.min.js"></script>
<script defer src="${assets}/highlight.min.js"></script>
<script defer src="${assets}/app.js"></script>
<script type="module" src="${assets}/budoux-init.js"></script>
</head>
<body data-repo="aidlc">
<div class="nav-backdrop"></div>
<div class="wrap">

<header class="masthead">
  <button class="nav-toggle" type="button" aria-label="ページ一覧" aria-controls="site-nav" aria-expanded="false">☰</button>
  <a class="site" href="${up}index.html">AI-DLC WORKFLOWS ATLAS</a>
  <span class="here">docs 日本語版 / ${esc(rel.replace(/\.md$/, ""))}</span>
</header>

<div class="layout">
<nav class="toc" aria-label="ページ" id="site-nav">
${toc}</nav>

<nav class="pagetoc" aria-label="このページの目次">
  <div class="group">このページの目次</div>
${ptoc}
</nav>

<main>
<p class="eyebrow">${esc(eyebrow)}</p>
${body}
<footer class="meta">
  原文: <a href="${GH}${origPath.split("/").map(encodeURIComponent).join("/")}"><code>${esc(origPath)}</code></a>（基点コミット固定）· 逐語日本語訳 · 生成: ${TODAY}
</footer>
</main>
</div>

</div>
</body>
</html>
`;
}

// ---- 変換本体 ----

function listFiles(root) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".md") && e.name !== "TRANSLATION.md") out.push(rel);
    }
  })("");
  return out;
}

const files = listFiles(SRC_JA);
const origFiles = new Set(listFiles(SRC_ORIG));
const fileSet = new Set(files);
const titles = new Map();
const pageIds = new Map(); // rel -> Set(ids)
const parsed = new Map();
let parityFail = 0;

// pass 1: 解析 + パリティ検証 + slug 計算
for (const rel of files) {
  if (!origFiles.has(rel)) { warn(`no original for ${rel}`); continue; }
  const ja = fs.readFileSync(path.join(SRC_JA, rel), "utf-8");
  const en = fs.readFileSync(path.join(SRC_ORIG, rel), "utf-8");
  const hJa = headings(ja);
  const hEn = headings(en);
  if (hJa.length !== hEn.length || hJa.some((h, i) => h.level !== hEn[i].level)) {
    console.error(`PARITY FAIL ${rel}: headings ja=${hJa.length} en=${hEn.length} levels=${hJa.map(h=>h.level).join(",")} vs ${hEn.map(h=>h.level).join(",")}`);
    parityFail++;
  }
  const fJa = segment(ja).filter((s) => s.type === "fence").length;
  const fEn = segment(en).filter((s) => s.type === "fence").length;
  if (fJa !== fEn) { console.error(`PARITY FAIL ${rel}: fences ja=${fJa} en=${fEn}`); parityFail++; }
  const used = new Set();
  const ids = hEn.map((h) => {
    const ex = explicitId(h.text);
    if (ex) { used.add(ex); return ex; }
    return slugify(h.text, used);
  });
  titles.set(rel, stripMd(hJa[0]?.level === 1 ? hJa[0].text : (hJa[0]?.text ?? rel)));
  pageIds.set(rel, new Set(ids));
  parsed.set(rel, { ja, ids, hJa });
}
if (parityFail > 0) {
  console.error(`\n${parityFail} parity failure(s) — fix mirror-src first.`);
  process.exit(2);
}

// pass 2: 描画
marked.setOptions({ gfm: true, breaks: false });
let mermaidFixed = 0;
for (const rel of files) {
  const { ja, ids, hJa } = parsed.get(rel);
  const relDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  const segs = segment(ja);
  const mermaids = [];
  const terms = [];
  const mdParts = [];
  for (const seg of segs) {
    if (seg.type === "fence" && seg.info.startsWith("mermaid")) {
      let bodyLines = seg.lines.slice(1, -1);
      bodyLines = bodyLines.map((l) => {
        for (const [from, to] of MERMAID_FIXES) if (l.includes(from)) { mermaidFixed++; l = l.replace(from, to); }
        if (/^\s*[^%\s].*: .*;/.test(l)) warn(`mermaid semicolon (unpatched) in ${rel}: ${l.trim().slice(0, 60)}`);
        if (/\b(style|classDef|linkStyle)\b/.test(l)) {
          l = l.replace(/#[0-9a-fA-F]{6}\b/g, (c) => {
            const mapped = MERMAID_COLOR_MAP.get(c.toLowerCase());
            if (!mapped) { warn(`mermaid unmapped color ${c} in ${rel}`); return c; }
            return mapped;
          });
        }
        return l;
      });
      mermaids.push(bodyLines.join("\n"));
      mdParts.push(`\n\nMERMAIDPLACEHOLDER${mermaids.length - 1}X\n\n`);
    } else if (seg.type === "fence" && seg.info === "") {
      terms.push(seg.lines.slice(1, -1).join("\n"));
      mdParts.push(`\n\nTERMPLACEHOLDER${terms.length - 1}X\n\n`);
    } else if (seg.type === "fence") {
      mdParts.push(seg.lines.join("\n"));
    } else {
      mdParts.push(processText(seg.lines.join("\n"), relDir, fileSet));
    }
  }
  let html = marked.parse(mdParts.join("\n"));
  // 見出し id を位置対応で付与
  let hi = 0;
  html = html.replace(/<h([1-6])>/g, (m, lv) => `<h${lv} id="${ids[hi++] ?? `h-${hi}`}">`);
  if (hi !== ids.length) warn(`heading count drift after render in ${rel}: rendered=${hi} expected=${ids.length}`);
  // mermaid / term 復元
  html = html.replace(/<p>MERMAIDPLACEHOLDER(\d+)X<\/p>/g, (m, i) => `<pre class="mermaid">\n${esc(mermaids[+i])}\n</pre>`);
  html = html.replace(/<p>TERMPLACEHOLDER(\d+)X<\/p>/g, (m, i) => termHtml(terms[+i]));
  if (/MERMAIDPLACEHOLDER|TERMPLACEHOLDER/.test(html)) warn(`placeholder leak in ${rel}`);
  const pagetoc = hJa.map((h, i) => ({ ...h, id: ids[i] })).filter((h) => h.level === 2).map((h) => ({ id: h.id, text: stripMd(h.text) }));
  const outPath = path.join(OUT, rel.replace(/\.md$/, ".html"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pageHtml({ rel, title: titles.get(rel), body: html, pagetoc, files, titles }));
}

// 総合索引
{
  const groups = SECTIONS.filter((s) => s.key !== "top").map((s) => ({
    ...s,
    files: files.filter((f) => sectionOf(f) === s.key).sort(),
  }));
  const topFiles = files.filter((f) => sectionOf(f) === "top").sort();
  const card = (f) => `    <a class="card" href="${f.replace(/\.md$/, ".html").split("/").map(encodeURIComponent).join("/")}">
      <div class="card-head"><span class="card-name">${esc(titles.get(f))}</span></div>
      <p><code>docs/${esc(f)}</code></p>
    </a>`;
  const secBlock = (label, id, fl) => `\n<h2 id="${id}">${esc(label)}（${fl.length}）</h2>\n<div class="cards">\n${fl.map(card).join("\n")}\n</div>`;
  const body = `<p class="eyebrow">AI-DLC DOCS 日本語版</p>
<h1>公式 docs 日本語版 — 総合索引</h1>
<p class="lede">awslabs/aidlc-workflows v2 の docs/ 全 ${files.length} ファイルの逐語日本語訳。構造（見出し・表・コード・図）は原文と 1:1 で、見出しアンカーは原文由来のため原文へのリンクと相互に対応する。コードブロックは原文のまま。各ページ末尾に原文へのリンクがある。</p>
${secBlock("User Guide（利用者向け）", "guide", groups[0].files)}
${secBlock("Harness Engineering（拡張者向け）", "he", groups[1].files)}
${secBlock("Developer Reference（開発者向け）", "reference", groups[2].files)}
${secBlock("その他", "top", topFiles)}`;
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>公式 docs 日本語版 — AI-DLC Workflows Atlas</title>
<link rel="stylesheet" href="../assets/style.css">
<script defer src="../assets/mermaid.min.js"></script>
<script defer src="../assets/highlight.min.js"></script>
<script defer src="../assets/app.js"></script>
<script type="module" src="../assets/budoux-init.js"></script>
</head>
<body data-repo="aidlc">
<div class="wrap">

<header class="masthead">
  <a class="site" href="../index.html">AI-DLC WORKFLOWS ATLAS</a>
  <span class="here">docs 日本語版 / 総合索引</span>
</header>

<div class="layout no-nav">
<nav class="pagetoc" aria-label="このページの目次">
  <div class="group">このページの目次</div>
  <a href="#guide">User Guide</a>
  <a href="#he">Harness Engineering</a>
  <a href="#reference">Developer Reference</a>
  <a href="#top">その他</a>
</nav>

<main>
${body}
<footer class="meta">
  原文: awslabs/aidlc-workflows <code>v2</code> @ <a href="${GH_TREE.slice(0, -1)}">ccf284b</a> · 生成: ${TODAY} · 内容の改変は 2 点のみ — 描画不能だった Mermaid 5 図のセミコロン修正（upstream PR と同内容）と、図配色のダークパレットへの写像（色の意味は保持）
</footer>
</main>
</div>

</div>
</body>
</html>
`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}

// アンカー検証: mirror 内リンクの #anchor が対象ページの id に存在するか
for (const rel of files) {
  const html = fs.readFileSync(path.join(OUT, rel.replace(/\.md$/, ".html")), "utf-8");
  const relDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  for (const m of html.matchAll(/href="([^"#]*\.html)#([^"]+)"/g)) {
    const target = path.posix.normalize(path.posix.join(relDir, decodeURI(m[1])));
    const tmd = target.replace(/\.html$/, ".md");
    if (fileSet.has(tmd) && !pageIds.get(tmd)?.has(m[2])) warn(`anchor miss: ${rel} -> ${m[1]}#${m[2]}`);
  }
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (!pageIds.get(rel)?.has(m[1]) && !["guide", "he", "reference", "top"].includes(m[1])) {
      // pagetoc 自身の id は pageIds に含まれるので、それ以外はミス
      warn(`self-anchor miss: ${rel} -> #${m[1]}`);
    }
  }
}

console.log(`built ${files.length} page(s) + index; mermaid lines fixed: ${mermaidFixed}`);
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  for (const w of [...new Set(warnings)]) console.log("  " + w);
}
