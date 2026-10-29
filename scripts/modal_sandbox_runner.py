#!/usr/bin/env python3
"""
Modal Isolated Sandbox Runner for ProofPatch.
Executes PHP candidate and harness tests in an isolated Modal microVM sandbox via gVisor.

Security boundaries & guarantees:
- Standalone static script (syntax-checked, no dynamic code generation).
- gVisor runtime (`runtime='gvisor'`).
- Outbound and inbound network blocked (`block_network=True`).
- Zero credentials, secrets, volumes, or host environment mounted.
- Bounded resources: CPU (0.25, 0.25), Memory (256, 256), timeout bound, output capped at 64KB.
- Provider exit status retrieved via Modal SDK `sb.poll()`.
- The candidate and harness currently share a PHP process and globals. The supervisor
  checks file hashes and output, but cannot protect assertions from candidate mutation.
  The application therefore permits verification only of the pinned fixture candidate.
- Private result channel: Results written strictly on host, not writable by sandbox code.
- Guaranteed teardown: `sb.terminate(wait=True)` in `finally:`.
"""

import argparse
import base64
import json
import os
import re
import secrets
import sys

MAX_OUTPUT_BYTES = 65536  # 64 KB limit
DEFAULT_TIMEOUT_SECONDS = 30
MAX_TIMEOUT_SECONDS = 60
DEFAULT_IMAGE = "php@sha256:d716009046f4acac161ed7a14921111398228c2311696f132686be8613cb19ab"


def validate_relative_path(path: str) -> None:
    if path.startswith("/") or ".." in path or "\\" in path:
        raise ValueError(f"Path traversal or absolute paths are strictly prohibited: '{path}'")
    if not re.match(r"^[a-zA-Z0-9_./-]+$", path):
        raise ValueError(f"Invalid characters in relative file path: '{path}'")


