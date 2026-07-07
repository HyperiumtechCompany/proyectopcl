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
        Schema::table('gestor_proyecto_nodos', function (Blueprint $table) {
            $table->decimal('peso', 12, 6)->nullable()->after('content');
            $table->decimal('dias', 10, 2)->nullable()->after('peso');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gestor_proyecto_nodos', function (Blueprint $table) {
            $table->dropColumn(['peso', 'dias']);
        });
    }
};
