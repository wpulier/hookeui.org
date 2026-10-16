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

// The bar is dark while the hero's sky is under it, light once the page below is.
(function () {
  var bar = document.querySelector('.top'), sky = document.querySelector('.sky');
  if (!bar || !sky) return;
  function check() { bar.classList.toggle('on-sky', sky.getBoundingClientRect().bottom > bar.offsetHeight); }
  addEventListener('scroll', check, { passive: true }); addEventListener('resize', check); check();
})();

// Without WebGL 2 the sky can't be drawn, so the hero shows a still of it instead.
(function () {
  var sky = document.querySelector('.sky'), ok = false;
  try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
  if (sky && !ok) sky.classList.add('still-bg');
})();
