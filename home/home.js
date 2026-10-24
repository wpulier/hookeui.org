// The home page. Each chapter's art module is started from here.
if (location.hash === '#see') location.replace('story.html#see');
import { startFirst } from './first.js';
import { startResearchers } from './researchers.js';
import { startWorkspace } from './workspace.js';
import { startCapabilities } from './capabilities.js';

const $ = (id) => document.getElementById(id);
// Model names and plans live in one file that chapters 1, 3 and 4 share. Without it those chapters show their stills.
const entries = fetch('home/entries.json').then((r) => { if (!r.ok) throw new Error(`entries.json ${r.status}`); return r.json(); });
entries.then((e) => { startFirst($('ask'), e); startWorkspace($('workspace'), e); startCapabilities($('capabilities'), e); },
  () => ['ask', 'workspace', 'capabilities'].forEach((id) => $(id).classList.add('no-art')));
startResearchers($('researchers'));

// Later chapters' words rise in as they arrive. Only words still below the screen are hidden, and only when the browser
// can say when they arrive; coming back to the page (pageshow) shows any that were passed.
if ('IntersectionObserver' in window) {
  const later = [...document.querySelectorAll('.chapter:not(#ask) .words')].filter((w) => w.getBoundingClientRect().top > innerHeight);
  const show = (w) => w.classList.add('in');
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); seen.unobserve(e.target); } }), { threshold: 0 });
  later.forEach((w) => { w.classList.add('reveal'); seen.observe(w); });
  addEventListener('pageshow', () => later.forEach((w) => { if (w.getBoundingClientRect().top < innerHeight) show(w); }));
}

// A phone or tablet can't install a Mac app: Download becomes "Send to my Mac", which shares the download page's link
// (or copies it), so it can be opened on the Mac.
const handheld = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
if (handheld) {
  const url = new URL('download.html', location.href).href;
  document.querySelectorAll('a.button.primary[href="download.html"]').forEach((a) => {
    a.textContent = 'Send to my Mac';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        if (navigator.share) await navigator.share({ title: 'Hooke for Mac', text: 'Download Hooke on your Mac', url });
        else { await navigator.clipboard.writeText(url); a.textContent = 'Link copied'; setTimeout(() => { a.textContent = 'Send to my Mac'; }, 2200); }
      } catch (err) { if (err && err.name !== 'AbortError') location.href = url; }
    });
  });
  const note = $('dl-note');
  if (note) { note.textContent = 'Hooke is a Mac app.'; note.classList.add('send'); }
}

// The top bar is clear over the first screen and frosted once the page has moved.
const bar = document.querySelector('header.top');
const setBar = () => bar.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', setBar, { passive: true }); setBar();
