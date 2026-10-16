// The hero's sky. Every star is a cell that Cellpose-SAM outlined in a real stained plant stem (media/sky.json, made from
// the app's own saved result), coloured by the stain around it. Constellations join a few cells at a time and carry the
// names of entries in Hooke's catalog. Units: 1 = the eyepiece disc's radius, y up.
import * as THREE from 'three';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';

const hero = document.querySelector('.sky');
const stage = hero && hero.querySelector('.sky-stage');
const canvas = stage && stage.querySelector('canvas');
const labelList = stage && stage.querySelector('.sky-labels');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOV = 30;
const FRAME = { cx: -0.068, cy: 0.143, w: 2.972, h: 1.671 }; // the camera frame the cells were found in, in disc units

function webgl() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

if (canvas && webgl()) start().catch((e) => console.warn('sky:', e));

async function start() {
  const sky = await (await fetch('media/sky.json')).json();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x04050b, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const world = new THREE.Group();
  scene.add(world);
  const u = { time: { value: 0 }, intro: { value: still ? 99 : 0 }, px: { value: 400 } };

  scene.add(backdrop());
  world.add(nebula(await texture('media/sky-bg.jpg'), u));
  world.add(rim());
  const dust = points(sky.dust.map(([x, y, r, g, b], i) => ({ x, y, z: -0.55 + hash(i * 3.1) * 0.5, size: 0.007 + hash(i) * 0.008, r, g, b, glow: 0.16, con: -1, reveal: 0.2 + hash(i * 1.7) * 2.6 })), u, false);
  world.add(dust.mesh);
  const memberOf = new Map();
  sky.constellations.forEach((c, k) => c.stars.forEach((s) => memberOf.set(s, k)));
  const stars = points(sky.stars.map(([x, y, m, r, g, b], i) => ({ x, y, z: memberOf.has(i) ? 0 : -0.2 + hash(i * 5.3) * 0.4, size: 0.014 + m * 0.032, r, g, b, glow: 0.2 + Math.pow(m, 1.6) * 0.75, con: memberOf.has(i) ? memberOf.get(i) : -1, reveal: 0.4 + (1 - m) * 2.2 + hash(i) * 0.6 })), u, true);
  stars.mesh.renderOrder = 1;
  world.add(stars.mesh);
  const figures = sky.constellations.map((c, k) => figure(c, k, sky.stars, u));
  figures.forEach((f) => world.add(f.group));
  const you = observer(u);
  scene.add(you.group);
  const comets = cometField(u);
  scene.add(comets.mesh);
  const labels = figures.map((f) => label(f));
  labels.push(label(you, true));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.72, 0.55, 0.2);
  composer.addPass(bloom);
  const finish = new ShaderPass(FINISH);
  composer.addPass(finish);

  // Layout: on a wide hero the disc sits right of the copy; on a phone the stage is its own block and the disc fills it.
  let view = { w: 1, h: 1, wide: true, dist: 3, cx: 0, cy: 0.14 };
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const wide = w >= 1000;
    const dpr = Math.min(devicePixelRatio || 1, wide ? 2 : 1.75);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    finish.uniforms.res.value.set(w * dpr, h * dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfH = wide ? 0.8 : Math.min(0.86, Math.max(0.6, 0.7 / camera.aspect));
    const dist = halfH / t;
    const halfW = halfH * camera.aspect;
    // The disc's centre sits about 62% across a wide hero, and in the middle of a phone's stage.
    view = { w, h, wide, dist, cx: wide ? -halfW * 0.25 : 0.06, cy: wide ? 0.13 : 0.16 };
    u.px.value = (h * dpr) / (2 * halfH) * (wide ? 1 : 1.15);
    you.group.position.set(wide ? 0.16 : 0.08, wide ? -0.2 : -0.24, 0.08);
    you.group.scale.setScalar(wide ? 1 : 0.92);
    you.group.updateMatrixWorld();
    if (!still) render(performance.now());
  }

  // Which figures are drawn: a few at a time, one retiring and another drawing elsewhere every few seconds.
  const active = [];
  let clock = Number(new URLSearchParams(location.search).get('skyt')) || 0, nextSwap = 0, hovered = -1; // ?skyt= starts later, for checking
  function eligible(f) {
    const p = project(f.anchor);
    if (!p) return false;
    const minX = view.wide ? 0.47 : 0.06;
    const o = project(you.middle, you.group);
    if (o && Math.hypot(p.x - o.x, p.y - o.y) < Math.max(170, view.h * 0.27)) return false;
    return p.x > view.w * minX && p.x < view.w * 0.95 && p.y > view.h * 0.1 && p.y < view.h * 0.86;
  }
  function begin(f, at) { f.state = 'draw'; f.t0 = at; active.push(f); }
  function retire(f, at) { f.state = 'fade'; f.t0 = at; }
  function choose(at) {
    const free = figures.filter((f) => !f.state && eligible(f) && !active.some((a) => a.anchor.distanceTo(f.anchor) < 0.42));
    if (!free.length) return null;
    const f = free[Math.floor(hash(at * 13.7) * free.length) % free.length];
    begin(f, at);
    return f;
  }
  function schedule(t) {
    const want = view.wide ? 4 : 3;
    if (still) {
      if (!active.length) for (const f of figures) { if (active.length < want && eligible(f)) { begin(f, -99); } }
      return;
    }
    if (t > 3.4 && active.filter((f) => f.state !== 'fade').length < want && t > nextSwap) { choose(t); nextSwap = t + (t < 8 ? 0.9 : 1.2); }
    if (t > 11 && hovered < 0 && t > nextSwap) {
      const oldest = active.find((f) => f.state === 'draw' || f.state === 'on');
      if (oldest) retire(oldest, t);
      nextSwap = t + 5.5;
    }
  }
  function animateFigures(t) {
    for (let i = active.length - 1; i >= 0; i--) {
      const f = active[i];
      const age = t - f.t0;
      let line = 0, cells = 0, text = 0;
      if (f.state === 'draw' || f.state === 'on') {
        line = ease(clamp(age / 2.6)); cells = ease(clamp((age - 1.6) / 1.6)); text = ease(clamp((age - 1.2) / 1.2));
        if (age > 3.2) f.state = 'on';
      } else if (f.state === 'fade') {
        const k = 1 - ease(clamp(age / 2.2)); line = k; cells = k; text = k;
        if (age > 2.3) { f.state = null; active.splice(i, 1); }
      }
      const lit = f.index === hovered ? 1 : 0; // (-2 is "You")
      f.lit += (lit - f.lit) * 0.12;
      f.lines.uniforms.progress.value = still ? 1 : line;
      f.lines.uniforms.alpha.value = (still ? 1 : Math.min(1, line * 1.4)) * (0.7 + f.lit * 0.3);
      f.cells.uniforms.alpha.value = (still ? 1 : cells) * (0.22 + f.lit * 0.5);
      f.text = still ? 1 : text;
      stars.glow[f.index] = (still ? 1 : Math.max(line, cells)) * (0.6 + f.lit * 0.35);
    }
    for (const f of figures) if (!active.includes(f)) { f.text = 0; stars.glow[f.index] = 0; f.lines.uniforms.alpha.value = 0; f.cells.uniforms.alpha.value = 0; }
  }

  // The camera: a slow pull back as the sky comes out, then a breath, the pointer and the sky turning.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (matchMedia('(pointer: fine)').matches && !still) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) / r.width - 0.5; pointer.ty = (e.clientY - r.top) / r.height - 0.5;
    });
  }
  function placeCamera(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
    const pull = still ? 1 : ease(clamp(t / 7));
    const d = view.dist * (0.8 + 0.2 * pull);
    const bx = still ? 0 : Math.sin(t * 0.11) * 0.012, by = still ? 0 : Math.cos(t * 0.09) * 0.01;
    camera.position.set(view.cx + bx + pointer.x * 0.05, view.cy + by - pointer.y * 0.04, d);
    camera.lookAt(view.cx + pointer.x * 0.02, view.cy, 0);
    world.rotation.z = still ? 0 : t * 0.0016;
    world.updateMatrixWorld();
  }

  const v3 = new THREE.Vector3();
  function project(p, space = world) {
    v3.copy(p).applyMatrix4(space.matrixWorld).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x * 0.5 + 0.5) * view.w, y: (-v3.y * 0.5 + 0.5) * view.h };
  }
  function placeLabels() {
    for (const l of labels) {
      const f = l.figure;
      if (f.text < 0.01) { if (l.shown) { l.el.style.opacity = '0'; l.el.style.visibility = 'hidden'; l.shown = false; } continue; }
      const p = project(f.anchor, f.space || world);
      if (!p) continue;
      l.el.style.visibility = 'visible'; l.shown = true;
      l.el.style.opacity = String(f.text);
      l.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  let raf = 0, visible = true, last = performance.now();
  function render(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!still) clock += dt;
    const t = still ? 99 : clock;
    u.time.value = t; u.intro.value = t;
    finish.uniforms.time.value = t;
    placeCamera(t); schedule(t); animateFigures(t);
    you.update(t, still, hovered === -2);
    comets.update(t, still, active, world, you);
    stars.mesh.material.uniforms.glow.value = stars.glow;
    composer.render();
    placeLabels();
  }
  function loop(now) { raf = 0; if (!visible || document.hidden) return; render(now); raf = requestAnimationFrame(loop); }
  function wake() { if (!raf && visible && !document.hidden && !still) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  new ResizeObserver(() => { layout(); if (still) render(performance.now()); }).observe(stage);

  function label(f, isYou) {
    const li = document.createElement('li');
    li.className = isYou ? 'sky-label you' : 'sky-label';
    li.innerHTML = `<button type="button"><span class="sky-name"></span><span class="sky-what"></span></button>`;
    li.querySelector('.sky-name').textContent = f.name;
    li.querySelector('.sky-what').textContent = `${f.what}. ${f.where}.`;
    const b = li.querySelector('button');
    const on = () => { hovered = isYou ? -2 : f.index; li.classList.add('open'); if (still) render(performance.now()); };
    const off = () => { if (hovered === (isYou ? -2 : f.index)) hovered = -1; li.classList.remove('open'); if (still) render(performance.now()); };
    b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off);
    b.addEventListener('focus', on); b.addEventListener('blur', off);
    li.style.opacity = '0'; li.style.visibility = 'hidden';
    labelList.appendChild(li);
    return { el: li, figure: f, shown: false };
  }

  layout();
  if (still) render(performance.now());
  stage.classList.add('live');
  hero.classList.add('sky-live');
  wake();
}

