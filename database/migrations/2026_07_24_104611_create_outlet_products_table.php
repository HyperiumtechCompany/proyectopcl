<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outlet_products', function (Blueprint $table) {
            $table->id();

            // Propietario — NULL = producto global (catálogo del sistema)
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Identificación del producto
            $table->string('name');
            $table->string('manufacturer')->nullable();
            $table->string('catalog_number')->nullable();

            // Tipo de montaje — determina el símbolo CAD y la altura por
            // defecto (ver ELECTRICAL_DEVICE_DEFAULTS en el frontend).
            $table->enum('device_type', [
                'outlet_floor', 'outlet_initial', 'outlet_high_180',
                'outlet_floor_box', 'outlet_waterproof', 'outlet_ceiling', 'outlet_rack',
            ]);

            // Potencia asignada (VA), usada como PI tomas en Cálculo CT.
            $table->unsignedInteger('rated_power_w')->default(180);
            $table->string('ip_rating')->nullable(); // ej. "IP65"
            $table->string('product_image_path')->nullable();

            $table->boolean('is_global')->default(false); // true = admin curado

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'device_type']);
            $table->index('manufacturer');
            $table->index('is_global');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outlet_products');
    }
};
