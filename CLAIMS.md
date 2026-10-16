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
| Tagline: "Every researcher, with a staff of models"; "They do the technical work … You decide what the experiment needs" | The owner's framing (2026-10-15). It matches how the app works: models and the app's code measure and propose, only the user confirms a name and decides (AGENTS.md "Facts, not verdicts", "Only the user makes a name Confirmed") |
| The hero's sky is the 1,523 cells Cellpose-SAM found in a real stained plant stem, each in its stain's colour | `media/sky.json`, made by `tools/build_sky.py` from the app's own saved result: evidence `e1`, "Cell outlines · Cellpose-SAM · 18:26", recorded 2026-10-15 in the clip session from `2026-10-04-stained-plant-stem-section-42s.mp4`. Each star is one cell's centroid; its colour is the stain in a ring around the cell's own outline; the faint nebula is that capture, shown only where it is stained; the cell outlines drawn with a constellation are Cellpose-SAM's own polygons |
| The names in the sky are entries in Hooke's catalog, with what each does and where it runs | Each a folder in `catalog/models/` (Cellpose-SAM, Trackastra, Analyze Particles, micro-sam, EdgeTAM, Gemini, InstanSeg, SAM 3.1, Gaussian Blur, BioCLIP 2, Subtract Background, Claude, Bright objects). Which cells a name is drawn over is decoration, not that model's result; the caption says only that the names are catalog entries |
| "You": a researcher at a microscope drawn as a constellation | An illustration, drawn for this site; not a depiction of the app's interface |
| three.js r169, vendored | `vendor/three.module.min.js` and `vendor/addons/` from the npm package `three@0.169.0`, MIT (`vendor/three-LICENSE.txt`). Nothing on the page is fetched from another site |
