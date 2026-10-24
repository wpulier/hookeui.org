// The shared frame for every home chapter: canvas sizing, pointer state, drawing only while on screen, and the data.
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// stage(section, { init(s), frame(s, dt), visibility(visible) }) -> s
// s: canvas, W, H, dpr, phone (the stacked phone layout: words over the top of the art), top (where the art's free area
// starts below the words, in canvas pixels; 0 when not a phone), mx, my (pointer in canvas pixels, -9999 when away), down, dragX (horizontal drag this frame),
// clicks (this frame's taps, {x, y}), t (seconds), idle (since the pointer moved), visible, still (reduced motion).
// init runs on start and on every resize; frame runs each animation frame only while the section is on screen;
// visibility, if given, hears the section arrive and leave (to free and restore GPU memory). With reduced motion frame
// runs once after init (dt 0) and once after each pointer event. canvas.dataset.frames counts frames.
export function stage(section, { init, frame, visibility }) {
  const cv = section.querySelector('canvas.art');
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const phoneQ = matchMedia('(max-width: 760px) and (orientation: portrait), (max-width: 520px)');
  const s = { canvas: cv, W: 0, H: 0, dpr: 1, phone: false, top: 0, mx: -9999, my: -9999, down: false, dragX: 0, clicks: [], t: 0, idle: 99, visible: false, still: mq.matches };
  cv.dataset.frames = '0'; cv.dataset.pointer = '';
  let frames = 0, raf = 0, last = 0, press = null;
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
    s.phone = phoneQ.matches;
    const words = section.querySelector('.words');
    s.top = s.phone && words ? Math.max(0, words.getBoundingClientRect().bottom - cv.getBoundingClientRect().top) : 0;
    init(s);
    once();
  }
  function loop(now) {
    raf = 0;
    if (!s.visible || s.still) return;
    draw(Math.min(0.05, Math.max(0, (now - last) / 1000))); last = now;
    raf = requestAnimationFrame(loop);
  }
  function run() { if (s.visible && !s.still && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  // A mouse points as it moves. A finger points only where it taps: a press that moves (a sideways drag, or a scroll the
  // browser takes over and cancels) never becomes a point or a tap. A tapped point holds like a hover until the next tap
  // or the section leaves the screen.
  const point = (x, y) => { s.mx = x; s.my = y; cv.dataset.pointer = x < -999 ? '' : `${Math.round(x)},${Math.round(y)}`; };
  section.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    if (press) { s.dragX += x - press.x; press.x = x; if (Math.abs(x - press.x0) > 8 || Math.abs(y - press.y0) > 8) press.moved = true; }
    if (e.pointerType !== 'touch') { point(x, y); s.idle = 0; once(); }
  });
  section.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') point(-9999, -9999); });
  section.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e);
    press = { x, x0: x, y0: y, moved: false, touch: e.pointerType === 'touch' }; s.down = true; s.idle = 0;
    if (!press.touch) { point(x, y); once(); }
  });
  section.addEventListener('pointercancel', () => { press = null; s.down = false; });
  addEventListener('pointerup', () => {
    if (press && !press.moved) { if (press.touch) point(press.x0, press.y0); s.clicks.push({ x: press.x0, y: press.y0 }); once(); }
    press = null; s.down = false;
  });
  new IntersectionObserver((es) => {
    const v = es[es.length - 1].isIntersecting;
    if (v !== s.visible && visibility) visibility(v);
    s.visible = v; if (!v) point(-9999, -9999); run();
  }).observe(section);
  mq.addEventListener('change', () => { s.still = mq.matches; if (s.still) once(); else run(); });
  new ResizeObserver(size).observe(cv);
  return s;
}

// Mark a chapter as having no art: its still shows instead. Not an error.
export function artFailed(section) { section.classList.add('no-art'); }

// Load the cells, then build the chapter; anything that goes wrong on the way (no data, no WebGL context, a browser
// without some API) shows the chapter's still instead of a blank or broken canvas.
export function startArt(section, supported, build) {
  if (!supported) return artFailed(section);
  loadSky().then((sky) => { try { build(sky); } catch (e) { console.warn(section.id, e); artFailed(section); } }, () => artFailed(section));
}

// Cells in disc units (1 = the eyepiece radius, y up): x in about [-1.55, 1.42], y in [-0.69, 0.98].
export const loadSky = () => fetch('media/sky.json').then((r) => { if (!r.ok) throw new Error(`sky.json ${r.status}`); return r.json(); }).then((sky) => ({
  cells: sky.stars.map(([x, y, m, r, g, b]) => ({ x, y, m, r, g, b })),
  dust: sky.dust.map(([x, y, r, g, b]) => ({ x, y, r, g, b, m: 0.1 })),
}));
