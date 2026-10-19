# What the page says, and why it's true

Every factual sentence on `index.html` with its evidence. Paths are in the app's repository
(`wpulier/microscope-mind` until the public snapshot). Clips were recorded on 2026-10-15 in an isolated copy of the
app (its own data folder, no phone) built from `main` at 7d453daa, playing the owner's real recordings from
`~/MicroscopeMind/footage/`. Nothing in any clip was staged, edited into the interface or sped up; two clips are
shortened by cuts, and say so.

| Claim on the page | Evidence |
|---|---|
| Free and open source; planned licence Apache-2.0 with DCO, being finalised | Go-live checklist D11 (drafted, not applied); `docs/contributing/DCO.txt`; README "Licence" |
| Runs on Macs with Apple silicon; the download is coming soon | README "Run the studio" requirements; go-live checklist "Make the downloadable Mac app" (not built yet) |
| Point a camera at the eyepiece or open recordings and images | AGENTS.md "Three live sources"; ADR 0022 (assets as session sources); the hero, follow and motion clips open recordings as assets |
| Outline, measure and follow with models the community uses | Catalog entries `catalog/models/{edgetam,cellpose-sam,micro-sam-lm,trackastra,...}`; clips |
| See which model did each step | AGENTS.md "Activity" (`ToolRun.models`, each step's models) |
| Hero: one click outlined the pith and named it as a best guess; the chat answered | `media/hero.mp4`, real time, 24 s; the label reads "pith · Probably" |
| Try an example: real image of human cells, basic local method, measurements table | `docs/first-experience.md`; `media/example.mp4` (271 bright regions, matching the go-live keyless replay) |
| No account, API key, model download or camera needed for the example | `docs/first-experience.md` first paragraph |
| It doesn't claim every bright region is a cell | `docs/first-experience.md` "What the result means" |
| Example image by David Root, CC0, from scikit-image | `assets/examples/NOTICE.md`, `metadata.json` |
| One click outlines with EdgeTAM; the outline follows a moving thing and its path is drawn and measured | AGENTS.md "Outlines that follow their own thing" and "A followed outline's trail"; `media/follow.mp4` ("43 px (no scale yet)") |
| A vision model names it with a key added; "Probably" until you confirm | AGENTS.md "Names say how sure they are", "Only the user makes a name Confirmed" |
| Cellpose-SAM outlines every cell; the app measures area, perimeter, roundness, brightness and more | AGENTS.md "Cells are evidence" (`measure.py`); `media/cells.mp4` table columns |
| Sortable table, Download CSV | AGENTS.md "The Measurements page"; visible in `media/cells.mp4` |
| µm only with an objective or calibration; pixels otherwise, said | AGENTS.md "Sizes come only from the app"; the app's own line in `media/cells.mp4` |
| 1,523 cells in about 20 seconds on our test Mac; shortened | Recording log: Run to result 21.2 s; the clip joins three moments |
| Tracks what moves over the last few seconds, slide motion taken out, measured speeds | AGENTS.md "What moves is measured" (`movement.py`); `media/motion.mp4` |
| Says so instead of guessing when the slide moved | `media/motion.mp4`, first answer ("the slide kept moving", with its "!") |
| When a step doesn't work, the answer says so | ADR 0006 and its amendment; AGENTS.md "Never claim what did not happen" |
| Researchers for longer questions; findings cite the session's records | AGENTS.md "Researchers"; ADR 0015 (`research_worker/evidence.py`) |
| Add a model from a BioImage Model Zoo or Hugging Face link, or your own Cellpose model | `catalog/README.md` "Add your own" and the link templates (`link_recognise.py`) |
| A model with its own code gets a locked environment of its own and is proven on a real picture first | `catalog/README.md` "Add a model with its own adapter"; `env_runner.py` |
| The newer version waits beside the working one until it passes | AGENTS.md "A new version installs beside the one in use" |
| Pinned revision, checked by size and content; weights download only on Download | AGENTS.md "The models folder" ("nothing downloads on first use") |
| Fiji's Analyze Particles runs through a reviewed binding, matching its macro | AGENTS.md "Fiji, its plugins and bindings" ("identical to its macro") |
| Credits: makers of each model | Each entry's `credit` in `catalog/models/*/model.toml` |
| Each model keeps its own licence, shown before you turn it on | AGENTS.md "Turn on" sheet (the licence among its facts); ADR 0005 |
| Every result records the model, version and settings; shared pictures say what made them | Evidence executions (`evidence.py`); `made_with.py` |
| The app measures, models name; µm needs your scale | AGENTS.md "Facts, not verdicts", "Sizes come only from the app" |
| Only you can confirm a name | AGENTS.md "Only the user makes a name Confirmed" |
| Sessions saved on your Mac; cloud models optional, your key; Activity names models; monthly limit | ADR 0017 (journals on disk); `orchestrator/keys.py`; Activity; AGENTS.md "A monthly cap on cloud models" |
| Forum opens with the first release | Go-live checklist decision 08 (not chosen yet) |
| Built with a lot of help from AI coding assistants | Go-live checklist D2 ("AI help said plainly") |
| Named after Robert Hooke, whose Micrographia (1665) recorded what he saw through his microscope | Historical record (Hooke, *Micrographia*, Royal Society, 1665) |
| The Mac app will be signed and update itself | Go-live checklist "Build the release pipeline in CI", "Make the downloadable Mac app" (planned) |
| Chat, voice and naming need a key; the example and local models don't | AGENTS.md "Keys"; `docs/first-experience.md` |
| Not affiliated with Fiji or ImageJ | Statement of fact by the owner |
| Basic local method uses an Otsu threshold | `docs/first-experience.md` "What the result means" |
| Motion: 527 tracked, 153 actively swimming, median net 13 px/s, pixels because no scale | The app's own answer, recorded in `media/motion.mp4`'s session (2026-10-15 18:31) |
| Source code on GitHub from the first release | Go-live checklist "Approve and publish" (not public yet) |
| Table still: real Measurements page for the 1,523 cells | `media/table.jpg`, a frame of the cells recording |
| Image analysis at the speed new models arrive; hundreds of models, new ones published every week | The owner's framing of the field (2026-10-15 call); the BioImage Model Zoo and Hugging Face add microscopy models continually. A statement about the field, not a count of the catalog |
| Find a model in the catalog, from a BioImage Model Zoo or Hugging Face link, a Fiji function or a colleague's share | `catalog/README.md` "Add your own", "Channels", "Share it (no account)"; Fiji bindings |
| One action to turn it on: Download (local) or Add key (cloud) | AGENTS.md "Ready here?" (each card's one action); `readiness.py` |
| No terminal | The Toolbox's Download, Install, Add key and Turn on run in the app (AGENTS.md "Environments the app makes", "The models folder") |
| Run several on the same view and compare them, overlap measured | AGENTS.md "Named comparisons" (`compare_models`: side by side, areas, IoU) |
| Share as a file or publish to the catalog; others get it as an update with no app release | AGENTS.md "Share" (`share.py`), "Publishing", "Channels" (catalog updates with no app update) |
| Models, algorithms and Fiji functions come from one shared catalog; an entry can be a model, algorithm, Fiji function, cloud model or dataset | `catalog/models/*/model.toml` (`kind`: model, tool-function, cloud-model, data); ADR 0018 |
| New entries reach you as catalog updates, without a new app | AGENTS.md "Channels" (Check for catalog updates, no app update), "New for you" |
| Have an AI assistant draft the adapter, tried in a sandbox before use | AGENTS.md "Have an AI build it" (`drafts.py`, `try_draft` in the sandbox) |
| Send it as a file anyone can open, or publish it to the reviewed catalog | AGENTS.md "Share" (`share.py`), "Publishing" (`publish.py`) |
| In the catalog now: Cellpose-SAM, micro-sam, SAM 3.1, EdgeTAM, InstanSeg, Trackastra, DINOv3, BioCLIP 2; Bright objects, Spot measure, Spot shape, brainreg; Analyze Particles, Gaussian Blur, Subtract Background; Gemini, GPT, Claude, SAM 3.1 (cloud); Allen mouse brain atlas | Each a folder in `catalog/models/` with its `kind` and `runs` |
| Fiji functions run headless in a pinned Fiji, each proven to match the same ImageJ macro | `catalog/models/fiji-*/model.toml` headers; ADR 0024; AGENTS.md "Fiji, its plugins and bindings" |
| No analytics or cookies on this site | This repository: no script but `site.js`, no third-party requests |
| "Every observer, with a staff of researchers and models, ready at the speed of technology." "Open source, for the community. To discover new worlds hidden in the existing." | The owner's words (2026-10-15). "Researchers" are the app's AI researchers, background helpers that run longer questions (AGENTS.md "Researchers"); "models" are the catalog's. The licence is being finalised (D11), so "open source" holds for the first release, as the Open source section says |
| The hero's sky is the 1,523 cells Cellpose-SAM found in a real stained plant stem, each in its stain's colour | `media/sky.json`, made by `tools/build_sky.py` from the app's own saved result: evidence `e1`, "Cell outlines · Cellpose-SAM · 18:26", recorded 2026-10-15 in the clip session from `2026-10-04-stained-plant-stem-section-42s.mp4`. Each star is one cell's centroid; its colour is the stain in a ring around the cell's own outline; the faint nebula is that capture, shown only where it is stained; the cell outlines drawn with a constellation are Cellpose-SAM's own polygons |
| The names in the sky are entries in Hooke's catalog, with what each does and where it runs | Each a folder in `catalog/models/` (Cellpose-SAM, Trackastra, Analyze Particles, micro-sam, EdgeTAM, Gemini, InstanSeg, SAM 3.1, Gaussian Blur, BioCLIP 2, Subtract Background, Claude, Bright objects). Which cells a name is drawn over is decoration, not that model's result; the caption says only that the names are catalog entries |
| "You" is made from a USDA photograph of Ruth Colvin Starrett, a cytologist who studied plant cells (Smithsonian Institution Archives) | Wikimedia Commons, "Ruth Colvin Starrett McGuire (1893-1950) - Smithsonian Institution Archives.jpg": creator United States Dept. of Agriculture; Smithsonian Institution Archives, Acc 90-105; "No known copyright restrictions". The archive's own caption: "Ruth C. Starrett is a cytologist -- she makes minute studies of plant cells". She and her microscope were outlined with EdgeTAM from a few clicks (`tools/cut_figure.py`) and turned into points of light (`tools/build_you.py`): her outline, the photo's edges and light as dust, and a constellation of brighter stars at her landmarks. An illustration, not the app's interface |
| three.js r169, vendored | `vendor/three.module.min.js` and `vendor/addons/` from the npm package `three@0.169.0`, MIT (`vendor/three-LICENSE.txt`). Nothing on the page is fetched from another site |
| "Every week, someone teaches a model to see something new." | A statement about the field: the BioImage Model Zoo and Hugging Face add microscopy models continually (as the "new ones every week" row) |
| "It's a click from your microscope": find it in the catalog or paste its link; download it, add a key or turn it on; no terminal | AGENTS.md "Ready here?" (each card's one action), "Add from a link" (`link_recognise.py`), "Environments the app makes" and "The models folder" (all done in the app) |
| "It works while you watch": outline, measure and follow on the live camera, recordings and images, with the model named on every step | AGENTS.md "Three live sources", ADR 0022 (assets as sources), "Activity" (each step's models) |
| "The app measures, the models propose, and only you confirm. Then share it back" | AGENTS.md "Facts, not verdicts", "Only the user makes a name Confirmed"; "Share" (`share.py`) and "Publishing" |
| "No single lab can keep up … anything anyone adds can be shared with everyone" | The owner's framing; sharing as a file or publishing to the reviewed catalog (`share.py`, `publish.py`), picked up by others as catalog updates ("Channels") |
| "Every result records the model, version and settings that made it, and a shared image names them, so anyone can turn on the same ones" | `evidence.py` executions; `made_with.py` (named in a snapshot's PNG and a kept result; an asset's preview offers each one not on yet) |
| Hooke's *Micrographia* "gave us the word 'cell'" | Hooke named the cells of cork "cells" in *Micrographia* (1665), Observation XVIII |
| The eyepiece over the hero: inside it, the real stained tissue and every cell's outline, with how many cells it is over, "outlined by Cellpose-SAM" | `media/sky-photo.jpg` is the capture of evidence `e1` (the frame Cellpose-SAM ran on); `media/sky-outlines.png` is its 1,523 polygons drawn as lines; the count is the stars (cells) under the lens |
| "Click to call a model": a constellation forms around the clicked cells with a catalog entry's name, what it does and where it runs | An illustration of the catalog, not a run: the names and descriptions are entries in `catalog/models/` (`CATALOG` in `hero-scene.js`); nothing is computed on the clicked cells |
| "In 1665, Robert Hooke drew a slice of cork and called its little boxes cells. He published his drawings, so anyone with a lens could look for themselves." | *Micrographia* (Royal Society, 1665), Observation XVIII: the cork's "pores, or cells … consisted of a great many little Boxes", engraved in Schem. XI. "We build Hooke in the open for the same reason" is the owner's framing |
| The plate: the 1,523 cells of a stained plant stem as Cellpose-SAM outlined them, drawn from the app's saved result; pointing at one gives its area (px²), circularity and elongation; pixels because no scale was set | `media/plate.json`, made by `tools/build_plate.py` from evidence `e1` (the same result as the sky): each cell's polygon and the app's own `measure` columns (`areaPx`, `circularity`, `elongation`, `edgeCut`); the population's basis is `px` with no scale. The plate shows the cells within 296 px of the eyepiece's centre; the lit cells that come and go are decoration |
| "Hooke numbered his": five numbered observations | *Micrographia*'s sixty observations are numbered (Observ. I to LX). The five clips and their sentences are the rows above (hero, cells, follow, motion, example) |
| "Behind every name are people who spent years teaching a model to see one thing well … names it on every result it helps make" | The owner's framing of the field; each entry's `credit` in `catalog/models/*/model.toml`; `made_with.py` (what really ran is named in a snapshot, a kept result and a dataset) |
| Catalog credits: DINOv3 by Meta AI; BioCLIP 2 by the Imageomics Institute | `catalog/models/dinov3-small/model.toml`, `catalog/models/bioclip-2/model.toml` `credit` |
| Gaussian Blur smooths an image; Subtract Background removes an uneven background; Spot measure finds spots and their sizes; Spot shape says how round each spot is | The Fiji commands' documented purposes (`catalog/models/fiji-*/model.toml`); `spot-measure`, `spot-shape` entries (SciPy ndimage) |
| "The sky keeps filling": entries arrive as catalog updates with no new app; add your own from a link, a Cellpose model or an AI-drafted adapter tried in a sandbox | The rows "New entries reach you as catalog updates", "Add a model from a BioImage Model Zoo or Hugging Face link", "Have an AI assistant draft the adapter" |
| "Come and look": the signed Mac app arrives with the first release; build from source on Apple silicon; the example and local models need no key | The rows "The Mac app will be signed", "Runs on Macs with Apple silicon", "Chat, voice and naming need a key" |


## 19 October 2026 development beta

The new Download Mac beta entry leads to beta.html, which explicitly limits the
claim to an early integrated development preview. The exact signed/notarized
artifact, SHA256 and source revision are recorded in the beta release assets.
Full workflow, independent qualification and napari parity are explicitly open.
Scientific packages are separate assets; their manifests declare requirements
and licenses. Source-only continuation is retained in the private application
repository milestone handoff. No general update feed is replaced.

## 19 October 2026 — Hooke 0.1.1 updates

- Download uses the normal Hooke name and version 0.1.1; historical prerelease remains available. Removing the label does not assert complete scientific-workflow qualification. `download.html` retains specific limits.
- Automatic checks, explicit installation and restart: Sparkle configuration and signed appcast in source commit `8ece3a66`; the appcast requires an interactive offer for older clients. The original beta feed is bridged at `beta/appcast.xml`.
- Signed and notarized Apple Silicon artifact, Project preservation and update delivery: source milestone handoff records the real beta → 0.1.1 Sparkle update in macOS 26.6.2: Remind Me Later, separate Install and Relaunch, 225 scientific files byte-identical, 27 saved documents readable, corrected uint16 label 7 inspected after reopen. DMG SHA256 `4baffde96ca02fcebd0c27f92e1a032c854cf8d4c95fab185306806b7f8871df`. This is one update demonstration, not every migration or complete workflow qualification.
