<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'costos_tenant';

    public function up(): void
    {
        $tables = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($tables as $table) {
            Schema::connection($this->connection)->table($table, function (Blueprint $table) {
                if (!Schema::connection($this->connection)->hasColumn($table->getTable(), 'node_type')) {
                    $table->string('node_type', 20)->default('partida')->after('item_order');
                }
                if (!Schema::connection($this->connection)->hasColumn($table->getTable(), 'titulo')) {
                    $table->string('titulo', 255)->nullable()->after('node_type');
                }
                if (!Schema::connection($this->connection)->hasColumn($table->getTable(), 'item')) {
                    $table->string('item', 30)->nullable()->after('titulo');
                }
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($tables as $table) {
            Schema::connection($this->connection)->table($table, function (Blueprint $table) {
                $table->dropColumn(['node_type', 'titulo', 'item']);
            });
        }
    }
};
