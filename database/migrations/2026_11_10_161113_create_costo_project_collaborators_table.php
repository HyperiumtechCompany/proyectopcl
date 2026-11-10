<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Compartir proyectos de Costos: colaboradores con rol (editor/viewer) y un
     * código de invitación por rol, válido para cualquier usuario del sistema.
     */
    public function up(): void
    {
        Schema::create('costo_project_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('costo_project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20)->default('viewer'); // 'editor' | 'viewer'
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['costo_project_id', 'user_id'], 'costo_collab_unique');
        });

        Schema::table('costo_projects', function (Blueprint $table) {
            $table->string('share_code_editor', 8)->nullable()->unique()->after('database_name');
            $table->string('share_code_viewer', 8)->nullable()->unique()->after('share_code_editor');
        });
    }

    public function down(): void
    {
        Schema::table('costo_projects', function (Blueprint $table) {
            $table->dropUnique(['share_code_editor']);
            $table->dropUnique(['share_code_viewer']);
            $table->dropColumn(['share_code_editor', 'share_code_viewer']);
        });

        Schema::dropIfExists('costo_project_collaborators');
    }
};
