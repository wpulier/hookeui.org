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


CHECKS = {
    "links_resolve": links_resolve,
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
