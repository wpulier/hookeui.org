"""Activate an already signed Stable draft only inside the protected GitHub job.

This repository contains distribution controls, never app/build/signing source.
GitHub supplies asset SHA256 digests. Missing digests fail closed.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPO = "wpulier/hookeui.org"


def api(path, payload=None):
    args = ["gh", "api", path]
    if payload is not None:
        args += ["--method", "PATCH", "--input", "-"]
    return json.loads(subprocess.check_output(args, input=(json.dumps(payload).encode() if payload else None)))


def fingerprint(release, latest_id):
    assets = []
    for asset in release["assets"]:
        digest = asset.get("digest") or ""
        if asset.get("state") != "uploaded" or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError("Every uploaded asset must have a GitHub SHA256 digest")
        assets.append([asset["name"], digest[7:]])
    if len({a[0] for a in assets}) != len(assets):
        raise ValueError("Duplicate asset names")
    names = {a[0] for a in assets}
    if not {"release.json", "appcast.xml", "SHA256SUMS"} <= names or not any(n.endswith(".dmg") for n in names):
        raise ValueError("Missing installer, receipt, feed or checksums")
    binding = {"assets": sorted(assets), "tag": release["tag_name"],
               "name": release["name"], "body": release["body"], "latest": latest_id}
    return hashlib.sha256(json.dumps(binding, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate(release, latest_id, expected, *, recovery=False):
    if release["draft"] == recovery or release["prerelease"]:
        raise ValueError("Only an unpublished Stable draft may be activated")
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", release["tag_name"]):
        raise ValueError("Expected a Stable version tag")
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or fingerprint(release, latest_id) != expected:
        raise ValueError("Files, release metadata or current Stable changed; request fresh approval")


def main():
    mode = os.environ["MODE"]
    if mode == "probe":
        print("Approval gate rehearsal only: no releases, assets, tags or feeds changed.")
        return
    if mode not in ("publish", "recover"):
        raise ValueError("Unsupported operation")
    release_id = os.environ["RELEASE_ID"]
    if not release_id.isdecimal():
        raise ValueError("Expected numeric release ID")
    release = api(f"repos/{REPO}/releases/{release_id}")
    latest = api(f"repos/{REPO}/releases/latest")
    if mode == "recover":
        bad_id = os.environ["BAD_RELEASE_ID"]
        if not bad_id.isdecimal() or int(bad_id) == release["id"]:
            raise ValueError("Recovery requires a different numeric bad release ID")
        if latest["id"] not in (int(bad_id), release["id"]):
            raise ValueError("Current Stable changed; do not overwrite another release")
        validate(release, int(bad_id), os.environ["EXPECTED_SHA256"], recovery=True)
        bad = api(f"repos/{REPO}/releases/{bad_id}")
        if not os.environ["REASON"].strip():
            raise ValueError("Recovery requires a public reason")
        prefix = "**Withdrawn:** " + os.environ["REASON"] + "\n\n"
        original_bad = dict(bad)
        if bad["prerelease"]:
            if not (bad["body"] or "").startswith(prefix):
                raise ValueError("Withdrawn metadata differs from this approved recovery")
            original_bad.update(prerelease=False, body=bad["body"][len(prefix):])
        validate(original_bad, int(bad_id), os.environ["BAD_SHA256"], recovery=True)
    else:
        validate(release, latest["id"], os.environ["EXPECTED_SHA256"])
    summary = (f"Stable candidate: {release['tag_name']}\n\n"
               f"Exact files and metadata SHA256: `{os.environ['EXPECTED_SHA256']}`\n\n"
               f"Replaces: {latest['tag_name']}\n\n"
               + "\n".join(f"- `{a['name']}`: `{a['digest']}`" for a in release['assets']) + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as f:
            f.write(summary)
    print(summary)
    if sys.argv[1:] == ["--activate"]:
        # This branch runs only in the environment-protected job. No rebuilds.
        if mode == "recover":
            # Establish the approved good offer before withdrawing the bad one.
            # A retry after either PATCH revalidates those same approved IDs,
            # hashes and reason, and requires a fresh environment approval.
            if latest["id"] != release["id"]:
                api(f"repos/{REPO}/releases/{release_id}", {"make_latest": "true"})
            if not bad["prerelease"]:
                api(f"repos/{REPO}/releases/{bad['id']}", {
                    "prerelease": True, "make_latest": "false",
                    "body": prefix + (bad["body"] or "")})
        else:
            api(f"repos/{REPO}/releases/{release_id}", {"draft": False, "make_latest": "true"})
        print(f"Published https://github.com/{REPO}/releases/tag/{release['tag_name']}")
    elif sys.argv[1:]:
        raise ValueError("Unexpected arguments")


if __name__ == "__main__":
    main()
