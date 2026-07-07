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
        Schema::table('gestor_proyectos', function (Blueprint $table) {
            $table->string('numero_expediente')->nullable()->after('descripcion');
            $table->string('responsable')->nullable()->after('numero_expediente');
            $table->unsignedInteger('cantidad_modulos')->nullable()->after('responsable');
            $table->decimal('monto_designado', 14, 2)->nullable()->after('cantidad_modulos');
            $table->unsignedInteger('tiempo_estimado_dias')->nullable()->after('monto_designado');
            $table->date('fecha_inicio')->nullable()->after('tiempo_estimado_dias');
            $table->date('fecha_fin')->nullable()->after('fecha_inicio');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gestor_proyectos', function (Blueprint $table) {
            $table->dropColumn([
                'numero_expediente',
                'responsable',
                'cantidad_modulos',
                'monto_designado',
                'tiempo_estimado_dias',
                'fecha_inicio',
                'fecha_fin',
            ]);
        });
    }
};
