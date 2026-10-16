# hookeui.org

The website for HookeUI. Plain HTML and CSS, a small script, and a three.js scene for the hero, served by GitHub Pages from
this repository's `main` branch at https://hookeui.org.

- `media/`: loops recorded in HookeUI on recordings from a real microscope; nothing is mocked up.
- `CLAIMS.md`: every factual sentence on the page with the evidence for it. A sentence without evidence is cut.
- `fonts/`: Inter (SIL Open Font License, `fonts/Inter-OFL.txt`).

## The hero's sky

`hero-scene.js` draws the hero with three.js (vendored in `vendor/`, MIT). Every star is a cell Cellpose-SAM found in a real
stained plant stem (`media/sky.json`, made from the app's saved result by `tools/build_sky.py`); constellations carry catalog entries' names, and "You"
is a researcher at a microscope drawn as one. Without WebGL 2 or script the hero shows a still of it
(`media/hero-scene.jpg`, `media/hero-scene-phone.jpg`). `?skyt=12` starts the scene 12 seconds in, for checking.
