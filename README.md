# hookeui.org

The website for HookeUI. Plain HTML and CSS, small scripts, and three.js scenes for the home page's four chapters and the
story page's hero, served by GitHub Pages from
this repository's `main` branch at https://hookeui.org.

- `media/`: loops recorded in HookeUI on recordings from a real microscope; nothing is mocked up.
- `CLAIMS.md`: every factual sentence on the page with the evidence for it. A sentence without evidence is cut.
- `fonts/`: Inter (SIL Open Font License, `fonts/Inter-OFL.txt`).
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` and the link card `media/og.jpg` (1200 × 630): Hooke's mark, cork
  cells as Hooke drew them in *Micrographia* (Observation XVIII) seen through an eyepiece, one lit gold. Our own drawing,
  nothing traced; made by `brand/src/build_brand.py` in the app's repository, where `brand/README.md` lists every size.

## Updating the site

There is no build step: what is in `main` is the site. GitHub Pages publishes `main` to https://hookeui.org about a minute
after each change.

1. Get the code and make a branch:
   ```bash
   git clone https://github.com/wpulier/hookeui.org
   cd hookeui.org
   git switch -c my-change
   ```
2. Edit what you need:

   | To change | Edit |
   |---|---|
   | Words and sections of the story page | `story.html` |
   | Words and sections of the home page | `index.html` |
   | How the home page looks | `home/home.css` |
   | The first screen (workspace, specimen, question, every model) | `home/first.js` |
   | Researchers, Workspace, Capabilities chapters | `home/researchers.js`, `home/workspace.js`, `home/capabilities.js` |
   | What every chapter shares (three.js view, glow, points, spores, camera fitting) | `home/gl.js`; canvas, pointer and data in `home/stage.js` |
   | Model names, Mac or cloud, the first screen's questions | `home/entries.json` (checked against the app's catalog by `tools/check_home.py --catalog`) |
   | Each chapter's still (no WebGL, no script) | `media/home-*.jpg` |
   | How it looks | `style.css` |
   | The plate, the catalog stars, the header | `site.js` |
   | The hero's sky | `hero-scene.js` |
   | Videos and pictures | `media/` |
3. Look at it on your machine. It has to be served; opening `index.html` or `story.html` as a file won't draw anything.
   ```bash
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000.
4. Give any new factual sentence a row in `CLAIMS.md` saying why it's true. A sentence with no evidence is cut.
5. Push the branch and open a pull request into `main`:
   ```bash
   git push -u origin my-change
   ```
   No write access? Fork the repository on GitHub, push to your fork and open the pull request from there. When it's
   merged, the site updates. Pages are cached for up to 10 minutes, so reload without the cache to see it.

Don't change `CNAME`: it is what points hookeui.org at this site. The scripts in `tools/` rebuild the hero's data from the
app's saved results. You only need them to change the sky, "You" or the plate; each
names the Python packages it needs in its first lines.

## Checks

`python3 tools/check_home.py` checks the pages without a browser (every relative link resolves; `--catalog DIR` points at
the app's `catalog/models`). `node tools/check_home.mjs [check ...]` runs the browser checks (all when none are named)
against a served copy of the site and prints `PASS name` or `FAIL name: why`. Both exit 1 on any failure. A browser check
needs the site served (`python3 -m http.server 8000 --bind 127.0.0.1`) and three variables: `BASE` (where it is served,
e.g. `http://127.0.0.1:8000`), `PLAYWRIGHT` (path to Playwright's `index.mjs`) and `CHROME` (path to a Chrome or Chromium
executable). To add a check, write one named function and register it in that file's `CHECKS` table.

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
