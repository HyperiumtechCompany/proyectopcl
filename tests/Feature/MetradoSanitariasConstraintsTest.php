<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class MetradoSanitariasConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_node_type_constraint_accepts_valid_values(): void
    {
        $user = User::factory()->create();
        $project = CostoProject::factory()->create(['user_id' => $user->id]);

        $validTypes = ['titulo', 'subtitulo', 'partida'];

        foreach ($validTypes as $type) {
            $nodeId = Str::uuid();
            DB::table('metrado_sanitarias_nodes')->insert([
                'id' => $nodeId,
                'project_id' => $project->id,
                'node_type' => $type,
                'name' => 'Test Node',
                'level' => 1,
                'position' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->assertDatabaseHas('metrado_sanitarias_nodes', [
                'id' => $nodeId,
                'node_type' => $type,
            ]);
        }
    }

    public function test_cascade_delete_removes_child_nodes(): void
    {
        $user = User::factory()->create();
        $project = CostoProject::factory()->create(['user_id' => $user->id]);

        $parentId = Str::uuid();
        $childId = Str::uuid();

        // Create parent node
        DB::table('metrado_sanitarias_nodes')->insert([
            'id' => $parentId,
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Parent Node',
            'level' => 1,
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create child node
        DB::table('metrado_sanitarias_nodes')->insert([
            'id' => $childId,
            'project_id' => $project->id,
            'parent_id' => $parentId,
            'node_type' => 'subtitulo',
            'name' => 'Child Node',
            'level' => 2,
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Delete parent
        DB::table('metrado_sanitarias_nodes')->where('id', $parentId)->delete();

        // Child should be deleted too
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $childId]);
    }

    public function test_unique_constraint_on_user_state(): void
    {
        $user = User::factory()->create();
        $project = CostoProject::factory()->create(['user_id' => $user->id]);

        // Insert first record
        DB::table('metrado_sanitarias_user_state')->insert([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'expanded_nodes' => json_encode([]),
            'updated_at' => now(),
        ]);

        // Try to insert duplicate - should fail
        $this->expectException(\Illuminate\Database\QueryException::class);

        DB::table('metrado_sanitarias_user_state')->insert([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'expanded_nodes' => json_encode([]),
            'updated_at' => now(),
        ]);
    }

    public function test_decimal_precision_for_values(): void
    {
        $user = User::factory()->create();
        $project = CostoProject::factory()->create(['user_id' => $user->id]);
        
        // Create a module
        $moduleId = DB::table('costo_project_modules')->insertGetId([
            'costo_project_id' => $project->id,
            'module_type' => 'test_module',
            'enabled' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $nodeId = Str::uuid();
        DB::table('metrado_sanitarias_nodes')->insert([
            'id' => $nodeId,
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Test Node',
            'level' => 1,
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Insert value with 2 decimal places
        DB::table('metrado_sanitarias_values')->insert([
            'node_id' => $nodeId,
            'module_id' => $moduleId,
            'value' => 123.45,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $value = DB::table('metrado_sanitarias_values')
            ->where('node_id', $nodeId)
            ->first();

        $this->assertEquals('123.45', $value->value);
    }
}