// Points: one draw for every star (or every grain of dust). Each has its own twinkle, and comes out in its own time.
function points(list, u, spikes) {
  const n = list.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n), glowA = new Float32Array(n), con = new Float32Array(n), reveal = new Float32Array(n);
  list.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3); col.set([p.r, p.g, p.b], i * 3);
    size[i] = p.size; phase[i] = hash(i * 9.7 + p.x); glowA[i] = p.glow; con[i] = p.con; reveal[i] = p.reveal;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glowA, 1));
  g.setAttribute('aCon', new THREE.BufferAttribute(con, 1));
  g.setAttribute('aReveal', new THREE.BufferAttribute(reveal, 1));
  const glow = new Array(16).fill(0);
  const m = new THREE.ShaderMaterial({
    uniforms: { time: u.time, intro: u.intro, px: u.px, glow: { value: glow }, spikes: { value: spikes ? 1 : 0 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize, aPhase, aGlow, aCon, aReveal;
      uniform float time, intro, px, glow[16];
      varying vec3 vColor; varying float vI, vBig;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float fade = smoothstep(-0.69, -0.5, position.y) * smoothstep(0.99, 0.86, position.y) * smoothstep(1.0, 0.9, length(position.xy));
        float come = smoothstep(aReveal, aReveal + 1.2, intro);
        float tw = 0.78 + 0.22 * sin(time * (0.5 + aPhase * 1.3) + aPhase * 40.0);
        float lit = aCon >= 0.0 ? glow[int(aCon)] : 0.0;
        vI = aGlow * tw * fade * come * (1.0 + lit * 1.6);
        vColor = mix(aColor, vec3(1.0, 0.95, 0.86), 0.06 + lit * 0.3);
        vBig = clamp((aSize - 0.034) / 0.012, 0.0, 1.0) * 0.6 + lit * 0.45;
        gl_PointSize = aSize * (1.0 + lit * 0.25) * px * (3.0 / -mv.z) * 1.35;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float spikes;
      varying vec3 vColor; varying float vI, vBig;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float core = exp(-r * r * 70.0);
        float halo = exp(-r * 7.0) * 0.42;
        float ray = spikes * vBig * (exp(-abs(d.x) * 90.0) * exp(-abs(d.y) * 7.0) + exp(-abs(d.y) * 90.0) * exp(-abs(d.x) * 7.0)) * 0.7;
        vec3 c = vColor * (halo + ray) + mix(vColor, vec3(1.0, 0.98, 0.95), 0.55) * core;
        gl_FragColor = vec4(c * vI * (1.0 - smoothstep(0.85, 1.0, r)), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return { mesh: new THREE.Points(g, m), glow };
}

// A figure: its stars joined as a star atlas joins them (the tree the build script made), drawn like a pen spreading
// from its brightest star, then the cells' own outlines, faint, around them.
function figure(c, index, starList, u) {
  const P = c.stars.map((s) => new THREE.Vector3(starList[s][0], starList[s][1], 0));
  const adj = P.map(() => []);
  c.edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const depth = P.map(() => -1); depth[0] = 0;
  const order = [];
  const queue = [0];
  while (queue.length) { const a = queue.shift(); for (const b of adj[a]) if (depth[b] < 0) { depth[b] = depth[a] + 1; order.push([a, b]); queue.push(b); } }
  const maxD = Math.max(1, ...depth);
  const pos = [], tt = [];
  for (const [a, b] of order) {
    const pa = P[a], pb = P[b];
    pos.push(pa.x, pa.y, 0, pb.x, pb.y, 0);
    tt.push(depth[a] / maxD, depth[b] / maxD);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  const lines = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, alpha: { value: 0 }, time: u.time },
    vertexShader: `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float progress, alpha, time; varying float vT;
      void main() { if (vT > progress + 0.001) discard; gl_FragColor = vec4(vec3(0.95, 0.9, 0.82) * alpha * 0.85, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cpos = [], ccol = [];
  c.outlines.forEach((flat, i) => {
    const s = starList[c.stars[i]];
    for (let k = 0; k < flat.length; k += 2) {
      const k2 = (k + 2) % flat.length;
      cpos.push(flat[k], flat[k + 1], 0, flat[k2], flat[k2 + 1], 0);
      ccol.push(s[3], s[4], s[5], s[3], s[4], s[5]);
    }
  });
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
  cg.setAttribute('color', new THREE.Float32BufferAttribute(ccol, 3));
  const cells = new THREE.ShaderMaterial({
    uniforms: { alpha: { value: 0 } },
    vertexShader: `attribute vec3 color; varying vec3 vC; void main() { vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float alpha; varying vec3 vC; void main() { gl_FragColor = vec4(vC * alpha, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Group();
  group.add(new THREE.LineSegments(lg, lines), new THREE.LineSegments(cg, cells));
  const anchor = new THREE.Vector3(c.label[0], c.label[1], 0);
  const centre = P.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / P.length);
  const colour = c.stars.reduce((a, s) => a.add(new THREE.Color(starList[s][3], starList[s][4], starList[s][5])), new THREE.Color(0, 0, 0)).multiplyScalar(1 / c.stars.length);
  return { centre, colour, index, name: c.name, what: c.what, where: c.where, group, lines, cells, anchor, state: null, t0: 0, lit: 0, text: 0 };
}

// "You": a researcher at their microscope, as a constellation of its own in warm gold. A pen of stardust traces the
// figure as the sky comes out; stars sit at its joints, and the brightest is where the eye meets the eyepiece.
const YOU = {
  strokes: [
    // head, from the eye over the crown, the bun, down the nape and the length of the back to the stool
    'M400 160 C399 148 392 134 378 129 C366 125 354 130 349 140 C344 150 346 164 350 176 C336 188 316 206 306 228 C296 252 294 290 300 318',
    'M343 133 C335 126 324 132 328 141 C331 148 341 147 345 140',
    // the face, close to the eyepiece, the throat, the chest and the lap
    'M400 160 L408 168 L402 172 C404 176 402 180 398 182 C397 186 392 189 385 190 C379 196 378 206 377 216 C375 240 366 270 356 304',
    // the arm reaching for the focus knob
    'M354 208 C356 230 360 248 364 262 C392 258 424 250 448 241 C453 239 457 236 459 232',
    // the legs and the stool
    'M302 318 C330 316 362 315 388 316 C389 340 384 362 380 384 L402 388',
    'M268 322 L328 322 M296 322 L296 380 M276 392 L296 380 L318 392',
    // the microscope: eyepiece to the eye, its body, the arm, the knob, the stage, the objective and the foot
    'M414 151 L484 179 M410 160 L480 188 M411 148 L406 161',
    'M482 172 L502 178 L496 200 L476 194 Z',
    'M490 198 L486 222 M480 196 L476 220 M474 222 L492 224',
    'M500 184 C530 196 542 244 522 282 M508 192 C530 206 534 244 516 280',
    'M532 236 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0',
    'M446 240 L524 240 M452 244 L518 244',
    'M494 262 m-9 0 a9 4 0 1 0 18 0 a9 4 0 1 0 -18 0',
    'M444 286 C450 274 516 272 532 286',
    // the bench
    'M362 288 L566 288',
  ],
  joints: [[378, 129, 0.45], [343, 136, 0.3], [350, 176, 0.5], [306, 228, 0.35], [364, 262, 0.55], [459, 232, 0.6], [300, 318, 0.5], [388, 316, 0.55], [380, 384, 0.45], [296, 380, 0.3], [492, 178, 0.55], [522, 282, 0.45], [446, 240, 0.4], [532, 236, 0.4], [484, 223, 0.35]],
  eye: [409, 156],
  middle: [417, 258], k: 0.0016,
};
function observer(u) {
  const toLocal = (x, y) => new THREE.Vector3((x - YOU.middle[0]) * YOU.k, -(y - YOU.middle[1]) * YOU.k, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  document.body.appendChild(svg);
  const polys = [];
  let total = 0;
  for (const d of YOU.strokes) {
    for (const part of d.split(/(?=M)/)) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', part); svg.appendChild(path);
      const len = path.getTotalLength(), n = Math.max(2, Math.ceil(len / 1.5));
      const pts = [];
      for (let i = 0; i <= n; i++) { const q = path.getPointAtLength((i / n) * len); pts.push(q.x, q.y); }
      polys.push({ pts, start: total, len }); total += len;
    }
  }
  svg.remove();
  const pos = [], tt = [], dpos = [], dt = [], dj = [];
  for (const { pts, start, len } of polys) {
    const n = pts.length / 2 - 1;
    for (let i = 0; i < n; i++) {
      const a = toLocal(pts[i * 2], pts[i * 2 + 1]), b = toLocal(pts[i * 2 + 2], pts[i * 2 + 3]);
      pos.push(a.x, a.y, 0, b.x, b.y, 0);
      tt.push((start + (i / n) * len) / total, (start + ((i + 1) / n) * len) / total);
      if (i % 3 === 0) for (let k = 0; k < 1; k++) {
        const j = (hash(dpos.length * 1.37) - 0.5) * 0.006, j2 = (hash(dpos.length * 2.11) - 0.5) * 0.006;
        dpos.push(a.x + j, a.y + j2, (hash(dpos.length) - 0.5) * 0.04); dt.push((start + (i / n) * len) / total); dj.push(hash(dpos.length * 0.7));
      }
    }
  }
  const gold = new THREE.Color(1.0, 0.8, 0.5);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  const lineM = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, alpha: { value: 0 }, gold: { value: gold } },
    vertexShader: `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float progress, alpha; uniform vec3 gold; varying float vT;
      void main() { if (vT > progress) discard; float tip = exp(-(progress - vT) * 40.0) * step(progress, 0.999);
        gl_FragColor = vec4(gold * alpha * (0.42 + tip * 2.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  dg.setAttribute('aT', new THREE.Float32BufferAttribute(dt, 1));
  dg.setAttribute('aJ', new THREE.Float32BufferAttribute(dj, 1));
  const dustM = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, alpha: { value: 0 }, time: u.time, px: u.px, gold: { value: gold } },
    vertexShader: `attribute float aT, aJ; uniform float progress, time, px; varying float vI;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float drawn = step(aT, progress); float tip = exp(-max(0.0, progress - aT) * 30.0) * step(progress, 0.999);
        vI = drawn * (0.16 + 0.16 * sin(time * (0.8 + aJ * 2.0) + aJ * 30.0) + tip * 2.2);
        gl_PointSize = (0.005 + aJ * 0.005 + tip * 0.012) * px * (3.0 / -mv.z) * 1.4; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float alpha; uniform vec3 gold; varying float vI;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(gold * vI * alpha * exp(-r * r * 5.0), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  // Joint stars, each lit when the pen reaches it; the eye's is the brightest and flares when a report arrives.
  const jp = [], js = [], jt = [];
  const nearestT = (x, y) => {
    let best = 1e9, bt = 0;
    for (const { pts, start, len } of polys) { const n = pts.length / 2 - 1; for (let i = 0; i <= n; i++) { const d = Math.hypot(pts[i * 2] - x, pts[i * 2 + 1] - y); if (d < best) { best = d; bt = (start + (i / n) * len) / total; } } }
    return bt;
  };
  for (const [x, y, m] of YOU.joints) { const v = toLocal(x, y); jp.push(v.x, v.y, 0.01); js.push(m); jt.push(nearestT(x, y)); }
  const eye = toLocal(...YOU.eye);
  jp.push(eye.x, eye.y, 0.02); js.push(1.25); jt.push(nearestT(...YOU.eye));
  const jg = new THREE.BufferGeometry();
  jg.setAttribute('position', new THREE.Float32BufferAttribute(jp, 3));
  jg.setAttribute('aM', new THREE.Float32BufferAttribute(js, 1));
  jg.setAttribute('aT', new THREE.Float32BufferAttribute(jt, 1));
  const jointM = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, alpha: { value: 0 }, time: u.time, px: u.px, flash: { value: 0 }, gold: { value: gold } },
    vertexShader: `attribute float aM, aT; uniform float progress, time, px, flash; varying float vI, vM;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float on = smoothstep(aT, aT + 0.04, progress); float isEye = step(1.0, aM);
        vM = aM; vI = on * (0.8 + 0.2 * sin(time * 0.9 + aM * 17.0)) * (1.0 + isEye * flash * 1.6);
        gl_PointSize = (0.022 + aM * 0.03) * (1.0 + isEye * flash * 0.5) * px * (3.0 / -mv.z) * 1.4; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float alpha; uniform vec3 gold; varying float vI, vM;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
        float core = exp(-r * r * 80.0), halo = exp(-r * 7.0) * 0.5;
        float ray = (exp(-abs(d.x) * 90.0) * exp(-abs(d.y) * 6.0) + exp(-abs(d.y) * 90.0) * exp(-abs(d.x) * 6.0)) * (0.3 + vM * 0.5);
        vec3 c = gold * (halo + ray) + vec3(1.0, 0.95, 0.85) * core;
        gl_FragColor = vec4(c * vI * alpha * (1.0 - smoothstep(0.85, 1.0, r)), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  // A clearing in the sky behind the figure, so it reads.
  const clearing = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.72), new THREE.ShaderMaterial({
    uniforms: { alpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float alpha; varying vec2 vUv; void main() { float d = length((vUv - 0.5) * vec2(1.0, 0.86)) * 2.0;
      gl_FragColor = vec4(0.016, 0.02, 0.045, alpha * 0.6 * (1.0 - smoothstep(0.25, 1.0, d))); }`,
    transparent: true, depthWrite: false,
  }));
  clearing.position.set(0.0, -0.02, -0.02);
  const group = new THREE.Group();
  const lines = new THREE.LineSegments(lg, lineM), dust = new THREE.Points(dg, dustM), joints = new THREE.Points(jg, jointM);
  clearing.renderOrder = 2; lines.renderOrder = 3; dust.renderOrder = 3; joints.renderOrder = 4;
  group.add(clearing, lines, dust, joints);
  let lit = 0;
  return {
    group, eye, name: 'You', what: 'Deciding what the experiment needs', where: 'At the microscope',
    anchor: toLocal(417, 414), middle: toLocal(417, 258), space: group, text: 0,
    flash(v) { jointM.uniforms.flash.value = Math.max(jointM.uniforms.flash.value, v); },
    update(t, still, hover) {
      const pen = still ? 1 : clamp((t - 0.9) / 4.2);
      const p = still ? 1 : 1 - Math.pow(1 - pen, 2.2);
      lit += ((hover ? 1 : 0) - lit) * 0.1;
      const a = (still ? 1 : clamp((t - 0.7) / 0.6)) * (1 + lit * 0.35);
      for (const m of [lineM, dustM, jointM]) { m.uniforms.progress.value = p; m.uniforms.alpha.value = a; }
      clearing.material.uniforms.alpha.value = still ? 1 : clamp((t - 0.6) / 2);
      jointM.uniforms.flash.value *= 0.94;
      this.text = still ? 1 : ease(clamp((t - 4.4) / 1.2));
    },
  };
}

// Reports coming back: now and then a light leaves one of the models' constellations and travels, in an arc, to the eye
// of "You". Its tail fades; it arrives as gold.
function cometField(u) {
  const CAP = 3, TAIL = 34, n = CAP * TAIL;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), a = new Float32Array(n), sz = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
  g.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { px: u.px },
    vertexShader: `attribute vec3 aColor; attribute float aA, aS; uniform float px; varying vec3 vC; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = aColor; vA = aA;
        gl_PointSize = aS * px * (3.0 / -mv.z) * 1.4; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main() { float r = length(gl_PointCoord - 0.5) * 2.0;
      gl_FragColor = vec4(vC * vA * (exp(-r * r * 9.0) + exp(-r * 4.0) * 0.25), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Points(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  const live = [];
  let next = 9;
  const gold = new THREE.Color(1.0, 0.82, 0.55), from = new THREE.Vector3(), to = new THREE.Vector3(), c1 = new THREE.Vector3(), q = new THREE.Vector3(), tint = new THREE.Color();
  return {
    mesh,
    update(t, still, active, world, you) {
      a.fill(0);
      if (still) { g.attributes.aA.needsUpdate = true; return; }
      if (t > next && live.length < CAP) {
        const on = active.filter((f) => f.state === 'on');
        if (on.length) {
          const f = on[Math.floor(hash(t * 7.3) * on.length) % on.length];
          live.push({ f, t0: t, dur: 2.8 + hash(t) * 0.8, bend: (hash(t * 3.1) - 0.5) * 0.5 });
        }
        next = t + 3.2 + hash(t * 1.9) * 2.6;
      }
      for (let k = live.length - 1; k >= 0; k--) {
        const c = live[k], prog = (t - c.t0) / c.dur;
        if (prog > 1.25) { live.splice(k, 1); continue; }
        from.copy(c.f.centre).applyMatrix4(world.matrixWorld);
        to.copy(you.eye).applyMatrix4(you.group.matrixWorld);
        c1.copy(from).lerp(to, 0.5); c1.x += (to.y - from.y) * c.bend; c1.y -= (to.x - from.x) * c.bend; c1.z += 0.15;
        if (prog >= 1 && !c.done) { c.done = true; you.flash(1); }
        for (let j = 0; j < TAIL; j++) {
          const s = ease(clamp(prog - j * 0.011)), i = k * TAIL + j;
          if (prog - j * 0.011 <= 0 || (prog - j * 0.011) >= 1) continue;
          const w = 1 - s;
          q.set(w * w * from.x + 2 * w * s * c1.x + s * s * to.x, w * w * from.y + 2 * w * s * c1.y + s * s * to.y, w * w * from.z + 2 * w * s * c1.z + s * s * to.z);
          pos.set([q.x, q.y, q.z], i * 3);
          tint.copy(c.f.colour).lerp(gold, s);
          col.set([tint.r, tint.g, tint.b], i * 3);
          a[i] = Math.pow(1 - j / TAIL, 2) * (j === 0 ? 1.4 : 0.8) * Math.min(1, prog * 6);
          sz[i] = (j === 0 ? 0.03 : 0.014) * (1 - j / TAIL * 0.6);
        }
      }
      g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.aS.needsUpdate = true;
    },
  };
}

// The specimen itself, very faint behind the stars: only where it is stained, so it reads as a nebula, not a photo.
function nebula(tex, u) {
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, intro: u.intro, time: u.time },
    vertexShader: `varying vec2 vUv; varying vec2 vP; void main() { vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float intro, time; varying vec2 vUv; varying vec2 vP;
      vec3 tap(vec2 o) { return texture2D(map, vUv + o).rgb; }
      void main() {
        vec2 s = vec2(1.0 / 640.0, 1.0 / 360.0) * 2.5;
        vec3 c = (tap(vec2(0)) * 2.0 + tap(vec2(s.x, 0)) + tap(vec2(-s.x, 0)) + tap(vec2(0, s.y)) + tap(vec2(0, -s.y))) / 6.0;
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
        vec2 cp = vP + vec2(${FRAME.cx.toFixed(3)}, ${FRAME.cy.toFixed(3)});
        float disc = smoothstep(1.0, 0.82, length(cp)) * smoothstep(-0.69, -0.45, cp.y) * smoothstep(0.99, 0.8, cp.y);
        float reveal = smoothstep(4.5, 7.0, intro) * (1.0 - 0.62 * smoothstep(7.5, 11.0, intro));
        float a = (0.11 + 0.2 * reveal) * pow(sat, 1.3) * disc;
        gl_FragColor = vec4(c * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FRAME.w, FRAME.h), m);
  mesh.position.set(FRAME.cx, FRAME.cy, -0.3);
  return mesh;
}

// The eyepiece's edge as a star chart's rim: a fine circle with ticks every two degrees, longer every ten.
function rim() {
  const pos = [];
  const seg = 360;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
    pos.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
  }
  for (let d = 0; d < 360; d += 2) {
    const a = THREE.MathUtils.degToRad(d), l = d % 10 === 0 ? 0.035 : 0.014;
    pos.push(Math.cos(a) * 1.006, Math.sin(a) * 1.006, 0, Math.cos(a) * (1.006 + l), Math.sin(a) * (1.006 + l), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vP; void main() { gl_FragColor = vec4(vec3(0.62, 0.66, 0.85) * 0.16, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.LineSegments(g, m);
}

// The night behind it all: deep blue, a little lighter around the disc.
function backdrop() {
  const m = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vP; void main() {
      float d = length(vP - vec2(0.0, 0.1));
      vec3 c = mix(vec3(0.045, 0.055, 0.12), vec3(0.016, 0.018, 0.04), smoothstep(0.2, 2.6, d));
      gl_FragColor = vec4(c, 1.0); }`,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), m);
  mesh.position.z = -2;
  mesh.renderOrder = -1;
  return mesh;
}

// Film grain and a vignette, last, on the whole picture.
const FINISH = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
      c.rgb *= mix(0.62, 1.0, smoothstep(1.25, 0.3, length(q)));
      float n = fract(sin(dot(floor(vUv * res) + fract(time * 7.0) * 113.0, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.028;
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
};

function texture(url) {
  return new Promise((ok, fail) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.NoColorSpace; ok(t); }, undefined, fail));
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function clamp(x) { return Math.max(0, Math.min(1, x)); }
function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
