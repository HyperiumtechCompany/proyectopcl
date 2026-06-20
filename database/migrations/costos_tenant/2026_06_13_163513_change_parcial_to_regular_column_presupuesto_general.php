<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $connection = DB::connection('costos_tenant');
        $schemaBuilder = $connection->getSchemaBuilder();

        if (! $schemaBuilder->hasTable('presupuesto_general')) {
            return;
        }

        // Drop the STORED GENERATED column
        $connection->statement('ALTER TABLE presupuesto_general DROP COLUMN parcial');

        // Re-add as a regular column (not generated)
        $connection->statement('ALTER TABLE presupuesto_general ADD COLUMN parcial DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER precio_unitario');
    }

    public function down(): void
    {
        $connection = DB::connection('costos_tenant');
        $schemaBuilder = $connection->getSchemaBuilder();

        if (! $schemaBuilder->hasTable('presupuesto_general')) {
            return;
        }

        // Drop the regular column
        $connection->statement('ALTER TABLE presupuesto_general DROP COLUMN parcial');

        // Re-add as STORED GENERATED column
        $connection->statement("ALTER TABLE presupuesto_general ADD COLUMN parcial DECIMAL(15,4) STORED AS (metrado * precio_unitario) COMMENT 'metrado × precio_unitario' AFTER precio_unitario");
    }
};