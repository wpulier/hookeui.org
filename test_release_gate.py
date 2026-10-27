"""Synthetic release fixtures; no API calls or publication."""
import copy
import os
import unittest
from unittest.mock import patch

import release_gate as gate


def candidate():
    return {"id": 12, "draft": True, "prerelease": False, "tag_name": "v1.2.3", "name": "HookeUI 1.2.3",
            "body": "Reviewed release notes", "assets": [
                {"name": n, "digest": "sha256:" + "a" * 64, "state": "uploaded"}
                for n in ["release.json", "appcast.xml", "SHA256SUMS", "HookeUI.dmg"]]}


class GateTests(unittest.TestCase):
    def test_digest_is_order_independent(self):
        r = candidate()
        expected = gate.fingerprint(r, 11)
        self.assertEqual(expected, "7d0b360597fb0556fe409ec285b23801011d8bb95d7769584a4b17dac03ebdd4")
        r["assets"].reverse()
        self.assertEqual(gate.fingerprint(r, 11), expected)

    def test_mutations_after_approval_refuse(self):
        r = candidate()
        expected = gate.fingerprint(r, 11)
        for key, value in [("body", "changed"), ("tag_name", "v1.2.4"), ("name", "changed"),
                           ("draft", False), ("prerelease", True)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                gate.validate({**r, key: value}, 11, expected)
        with self.assertRaises(ValueError):
            gate.validate(r, 99, expected)
        for mutation in (lambda a: a[0].update(digest="sha256:" + "b" * 64),
                         lambda a: a.pop(), lambda a: a[0].update(digest=None),
                         lambda a: a.append(a[0]), lambda a: a[0].update(state="new")):
            changed = copy.deepcopy(r)
            mutation(changed["assets"])
            with self.assertRaises(ValueError):
                gate.validate(changed, 11, expected)

    def test_verify_does_not_publish_and_activation_rechecks(self):
        r = candidate()
        calls = []
        def api(path, payload=None):
            calls.append(payload)
            return {"id": 11, "tag_name": "v1.2.2"} if path.endswith("latest") else r
        env = {"MODE": "publish", "RELEASE_ID": "12", "EXPECTED_SHA256": gate.fingerprint(r, 11)}
        with patch.dict(os.environ, env, clear=True), patch.object(gate, "api", api), patch.object(gate.sys, "argv", ["gate"]):
            gate.main()
            self.assertTrue(all(p is None for p in calls))
            gate.sys.argv.append("--activate")
            gate.main()
            self.assertEqual(calls[-1], {"draft": False, "make_latest": "true"})
            calls.clear()
            r["body"] = "changed during wait"
            with self.assertRaises(ValueError):
                gate.main()
            self.assertTrue(all(p is None for p in calls))

    def test_probe_cannot_mutate_even_with_activate(self):
        with patch.dict(os.environ, {"MODE": "probe"}, clear=True), patch.object(gate, "api") as api, \
             patch.object(gate.sys, "argv", ["gate", "--activate"]):
            gate.main()
            api.assert_not_called()

    def test_recovery_binds_both_releases_and_refuses_stale_current(self):
        good = candidate(); good.update(id=10, draft=False, tag_name="v1.2.1")
        bad = candidate(); bad.update(id=11, draft=False, tag_name="v1.2.2")
        calls = []
        def api(path, payload=None):
            calls.append((path, payload))
            return bad if path.endswith(("latest", "/11")) else good
        env = {"MODE": "recover", "RELEASE_ID": "10", "BAD_RELEASE_ID": "11", "REASON": "Regression",
               "EXPECTED_SHA256": gate.fingerprint(good, 11), "BAD_SHA256": gate.fingerprint(bad, 11)}
        with patch.dict(os.environ, env, clear=True), patch.object(gate, "api", api), patch.object(gate.sys, "argv", ["gate", "--activate"]):
            gate.main()
            writes = [p for _, p in calls if p]
            self.assertEqual(len(writes), 2)
            self.assertEqual(writes[0], {"make_latest": "true"})
            self.assertTrue(writes[1]["prerelease"])
            calls.clear(); bad["body"] = "changed"
            with self.assertRaises(ValueError):
                gate.main()
            self.assertFalse(any(p for _, p in calls))

    def test_recovery_retry_after_first_patch_keeps_exact_good_offer(self):
        good = candidate(); good.update(id=10, draft=False, tag_name="v1.2.1")
        bad = candidate(); bad.update(id=11, draft=False, tag_name="v1.2.2")
        latest = bad
        fail = True
        def api(path, payload=None):
            nonlocal latest, fail
            selected = bad if path.endswith("/11") else good
            if payload:
                if "prerelease" in payload and fail:
                    fail = False
                    raise OSError("Simulated network failure after selecting good")
                if payload.get("make_latest") == "true":
                    latest = selected
                selected.update({k: v for k, v in payload.items() if k != "make_latest"})
            return latest if path.endswith("latest") else selected
        env = {"MODE": "recover", "RELEASE_ID": "10", "BAD_RELEASE_ID": "11", "REASON": "Regression",
               "EXPECTED_SHA256": gate.fingerprint(good, 11), "BAD_SHA256": gate.fingerprint(bad, 11)}
        with patch.dict(os.environ, env, clear=True), patch.object(gate, "api", api), patch.object(gate.sys, "argv", ["gate", "--activate"]):
            with self.assertRaises(OSError):
                gate.main()
            self.assertEqual(latest["id"], 10)
            self.assertFalse(bad["prerelease"])
            gate.main()
            self.assertTrue(bad["prerelease"])
            gate.main()  # Same approved recovery is idempotent after both PATCHes.
            self.assertEqual(latest["id"], 10)


if __name__ == "__main__":
    unittest.main()
