<?php

declare(strict_types=1);

namespace ProofPatch\Support;

use ProofPatch\Models\AutoReviewWorkerHeartbeat;

final class WorkerStatusService
{
    private const HEARTBEAT_TIMEOUT_SECONDS = 45;

    /**
     * Accurately determines if the local auto-review worker is currently live and active.
     * Distinguishes a long-running busy request from a dead process.
     * Cannot claim running while computer is off or worker process is terminated.
     *
     * @return array{
     *     isLive: bool,
     *     status: 'running'|'busy'|'offline',
     *     workerPid: ?int,
     *     lastHeartbeatAt: ?string,
     *     cycleCount: int,
     *     publicOnly: true,
     *     message: string
     * }
     */
    public function getStatus(): array
    {
        try {
            $latest = AutoReviewWorkerHeartbeat::orderBy('last_heartbeat_at', 'desc')->first();
        } catch (\Throwable) {
            $latest = null;
        }

        if ($latest === null) {
            return [
                'isLive' => false,
                'status' => 'offline',
                'workerPid' => null,
                'lastHeartbeatAt' => null,
                'cycleCount' => 0,
                'publicOnly' => true,
                'message' => 'Review worker is offline. Start the worker locally with: php artisan review:poll',
            ];
        }

        $now = time();
        $lastBeatTime = $latest->last_heartbeat_at ? $latest->last_heartbeat_at->getTimestamp() : 0;
        $secondsSinceBeat = $now - $lastBeatTime;

        if ($latest->status !== 'running') {
            return [
                'isLive' => false,
                'status' => 'offline',
                'workerPid' => $latest->pid,
                'lastHeartbeatAt' => $latest->last_heartbeat_at?->toIso8601String(),
                'cycleCount' => (int) $latest->cycle_count,
                'publicOnly' => true,
                'message' => 'Review worker is stopped.',
            ];
        }

        // Check process liveness on local host
        $isProcessAlive = true;
        if (function_exists('posix_kill') && $latest->pid > 0) {
            $isProcessAlive = @posix_kill($latest->pid, 0);
        }

        if (!$isProcessAlive) {
            // Process is dead
            AutoReviewWorkerHeartbeat::stopBeat($latest->worker_id);
            return [
                'isLive' => false,
                'status' => 'offline',
                'workerPid' => $latest->pid,
                'lastHeartbeatAt' => $latest->last_heartbeat_at?->toIso8601String(),
                'cycleCount' => (int) $latest->cycle_count,
                'publicOnly' => true,
                'message' => 'Review worker process has terminated (dead process). Worker is offline.',
            ];
        }

        // Process is confirmed ALIVE
        if ($secondsSinceBeat > self::HEARTBEAT_TIMEOUT_SECONDS) {
            // Process is alive but heartbeat exceeded normal interval -> long-running request (network diff fetch or model inference)
            return [
                'isLive' => true,
                'status' => 'busy',
                'workerPid' => $latest->pid,
                'lastHeartbeatAt' => $latest->last_heartbeat_at?->toIso8601String(),
                'cycleCount' => (int) $latest->cycle_count,
                'publicOnly' => true,
                'message' => "Review worker is active on a long-running request (PID: {$latest->pid}, elapsed: {$secondsSinceBeat}s).",
            ];
        }

        return [
            'isLive' => true,
            'status' => 'running',
            'workerPid' => $latest->pid,
            'lastHeartbeatAt' => $latest->last_heartbeat_at?->toIso8601String(),
            'cycleCount' => (int) $latest->cycle_count,
            'publicOnly' => true,
            'message' => "Review worker is running locally (PID: {$latest->pid}, cycles: {$latest->cycle_count}).",
        ];
    }
}
