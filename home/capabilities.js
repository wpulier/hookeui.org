// Chapter 4, Capabilities: the specimen ringed in depth by every model, warm on your Mac and cool in the cloud, light
// streaming in from all of them at once. Hovering a model makes it fire harder; a tap on a model switches it off or
// on; a tap on the specimen has every model that's on fire at that spot; pointing at the specimen shows a lens naming
// the models whose light reached the cells under it.
import { THREE, GOLD, BLUE, webgl, makeView, pointsUniforms, pointsMaterial, pointsGeometry, specimenPoints, aim, fitDistance, toScreen, keepApart } from './gl.js';
import { stage, loadSky, artFailed, clamp } from './stage.js';

export function startCapabilities(section, entries) {
  if (!webgl()) return artFailed(section);
  loadSky().then((sky) => build(section, entries, sky), () => artFailed(section));
}

function build(section, entries, sky) {
  const E = entries.entries, ids = entries.first.models;
  const lensEl = section.querySelector('#cap-lens'), statusEl = section.querySelector('#cap-status');
  const ring = document.createElement('div'); ring.className = 'lens-ring'; section.appendChild(ring);
  const view = makeView(section.querySelector('canvas.art'));
  const { scene, camera, composer } = view;
  const world = new THREE.Group(); scene.add(world);
  const U = pointsUniforms(); U.intro.value = 1;
  const spec = specimenPoints(sky, U, { scatter: false, scale: 1.15 }); world.add(spec);
  const cells = sky.cells, cellPos = spec.userData.cellPos, by = new Int16Array(cells.length).fill(-1);
  const rimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 161 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2) * 1.24, 0, Math.sin(i / 160 * Math.PI * 2) * 1.24))), new THREE.LineBasicMaterial({ color: 0x8a90b0, transparent: true, opacity: 0.22 }));
  world.add(rimLine);

  // the models, in a ring: those on your Mac round most of it, the cloud ones together on one side
  const R = 1.75;
  const nodes = ids.map((id, i) => {
    const e = E[id], a = -Math.PI * 0.62 + i / ids.length * Math.PI * 2;
    const el = document.createElement('div'); el.className = `lbl on cap-lbl ${e.where}`; el.textContent = e.name; section.appendChild(el);
    return { id, name: e.name, where: e.where, col: e.where === 'mac' ? GOLD : BLUE, pos: new THREE.Vector3(Math.cos(a) * R, 0.32 + Math.sin(i * 1.7) * 0.12, Math.sin(a) * R), on: true, hot: 0, acc: Math.random(), el };
  });
  const nodeGeo = pointsGeometry(nodes.length);
  nodes.forEach((n, i) => {
    const A = nodeGeo.attributes; A.position.setXYZ(i, n.pos.x, n.pos.y, n.pos.z); A.start.setXYZ(i, n.pos.x, n.pos.y, n.pos.z);
    A.color.setXYZ(i, n.col.r * 0.6, n.col.g * 0.6, n.col.b * 0.6); A.tint.setXYZ(i, n.col.r, n.col.g, n.col.b); A.size.setX(i, 92); A.seed.setX(i, 0);
  });
  world.add(new THREE.Points(nodeGeo, pointsMaterial(U)));
  const MAX = 1800, TRAIL = 3, motesGeo = pointsGeometry(MAX * TRAIL); world.add(new THREE.Points(motesGeo, pointsMaterial(U)));
  const motes = [];
  function fire(n, near) {
    let i = Math.random() * cells.length | 0;
    if (near) for (let k = 0; k < 40; k++) { const j = Math.random() * cells.length | 0; if (cellPos(j).distanceTo(near) < 0.4) { i = j; break; } }
    const to = cellPos(i), mid = n.pos.clone().lerp(to, 0.5); mid.y += 0.5 + Math.random() * 0.3;
    motes.push({ n, cell: i, curve: new THREE.QuadraticBezierCurve3(n.pos.clone(), mid, to), t: 0, sp: 0.5 + Math.random() * 0.4 });
  }
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 64), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.01; world.add(ripple);
  let rippleT = 9;

  let W = 1, H = 1, narrow = false, rect = null, spin = 0;
  const target = new THREE.Vector3(0, 0.15, 0), v = new THREE.Vector3();
  const EL = () => (narrow ? 0.82 : 0.72);
  const place = (d) => aim(camera, target, EL(), d, rect, W, H);
  function layout(s) {
    W = s.W; H = s.H; narrow = W < 761;
    view.size(W, H, s.dpr); U.px.value = s.dpr * H / 900 * (narrow ? 1.25 : 1);
    const words = section.querySelector('.words').getBoundingClientRect(), cv = s.canvas.getBoundingClientRect();
    rect = narrow ? { x: 36, y: 26, w: W - 72, h: H - 70 } : { x: Math.max(W * 0.44, words.right - cv.left + 60), y: 80, w: 0, h: H - 150 };
    if (!narrow) rect.w = W - rect.x - 90;
    const bounds = () => nodes.map((n) => n.pos.clone().add(new THREE.Vector3(0, 0.12, 0))).concat(nodes.map((n) => n.pos));
    world.rotation.y = 0; world.updateMatrixWorld();
    fitDistance(place, bounds, camera, rect, W, H);
  }
  const pageXY = (p) => { const cb = section.querySelector('canvas.art').getBoundingClientRect(); const [x, y] = toScreen(p, world, camera, W, H, v); return { x: x + cb.left, y: y + cb.top }; };
  window.hookeHome = window.hookeHome || {};
  window.hookeHome.capabilities = { models: () => nodes.map((n) => ({ id: n.id, on: n.on, ...pageXY(n.pos) })), specimen: () => pageXY(new THREE.Vector3(0, 0, 0)) };

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const onSpecimen = (x, y) => { ray.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), camera); const r = ray.ray.clone().applyMatrix4(world.matrixWorld.clone().invert()); return r.intersectPlane(plane, hit) && hit.length() < 1.3 ? hit.clone() : null; };
  const nodeAt = (x, y) => nodes.find((n) => { const [nx, ny] = toScreen(n.pos, world, camera, W, H, v), b = n.el.getBoundingClientRect(), cb = section.querySelector('canvas.art').getBoundingClientRect();
    return Math.hypot(nx - x, ny - y) < 30 || (x + cb.left > b.left - 4 && x + cb.left < b.right + 4 && y + cb.top > b.top - 4 && y + cb.top < b.bottom + 4); });

  stage(section, {
    init: layout,
    frame(s, dt) {
      U.time.value = s.t;
      for (const c of s.clicks) {
        const n = nodeAt(c.x, c.y);
        if (n) { n.on = !n.on; n.hot = 1; continue; }
        const p = onSpecimen(c.x, c.y);
        if (p) { nodes.filter((q) => q.on).forEach((q) => { for (let k = 0; k < 3; k++) fire(q, p); }); ripple.position.set(p.x, 0.01, p.z); rippleT = 0; }
      }
      // the ring turns slowly; a sideways drag spins it
      spin += (s.dragX / W) * 3; spin += dt * 0.05;
      world.rotation.y = spin; world.updateMatrixWorld();
      const hover = s.mx > -999 ? nodeAt(s.mx, s.my) : null;
      const A = nodeGeo.attributes;
      nodes.forEach((n, i) => {
        n.hot += ((n === hover ? 1 : 0) - n.hot) * Math.min(1, dt * 6);
        A.lit.setX(i, n.on ? 0.55 + n.hot * 0.9 : 0); A.color.setXYZ(i, ...(n.on ? [n.col.r * 0.6, n.col.g * 0.6, n.col.b * 0.6] : [0.12, 0.13, 0.18]));
        if (!s.still && n.on) { n.acc += dt * (1.3 + n.hot * 14); while (n.acc > 1) { n.acc -= 1; fire(n); } }
        n.el.classList.toggle('off', !n.on);
      });
      A.lit.needsUpdate = A.color.needsUpdate = true;
      const M = motesGeo.attributes; let w = 0;
      for (let k = motes.length - 1; k >= 0; k--) {
        const m = motes[k]; m.t += dt * m.sp;
        if (m.t >= 1) { motes.splice(k, 1); spec.geometry.attributes.lit.setX(m.cell, 1); spec.geometry.attributes.tint.setXYZ(m.cell, m.n.col.r, m.n.col.g, m.n.col.b); by[m.cell] = nodes.indexOf(m.n); continue; }
        if (!m.n.on) { motes.splice(k, 1); continue; }
        for (let j = 0; j < TRAIL && w < MAX * TRAIL; j++, w++) {
          m.curve.getPoint(Math.max(0, m.t - j * 0.025), v);
          M.position.setXYZ(w, v.x, v.y, v.z); M.start.setXYZ(w, v.x, v.y, v.z); M.color.setXYZ(w, m.n.col.r, m.n.col.g, m.n.col.b); M.tint.setXYZ(w, m.n.col.r, m.n.col.g, m.n.col.b);
          M.size.setX(w, 46 * (1 - j * 0.3)); M.lit.setX(w, 0.6 - j * 0.2); M.seed.setX(w, 0);
        }
      }
      for (let j = w; j < MAX * TRAIL; j++) M.size.setX(j, 0);
      for (const key of ['position', 'start', 'color', 'tint', 'size', 'lit']) M[key].needsUpdate = true;
      const L = spec.geometry.attributes.lit, f = Math.pow(0.988, dt * 60);
      for (let i = 0; i < cells.length; i++) { const x = L.getX(i); if (x > 0.003) L.setX(i, x * f); }
      L.needsUpdate = true; spec.geometry.attributes.tint.needsUpdate = true;
      rippleT += dt; ripple.scale.setScalar(0.05 + rippleT * 0.7); ripple.material.opacity = Math.max(0, 0.55 - rippleT * 0.45);
      // labels follow their models, never touching
      const off = s.canvas.offsetTop;
      const items = nodes.map((n) => { const [x, y, z] = toScreen(n.pos, world, camera, W, H, v); return { n, x, y: y - 10 + off, w: n.el.offsetWidth, h: n.el.offsetHeight, z }; });
      items.sort((a, b) => a.z - b.z); keepApart(items);
      for (const it of items) { it.n.el.style.transform = `translate(${clamp(it.left, 4, W - it.w - 4)}px, ${it.top}px)`; it.n.el.style.zIndex = String(3); }
      // the lens: which models' light reached the cells under the pointer
      const p = s.mx > -999 && !hover ? onSpecimen(s.mx, s.my) : null;
      if (p) {
        const rad = Math.max(40, Math.min(W, H) * 0.07), found = new Set();
        for (let i = 0; i < cells.length; i++) { if (by[i] < 0) continue; const [x, y] = toScreen(cellPos(i, v), world, camera, W, H, v); if (Math.hypot(x - s.mx, y - s.my) < rad) found.add(by[i]); }
        ring.style.display = 'block'; ring.style.width = ring.style.height = `${rad * 2}px`; ring.style.transform = `translate(${s.mx - rad}px, ${s.my - rad + off}px)`;
        lensEl.style.display = 'block';
        lensEl.innerHTML = found.size ? [...found].slice(0, 5).map((k) => `<div style="color:#${nodes[k].col.getHexString()}">${nodes[k].name}</div>`).join('') : '<div style="color:#b9bccb">nothing here yet: tap to ask</div>';
        lensEl.style.left = `${clamp(s.mx + rad + 10, 8, W - lensEl.offsetWidth - 8)}px`; lensEl.style.top = `${s.my - rad * 0.6 + off}px`;
      } else { ring.style.display = 'none'; lensEl.style.display = 'none'; }
      const on = nodes.filter((n) => n.on), mac = on.filter((n) => n.where === 'mac').length;
      statusEl.textContent = `${on.length} of ${nodes.length} models on · ${mac} on your Mac, ${on.length - mac} in the cloud`;
      composer.render(dt);
    },
  });
}
