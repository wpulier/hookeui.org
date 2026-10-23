// What every three.js chapter shares: the renderer and its glow, the glowing-points shader, the rising spores, colour
// handling, fitting a camera to a part of the screen, and keeping HTML labels from touching.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';

export { THREE };
export const GOLD = new THREE.Color('#f2c46d'), BLUE = new THREE.Color('#8cc2ff'), PALE = new THREE.Color('#fff4dc');
// sky.json colours are sRGB; the pipeline works in linear light.
export const lin = (x) => Math.pow(x, 2.2);

export function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// The renderer, a soft glow that leaves dim things (words drawn into textures) alone, and the output in sRGB.
export function makeView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(new THREE.Color(0x04050b).convertSRGBToLinear(), 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.34, 0.34);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const size = (W, H, dpr) => {
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); composer.setPixelRatio(dpr); composer.setSize(W, H);
    bloom.resolution.set(W / 2, H / 2); camera.aspect = W / H;
  };
  return { renderer, scene, camera, composer, bloom, size };
}

// Glowing points. Attributes: position, start (where it flies in from), color, tint (what a hit turns it), size, lit
// (0..1), seed (staggers the fly-in). Uniforms: time, intro (0..1 fly-in), px (point scale).
export function pointsUniforms() { return { time: { value: 0 }, intro: { value: 0 }, px: { value: 1 } }; }
export function pointsMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 color; attribute vec3 tint; attribute vec3 start; attribute float size; attribute float lit; attribute float seed;
      uniform float time; uniform float intro; uniform float px;
      varying vec3 vColor; varying float vLit; varying float vA;
      void main() {
        float k = smoothstep(seed * 0.55, seed * 0.55 + 0.45, intro);
        vec3 p = mix(start, position, k);
        p.y += sin(time * 0.7 + seed * 40.0) * 0.006 * k;
        p.x += cos(time * 0.5 + seed * 70.0) * 0.004 * k;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * (1.0 + lit * 1.4) * px / -mv.z;
        gl_Position = projectionMatrix * mv;
        vColor = mix(color, tint, clamp(lit, 0.0, 1.0) * 0.75); vLit = lit; vA = k;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vLit; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = pow(smoothstep(0.5, 0.0, d), 1.7);
        gl_FragColor = vec4(vColor * (0.55 + vLit * 1.9), a * vA * (0.6 + vLit * 0.4));
      }`,
  });
}
export function pointsGeometry(n) {
  const g = new THREE.BufferGeometry();
  for (const [k, w] of Object.entries({ position: 3, start: 3, color: 3, tint: 3, size: 1, lit: 1, seed: 1 })) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * w), w));
  return g;
}

// A specimen's cells as glowing points on the plane y = 0, centred on the camera frame the cells were found in.
export const FRAME = { cx: -0.068, cy: 0.143, w: 2.972, h: 1.671 };
export function specimenPoints(sky, U, { scale = 1, sizeK = 1, scatter = true } = {}) {
  const { cells, dust } = sky, g = pointsGeometry(cells.length + dust.length), P = g.attributes;
  const put = (i, c, size, dim) => {
    P.position.setXYZ(i, (c.x - FRAME.cx) * scale, 0, -(c.y - FRAME.cy) * scale);
    if (scatter) P.start.setXYZ(i, (Math.random() - 0.5) * 5, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
    else P.start.setXYZ(i, (c.x - FRAME.cx) * scale, 0, -(c.y - FRAME.cy) * scale);
    const r = lin(c.r) * dim, gg = lin(c.g) * dim, b = lin(c.b) * dim;
    P.color.setXYZ(i, r, gg, b); P.tint.setXYZ(i, r, gg, b); P.size.setX(i, size * sizeK); P.seed.setX(i, Math.random());
  };
  cells.forEach((c, i) => put(i, c, 26 + c.m * 46, 1));
  dust.forEach((c, j) => put(cells.length + j, c, 12, 0.25));
  const pts = new THREE.Points(g, pointsMaterial(U));
  pts.userData.cellPos = (i, v = new THREE.Vector3()) => v.set((cells[i].x - FRAME.cx) * scale, 0, -(cells[i].y - FRAME.cy) * scale);
  return pts;
}

// Spores: motes rising slowly off a disc of radius r into the dark, parting around the pointer.
export function spores(n, colors, { r = 1.05, height = 2.6 } = {}) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(n), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) { seed[i] = Math.random(); const c = colors[Math.random() * colors.length | 0]; col.set([c.r, c.g, c.b], i * 3); size[i] = 6 + Math.random() * 16; }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const uniforms = { time: { value: 0 }, intro: { value: 0 }, px: { value: 1 }, pointer: { value: new THREE.Vector2(9, 9) }, aspect: { value: 1 }, R: { value: r }, Hgt: { value: height } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float seed; attribute vec3 color; attribute float size;
      uniform float time, intro, px, aspect, R, Hgt; uniform vec2 pointer;
      varying vec3 vC; varying float vA;
      void main() {
        float s1 = fract(seed * 13.7), s2 = fract(seed * 91.3), s3 = fract(seed * 47.1);
        float life = fract(time * 0.04 * (0.55 + s3) + seed);
        float r = sqrt(s1) * R, a = s2 * 6.2832 + time * 0.05 * (s3 - 0.5);
        vec3 p = vec3(cos(a) * r, life * Hgt, sin(a) * r);
        p.x += sin(time * 0.4 + seed * 30.0) * 0.14 * life; p.z += cos(time * 0.33 + seed * 20.0) * 0.14 * life;
        p.xz *= 1.0 + life * 0.7;
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        vec2 ndc = clip.xy / clip.w, d = ndc - pointer; d.x *= aspect;
        float dist = length(d), push = smoothstep(0.32, 0.0, dist) * 0.16;
        ndc += normalize(d + 1e-5) * push * vec2(1.0 / aspect, 1.0);
        clip.xy = ndc * clip.w;
        gl_Position = clip;
        gl_PointSize = size * px / clip.w;
        vC = color; vA = sin(life * 3.14159) * intro * (0.35 + push * 3.0);
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, pow(smoothstep(0.5, 0.0, d), 2.0) * vA); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return { pts, uniforms };
}

// Point the camera at target from elevation el and distance d, with the scene's centre drawn at the centre of rect.
export function aim(camera, target, el, d, rect, W, H, yaw = 0) {
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(el) * d, target.y + Math.sin(el) * d, target.z + Math.cos(yaw) * Math.cos(el) * d);
  camera.lookAt(target);
  camera.setViewOffset(W, H, W / 2 - (rect.x + rect.w / 2), H / 2 - (rect.y + rect.h / 2), W, H);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
}
// The nearest distance at which every point of bounds() falls inside rect (binary search; aim() is called each try).
export function fitDistance(place, bounds, camera, rect, W, H) {
  const v = new THREE.Vector3();
  const fits = (d) => { place(d); return bounds().every((b) => { v.copy(b).project(camera); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h; }); };
  let lo = 1, hi = 60;
  for (let k = 0; k < 26; k++) { const m = (lo + hi) / 2; fits(m) ? (hi = m) : (lo = m); }
  place(hi);
  return hi;
}
// A world point (in object's space) to canvas pixels.
export function toScreen(p, object, camera, W, H, out = new THREE.Vector3()) {
  out.copy(p); if (object) out.applyMatrix4(object.matrixWorld); out.project(camera);
  return [(out.x + 1) / 2 * W, (1 - out.y) / 2 * H, out.z];
}
// Labels anchored at [x, y] (bottom centre) are lifted until none touches another, in the order given.
export function keepApart(items, gap = 3) {
  const placed = [];
  for (const it of items) {
    const w = it.w, h = it.h; let x = it.x - w / 2, y = it.y - h;
    for (let pass = 0; pass < 12; pass++) {
      const hit = placed.find((p) => x < p.x + p.w + gap && x + w + gap > p.x && y < p.y + p.h + gap && y + h + gap > p.y);
      if (!hit) break;
      y = hit.y - h - gap;
    }
    placed.push({ x, y, w, h }); it.left = x; it.top = y;
  }
}
