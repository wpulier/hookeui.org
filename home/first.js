// Chapter 1, the first screen (concept 09): one stack, bottom to top. HookeUI's workspace is the base; on it the live
// specimen (the 1,523 cells Cellpose-SAM found in a real stained stem, the real capture faint beneath them); on the
// specimen your question; above, every model. The question's chosen models light, researchers carry the question up
// to each in parallel, and each model's light comes down into the cells. Spores rise off the specimen and part around
// the pointer; a sideways drag turns the stage; a tap on the specimen asks every chosen model about that spot; a tap on
// the question asks the next one.
import { THREE, GOLD, BLUE, PALE, lin, webgl, makeView, pointsUniforms, pointsMaterial, pointsGeometry, specimenPoints, spores, aim, fitDistance, toScreen, keepApart, FRAME } from './gl.js';
import { stage, startArt, artFailed, clamp } from './stage.js';

const DUR = 10.5;

export function startFirst(section, entries) { startArt(section, webgl(), (sky) => build(section, entries, sky)); }

// A rounded rectangle path (CanvasRenderingContext2D.roundRect is missing before Safari 16).
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function build(section, entries, sky) {
  const E = entries.entries, F = entries.first;
  const pill = section.querySelector('#ask-q'), qt = pill.querySelector('.t'), qs = pill.querySelector('.s');
  const labelsEl = section.querySelector('.first-labels'), specEl = section.querySelector('.first-spec');
  const view = makeView(section.querySelector('canvas.art'), () => artFailed(section));
  const { scene, camera, composer } = view;
  const world = new THREE.Group(); scene.add(world);
  const U = pointsUniforms();

  // the specimen, and the real capture beneath it, clipped to the eyepiece
  const spec = specimenPoints(sky, U); world.add(spec);
  const cells = sky.cells, cellPos = spec.userData.cellPos;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.08, 96), new THREE.MeshBasicMaterial({ color: 0x0a0d1c, transparent: true, opacity: 0.85 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01; world.add(disc);
  const photo = new THREE.TextureLoader().load('media/sky-photo.jpg'); photo.colorSpace = THREE.SRGBColorSpace;
  const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(FRAME.w, FRAME.h), new THREE.ShaderMaterial({
    uniforms: { map: { value: photo }, intro: U.intro }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float intro; varying vec2 vUv; varying vec3 vP;
      void main() { float r = length(vP.xy); if (r > 1.07) discard; gl_FragColor = vec4(texture2D(map, vUv).rgb * 0.1, smoothstep(1.07, 0.8, r) * smoothstep(0.3, 1.0, intro)); }`,
  }));
  photoMesh.rotation.x = -Math.PI / 2; photoMesh.position.y = -0.005; world.add(photoMesh);
  const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 161 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2) * 1.08, 0, Math.sin(i / 160 * Math.PI * 2) * 1.08))),
    new THREE.LineBasicMaterial({ color: 0x8a90b0, transparent: true, opacity: 0.22 }));
  world.add(rim);

  // HookeUI's workspace, the base everything sits on
  const PW = 4.2, PD = 2.9, ui = document.createElement('canvas'); ui.width = 1680; ui.height = 1160;
  const uiTex = new THREE.CanvasTexture(ui); uiTex.colorSpace = THREE.SRGBColorSpace; uiTex.anisotropy = 8;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: uiTex, transparent: true, depthWrite: false }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(0, -0.04, 0.08); world.add(plate);

  // the models: the sixteen of the first screen, each a light, a label and a curve from the question
  const Q = new THREE.Vector3(0, 0.5, 0.15);
  const ARC = { w: 1.6, b: 1.12, row: 0.2 };
  const nodes = F.models.map((id, i) => {
    const e = E[id], el = document.createElement('div');
    el.className = `lbl ${e.where}`; el.dataset.id = id;
    el.innerHTML = `${e.name}<small>${e.where === 'mac' ? 'your Mac' : 'cloud'}</small><em></em>`;
    labelsEl.appendChild(el);
    return { id, name: e.name, where: e.where, col: e.where === 'mac' ? GOLD : BLUE, el, pos: new THREE.Vector3(), u: i / (F.models.length - 1) * 2 - 1, row: i % 2, on: 0, line: null, fire: 0 };
  });
  const nodeGeo = pointsGeometry(nodes.length);
  nodes.forEach((n, i) => {
    nodeGeo.attributes.color.setXYZ(i, n.col.r * 0.5, n.col.g * 0.5, n.col.b * 0.5); nodeGeo.attributes.tint.setXYZ(i, n.col.r, n.col.g, n.col.b);
    nodeGeo.attributes.seed.setX(i, 0.4 + i * 0.02);
    n.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: n.col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    world.add(n.line);
  });
  world.add(new THREE.Points(nodeGeo, pointsMaterial(U)));
  const curveUp = (n) => new THREE.QuadraticBezierCurve3(Q.clone(), new THREE.Vector3(n.pos.x * 0.35, (Q.y + n.pos.y) / 2 + 0.25, n.pos.z * 0.5), n.pos.clone());
  let narrow = false, compact = false;
  function setStack(qy) {
    Q.y = qy;
    nodes.forEach((n, i) => {
      const u = n.u;
      n.pos.set(u * ARC.w, qy + ARC.b + 0.4 * (1 - u * u) + (n.row ? ARC.row : 0), -0.7 * (1 - u * u));
      nodeGeo.attributes.position.setXYZ(i, n.pos.x, n.pos.y, n.pos.z); nodeGeo.attributes.start.setXYZ(i, n.pos.x, n.pos.y + 1, n.pos.z);
      n.line.geometry.setFromPoints(curveUp(n).getPoints(60));
    });
    nodeGeo.attributes.position.needsUpdate = nodeGeo.attributes.start.needsUpdate = true;
  }
  // Every model keeps its place on one arc, on a phone as on a laptop; on a phone the arc runs on past the screen's
  // edges, so there are always more models than fit.
  let arranged = -1;
  function arrange(qi) {
    // On a phone the question's models take the middle places and the rest carry on outward, alternating sides.
    // They are spread evenly over the part of the arc that's on screen, the rest fill the places between and beyond.
    const chosen = Object.keys(F.questions[qi].use), N = nodes.length;
    const uOf = (k) => k / (N - 1) * 2 - 1, seen = Array.from({ length: N }, (_, k) => k).filter((k) => Math.abs(uOf(k)) <= 0.66);
    const picks = chosen.map((_, j) => seen[Math.round(j * (seen.length - 1) / Math.max(1, chosen.length - 1))]);
    const rest = Array.from({ length: N }, (_, k) => k).filter((k) => !picks.includes(k));
    nodes.forEach((n, i) => {
      const c = chosen.indexOf(n.id);
      const k = !narrow ? i : c >= 0 ? picks[c] : rest[nodes.filter((q) => !chosen.includes(q.id)).indexOf(n)];
      n.u = uOf(k); n.row = narrow ? (c >= 0 ? c % 2 : 1 - k % 2) : k % 2;
    });
    nodes.forEach((n, i) => {
      nodeGeo.attributes.size.setX(i, compact ? 66 : 58);
      n.measured = false;
    });
    nodeGeo.attributes.size.needsUpdate = true; arranged = qi; setStack(Q.y);
  }

  // researchers and light: motes travelling the curves
  const MAX = 1600, TRAIL = 3, motesGeo = pointsGeometry(MAX * TRAIL);
  world.add(new THREE.Points(motesGeo, pointsMaterial(U)));
  const motes = [];
  const sendUp = (n, t = 0) => motes.push({ kind: 'up', n, curve: curveUp(n), t, sp: 0.9 + Math.random() * 0.4 });
  function sendDown(n, near, t0 = 0) {
    let i = Math.random() * cells.length | 0;
    if (near) for (let k = 0; k < 40; k++) { const j = Math.random() * cells.length | 0; if (cellPos(j).distanceTo(near) < 0.3) { i = j; break; } }
    const to = cellPos(i), mid = n.pos.clone().lerp(to, 0.5); mid.y += 0.35; mid.x += (Math.random() - 0.5) * 0.4;
    motes.push({ kind: 'down', n, cell: i, curve: new THREE.QuadraticBezierCurve3(n.pos.clone(), mid, to), t: t0, sp: 0.8 + Math.random() * 0.4 });
  }

  // spores off the specimen, in its own colours and the two lights
  const sporeCols = [GOLD, BLUE, PALE, ...cells.filter((_, i) => i % 40 === 0).map((c) => new THREE.Color(lin(c.r), lin(c.g), lin(c.b)))];
  let sp = null;

  // a ring that spreads where the specimen is tapped
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 64), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.01; world.add(ripple);
  let rippleT = 9;

  // the workspace's own picture: sources, researchers at work, Activity
  function drawWorkspace(cur, t) {
    const g = ui.getContext('2d'), w = ui.width, h = ui.height, k = w / PW;
    g.clearRect(0, 0, w, h);
    rr(g, 4, 4, w - 8, h - 8, 46); g.fillStyle = 'rgba(11,13,24,0.92)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.09)'; g.stroke();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(0, 0, w, 96);
    ['#ff6b5f', '#ffbd2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = 0.55; g.beginPath(); g.arc(56 + i * 40, 48, 11, 0, 7); g.fill(); });
    g.globalAlpha = 1; g.font = '600 34px Inter, system-ui'; g.fillStyle = 'rgba(243,241,236,0.8)'; g.fillText('HookeUI', 196, 60);
    g.font = '400 30px Inter, system-ui'; g.fillStyle = 'rgba(160,165,190,0.6)'; g.fillText('Workspace · Plant stem', 352, 60);
    g.fillStyle = 'rgba(255,107,107,0.9)'; g.beginPath(); g.arc(w - 170, 48, 9, 0, 7); g.fill();
    g.font = '500 26px Inter, system-ui'; g.fillStyle = 'rgba(200,204,220,0.7)'; g.fillText('LIVE', w - 150, 57);
    const side = 0.95 * k;
    g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(0, 96, side, h);
    g.font = '600 22px Inter, system-ui'; g.fillStyle = 'rgba(140,146,170,0.6)'; g.fillText('SOURCES', 40, 160);
    [['Live camera', 1], ['Plant stem', 1], ['Sperm wet mount', 0], ['Human cells', 0], ['Brain atlas', 0]].forEach(([s, on], i) => {
      const y = 210 + i * 64; if (i === 1) { g.fillStyle = 'rgba(242,196,109,0.09)'; rr(g, 24, y - 38, side - 48, 54, 12); g.fill(); }
      g.font = '400 28px Inter, system-ui'; g.fillStyle = on ? 'rgba(236,234,228,0.62)' : 'rgba(160,165,190,0.42)'; g.fillText(s, 44, y);
    });
    g.font = '600 22px Inter, system-ui'; g.fillStyle = 'rgba(140,146,170,0.6)'; g.fillText('RESEARCHERS', 40, 620);
    [0, 1, 2].forEach((i) => {
      const y = 668 + i * 60, p = (t * 0.07 + i * 0.31) % 1;
      g.font = '400 26px Inter, system-ui'; g.fillStyle = 'rgba(200,204,220,0.6)'; g.fillText(`Researcher ${i + 1}`, 44, y);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(44, y + 14, side - 88, 6); g.fillStyle = 'rgba(242,196,109,0.7)'; g.fillRect(44, y + 14, (side - 88) * p, 6);
    });
    const ax = w - 0.95 * k;
    g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(ax, 96, w - ax, h);
    g.font = '600 22px Inter, system-ui'; g.fillStyle = 'rgba(140,146,170,0.6)'; g.fillText('ACTIVITY', ax + 40, 160);
    Object.entries(cur.use).forEach(([id, why], i) => {
      const y = 214 + i * 92, n = nodes.find((q) => q.id === id), done = t > 3 + i * 0.9;
      g.fillStyle = `#${n.col.getHexString()}`; g.globalAlpha = 0.9; g.beginPath(); g.arc(ax + 50, y - 9, 8, 0, 7); g.fill(); g.globalAlpha = 1;
      g.font = '500 28px Inter, system-ui'; g.fillStyle = 'rgba(236,234,228,0.66)'; g.fillText(n.name, ax + 72, y);
      g.font = '400 23px Inter, system-ui'; g.fillStyle = 'rgba(160,165,190,0.6)'; g.fillText(t < 1.4 ? 'waiting' : done ? why : 'working…', ax + 72, y + 32);
    });
    g.restore();
    uiTex.needsUpdate = true;
  }

  // layout: the specimen is sized from concept 08's footprint (its rim and a nine-model arc); the question then sits on
  // the far rim; the arc then takes all the room it has without touching the words or the top bar.
  const target = new THREE.Vector3(0, 0.78, 0);
  let wordsRight = 0, lastQ = '', lastS = '', freeTop = 0;
  let W = 1, H = 1, rect = null, dist = 6, EL = 0.52, yaw = 0, yawV = 0;
  const rimPts = Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.cos(i / 24 * Math.PI * 2) * 1.12, 0, Math.sin(i / 24 * Math.PI * 2) * 1.12));
  const footprint = () => [...rimPts, ...Array.from({ length: 9 }, (_, i) => { const u = i / 4 - 1; return [new THREE.Vector3(u * 1.35, Q.y + (narrow ? 1.7 : 1.27) + 0.34 * (1 - u * u), -0.35 * (1 - u * u)), new THREE.Vector3(u * 1.35 + Math.sign(u) * 0.25, Q.y + 1.05 + 0.34 * (1 - u * u), -0.35 * (1 - u * u))]; }).flat()];
  const place = (d) => aim(camera, target, EL, d, rect, W, H, 0);
  const v = new THREE.Vector3();
  const sy = (p) => toScreen(p, null, camera, W, H, v)[1];

  function layout(s) {
    W = s.W; H = s.H; narrow = s.phone; freeTop = s.top; compact = narrow || H < 560 || W < 761;
    view.size(W, H, s.dpr);
    U.px.value = s.dpr * H / 900 * (narrow ? 1.25 : 1);
    if (sp) { world.remove(sp.pts); sp.pts.geometry.dispose(); sp.pts.material.dispose(); }
    sp = spores(narrow ? 1500 : 3200, sporeCols); world.add(sp.pts); sp.uniforms.aspect.value = W / H; sp.uniforms.px.value = s.dpr * H / 900 * (narrow ? 1.3 : 1);
    EL = narrow ? 0.74 : 0.52; target.y = narrow ? 0.95 : 0.78;
    rect = narrow ? { x: 6, y: freeTop + 4, w: W - 12, h: H - freeTop - 40 } : { x: W * 0.47, y: Math.min(90, H * 0.14), w: W * 0.5, h: H - Math.min(120, H * 0.2) };
    const pillH = Math.max(pill.offsetHeight, narrow ? 52 : 70);
    ARC.w = 1.35; ARC.b = 1.12; arrange(Math.max(0, arranged)); setStack(0.5);
    for (let pass = 0; pass < 3; pass++) {
      dist = fitDistance(place, footprint, camera, rect, W, H);
      const want = sy(new THREE.Vector3(0, 0, -1.08)) - pillH * (narrow ? 0.15 : 0.3);
      let a = 0.1, b = 1.8;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; setStack(m); sy(Q) > want ? (a = m) : (b = m); }
      setStack(b);
    }
    // the arc: as high, then as wide, as the free space allows
    const words = section.querySelector('.words').getBoundingClientRect(), cv = s.canvas.getBoundingClientRect();
    wordsRight = narrow ? 0 : words.right - cv.left;
    const outer = narrow ? { x: 4, y: freeTop + 4, w: W - 8, h: H } : { x: Math.max(wordsRight + 24, rect.x - W * 0.05), y: 84, w: W, h: H };
    outer.w = W - outer.x - 12;
    const pad = narrow ? 0.18 : 0.3;
    const fitsArc = () => nodes.filter((n) => Math.abs(n.u) <= (narrow ? 0.72 : 1.001)).every((n) => [n.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), n.pos.clone().add(new THREE.Vector3(-pad, 0, 0)), n.pos.clone().add(new THREE.Vector3(pad, 0, 0))].every((p) => {
      const [x, y] = toScreen(p, null, camera, W, H, v); return x > outer.x && x < outer.x + outer.w && y > outer.y && y < outer.y + outer.h; }));
    ARC.row = narrow ? 0.3 : 0.24;
    let lo = 0.55, hi = 1.5; ARC.w = 0.9;
    for (let k = 0; k < 20; k++) { ARC.b = (lo + hi) / 2; setStack(Q.y); fitsArc() ? (lo = ARC.b) : (hi = ARC.b); }
    ARC.b = lo; lo = 0.8; hi = narrow ? 3.2 : 2.3;
    for (let k = 0; k < 20; k++) { ARC.w = (lo + hi) / 2; setStack(Q.y); fitsArc() ? (lo = ARC.w) : (hi = ARC.w); }
    ARC.w = lo; setStack(Q.y); place(dist);
    section.dataset.arc = `${ARC.w.toFixed(2)},${ARC.b.toFixed(2)}`;
    const [lx, ly] = toScreen(new THREE.Vector3(1.08, 0, 0), null, camera, W, H, v), [rx] = toScreen(new THREE.Vector3(-1.08, 0, 0), null, camera, W, H, v);
    section.dataset.disc = String(Math.round(Math.abs(lx - rx)));
    arranged = -1;
  }

  // the loop
  let qi = 0, t0 = -3.6, seeded = false;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const tilt = { x: 0, y: 0 };
  stage(section, {
    init: layout,
    visibility: view.visibility,
    frame(s, dt) {
      const T = s.t; U.time.value = T; if (sp) sp.uniforms.time.value = T;
      U.intro.value = s.still ? 1 : Math.min(1, U.intro.value + dt / 1.6); if (sp) sp.uniforms.intro.value = U.intro.value;
      let t = s.still ? 6 : T - t0 - 1.6;
      // taps: the question asks the next one; the specimen asks every chosen model about that spot
      const off = s.canvas.offsetTop, pb = pill.getBoundingClientRect(), cb = s.canvas.getBoundingClientRect();
      for (const c of s.clicks) {
        const px = c.x + cb.left, py = c.y + cb.top;
        if (px > pb.left && px < pb.right && py > pb.top && py < pb.bottom) { qi = (qi + 1) % F.questions.length; t0 = T - 1.6; t = s.still ? 6 : 0; motes.length = 0; continue; }
        ray.setFromCamera(new THREE.Vector2(c.x / W * 2 - 1, -(c.y / H) * 2 + 1), camera);
        const r = ray.ray.clone().applyMatrix4(world.matrixWorld.clone().invert());
        if (r.intersectPlane(plane, hit) && hit.length() < 1.1) {
          const lit = nodes.filter((n) => n.on > 0.5);
          if (s.still) {
            const L = spec.geometry.attributes.lit, Tn = spec.geometry.attributes.tint;
            for (let i = 0, k = 0; i < cells.length; i++) if (cellPos(i, v).distanceTo(hit) < 0.3) { const n = lit[k++ % Math.max(1, lit.length)]; if (n) { L.setX(i, 1); Tn.setXYZ(i, n.col.r, n.col.g, n.col.b); } }
          } else {
            lit.forEach((n) => { for (let k = 0; k < 9; k++) sendDown(n, hit.clone()); n.fire = 1; });
            ripple.position.set(hit.x, 0.01, hit.z); rippleT = 0;
          }
        }
      }
      if (t > DUR && !s.still) { qi = (qi + 1) % F.questions.length; t0 = T - 1.6; t = 0; }
      if (arranged !== qi) arrange(qi);
      const cur = F.questions[qi], chosen = Object.keys(cur.use), live = t > 0;
      section.dataset.plan = chosen.join(',');
      pill.classList.toggle('on', live);
      const qText = cur.q.slice(0, Math.round(clamp(t / 0.9, 0, 1) * cur.q.length));
      if (qText !== lastQ) { qt.textContent = qText; lastQ = qText; }
      const nc = chosen.filter((id) => E[id].where === 'cloud').length, nm = chosen.length;
      const sText = narrow ? `${nm} models · <b>${nm - nc} Mac</b> · <b class="c">${nc} cloud</b> · in parallel`
        : `${nm} models stacked · <b>${nm - nc} on your Mac</b> · <b class="c">${nc} in the cloud</b> · researchers in parallel`;
      if (sText !== lastS) { qs.innerHTML = sText; lastS = sText; }
      qs.classList.toggle('on', t > 1.2 && t < DUR - 0.8);
      // the plan: chosen models light and their curves grow
      const grow = clamp((t - 0.5) / 0.7, 0, 1), out = t > DUR - 1 ? Math.max(0, DUR - t) : 1;
      nodes.forEach((n, i) => {
        const want = chosen.includes(n.id) && t > 0.5 ? out : 0;
        if (!seeded && want) n.on = 1;
        n.on += (want - n.on) * (s.still ? 1 : Math.min(1, dt * 4)); n.fire *= Math.pow(0.9, dt * 60);
        nodeGeo.attributes.lit.setX(i, Math.min(1.6, n.on + n.fire * 0.6));
        n.line.geometry.setDrawRange(0, Math.round(61 * grow * (n.on > 0.05 ? 1 : 0))); n.line.material.opacity = 0.34 * n.on;
        const isOn = n.on > 0.5;
        if (isOn !== n.wasOn) { n.el.classList.toggle('on', isOn); n.wasOn = isOn; n.measured = false; }
        const why = cur.use[n.id] || '';
        if (why && why !== n.why) { n.el.querySelector('em').textContent = why; n.why = why; n.measured = false; }
        if (!s.still && n.on > 0.5 && t > 1.0 && t < DUR - 1.4 && Math.random() < dt * (narrow ? 4.5 : 3.5)) sendUp(n);
      });
      nodeGeo.attributes.lit.needsUpdate = true;
      if (!seeded && !s.still) {
        seeded = true;
        const L = spec.geometry.attributes.lit, Tn = spec.geometry.attributes.tint, lit = nodes.filter((n) => n.on > 0.5);
        lit.forEach((n) => { for (let k = 0; k < 7; k++) sendDown(n, null, Math.random() * 0.9); for (let k = 0; k < 2; k++) sendUp(n, Math.random() * 0.8); });
        for (let k = 0; k < 140; k++) { const i = Math.random() * cells.length | 0, n = lit[k % lit.length]; if (n) { L.setX(i, 0.4 + Math.random() * 0.6); Tn.setXYZ(i, n.col.r, n.col.g, n.col.b); } }
      }
      // motes: up to a model, then that model's light down into a cell
      const A = motesGeo.attributes; let w = 0;
      for (let k = motes.length - 1; k >= 0; k--) {
        const m = motes[k]; m.t += dt * m.sp;
        if (m.t >= 1) {
          motes.splice(k, 1);
          if (m.kind === 'up') { for (let j = 0; j < 3; j++) sendDown(m.n); }
          else { spec.geometry.attributes.lit.setX(m.cell, 1); spec.geometry.attributes.tint.setXYZ(m.cell, m.n.col.r, m.n.col.g, m.n.col.b); }
          continue;
        }
        const c = m.kind === 'up' ? PALE : m.n.col;
        for (let j = 0; j < TRAIL && w < MAX * TRAIL; j++, w++) {
          m.curve.getPoint(Math.max(0, m.t - j * 0.025), v);
          A.position.setXYZ(w, v.x, v.y, v.z); A.start.setXYZ(w, v.x, v.y, v.z);
          A.color.setXYZ(w, c.r, c.g, c.b); A.tint.setXYZ(w, c.r, c.g, c.b);
          A.size.setX(w, (m.kind === 'up' ? 30 : 38) * (1 - j * 0.3) * (narrow ? 1.2 : 1)); A.lit.setX(w, 0.6 - j * 0.2); A.seed.setX(w, 0);
        }
      }
      for (let j = w; j < MAX * TRAIL; j++) A.size.setX(j, 0);
      for (const key of ['position', 'start', 'color', 'tint', 'size', 'lit']) A[key].needsUpdate = true;
      const L = spec.geometry.attributes.lit, f = Math.pow(0.988, dt * 60);
      for (let i = 0; i < cells.length; i++) { const x = L.getX(i); if (x > 0.003) L.setX(i, x * f); }
      L.needsUpdate = true; spec.geometry.attributes.tint.needsUpdate = true;
      rippleT += dt; ripple.scale.setScalar(0.05 + rippleT * 0.7); ripple.material.opacity = Math.max(0, 0.55 - rippleT * 0.45);
      // a sideways drag turns the stage and lets it coast; otherwise it leans toward the pointer and sways
      if (s.dragX) yawV = s.dragX / W * 2.4 / Math.max(dt, 1 / 60);
      yaw += yawV * dt; yawV *= Math.pow(0.05, dt); yaw *= Math.pow(0.6, dt);
      const pmx = s.mx > -999 ? s.mx / W - 0.5 : 0, pmy = s.my > -999 ? s.my / H - 0.5 : 0;
      tilt.y += ((pmx * 0.3 + Math.sin(T * 0.12) * 0.08) - tilt.y) * Math.min(1, dt * 2.5);
      tilt.x += ((pmy * 0.06) - tilt.x) * Math.min(1, dt * 2.5);
      world.rotation.set(tilt.x, tilt.y + yaw, 0); world.updateMatrixWorld();
      if (sp) sp.uniforms.pointer.value.set(s.mx > -999 ? s.mx / W * 2 - 1 : 9, s.my > -999 ? -(s.my / H) * 2 + 1 : 9);
      // labels, the question and the specimen's tag follow the scene; labels never touch
      const items = [];
      const [qx, qy] = toScreen(Q, world, camera, W, H, v);
      pill.style.transform = `translate(${qx}px, ${qy + off}px) translate(-50%, -50%)`;
      const pw = pill.offsetWidth, ph = pill.offsetHeight;
      nodes.forEach((n) => {
        const [x, y] = toScreen(n.pos, world, camera, W, H, v), show = true;
        if (!n.measured) { n.lw = n.el.offsetWidth; n.lh = n.el.offsetHeight; n.measured = true; }
        if (show && x > 6 && x < W - 6) items.push({ n, x, y: y - 12 + off, w: n.lw, h: n.lh, z: n.on }); else n.el.style.opacity = '0';
      });
      items.sort((a, b) => b.z - a.z || a.x - b.x);
      keepApart(items, { l: narrow ? 4 : Math.max(4, wordsRight + 16), t: narrow ? freeTop + 2 : 70, r: W - 4, b: off + H - 4 }, [{ l: qx - pw / 2, t: qy + off - ph / 2, r: qx + pw / 2, b: qy + off + ph / 2 }]);
      for (const it of items) { it.n.el.style.opacity = it.hidden ? '0' : ''; it.n.el.style.transform = `translate(${it.left}px, ${it.top}px)`; }
      { const [x, y] = toScreen(new THREE.Vector3(0, 0, 1.16), world, camera, W, H, v); specEl.style.transform = `translate(${x}px, ${Math.min(y + 10, H - 22) + off}px) translate(-50%, 0)`; specEl.classList.add('on'); }
      if (s.still || Math.floor(T * 4) !== Math.floor((T - dt) * 4) || T < 0.1) drawWorkspace(cur, t);
      composer.render(dt);
    },
  });
}
