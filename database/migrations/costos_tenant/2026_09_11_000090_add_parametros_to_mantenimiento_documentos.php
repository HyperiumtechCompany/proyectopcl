<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        // Reparación: `_000020_create_mantenimiento_editor_tables` ya declara `parametros`,
        // pero tenants migrados antes de que esa columna se agregara al archivo se quedaron
        // sin ella (las migraciones no se re-corren). Aditivo e idempotente.
        if ($schema->hasTable('mantenimiento_documentos') && ! $schema->hasColumn('mantenimiento_documentos', 'parametros')) {
            $schema->table('mantenimiento_documentos', function (Blueprint $table) {
                $table->json('parametros')->nullable()->after('config');
            });
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);
        if ($schema->hasTable('mantenimiento_documentos') && $schema->hasColumn('mantenimiento_documentos', 'parametros')) {
            $schema->table('mantenimiento_documentos', function (Blueprint $table) {
                $table->dropColumn('parametros');
            });
        }
    }
};
