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

// Each chapter's words rise in as the chapter arrives (at once with reduced motion, by CSS).
const words = document.querySelectorAll('.chapter .words');
words.forEach((w) => w.classList.add('reveal'));
const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } }), { threshold: 0.2 });
words.forEach((w) => seen.observe(w));

// The top bar is clear over the first screen and frosted once the page has moved.
const bar = document.querySelector('header.top');
const setBar = () => bar.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', setBar, { passive: true }); setBar();
