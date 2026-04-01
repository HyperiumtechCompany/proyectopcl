<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        // ══════════════════════════════════════════════════════════════════════
        // 5. PRESUPUESTO GENERAL — partidas WBS
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_general')) {
            Schema::connection($this->connection)->create('presupuesto_general', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('partida', 50);
                $table->text('descripcion');
                $table->string('unidad', 20)->nullable();
                $table->decimal('metrado', 15, 4)->default(0);
                $table->decimal('precio_unitario', 15, 4)->default(0);
                $table->decimal('parcial', 15, 4)->storedAs('metrado * precio_unitario')
                    ->comment('metrado × precio_unitario');

                $table->string('metrado_source', 50)->nullable();
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();
                $table->softDeletes();

                $table->index('presupuesto_id', 'idx_pg_presupuesto');
                $table->index('partida',        'idx_pg_partida');
                $table->index('item_order',     'idx_pg_order');
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 14. PRESUPUESTO ÍNDICES (fórmula polinómica)
        // ══════════════════════════════════════════════════════════════════════
        if (!Schema::connection($this->connection)->hasTable('presupuesto_indices')) {
            Schema::connection($this->connection)->create('presupuesto_indices', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presupuesto_id');
                $table->foreign('presupuesto_id')->references('id')->on('presupuestos')->cascadeOnDelete();

                $table->string('simbolo', 10)->comment('M, MO, EQ, GG');
                $table->text('descripcion');
                $table->decimal('coeficiente',   10, 6)->default(0);
                $table->decimal('indice_base',   15, 4)->default(100);
                $table->decimal('indice_actual', 15, 4)->default(100);
                $table->decimal('monomio',       10, 6)
                    ->storedAs('coeficiente * (indice_actual / indice_base)');
                $table->date('fecha_indice_base')->nullable();
                $table->date('fecha_indice_actual')->nullable();
                $table->unsignedSmallInteger('item_order')->default(0);
                $table->timestamps();

                $table->index('presupuesto_id', 'idx_idx_presupuesto');
                $table->index('simbolo',        'idx_idx_simbolo');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('presupuesto_indices');
        Schema::connection($this->connection)->dropIfExists('presupuesto_general');
    }
};
