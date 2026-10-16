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
  // Everything the sky needs, fetched at once (index.html preloads it too), so it is there as soon as the page is.
  const [sky, youData, bg] = await Promise.all([fetch('media/sky.json').then((r) => r.json()), fetch('media/you.json').then((r) => r.json()), texture('media/sky-bg.jpg')]);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x04050b, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const world = new THREE.Group();
  scene.add(world);
  const u = { time: { value: 0 }, intro: { value: still ? 99 : 0 }, px: { value: 400 } };

  scene.add(backdrop());
  world.add(nebula(bg, u));
  world.add(rim());
  const dust = points(sky.dust.map(([x, y, r, g, b], i) => ({ x, y, z: -0.55 + hash(i * 3.1) * 0.5, size: 0.007 + hash(i) * 0.008, r, g, b, glow: 0.16, con: -1, reveal: hash(i * 1.7) * 0.4 })), u, false);
  world.add(dust.mesh);
  const memberOf = new Map();
  sky.constellations.forEach((c, k) => c.stars.forEach((s) => memberOf.set(s, k)));
  const stars = points(sky.stars.map(([x, y, m, r, g, b], i) => ({ x, y, z: memberOf.has(i) ? 0 : -0.2 + hash(i * 5.3) * 0.4, size: 0.014 + m * 0.032, r, g, b, glow: 0.2 + Math.pow(m, 1.6) * 0.75, con: memberOf.has(i) ? memberOf.get(i) : -1, reveal: (1 - m) * 0.25 + hash(i) * 0.2 })), u, true);
  stars.mesh.renderOrder = 1;
  world.add(stars.mesh);
  const figures = sky.constellations.map((c, k) => figure(c, k, sky.stars, u));
  figures.forEach((f) => world.add(f.group));
  const you = observer(u, youData);
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
    you.group.position.set(wide ? 0.2 : 0.08, wide ? -0.14 : -0.12, 0.08);
    you.group.scale.setScalar(wide ? 0.9 : 0.85);
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
    // Nor may any of a figure's own stars fall on her.
    if (o && [...(f.starsXY || []), f.anchor].some((q) => { const r = project(q); return r && Math.abs(r.x - o.x) < view.h * 0.27 && Math.abs(r.y - o.y) < view.h * 0.33; })) return false;
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
    if (t > 0.1 && active.filter((f) => f.state !== 'fade').length < want && t > nextSwap) { choose(t); nextSwap = t + (t < 3 ? 0.2 : 1.2); }
    if (t > 8 && hovered < 0 && t > nextSwap) {
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
        const fast = f.t0 < 3 ? 0.5 : 1; // the first ones arrive at once; later ones take their time
        line = ease(clamp(age / (2.6 * fast))); cells = ease(clamp((age - 1.6 * fast) / (1.6 * fast))); text = ease(clamp((age - 0.9 * fast) / (1.0 * fast)));
        if (age > 3.2 * fast) f.state = 'on';
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
      pointer.cx = e.clientX; pointer.cy = e.clientY;
    });
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), herPlane = new THREE.Plane(), hit = new THREE.Vector3();
  let pointerIn = false;
  hero.addEventListener('pointerleave', () => { pointerIn = false; });
  hero.addEventListener('pointermove', () => { pointerIn = true; });
  function pointAtHer() {
    if (!pointerIn || still) { you.point(null); return; }
    const r = stage.getBoundingClientRect();
    ndc.set(((pointer.cx - r.left) / r.width) * 2 - 1, -((pointer.cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    herPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), you.group.getWorldPosition(hit));
    you.point(ray.ray.intersectPlane(herPlane, hit) ? hit : null);
  }
  function placeCamera(t) {
    pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
    const pull = still ? 1 : ease(clamp(t / 4));
    const d = view.dist * (0.95 + 0.05 * pull);
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
    pointAtHer();
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
        float come = smoothstep(aReveal, aReveal + 0.3, intro);
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
  return { starsXY: P, centre, colour, index, name: c.name, what: c.what, where: c.where, group, lines, cells, anchor, state: null, t0: 0, lit: 0, text: 0 };
}

// "You": a researcher at her microscope, made of stars, from a real photograph (media/you.json, tools/build_you.py):
// her outline, the photo's own edges and light as dust, and her own constellation of brighter stars at her landmarks.
// She is alive: the dust drifts on a curl-noise field around where it belongs, light ripples out from where her eye
// meets the eyepiece (the brightest star, which flares when a report arrives), a few motes lift off and are reborn,
// and the dust parts softly around the pointer.
const NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  // The curl of a noise field: a flow that swirls without gathering or scattering, like smoke in still air.
  vec2 curl(vec3 p) {
    float e = 0.1;
    float a = snoise(p + vec3(0.0, e, 0.0)), b = snoise(p - vec3(0.0, e, 0.0));
    float c = snoise(p + vec3(e, 0.0, 0.0)), d = snoise(p - vec3(e, 0.0, 0.0));
    return vec2(a - b, d - c) / (2.0 * e);
  }`;
function observer(u, data) {
  const P = data.points;
  const n = P.length + 1;
  const pos = new Float32Array(n * 3), kind = new Float32Array(n), bright = new Float32Array(n), when = new Float32Array(n), seed = new Float32Array(n);
  P.forEach(([x, y, k, b, t], i) => { pos.set([x, y, (hash(i * 0.37) - 0.5) * (k === 5 ? 0.01 : 0.06)], i * 3); kind[i] = k; bright[i] = b; when[i] = t; seed[i] = hash(i * 1.93); });
  const eye = new THREE.Vector3(data.eye[0], data.eye[1], 0.02);
  pos.set([eye.x, eye.y, eye.z], P.length * 3); kind[P.length] = 4; bright[P.length] = 1; when[P.length] = 0; seed[P.length] = 0.5;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  g.setAttribute('aB', new THREE.BufferAttribute(bright, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(when, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uni = {
    progress: { value: 0 }, alpha: { value: 0 }, time: u.time, px: u.px, flash: { value: 0 },
    eye: { value: new THREE.Vector2(eye.x, eye.y) }, ripple: { value: -10 }, pointer: { value: new THREE.Vector3(9, 9, 0) }, still: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: NOISE + `
      attribute float aKind, aB, aT, aSeed;
      uniform float progress, time, px, flash, ripple, still; uniform vec2 eye; uniform vec3 pointer;
      varying vec3 vC; varying float vI, vRay;
      void main() {
        vec3 p = position;
        float dust = step(aKind, 2.5);
        // Drift: the dust sways on a slow curl-noise field around where it belongs.
        vec2 flow = curl(vec3(p.xy * 3.2, time * 0.045 + aSeed * 0.2));
        p.xy += flow * mix(0.0016, 0.0045, step(0.5, aKind)) * dust * (1.0 - still);
        // Motes: one grain in twenty-five lifts off on the flow, fades, and is reborn where it was.
        float mote = step(0.96, aSeed) * dust * (1.0 - still);
        float life = fract(time * (0.035 + aSeed * 0.03) + aSeed * 13.0);
        p.xy += mote * (curl(vec3(p.xy * 2.0, time * 0.08 + 7.0)) * 0.05 + vec2(0.012, 0.09)) * life * life;
        float moteA = mix(1.0, smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life)), mote);
        // The pointer: the dust parts softly around it and brightens.
        vec2 dp = p.xy - pointer.xy; float near = (1.0 - smoothstep(0.0, 0.14, length(dp))) * pointer.z * dust;
        p.xy += normalize(dp + 1e-5) * near * near * 0.035;
        // Light from the eyepiece: a ripple outward whenever a report arrives, and a slow breath every few seconds.
        float de = length(position.xy - eye);
        float ring = exp(-pow((de - (time - ripple) * 0.38) / 0.035, 2.0)) * exp(-(time - ripple) * 0.9);
        float breath = exp(-pow((de - fract(time / 9.0) * 1.3) / 0.06, 2.0)) * 0.35 * (1.0 - still);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float on = smoothstep(aT, aT + 0.07, progress);
        float tip = exp(-max(0.0, progress - aT) * 22.0) * step(progress, 1.15) * on;
        float tw = 0.72 + 0.28 * sin(time * (0.6 + aSeed * 1.8) + aSeed * 50.0);
        float isEye = step(3.5, aKind) * step(aKind, 4.5), con = step(4.5, aKind), big = step(2.5, aKind) * step(aKind, 3.5);
        float size = aKind < 0.5 ? 0.0075 : aKind < 1.5 ? 0.006 : aKind < 2.5 ? 0.0058 : 0.024;
        size = mix(size, 0.05, isEye) * (1.0 + isEye * flash * 0.6);
        size = mix(size, 0.03 + 0.012 * sin(time * 0.7 + aSeed * 20.0), con);
        float gain = aKind < 0.5 ? 0.55 : aKind < 1.5 ? 0.45 : aKind < 2.5 ? 0.5 : 0.85;
        gain = mix(gain, 1.35 + flash * 1.8, isEye);
        gain = mix(gain, 1.05, con);
        float lift = 1.0 + (ring * 2.2 + breath + near * 1.6) * dust;
        vI = on * moteA * (tw * gain * aB * lift + tip * 1.6);
        vRay = big * 0.45 + isEye + con * 0.8;
        vC = mix(vec3(0.95, 0.58, 0.26), vec3(1.0, 0.93, 0.78), clamp(aB * 1.1 + ring * 0.5, 0.0, 1.0));
        gl_PointSize = size * (1.0 + tip * 0.8 + ring * 0.6 * dust) * px * (3.0 / -mv.z) * 1.4;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float alpha; varying vec3 vC; varying float vI, vRay;
      void main() {
        vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
        float core = exp(-r * r * 30.0), halo = exp(-r * 6.0) * 0.4;
        float ray = vRay * (exp(-abs(d.x) * 80.0) * exp(-abs(d.y) * 5.0) + exp(-abs(d.y) * 80.0) * exp(-abs(d.x) * 5.0)) * 0.8;
        vec3 c = vC * (halo + ray + core * 0.8) + vec3(1.0, 0.96, 0.88) * core * 0.45 * vRay;
        gl_FragColor = vec4(c * vI * alpha * (1.0 - smoothstep(0.86, 1.0, r)), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(g, m);
  stars.renderOrder = 4;
  // Her constellation's lines, drawn like a pen after the dust has come.
  const F = data.figure, lp = [], lt = [];
  F.lines.forEach(([a, b], i) => { const A = F.stars[a], B = F.stars[b]; lp.push(A[0], A[1], 0, B[0], B[1], 0); const t = i / F.lines.length; lt.push(t, t + 1 / F.lines.length); });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(lt, 1));
  const lineM = new THREE.ShaderMaterial({
    uniforms: { draw: { value: 0 }, alpha: uni.alpha, time: u.time },
    vertexShader: `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float draw, alpha, time; varying float vT;
      void main() { if (vT > draw) discard; float tip = exp(-(draw - vT) * 18.0) * step(draw, 0.999);
        float shimmer = 0.85 + 0.15 * sin(time * 1.3 - vT * 12.0);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * alpha * (0.42 * shimmer + tip * 1.4), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(lg, lineM);
  lines.renderOrder = 5;
  // A clearing in the sky behind her, so she reads.
  const clearing = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.05), new THREE.ShaderMaterial({
    uniforms: { alpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float alpha; varying vec2 vUv; void main() { float d = length((vUv - 0.5) * vec2(1.0, 0.9)) * 2.0;
      gl_FragColor = vec4(0.016, 0.02, 0.045, alpha * 0.66 * (1.0 - smoothstep(0.2, 1.0, d))); }`,
    transparent: true, depthWrite: false,
  }));
  clearing.position.set(0.02, 0.0, -0.02); clearing.renderOrder = 2;
  const group = new THREE.Group();
  group.add(clearing, stars, lines);
  const top = P.reduce((a, p) => (p[1] > a[1] ? p : a), [0, -9]);
  let lit = 0, near = 0;
  const target = new THREE.Vector3();
  return {
    group, eye, height: data.height, name: 'You', what: 'Deciding what the experiment needs', where: 'At the microscope',
    anchor: new THREE.Vector3(top[0], top[1] + 0.035, 0), middle: new THREE.Vector3(0, 0, 0), space: group, text: 0,
    flash(v, t) { uni.flash.value = Math.max(uni.flash.value, v); uni.ripple.value = t; },
    // The pointer, as a point on her plane (null when it is away).
    point(world) { if (world) { target.copy(world); group.worldToLocal(target); near = 1; } else near = 0; },
    update(t, still, hover) {
      const p = still ? 1.2 : ease(clamp(t / 1.5)) * 1.2;
      lit += ((hover ? 1 : 0) - lit) * 0.1;
      uni.progress.value = p;
      uni.alpha.value = (still ? 1 : clamp(t / 0.25)) * (1 + lit * 0.3);
      uni.still.value = still ? 1 : 0;
      lineM.uniforms.draw.value = still ? 1 : ease(clamp((t - 0.6) / 1.4));
      clearing.material.uniforms.alpha.value = still ? 1 : clamp(t / 0.5);
      uni.flash.value *= 0.94;
      const pt = uni.pointer.value;
      pt.x += (target.x - pt.x) * 0.12; pt.y += (target.y - pt.y) * 0.12; pt.z += (near - pt.z) * 0.06;
      this.text = still ? 1 : ease(clamp((t - 0.6) / 0.6));
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
  let next = 4;
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
        if (prog >= 1 && !c.done) { c.done = true; you.flash(1, t); }
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
        float reveal = smoothstep(0.0, 1.5, intro) * (1.0 - 0.62 * smoothstep(2.5, 6.0, intro));
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
