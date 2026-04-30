<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('luminaire_products', function (Blueprint $table) {
            if (! Schema::hasColumn('luminaire_products', 'report_data')) {
                $table->json('report_data')->nullable()->after('photometric_web');
            }

            if (! Schema::hasColumn('luminaire_products', 'report_assets')) {
                $table->json('report_assets')->nullable()->after('report_data');
            }
        });

        Schema::table('project_products', function (Blueprint $table) {
            if (! Schema::hasColumn('project_products', 'product_snapshot')) {
                $table->json('product_snapshot')->nullable()->after('placement_config');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_products', function (Blueprint $table) {
            if (Schema::hasColumn('project_products', 'product_snapshot')) {
                $table->dropColumn('product_snapshot');
            }
        });

        Schema::table('luminaire_products', function (Blueprint $table) {
            if (Schema::hasColumn('luminaire_products', 'report_assets')) {
                $table->dropColumn('report_assets');
            }

            if (Schema::hasColumn('luminaire_products', 'report_data')) {
                $table->dropColumn('report_data');
            }
        });
    }
};
