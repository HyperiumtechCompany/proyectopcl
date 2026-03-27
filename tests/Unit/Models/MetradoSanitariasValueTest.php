<?php

namespace Tests\Unit\Models;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetradoSanitariasValueTest extends TestCase
{
    use RefreshDatabase;

    public function test_has_node_relationship()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 150.75,
        ]);

        $this->assertTrue($value->node->is($node));
    }

    public function test_has_module_relationship()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 200.50,
        ]);

        $this->assertTrue($value->module->is($module));
    }

    public function test_value_is_cast_to_decimal_with_two_precision()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 123.456, // More than 2 decimals
        ]);

        // Refresh from database to get the stored value
        $value->refresh();

        // Should be stored with 2 decimal precision
        $this->assertEquals('123.46', $value->value);
    }

    public function test_fillable_attributes_can_be_mass_assigned()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 99.99,
        ]);

        $this->assertEquals($node->id, $value->node_id);
        $this->assertEquals($module->id, $value->module_id);
        $this->assertEquals('99.99', $value->value);
    }

    public function test_deleting_node_cascades_to_values()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 50.00,
        ]);

        $valueId = $value->id;

        $node->delete();

        $this->assertDatabaseMissing('metrado_sanitarias_values', ['id' => $valueId]);
    }

    public function test_deleting_module_cascades_to_values()
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

        $value = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module->id,
            'value' => 75.25,
        ]);

        $valueId = $value->id;

        $module->delete();

        $this->assertDatabaseMissing('metrado_sanitarias_values', ['id' => $valueId]);
    }

    public function test_multiple_values_can_exist_for_different_modules()
    {
        $project = CostoProject::factory()->create();
        $module1 = CostoProjectModule::factory()->create(['costo_project_id' => $project->id]);
        $module2 = CostoProjectModule::factory()->create(['costo_project_id' => $project->id]);
        
        $node = MetradoSanitariasNode::create([
            'project_id' => $project->id,
            'node_type' => 'partida',
            'name' => 'Test Partida',
            'level' => 3,
            'position' => 1,
        ]);

        $value1 = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module1->id,
            'value' => 100.00,
        ]);

        $value2 = MetradoSanitariasValue::create([
            'node_id' => $node->id,
            'module_id' => $module2->id,
            'value' => 200.00,
        ]);

        $this->assertCount(2, $node->values);
        $this->assertEquals(100.00, $node->values->where('module_id', $module1->id)->first()->value);
        $this->assertEquals(200.00, $node->values->where('module_id', $module2->id)->first()->value);
    }

    public function test_value_defaults_to_zero_when_not_provided()
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

        // Create value without specifying value field (should use database default)
        $value = new MetradoSanitariasValue([
            'node_id' => $node->id,
            'module_id' => $module->id,
        ]);
        $value->save();

        $value->refresh();

        $this->assertEquals('0.00', $value->value);
    }
}
