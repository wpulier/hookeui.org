// The harness map: lines from each harness into Hooke and from each catalog source into Hooke, drawn from where the
// chips actually sit (side by side on a laptop, stacked on a phone), with light travelling along them. Without this
// script the chips still read as two lists around Hooke.
const NS = 'http://www.w3.org/2000/svg';

export function startOpenMap(fig) {
  const svg = fig.querySelector('.open-lines'), core = fig.querySelector('.open-core');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function draw() {
    const f = fig.getBoundingClientRect(), c = core.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`); svg.innerHTML = '';
    const cx = c.left + c.width / 2 - f.left, cy = c.top + c.height / 2 - f.top;
    fig.querySelectorAll('li').forEach((li, i) => {
      const b = li.getBoundingClientRect(), x = b.left + b.width / 2 - f.left, y = b.top + b.height / 2 - f.top;
      const side = Math.abs(x - cx) > Math.abs(y - cy);
      // from the chip's edge nearest Hooke to Hooke's edge nearest the chip
      const [x0, y0] = side ? [x < cx ? b.right - f.left : b.left - f.left, y] : [x, y < cy ? b.bottom - f.top : b.top - f.top];
      const [x1, y1] = side ? [x < cx ? c.left - f.left : c.right - f.left, cy] : [cx, y < cy ? c.top - f.top : c.bottom - f.top];
      const d = side ? `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}` : `M${x0},${y0} C${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2} ${x1},${y1}`;
      const harness = li.dataset.k === 'h', col = harness ? '#f2c46d' : '#8cc2ff';
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('id', `open-p${i}`); path.setAttribute('class', `open-line ${harness ? 'h' : 'c'}`);
      svg.appendChild(path);
      for (let k = 0; k < 2; k++) {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', '3'); dot.setAttribute('fill', col); dot.setAttribute('class', 'open-dot');
        const m = document.createElementNS(NS, 'animateMotion');
        m.setAttribute('dur', `${2.2 + (i % 3) * 0.35}s`); m.setAttribute('repeatCount', 'indefinite'); m.setAttribute('begin', `${-(k * 1.1 + i * 0.37)}s`);
        const mp = document.createElementNS(NS, 'mpath'); mp.setAttribute('href', `#open-p${i}`);
        m.appendChild(mp); dot.appendChild(m); svg.appendChild(dot);
      }
    });
    if (still.matches) svg.pauseAnimations(); else svg.unpauseAnimations();
    fig.classList.add('drawn');
  }
  new ResizeObserver(draw).observe(fig);
  still.addEventListener('change', draw);
}
