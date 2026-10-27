<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('review_jobs', function (Blueprint $table): void {
            $table->id();
            $table->string('snapshot_id')->unique();
            $table->string('snapshot_sha256', 64);
            $table->string('repository');
            $table->unsignedBigInteger('pull_number');
            $table->string('head_sha', 40);
            $table->string('status');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_jobs');
    }
};
