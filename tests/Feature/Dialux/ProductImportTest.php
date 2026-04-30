<?php

use App\Models\LuminaireProduct;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('authenticated users can import an ies luminaire product', function () {
    Storage::fake();
    Storage::fake('public');

    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('panel.ies', implode("\n", [
        'IESNA:LM-63-2002',
        '[MANUFAC] Test Lighting',
        '[LUMCAT] PANEL-40W',
        '[LUMINAIRE] Panel LED 40W',
        '[WATTS] 40',
        'TILT=NONE',
        '1 4000 1 3 1 1 2 0.6 0.6 0.05',
        '0 45 90',
        '0',
        '1200 800 100',
    ]));
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    $productImage = UploadedFile::fake()->createWithContent('panel.png', $png);
    $brandLogo = UploadedFile::fake()->createWithContent('test-lighting.png', $png);

    $response = $this
        ->actingAs($user)
        ->post(route('dialux.products.import'), [
            'file' => $file,
            'name' => 'Panel LED Catalogado',
            'manufacturer' => 'Catalog Brand',
            'product_image' => $productImage,
            'brand_logo' => $brandLogo,
            'normative_standard' => 'universal',
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Panel LED Catalogado')
        ->assertJsonPath('product.manufacturer', 'Catalog Brand')
        ->assertJsonPath('product.source_format', 'ies')
        ->assertJsonPath('product.total_lumens', 4000)
        ->assertJsonPath('product.report_data.technical_table.0.label', 'Fabricante')
        ->assertJsonPath('product.product_image_path', fn ($path) => is_string($path) && str_contains($path, 'dialux/product-catalog/user_'.$user->id.'/images'))
        ->assertJsonPath('product.brand_logo_path', fn ($path) => is_string($path) && str_contains($path, 'dialux/product-catalog/user_'.$user->id.'/logos'));

    expect(LuminaireProduct::query()->where('user_id', $user->id)->count())->toBe(1);
    expect(LuminaireProduct::query()->first()?->photometric_web)->toHaveKeys(['c_angles', 'gamma_angles', 'candela'])
        ->and(LuminaireProduct::query()->first()?->report_assets['polar_svg'] ?? null)->toContain('<svg');
    Storage::disk('public')->assertExists(LuminaireProduct::query()->firstOrFail()->product_image_path);
    Storage::disk('public')->assertExists(LuminaireProduct::query()->firstOrFail()->brand_logo_path);
});

test('authenticated users can import an ldt luminaire product with report data', function () {
    Storage::fake();

    $user = User::factory()->create();
    $lines = array_fill(0, 33, '');
    $lines[0] = 'Regiolux';
    $lines[2] = '0';
    $lines[3] = '2';
    $lines[4] = '90';
    $lines[5] = '3';
    $lines[6] = '45';
    $lines[8] = 'Downlight Opal';
    $lines[9] = 'DALL-21W';
    $lines[12] = '0.2 0.2 0.08';
    $lines[14] = '0.72';
    $lines[27] = '1';
    $lines[28] = 'LED';
    $lines[29] = '2.014';
    $lines[30] = '4000';
    $lines[31] = '80';
    $lines[32] = '21';
    $lines[] = '900 600 80';
    $lines[] = '860 580 75';

    $file = UploadedFile::fake()->createWithContent('regiolux.ldt', implode("\n", $lines));

    $response = $this
        ->actingAs($user)
        ->post(route('dialux.products.import'), [
            'file' => $file,
            'normative_standard' => 'universal',
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Downlight Opal')
        ->assertJsonPath('product.manufacturer', 'Regiolux')
        ->assertJsonPath('product.catalog_number', 'DALL-21W')
        ->assertJsonPath('product.total_lumens', 2014)
        ->assertJsonPath('product.power_watts', 21)
        ->assertJsonPath('product.cct', '4000K')
        ->assertJsonPath('product.cri_ra', 80)
        ->assertJsonPath('product.report_data.technical_table.3.label', 'P');

    $product = LuminaireProduct::query()->firstOrFail();

    expect($product->photometric_web['candela'])->toHaveCount(2)
        ->and($product->report_assets['polar_svg'])->toContain('CDL polar');
});

test('authenticated users can import an extended ldt luminaire product without shifting photometric fields', function () {
    Storage::fake();

    $user = User::factory()->create();
    $lines = [
        'Regiolux GmbH',
        '1',
        '1',
        '24',
        '15',
        '37',
        '2.5',
        'V1003085_[AP]_{PF:K346:LS3350}',
        'relo-RDES-O 190 LED 2300-0700 840 ETM VW IP44 (15W)',
        '37632104140-15W',
        '37632104140-15W',
        '21.10.2025 DG',
        '190',
        '0',
        '3',
        '151',
        '0',
        '0',
        '0',
        '0',
        '0',
        '100',
        '100',
        '1',
        '0',
        '1',
        '-1',
        'LED 190 840 G2',
        '1821',
        '4000',
        '80',
        '14.7',
        '0.323',
        '0.418',
        '0.492',
        '0.582',
        '0.64',
        '0.711',
        '0.768',
        '0.814',
        '0.849',
        '0.88',
    ];
    $lines = array_merge(
        $lines,
        array_map('strval', range(0, 345, 15)),
        array_map(fn (int $index): string => (string) ($index * 2.5), range(0, 36)),
        ['390.6 390.47 388.94 386.49 383.06 378.81 373.55 367.42 360.26 352.21 343.25 333.54 322.97 311.83 299.68 287.13 273.74 259.86 245.2 229.44 213.77 197.54 180.7 163.59 145.87 128.15 110.07 92.36 74.94 57.75 41.88 27.53 16.29 11.05 7.2 3.25 0.05'],
    );

    $file = UploadedFile::fake()->createWithContent('regiolux-extended.ldt', implode("\n", $lines));

    $response = $this
        ->actingAs($user)
        ->post(route('dialux.products.import'), [
            'file' => $file,
            'normative_standard' => 'universal',
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.total_lumens', 1821)
        ->assertJsonPath('product.power_watts', 14.7)
        ->assertJsonPath('product.cct', '4000K')
        ->assertJsonPath('product.cri_ra', 80)
        ->assertJsonPath('product.efficiency', 123.9)
        ->assertJsonPath('product.report_data.technical_table.3.value', '14.7 W')
        ->assertJsonPath('product.report_data.technical_table.4.value', '1821 lm')
        ->assertJsonPath('product.report_data.technical_table.5.value', '123.9 lm/W')
        ->assertJsonPath('product.report_data.technical_table.6.value', '4000K')
        ->assertJsonPath('product.report_data.technical_table.7.value', '80');

    $product = LuminaireProduct::query()->firstOrFail();

    expect($product->photometric_web['candela'])->toHaveCount(1)
        ->and($product->max_candela)->toBe(711.3);
});

test('authenticated users can list their imported products', function () {
    $user = User::factory()->create();

    LuminaireProduct::query()->create([
        'user_id' => $user->id,
        'name' => 'Panel importado',
        'manufacturer' => 'Test Lighting',
        'product_image_path' => 'dialux/product-catalog/user_'.$user->id.'/images/panel.png',
        'brand_logo_path' => 'dialux/product-catalog/user_'.$user->id.'/logos/logo.png',
        'source_format' => 'ies',
        'total_lumens' => 3200,
        'power_watts' => 32,
        'fixture_type' => 'panel',
        'fixture_shape' => 'rectangular',
    ]);

    $response = $this
        ->actingAs($user)
        ->getJson(route('dialux.products.index'));

    $response->assertSuccessful()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('products.0.name', 'Panel importado')
        ->assertJsonPath('products.0.product_image_path', 'dialux/product-catalog/user_'.$user->id.'/images/panel.png')
        ->assertJsonPath('products.0.brand_logo_path', 'dialux/product-catalog/user_'.$user->id.'/logos/logo.png');
});

test('authenticated users can show enriched products they can access', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $product = LuminaireProduct::query()->create([
        'user_id' => $user->id,
        'name' => 'Panel enriquecido',
        'manufacturer' => 'Test Lighting',
        'source_format' => 'ies',
        'total_lumens' => 3200,
        'power_watts' => 32,
        'fixture_type' => 'panel',
        'fixture_shape' => 'rectangular',
        'photometric_web' => ['c_angles' => [0], 'gamma_angles' => [0, 45, 90], 'candela' => [[1200, 800, 100]]],
        'report_data' => ['technical_table' => [['label' => 'Producto', 'value' => 'Panel enriquecido']]],
        'report_assets' => ['polar_svg' => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ]);

    $this->actingAs($user)
        ->getJson(route('dialux.products.show', $product))
        ->assertSuccessful()
        ->assertJsonPath('product.report_data.technical_table.0.value', 'Panel enriquecido')
        ->assertJsonPath('product.report_assets.polar_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    $this->actingAs($otherUser)
        ->getJson(route('dialux.products.show', $product))
        ->assertNotFound();
});

test('assigning a product stores a project snapshot', function () {
    $user = User::factory()->create();

    $product = LuminaireProduct::query()->create([
        'user_id' => $user->id,
        'name' => 'Panel snapshot',
        'manufacturer' => 'Test Lighting',
        'source_format' => 'ies',
        'total_lumens' => 3200,
        'power_watts' => 32,
        'fixture_type' => 'panel',
        'fixture_shape' => 'rectangular',
        'report_data' => ['technical_table' => [['label' => 'Producto', 'value' => 'Panel snapshot']]],
        'report_assets' => ['polar_svg' => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ]);

    $this->actingAs($user)
        ->postJson(route('dialux.products.assign', $product), [
            'project_id' => 'project-1',
            'quantity_used' => 4,
            'placement_config' => ['room_id' => 'room-1'],
        ])
        ->assertSuccessful()
        ->assertJsonPath('product_id', $product->id);

    $snapshot = json_decode(DB::table('project_products')->value('product_snapshot'), true);

    expect($snapshot['name'])->toBe('Panel snapshot')
        ->and($snapshot['report_data']['technical_table'][0]['value'])->toBe('Panel snapshot')
        ->and(DB::table('project_products')->value('quantity_used'))->toBe(4);
});
