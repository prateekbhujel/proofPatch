<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('auto_review_results', function (Blueprint $table): void {
            $table->id();
            $table->string('repository');
            $table->unsignedBigInteger('pull_number');
            $table->string('head_sha', 40);
            $table->string('base_sha', 40);
            $table->string('status'); // 'in_progress', 'completed', 'failed', 'unknown', 'skipped_private', 'skipped_budget', 'skipped_opted_out'
            $table->boolean('is_public')->default(true);
            $table->text('summary')->nullable();
            $table->string('risk_level')->nullable(); // 'low', 'medium', 'high'
            $table->string('recommendation')->nullable(); // 'approve', 'request_changes', 'discuss'
            $table->json('file_findings')->nullable();
            $table->json('raw_review')->nullable();
            $table->json('usage')->nullable();
            $table->text('error_message')->nullable();
            $table->string('published_status')->default('local_only'); // strictly generated local review, not posted to GitHub
            $table->string('model')->default('meta-models/muse-spark-open-1026');
            $table->string('input_digest', 64)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            // Unique index across repository, PR, head_sha, AND base_sha:
            // Allows atomic unique INSERT claim and distinctly tracks base-branch changes / rebases!
            $table->unique(['repository', 'pull_number', 'head_sha', 'base_sha'], 'auto_reviews_repo_pr_head_base_unique');
            $table->index(['repository', 'pull_number']);
            $table->index(['repository', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_review_results');
    }
};
