<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('local_task_cards', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('github_user_id');
            $table->string('repository');
            $table->string('title', 180);
            $table->text('description');
            $table->string('status')->default('queued');
            $table->timestamps();
            $table->index(['github_user_id', 'repository']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('local_task_cards');
    }
};
