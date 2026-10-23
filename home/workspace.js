// Chapter 3: the stem as a stack of layers, the image and then what each model made of it, all registered to each other.
// Move across to turn the stack, up and down to open it, point at a cell to thread it through every layer. The readout
// shows only what plate.json measured for that cell; the art is a drawing, the words are not.
import { stage, loadSky, loadPlate, artFailed, WARM, COOL, TAU, rgb, hexA, dot, clamp } from './stage.js';

const IMAGE = '#c8ccdc';
const TILT = 0.4;
// Each lens id draws in its own style and colour; the layer order and names come from entries.lenses.
const STYLE = {
  'cellpose-sam': { col: WARM[0], draw: 'outline' },
  'bioclip-2': { col: WARM[2], draw: 'groups' },
  trackastra: { col: WARM[3], draw: 'ticks' },
  'fiji-analyze-particles': { col: WARM[1], draw: 'bars' },
  'gemini-3.8-flash': { col: COOL[0], draw: 'dots' },
};
const GROUP = ['#ff8fb8', '#8fe3c0', '#b39bff', '#ffd27a'];
const num = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

export function startWorkspace(section, entries) {
  const names = entries.entries;
  const LAYERS = entries.lenses.map((l) => {
    const e = l.id ? names[l.id] : null, st = (l.id && STYLE[l.id]) || { col: e && e.where === 'cloud' ? COOL[0] : WARM[0], draw: 'dots' };
    const where = e ? (e.where === 'cloud' ? 'cloud' : 'on your Mac') : '';
    return { name: e ? e.name : l.name, sub: l.sub, where, col: l.id ? st.col : IMAGE, draw: l.id ? st.draw : 'image' };
  });
  const n = LAYERS.length;
  const box = document.getElementById('ws-pick'), words = section.querySelector('.words');
  let plate = null;
  loadPlate().then((p) => { plate = p; }, () => {}); // without plate.json the art still draws and the readout shows no measurements

  const start = ({ cells }) => {
    cells.forEach((c) => {
      c.pix = rgb(c.r, c.g, c.b, 0.5);
      c.group = (c.r > c.b ? 0 : 1) + (c.m > 0.5 ? 2 : 0);
      c.ph = Math.random() * TAU;
    });
    const L = { spread: 0.85, theta: -0.35 };
    let G = null, last = null;
    // Where the stack sits: wide puts it right of the words with labels to its right; narrow shrinks it to the canvas width.
    const layout = (s, ctx) => {
      const narrow = s.W <= 760;
      ctx.font = '600 12px Inter, system-ui'; let lw = 0;
      for (const ly of LAYERS) lw = Math.max(lw, ctx.measureText(ly.name).width, narrow ? ctx.measureText(ly.where || ly.sub).width : ctx.measureText(`${ly.sub}${ly.where ? ` · ${ly.where}` : ''}`).width);
      const padX = narrow ? 10 : 18;
      let S, cx;
      if (narrow) { S = Math.min((s.W - 26 - lw) / 3.5, s.H * 0.2); cx = 8 + 1.75 * S; }
      else { cx = s.W * 0.62; S = Math.min(s.W * 0.12, s.H * 0.27, (s.W - 12 - lw - padX - cx) / 1.9); }
      G = { S, cx, cy: s.H * (narrow ? 0.5 : 0.56), narrow, padX, maxGap: (s.H * 0.9 - 1.4 * S) / (n - 1) };
    };
    const proj = (x, y, k) => {
      const cs = Math.cos(L.theta), sn = Math.sin(L.theta), gap = Math.min(last.H * 0.085 * L.spread, G.maxGap);
      return [G.cx + (x * cs - y * sn) * G.S, G.cy + ((n - 1) / 2 - k) * gap + (x * sn + y * cs) * G.S * TILT * -1];
    };
    window.hookeHome = window.hookeHome || {};
    window.hookeHome.workspace = {
      // Page coordinates of cell i on the bottom layer.
      cellAt(i) { const r = section.querySelector('canvas.art').getBoundingClientRect(), [x, y] = proj(cells[i].x, cells[i].y, 0); return [r.left + x, r.top + y]; },
    };

    stage(section, {
      init(s, ctx) { last = s; layout(s, ctx); },
      frame(s, ctx, dt) {
        last = s;
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, s.W, s.H);
        const { S, cx } = G, here = s.mx > -999;
        // Which cell is pointed at: the nearest projection on any layer. While one is, the stack holds still so it can be read.
        let pick = null, pd = 22;
        if (here) for (let k = 0; k < n; k++) for (let i = 0; i < cells.length; i++) { const [x, y] = proj(cells[i].x, cells[i].y, k), d = Math.abs(x - s.mx) + Math.abs(y - s.my); if (d < pd) { pd = d; pick = i; } }
        if (pick === null) {
          const wantSpread = here ? 0.45 + (1 - s.my / s.H) * 1.1 : 0.85 + Math.sin(s.t * 0.6) * 0.12;
          const wantTheta = here ? -0.9 + (s.mx / s.W) * 1.4 : -0.35 + Math.sin(s.t * 0.15) * 0.35;
          const f = 1 - Math.pow(0.94, dt * 60); // per-second smoothing: a dt = 0 frame redraws without moving
          L.spread += (wantSpread - L.spread) * f; L.theta += (wantTheta - L.theta) * f;
        }
        for (let k = 0; k < n; k++) {
          const ly = LAYERS[k], [ox, oy] = proj(0, 0.15, k);
          ctx.fillStyle = 'rgba(14,17,30,0.55)'; ctx.strokeStyle = hexA(ly.col, 0.22); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(ox, oy, 1.75 * S, 1.75 * S * TILT, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          if (ly.draw === 'outline' || ly.draw === 'ticks' || ly.draw === 'bars') { ctx.strokeStyle = hexA(ly.col, ly.draw === 'outline' ? 0.45 : 0.5); ctx.beginPath(); }
          for (let i = 0; i < cells.length; i++) {
            const c = cells[i], [x, y] = proj(c.x, c.y, k);
            if (ly.draw === 'image') { ctx.fillStyle = c.pix; dot(ctx, x, y, 0.7 + c.m * 1.1); }
            else if (ly.draw === 'outline') { const r = 1.4 + c.m * 2.6; ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * TILT * 1.6, 0, 0, TAU); }
            else if (ly.draw === 'groups') { ctx.fillStyle = hexA(GROUP[c.group], 0.6); dot(ctx, x, y, 0.8 + c.m); }
            else if (ly.draw === 'ticks' && i % 2 === 0) { const a = c.ph + s.t * 0.4, [x2, y2] = proj(c.x + Math.cos(a) * 0.05, c.y + Math.sin(a) * 0.05, k); ctx.moveTo(x, y); ctx.lineTo(x2, y2); }
            else if (ly.draw === 'bars' && i % 3 === 0) { ctx.moveTo(x, y); ctx.lineTo(x, y - 2 - c.m * 12 * L.spread); }
            else if (ly.draw === 'dots' && i % 9 === 0) { ctx.fillStyle = hexA(ly.col, 0.35); dot(ctx, x, y, 1); }
          }
          if (ly.draw === 'outline' || ly.draw === 'ticks' || ly.draw === 'bars') ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          const lx = cx + 1.75 * S + G.padX;
          ctx.textAlign = 'left'; ctx.font = '600 12px Inter, system-ui'; ctx.fillStyle = hexA(ly.col, 0.9); ctx.fillText(ly.name, lx, oy);
          ctx.font = '10px Inter, system-ui'; ctx.fillStyle = 'rgba(140,146,170,0.85)';
          ctx.fillText(G.narrow ? (ly.where || ly.sub) : `${ly.sub}${ly.where ? ` · ${ly.where}` : ''}`, lx, oy + 14);
          ctx.strokeStyle = hexA(ly.col, 0.18); ctx.beginPath(); ctx.moveTo(ox + 1.75 * S, oy); ctx.lineTo(lx - 4, oy - 4); ctx.stroke();
        }
        if (pick === null) { box.style.display = 'none'; return; }
        const c = cells[pick], pts = LAYERS.map((_, k) => proj(c.x, c.y, k));
        ctx.strokeStyle = 'rgba(255,241,214,0.7)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[n - 1]); ctx.stroke(); ctx.setLineDash([]);
        pts.forEach(([x, y], k) => { ctx.strokeStyle = hexA(LAYERS[k].col, 0.95); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, 7, 7 * TILT * 1.6, 0, 0, TAU); ctx.stroke(); });
        ctx.lineWidth = 1;
        const m = plate && plate[pick], seg = names['cellpose-sam'].name;
        box.innerHTML = `<b>One cell, through every lens</b><br><span class="who">${seg}</span> outlined it` + (m
          ? `<br>area ${m.area} px · roundness ${num(m.round)} · elongation ${num(m.elong)}${m.edge ? '<br>cut by the edge of the view' : ''}<br><span class="dim">Sizes in pixels: no scale was set.</span>` : '');
        box.style.display = 'block';
        // Beside the pointer, kept inside the chapter and off the words.
        const cv = section.querySelector('canvas.art'), ox = cv.offsetLeft, oy = cv.offsetTop, bw = box.offsetWidth, bh = box.offsetHeight;
        let bx = s.mx + 18 + bw > s.W - 8 ? s.mx - 18 - bw : s.mx + 18, by = clamp(s.my + 14, 8, s.H - bh - 8);
        bx = clamp(bx, 8, s.W - bw - 8);
        const wr = { l: words.offsetLeft - ox, t: words.offsetTop - oy, r: words.offsetLeft - ox + words.offsetWidth, b: words.offsetTop - oy + words.offsetHeight };
        if (bx < wr.r && bx + bw > wr.l && by < wr.b && by + bh > wr.t) by = wr.b + 8;
        box.style.left = `${ox + bx}px`; box.style.top = `${oy + by}px`;
      },
    });
  };
  loadSky().then(start, () => artFailed(section));
}
