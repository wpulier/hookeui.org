# HookeUI public releases

Public installers, companion packages, checksums and update feeds for HookeUI.
Download the [current release](https://github.com/wpulier/hookeui.org/releases/latest).
No Hooke account is needed to download or use the local application.

This repository retains the historical release URL so existing installed apps can
continue checking for updates. It does not contain website, lesson, showcase,
account-service or cloud-platform source. The public website is [hookeui.org](https://hookeui.org).
Those official Hooke sources are maintained separately in a private repository.

The October 27, 2026 migration preserves the previously published release assets
byte-for-byte, including signatures, checksums, original release notes and versions.
GitHub publication timestamps reflect the migration; the signed feeds and release
records retain their original release information. No new app version is offered.

This release archive is not the audited HookeUI source distribution. Source
publication follows the project's separate release process. Third-party sources
and license notices remain attached to the applicable releases.
# Stable publication approval

Prepared Stable releases and feed recovery require `wpulier` to approve the
`stable` GitHub environment in [Approve Stable release](https://github.com/wpulier/hookeui.org/actions/workflows/stable.yml).
The workflow is manual, runs only from protected `main`, and rechecks the exact
files and release metadata after approval. The environment permits only this
reviewer, disables administrator bypass, and allows Will to approve runs he starts.
No signing credentials or private build recipe live here. Core maintainers are
not granted write access to this distribution repository.

The default `probe` mode tests the same approval gate without publishing or
changing releases. `publish` activates a verified draft; `recover` restores a
previous verified offer and marks the bad current release withdrawn. Rejection,
cancellation, or changes while waiting never fall back to local publication.

These are GitHub Actions controls, not a restriction on the repository owner:
the owner can still change settings or use an owner credential directly. Do not
delegate owner/distribution credentials as if GitHub provided draft-only access.

Synthetic helper checks: `python3 -m unittest -q test_release_gate.py`.
