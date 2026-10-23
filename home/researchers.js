// Chapter 2: a dataset as a field of eyepieces. Two swarms of researchers, gold from your Mac and blue from the cloud,
// spread across it; each specimen lights up as it is worked on.
import { stage, loadSky, artFailed, WARM, COOL, TAU, rnd, rgb, hexA, dot, fade } from './stage.js';

function sprite(cells, lit, px) {
  const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d');
  g.save(); g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 1, 0, TAU); g.clip();
  const sc = px / 3.2;
  for (const p of cells) { g.fillStyle = lit ? rgb(p.r, p.g, p.b, 0.75) : 'rgba(120,128,160,0.45)'; dot(g, px / 2 + p.x * sc, px / 2 - p.y * sc + px * 0.06, lit ? 0.6 + p.m * 1.1 : 0.5 + p.m * 0.6); }
  g.restore();
  g.strokeStyle = lit ? 'rgba(255,255,255,0.35)' : 'rgba(120,128,160,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 1, 0, TAU); g.stroke();
  return c;
}

export function startResearchers(section) {
  loadSky().then(({ cells }) => {
    const DIM = sprite(cells, false, 160), LIT = sprite(cells, true, 160);
    let C = {};
    stage(section, {
      init(s) {
        const top = 64, cols = Math.max(4, Math.round(s.W / 96)), rows = Math.max(4, Math.round((s.H - top) / 96)), cw = s.W / cols, ch = (s.H - top) / rows, d = Math.min(cw, ch) * 0.7;
        const tiles = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) tiles.push({ x: (i + 0.5) * cw, y: top + (j + 0.5) * ch, d, rot: rnd(0, TAU), prog: 0, by: null, claimed: false });
        const agents = [], total = Math.min(62, Math.round(tiles.length * 1.1)), warm = Math.round(total * 22 / 62);
        for (let k = 0; k < warm; k++) agents.push({ x: rnd(0, 40), y: s.H - rnd(0, 40), vx: 0, vy: 0, cloud: false, col: WARM[k % WARM.length], tile: null, orbit: rnd(0, TAU), speed: 0.55 });
        for (let k = 0; k < total - warm; k++) agents.push({ x: s.W - rnd(0, 40), y: rnd(0, 40), vx: 0, vy: 0, cloud: true, col: COOL[k % COOL.length], tile: null, orbit: rnd(0, TAU), speed: 0.75 });
        C = { tiles, agents, reset: 0 };
      },
      frame(s, ctx, dt) {
        fade(ctx, s, 0.3);
        for (const t of C.tiles) {
          ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot);
          ctx.globalAlpha = 0.35; ctx.drawImage(DIM, -t.d / 2, -t.d / 2, t.d, t.d);
          if (t.prog > 0) { ctx.globalAlpha = Math.min(1, t.prog) * 0.8; ctx.drawImage(LIT, -t.d / 2, -t.d / 2, t.d, t.d); }
          ctx.restore();
          if (t.prog >= 1 && t.by) { ctx.strokeStyle = hexA(t.by, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(t.x, t.y, t.d / 2 + 2, 0, TAU); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
        // Wide: the words sit over the lower left, so a veil keeps the tiles clear of them. Narrow: the canvas is below the words.
        if (s.W > 760) {
          const veil = ctx.createRadialGradient(0, s.H, 0, 0, s.H, s.W * 0.5); veil.addColorStop(0, 'rgba(4,5,11,0.97)'); veil.addColorStop(0.6, 'rgba(4,5,11,0.9)'); veil.addColorStop(1, 'rgba(4,5,11,0)');
          ctx.fillStyle = veil; ctx.fillRect(0, 0, s.W * 0.6, s.H);
        }
        ctx.globalCompositeOperation = 'lighter';
        const free = () => C.tiles.filter((t) => !t.claimed && t.prog < 1);
        for (const a of C.agents) {
          if (!a.tile) {
            const f = free();
            if (f.length) { let best = null, bd = 1e18; for (let n = 0; n < 6; n++) { const t = f[Math.random() * f.length | 0], dd = (t.x - a.x) ** 2 + (t.y - a.y) ** 2; if (dd < bd) { bd = dd; best = t; } } a.tile = best; best.claimed = true; }
          }
          // With no tile to work on, an agent circles near its corner instead of piling up there.
          a.orbit += dt * 1.5; const rr = 14 + (a.col.charCodeAt(2) % 5) * 7;
          let tx = (a.cloud ? s.W - 40 : 40) + Math.cos(a.orbit) * rr, ty = (a.cloud ? 40 : s.H - 40) + Math.sin(a.orbit) * rr;
          if (a.tile) {
            const t = a.tile, dd = Math.hypot(t.x - a.x, t.y - a.y);
            if (dd < t.d * 0.7) { a.orbit += dt * 5; t.prog += dt * (a.cloud ? 0.32 : 0.4); t.by = a.col; if (t.prog >= 1) { t.prog = 1; a.tile = null; } }
            tx = t.x + Math.cos(a.orbit) * t.d * 0.42; ty = t.y + Math.sin(a.orbit) * t.d * 0.42;
          }
          if (Math.hypot(s.mx - a.x, s.my - a.y) < 160) { tx = tx * 0.6 + s.mx * 0.4; ty = ty * 0.6 + s.my * 0.4; }
          const dx = tx - a.x, dy = ty - a.y, dl = Math.hypot(dx, dy) + 1e-3;
          const k = dt * 60, damp = Math.pow(0.9, k); // per-second motion, so a dt = 0 frame (reduced motion) redraws without moving
          a.vx += dx / dl * a.speed * k; a.vy += dy / dl * a.speed * k; a.vx *= damp; a.vy *= damp; a.x += a.vx * k; a.y += a.vy * k;
          ctx.fillStyle = hexA(a.col, 0.95); dot(ctx, a.x, a.y, 1.8);
          ctx.fillStyle = hexA(a.col, 0.12); dot(ctx, a.x, a.y, 6);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = '600 11px Inter, system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = hexA(WARM[0], 0.85); ctx.fillText('YOUR MAC', 18, s.H * 0.7 - 8);
        ctx.textAlign = 'right'; ctx.fillStyle = hexA(COOL[0], 0.85); ctx.fillText('CLOUD', s.W - 18, 82);
        // Everything done: rest a moment, then start the dataset again.
        if (C.tiles.every((t) => t.prog >= 1)) { C.reset += dt; if (C.reset > 2.5) { C.tiles.forEach((t) => { t.prog = 0; t.by = null; t.claimed = false; }); C.reset = 0; } }
      },
    });
  }).catch(() => artFailed(section));
}
