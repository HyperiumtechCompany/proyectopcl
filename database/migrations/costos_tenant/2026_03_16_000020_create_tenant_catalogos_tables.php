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
        // 15. CATÁLOGOS GLOBALES DE INSUMOS (sin presupuesto_id)
        // ══════════════════════════════════════════════════════════════════════
        if(!Schema::connection($this->connection)->hasTable('unidad')){
            Schema::connection($this->connection)->create('unidad', function (Blueprint $table) {
                $table->id();
                $table->string('descripcion', 20)->unique();
                $table->string('descripcion_singular', 255);
                $table->string('orden', 255);
                $table->string('informacion_unidad', 255);
                $table->string('abreviatura_unidad', 255);
                $table->timestamps();
            });
        }

        if(!Schema::connection($this->connection)->hasTable('diccionario')){
            Schema::connection($this->connection)->create('diccionario', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 20);
                $table->string('descripcion', 255);
                $table->timestamps();

                $table->index('codigo', 'idx_dicc_codigo');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('insumo_productos')) {
            Schema::connection($this->connection)->create('insumo_productos', function (Blueprint $table) {
                $table->id();
                $table->string('codigo_producto', 50)->unique();
                $table->text('descripcion');
                $table->text('especificaciones')->nullable();
                
                $table->unsignedBigInteger('diccionario_id')->nullable();
                $table->foreign('diccionario_id')->references('id')->on('diccionario')->nullOnDelete();
                
                $table->unsignedBigInteger('unidad_id')->nullable();
                $table->foreign('unidad_id')->references('id')->on('unidad')->nullOnDelete();
                
                $table->string('tipo_proveedor', 3)->default('001');

                $table->decimal('costo_unitario_lista', 15, 4)->default(0);
                $table->decimal('costo_unitario',       15, 4)->default(0);
                $table->decimal('costo_flete',          15, 4)->default(0);
                $table->date('fecha_lista')->nullable();
                
                $table->string('tipo', 20)->comment('mano_de_obra | materiales | equipos | subcontratos | subpartidas');
                $table->boolean('estado')->default(true);
                $table->timestamps();

                $table->index('codigo_producto', 'idx_ip_codigo');
                $table->index('tipo',            'idx_ip_tipo');
                $table->index('diccionario_id',  'idx_ip_dicc');
                $table->index('unidad_id',       'idx_ip_und');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('insumo_productos');
        Schema::connection($this->connection)->dropIfExists('diccionario');
        Schema::connection($this->connection)->dropIfExists('unidad');
    }
};
