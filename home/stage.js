// The shared canvas for every home chapter: sizing, pointer state, drawing only while on screen, and the data.
export const DPR = Math.min(devicePixelRatio || 1, 2);
export const WARM = ['#f2c46d', '#ffad66', '#ffd98f', '#f59e6b', '#ffe3a3', '#f7b955', '#ffc27a'];
export const COOL = ['#7fb8ff', '#9ad0ff', '#8f9bff', '#6fe0ff', '#b3a6ff'];
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rgb = (r, g, b, a) => `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${a})`;
export function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
export function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
export function glow(ctx, x, y, r, col, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
export function fade(ctx, s, a) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(4,5,11,${a})`; ctx.fillRect(0, 0, s.W, s.H); }

// stage(section, { init(s, ctx), frame(s, ctx, dt) }) -> s
// s: W, H, mx, my (pointer, -9999 when away), down, clicks (this frame's presses), t (seconds), idle (since the pointer
// moved), visible (section on screen), still (reduced motion). init runs on start and on every resize; frame runs each
// animation frame only while the section is on screen. With reduced motion frame runs once after init (dt 0) and once
// after each pointer event. canvas.dataset.frames counts the frames drawn.
export function stage(section, { init, frame }) {
  const cv = section.querySelector('canvas.art'), ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const s = { W: 0, H: 0, mx: -9999, my: -9999, down: false, clicks: [], t: 0, idle: 99, visible: false, still: mq.matches };
  cv.dataset.frames = '0'; cv.dataset.pointer = '';
  let frames = 0, raf = 0, last = 0;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const draw = (dt) => {
    if (!s.W) return;
    s.t += dt; s.idle += dt;
    frame(s, ctx, dt);
    s.clicks.length = 0;
    cv.dataset.frames = String(++frames);
  };
  const once = () => { if (s.still && s.W) draw(0); };
  function size() {
    s.W = cv.clientWidth; s.H = cv.clientHeight;
    if (!s.W || !s.H) { s.W = 0; return; }
    cv.width = Math.round(s.W * dpr); cv.height = Math.round(s.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init(s, ctx); ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, s.W, s.H);
    once();
  }
  function loop(now) {
    raf = 0;
    if (!s.visible || s.still) return;
    draw(Math.min(0.05, (now - last) / 1000)); last = now;
    raf = requestAnimationFrame(loop);
  }
  function run() { if (s.visible && !s.still && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  // A tap holds its point like a hover, though touch fires pointerleave right after pointerup: it clears on the next tap or when the section leaves the screen.
  const point = (x, y) => { s.mx = x; s.my = y; cv.dataset.pointer = x < -999 ? '' : `${Math.round(x)},${Math.round(y)}`; };
  section.addEventListener('pointermove', (e) => { point(...at(e)); s.idle = 0; once(); });
  section.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') point(-9999, -9999); s.down = false; });
  section.addEventListener('pointerdown', (e) => { point(...at(e)); s.down = true; s.idle = 0; s.clicks.push({ x: s.mx, y: s.my }); once(); });
  addEventListener('pointerup', () => { s.down = false; });
  new IntersectionObserver((es) => { s.visible = es[es.length - 1].isIntersecting; if (!s.visible) point(-9999, -9999); run(); }).observe(section);
  mq.addEventListener('change', () => { s.still = mq.matches; if (s.still) once(); else run(); });
  new ResizeObserver(size).observe(cv);
  return s;
}

// Mark a chapter as having no art: its still shows instead. Not an error.
export function artFailed(section) { section.classList.add('no-art'); }

// Cells in disc units (1 = the eyepiece radius, y up): x in about [-1.55, 1.42], y in [-0.69, 0.98].
export const loadSky = () => fetch('media/sky.json').then((r) => { if (!r.ok) throw new Error(`sky.json ${r.status}`); return r.json(); }).then((sky) => ({
  cells: sky.stars.map(([x, y, m, r, g, b]) => ({ x, y, m, r, g, b })),
  dust: sky.dust.map(([x, y, r, g, b]) => ({ x, y, r, g, b, m: 0.1 })),
}));

// Measurements of the same cells, in the same order: [path, areaPx, circularity, elongation, edgeCut, ring].
export const loadPlate = () => fetch('media/plate.json').then((r) => { if (!r.ok) throw new Error(`plate.json ${r.status}`); return r.json(); }).then((p) => (
  p.cells.map(([, area, round, elong, edge]) => ({ area, round, elong, edge }))
));
