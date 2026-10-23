// Chapter 2, Researchers: a dataset as a field of eyepieces receding into the dark. Two swarms of researchers, warm from
// your Mac and cool from the cloud, claim specimens, circle them as they work and light them; the pointer pulls them.
import { THREE, GOLD, BLUE, webgl, makeView, pointsUniforms, pointsMaterial, pointsGeometry, aim, toScreen } from './gl.js';
import { stage, loadSky, artFailed, rnd } from './stage.js';

export function startResearchers(section) {
  if (!webgl()) return artFailed(section);
  loadSky().then((sky) => build(section, sky), () => artFailed(section));
}

// One picture of the stem's cells in a disc, used by every eyepiece.
function stemSprite(cells) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), sc = 256 / 3.1;
  g.beginPath(); g.arc(128, 128, 126, 0, 7); g.clip();
  for (const p of cells) { g.fillStyle = `rgba(${p.r * 255 | 0},${p.g * 255 | 0},${p.b * 255 | 0},0.9)`; g.beginPath(); g.arc(128 + (p.x + 0.068) * sc, 128 - (p.y - 0.143) * sc, 0.9 + p.m * 1.7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function build(section, sky) {
  const view = makeView(section.querySelector('canvas.art'));
  const { scene, camera, composer } = view;
  const U = pointsUniforms(); U.intro.value = 1;
  const tex = stemSprite(sky.cells);
  const tags = ['YOUR MAC', 'CLOUD'].map((t, i) => { const el = document.createElement('div'); el.className = `res-tag ${i ? 'cloud' : 'mac'}`; el.textContent = t; section.appendChild(el); return el; });
  let field = null, tiles = [], agents = [], agentsGeo = null, agentsPts = null, reset = 0, cols = 0, rows = 0, W = 1, H = 1, narrow = false;
  const SP = 1.0, TRAIL = 4;

  const tileMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, far: { value: 10 } }, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 offset; attribute float prog; attribute vec3 tint; attribute float rot;
      varying vec2 vUv; varying float vProg; varying vec3 vTint; varying float vDepth;
      void main() {
        vUv = uv; vProg = prog; vTint = tint;
        float c = cos(rot), s = sin(rot);
        vec3 p = vec3(position.x * c - position.y * s, 0.0, -(position.x * s + position.y * c)) + offset;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float far;
      varying vec2 vUv; varying float vProg; varying vec3 vTint; varying float vDepth;
      void main() {
        float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
        vec4 t = texture2D(map, vUv);
        vec3 dim = vec3(dot(t.rgb, vec3(0.3, 0.5, 0.2))) * vec3(0.07, 0.08, 0.12);
        vec3 col = mix(dim, t.rgb * 0.55, vProg) * t.a;
        float ring = smoothstep(0.9, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        col += ring * mix(vec3(0.07, 0.08, 0.12), vTint * 0.75, vProg);
        float fade = 1.0 - smoothstep(far * 0.55, far, vDepth);
        gl_FragColor = vec4(col, (0.3 + 0.7 * max(t.a, ring)) * fade);
      }`,
  });

  function layout(s) {
    W = s.W; H = s.H; narrow = W < 761;
    view.size(W, H, s.dpr); U.px.value = s.dpr * H / 900 * (narrow ? 1.3 : 1);
    cols = narrow ? 6 : 15; rows = narrow ? 10 : 14;
    const n = cols * rows, old = tiles;
    tiles = Array.from({ length: n }, (_, i) => ({ x: (i % cols - (cols - 1) / 2) * SP, z: (Math.floor(i / cols) - (rows - 1) / 2) * SP, prog: old[i] ? old[i].prog : 0, tint: old[i] ? old[i].tint : GOLD, claimed: false }));
    if (field) { scene.remove(field); field.geometry.dispose(); }
    const base = new THREE.PlaneGeometry(SP * 0.82, SP * 0.82), g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(tiles.flatMap((t) => [t.x, 0, t.z])), 3));
    g.setAttribute('prog', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute('tint', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('rot', new THREE.InstancedBufferAttribute(new Float32Array(tiles.map(() => rnd(0, 6.283))), 1));
    g.instanceCount = n;
    field = new THREE.Mesh(g, tileMat); field.frustumCulled = false; scene.add(field);
    // researchers: about one per specimen, split as warm 22 to cool 40
    const count = Math.min(110, Math.round(n * 0.8)), warm = Math.round(count * 22 / 62);
    const ox = (cols / 2 + 0.6) * SP, oz = (rows / 2 + 0.6) * SP;
    agents = Array.from({ length: count }, (_, k) => {
      const mac = k < warm, x = mac ? -ox + rnd(-0.3, 0.3) : ox + rnd(-0.3, 0.3), z = mac ? oz + rnd(-0.3, 0.3) : -oz + rnd(-0.3, 0.3);
      return { mac, col: mac ? GOLD : BLUE, x, z, vx: 0, vz: 0, home: [x, z], tile: null, orbit: rnd(0, 6.283), speed: mac ? 1.7 : 2.3, trail: Array.from({ length: TRAIL }, () => [x, z]) };
    });
    if (agentsPts) { scene.remove(agentsPts); agentsGeo.dispose(); }
    agentsGeo = pointsGeometry(count * TRAIL);
    agentsPts = new THREE.Points(agentsGeo, pointsMaterial(U)); agentsPts.frustumCulled = false; scene.add(agentsPts);
    // the camera looks across the field from its near edge, the far rows fading into the dark
    const span = Math.max(cols, rows * (W / H)) * SP;
    const d = narrow ? rows * SP * 1.25 : span * 0.82;
    tileMat.uniforms.far.value = d * 1.9;
    aim(camera, new THREE.Vector3(narrow ? 0 : SP * 1.5, 0, narrow ? -0.5 : -0.8), narrow ? 0.95 : 0.62, d, { x: 0, y: 0, w: W, h: H }, W, H);
  }

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), v = new THREE.Vector3();
  stage(section, {
    init: layout,
    frame(s, dt) {
      U.time.value = s.t;
      const k = dt * 60;
      let pull = null;
      if (s.mx > -999) { ray.setFromCamera(new THREE.Vector2(s.mx / W * 2 - 1, -(s.my / H) * 2 + 1), camera); if (ray.ray.intersectPlane(plane, hit)) pull = hit.clone(); }
      const free = () => tiles.filter((t) => !t.claimed && t.prog < 1);
      const A = agentsGeo.attributes;
      agents.forEach((a, i) => {
        if (!a.tile) {
          const f = free();
          if (f.length) { let best = null, bd = 1e9; for (let n = 0; n < 6; n++) { const t = f[Math.random() * f.length | 0], dd = (t.x - a.x) ** 2 + (t.z - a.z) ** 2; if (dd < bd) { bd = dd; best = t; } } a.tile = best; best.claimed = true; }
        }
        let tx = a.home[0] + Math.cos(s.t * 0.7 + i) * 0.4, tz = a.home[1] + Math.sin(s.t * 0.7 + i) * 0.4;
        if (a.tile) {
          const t = a.tile;
          a.orbit += dt * 4.5;
          tx = t.x + Math.cos(a.orbit) * 0.36 * SP; tz = t.z + Math.sin(a.orbit) * 0.36 * SP;
          if (Math.hypot(t.x - a.x, t.z - a.z) < 0.6 * SP) { t.prog = Math.min(1, t.prog + dt * (a.mac ? 0.16 : 0.12)); t.tint = a.col; if (t.prog >= 1) a.tile = null; }
        }
        if (pull && Math.hypot(pull.x - a.x, pull.z - a.z) < 2.6 * SP) { tx = tx * 0.55 + pull.x * 0.45; tz = tz * 0.55 + pull.z * 0.45; }
        const dx = tx - a.x, dz = tz - a.z, dl = Math.hypot(dx, dz) + 1e-3;
        a.vx += dx / dl * a.speed * 0.0035 * k; a.vz += dz / dl * a.speed * 0.0035 * k;
        const damp = Math.pow(0.9, k); a.vx *= damp; a.vz *= damp; a.x += a.vx * k; a.z += a.vz * k;
        if (k > 0) { a.trail.pop(); a.trail.unshift([a.x, a.z]); }
        a.trail.forEach(([x, z], j) => {
          const w = i * TRAIL + j;
          A.position.setXYZ(w, x, 0.1, z); A.start.setXYZ(w, x, 0.1, z);
          A.color.setXYZ(w, a.col.r, a.col.g, a.col.b); A.tint.setXYZ(w, a.col.r, a.col.g, a.col.b);
          A.size.setX(w, (narrow ? 70 : 64) * (1 - j * 0.2)); A.lit.setX(w, 0.9 - j * 0.18); A.seed.setX(w, 0);
        });
      });
      for (const key of ['position', 'start', 'color', 'tint', 'size', 'lit']) A[key].needsUpdate = true;
      const P = field.geometry.attributes.prog, Tn = field.geometry.attributes.tint;
      tiles.forEach((t, i) => { P.setX(i, t.prog); Tn.setXYZ(i, t.tint.r, t.tint.g, t.tint.b); });
      P.needsUpdate = Tn.needsUpdate = true;
      if (tiles.every((t) => t.prog >= 1)) { reset += dt; if (reset > 2.5) { tiles.forEach((t) => { t.prog = 0; t.claimed = false; }); reset = 0; } }
      // the swarms' corners, named, kept on screen
      const ox = (cols / 2 + 0.6) * SP, oz = (rows / 2 + 0.6) * SP;
      [[-ox, oz], [ox, -oz]].forEach(([x, z], i) => {
        let [px, py] = toScreen(new THREE.Vector3(x, 0, z), null, camera, W, H, v);
        px = Math.max(16, Math.min(W - 80, px)); py = Math.max(80, Math.min(H - 30, py)) + s.canvas.offsetTop;
        tags[i].style.transform = `translate(${px}px, ${py}px)`;
      });
      composer.render(dt);
    },
  });
}
