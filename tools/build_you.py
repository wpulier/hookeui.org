"""Turn the researcher's photo into stars: her outline, the photo's own edges inside it, and its light, as points.
Input: the photo and the EdgeTAM mask (cut_figure.py). Output: media/you.json for hero-scene.js."""
import sys, json, numpy as np, cv2

photo, mask_path, scope_path, out = sys.argv[1:5]
raw = cv2.imread(photo, cv2.IMREAD_GRAYSCALE)
# A local contrast lift, so her face and hair hold their tones beside the white apron.
g = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(raw).astype(np.float32) / 255
m = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE) > 127
scope = cv2.imread(scope_path, cv2.IMREAD_GRAYSCALE) > 127
H, W = g.shape
EYE = np.array([1088.0, 700.0])  # where her eye meets the eyepiece
ys, xs = np.where(m)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
K = 0.8 / (y1 - y0)  # the figure is 0.8 units tall
rng = np.random.default_rng(3)
norm = lambda x, y: (round(float((x - cx) * K), 4), round(float(-(y - cy) * K), 4))
diag = np.hypot(x1 - x0, y1 - y0)
def reveal(x, y):  # light spreads from the eyepiece; a little noise so it shimmers in rather than wipes
    return round(float(min(1, np.hypot(x - EYE[0], y - EYE[1]) / (diag * 0.8) + rng.normal(0, 0.025))), 3)
def fade(y):  # the photo's bottom edge cuts her off: dissolve the last part instead of drawing the cut
    return float(np.clip((H - 8 - y) / (H * 0.22), 0, 1))

pts = []
# 1. The outline (kind 0), along the mask's outer contour, skipping the photo's own bottom edge.
cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
for c in cs:
    if cv2.contourArea(c) < 2000: continue
    c = c[:, 0, :]
    for (x, y) in c[::4]:
        f = fade(y)
        if f <= 0.02 or x >= W - 3: continue
        pts.append([*norm(x, y), 0, round(0.62 * f, 3), reveal(x, y)])
# 2. The photo's edges inside her (kind 1): hair, face, the sleeve's pattern, the microscope's brass.
inner = cv2.erode(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
blur = cv2.GaussianBlur((g * 255).astype(np.uint8), (0, 0), 1.5)
head = np.zeros_like(m); head[:820, :1430] = True; head &= m
fine = head | scope
edges = (((cv2.Canny(blur, 45, 120) > 0) & fine) | ((cv2.Canny(blur, 70, 170) > 0) & ~fine)) & inner
ey, ex = np.where(edges)
keep = {}
for x, y in zip(ex, ey):  # thin to one point per 4 px cell
    keep.setdefault((x // 4, y // 4), (x, y))
for x, y in keep.values():
    f = fade(y)
    if f <= 0.02 or rng.random() > (0.8 if fine[y, x] else 0.45): continue
    b = 0.3 + 0.7 * float(g[y, x])
    if scope[y, x]: b = max(b, 0.75)  # the microscope is dark in the photo; its brass edges still catch the light here
    pts.append([*norm(x + rng.random(), y + rng.random()), 1, round(b * f, 3), reveal(x, y)])
# 3. Her light (kind 2): points inside her where the photo is bright, more where brighter; her head a little more.
lum = cv2.GaussianBlur(g, (0, 0), 1.5) * inner
w = lum ** 1.6 * np.where(head, 1.7, 1.0)
p = w.ravel(); p /= p.sum()
for i in rng.choice(p.size, 13000, replace=False, p=p):
    y, x = divmod(int(i), W)
    f = fade(y)
    if f <= 0.02: continue
    pts.append([*norm(x + rng.random(), y + rng.random()), 2, round(float(lum[y, x]) * f, 3), reveal(x, y)])
# 3b. The microscope's own outline, where it meets her and the bench (kind 0, a little fainter).
sc, _ = cv2.findContours(scope.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
for c in sc:
    if cv2.contourArea(c) < 1500: continue
    for (x, y) in c[:, 0, :][::3]:
        pts.append([*norm(x, y), 0, round(0.5 * fade(y), 3), reveal(x, y)])
# 4. A few brighter stars where the photo catches the most light (kind 3), well apart; the eye is added in the scene.
inner = cv2.erode(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
hl = cv2.GaussianBlur(g, (0, 0), 6) * inner
stars = []
for i in np.argsort(-hl.ravel()):
    y, x = divmod(int(i), W)
    if fade(y) < 0.5: continue
    if all(np.hypot(x - a, y - b) > 140 for a, b in stars): stars.append((x, y))
    if len(stars) == 9: break
for x, y in stars:
    pts.append([*norm(x, y), 3, 0.8, reveal(x, y)])
# 5. Her constellation (kind 5): bright stars at her landmarks, each snapped to the nearest point of her, and the
# lines a star atlas would draw between them.
LAND = {
  'bun': (1185, 270), 'hairback': (1335, 360), 'crown': (1010, 330), 'brow': (935, 560), 'eye': (1088, 700),
  'nose': (1150, 745), 'chin': (1235, 795), 'neck': (1330, 815), 'shoulder': (1530, 640), 'back': (1830, 780),
  'elbow': (1905, 1190), 'wrist': (1470, 1325), 'ring': (1235, 1330), 'fingers': (1120, 1385),
  'tube': (1085, 955), 'objective': (1025, 1015), 'knob': (1185, 885), 'stage': (1150, 1095), 'foot': (1175, 1215),
}
LINES = [('bun', 'hairback'), ('bun', 'crown'), ('crown', 'brow'), ('brow', 'eye'), ('eye', 'nose'), ('nose', 'chin'),
         ('chin', 'neck'), ('neck', 'shoulder'), ('hairback', 'shoulder'), ('shoulder', 'back'), ('back', 'elbow'),
         ('elbow', 'wrist'), ('wrist', 'ring'), ('ring', 'fingers'), ('eye', 'tube'), ('tube', 'objective'),
         ('tube', 'knob'), ('objective', 'stage'), ('knob', 'stage'), ('stage', 'foot')]
my, mx = np.where(m)
snapped = {}
for k, (x, y) in LAND.items():
    i = int(np.argmin((mx - x) ** 2 + (my - y) ** 2)); snapped[k] = (int(mx[i]), int(my[i]))
names = list(LAND)
for k in names:
    x, y = snapped[k]
    pts.append([*norm(x, y), 5, 1.0 if k == 'eye' else 0.85, reveal(x, y)])
figure_out = dict(stars=[list(norm(*snapped[k])) for k in names], lines=[[names.index(a), names.index(b)] for a, b in LINES])
json.dump(dict(source="Ruth Colvin Starrett McGuire (1893-1950), USDA photograph, Smithsonian Institution Archives, no known copyright restrictions; outlined with EdgeTAM",
               eye=list(norm(*EYE)), height=0.8,
               figure=figure_out, points=pts), open(out, "w"), separators=(",", ":"))
from collections import Counter
print(len(pts), Counter(p[2] for p in pts))
