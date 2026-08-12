<?php

use App\Services\Dialux\V2\LegacyProjectMigrationService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(LegacyProjectMigrationService::class)->migrate();
    }

    /**
     * Los proyectos y sus dependencias siguen siendo válidos para V1.
     * No se elimina información al revertir una migración de datos.
     */
    public function down(): void
    {
        // Intencionalmente irreversible para no destruir trabajo del usuario.
    }
};
