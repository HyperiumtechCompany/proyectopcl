<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            $table->longText('conceptos_adicionales_json')->nullable()->after('componentes_extra_json');
        });
    }

    public function down(): void
    {
        Schema::connection($this->connection)->table('gg_consolidado', function (Blueprint $table) {
            $table->dropColumn('conceptos_adicionales_json');
        });
    }
};
