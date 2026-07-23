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
        // RN-03: reglas configurables de tomacorrientes por tipo de ambiente.
        // user_id null = regla por defecto del sistema; con user_id = override del usuario.
        Schema::create('dialux_outlet_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('room_type');                 // aula, comedor, oficina, exterior, ...
            $table->string('method', 16);                // area | perimeter | fixed
            $table->decimal('value', 8, 2);              // m²/punto, m/punto o cantidad fija
            $table->string('unit', 16);                  // m2_per_point | m_per_point | points
            $table->decimal('power_per_outlet_va', 8, 2)->default(180); // VA por punto (CNE)
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'room_type']);
        });

        // RN-04: tipos de tomacorriente con altura configurable.
        Schema::create('dialux_outlet_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 32);                  // bajo, inicial, alto, comunicaciones, techo, piso, exterior, especial
            $table->decimal('height_m', 5, 2)->nullable(); // null = según proyecto (techo/piso/especial)
            $table->string('height_label')->nullable();  // "0.40 m", "Techo", "Nivel de piso"
            $table->string('use_description')->nullable();
            $table->string('ip_rating', 8)->nullable();
            $table->string('box_type')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'code']);
        });

        // Catálogo de conductores: sección real en mm², AWG solo referencial.
        Schema::create('dialux_conductors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('material', 16)->default('cobre');
            $table->decimal('section_mm2', 7, 2);
            $table->string('awg_ref', 8)->nullable();    // "14", "12", "2/0"...
            $table->string('insulation', 16)->default('THW-90');
            $table->decimal('ampacity_a', 7, 1);         // capacidad de corriente (A)
            $table->decimal('price_per_meter', 8, 2)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'material', 'section_mm2', 'insulation'], 'dialux_conductors_unique');
        });

        // RN-05: sección por defecto según tipo de circuito (editable).
        Schema::create('dialux_circuit_defaults', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('circuit_type', 32);          // lighting | outlets | feeder | special
            $table->decimal('min_section_mm2', 7, 2);
            $table->decimal('max_voltage_drop_pct', 4, 2)->default(2.5);
            $table->decimal('demand_factor', 4, 2)->default(1.0);
            $table->unsignedTinyInteger('breaker_poles')->default(2);
            $table->timestamps();

            $table->unique(['user_id', 'circuit_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dialux_circuit_defaults');
        Schema::dropIfExists('dialux_conductors');
        Schema::dropIfExists('dialux_outlet_types');
        Schema::dropIfExists('dialux_outlet_rules');
    }
};
