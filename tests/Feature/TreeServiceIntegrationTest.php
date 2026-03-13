<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Services\TreeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TreeServiceIntegrationTest extends TestCase
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

    public function test_complete_tree_workflow(): void
    {
        // Create modules
        $module1 = CostoProjectModule::factory()->create([
            'costo_project_id' => $this->project->id,
        ]);
        $module2 = CostoProjectModule::factory()->create([
            'costo_project_id' => $this->project->id,
        ]);

        // 1. Create a titulo
        $titulo = $this->service->createNode($this->project->id, [
            'node_type' => 'titulo',
            'name' => '04. INSTALACIONES SANITARIAS',
            'numbering' => '04',
        ]);

        $this->assertEquals('titulo', $titulo->node_type);
        $this->assertEquals('04', $titulo->numbering);

        // 2. Create a subtitulo under titulo
        $subtitulo = $this->service->createNode($this->project->id, [
            'parent_id' => $titulo->id,
            'node_type' => 'subtitulo',
            'name' => 'Agua Fría',
            'numbering' => '04.01',
            'unit' => 'ml',
        ]);

        $this->assertEquals('subtitulo', $subtitulo->node_type);
        $this->assertEquals($titulo->id, $subtitulo->parent_id);
        $this->assertEquals(1, $subtitulo->level);

        // 3. Create partidas under subtitulo with values
        $partida1 = $this->service->createNode($this->project->id, [
            'parent_id' => $subtitulo->id,
            'node_type' => 'partida',
            'name' => 'Tubería PVC 1/2"',
            'values' => [
                $module1->id => 25.50,
                $module2->id => 30.75,
            ],
        ]);

        $this->assertEquals('partida', $partida1->node_type);
        $this->assertEquals(2, $partida1->level);


        // 4. Get the complete tree
        $tree = $this->service->getTree($this->project->id);

        $this->assertCount(1, $tree);
        $this->assertEquals($titulo->id, $tree[0]['id']);
        $this->assertCount(1, $tree[0]['children']);
        $this->assertEquals($subtitulo->id, $tree[0]['children'][0]['id']);
        $this->assertCount(1, $tree[0]['children'][0]['children']);
        $this->assertEquals($partida1->id, $tree[0]['children'][0]['children'][0]['id']);

        // Verify values are included
        $partidaData = $tree[0]['children'][0]['children'][0];
        $this->assertEquals(25.50, $partidaData['values'][(string) $module1->id]);
        $this->assertEquals(30.75, $partidaData['values'][(string) $module2->id]);

        // Verify inherited unit
        $this->assertEquals('ml', $partidaData['inheritedUnit']);

        // 5. Update the partida
        $updated = $this->service->updateNode($partida1->id, [
            'name' => 'Tubería PVC 3/4"',
            'values' => [
                $module1->id => 35.00,
            ],
        ]);

        $this->assertEquals('Tubería PVC 3/4"', $updated->name);

        // 6. Delete the titulo (should cascade)
        $this->service->deleteNode($titulo->id);

        $tree = $this->service->getTree($this->project->id);
        $this->assertEmpty($tree);

        // Verify all nodes were deleted
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $titulo->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $subtitulo->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $partida1->id]);
    }

    public function test_hierarchy_validation_prevents_invalid_structures(): void
    {
        // Create a partida
        $partida = $this->service->createNode($this->project->id, [
            'node_type' => 'partida',
            'name' => 'Test Partida',
        ]);

        // Try to add a child to partida (should fail)
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Cannot add children to a partida node');

        $this->service->createNode($this->project->id, [
            'parent_id' => $partida->id,
            'node_type' => 'subtitulo',
            'name' => 'Invalid Child',
        ]);
    }
}
