<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('costo_project_modules', function (Blueprint $table) {
            $table->json('config')->nullable()->after('enabled');
        });
    }

    public function down(): void
    {
        Schema::table('costo_project_modules', function (Blueprint $table) {
            $table->dropColumn('config');
        });
    }
};
