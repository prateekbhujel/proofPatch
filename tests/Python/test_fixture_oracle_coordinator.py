from __future__ import annotations

import importlib.util
import pathlib
import time
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("fixture_oracle_coordinator", ROOT / "tests" / "Support" / "fixture_oracle_coordinator.py")
coordinator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coordinator)
HARNESS = (ROOT / "tests" / "Fixtures" / "owned-review-case" / "tests" / "order_total.php").read_bytes()


class FixtureOracleCoordinatorTest(unittest.TestCase):
    def test_actual_harness_reproduces_failure_and_accepts_fixture_repair(self):
        broken = lambda items: sum(x["unit_price"] * max(1, x["quantity"]) for x in items)
        repair = lambda items: sum(x["unit_price"] * x["quantity"] for x in items)
        original = coordinator.run_pinned_fixture(HARNESS, broken)
        fixed = coordinator.run_pinned_fixture(HARNESS, repair)
        self.assertEqual("fixture_failed", original["status"])
        self.assertIn("zero quantity: expected 250, got 750", original["stderr"])
        self.assertEqual("fixture_passed", fixed["status"])
        self.assertEqual(3, fixed["calls"])
        self.assertIn("no candidate or sandbox executed", fixed["assurance"])

    def test_wrong_fake_values_are_caught_by_original_harness(self):
        # No PHP candidate is executed: this double simply reports the values
        # an output-forging or global-mutating candidate might provide.
        result = coordinator.run_pinned_fixture(HARNESS, lambda _: 0)
        self.assertEqual("fixture_failed", result["status"])
        self.assertIn("multiple items: expected 330, got 0", result["stderr"])

    def test_untrusted_harness_and_invalid_limits_are_rejected_before_transport(self):
        def unexpected(_):
            self.fail("transport must not run")
        with self.assertRaises(ValueError):
            coordinator.run_pinned_fixture(HARNESS + b"\n", unexpected)
        with self.assertRaises(ValueError):
            coordinator.run_pinned_fixture(HARNESS, unexpected, timeout_seconds=11)
        with self.assertRaises(ValueError):
            coordinator.run_pinned_fixture(HARNESS, unexpected, max_calls=0)

    def test_bad_or_forged_transport_output_fails_closed(self):
        for bad in ("330", {"result": 330}, True, 2**64):
            with self.subTest(value=bad):
                result = coordinator.run_pinned_fixture(HARNESS, lambda _: bad)
                self.assertEqual("aborted", result["status"])
                self.assertEqual("Offline transport failed", result["reason"])

    def test_transport_exception_and_call_cap_fail_closed(self):
        def broken(_):
            raise RuntimeError("private diagnostics not returned")
        failed = coordinator.run_pinned_fixture(HARNESS, broken)
        self.assertEqual("aborted", failed["status"])
        self.assertNotIn("private diagnostics", str(failed))
        limited = coordinator.run_pinned_fixture(HARNESS, lambda _: 0, max_calls=1)
        self.assertEqual("aborted", limited["status"])
        self.assertEqual("Fixture call limit exceeded", limited["reason"])

    def test_callback_deadline_is_checked_after_return(self):
        def delayed(_):
            time.sleep(0.08)
            return 0
        result = coordinator.run_pinned_fixture(HARNESS, delayed, timeout_seconds=0.04)
        self.assertEqual("aborted", result["status"])
        self.assertEqual("Fixture deadline exceeded", result["reason"])

    def test_stalled_harness_is_stopped_and_temporary_directory_removed(self):
        made = []
        original = coordinator.tempfile.TemporaryDirectory

        def track(*args, **kwargs):
            directory = original(*args, **kwargs)
            made.append(directory.name)
            return directory

        stalled_bridge = b"<?php function orderTotal(array $items): int { sleep(2); return 0; }"
        with mock.patch.object(coordinator, "_BRIDGE", stalled_bridge.decode()), mock.patch.object(
            coordinator.tempfile, "TemporaryDirectory", side_effect=track
        ):
            result = coordinator.run_pinned_fixture(HARNESS, lambda _: 0, timeout_seconds=0.1)
        self.assertEqual("aborted", result["status"])
        self.assertEqual("Fixture deadline exceeded", result["reason"])
        self.assertTrue(made)
        self.assertFalse(pathlib.Path(made[0]).exists())

    def test_harness_output_flood_is_bounded(self):
        flooded_bridge = "<?php function orderTotal(array $items): int { echo str_repeat('x', 20000); return 0; }"
        with mock.patch.object(coordinator, "_BRIDGE", flooded_bridge):
            result = coordinator.run_pinned_fixture(HARNESS, lambda _: 0)
        self.assertEqual("aborted", result["status"])
        self.assertIn(result["reason"], ("Fixture output limit exceeded", "Fixture frame limit exceeded"))


if __name__ == "__main__":
    unittest.main()
