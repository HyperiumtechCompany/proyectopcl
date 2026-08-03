<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Orden alto y fijo para que el nodo cola quede siempre al final del flujo principal,
     * sin importar cuantos nodos hijo se agreguen despues entre la cabeza y la cola.
     */
    private const TAIL_ORDER = 1000000;

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gestor_proyecto_nodos', function (Blueprint $table) {
            $table->enum('role', ['head', 'tail'])->nullable()->after('parent_id');
        });

        DB::table('gestor_proyecto_nodos')->whereNull('parent_id')->update(['role' => 'head']);

        $this->backfillTailNodes();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gestor_proyecto_nodos', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }

    /**
     * Crea el nodo cola "Expediente Tecnico" para proyectos existentes que aun no lo tengan.
     */
    private function backfillTailNodes(): void
    {
        $now = now();

        $proyectoIds = DB::table('gestor_proyectos')->pluck('id');

        foreach ($proyectoIds as $proyectoId) {
            $head = DB::table('gestor_proyecto_nodos')
                ->where('gestor_proyecto_id', $proyectoId)
                ->whereNull('parent_id')
                ->first(['id']);

            if ($head === null) {
                continue;
            }

            $hasTail = DB::table('gestor_proyecto_nodos')
                ->where('gestor_proyecto_id', $proyectoId)
                ->where('role', 'tail')
                ->exists();

            if ($hasTail) {
                continue;
            }

            DB::table('gestor_proyecto_nodos')->insert([
                'gestor_proyecto_id' => $proyectoId,
                'parent_id' => $head->id,
                'role' => 'tail',
                'title' => 'Expediente Tecnico',
                'type' => 'text',
                'shape' => 'square',
                'color' => 'amber',
                'status' => 'Pendiente',
                'content' => json_encode(['text' => 'Cierre del proyecto: expediente tecnico final.']),
                'order' => self::TAIL_ORDER,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
