<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (Schema::connection($this->connection)->hasTable('wbs_snapshots')) {
            return;
        }

        // Red de seguridad: copia de las filas de cronograma_general /
        // presupuesto_general justo antes de cada reescritura masiva. El cliente
        // no tiene backups de BD; esto permite "revertir al guardado anterior".
        Schema::connection($this->connection)->create('wbs_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('presupuesto_id')->nullable();
            $table->string('tabla', 40); // cronograma_general | presupuesto_general
            $table->string('motivo', 60)->nullable(); // p.ej. "cronograma_v2_save"
            $table->unsignedInteger('filas')->default(0);
            $table->longText('payload'); // JSON: array de filas tal cual estaban
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['presupuesto_id', 'tabla', 'created_at'], 'idx_wbs_snap_scope');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('wbs_snapshots');
    }
};
