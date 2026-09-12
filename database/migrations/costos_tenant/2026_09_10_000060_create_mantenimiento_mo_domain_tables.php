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

        // Restos del editor genérico v1 y de la primera importación plana (nunca desplegado).
        $schema->disableForeignKeyConstraints();
        foreach ([
            'mantenimiento_formula_dependencias',
            'mantenimiento_celdas',
            'mantenimiento_filas',
            'mantenimiento_columnas',
            'mantenimiento_hojas',
            'mantenimiento_importacion_items',
            'mantenimiento_importaciones',
        ] as $legacy) {
            $schema->dropIfExists($legacy);
        }
        $schema->enableForeignKeyConstraints();

        $create = function (string $name, Closure $definition) use ($schema): void {
            if (! $schema->hasTable($name)) {
                $schema->create($name, $definition);
            }
        };

        $create('mantenimiento_instituciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->string('nombre');
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->char('source_hash', 64)->nullable();
            $table->timestamps();
            $table->index(['documento_id', 'sort_order'], 'mant_ie_documento_orden_idx');
        });

        $create('mantenimiento_partidas', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->char('parent_public_id', 26)->nullable();
            $table->foreignId('institucion_id')->nullable()->constrained('mantenimiento_instituciones')->nullOnDelete();
            $table->string('tipo', 10)->default('partida'); // ie | bloque | partida
            $table->string('item', 50)->nullable();
            $table->boolean('item_entero')->default(false);
            $table->unsignedTinyInteger('nivel')->default(0);
            $table->text('descripcion');
            $table->string('unidad', 20)->nullable();
            $table->decimal('metrado', 20, 10)->default(0);
            $table->decimal('precio_unitario', 20, 10)->default(0);
            $table->decimal('parcial', 20, 10)->default(0);
            $table->json('costos_acu')->nullable(); // { mano_obra, materiales, equipos, subcontratos, subpartidas } unitarios
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->string('origen', 10)->default('import'); // import | manual
            $table->unsignedBigInteger('source_id')->nullable();
            $table->char('source_hash', 64)->nullable();
            $table->timestamp('source_updated_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['documento_id', 'sort_order'], 'mant_part_documento_orden_idx');
            $table->index(['documento_id', 'tipo'], 'mant_part_documento_tipo_idx');
            $table->index('parent_public_id', 'mant_part_parent_idx');
        });

        $create('mantenimiento_escenarios', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->string('tipo_hoja', 10); // mo | mat | gg
            $table->string('nombre');
            $table->boolean('es_activo')->default(false);
            $table->char('base_public_id', 26)->nullable();
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->timestamps();
            $table->unique(['documento_id', 'tipo_hoja', 'nombre'], 'mant_esc_documento_tipo_nombre_unique');
            $table->index(['documento_id', 'tipo_hoja'], 'mant_esc_documento_tipo_idx');
        });

        $create('mantenimiento_mo_partida', function (Blueprint $table) {
            $table->id();
            $table->foreignId('escenario_id')->constrained('mantenimiento_escenarios')->cascadeOnDelete();
            $table->char('partida_public_id', 26);
            $table->decimal('cot_cantidad', 20, 10)->nullable();
            $table->decimal('cot_precio', 20, 10)->nullable();
            $table->bigInteger('presupuesto_minor')->nullable();
            $table->string('presupuesto_source', 10)->default('sugerido'); // sugerido | manual
            $table->text('observacion')->nullable();
            $table->timestamps();
            $table->unique(['escenario_id', 'partida_public_id'], 'mant_mo_part_escenario_partida_unique');
        });

        $create('mantenimiento_mo_serie', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('escenario_id')->constrained('mantenimiento_escenarios')->cascadeOnDelete();
            $table->unsignedSmallInteger('indice');
            $table->date('fecha')->nullable();
            $table->string('etiqueta', 60)->nullable();
            $table->unsignedBigInteger('sort_order')->default(1024);
            $table->timestamps();
            $table->unique(['escenario_id', 'indice'], 'mant_mo_serie_escenario_indice_unique');
        });

        $create('mantenimiento_importaciones', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('documento_id')->constrained('mantenimiento_documentos')->cascadeOnDelete();
            $table->unsignedBigInteger('presupuesto_id')->default(0);
            $table->char('source_hash', 64);
            $table->uuid('idempotency_key');
            $table->string('status', 30)->default('completed');
            $table->json('summary');
            $table->longText('payload');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['documento_id', 'source_hash'], 'mant_import_doc_source_unique');
            $table->unique(['documento_id', 'idempotency_key'], 'mant_import_doc_key_unique');
        });

        $create('mantenimiento_mo_parcial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('serie_id')->constrained('mantenimiento_mo_serie')->cascadeOnDelete();
            $table->char('partida_public_id', 26);
            $table->bigInteger('monto_minor')->default(0);
            $table->timestamps();
            $table->unique(['serie_id', 'partida_public_id'], 'mant_mo_parcial_serie_partida_unique');
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        $schema->dropIfExists('mantenimiento_mo_parcial');
        $schema->dropIfExists('mantenimiento_importaciones');
        $schema->dropIfExists('mantenimiento_mo_serie');
        $schema->dropIfExists('mantenimiento_mo_partida');
        $schema->dropIfExists('mantenimiento_escenarios');
        $schema->dropIfExists('mantenimiento_partidas');
        $schema->dropIfExists('mantenimiento_instituciones');
    }
};
