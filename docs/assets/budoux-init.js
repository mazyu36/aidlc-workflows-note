/* BudouX による日本語の文節改行 (Safari 対応。Chrome の word-break: auto-phrase と併用)
   コード・抜粋・Mermaid ソースには適用しない (ZWSP 混入を避ける) */
import { loadDefaultJapaneseParser } from './budoux.esm.js';

const parser = loadDefaultJapaneseParser();
const targets = document.querySelectorAll('main p, main li, main td, main figcaption, main h1, main h2, main h3, .lede');
targets.forEach((el) => {
  if (el.closest('pre') || el.closest('.excerpt') || el.closest('code')) return;
  parser.applyToElement(el);
});
