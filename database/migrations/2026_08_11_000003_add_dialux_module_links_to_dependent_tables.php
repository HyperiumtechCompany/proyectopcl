<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // La comprobación permite reanudar con seguridad si MySQL confirmó
        // una operación DDL anterior antes de que fallara la migración.
        if (! Schema::hasColumn('dialux_plans', 'dialux_module_id')) {
            Schema::table('dialux_plans', function (Blueprint $table) {
                $table->foreignId('dialux_project_id')->nullable()->change();
                $table->foreignId('dialux_module_id')->nullable()->after('dialux_project_id')
                    ->constrained('dialux_modules')->cascadeOnDelete();
            });
        }

        if (! Schema::hasColumn('dialux_plan_files', 'dialux_module_id')) {
            Schema::table('dialux_plan_files', function (Blueprint $table) {
                // Se conserva el índice único legado: además de mantener V1,
                // MySQL lo utiliza como soporte de su clave foránea.
                $table->foreignId('dialux_project_id')->nullable()->change();
                $table->foreignId('dialux_module_id')->nullable()->after('dialux_project_id')
                    ->constrained('dialux_modules')->cascadeOnDelete();
                $table->unique(['dialux_module_id', 'scene_id']);
            });
        }

        Schema::table('dialux_project_normative_configs', function (Blueprint $table) {
            $table->string('dialux_project_id')->nullable()->change();
            $table->foreignId('dialux_module_id')->nullable()->after('dialux_project_id')
                ->constrained('dialux_modules')->cascadeOnDelete();
            $table->unique(['dialux_module_id', 'user_id'], 'dialux_norm_module_user_unique');
        });

        Schema::table('dialux_electrical_projects', function (Blueprint $table) {
            $table->string('dialux_project_id')->nullable()->change();
            $table->foreignId('dialux_module_id')->nullable()->after('dialux_project_id')
                ->constrained('dialux_modules')->cascadeOnDelete();
            $table->unique(['dialux_module_id', 'user_id'], 'dialux_elec_module_user_unique');
        });
    }

    public function down(): void
    {
        DB::table('dialux_plan_files')->whereNull('dialux_project_id')->delete();
        DB::table('dialux_plans')->whereNull('dialux_project_id')->delete();
        DB::table('dialux_project_normative_configs')->whereNull('dialux_project_id')->delete();
        DB::table('dialux_electrical_projects')->whereNull('dialux_project_id')->delete();

        Schema::table('dialux_plan_files', function (Blueprint $table) {
            $table->dropUnique(['dialux_module_id', 'scene_id']);
            $table->dropConstrainedForeignId('dialux_module_id');
            $table->foreignId('dialux_project_id')->nullable(false)->change();
        });

        Schema::table('dialux_plans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dialux_module_id');
            $table->foreignId('dialux_project_id')->nullable(false)->change();
        });

        Schema::table('dialux_project_normative_configs', function (Blueprint $table) {
            $table->dropUnique('dialux_norm_module_user_unique');
            $table->dropConstrainedForeignId('dialux_module_id');
            $table->string('dialux_project_id')->nullable(false)->change();
        });

        Schema::table('dialux_electrical_projects', function (Blueprint $table) {
            $table->dropUnique('dialux_elec_module_user_unique');
            $table->dropConstrainedForeignId('dialux_module_id');
            $table->string('dialux_project_id')->nullable(false)->change();
        });
    }
};