def main() -> int:
    parser = argparse.ArgumentParser(description="ProofPatch Modal MicroVM Isolated Runner")
    parser.add_argument("spec_file", help="Path to JSON file with runner execution spec")
    parser.add_argument("result_file", help="Path to host private result JSON output file")
    args = parser.parse_args()

    if not os.path.isfile(args.spec_file):
        sys.stderr.write(f"Spec file not found: {args.spec_file}\n")
        return 2

    try:
        with open(args.spec_file, "r", encoding="utf-8") as f:
            spec = json.load(f)
    except Exception as e:
        sys.stderr.write(f"Failed to read or parse spec file: {e}\n")
        return 2

    source_b64 = spec.get("source_b64")
    test_harness_b64 = spec.get("test_harness_b64")
    relative_path = spec.get("relative_path", "src/OrderTotal.php")
    harness_path = spec.get("test_harness_path", "tests/order_total.php")
    timeout_seconds = int(spec.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS))
    image_tag = spec.get("image", DEFAULT_IMAGE)
    oracle_token = spec.get("oracle_token") or secrets.token_hex(32)

    if not source_b64 or not test_harness_b64:
        sys.stderr.write("Spec must contain non-empty 'source_b64' and 'test_harness_b64'.\n")
        return 2

    try:
        validate_relative_path(relative_path)
        validate_relative_path(harness_path)
    except ValueError as ve:
        sys.stderr.write(f"Validation error: {ve}\n")
        return 2

    timeout_seconds = max(5, min(MAX_TIMEOUT_SECONDS, timeout_seconds))

    # Base64 encoded supervisor script executing actual test harness under unprivileged worker user
    supervisor_php = (
        "<?php\n"
        "declare(strict_types=1);\n"
        "$workspaceDir = '/opt/proofpatch_worker';\n"
        "$targetRel = $argv[1] ?? 'src/OrderTotal.php';\n"
        "$harnessRel = $argv[2] ?? 'tests/order_total.php';\n"
        f"$oracleToken = '{oracle_token}';\n"
        "$targetFile = $workspaceDir . '/' . $targetRel;\n"
        "$harnessFile = $workspaceDir . '/' . $harnessRel;\n"
        "if (!is_file($targetFile) || !is_file($harnessFile)) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Target or harness file missing in workspace]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "$initialTargetSha = hash_file('sha256', $targetFile);\n"
        "$initialHarnessSha = hash_file('sha256', $harnessFile);\n"
        "$suPath = is_executable('/bin/su') ? '/bin/su' : (is_executable('/usr/bin/su') ? '/usr/bin/su' : null);\n"
        "$runuserPath = is_executable('/sbin/runuser') ? '/sbin/runuser' : (is_executable('/usr/sbin/runuser') ? '/usr/sbin/runuser' : null);\n"
        "if ($suPath === null && $runuserPath === null) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Privilege separation unavailable]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "$phpOpts = '-n -d open_basedir=/opt/proofpatch_worker:/tmp -d disable_functions=exec,passthru,shell_exec,system,proc_open,popen';\n"
        "$workerCmd = sprintf('cd %s && php %s %s', escapeshellarg($workspaceDir), $phpOpts, escapeshellarg($harnessRel));\n"
        "if ($suPath !== null) {\n"
        "    $fullCmd = $suPath . ' -s /bin/sh proofpatch-worker -c ' . escapeshellarg($workerCmd);\n"
        "} else {\n"
        "    $fullCmd = $runuserPath . ' -u proofpatch-worker -- ' . $workerCmd;\n"
        "}\n"
        "$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];\n"
        "$proc = proc_open($fullCmd, $descriptors, $pipes, $workspaceDir);\n"
        "if (!is_resource($proc)) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Failed to spawn unprivileged worker process]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "fclose($pipes[0]);\n"
        "$stdout = (string)stream_get_contents($pipes[1]);\n"
        "$stderr = (string)stream_get_contents($pipes[2]);\n"
        "fclose($pipes[1]);\n"
        "fclose($pipes[2]);\n"
        "$exitCode = proc_close($proc);\n"
        "$postTargetSha = hash_file('sha256', $targetFile);\n"
        "$postHarnessSha = hash_file('sha256', $harnessFile);\n"
        "if (!hash_equals($initialTargetSha, $postTargetSha) || !hash_equals($initialHarnessSha, $postHarnessSha)) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Filesystem tampering detected during harness execution]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "if (str_contains($stdout, '[PROOFPATCH_ORACLE_SUCCESS') || str_contains($stderr, '[PROOFPATCH_ORACLE_SUCCESS')\n"
        "    || str_contains($stdout, '[PROOFPATCH_ORACLE_ABORT') || str_contains($stderr, '[PROOFPATCH_ORACLE_ABORT')) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Candidate attempted oracle sentinel injection]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "if ($exitCode !== 0 || $stderr !== '' || str_contains($stdout, 'expected ')) {\n"
        "    if ($stderr !== '') { fwrite(STDERR, $stderr); }\n"
        "    if ($stdout !== '') { fwrite(STDOUT, $stdout); }\n"
        "    exit(1);\n"
        "}\n"
        "if (!str_contains($stdout, 'All order total cases passed.')) {\n"
        "    fwrite(STDERR, \"[PROOFPATCH_ORACLE_ABORT: Test harness did not reach natural completion]\\n\");\n"
        "    exit(1);\n"
        "}\n"
        "if ($stdout !== '') { echo $stdout; }\n"
        "if ($stderr !== '') { fwrite(STDERR, $stderr); }\n"
        "echo \"\\n[PROOFPATCH_ORACLE_SUCCESS:{$oracleToken}]\\n\";\n"
        "exit(0);\n"
    )
    supervisor_b64 = base64.b64encode(supervisor_php.encode("utf-8")).decode("ascii")

    # Import modal after argument validation
    try:
        import modal
    except ImportError:
        sys.stderr.write("Modal SDK not installed in current Python environment.\n")
        return 3

    # Build entrypoint script to create unprivileged worker user, isolate supervisor in /root/supervisor (0700),
    # mount workspace in a root-owned read-only directory (0555 dirs, 0444 files), and execute supervisor as root.
    entrypoint = (
        "id -u proofpatch-worker >/dev/null 2>&1 || (useradd -m -s /bin/bash proofpatch-worker 2>/dev/null || adduser -D proofpatch-worker) && "
        f"mkdir -p /root/supervisor /opt/proofpatch_worker/$(dirname '{relative_path}') /opt/proofpatch_worker/$(dirname '{harness_path}') && "
        "chmod 0700 /root /root/supervisor && "
        f"echo '{supervisor_b64}' | base64 -d > /root/supervisor/proofpatch_supervisor.php && "
        "chmod 0700 /root/supervisor/proofpatch_supervisor.php && "
        f"echo '{test_harness_b64}' | base64 -d > '/opt/proofpatch_worker/{harness_path}' && "
        f"echo '{source_b64}' | base64 -d > '/opt/proofpatch_worker/{relative_path}' && "
        "chown -R root:root /opt/proofpatch_worker && "
        "find /opt/proofpatch_worker -type d -exec chmod 0555 {} + && "
        "find /opt/proofpatch_worker -type f -exec chmod 0444 {} + && "
        f"php /root/supervisor/proofpatch_supervisor.php '{relative_path}' '{harness_path}'"
    )

    app = modal.App("proofpatch-verifier")
    image = modal.Image.from_registry(image_tag, add_python="3.11")

    sb = None
    exit_code = 1
    stdout_data = ""
    stderr_data = ""
    sandbox_id = "unknown"
    timed_out = False

    try:
        with app.run():
            try:
                sb = modal.Sandbox.create(
                    "bash", "-c", entrypoint,
                    app=app,
                    image=image,
                    runtime="gvisor",
                    block_network=True,
                    timeout=timeout_seconds,
                    cpu=(0.25, 0.25),
                    memory=(256, 256),
                    secrets=[],
                    volumes={},
                    env={},
                )
                sandbox_id = getattr(sb, "object_id", "unknown")

                # Wait for container execution to complete within timeout
                sb.wait()
                exit_code = sb.poll()
                if exit_code is None:
                    exit_code = 1

                stdout_data = sb.stdout.read()
                stderr_data = sb.stderr.read()

            except Exception as run_err:
                stderr_data += f"\nSandbox execution error: {run_err}\n"
                exit_code = 124 if "timeout" in str(run_err).lower() else 1
                if "timeout" in str(run_err).lower():
                    timed_out = True

    except Exception as app_err:
        stderr_data += f"\nModal app error: {app_err}\n"
        exit_code = 1
    finally:
        if sb is not None:
            try:
                sb.terminate(wait=True)
            except Exception:
                pass

    # Cap output to MAX_OUTPUT_BYTES; fail closed if output flooded
    combined_len = len(stdout_data) + len(stderr_data)
    truncated = False
    if combined_len > MAX_OUTPUT_BYTES:
        truncated = True
        remaining = max(0, MAX_OUTPUT_BYTES - len(stderr_data))
        stdout_data = stdout_data[:remaining]
        # Fail closed on output flood
        exit_code = 1

    # Oracle verification check:
    # 1. Container exit status must be 0
    # 2. Not timed out and not truncated
    # 3. Output must contain the supervisor success sentinel. This sentinel does not
    #    prove that a candidate could not influence assertions inside the PHP worker.
    # 4. Stderr must NOT contain the premature exit abort marker
    oracle_sentinel = f"[PROOFPATCH_ORACLE_SUCCESS:{oracle_token}]"
    oracle_verified = (
        exit_code == 0
        and not truncated
        and not timed_out
        and (oracle_sentinel in stdout_data)
        and ("[PROOFPATCH_ORACLE_ABORT]" not in stderr_data)
    )

    if not oracle_verified and exit_code == 0:
        exit_code = 1

    # Write private result channel on host (not reachable from sandbox container)
    result_data = {
        "sandbox_id": sandbox_id,
        "exit_code": exit_code,
        "oracle_verified": oracle_verified,
        "oracle_token": oracle_token,
        "stdout": stdout_data,
        "stderr": stderr_data,
        "network_blocked": True,
        "runtime": "gvisor",
        "credentials_mounted": False,
        "volumes_mounted": False,
        "timed_out": timed_out,
        "truncated": truncated,
    }

    try:
        with open(args.result_file, "w", encoding="utf-8") as rf:
            json.dump(result_data, rf, indent=2)
            rf.write("\n")
    except Exception as io_err:
        sys.stderr.write(f"Failed to write private result file: {io_err}\n")
        return 1

    sys.stdout.write(stdout_data)
    sys.stderr.write(stderr_data)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
