<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inline_comment_attempts', function (Blueprint $table): void {
            $table->id();
            $table->string('digest', 64)->unique();
            $table->string('status');
            $table->unsignedBigInteger('comment_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inline_comment_attempts');
    }
};
