<?php

use Database\Seeders\EmergencyLuminaireSeeder;

it('can instantiate the emergency luminaire seeder', function () {
    expect(new EmergencyLuminaireSeeder)->toBeInstanceOf(EmergencyLuminaireSeeder::class);
});
