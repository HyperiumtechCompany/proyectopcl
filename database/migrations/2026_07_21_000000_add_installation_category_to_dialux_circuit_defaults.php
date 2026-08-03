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
        Schema::table('dialux_circuit_defaults', function (Blueprint $table) {
            // residencial (casas) | educativa (colegios) | industrial (zona industrial).
            $table->string('installation_category', 16)->default('residencial')->after('circuit_type');
        });

        Schema::table('dialux_circuit_defaults', function (Blueprint $table) {
            // El nuevo índice único debe crearse ANTES de borrar el viejo:
            // MySQL/InnoDB exige que la FK sobre user_id siempre tenga un
            // índice que la respalde, y el índice viejo (user_id, circuit_type)
            // es el único que la respalda hasta este punto.
            $table->unique(['user_id', 'circuit_type', 'installation_category'], 'dialux_circuit_defaults_unique');
        });

        Schema::table('dialux_circuit_defaults', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'circuit_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dialux_circuit_defaults', function (Blueprint $table) {
            $table->unique(['user_id', 'circuit_type']);
        });

        Schema::table('dialux_circuit_defaults', function (Blueprint $table) {
            $table->dropUnique('dialux_circuit_defaults_unique');
            $table->dropColumn('installation_category');
        });
    }
};
