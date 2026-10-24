// Chapter 3, Workspace: the stem as a stack of layers in depth: the image, then what each model made of it, registered
// to each other. Scrolling the chapter in pulls the layers apart, from one disc to the full stack; the pointer turns it;
// a pointed-at cell lights through every layer, and the readout names each layer's model.
import { THREE, GOLD, PALE, lin, webgl, makeView, pointsUniforms, pointsMaterial, pointsGeometry, aim, fitDistance, toScreen, keepApart, FRAME } from './gl.js';
import { stage, startArt, artFailed, clamp } from './stage.js';

const LAYER_COL = ['#c8ccdc', '#f2c46d', '#ffd98f', '#f59e6b', '#ffad66', '#8cc2ff'].map((h) => new THREE.Color(h));
const GROUPS = ['#ff8fb8', '#8fe3c0', '#b39bff', '#ffd27a'].map((h) => new THREE.Color(h));

export function startWorkspace(section, entries) { startArt(section, webgl(), (sky) => build(section, entries, sky)); }

function build(section, entries, sky) {
  const cells = sky.cells, N = cells.length;
  const lenses = entries.lenses.map((l) => ({ name: l.id ? entries.entries[l.id].name : l.name, sub: l.sub }));
  const pick = section.querySelector('#ws-pick');
  const view = makeView(section.querySelector('canvas.art'), () => artFailed(section));
  const { scene, camera, composer } = view;
  const stack = new THREE.Group(); scene.add(stack);
  const U = pointsUniforms(); U.intro.value = 1;
  const P = (c) => new THREE.Vector3(c.x - FRAME.cx, 0, -(c.y - FRAME.cy));
  const CP = cells.map(P);

  // ring points: a hollow circle per cell, for the outlines layer
  const ringMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 color; attribute float size; uniform float px; varying vec3 vC;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * px / -mv.z; gl_Position = projectionMatrix * mv; vC = color; }`,
    fragmentShader: `varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.42, d) * smoothstep(0.3, 0.4, d); if (a < 0.01) discard; gl_FragColor = vec4(vC, a * 0.8); }`,
  });

  const layers = lenses.map((l, k) => {
    const g = new THREE.Group(); stack.add(g);
    const col = LAYER_COL[k];
    const plate = new THREE.Mesh(new THREE.CircleGeometry(1.18, 96), new THREE.MeshBasicMaterial({ color: 0x0b0e1c, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    plate.rotation.x = -Math.PI / 2; g.add(plate);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * 1.18, 0, Math.sin(i / 128 * Math.PI * 2) * 1.18))),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.3 })));
    if (k === 0 || k === 2 || k === 5) {
      const pick = k === 5 ? cells.filter((_, i) => i % 5 === 0) : cells, geo = pointsGeometry(pick.length), A = geo.attributes;
      pick.forEach((c, i) => {
        const p = P(c); A.position.setXYZ(i, p.x, 0.005, p.z); A.start.setXYZ(i, p.x, 0.005, p.z);
        const cc = k === 0 ? new THREE.Color(lin(c.r), lin(c.g), lin(c.b)) : k === 2 ? GROUPS[(c.r > c.b ? 0 : 1) + (c.m > 0.5 ? 2 : 0)] : col;
        A.color.setXYZ(i, cc.r * (k === 2 ? 0.7 : 1), cc.g * (k === 2 ? 0.7 : 1), cc.b * (k === 2 ? 0.7 : 1)); A.tint.setXYZ(i, cc.r, cc.g, cc.b);
        A.size.setX(i, (k === 5 ? 40 : 20 + c.m * 34)); A.seed.setX(i, 0);
      });
      g.add(new THREE.Points(geo, pointsMaterial(U)));
    } else if (k === 1) {
      const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), c3 = new Float32Array(N * 3), sz = new Float32Array(N);
      cells.forEach((c, i) => { const p = P(c); pos.set([p.x, 0.005, p.z], i * 3); c3.set([col.r * 0.8, col.g * 0.8, col.b * 0.8], i * 3); sz[i] = 30 + c.m * 50; });
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c3, 3)); geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
      g.add(new THREE.Points(geo, ringMat));
    } else {
      const segs = [];
      cells.forEach((c, i) => {
        if (k === 3 && i % 2) return; if (k === 4 && i % 3) return;
        const p = P(c);
        if (k === 3) { const a = (c.x * 7 + c.y * 11) % 6.283, l = 0.05 + c.m * 0.05; segs.push(p.x, 0.006, p.z, p.x + Math.cos(a) * l, 0.006, p.z + Math.sin(a) * l); }
        else segs.push(p.x, 0, p.z, p.x, 0.04 + c.m * 0.16, p.z);
      });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
      g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })));
    }
    const el = document.createElement('div'); el.className = 'lbl on ws-lbl'; el.style.color = `#${col.getHexString()}`;
    el.innerHTML = `${l.name}<small>${l.sub}</small>`; section.appendChild(el);
    return { g, el, col };
  });

  // the thread through the pointed-at cell
  const threadGeo = new THREE.BufferGeometry();
  threadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); threadGeo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1));
  const thread = new THREE.Line(threadGeo, new THREE.LineDashedMaterial({ color: 0xfff1d6, dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0 }));
  thread.frustumCulled = false;
  scene.add(thread);
  const beadGeo = pointsGeometry(layers.length); scene.add(new THREE.Points(beadGeo, pointsMaterial(U)));

  let freeTop = 0, fullGap = 0.6;
  let W = 1, H = 1, narrow = false, gap = 0.3, yaw = -0.35, rect = null, dist = 8, el = 0.42, picked = -1, lastPickAt = '', shown = -1;
  const target = new THREE.Vector3(0, 0, 0), v = new THREE.Vector3();
  const place = (d) => aim(camera, target, el, d, rect, W, H);
  function setGap(gp) { gap = gp; layers.forEach((l, k) => { l.g.position.y = (k - (layers.length - 1) / 2) * gp; }); stack.updateMatrixWorld(true); }
  function layout(s) {
    W = s.W; H = s.H; narrow = s.phone; freeTop = s.top;
    view.size(W, H, s.dpr); U.px.value = s.dpr * H / 900 * (narrow ? 1.2 : 1);
    el = narrow ? 0.62 : 0.42;
    const words = section.querySelector('.words').getBoundingClientRect(), cv = s.canvas.getBoundingClientRect();
    rect = narrow ? { x: 8, y: freeTop + 8, w: W - 16, h: H - freeTop - 16 } : { x: Math.max(W * 0.42, words.right - cv.left + 30), y: 80, w: 0, h: H - 130 };
    if (!narrow) rect.w = W - rect.x - W * 0.14;
    setGap(narrow ? 0.46 : 0.6);
    const bounds = () => { const b = []; layers.forEach((l) => { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; b.push(new THREE.Vector3(Math.cos(a) * 1.2, l.g.position.y, Math.sin(a) * 1.2)); } }); return b; };
    stack.rotation.y = -0.35; stack.updateMatrixWorld(true);
    dist = fitDistance(place, bounds, camera, rect, W, H);
    fullGap = narrow ? 0.46 : 0.6;
  }

  window.hookeHome = window.hookeHome || {};
  window.hookeHome.workspace = { cellAt: (i) => { const cb = section.querySelector('canvas.art').getBoundingClientRect(); const [x, y] = toScreen(P(cells[i]).add(new THREE.Vector3(0, layers[0].g.position.y, 0)), stack, camera, W, H, v); return [x + cb.left, y + cb.top]; } };

  stage(section, {
    init: layout,
    visibility: view.visibility,
    frame(s, dt) {
      U.time.value = s.t;
      const here = s.mx > -999, k = 1 - Math.pow(0.94, dt * 60);
      // held still while a cell is picked, so its readout can be read; otherwise the pointer turns and opens the stack
      // how far the chapter has come up the screen: 0 until its top is 85% of the way down, 1 once it fills the screen
      const top = section.getBoundingClientRect().top, p = clamp((0.85 - top / innerHeight) / 0.85, 0, 1), e = p * p * (3 - 2 * p);
      const wantGap = s.still ? fullGap : 0.025 + e * (fullGap - 0.025) + (here ? (0.5 - s.my / H) * 0.06 : Math.sin(s.t * 0.6) * 0.015 * e);
      const wantYaw = here ? -1.0 + (s.mx / W) * 1.3 : -0.35 + Math.sin(s.t * 0.15) * 0.35;
      setGap(s.still ? wantGap : gap + (wantGap - gap) * (1 - Math.pow(0.82, dt * 60)));
      if (picked < 0) yaw += (wantYaw - yaw) * k;
      stack.rotation.y = yaw; stack.updateMatrixWorld(true);
      // which cell is pointed at: the nearest drawn cell on any layer, found again when the pointer moves
      const key = `${Math.round(s.mx)},${Math.round(s.my)}`;
      if (here && key !== lastPickAt) {
        lastPickAt = key; let best = -1, bd = 18 * 18;
        for (let l = 0; l < layers.length; l++) {
          const y = layers[l].g.position.y;
          for (let i = 0; i < N; i += 1) {
            v.copy(CP[i]); v.y = y; v.applyMatrix4(stack.matrixWorld).project(camera);
            const dx = (v.x + 1) / 2 * W - s.mx, dy = (1 - v.y) / 2 * H - s.my, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
          }
        }
        picked = best;
      } else if (!here) { picked = -1; lastPickAt = ''; }
      const B = beadGeo.attributes;
      if (picked >= 0) {
        const pts = layers.map((l) => CP[picked].clone().setY(l.g.position.y).applyMatrix4(stack.matrixWorld));
        const a = pts[0], b = pts[pts.length - 1], TP = threadGeo.attributes.position;
        TP.setXYZ(0, a.x, a.y, a.z); TP.setXYZ(1, b.x, b.y, b.z); TP.needsUpdate = true;
        threadGeo.attributes.lineDistance.setX(1, a.distanceTo(b)); threadGeo.attributes.lineDistance.needsUpdate = true; thread.material.opacity = 0.8;
        pts.forEach((p, i) => { B.position.setXYZ(i, p.x, p.y, p.z); B.start.setXYZ(i, p.x, p.y, p.z); const c = layers[i].col; B.color.setXYZ(i, c.r, c.g, c.b); B.tint.setXYZ(i, c.r, c.g, c.b); B.size.setX(i, 70); B.lit.setX(i, 1); B.seed.setX(i, 0); });
        const [x, y] = toScreen(pts[pts.length - 1], null, camera, W, H, v);
        pick.style.display = 'block';
        if (shown < 0) { pick.innerHTML = `<b>One cell, through every lens</b>${lenses.map((l, i) => `<span style="color:#${layers[i].col.getHexString()}">${l.name}</span>`).join(' · ')}`; shown = 1; }
        const pw = pick.offsetWidth;
        pick.style.left = `${clamp(x + 18, 8, W - pw - 8)}px`; pick.style.top = `${clamp(y - 70, 8, H - 120) + s.canvas.offsetTop}px`;
      } else { thread.material.opacity = 0; for (let i = 0; i < layers.length; i++) B.size.setX(i, 0); if (pick.style.display !== 'none') pick.style.display = 'none'; }
      for (const key2 of ['position', 'start', 'color', 'tint', 'size', 'lit']) B[key2].needsUpdate = true;
      // each layer's name at its right edge, kept apart
      const items = layers.map((l) => { if (!l.lw) { l.lw = l.el.offsetWidth; l.lh = l.el.offsetHeight; } const [x, y] = toScreen(new THREE.Vector3(1.32, l.g.position.y, 0), null, camera, W, H, v); return { l, x: x + l.lw / 2 + 6, y: y + 8 + s.canvas.offsetTop, w: l.lw, h: l.lh }; });
      items.sort((a, b) => b.y - a.y); keepApart(items, { l: 4, t: (narrow ? freeTop : 70) + 2, r: W - 4, b: s.canvas.offsetTop + H - 4 });
      for (const it of items) { it.l.el.style.opacity = it.hidden ? '0' : ''; it.l.el.style.transform = `translate(${it.left}px, ${it.top}px)`; }
      composer.render(dt);
    },
  });
}
