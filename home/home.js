// The home page. Each chapter's art module is started from here.
if (location.hash === '#see') location.replace('story.html#see');
import { startAsk } from './ask.js';
import { startResearchers } from './researchers.js';

// Model names and plans live in one file that chapters 1, 3 and 4 share. Without it those chapters show their stills.
const entries = fetch('home/entries.json').then((r) => { if (!r.ok) throw new Error(`entries.json ${r.status}`); return r.json(); });
entries.then((e) => startAsk(document.getElementById('ask'), e), () => document.getElementById('ask').classList.add('no-art'));
startResearchers(document.getElementById('researchers'));
