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
        Schema::table('luminaire_products', function (Blueprint $table) {
            if (! Schema::hasColumn('luminaire_products', 'product_image_path')) {
                $table->string('product_image_path')->nullable()->after('source_file_name');
            }

            if (! Schema::hasColumn('luminaire_products', 'brand_logo_path')) {
                $table->string('brand_logo_path')->nullable()->after('product_image_path');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('luminaire_products', function (Blueprint $table) {
            if (Schema::hasColumn('luminaire_products', 'brand_logo_path')) {
                $table->dropColumn('brand_logo_path');
            }

            if (Schema::hasColumn('luminaire_products', 'product_image_path')) {
                $table->dropColumn('product_image_path');
            }
        });
    }
};
