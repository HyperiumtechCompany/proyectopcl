<?php

use App\Services\ProductImportService;
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

it('ships and parses every official emergency photometry used by the active seeder', function (string $fileName, float $expectedLumens) {
    $path = dirname(__DIR__, 2)."/database/seeders/fixtures/luminaires-emergency/{$fileName}";
    $contents = file_get_contents($path);

    $warnings = [];
    $method = new ReflectionMethod(ProductImportService::class, 'parseLdt');
    $parsed = $method->invokeArgs(new ProductImportService, [$contents, &$warnings]);

    expect($path)->toBeFile()
        ->and($contents)->toBeString()->not->toBeEmpty()
        ->and(strtolower(substr(ltrim($contents), 0, 15)))->not->toContain('<!doctype', '<html')
        ->and((float) $parsed['total_lumens'])->toBe($expectedLumens)
        ->and($parsed['photometric_web']['candela'])->not->toBeEmpty();
})->with([
    'exit sign' => ['LEDVANCE-4099854230714.ldt', 20.0],
    'bulkhead' => ['LEDVANCE-4099854230677.ldt', 200.0],
]);

it('does not request placeholder photometry during deployment', function () {
    $method = new ReflectionMethod(EmergencyLuminaireSeeder::class, 'run');
    $source = file($method->getFileName());
    $body = implode('', array_slice(
        $source,
        $method->getStartLine() - 1,
        $method->getEndLine() - $method->getStartLine() + 1,
    ));

    expect($body)
        ->toContain('LEDVANCE-4099854230714.ldt', 'LEDVANCE-4099854230677.ldt')
        ->not->toContain(
            'Philips-Emergency-Exit-Sign.ldt',
            'LEDVANCE-Emergency-Exit-Sign.ldt',
            'Philips-Emergency-Compact-25W.ldt',
            'LEDVANCE-Emergency-Bulkhead-30W.ldt',
            'Legrand-Emergency-Floor-Strip.ldt',
            'Philips-Emergency-Route-Marking.ldt',
            'Zumtobel-Emergency-Pendant-20W.ldt',
        );
});
