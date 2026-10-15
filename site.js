// Loops play only while on screen. With reduced motion they don't autoplay: each shows its poster and controls.
(() => {
  const loops = [...document.querySelectorAll("video.loop")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const settle = () => {
    for (const v of loops) {
      v.controls = still.matches;
      if (still.matches) v.pause();
    }
  };
  settle();
  still.addEventListener?.("change", settle);
  if ("IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (still.matches) continue;
        if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); }
        else v.pause();
      }
    }, { threshold: 0.15 });
    loops.forEach((v) => seen.observe(v));
  }

  for (const b of document.querySelectorAll("button.copy-btn")) {
    b.addEventListener("click", async () => {
      const text = document.getElementById(b.dataset.copy)?.textContent ?? "";
      try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; }
      catch { b.textContent = "Select and copy"; }
      setTimeout(() => { b.textContent = "Copy"; }, 2000);
    });
  }
})();
