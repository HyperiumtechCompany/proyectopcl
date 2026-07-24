<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Separa el archivo físico del plano (dialux_plans) de su vínculo por
     * piso (dialux_plan_files), para que varios pisos puedan compartir el
     * mismo plano sin duplicar el archivo en disco.
     */
    public function up(): void
    {
        Schema::create('dialux_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dialux_project_id')->constrained('dialux_projects')->cascadeOnDelete();
            $table->string('original_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('size_bytes');
            $table->string('disk')->default('local');
            $table->string('path');
            $table->timestamps();
        });

        Schema::table('dialux_plan_files', function (Blueprint $table) {
            $table->foreignId('dialux_plan_id')->nullable()->after('scene_id')
                ->constrained('dialux_plans')->cascadeOnDelete();
        });

        // Migrar cada fila existente (archivo embebido) a un dialux_plans propio.
        DB::table('dialux_plan_files')->orderBy('id')->each(function ($row): void {
            $planId = DB::table('dialux_plans')->insertGetId([
                'dialux_project_id' => $row->dialux_project_id,
                'original_name' => $row->original_name,
                'mime_type' => $row->mime_type,
                'size_bytes' => $row->size_bytes,
                'disk' => $row->disk,
                'path' => $row->path,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);

            DB::table('dialux_plan_files')->where('id', $row->id)->update([
                'dialux_plan_id' => $planId,
            ]);
        });

        Schema::table('dialux_plan_files', function (Blueprint $table) {
            $table->unsignedBigInteger('dialux_plan_id')->nullable(false)->change();
            $table->dropColumn(['original_name', 'mime_type', 'size_bytes', 'disk', 'path']);
        });
    }

    public function down(): void
    {
        Schema::table('dialux_plan_files', function (Blueprint $table) {
            $table->string('original_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('disk')->default('local');
            $table->string('path')->nullable();
        });

        DB::table('dialux_plan_files')->orderBy('id')->each(function ($row): void {
            $plan = DB::table('dialux_plans')->find($row->dialux_plan_id);
            if (! $plan) {
                return;
            }

            DB::table('dialux_plan_files')->where('id', $row->id)->update([
                'original_name' => $plan->original_name,
                'mime_type' => $plan->mime_type,
                'size_bytes' => $plan->size_bytes,
                'disk' => $plan->disk,
                'path' => $plan->path,
            ]);
        });

        Schema::table('dialux_plan_files', function (Blueprint $table) {
            $table->string('original_name')->nullable(false)->change();
            $table->string('mime_type')->nullable(false)->change();
            $table->unsignedBigInteger('size_bytes')->nullable(false)->change();
            $table->string('path')->nullable(false)->change();
            $table->dropConstrainedForeignId('dialux_plan_id');
        });

        Schema::dropIfExists('dialux_plans');
    }
};
