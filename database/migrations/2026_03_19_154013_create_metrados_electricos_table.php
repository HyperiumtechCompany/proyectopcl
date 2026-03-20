<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('metrados_electricos')) {
            Schema::create('metrados_electricos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('project_id');
                $table->string('hoja'); 
                $table->integer('orden');

                $table->string('partida')->nullable();
                $table->text('descripcion')->nullable();
                $table->string('unidad')->nullable();

                $table->decimal('elsim', 10, 2)->default(0);
                $table->decimal('largo', 10, 2)->default(0);
                $table->decimal('ancho', 10, 2)->default(0);
                $table->decimal('alto', 10, 2)->default(0);
                $table->decimal('nveces', 10, 2)->default(0);

                $table->decimal('lon', 10, 2)->default(0);
                $table->decimal('area', 10, 2)->default(0);
                $table->decimal('vol', 10, 2)->default(0);
                $table->decimal('kg', 10, 2)->default(0);
                $table->decimal('und', 10, 2)->default(0);
                $table->decimal('total', 10, 2)->default(0);

                $table->text('observacion')->nullable();
                $table->integer('_level')->default(1);
                $table->string('_kind')->default('leaf');

                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('metrados_electricos');
    }
};
