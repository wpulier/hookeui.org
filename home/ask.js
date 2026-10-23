// Chapter 1: ask once. A question is typed in, split into a plan of steps (each a model or algorithm, on your Mac or in
// the cloud), light flows through each step into the specimen, then the answer is typed under it. The answers say what
// comes back, never numbers. Names and where each runs come from entries.json.
import { stage, loadSky, artFailed, WARM, COOL, TAU, rnd, clamp, rgb, hexA, dot, glow } from './stage.js';

const DUR = 11;
const cubic = (p, t) => { const u = 1 - t; return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]]; };

// A path through points, rounded at the corners, as a function of u in [0, 1].
function route(pts) {
  for (let r = 0; r < 3; r++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); pts = o; }
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return (u) => { const d = clamp(u, 0, 1) * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; };
}

export function startAsk(section, entries) {
  const { entries: names, ask: QUESTIONS } = entries;
  const qEl = document.getElementById('ask-q'), aEl = document.getElementById('ask-a');
  const start = ({ cells }) => {
    const Q = { i: 0, t0: 0, motes: [], lit: new Float32Array(cells.length), litCol: new Array(cells.length) };
    const colOf = (id, k) => (names[id].where === 'cloud' ? COOL[k % COOL.length] : WARM[k % WARM.length]);
    const setPlan = () => { section.dataset.plan = QUESTIONS[Q.i].plan.map((p) => p[0]).join(','); };
    const next = (s) => {
      Q.i = (Q.i + 1) % QUESTIONS.length; Q.t0 = s.t; Q.motes = []; Q.lit.fill(0); setPlan();
      if (s.still) QUESTIONS[Q.i].plan.forEach((_, k) => { for (let i = k % 4; i < cells.length; i += 16) { Q.lit[i] = 1; Q.litCol[i] = colOf(QUESTIONS[Q.i].plan[k][0], k); } });
    };
    setPlan();
    let first = true;
    stage(section, {
      init() {},
      frame(s, ctx, dt) {
        const narrow = s.W <= 760;
        if (first) { first = false; if (s.still) { Q.i = QUESTIONS.length - 1; next(s); } }
        if (s.clicks.length) next(s);
        // Reduced motion shows the finished state of a question; a click still moves to the next one.
        let t = s.still ? 9.5 : s.t - Q.t0;
        if (t > DUR) { next(s); t = 0; }
        const cur = QUESTIONS[Q.i], plan = cur.plan;
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, s.W, s.H);
        const out = t > DUR - 0.9 ? Math.max(0, (DUR - t) / 0.9) : 1;
        // the question, typed; it sits bottom left beside the words (wide) or at the top of the canvas (narrow)
        const cv = section.querySelector('canvas.art'), top = cv.offsetTop, left = cv.offsetLeft;
        qEl.textContent = cur.q.slice(0, Math.round(clamp(t / 1.6, 0, 1) * cur.q.length)); qEl.style.opacity = out;
        if (narrow) { qEl.style.left = '16px'; qEl.style.right = '16px'; qEl.style.top = `${top + 8}px`; qEl.style.bottom = 'auto'; } else { qEl.style.left = '5vw'; qEl.style.right = 'auto'; qEl.style.top = 'auto'; qEl.style.bottom = '8vh'; }
        const qr = qEl.getBoundingClientRect(), cr = cv.getBoundingClientRect();
        const qx = narrow ? 24 : qr.right - cr.left + 10, qy = narrow ? qr.bottom - cr.top + 2 : qr.top - cr.top + qr.height / 2;
        // the specimen: right of the steps (wide) or at the bottom under them (narrow)
        const R = narrow ? Math.min(s.H * 0.1, s.W * 0.16) : Math.min(s.H * 0.21, s.W * 0.13), sc = R / 1.5, ds = clamp(R / 140, 0.3, 1);
        const sx = narrow ? s.W / 2 : s.W * 0.82, sy = narrow ? s.H - R - 92 : s.H * 0.56;
        ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fillStyle = '#080a14'; ctx.fill(); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        cells.forEach((c, i) => {
          const x = sx + c.x * sc, y = sy - (c.y - 0.15) * sc;
          ctx.fillStyle = rgb(c.r, c.g, c.b, 0.3 * out * (0.5 + 0.5 * ds)); dot(ctx, x, y, (0.6 + c.m * 0.9) * ds);
          if (Q.lit[i] > 0.01 && (ds > 0.6 || i % 3 === 0)) { ctx.strokeStyle = hexA(Q.litCol[i], Q.lit[i] * 0.8 * out * (0.4 + 0.6 * ds)); ctx.lineWidth = Math.max(0.6, ds); ctx.beginPath(); ctx.arc(x, y, (1.6 + c.m * 2) * ds, 0, TAU); ctx.stroke(); ctx.lineWidth = 1; }
        });
        ctx.restore();
        ctx.strokeStyle = `rgba(200,204,220,${0.3 * out})`; ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.stroke();
        // the plan: a step per model, its branch from the question and its branch into the specimen
        const grow = clamp((t - 1.8) / 1.1, 0, 1), flow = t > 2.9 && t < 8.2, n = plan.length;
        const y0 = narrow ? qy + 26 : s.H * 0.36, y1 = narrow ? sy - R - 16 : s.H * 0.86;
        ctx.font = '600 12px Inter, system-ui'; const nameW = (txt) => ctx.measureText(txt).width;
        ctx.font = '11px Inter, system-ui'; const whyW = (txt) => ctx.measureText(txt).width;
        const nodes = plan.map(([id, why], k) => {
          const cloud = names[id].where === 'cloud', col = colOf(id, k), sub = `${why} · ${cloud ? 'cloud' : 'on your Mac'}`;
          const nx = narrow ? 40 : s.W * 0.5, ny = y0 + k * ((y1 - y0) / (n - 1));
          const a = narrow ? [qx, qy, qx, (qy + ny) / 2, qx + 2, ny, nx - 8, ny] : [qx, qy, qx + (nx - qx) * 0.5, qy, qx + (nx - qx) * 0.5, ny, nx - 8, ny];
          const right = nx + 14 + Math.max(nameW(names[id].name), whyW(sub));
          return { name: names[id].name, sub, cloud, col, nx, ny, a, right, hot: Math.hypot(s.mx - nx - (narrow ? 60 : 0), s.my - ny) < (narrow ? 26 : 60), fa: (u) => cubic(a, u) };
        });
        // The second leg never crosses step text. Narrow: it leaves the label's right end, runs down a lane right of every label, then into the disc.
        // Wide: the text sits on the side of the line away from the leg's bend (above for steps over the disc's middle, below for steps under it).
        const lane0 = Math.min(s.W - 6 - n * 8, Math.max(...nodes.map((q) => q.right)) + 10);
        nodes.forEach((q, k) => {
          if (narrow) {
            const lane = lane0 + (n - 1 - k) * 8, th = Math.PI * (0.12 + 0.2 * k), ex = sx + R * Math.cos(th), ey = sy - R * Math.sin(th);
            q.fb = route([[q.right + 8, q.ny], [lane, q.ny], [lane, y1 + 24 + k * 3], [ex, ey]]);
          } else {
            const ex = sx - R * Math.cos(Math.asin(clamp((q.ny - sy) * 0.5 / R, -0.9, 0.9))), ey = sy + (q.ny - sy) * 0.5, bx = q.nx + 8;
            const b = [bx, q.ny, bx + (ex - bx) * 0.5, q.ny, bx + (ex - bx) * 0.5, ey, ex, ey]; q.fb = (u) => cubic(b, u); q.above = q.ny < sy;
          }
        });
        const anyHot = nodes.some((q) => q.hot);
        nodes.forEach((q, k) => {
          const dim = anyHot && !q.hot ? 0.3 : 1, al = out * dim;
          ctx.strokeStyle = hexA(q.col, 0.35 * al); ctx.lineWidth = q.hot ? 1.6 : 1;
          ctx.beginPath(); for (let i = 0; i <= 40; i++) { const tt = i / 40 * grow, [x, y] = q.fa(tt); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
          if (grow >= 1) { const g2 = clamp((t - 2.9) / 0.8, 0, 1); ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = q.fb(i / 40 * g2); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
          ctx.lineWidth = 1;
          if (grow > k / n) {
            ctx.globalCompositeOperation = 'lighter'; glow(ctx, q.nx, q.ny, q.hot ? 26 : 16, q.col, 0.5 * al); ctx.fillStyle = hexA(q.col, al); dot(ctx, q.nx, q.ny, 3.2);
            ctx.globalCompositeOperation = 'source-over'; ctx.textAlign = 'left';
            const ty = narrow ? q.ny : q.above ? q.ny - 15 : q.ny + 15;
            ctx.font = '600 12px Inter, system-ui'; ctx.fillStyle = hexA(q.col, 0.95 * al); ctx.fillText(q.name, q.nx + 14, ty - 4);
            ctx.font = '11px Inter, system-ui'; ctx.fillStyle = `rgba(185,189,204,${0.85 * al})`; ctx.fillText(q.sub, q.nx + 14, ty + 11);
          }
          if (flow && Math.random() < dt * (q.hot ? 26 : 12)) Q.motes.push({ k, u: 0, sp: rnd(0.55, 0.8) });
        });
        // light through the plan
        ctx.globalCompositeOperation = 'lighter';
        Q.motes = Q.motes.filter((m) => {
          m.u += dt * m.sp; const q = nodes[m.k]; if (!q) return false;
          if (m.u >= 2) { for (let c = 0; c < 4; c++) { const i = (Math.random() * cells.length / 4 | 0) * 4 + m.k % 4; if (i < cells.length) { Q.lit[i] = 1; Q.litCol[i] = q.col; } } return false; }
          for (let j = 0; j < 4; j++) { const u = Math.max(0, m.u - j * 0.025), [x, y] = u < 1 ? q.fa(u) : q.fb(u - 1); ctx.fillStyle = hexA(q.col, (0.85 - j * 0.2) * out); dot(ctx, x, y, 1.7 - j * 0.3); }
          return true;
        });
        ctx.globalCompositeOperation = 'source-over';
        if (t > 8.2) for (let i = 0; i < Q.lit.length; i++) if (Q.lit[i] > 0) Q.lit[i] *= Math.pow(0.995, dt * 60);
        // what comes back, under the specimen
        const at = clamp((t - 7.6) / 1.6, 0, 1);
        aEl.textContent = cur.a.slice(0, Math.round(at * cur.a.length)); aEl.style.opacity = at > 0 ? out : 0;
        const aw = aEl.offsetWidth;
        aEl.style.left = `${left + clamp(sx - aw / 2, 8, s.W - aw - 8)}px`; aEl.style.top = `${top + sy + R + 14}px`;
      },
    });
  };
  loadSky().then(start, () => artFailed(section));
}
