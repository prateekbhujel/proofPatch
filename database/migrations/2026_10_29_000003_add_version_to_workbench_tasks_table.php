<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('workbench_tasks') && !Schema::hasColumn('workbench_tasks', 'version')) {
            Schema::table('workbench_tasks', function (Blueprint $table): void {
                $table->unsignedInteger('version')->default(1);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('workbench_tasks') && Schema::hasColumn('workbench_tasks', 'version')) {
            Schema::table('workbench_tasks', function (Blueprint $table): void {
                $table->dropColumn('version');
            });
        }
    }
};
