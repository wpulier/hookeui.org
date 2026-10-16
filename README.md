# hookeui.org

The website for HookeUI. Plain HTML and CSS, a small script, and a three.js scene for the hero, served by GitHub Pages from
this repository's `main` branch at https://hookeui.org.

- `media/`: loops recorded in HookeUI on recordings from a real microscope; nothing is mocked up.
- `CLAIMS.md`: every factual sentence on the page with the evidence for it. A sentence without evidence is cut.
- `fonts/`: Inter (SIL Open Font License, `fonts/Inter-OFL.txt`).

## The hero's sky

`hero-scene.js` draws the hero with three.js (vendored in `vendor/`, MIT). Every star is a cell Cellpose-SAM found in a real
stained plant stem (`media/sky.json`, made from the app's saved result by `tools/build_sky.py`); constellations carry catalog entries' names, and "You"
is a researcher at her microscope made of stars, from a public-domain USDA photograph of Ruth Colvin Starrett
(outlined with EdgeTAM by `tools/cut_figure.py`, turned into points by `tools/build_you.py`, `media/you.json`). Without WebGL 2 or script the hero shows a still of it
(`media/hero-scene.jpg`, `media/hero-scene-phone.jpg`). Over the sky the pointer is an eyepiece (the real capture, `media/sky-photo.jpg`, and Cellpose-SAM's outlines, `media/sky-outlines.png`), and a click calls a catalog entry as a new constellation. `?skyt=12` starts the scene 12 seconds in, for checking.

## Below the hero: a day at the microscope

The night lightens into a dawn (the three beats), then morning: a plate of the same stem's 1,523 cells drawn in ink from the
app's saved result (`media/plate.json`, made by `tools/build_plate.py`; pointing at a cell gives what the app measured), set
against Hooke's cork of 1665, with the open-source commitments under it. Five numbered observations follow, as Hooke numbered
his. The page then turns to dusk, where the catalog is a star atlas with each entry's makers, and ends in night with Install.
The plate and the constellations are drawn by `site.js`; with reduced motion the plate is drawn at once and nothing twinkles.
