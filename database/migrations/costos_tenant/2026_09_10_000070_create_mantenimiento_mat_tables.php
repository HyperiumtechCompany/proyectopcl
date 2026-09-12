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

        // Materiales del ACU (snapshot compartido entre escenarios, como mantenimiento_partidas).
        $create('mantenimiento_mat_material', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->char('partida_public_id', 26);
            $table->text('descripcion');
            $table->string('unidad', 20)->nullable();
            $table->decimal('cantidad', 20, 10)->default(0);
            $table->decimal('precio_unitario', 20, 10)->default(0);
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->string('origen', 10)->default('import'); // import | manual
            $table->unsignedBigInteger('source_id')->nullable();
            $table->char('source_hash', 64)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['documento_id', 'sort_order'], 'mant_mat_documento_orden_idx');
            $table->index('partida_public_id', 'mant_mat_partida_idx');
        });

        // 3 cotizaciones fijas por material (slot 1..3), por escenario.
        $create('mantenimiento_mat_cotizacion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('escenario_id')->constrained('mantenimiento_escenarios')->cascadeOnDelete();
            $table->char('material_public_id', 26);
            $table->unsignedTinyInteger('slot'); // 1 | 2 | 3
            $table->string('proveedor', 120)->nullable();
            $table->decimal('cantidad', 20, 10)->nullable();
            $table->decimal('precio', 20, 10)->nullable();
            $table->timestamps();
            $table->unique(['escenario_id', 'material_public_id', 'slot'], 'mant_mat_cot_unique');
        });

        // Compras dinámicas fechadas, por escenario.
        $create('mantenimiento_mat_compra', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('escenario_id')->constrained('mantenimiento_escenarios')->cascadeOnDelete();
            $table->unsignedSmallInteger('indice');
            $table->date('fecha')->nullable();
            $table->string('etiqueta', 80)->nullable();
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->timestamps();
            $table->unique(['escenario_id', 'indice'], 'mant_mat_compra_escenario_indice_unique');
        });

        // Valores dispersos: compra × material (cantidad, precio) -> subtotal calculado.
        $create('mantenimiento_mat_compra_valor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compra_id')->constrained('mantenimiento_mat_compra')->cascadeOnDelete();
            $table->char('material_public_id', 26);
            $table->decimal('cantidad', 20, 10)->nullable();
            $table->decimal('precio', 20, 10)->nullable();
            $table->timestamps();
            $table->unique(['compra_id', 'material_public_id'], 'mant_mat_compra_valor_unique');
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        $schema->dropIfExists('mantenimiento_mat_compra_valor');
        $schema->dropIfExists('mantenimiento_mat_compra');
        $schema->dropIfExists('mantenimiento_mat_cotizacion');
        $schema->dropIfExists('mantenimiento_mat_material');
    }
};
