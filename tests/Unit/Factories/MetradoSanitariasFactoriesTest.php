<?php

namespace Tests\Unit\Factories;

use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetradoSanitariasFactoriesTest extends TestCase
{
    use RefreshDatabase;

    // ─── MetradoSanitariasNode Factory Tests ─────────────────────────────────

    public function test_node_factory_creates_valid_node()
    {
        $node = MetradoSanitariasNode::factory()->create();

        $this->assertNotNull($node->id);
        $this->assertNotNull($node->project_id);
        $this->assertNotNull($node->node_type);
        $this->assertNotNull($node->name);
        $this->assertNotNull($node->numbering);
        $this->assertIsInt($node->level);
        $this->assertIsInt($node->position);
    }

    public function test_node_factory_titulo_state_creates_titulo_node()
    {
        $node = MetradoSanitariasNode::factory()->titulo()->create();

        $this->assertEquals('titulo', $node->node_type);
        $this->assertEquals(0, $node->level);
        $this->assertNull($node->unit);
        $this->assertMatchesRegularExpression('/^\d+\.00$/', $node->numbering);
    }

    public function test_node_factory_subtitulo_state_creates_subtitulo_node()
    {
        $node = MetradoSanitariasNode::factory()->subtitulo()->create();

        $this->assertEquals('subtitulo', $node->node_type);
        $this->assertEquals(1, $node->level);
        $this->assertNull($node->unit);
        $this->assertMatchesRegularExpression('/^\d+\.\d+$/', $node->numbering);
    }

    public function test_node_factory_partida_state_creates_partida_node()
    {
        $node = MetradoSanitariasNode::factory()->partida()->create();

        $this->assertEquals('partida', $node->node_type);
        $this->assertEquals(2, $node->level);
        $this->assertNotNull($node->unit);
        $this->assertContains($node->unit, ['m', 'm2', 'm3', 'kg', 'und', 'glb']);
        $this->assertMatchesRegularExpression('/^\d+\.\d+\.\d+$/', $node->numbering);
    }

    public function test_node_factory_generates_uuid()
    {
        $node = MetradoSanitariasNode::factory()->make();

        $this->assertIsString($node->id);
        $this->assertEquals(36, strlen($node->id));
    }

    public function test_node_factory_can_create_hierarchy()
    {
        $parent = MetradoSanitariasNode::factory()->titulo()->create();
        $child = MetradoSanitariasNode::factory()->subtitulo()->create([
            'parent_id' => $parent->id,
            'project_id' => $parent->project_id,
        ]);

        $this->assertEquals($parent->id, $child->parent_id);
        $this->assertTrue($child->parent->is($parent));
    }

    // ─── MetradoSanitariasValue Factory Tests ────────────────────────────────

    public function test_value_factory_creates_valid_value()
    {
        $value = MetradoSanitariasValue::factory()->create();

        $this->assertNotNull($value->id);
        $this->assertNotNull($value->node_id);
        $this->assertNotNull($value->module_id);
        $this->assertNotNull($value->value);
    }

    public function test_value_factory_generates_decimal_value()
    {
        $value = MetradoSanitariasValue::factory()->make();

        $this->assertIsNumeric($value->value);
        $this->assertGreaterThanOrEqual(0, $value->value);
        $this->assertLessThanOrEqual(1000, $value->value);
    }

    public function test_value_factory_value_has_two_decimal_places()
    {
        $value = MetradoSanitariasValue::factory()->create();

        // Check that the value has at most 2 decimal places
        $decimalPart = explode('.', (string) $value->value)[1] ?? '';
        $this->assertLessThanOrEqual(2, strlen($decimalPart));
    }

    public function test_value_factory_associates_with_node_and_module()
    {
        $value = MetradoSanitariasValue::factory()->create();

        $this->assertInstanceOf(MetradoSanitariasNode::class, $value->node);
        $this->assertNotNull($value->module);
    }
}
