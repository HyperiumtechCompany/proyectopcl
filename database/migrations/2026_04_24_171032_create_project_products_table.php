<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_products', function (Blueprint $table) {
            $table->id();

            // project_id es el UUID del proyecto DIAlux (string, no FK numérico)
            $table->string('project_id');
            $table->foreignId('product_id')
                ->constrained('luminaire_products')
                ->cascadeOnDelete();

            // Cuántas unidades de este producto se usaron en el proyecto
            $table->unsignedInteger('quantity_used')->default(0);

            // Configuración de colocación en el proyecto
            $table->json('placement_config')->nullable();
            // Ej: { "mounting_height": 2.8, "grid_rows": 3, "grid_cols": 4,
            //       "room_id": "uuid", "ambient_id": "uuid" }

            $table->timestamps();

            $table->unique(['project_id', 'product_id']);
            $table->index('project_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_products');
    }
};
