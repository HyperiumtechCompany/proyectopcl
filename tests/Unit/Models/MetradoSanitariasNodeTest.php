<?php

namespace Tests\Unit\Models;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetradoSanitariasNodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_uuid_on_creation()
    {
        $project = CostoProject::factory()->create();
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Test Node',
            'level' => 1,
            'position' => 1,
        ]);

        $this->assertNotNull($node->id);
        $this->assertIsString($node->id);
        $this->assertEquals(36, strlen($node->id)); // UUID length with hyphens
    }

    public function test_has_parent_relationship()
    {
        $project = CostoProject::factory()->create();
        
        $parent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Parent',
            'level' => 1,
            'position' => 1,
        ]);

        $child = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Child',
            'level' => 2,
            'position' => 1,
        ]);

        $this->assertTrue($child->parent->is($parent));
    }

    public function test_has_children_relationship_ordered_by_position()
    {
        $project = CostoProject::factory()->create();
        
        $parent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Parent',
            'level' => 1,
            'position' => 1,
        ]);

        $child2 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Child 2',
            'level' => 2,
            'position' => 2,
        ]);

        $child1 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Child 1',
            'level' => 2,
            'position' => 1,
        ]);

        $children = $parent->children;
        
        $this->assertCount(2, $children);
        $this->assertEquals('Child 1', $children[0]->name);
        $this->assertEquals('Child 2', $children[1]->name);
    }

    public function test_has_values_relationship()
    {
        $project = CostoProject::factory()->create();
        $module = CostoProjectModule::factory()->create(['costo_project_id' => $project->id]);
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Test Partida',
            'level' => 3,
            'position' => 1,
        ]);

        MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 100.50,
        ]);

        $this->assertCount(1, $node->values);
        $this->assertEquals(100.50, $node->values->first()->value);
    }

    public function test_has_project_relationship()
    {
        $project = CostoProject::factory()->create();
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Test Node',
            'level' => 1,
            'position' => 1,
        ]);

        $this->assertTrue($node->project->is($project));
    }

    public function test_scope_root_nodes_returns_only_nodes_without_parent()
    {
        $project = CostoProject::factory()->create();
        
        $root1 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Root 1',
            'level' => 1,
            'position' => 1,
        ]);

        $root2 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Root 2',
            'level' => 1,
            'position' => 2,
        ]);

        $child = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $root1->id,
            'node_type' => 'subtitulo',
            'name' => 'Child',
            'level' => 2,
            'position' => 1,
        ]);

        $rootNodes = MetradoSanitariasNode::rootNodes()->get();

        $this->assertCount(2, $rootNodes);
        $this->assertTrue($rootNodes->contains($root1));
        $this->assertTrue($rootNodes->contains($root2));
        $this->assertFalse($rootNodes->contains($child));
    }

    public function test_scope_by_level_returns_nodes_at_specific_level()
    {
        $project = CostoProject::factory()->create();
        
        $level1 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Level 1',
            'level' => 1,
            'position' => 1,
        ]);

        $level2 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $level1->id,
            'node_type' => 'subtitulo',
            'name' => 'Level 2',
            'level' => 2,
            'position' => 1,
        ]);

        $level2Nodes = MetradoSanitariasNode::byLevel(2)->get();

        $this->assertCount(1, $level2Nodes);
        $this->assertTrue($level2Nodes->contains($level2));
    }

    public function test_scope_ordered_returns_nodes_sorted_by_position()
    {
        $project = CostoProject::factory()->create();
        
        $node3 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Node 3',
            'level' => 1,
            'position' => 3,
        ]);

        $node1 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Node 1',
            'level' => 1,
            'position' => 1,
        ]);

        $node2 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Node 2',
            'level' => 1,
            'position' => 2,
        ]);

        $orderedNodes = MetradoSanitariasNode::ordered()->get();

        $this->assertEquals('Node 1', $orderedNodes[0]->name);
        $this->assertEquals('Node 2', $orderedNodes[1]->name);
        $this->assertEquals('Node 3', $orderedNodes[2]->name);
    }

    public function test_is_title_returns_true_for_titulo_nodes()
    {
        $project = CostoProject::factory()->create();
        
        $titulo = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Titulo',
            'level' => 1,
            'position' => 1,
        ]);

        $this->assertTrue($titulo->isTitle());
        $this->assertFalse($titulo->isSubtitle());
        $this->assertFalse($titulo->isPartida());
    }

    public function test_is_subtitle_returns_true_for_subtitulo_nodes()
    {
        $project = CostoProject::factory()->create();
        
        $subtitulo = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'subtitulo',
            'name' => 'Subtitulo',
            'level' => 2,
            'position' => 1,
        ]);

        $this->assertFalse($subtitulo->isTitle());
        $this->assertTrue($subtitulo->isSubtitle());
        $this->assertFalse($subtitulo->isPartida());
    }

    public function test_is_partida_returns_true_for_partida_nodes()
    {
        $project = CostoProject::factory()->create();
        
        $partida = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Partida',
            'level' => 3,
            'position' => 1,
        ]);

        $this->assertFalse($partida->isTitle());
        $this->assertFalse($partida->isSubtitle());
        $this->assertTrue($partida->isPartida());
    }

    public function test_can_have_children_returns_true_for_titulo_and_subtitulo()
    {
        $project = CostoProject::factory()->create();
        
        $titulo = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Titulo',
            'level' => 1,
            'position' => 1,
        ]);

        $subtitulo = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'subtitulo',
            'name' => 'Subtitulo',
            'level' => 2,
            'position' => 1,
        ]);

        $this->assertTrue($titulo->canHaveChildren());
        $this->assertTrue($subtitulo->canHaveChildren());
    }

    public function test_can_have_children_returns_false_for_partida()
    {
        $project = CostoProject::factory()->create();
        
        $partida = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Partida',
            'level' => 3,
            'position' => 1,
        ]);

        $this->assertFalse($partida->canHaveChildren());
    }

    public function test_get_inherited_unit_returns_own_unit_if_defined()
    {
        $project = CostoProject::factory()->create();
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'subtitulo',
            'name' => 'Subtitulo',
            'unit' => 'm2',
            'level' => 2,
            'position' => 1,
        ]);

        $this->assertEquals('m2', $node->getInheritedUnit());
    }

    public function test_get_inherited_unit_returns_parent_unit_if_own_is_null()
    {
        $project = CostoProject::factory()->create();
        
        $parent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'subtitulo',
            'name' => 'Parent',
            'unit' => 'm2',
            'level' => 2,
            'position' => 1,
        ]);

        $child = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'partida',
            'name' => 'Child',
            'level' => 3,
            'position' => 1,
        ]);

        $this->assertEquals('m2', $child->getInheritedUnit());
    }

    public function test_get_inherited_unit_returns_null_for_root_node_without_unit()
    {
        $project = CostoProject::factory()->create();
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Titulo',
            'level' => 1,
            'position' => 1,
        ]);

        $this->assertNull($node->getInheritedUnit());
    }

    public function test_get_inherited_unit_traverses_multiple_levels()
    {
        $project = CostoProject::factory()->create();
        
        $grandparent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Grandparent',
            'level' => 1,
            'position' => 1,
        ]);

        $parent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $grandparent->id,
            'node_type' => 'subtitulo',
            'name' => 'Parent',
            'unit' => 'm3',
            'level' => 2,
            'position' => 1,
        ]);

        $child = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Child',
            'level' => 3,
            'position' => 1,
        ]);

        $grandchild = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $child->id,
            'node_type' => 'partida',
            'name' => 'Grandchild',
            'level' => 4,
            'position' => 1,
        ]);

        $this->assertEquals('m3', $grandchild->getInheritedUnit());
    }

    public function test_get_descendants_returns_all_children_recursively()
    {
        $project = CostoProject::factory()->create();
        
        $root = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Root',
            'level' => 1,
            'position' => 1,
        ]);

        $child1 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $root->id,
            'node_type' => 'subtitulo',
            'name' => 'Child 1',
            'level' => 2,
            'position' => 1,
        ]);

        $child2 = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $root->id,
            'node_type' => 'subtitulo',
            'name' => 'Child 2',
            'level' => 2,
            'position' => 2,
        ]);

        $grandchild = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $child1->id,
            'node_type' => 'partida',
            'name' => 'Grandchild',
            'level' => 3,
            'position' => 1,
        ]);

        $descendants = $root->getDescendants();

        $this->assertCount(3, $descendants);
        $this->assertTrue($descendants->contains($child1));
        $this->assertTrue($descendants->contains($child2));
        $this->assertTrue($descendants->contains($grandchild));
    }

    public function test_get_descendants_returns_empty_collection_for_leaf_node()
    {
        $project = CostoProject::factory()->create();
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Leaf',
            'level' => 3,
            'position' => 1,
        ]);

        $descendants = $node->getDescendants();

        $this->assertCount(0, $descendants);
    }

    public function test_deleting_node_cascades_to_children()
    {
        $project = CostoProject::factory()->create();
        
        $parent = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'titulo',
            'name' => 'Parent',
            'level' => 1,
            'position' => 1,
        ]);

        $child = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $parent->id,
            'node_type' => 'subtitulo',
            'name' => 'Child',
            'level' => 2,
            'position' => 1,
        ]);

        $grandchild = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'parent_id' => $child->id,
            'node_type' => 'partida',
            'name' => 'Grandchild',
            'level' => 3,
            'position' => 1,
        ]);

        $parent->delete();

        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $parent->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $child->id]);
        $this->assertDatabaseMissing('metrado_sanitarias_nodes', ['id' => $grandchild->id]);
    }
}
