<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dialux_projects', function (Blueprint $table) {
            $table->string('description')->nullable()->after('name');
            $table->string('client_name')->nullable()->after('description');
            $table->string('location')->nullable()->after('client_name');
            $table->string('project_code')->nullable()->after('location');
            $table->string('status', 32)->default('draft')->after('project_code');
            $table->json('consolidated_summary')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('dialux_projects', function (Blueprint $table) {
            $table->dropColumn([
                'description',
                'client_name',
                'location',
                'project_code',
                'status',
                'consolidated_summary',
            ]);
        });
    }
};
