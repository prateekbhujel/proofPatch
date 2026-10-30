<?php

declare(strict_types=1);

namespace ProofPatch\Models;

use Illuminate\Database\Eloquent\Model;

/** A user-written local task; it has not been assigned to a model. */
final class LocalTaskCard extends Model
{
    protected $table = 'local_task_cards';

    protected $guarded = [];

    public function toBoardArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'repository' => $this->repository,
            'status' => $this->status,
            'hasImage' => $this->image_mime !== null,
            'workbenchTaskId' => $this->workbench_task_id,
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
