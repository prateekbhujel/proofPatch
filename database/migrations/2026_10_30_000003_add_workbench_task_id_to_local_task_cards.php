<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('local_task_cards', function (Blueprint $table): void {
            $table->unsignedBigInteger('workbench_task_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('local_task_cards', function (Blueprint $table): void {
            $table->dropColumn('workbench_task_id');
        });
    }
};
