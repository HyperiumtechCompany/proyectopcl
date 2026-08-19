<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('dialux_normative_requirements', function (Blueprint $table) {
            $table->decimal('lpd_wm2', 6, 2)->nullable()->after('ra');
            $table->unsignedInteger('hours_yr')->nullable()->after('lpd_wm2');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dialux_normative_requirements', function (Blueprint $table) {
            $table->dropColumn(['lpd_wm2', 'hours_yr']);
        });
    }
};
