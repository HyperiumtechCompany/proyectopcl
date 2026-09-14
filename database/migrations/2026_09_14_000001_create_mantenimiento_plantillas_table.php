<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Conexión DEFAULT (no costos_tenant): cada CostoProject vive en su propia base de datos
        // aislada, así que una plantilla guardada ahí no sería reutilizable en otro proyecto. Las
        // plantillas viven a nivel de usuario, en la base central, para poder aplicarse en
        // cualquier documento de Mantenimiento de cualquiera de sus proyectos.
        Schema::create('mantenimiento_plantillas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            // Snapshot del árbol de una institución (bloques/partidas), NO un vínculo vivo a la
            // institución origen (que puede vivir en otra base de datos de tenant por completo).
            $table->json('estructura');
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mantenimiento_plantillas');
    }
};
