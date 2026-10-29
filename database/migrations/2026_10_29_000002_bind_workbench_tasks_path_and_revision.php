<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use ProofPatch\Models\WorkbenchTask;

return new class extends Migration {
    public function up(): void
    {
        // Backfill existing workbench_tasks keys to include target path and base commit revision
        // Preserves all existing tasks, IDs, evidence, and PR references.
        $tasks = DB::table('workbench_tasks')->get();
        foreach ($tasks as $task) {
            $path = (string) ($task->path ?? 'src/OrderTotal.php');
            $commit = $task->commit ? (string) $task->commit : null;
            $newKey = WorkbenchTask::computeKey(
                (string) $task->repository,
                (int) $task->issue_number,
                $path,
                $commit
            );

            if ($task->key !== $newKey) {
                $exists = DB::table('workbench_tasks')->where('key', $newKey)->exists();
                if (!$exists) {
                    DB::table('workbench_tasks')->where('id', $task->id)->update(['key' => $newKey]);
                }
            }
        }
    }

    public function down(): void
    {
    }
};
