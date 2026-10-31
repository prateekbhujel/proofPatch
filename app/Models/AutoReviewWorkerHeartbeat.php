<?php

declare(strict_types=1);

namespace ProofPatch\Models;

use Illuminate\Database\Eloquent\Model;

final class AutoReviewWorkerHeartbeat extends Model
{
    protected $table = 'auto_review_worker_heartbeats';

    protected $fillable = [
        'worker_id',
        'pid',
        'hostname',
        'status',
        'cycle_count',
        'last_heartbeat_at',
        'started_at',
    ];

    protected $casts = [
        'pid' => 'integer',
        'cycle_count' => 'integer',
        'last_heartbeat_at' => 'datetime',
        'started_at' => 'datetime',
    ];

    public static function recordBeat(string $workerId, int $pid, string $hostname, int $cycleCount = 0): self
    {
        return self::updateOrCreate(
            ['worker_id' => $workerId],
            [
                'pid' => $pid,
                'hostname' => $hostname,
                'status' => 'running',
                'cycle_count' => $cycleCount,
                'last_heartbeat_at' => now(),
                'started_at' => now(),
            ]
        );
    }

    public static function updateBeat(string $workerId, int $cycleCount): void
    {
        self::where('worker_id', $workerId)->update([
            'status' => 'running',
            'cycle_count' => $cycleCount,
            'last_heartbeat_at' => now(),
        ]);
    }

    public static function stopBeat(string $workerId): void
    {
        self::where('worker_id', $workerId)->update([
            'status' => 'stopped',
            'last_heartbeat_at' => now(),
        ]);
    }
}
