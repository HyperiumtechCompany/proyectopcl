<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        $create = function (string $name, Closure $definition) use ($schema): void {
            if (! $schema->hasTable($name)) {
                $schema->create($name, $definition);
            }
        };

        // Líneas de Gastos Generales (grupo fijo/variable, agrupadas por rubro libre). Compartidas entre escenarios.
        $create('mantenimiento_gg_linea', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->string('grupo', 10); // fijo | variable
            $table->string('rubro', 150);
            $table->text('descripcion');
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad', 20, 10)->default(0);
            $table->decimal('costo_unitario', 20, 10)->default(0);
            $table->decimal('gasto_proyectado', 20, 10)->nullable();
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->string('origen', 10)->default('manual');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['documento_id', 'grupo', 'sort_order'], 'mant_gg_documento_grupo_orden_idx');
        });

        // Pagos dinámicos fechados ("GASTO REALIZADO"), por escenario. Análogo a mantenimiento_mo_serie.
        $create('mantenimiento_gg_pago', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('escenario_id')->constrained('mantenimiento_escenarios')->cascadeOnDelete();
            $table->unsignedSmallInteger('indice');
            $table->date('fecha')->nullable();
            $table->string('etiqueta', 80)->nullable();
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->timestamps();
            $table->unique(['escenario_id', 'indice'], 'mant_gg_pago_escenario_indice_unique');
        });

        // Valores dispersos: pago × línea -> monto. Análogo a mantenimiento_mo_parcial.
        $create('mantenimiento_gg_pago_valor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pago_id')->constrained('mantenimiento_gg_pago')->cascadeOnDelete();
            $table->char('linea_public_id', 26);
            $table->bigInteger('monto_minor')->default(0);
            $table->timestamps();
            $table->unique(['pago_id', 'linea_public_id'], 'mant_gg_pago_valor_unique');
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        $schema->dropIfExists('mantenimiento_gg_pago_valor');
        $schema->dropIfExists('mantenimiento_gg_pago');
        $schema->dropIfExists('mantenimiento_gg_linea');
    }
};
