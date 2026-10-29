<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('workbench_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('repository');
            $table->unsignedBigInteger('issue_number');
            $table->string('issue_url')->nullable();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('path');
            $table->string('commit', 40)->nullable();
            $table->string('status')->default('queued'); // queued, in_progress, needs_review, completed, failed
            $table->string('provenance')->nullable();
            $table->boolean('is_dedicated')->default(false);
            $table->boolean('is_synthetic')->default(false);
            $table->boolean('is_offline_example')->default(false);
            $table->boolean('is_simulated')->default(false);
            $table->string('proposal_digest', 64)->nullable();
            $table->longText('candidate_source')->nullable();
            $table->string('candidate_sha256', 64)->nullable();
            $table->string('verification_report_id')->nullable();
            $table->string('verification_decision')->nullable();
            $table->unsignedBigInteger('published_pr_number')->nullable();
            $table->string('published_pr_url')->nullable();
            $table->string('published_branch')->nullable();
            $table->string('published_receipt_sha', 64)->nullable();
            $table->json('context_payload')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workbench_tasks');
    }
};
