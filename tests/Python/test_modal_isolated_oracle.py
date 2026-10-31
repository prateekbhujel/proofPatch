from __future__ import annotations

import base64
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
RUNNER_SCRIPT = ROOT / "scripts" / "modal_sandbox_runner.py"
FIXTURE_HARNESS = (ROOT / "tests" / "Fixtures" / "owned-review-case" / "tests" / "order_total.php").read_bytes()
BASE_SOURCE = (ROOT / "tests" / "Fixtures" / "owned-review-case" / "src" / "OrderTotal.php").read_bytes()
BENIGN_REPAIR = BASE_SOURCE.replace(b"max(1, $item['quantity'])", b"$item['quantity']")

# Import helper functions from modal_sandbox_runner directly
sys.path.insert(0, str(RUNNER_SCRIPT.parent))
import modal_sandbox_runner as msr


class ModalIsolatedOracleBoundaryTest(unittest.TestCase):
    """
    Unit tests for runner script helpers, spec validation, and argument parsing.
    NOTE: Local Python unit execution tests IPC parsing and anti-spoofing heuristics,
    but does NOT prove containerized microVM isolation (privilege separation via
    su/runuser and gVisor kernel isolation are enforced inside Modal containers).
    """

    def _execute_supervisor(self, candidate_code: bytes, harness_code: bytes) -> dict:
        """Executes the supervisor and isolated per-case worker in a clean temporary directory."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = pathlib.Path(tmp_dir)
            workspace = tmp_path / "workspace"
            workspace.mkdir(parents=True, exist_ok=True)
            (workspace / "src").mkdir(parents=True, exist_ok=True)
            (workspace / "tests").mkdir(parents=True, exist_ok=True)

            target_file = workspace / "src" / "OrderTotal.php"
            harness_file = workspace / "tests" / "order_total.php"
            worker_file = workspace / "_oracle_worker.php"
            supervisor_file = tmp_path / "supervisor.php"

            target_file.write_bytes(candidate_code)
            harness_file.write_bytes(harness_code)
            worker_file.write_text(msr.get_worker_script(), encoding="utf-8")

            oracle_token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            raw_supervisor = msr.get_supervisor_script(oracle_token)

            # Adapt paths in supervisor script to use tmp directory for local execution testing
            adapted_supervisor = raw_supervisor.replace(
                "$workspaceDir = '/opt/proofpatch_worker';",
                f"$workspaceDir = '{workspace}';"
            ).replace(
                "$phpOpts = '-n -d open_basedir=/opt/proofpatch_worker:/tmp -d disable_functions=exec,passthru,shell_exec,system,proc_open,popen,curl_exec';",
                f"$phpOpts = '-n -d open_basedir={tmp_dir}:/tmp';"
            )

            # Bypass su/runuser in local non-root test environment to run php directly
            adapted_supervisor = adapted_supervisor.replace(
                "if ($suPath !== null) {\n        $fullCmd = $suPath . ' -s /bin/sh proofpatch-worker -c ' . escapeshellarg($workerCmd);\n    } else {\n        $fullCmd = $runuserPath . ' -u proofpatch-worker -- ' . $workerCmd;\n    }",
                "$fullCmd = $workerCmd;"
            ).replace(
                "if ($suPath === null && $runuserPath === null) {\n    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Privilege separation unavailable]\\n\");\n    exit(1);\n}",
                "// bypassed for local non-root test"
            )

            supervisor_file.write_text(adapted_supervisor, encoding="utf-8")

            proc = subprocess.run(
                ["php", str(supervisor_file), "src/OrderTotal.php", "tests/order_total.php"],
                capture_output=True,
                text=True,
                timeout=15,
            )

            return {
                "exit_code": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "oracle_token": oracle_token,
                "has_sentinel": f"[PROOFPATCH_ORACLE_SUCCESS:{oracle_token}]" in proc.stdout,
            }

    def test_benign_repair_passes_with_oracle_sentinel(self):
        result = self._execute_supervisor(BENIGN_REPAIR, FIXTURE_HARNESS)
        self.assertEqual(0, result["exit_code"])
        self.assertTrue(result["has_sentinel"])
        self.assertIn("All order total cases passed.", result["stdout"])

    def test_baseline_bug_reproduced_and_fails_closed(self):
        result = self._execute_supervisor(BASE_SOURCE, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])
        self.assertIn("zero quantity: expected 250, got 750", result["stderr"])

    def test_vector_forged_success_output_fails_closed(self):
        # Candidate echoes success string and attempts to spoof supervisor
        forged_candidate = b"<?php\necho \"All order total cases passed.\\n\";\nfunction orderTotal(array $items): int { return 0; }\n"
        result = self._execute_supervisor(forged_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])
        self.assertIn("illegal stdout text", result["stderr"])

    def test_vector_early_exit_zero_fails_closed(self):
        # Candidate calls exit(0) to bypass tests
        early_exit_candidate = b"<?php\nexit(0);\n"
        result = self._execute_supervisor(early_exit_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])

    def test_vector_early_die_zero_fails_closed(self):
        die_candidate = b"<?php\ndie(0);\n"
        result = self._execute_supervisor(die_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])

    def test_vector_wrong_answer_fails_closed(self):
        wrong_candidate = b"<?php\nfunction orderTotal(array $items): int { return 0; }\n"
        result = self._execute_supervisor(wrong_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])
        self.assertIn("multiple items: expected 330, got 0", result["stderr"])

    def test_vector_timeout_infinite_loop_fails_closed(self):
        loop_candidate = b"<?php\nfunction orderTotal(array $items): int { while(true) {} return 0; }\n"
        result = self._execute_supervisor(loop_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])
        self.assertIn("timed out", result["stderr"])

    def test_vector_malformed_type_response_fails_closed(self):
        bad_type_candidate = b"<?php\nfunction orderTotal(array $items) { return 'three hundred'; }\n"
        result = self._execute_supervisor(bad_type_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])

    def test_vector_unhandled_exception_fails_closed(self):
        throw_candidate = b"<?php\nfunction orderTotal(array $items): int { throw new RuntimeException('crash'); }\n"
        result = self._execute_supervisor(throw_candidate, FIXTURE_HARNESS)
        self.assertEqual(1, result["exit_code"])
        self.assertFalse(result["has_sentinel"])
        self.assertIn("Exception in candidate", result["stderr"])

    def test_spec_validation_blocks_oversized_candidates(self):
        oversized = base64.b64encode(b"a" * 70000).decode("ascii")
        valid_harness = base64.b64encode(FIXTURE_HARNESS).decode("ascii")
        with self.assertRaises(ValueError):
            msr.validate_pinned_spec(oversized, valid_harness, "src/OrderTotal.php", "tests/order_total.php", msr.DEFAULT_IMAGE)

    def test_spec_validation_blocks_unauthorized_harnesses(self):
        valid_source = base64.b64encode(BENIGN_REPAIR).decode("ascii")
        fake_harness = base64.b64encode(b"<?php echo 'tampered harness';").decode("ascii")
        with self.assertRaises(ValueError):
            msr.validate_pinned_spec(valid_source, fake_harness, "src/OrderTotal.php", "tests/order_total.php", msr.DEFAULT_IMAGE)


if __name__ == "__main__":
    unittest.main()
