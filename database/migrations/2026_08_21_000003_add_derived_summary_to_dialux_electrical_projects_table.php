<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dialux_electrical_projects', function (Blueprint $table) {
            $table->decimal('demand_power_w', 12, 2)->default(0)->after('installed_power_w');
            $table->json('derived_summary')->nullable()->after('demand_power_w');
        });
    }

    public function down(): void
    {
        Schema::table('dialux_electrical_projects', function (Blueprint $table) {
            $table->dropColumn(['demand_power_w', 'derived_summary']);
        });
    }
};
