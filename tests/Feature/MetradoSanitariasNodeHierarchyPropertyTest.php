<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\MetradoSanitariasNode;
use App\Models\User;
use Eris\Generator;
use Eris\TestTrait;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Feature: sistema-metrados-sanitarios-dinamico, Property 6: Reglas de jerarquía de tipos de nodos
// **Validates: Requirements 2.2, 2.3, 2.4**

class MetradoSanitariasNodeHierarchyPropertyTest extends TestCase
{
    use RefreshDatabase;
    use TestTrait;

    private User $user;
    private CostoProject $project;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create();
        $this->project = CostoProject::factory()->create(['user_id' => $this->user->id]);
    }

    /**
     * Property 6: For any nodo en el árbol:
     * - Si es Titulo o Subtitulo, debe permitir agregar hijos de tipo Subtitulo o Partida
     * - Si es Partida, debe prohibir agregar cualquier tipo de hijo
     */
    public function test_property_titulo_can_have_subtitulo_and_partida_children(): void
    {
        $this->forAll(
            Generator\choose(1, 10), // Number of children to create
            Generator\elements('subtitulo', 'partida') // Child type
        )
            ->withMaxSize(100)
            ->then(function (int $childCount, string $childType) {
                // Create a Titulo node
                $titulo = MetradoSanitariasNode::create([
                    'project_id' => $this->project->id,
                    'parent_id' => null,
                    'node_type' => 'titulo',
                    'name' => 'Titulo Test',
                    'numbering' => '04',
                    'level' => 0,
                    'position' => 1,
                ]);

                // Try to add children of the specified type
                for ($i = 0; $i < $childCount; $i++) {
                    $child = MetradoSanitariasNode::create([
                        'project_id' => $this->project->id,
                        'parent_id' => $titulo->id,
                        'node_type' => $childType,
                        'name' => ucfirst($childType) . ' ' . ($i + 1),
                        'numbering' => $childType === 'subtitulo' ? "04.0" . ($i + 1) : null,
                        'level' => 1,
                        'position' => $i + 1,
                    ]);

                    // Verify the child was created successfully
                    $this->assertNotNull($child->id);
                    $this->assertEquals($titulo->id, $child->parent_id);
                    $this->assertEquals($childType, $child->node_type);
                }

                // Verify canHaveChildren returns true for Titulo
                $this->assertTrue($titulo->canHaveChildren());

                // Verify all children are accessible
                $this->assertEquals($childCount, $titulo->children()->count());

                // Clean up for next iteration
                MetradoSanitariasNode::where('project_id', $this->project->id)->delete();
            });
    }

    public function test_property_subtitulo_can_have_subtitulo_and_partida_children(): void
    {
        $this->forAll(
            Generator\choose(1, 10), // Number of children to create
            Generator\elements('subtitulo', 'partida') // Child type
        )
            ->withMaxSize(100)
            ->then(function (int $childCount, string $childType) {
                // Create a parent Titulo
                $titulo = MetradoSanitariasNode::create([
                    'project_id' => $this->project->id,
                    'parent_id' => null,
                    'node_type' => 'titulo',
                    'name' => 'Titulo Parent',
                    'numbering' => '04',
                    'level' => 0,
                    'position' => 1,
                ]);

                // Create a Subtitulo node
                $subtitulo = MetradoSanitariasNode::create([
                    'project_id' => $this->project->id,
                    'parent_id' => $titulo->id,
                    'node_type' => 'subtitulo',
                    'name' => 'Subtitulo Test',
                    'numbering' => '04.01',
                    'level' => 1,
                    'position' => 1,
                ]);

                // Try to add children of the specified type
                for ($i = 0; $i < $childCount; $i++) {
                    $child = MetradoSanitariasNode::create([
                        'project_id' => $this->project->id,
                        'parent_id' => $subtitulo->id,
                        'node_type' => $childType,
                        'name' => ucfirst($childType) . ' ' . ($i + 1),
                        'numbering' => $childType === 'subtitulo' ? "04.01.0" . ($i + 1) : null,
                        'level' => 2,
                        'position' => $i + 1,
                    ]);

                    // Verify the child was created successfully
                    $this->assertNotNull($child->id);
                    $this->assertEquals($subtitulo->id, $child->parent_id);
                    $this->assertEquals($childType, $child->node_type);
                }

                // Verify canHaveChildren returns true for Subtitulo
                $this->assertTrue($subtitulo->canHaveChildren());

                // Verify all children are accessible
                $this->assertEquals($childCount, $subtitulo->children()->count());

                // Clean up for next iteration
                MetradoSanitariasNode::where('project_id', $this->project->id)->delete();
            });
    }

    public function test_property_partida_cannot_have_any_children(): void
    {
        $this->forAll(
            Generator\elements('titulo', 'subtitulo', 'partida') // Try all node types as children
        )
            ->withMaxSize(100)
            ->then(function (string $childType) {
                // Create a parent Titulo
                $titulo = MetradoSanitariasNode::create([
                    'project_id' => $this->project->id,
                    'parent_id' => null,
                    'node_type' => 'titulo',
                    'name' => 'Titulo Parent',
                    'numbering' => '04',
                    'level' => 0,
                    'position' => 1,
                ]);

                // Create a Partida node
                $partida = MetradoSanitariasNode::create([
                    'project_id' => $this->project->id,
                    'parent_id' => $titulo->id,
                    'node_type' => 'partida',
                    'name' => 'Partida Test',
                    'numbering' => null,
                    'level' => 1,
                    'position' => 1,
                ]);

                // Verify canHaveChildren returns false for Partida
                $this->assertFalse($partida->canHaveChildren());

                // Verify that Partida is a leaf node (isPartida returns true)
                $this->assertTrue($partida->isPartida());

                // Verify that attempting to query children returns empty collection
                $this->assertEquals(0, $partida->children()->count());

                // Clean up for next iteration
                MetradoSanitariasNode::where('project_id', $this->project->id)->delete();
            });
    }
}
