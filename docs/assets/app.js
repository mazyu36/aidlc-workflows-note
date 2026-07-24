/* Kiro Codebase Atlas — 共通スクリプト (依存なし・オフライン動作) */

// Mermaid 初期化: ダークテーマ + 高コントラスト
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
      primaryBorderColor: "#2c3850",
      secondaryColor: "#1e2736",
      tertiaryColor: "#10141d",
      lineColor: "#9aa7bf",
      textColor: "#e8ecf4",
      noteTextColor: "#e8ecf4",
      noteBkgColor: "#1e2736",
      noteBorderColor: "#2c3850",
      actorTextColor: "#e8ecf4",
      signalTextColor: "#e8ecf4",
      labelTextColor: "#e8ecf4",
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontSize: "13px"
    }
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
