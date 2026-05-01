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
        Schema::create('balance_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('balance_id')->constrained()->cascadeOnDelete();

            $table->enum('tipo', ['ingreso', 'gasto']);

            $table->string('categoria')->nullable();
            $table->string('descripcion');

            $table->decimal('ene', 10, 2)->default(0);
            $table->decimal('feb', 10, 2)->default(0);
            $table->decimal('mar', 10, 2)->default(0);
            $table->decimal('abr', 10, 2)->default(0);
            $table->decimal('may', 10, 2)->default(0);
            $table->decimal('jun', 10, 2)->default(0);
            $table->decimal('jul', 10, 2)->default(0);
            $table->decimal('ago', 10, 2)->default(0);
            $table->decimal('set', 10, 2)->default(0);
            $table->decimal('oct', 10, 2)->default(0);
            $table->decimal('nov', 10, 2)->default(0);
            $table->decimal('dic', 10, 2)->default(0);

            $table->decimal('total', 12, 2)->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('balance_items');
    }
};
