<?php

namespace Database\Factories;

use App\Models\CostoProjectModule;
use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MetradoSanitariasValue>
 */
class MetradoSanitariasValueFactory extends Factory
{
    protected $model = MetradoSanitariasValue::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'node_id' => MetradoSanitariasNode::factory(),
            'module_id' => CostoProjectModule::factory(),
            'value' => fake()->randomFloat(2, 0, 1000),
        ];
    }
}
