<?php

namespace Tests\Unit\Services;

use App\Models\CostoProject;
use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use App\Models\CostoProjectModule;
use App\Services\TreeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TreeServiceTest extends TestCase
{
    use RefreshDatabase;

    private TreeService $service;
    private CostoProject $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new TreeService();
        $this->project = CostoProject::factory()->create();
    }

    // ─── getTree Tests ───────────────────────────────────────────────────────

    public function test_get_tree_returns_empty_array_for_project_without_nodes(): void
    {
        $tree = $this->service->getTree($this->project->id);

        $this->assertIsArray($tree);
        $this->assertEmpty($tree);
    }

    public function test_get_tree_returns_hierarchical_structure(): void
    {
        // Create a simple tree: titulo -> subtitulo -> partida
        $titulo = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => null,
            'node_type' => 'titulo',
            'level' => 0,
            'position' => 0,
        ]);

        $subtitulo = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => $titulo->id,
            'node_type' => 'subtitulo',
            'level' => 1,
            'position' => 0,
        ]);

        $partida = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => $subtitulo->id,
            'node_type' => 'partida',
            'level' => 2,
            'position' => 0,
        ]);

        $tree = $this->service->getTree($this->project->id);

        $this->assertCount(1, $tree);
        $this->assertEquals($titulo->id, $tree[0]['id']);
        $this->assertCount(1, $tree[0]['children']);
        $this->assertEquals($subtitulo->id, $tree[0]['children'][0]['id']);
        $this->assertCount(1, $tree[0]['children'][0]['children']);
        $this->assertEquals($partida->id, $tree[0]['children'][0]['children'][0]['id']);
    }

    // ─── createNode Tests ────────────────────────────────────────────────────

    public function test_create_node_creates_titulo_at_root_level(): void
    {
        $data = [
            'node_type' => 'titulo',
            'name' => 'Test Titulo',
        ];

        $node = $this->service->createNode($this->project->id, $data);

        $this->assertInstanceOf(MetradoSanitariasNode::class, $node);
        $this->assertEquals('titulo', $node->node_type);
        $this->assertEquals('Test Titulo', $node->name);
        $this->assertEquals(0, $node->level);
        $this->assertEquals(0, $node->position);
        $this->assertNull($node->parent_id);
        $this->assertDatabaseHas('metrado_sanitarias_nodes', [
            'id' => $node->id,
            'project_id' => $this->project->id,
        ]);
    }


    public function test_create_node_creates_child_with_correct_level(): void
    {
        $parent = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'node_type' => 'titulo',
            'level' => 0,
        ]);

        $data = [
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Test Subtitulo',
        ];

        $node = $this->service->createNode($this->project->id, $data);

        $this->assertEquals(1, $node->level);
        $this->assertEquals($parent->id, $node->parent_id);
    }

    public function test_create_node_with_values_creates_value_records(): void
    {
        $module = CostoProjectModule::factory()->create([
            'costo_project_id' => $this->project->id,
        ]);

        $data = [
            'node_type' => 'partida',
            'name' => 'Test Partida',
            'values' => [
                $module->id => 10.50,
            ],
        ];

        $node = $this->service->createNode($this->project->id, $data);

        $this->assertDatabaseHas('metrado_sanitarias_values', [
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 10.50,
        ]);
    }

    public function test_create_node_throws_exception_for_invalid_node_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid node type');

        $this->service->createNode($this->project->id, [
            'node_type' => 'invalid_type',
            'name' => 'Test',
        ]);
    }

    public function test_create_node_throws_exception_when_adding_child_to_partida(): void
    {
        $partida = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'node_type' => 'partida',
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Cannot add children to a partida node');

        $this->service->createNode($this->project->id, [
            'parent_id' => $partida->id,
            'node_type' => 'subtitulo',
            'name' => 'Test',
        ]);
    }


    // ─── updateNode Tests ────────────────────────────────────────────────────

    public function test_update_node_updates_basic_attributes(): void
    {
        $node = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'name' => 'Original Name',
            'unit' => 'ml',
        ]);

        $updated = $this->service->updateNode($node->id, [
            'name' => 'Updated Name',
            'unit' => 'kg',
        ]);

        $this->assertEquals('Updated Name', $updated->name);
        $this->assertEquals('kg', $updated->unit);
        $this->assertDatabaseHas('metrado_sanitarias_nodes', [
            'id' => $node->id,
            'name' => 'Updated Name',
            'unit' => 'kg',
        ]);
    }

    public function test_update_node_updates_values(): void
    {
        $node = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'node_type' => 'partida',
        ]);

        $module = CostoProjectModule::factory()->create([
            'costo_project_id' => $this->project->id,
        ]);

        MetradoSanitariasValue::factory()->create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 5.00,
        ]);

        $this->service->updateNode($node->id, [
            'values' => [
                $module->id => 15.75,
            ],
        ]);

        $this->assertDatabaseHas('metrado_sanitarias_values', [
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 15.75,
        ]);
    }

    public function test_update_node_throws_exception_when_changing_to_partida_with_children(): void
    {
        $parent = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'node_type' => 'titulo',
        ]);

        MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Cannot change node to partida type when it has children');

        $this->service->updateNode($parent->id, [
            'node_type' => 'partida',
        ]);
    }


    // ─── deleteNode Tests ────────────────────────────────────────────────────

    public function test_delete_node_removes_node_from_database(): void
    {
        $node = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
        ]);

        $this->service->deleteNode($node->id);

        $this->assertDatabaseMissing('metrado_sanitarias_nodes', [
            'id' => $node->id,
        ]);
    }

    public function test_delete_node_cascades_to_children(): void
    {
        $parent = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'node_type' => 'titulo',
        ]);

        $child1 = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
        ]);

        $child2 = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
            'parent_id' => $child1->id,
            'node_type' => 'partida',
        ]);

        $this->service->deleteNode($parent->id);

        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $parent->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $child1->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $child2->id]);
    }

    public function test_delete_node_removes_associated_values(): void
    {
        $node = MetradoSanitariasNode::factory()->create([
            'project_id' => $this->project->id,
        ]);

        $module = CostoProjectModule::factory()->create([
            'costo_project_id' => $this->project->id,
        ]);

        $value = MetradoSanitariasValue::factory()->create([
            'node_id' => $node->id,
            'module_id' => $module->id,
        ]);

        $this->service->deleteNode($node->id);

        $this->assertDatabaseMissing('metrado_sanitarias_values', [
            'id' => $value->id,
        ]);
    }
}
