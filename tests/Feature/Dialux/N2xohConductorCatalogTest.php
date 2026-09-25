<?php

use App\Models\Dialux\DialuxConductor;
use Database\Seeders\DialuxElectricalCatalogSeeder;

/**
 * Tabla N2XOH del motor CT de la V1 (`wireLengthCalculations.ts`), leída del
 * propio código fuente: el catálogo en BD debe coincidir exactamente con ella.
 *
 * @return array<string, float>
 */
function v1N2xohAmpacities(): array
{
    $source = file_get_contents(base_path('resources/js/pages/dialux/hooks/wireLengthCalculations.ts'));
    preg_match("/'N2XOH':\\s*\\{([^}]*)\\}/", $source, $match);
    expect($match)->not->toBeEmpty();
    $table = [];
    foreach (explode(',', $match[1]) as $pair) {
        [$section, $ampacity] = array_map('trim', explode(':', $pair));
        $table[(string) (float) $section] = (float) $ampacity;
    }

    return $table;
}

/** @return array<string, float> */
function catalogN2xohAmpacities(): array
{
    return DialuxConductor::query()
        ->whereNull('user_id')
        ->where('insulation', 'N2XOH')
        ->where('material', 'cobre')
        ->get()
        ->mapWithKeys(fn (DialuxConductor $c) => [(string) $c->section_mm2 => $c->ampacity_a])
        ->all();
}

test('the migration adds the N2XOH catalog with the same ampacities as the V1 CT engine', function () {
    $v1 = v1N2xohAmpacities();

    expect($v1)->toHaveCount(17)
        ->and($v1['2.5'])->toBe(38.0)
        ->and(catalogN2xohAmpacities())->toEqual($v1);
});

test('running the seeder afterwards keeps the N2XOH catalog identical and without duplicates', function () {
    $this->seed(DialuxElectricalCatalogSeeder::class);
    $this->seed(DialuxElectricalCatalogSeeder::class);

    expect(DialuxConductor::query()->whereNull('user_id')->where('insulation', 'N2XOH')->count())->toBe(17)
        ->and(catalogN2xohAmpacities())->toEqual(v1N2xohAmpacities());
});
