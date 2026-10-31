<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('auto_review_worker_heartbeats', function (Blueprint $table): void {
            $table->id();
            $table->string('worker_id')->unique();
            $table->unsignedInteger('pid');
            $table->string('hostname');
            $table->string('status'); // 'running', 'stopped'
            $table->unsignedBigInteger('cycle_count')->default(0);
            $table->timestamp('last_heartbeat_at');
            $table->timestamp('started_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_review_worker_heartbeats');
    }
};
