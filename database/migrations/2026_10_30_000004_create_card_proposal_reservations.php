<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('card_proposal_reservations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('github_user_id');
            $table->unsignedBigInteger('card_id');
            $table->string('repository');
            $table->char('card_version', 64);
            $table->char('request_digest', 64);
            $table->char('approval_hash', 64)->unique();
            $table->text('payload');
            $table->string('status');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_proposal_reservations');
    }
};
