"""Turn a real Cellpose-SAM result into the hero's sky: every cell a star, groups of cells as constellations."""
import json, sys, math, random
import numpy as np, cv2
from scipy.sparse.csgraph import minimum_spanning_tree
from scipy.spatial.distance import cdist as distance_matrix

EV, OUT = sys.argv[1], sys.argv[2]
man = json.load(open(f"{EV}/manifest.json"))
img = cv2.imread(f"{EV}/capture.jpg")[:, :, ::-1].astype(np.float32) / 255
H, W = img.shape[:2]
cx, cy, r = man["view"]["disc"]
norm = lambda x, y: ((x - cx) / r, -(y - cy) / r)

def bright(rgb):
    hsv = cv2.cvtColor(np.uint8([[np.clip(rgb, 0, 1) * 255]]), cv2.COLOR_RGB2HSV)[0, 0].astype(float)
    hsv[1] = min(255, hsv[1] * 0.85); hsv[2] = 235
    return (cv2.cvtColor(np.uint8([[hsv]]), cv2.COLOR_HSV2RGB)[0, 0] / 255).tolist()

cells = []
for cid, polys in man["polygons"].items():
    pts = np.array(polys[0], np.float32)
    if len(pts) < 3: continue
    m = cv2.moments(pts)
    if m["m00"] <= 0: continue
    x, y = m["m10"] / m["m00"], m["m01"] / m["m00"]
    x0, y0, w, h = cv2.boundingRect(pts.astype(np.int32))
    pad = 3; x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(W, x0 + w + 2 * pad); y1 = min(H, y0 + h + 2 * pad)
    mask = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(mask, [(pts - [x0, y0]).astype(np.int32)], 1)
    ring = cv2.dilate(mask, np.ones((5, 5), np.uint8)) - mask
    sel = ring.astype(bool) if ring.any() else mask.astype(bool)
    rgb = img[y0:y1, x0:x1][sel].mean(0)
    u, v = (float(t) for t in norm(x, y))
    cells.append(dict(id=cid, u=u, v=v, area=float(m["m00"]), rgb=bright(rgb), pts=pts))

areas = np.array([c["area"] for c in cells])
amax = np.percentile(areas, 98)
stars = [[round(c["u"], 4), round(c["v"], 4), round(min(1, math.sqrt(c["area"] / amax)), 3), *[round(t, 3) for t in c["rgb"]]] for c in cells]

# Dust: the stained tissue itself, sampled where it is coloured, as the faint sky between the cells.
rng = np.random.default_rng(7)
hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float) / 255
yy, xx = np.mgrid[0:H, 0:W]
inside = ((xx - cx) ** 2 + (yy - cy) ** 2) < (r * 0.985) ** 2
p = (hsv[..., 1] ** 1.5) * inside
p = p.ravel() / p.sum()
idx = rng.choice(p.size, 2600, replace=False, p=p)
dust = []
for i in idx:
    y, x = divmod(int(i), W)
    u, v = norm(x + rng.random(), y + rng.random())
    dust.append([round(u, 4), round(v, 4), *[round(t, 3) for t in bright(img[y, x])]])

# Constellations: anchors spread over the part of the disc the band shows; each takes the larger cells near it, joined by
# their minimum spanning tree, as star atlases join a figure's brightest stars.
NAMES = [
    ("Cellpose-SAM", "Outlines every cell", "On your Mac"),
    ("Trackastra", "Links the same cells between views", "On your Mac"),
    ("Analyze Particles", "Fiji: counts and measures particles", "On your Mac"),
    ("micro-sam", "Outlines cells, or the one you click", "On your Mac"),
    ("EdgeTAM", "Outlines what you click and follows it", "On your Mac"),
    ("Gemini", "Names what you point at and answers", "Your key"),
    ("InstanSeg", "Finds nuclei in brightfield images", "On your Mac"),
    ("SAM 3.1", "Finds everything like your example", "On your Mac or your key"),
    ("Gaussian Blur", "Fiji: smooths an image", "On your Mac"),
    ("BioCLIP 2", "Groups cells that look alike", "On your Mac"),
    ("Subtract Background", "Fiji: evens out uneven light", "On your Mac"),
    ("Claude", "Answers, explains and writes lessons", "Your key"),
    ("Bright objects", "Finds bright regions, no key or download", "On your Mac"),
    ("brainreg", "Registers a whole brain to an atlas", "On your Mac"),
    ("DINOv3", "Finds what looks alike", "On your Mac"),
]
random.seed(11)
uv = np.array([[c["u"], c["v"]] for c in cells])
anchors = []
tries = 0
while len(anchors) < len(NAMES) and tries < 20000:
    tries += 1
    a = np.array([random.uniform(-0.62, 0.92), random.uniform(-0.62, 0.86)])
    if np.hypot(*a) > 0.86: continue
    if any(np.hypot(*(a - b)) < 0.33 for b in anchors): continue
    if (np.hypot(*(uv - a).T) < 0.15).sum() < 12: continue
    anchors.append(a)
cons = []
for (name, what, where), a in zip(NAMES, anchors):
    d = np.hypot(*(uv - a).T)
    near = np.where(d < 0.17)[0]
    near = near[np.argsort(-areas[near])]
    pick = []
    for i in near:
        if all(np.hypot(*(uv[i] - uv[j])) > 0.045 for j in pick): pick.append(i)
        if len(pick) == 7: break
    P = uv[pick]
    mst = minimum_spanning_tree(distance_matrix(P, P)).tocoo()
    edges = [[int(i), int(j)] for i, j in zip(mst.row, mst.col)]
    outlines = []
    for i in pick:
        pts = cv2.approxPolyDP(cells[i]["pts"].reshape(-1, 1, 2), 0.8, True).reshape(-1, 2)
        outlines.append([round(float(t), 4) for x, y in pts for t in norm(x, y)])
    top = int(np.argmax(P[:, 1]))
    cons.append(dict(name=name, what=what, where=where, stars=[int(i) for i in pick], edges=edges, outlines=outlines, label=[round(float(P[:, 0].mean()), 4), round(float(P[:, 1].min()) - 0.045, 4)]))

json.dump(dict(source="Cellpose-SAM, 1,523 cells, stained plant stem, recorded 2026-10-15", stars=stars, dust=dust, constellations=cons),
          open(f"{OUT}/sky.json", "w"), separators=(",", ":"))
bg = cv2.resize((img * 255).astype(np.uint8)[:, :, ::-1], (640, 360), interpolation=cv2.INTER_AREA)
cv2.imwrite(f"{OUT}/sky-bg.jpg", bg, [cv2.IMWRITE_JPEG_QUALITY, 72])
print(len(stars), "stars", len(dust), "dust", len(cons), "constellations", [c["name"] for c in cons])
