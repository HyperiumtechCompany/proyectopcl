<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('cronograma_valorizado')) {
            return;
        }

        Schema::connection($this->connection)->table('cronograma_valorizado', function (Blueprint $table) {
            if (! Schema::connection($this->connection)->hasColumn('cronograma_valorizado', 'distribucion_mensual')) {
                $table->json('distribucion_mensual')->nullable()->after('presupuesto_total');
            }
        });
    }

    public function down(): void
    {
        // Do not drop distribucion_mensual here: the base cronogramas migration owns it.
    }
};
