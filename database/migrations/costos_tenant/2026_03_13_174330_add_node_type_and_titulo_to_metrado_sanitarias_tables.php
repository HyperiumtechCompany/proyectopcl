<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = [
            'metrado_sanitarias_modulos',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_cisterna',
            'metrado_sanitarias_resumen'
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('node_type', 20)->default('partida')->after('item_order');
                $table->string('titulo', 255)->nullable()->after('node_type');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'metrado_sanitarias_modulos',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_cisterna',
            'metrado_sanitarias_resumen'
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn(['node_type', 'titulo']);
            });
        }
    }
};
