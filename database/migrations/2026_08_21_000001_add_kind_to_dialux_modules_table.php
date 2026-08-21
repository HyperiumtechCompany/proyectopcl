<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dialux_modules', function (Blueprint $table) {
            $table->string('kind', 32)->default('building')->after('status');
            $table->index(['dialux_project_id', 'kind']);
        });

        $now = now();
        DB::table('dialux_projects')->orderBy('id')->each(function ($project) use ($now): void {
            DB::table('dialux_modules')->insert([
                'dialux_project_id' => $project->id,
                'name' => 'Módulo General',
                'description' => 'Red eléctrica general del proyecto',
                'sort_order' => 0,
                'status' => 'draft',
                'kind' => 'general',
                'data' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('dialux_modules', function (Blueprint $table) {
            $table->dropIndex(['dialux_project_id', 'kind']);
            $table->dropColumn('kind');
        });
    }
};
