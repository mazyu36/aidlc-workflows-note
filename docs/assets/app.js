/* Kiro Codebase Atlas — 共通スクリプト (依存なし・オフライン動作) */

// 基点ピン: ページ内の上流リンクは可動の blob/v2・tree/v2 形式で書かれており、表示時に
// base.js の基点コミット（40 桁 SHA）へ張り替える。基点をページに直書きしないことで、
// 基点更新の差分を base.js と meta.json の 2 ファイルに閉じ込めるための仕掛け。
// JS が動かない閲覧ではブランチリンクのまま残る（リンク切れはしないが行番号はズレ得る）。
(() => {
  const base = window.AIDLC_BASE;
  if (!base || !/^[0-9a-f]{40}$/.test(base.sha)) return;
  const short = base.sha.slice(0, 7);
  const re = /^(https:\/\/github\.com\/awslabs\/aidlc-workflows\/(?:blob|tree|raw)\/)v2(?=\/|$)/;
  document.querySelectorAll('a[href^="https://github.com/awslabs/aidlc-workflows/"]').forEach((a) => {
    a.href = a.href.replace(re, `$1${base.sha}`);
  });
  document.querySelectorAll(".gh-hash").forEach((el) => { el.textContent = short; });
  document.querySelectorAll("a.gh-link").forEach((el) => {
    el.title = `分析基点: awslabs/aidlc-workflows @ ${short}`;
  });
  document.querySelectorAll(".base-date").forEach((el) => { el.textContent = base.analyzedAt; });
})();

// Mermaid 初期化: ダークテーマ + 高コントラスト。
// 書体は本文と同じ sans（図ラベルは文章であってコードではない）。
// ノード配色はサイトのトークンに合わせ、docs ミラーの図は build-mirror.mjs が
// 上流のライト配色をこのパレットへ写像してから描画される。
if (window.mermaid) {
  mermaid.initialize({
    startOnLoad: true,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#161d29",
      primaryColor: "#1e2736",
      primaryTextColor: "#e8ecf4",
      primaryBorderColor: "#8492ac",
      secondaryColor: "#1e2736",
      tertiaryColor: "#10141d",
      lineColor: "#9aa7bf",
      textColor: "#e8ecf4",
      mainBkg: "#1e2736",
      nodeBorder: "#8492ac",
      clusterBkg: "#10141d",
      clusterBorder: "#2c3850",
      edgeLabelBackground: "#10141d",
      titleColor: "#e8ecf4",
      noteTextColor: "#e8ecf4",
      noteBkgColor: "#1e2736",
      noteBorderColor: "#f2b35c",
      actorBkg: "#1e2736",
      actorBorder: "#8492ac",
      actorTextColor: "#e8ecf4",
      actorLineColor: "#5b6880",
      signalColor: "#9aa7bf",
      signalTextColor: "#e8ecf4",
      labelTextColor: "#e8ecf4",
      labelBoxBkgColor: "#10141d",
      labelBoxBorderColor: "#2c3850",
      activationBkgColor: "#2a2440",
      activationBorderColor: "#b895ff",
      stateBkg: "#1e2736",
      stateLabelColor: "#e8ecf4",
      transitionColor: "#9aa7bf",
      compositeBackground: "#10141d",
      compositeTitleBackground: "#1e2736",
      fontFamily: '"Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic UI", -apple-system, "Segoe UI", sans-serif',
      fontSize: "13.5px"
    },
    flowchart: { curve: "basis", nodeSpacing: 40, rankSpacing: 55, padding: 10 },
    sequence: { mirrorActors: false, actorMargin: 45, messageMargin: 32, boxMargin: 8 }
  });
}

// コード参照チップ: ローカルパスのコピー
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy[data-copy]");
  if (!btn) return;
  const text = btn.dataset.copy;
  const done = () => {
    const prev = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("done");
    setTimeout(() => { btn.textContent = prev; btn.classList.remove("done"); }, 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
});

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (_) { /* noop */ }
  document.body.removeChild(ta);
}

// 図のクリック拡大 (ライトボックス)
document.addEventListener("click", (e) => {
  if (e.target.closest(".lightbox")) {
    document.querySelector(".lightbox")?.remove();
    return;
  }
  const svg = e.target.closest(".diagram svg, pre.mermaid[data-processed='true'] svg");
  if (!svg) return;
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.appendChild(svg.cloneNode(true));
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "クリックまたは Esc で閉じる";
  overlay.appendChild(hint);
  document.body.appendChild(overlay);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelector(".lightbox")?.remove();
});

// コード抜粋のシンタックスハイライト
if (window.hljs) {
  document.querySelectorAll('pre code[class*="language-"]').forEach((el) => hljs.highlightElement(el));
}

// コード / ターミナルブロックのコピー（mermaid を除く全 pre）
document.querySelectorAll("pre").forEach((pre) => {
  if (pre.classList.contains("mermaid")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "codecopy";
  btn.textContent = "コピー";
  btn.setAttribute("aria-label", "ブロックの内容をコピー");
  btn.addEventListener("click", () => {
    const text = pre.querySelector("code")?.textContent ?? pre.textContent;
    const write = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(text.replace(/\n$/, ""))
      : Promise.reject();
    write.then(
      () => { btn.textContent = "✓ コピー済み"; setTimeout(() => { btn.textContent = "コピー"; }, 1200); },
      () => fallbackCopy(text, () => { btn.textContent = "✓ コピー済み"; setTimeout(() => { btn.textContent = "コピー"; }, 1200); })
    );
  });
  pre.appendChild(btn);
});

// 目次のスクロール追従ハイライト
const tocLinks = Array.from(document.querySelectorAll(".pagetoc a[href^='#']"));
if (tocLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        tocLinks.forEach((a) => a.classList.remove("active"));
        const link = byId.get(entry.target.id);
        if (link) link.classList.add("active");
      }
    },
    { rootMargin: "0px 0px -70% 0px" }
  );
  document.querySelectorAll("h2[id]").forEach((h) => observer.observe(h));
}

// 左ナビ (off-canvas ドロワー) の開閉。≤1400px でのみ .nav-toggle が表示される。
// no-nav ページには .nav-toggle が無いので、その場合は何もしない。
const navToggle = document.querySelector(".nav-toggle");
if (navToggle) {
  const siteNav = document.getElementById("site-nav");
  const backdrop = document.querySelector(".nav-backdrop");
  const setNavOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.textContent = open ? "✕" : "☰";
  };
  navToggle.addEventListener("click", () => setNavOpen(!document.body.classList.contains("nav-open")));
  backdrop?.addEventListener("click", () => setNavOpen(false));
  // ナビ内リンクのクリックで遷移するときはドロワーを閉じる
  siteNav?.addEventListener("click", (e) => { if (e.target.closest("a")) setNavOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setNavOpen(false); });
}
