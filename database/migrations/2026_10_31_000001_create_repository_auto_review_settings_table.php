<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('repository_auto_review_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('repository')->unique();
            $table->boolean('enabled')->default(false);
            $table->boolean('public_only')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repository_auto_review_settings');
    }
};
