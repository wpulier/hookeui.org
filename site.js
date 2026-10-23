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

// The bar is dark while night is under it: the hero, the dark top of the dawn, the night the dusk becomes, and the end.
(function () {
  var bar = document.querySelector('.top');
  if (!bar || bar.hasAttribute('data-always-dark')) return;
  // [element, where its dark part starts, where it ends], as fractions of its height (or pixels).
  var dark = [['.sky', 0, 1], ['.dawn', 0, 0.62], ['.dusk', 270, 1], ['.night-end', 0, 1], ['.foot', 0, 1]]
    .map(function (d) { return [document.querySelector(d[0]), d[1], d[2]]; }).filter(function (d) { return d[0]; });
  function check() {
    var y = bar.offsetHeight, on = false;
    dark.forEach(function (d) {
      var r = d[0].getBoundingClientRect();
      var from = d[1] > 1 ? d[1] : r.height * d[1];  // more than 1: pixels from its top
      if (y > r.top + from && y < r.top + r.height * d[2]) on = true;
    });
    bar.classList.toggle('on-sky', on);
  }
  addEventListener('scroll', check, { passive: true }); addEventListener('resize', check); check();
})();

// The plate: every cell Cellpose-SAM outlined in the stem, drawn in ink from the centre out when it comes into view.
// Pointing at one says what the app measured; while nobody points, a cell now and then lights, as if being measured.
(function () {
  var fig = document.querySelector('.plate'), svg = fig && fig.querySelector('.plate-ink'), read = fig && fig.querySelector('.plate-read');
  if (!svg || !('IntersectionObserver' in window) || !window.fetch) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches, NS = 'http://www.w3.org/2000/svg';
  var paths = [], cells = [], pointing = false, shown = false, drawn = false, glint = 0;
  var fmt = function (n) { return n.toLocaleString('en'); };

  function build(data) {
    var cx = data.disc[0], cy = data.disc[1], R = 296;
    svg.setAttribute('viewBox', (cx - R) + ' ' + (cy - R) + ' ' + 2 * R + ' ' + 2 * R);
    var frag = document.createDocumentFragment(), maxDelay = 0;
    data.cells.forEach(function (c, i) {
      var m = /^M(-?\d+) (-?\d+)/.exec(c[0]);
      if (!m || Math.hypot(+m[1] - cx, +m[2] - cy) > R + 24) return;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', c[0]); p.setAttribute('pathLength', '1'); p.dataset.i = i;
      var delay = c[5] * 0.17 + Math.random() * 0.3; maxDelay = Math.max(maxDelay, delay);
      if (!still) p.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.45, 0, 0.2, 1) ' + delay.toFixed(2) + 's';
      frag.appendChild(p); paths.push(p);
    });
    cells = data.cells; svg.appendChild(frag);
    var draw = function () {
      if (drawn) return; drawn = true;
      requestAnimationFrame(function () { svg.classList.add('drawn'); });
      // Once drawn, the stagger goes, so pointing answers at once.
      setTimeout(function () { paths.forEach(function (p) { p.style.transition = ''; }); }, (maxDelay + 1.8) * 1000);
    };
    if (shown || still) draw(); else build.draw = draw;
  }

  function say(p) {
    var c = cells[+p.dataset.i];
    read.textContent = 'Cell ' + fmt(+p.dataset.i + 1) + ': ' + fmt(c[1]) + ' px², circularity ' + c[2].toFixed(2) +
      ', ' + c[3].toFixed(1) + ' times as long as it is wide' + (c[4] ? ', cut by the edge of the view.' : '.');
  }
  var on = null;
  function point(e) {
    var p = e.target.closest && e.target.closest('path');
    if (p === on) return;
    if (on) on.classList.remove('on');
    on = p; pointing = !!p;
    if (p) { p.classList.add('on'); say(p); }
  }
  svg.addEventListener('pointerover', point);
  svg.addEventListener('pointerdown', point);
  svg.addEventListener('pointerleave', function () { if (on) on.classList.remove('on'); on = null; pointing = false; });

  function twinkle() {
    if (still || !shown || !drawn || pointing || !paths.length || document.hidden) return;
    var p = paths[(Math.random() * paths.length) | 0];
    p.classList.add('lit'); setTimeout(function () { p.classList.remove('lit'); }, 1400);
  }

  var loaded = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !loaded) {
        loaded = true;
        fetch('media/plate.json').then(function (r) { return r.json(); }).then(build).catch(function () {});
      }
    });
  }, { rootMargin: '700px 0px' }).observe(fig);
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      shown = e.isIntersecting;
      if (shown && build.draw) { build.draw(); build.draw = null; }
      clearInterval(glint); if (shown && !still) glint = setInterval(twinkle, 900);
    });
  }, { threshold: 0.35 }).observe(fig);
})();

// The catalog's constellations: one star per entry, joined as an atlas joins a figure. Pointing at a name lights its star.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('.figure-col').forEach(function (col, k) {
    var svg = col.querySelector('.glyph'), items = [].slice.call(col.querySelectorAll('li'));
    if (!svg || !items.length) return;
    var seed = 7 + k * 131, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var n = items.length, W = 240, H = 120;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var pts = items.map(function (_, i) {
      return [18 + (i + 0.5) / n * (W - 36) + (rnd() - 0.5) * (W / n) * 0.5, 18 + rnd() * (H - 36), 1.9 + rnd() * 1.4];
    });
    var edges = pts.slice(1).map(function (_, i) { return [i, i + 1]; });
    if (n > 4) edges.push([1, n - 2]);
    edges.forEach(function (e) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', pts[e[0]][0]); l.setAttribute('y1', pts[e[0]][1]);
      l.setAttribute('x2', pts[e[1]][0]); l.setAttribute('y2', pts[e[1]][1]);
      svg.appendChild(l);
    });
    var stars = pts.map(function (p) {
      var h = document.createElementNS(NS, 'circle'); h.setAttribute('class', 'halo');
      h.setAttribute('cx', p[0]); h.setAttribute('cy', p[1]); h.setAttribute('r', p[2] * 3.2);
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', p[2]);
      svg.appendChild(h); svg.appendChild(c);
      return c;
    });
    items.forEach(function (li, i) {
      var light = function (v) {
        li.classList.toggle('on', v); stars[i].classList.toggle('on', v);
        stars[i].setAttribute('r', v ? pts[i][2] + 2 : pts[i][2]);
      };
      li.addEventListener('pointerenter', function () { light(true); });
      li.addEventListener('pointerleave', function () { light(false); });
    });
  });
})();

// Without WebGL 2 the sky can't be drawn, so the hero shows a still of it instead.
(function () {
  var sky = document.querySelector('.sky'), ok = false;
  try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
  if (sky && !ok) sky.classList.add('still-bg');
})();
