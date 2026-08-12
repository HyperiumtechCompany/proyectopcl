<?php

use Database\Seeders\EmergencyLuminaireSeeder;

it('can instantiate the emergency luminaire seeder', function () {
    expect(new EmergencyLuminaireSeeder)->toBeInstanceOf(EmergencyLuminaireSeeder::class);
});

it('normalizes legacy emergency metadata safely', function (mixed $metadata, array $expected) {
    $method = new ReflectionMethod(EmergencyLuminaireSeeder::class, 'normalizeMetadata');

    expect($method->invoke(new EmergencyLuminaireSeeder, $metadata))->toBe($expected);
})->with([
    'array' => [['existing' => true], ['existing' => true]],
    'json' => ['{"existing":true}', ['existing' => true]],
    'double encoded json' => ['"{\\"existing\\":true}"', ['existing' => true]],
    'invalid legacy value' => ['not-json', []],
    'null' => [null, []],
]);
