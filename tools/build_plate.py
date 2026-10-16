"""The plate under the dawn: every cell Cellpose-SAM outlined in the stem, as ink lines, with what the app measured.

python3 tools/build_plate.py <evidence folder e1> media/plate.json
Each cell: [svg path in the capture's pixels, area px², circularity, elongation, cut by the view's edge (0/1), ring 0-9].
"""
import json, sys, math

EV, OUT = sys.argv[1], sys.argv[2]
man = json.load(open(f"{EV}/manifest.json"))
cx, cy, r = man["view"]["disc"]
values = man["columns"]["measure"]["values"]

cells, xs, ys = [], [], []
for cid, polys in man["polygons"].items():
    pts = polys[0]
    if len(pts) < 3 or cid not in values:
        continue
    m = values[cid]
    d = "M" + "L".join(f"{round(x)} {round(y)}" for x, y in pts) + "Z"
    gx, gy = m["centroid"]
    ring = min(9, int(math.hypot(gx - cx, gy - cy) / r * 10))
    cells.append([d, round(m["areaPx"]), round(m["circularity"], 2), round(m["elongation"], 2), int(bool(m["edgeCut"])), ring])
    xs += [p[0] for p in pts]; ys += [p[1] for p in pts]

box = [math.floor(min(xs)) - 6, math.floor(min(ys)) - 6, math.ceil(max(xs)) + 6, math.ceil(max(ys)) + 6]
json.dump({"source": "Cellpose-SAM, 1,523 cells, stained plant stem, recorded 2026-10-15 (evidence e1)",
           "disc": [round(cx, 1), round(cy, 1), round(r, 1)], "box": box, "cells": cells},
          open(OUT, "w"), separators=(",", ":"))
print(len(cells), box)
