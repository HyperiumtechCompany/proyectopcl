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
            'metrado_sanitarias_modulos',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_cisterna',
        ]; 

        foreach ($tables as $tableName) {
            if (!Schema::connection($this->connection)->hasTable($tableName)) {
                continue;
            }

            Schema::connection($this->connection)->table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::connection($this->connection)->hasColumn($tableName, 'kgm')) {
                    $table->decimal('kgm', 12, 4)->default(0)->after('nveces');
                }
                if (!Schema::connection($this->connection)->hasColumn($tableName, '_formula_key')) {
                    $table->string('_formula_key', 100)->nullable()->after('total');
                }
                if (!Schema::connection($this->connection)->hasColumn($tableName, '_formula_output')) {
                    $table->string('_formula_output', 20)->nullable()->after('_formula_key');
                }
                if (!Schema::connection($this->connection)->hasColumn($tableName, '_formula_expr')) {
                    $table->text('_formula_expr')->nullable()->after('_formula_output');
                }
                if (!Schema::connection($this->connection)->hasColumn($tableName, '_formula_label')) {
                    $table->text('_formula_label')->nullable()->after('_formula_expr');
                }
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'metrado_sanitarias_modulos',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_cisterna',
        ];

        foreach ($tables as $tableName) {
            if (!Schema::connection($this->connection)->hasTable($tableName)) {
                continue;
            }

            Schema::connection($this->connection)->table($tableName, function (Blueprint $table) use ($tableName) {
                $dropColumns = [];

                foreach (['kgm', '_formula_key', '_formula_output', '_formula_expr', '_formula_label'] as $column) {
                    if (Schema::connection($this->connection)->hasColumn($tableName, $column)) {
                        $dropColumns[] = $column;
                    }
                }

                if (!empty($dropColumns)) {
                    $table->dropColumn($dropColumns);
                }
            });
        }
    }
};
