// The shared frame for every home chapter: canvas sizing, pointer state, drawing only while on screen, and the data.
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// stage(section, { init(s), frame(s, dt) }) -> s
// s: canvas, W, H, dpr, mx, my (pointer in canvas pixels, -9999 when away), down, dragX (horizontal drag this frame),
// clicks (this frame's taps, {x, y}), t (seconds), idle (since the pointer moved), visible, still (reduced motion).
// init runs on start and on every resize; frame runs each animation frame only while the section is on screen. With
// reduced motion frame runs once after init (dt 0) and once after each pointer event. canvas.dataset.frames counts frames.
export function stage(section, { init, frame }) {
  const cv = section.querySelector('canvas.art');
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const s = { canvas: cv, W: 0, H: 0, dpr: 1, mx: -9999, my: -9999, down: false, dragX: 0, clicks: [], t: 0, idle: 99, visible: false, still: mq.matches };
  cv.dataset.frames = '0'; cv.dataset.pointer = '';
  let frames = 0, raf = 0, last = 0, downAt = null;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const draw = (dt) => {
    if (!s.W) return;
    s.t += dt; s.idle += dt;
    frame(s, dt);
    s.clicks.length = 0; s.dragX = 0;
    cv.dataset.frames = String(++frames);
  };
  const once = () => { if (s.still && s.W) draw(0); };
  function size() {
    s.W = cv.clientWidth; s.H = cv.clientHeight;
    if (!s.W || !s.H) { s.W = 0; return; }
    s.dpr = Math.min(devicePixelRatio || 1, s.W < 700 ? 1.75 : 2);
    init(s);
    once();
  }
  function loop(now) {
    raf = 0;
    if (!s.visible || s.still) return;
    draw(Math.min(0.05, (now - last) / 1000)); last = now;
    raf = requestAnimationFrame(loop);
  }
  function run() { if (s.visible && !s.still && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  // A tap holds its point like a hover, though touch fires pointerleave right after pointerup: it clears on the next tap
  // or when the section leaves the screen. A press that moves sideways is a drag, not a tap.
  const point = (x, y) => { s.mx = x; s.my = y; cv.dataset.pointer = x < -999 ? '' : `${Math.round(x)},${Math.round(y)}`; };
  section.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    if (s.down && downAt) { s.dragX += x - s.mx; if (Math.abs(x - downAt[0]) > 8) downAt.moved = true; }
    point(x, y); s.idle = 0; once();
  });
  section.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') point(-9999, -9999); s.down = false; });
  section.addEventListener('pointerdown', (e) => { point(...at(e)); s.down = true; s.idle = 0; downAt = [s.mx, s.my]; once(); });
  addEventListener('pointerup', () => {
    if (s.down && downAt && !downAt.moved) { s.clicks.push({ x: downAt[0], y: downAt[1] }); once(); }
    s.down = false; downAt = null;
  });
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
