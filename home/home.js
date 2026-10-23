// The home page. Each chapter's art module is started from here.
if (location.hash === '#see') location.replace('story.html#see');
import { startResearchers } from './researchers.js';

startResearchers(document.getElementById('researchers'));
