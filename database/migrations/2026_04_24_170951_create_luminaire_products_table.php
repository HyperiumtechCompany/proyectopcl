<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('luminaire_products', function (Blueprint $table) {
            $table->id();

            // Propietario — NULL = producto global (catálogo del sistema)
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Identificación del producto
            $table->string('name');
            $table->string('manufacturer')->nullable();
            $table->string('catalog_number')->nullable();
            $table->string('article_number')->nullable();
            $table->string('ean_code')->nullable();
            $table->text('description')->nullable();

            // Archivo fuente
            $table->enum('source_format', ['ies', 'ldt', 'gldf', 'manual'])->default('manual');
            $table->string('source_file_path')->nullable();
            $table->string('source_file_name')->nullable();

            // Datos fotométricos
            $table->float('total_lumens')->nullable();
            $table->float('power_watts')->nullable();
            $table->string('cct')->nullable();           // ej. "4000K"
            $table->float('cri_ra')->nullable();
            $table->float('beam_angle_50')->nullable();  // ángulo 50% Imax (°)
            $table->float('beam_angle_10')->nullable();  // ángulo 10% Imax (°)
            $table->float('max_candela')->nullable();

            // Tipo y forma
            $table->enum('fixture_type', [
                'recessed', 'pendant', 'surface', 'spot', 'strip', 'panel', 'tube', 'other',
            ])->default('other');
            $table->enum('fixture_shape', [
                'round', 'square', 'rectangular', 'cylindrical',
            ])->nullable();

            // Normativa asociada al producto
            $table->enum('normative_standard', [
                'en_12464', 'ies_na', 'universal',
            ])->default('universal');

            // Resumen fotométrico pre-computado (JSON)
            $table->json('photometric_summary')->nullable();
            // Datos completos de la web de candelas (JSON comprimido — solo si < 500 KB)
            $table->json('photometric_web')->nullable();
            // Dimensiones físicas
            $table->json('dimensions')->nullable();       // {length, width, height} en metros
            $table->json('luminous_opening')->nullable(); // {width, length, height}
            // Keywords extra del archivo
            $table->json('metadata')->nullable();

            $table->boolean('is_global')->default(false); // true = admin curado

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'source_format']);
            $table->index('manufacturer');
            $table->index('is_global');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('luminaire_products');
    }
};
