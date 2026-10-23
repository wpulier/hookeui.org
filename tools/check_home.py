#!/usr/bin/env python3
"""Static checks for the home page. Run: python3 tools/check_home.py [--catalog DIR]

Add a check by writing a function that returns a list of failure strings
(empty when it passes) and registering it in CHECKS.
"""
import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class _Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("href", "src") and v:
                self.refs.append(v)


def links_resolve(args):
    failures = []
    for name in ("index.html", "story.html"):
        page = ROOT / name
        if not page.exists():
            if name == "index.html":  # until the new home exists
                continue
            failures.append(f"{name} is missing")
            continue
        parser = _Refs()
        parser.feed(page.read_text(encoding="utf-8"))
        for ref in parser.refs:
            parts = urlsplit(ref)
            if parts.scheme or parts.netloc or ref.startswith(("#", "mailto:")):
                continue
            path = parts.path
            if not path:
                continue
            target = ROOT / path.lstrip("/") if path.startswith("/") else (page.parent / path)
            if not target.exists():
                failures.append(f"{name}: {ref} does not resolve")
    return failures


def entries_real(args):
    """home/entries.json names real catalog entries, with the right Mac/cloud, and every id used is declared."""
    import json
    import re
    if not args.catalog:
        print("SKIP entries_real (no --catalog)")
        return []
    path = ROOT / "home" / "entries.json"
    if not path.exists():
        return ["home/entries.json is missing"]
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data.get("entries", {})
    failures = []
    for eid, e in entries.items():
        toml = Path(args.catalog) / eid / "model.toml"
        if not toml.exists():
            failures.append(f"{eid}: no {toml}")
            continue
        m = re.search(r'^runs\s*=\s*"([^"]*)"', toml.read_text(encoding="utf-8"), re.M)
        want = "cloud" if m and m.group(1) == "cloud" else "mac"
        if e.get("where") != want:
            failures.append(f"{eid}: where is {e.get('where')!r}, catalog runs {m.group(1) if m else None!r} means {want!r}")
    first = data.get("first", {})
    used = list(first.get("models", [])) + [l["id"] for l in data.get("lenses", []) if l.get("id")]
    for q in first.get("questions", []):
        used += list(q.get("use", {}))
        missing = [i for i in q.get("use", {}) if i not in first.get("models", [])]
        if missing:
            failures.append(f"question {q.get('q')!r} uses {missing}, which the first screen's arc doesn't show")
    for eid in used:
        if eid not in entries:
            failures.append(f"{eid} is used but not in entries")
    return failures


def plate_matches_sky(args):
    """Cell i of media/plate.json is the same cell as stars[i] of media/sky.json, so the readout can join them by index."""
    import json
    import re
    plate = json.loads((ROOT / "media" / "plate.json").read_text(encoding="utf-8"))
    sky = json.loads((ROOT / "media" / "sky.json").read_text(encoding="utf-8"))
    cells, stars = plate["cells"], sky["stars"]
    if len(cells) != 1523 or len(stars) != 1523:
        return [f"plate has {len(cells)} cells and sky has {len(stars)}, expected 1,523 each"]
    cx, cy, r = plate["disc"]
    ok = 0
    for cell, star in zip(cells, stars):
        pts = [(float(a), float(b)) for a, b in re.findall(r"(-?[\d.]+)\s+(-?[\d.]+)", cell[0])]
        if not pts:
            continue
        mx = sum(p[0] for p in pts) / len(pts)
        my = sum(p[1] for p in pts) / len(pts)
        if abs((mx - cx) / r - star[0]) <= 0.03 and abs(-(my - cy) / r - star[1]) <= 0.03:
            ok += 1
    if ok < 0.95 * len(cells):
        return [f"only {ok} of {len(cells)} plate cells sit within 0.03 of the same sky cell"]
    return []


CHECKS = {
    "links_resolve": links_resolve,
    "plate_matches_sky": plate_matches_sky,
    "entries_real": entries_real,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", help="directory of catalog entries (catalog/models)")
    args = ap.parse_args()
    bad = 0
    for name, fn in CHECKS.items():
        for why in fn(args):
            print(f"FAIL {name}: {why}")
            bad += 1
    if bad:
        return 1
    print(f"PASS {len(CHECKS)} check(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
