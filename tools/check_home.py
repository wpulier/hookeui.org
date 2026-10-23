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
    used = list(data.get("ring", [])) + [l["id"] for l in data.get("lenses", []) if l.get("id")]
    for q in data.get("ask", []):
        used += [step[0] for step in q.get("plan", [])]
    for eid in used:
        if eid not in entries:
            failures.append(f"{eid} is used but not in entries")
    return failures


CHECKS = {
    "links_resolve": links_resolve,
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
