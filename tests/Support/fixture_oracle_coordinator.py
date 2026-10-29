#!/usr/bin/env python3
"""Offline, pinned-fixture oracle coordinator.

This module is not connected to the application or any provider. It runs only a
trusted, digest-pinned test harness and a fixed bridge; it NEVER runs candidate
code. The injected callback is a trusted offline test double, not a sandbox.

A passing result means only that callback-provided integers matched the pinned
harness's finite checks. It cannot prove that a candidate function returned,
that a sandbox is isolated, or that a patch is safe to publish. A synchronous
callback cannot be forcibly interrupted; production use needs a cancellable,
bounded transport and independent security review.
"""

from __future__ import annotations

import hashlib
import json
import os
import selectors
import shutil
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Callable

PINNED_HARNESS_SHA256 = "b8079fb1e7731fc763f0b009a11c2786d01b52cce08f7431768a64e8a5ef2cbf"
MAX_CALLS = 16
MAX_FRAME_BYTES = 4096
MAX_OUTPUT_BYTES = 16384
MAX_RUNTIME_SECONDS = 10.0

# The original harness requires this file. This fixed bridge writes each input
# as one bounded frame to its trusted parent and reads a single JSON response.
# No candidate source or other externally supplied PHP is written here.
_BRIDGE = r'''<?php
declare(strict_types=1);
function orderTotal(array $items): int
{
    $json = json_encode($items, JSON_THROW_ON_ERROR);
    if (strlen($json) > 4096) { throw new RuntimeException('Input too large'); }
    fwrite(STDOUT, "PP_CALL " . $json . "\n");
    fflush(STDOUT);
    $line = fgets(STDIN, 4097);
    if ($line === false || !str_ends_with($line, "\n")) {
        throw new RuntimeException('Missing bridge response');
    }
    $response = json_decode($line, true, 32, JSON_THROW_ON_ERROR);
    if (!is_int($response)) { throw new RuntimeException('Invalid bridge response'); }
    return $response;
}
'''


def run_pinned_fixture(
    harness: bytes,
    transport: Callable[[list], object],
    *,
    timeout_seconds: float = 3.0,
    max_calls: int = MAX_CALLS,
) -> dict:
    """Run the exact trusted fixture with a synchronous offline fake transport.

    `transport` receives only decoded fixture inputs and must promptly return a
    Python integer. This function checks its deadline before and after calls,
    but cannot preempt a blocking callback. Do not connect real providers here.
    """
    if not isinstance(harness, bytes) or hashlib.sha256(harness).hexdigest() != PINNED_HARNESS_SHA256:
        raise ValueError("Only the pinned fixture harness is supported")
    if not callable(transport):
        raise ValueError("An offline fake transport is required")
    if not 0 < timeout_seconds <= MAX_RUNTIME_SECONDS or not 1 <= max_calls <= MAX_CALLS:
        raise ValueError("Invalid fixture resource limits")
    if os.name != "posix":
        raise RuntimeError("Offline fixture coordinator currently requires POSIX process groups")
    php_binary = shutil.which("php")
    if not php_binary:
        raise RuntimeError("PHP CLI is unavailable")

    deadline = time.monotonic() + timeout_seconds
    stdout = bytearray()
    stderr = bytearray()
    frame = bytearray()
    calls = 0
    total_read = 0
    failure = None
    proc = None
    observed_exit = None

    with tempfile.TemporaryDirectory(prefix="proofpatch-oracle-fixture-") as work:
        root = Path(work)
        (root / "tests").mkdir(mode=0o700)
        (root / "src").mkdir(mode=0o700)
        (root / "tests" / "order_total.php").write_bytes(harness)
        (root / "src" / "OrderTotal.php").write_text(_BRIDGE, encoding="utf-8")
        proc = subprocess.Popen(
            [php_binary, "-n", str(root / "tests" / "order_total.php")],
            cwd=work, env={}, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, start_new_session=True,
        )
        assert proc.stdin is not None and proc.stdout is not None and proc.stderr is not None
        selector = selectors.DefaultSelector()
        try:
            for stream, label in ((proc.stdout, "out"), (proc.stderr, "err")):
                os.set_blocking(stream.fileno(), False)
                selector.register(stream, selectors.EVENT_READ, label)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    failure = "Fixture deadline exceeded"
                    break
                events = selector.select(min(remaining, 0.05))
                for key, _ in events:
                    chunk = os.read(key.fileobj.fileno(), 4096)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    total_read += len(chunk)
                    if total_read > MAX_OUTPUT_BYTES:
                        failure = "Fixture output limit exceeded"
                        break
                    if key.data == "err":
                        stderr.extend(chunk)
                        continue
                    frame.extend(chunk)
                    while b"\n" in frame:
                        line, _, rest = frame.partition(b"\n")
                        frame[:] = rest
                        if line.startswith(b"PP_CALL "):
                            if len(line) > MAX_FRAME_BYTES or calls >= max_calls:
                                failure = "Fixture call limit exceeded"
                                break
                            try:
                                items = json.loads(line[8:])
                                if not isinstance(items, list):
                                    raise ValueError("Fixture input is not an array")
                                calls += 1
                                value = transport(items)
                                if time.monotonic() >= deadline:
                                    failure = "Fixture deadline exceeded"
                                    break
                                if type(value) is not int or not -(2**63) <= value < 2**63:
                                    raise ValueError("Transport did not return an integer")
                                proc.stdin.write((json.dumps(value) + "\n").encode("ascii"))
                                proc.stdin.flush()
                            except Exception:
                                failure = "Offline transport failed"
                                break
                        else:
                            stdout.extend(line + b"\n")
                    if failure:
                        break
                    if len(frame) > MAX_FRAME_BYTES:
                        failure = "Fixture frame limit exceeded"
                        break
                if failure:
                    break
            if not failure and frame:
                failure = "Incomplete fixture frame"
            if not failure:
                try:
                    observed_exit = proc.wait(timeout=max(0.001, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    failure = "Fixture deadline exceeded"
            if not failure and observed_exit == 0 and (
                calls == 0 or bytes(stdout) != b"All order total cases passed.\n" or stderr
            ):
                failure = "Fixture did not complete as expected"
        finally:
            selector.close()
            if failure or proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            try:
                proc.wait(timeout=1)
            finally:
                proc.stdin.close()
                proc.stdout.close()
                proc.stderr.close()

    return {
        "status": "aborted" if failure else ("fixture_passed" if observed_exit == 0 else "fixture_failed"),
        "exit_code": observed_exit,
        "calls": calls,
        "stdout": stdout.decode("utf-8", "replace"),
        "stderr": stderr.decode("utf-8", "replace"),
        "reason": failure,
        "assurance": "offline fixture observations only; no candidate or sandbox executed",
    }
