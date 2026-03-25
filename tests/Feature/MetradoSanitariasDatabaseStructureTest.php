<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MetradoSanitariasDatabaseStructureTest extends TestCase
{
    use RefreshDatabase;

    public function test_metrado_sanitarias_nodes_table_exists_with_correct_structure(): void
    {
        $this->assertTrue(Schema::hasTable('metrado_sanitarias_nodes'));

        $columns = [
            'id', 'project_id', 'parent_id', 'node_type', 'name',
            'numbering', 'unit', 'level', 'position', 'created_at', 'updated_at'
        ];

        foreach ($columns as $column) {
            $this->assertTrue(
                Schema::hasColumn('metrado_sanitarias_nodes', $column),
                "Column {$column} does not exist in metrado_sanitarias_nodes table"
            );
        }
    }

    public function test_metrado_sanitarias_values_table_exists_with_correct_structure(): void
    {
        $this->assertTrue(Schema::hasTable('metrado_sanitarias_values'));

        $columns = ['id', 'node_id', 'module_id', 'value', 'created_at', 'updated_at'];

        foreach ($columns as $column) {
            $this->assertTrue(
                Schema::hasColumn('metrado_sanitarias_values', $column),
                "Column {$column} does not exist in metrado_sanitarias_values table"
            );
        }
    }

    public function test_metrado_sanitarias_user_state_table_exists_with_correct_structure(): void
    {
        $this->assertTrue(Schema::hasTable('metrado_sanitarias_user_state'));

        $columns = ['id', 'user_id', 'project_id', 'expanded_nodes', 'updated_at'];

        foreach ($columns as $column) {
            $this->assertTrue(
                Schema::hasColumn('metrado_sanitarias_user_state', $column),
                "Column {$column} does not exist in metrado_sanitarias_user_state table"
            );
        }
    }
}
