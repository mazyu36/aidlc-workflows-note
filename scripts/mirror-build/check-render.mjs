// docs/mirror 全ページを headless Chromium で開き、Mermaid の描画成否と
// コンソールエラーを機械カウントする。使い方: node scripts/mirror-build/check-render.mjs [baseURL]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIRROR = path.join(REPO, "docs/mirror");
const base = process.argv[2] ?? "http://127.0.0.1:8000/mirror";

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(path.join(MIRROR, d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = d ? `${d}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let bad = 0;
const consoleErrs = [];
page.on("pageerror", (e) => consoleErrs.push(String(e).slice(0, 120)));
for (const rel of pages) {
  consoleErrs.length = 0;
  await page.goto(`${base}/${rel.split("/").map(encodeURIComponent).join("/")}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const pres = [...document.querySelectorAll("pre.mermaid")];
    return {
      total: pres.length,
      ok: pres.filter((p) => p.getAttribute("data-processed") === "true" && p.querySelector("svg") && !p.textContent.includes("Syntax error")).length,
      err: pres.filter((p) => p.textContent.includes("Syntax error")).length,
    };
  });
  const flag = r.total !== r.ok || consoleErrs.length > 0;
  if (flag) { bad++; console.log(`NG ${rel}: mermaid ${r.ok}/${r.total} err=${r.err} console=${consoleErrs.join(" | ")}`); }
  else if (r.total > 0) console.log(`ok ${rel}: mermaid ${r.ok}/${r.total}`);
}
await browser.close();
console.log(`\nchecked ${pages.length} page(s); NG=${bad}`);
process.exit(bad ? 1 : 0);
