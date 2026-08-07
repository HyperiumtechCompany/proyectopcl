<?php

use App\Models\Dialux\DialuxProject;
use App\Models\LuminaireProduct;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
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
        ->and(LuminaireProduct::query()->first()?->report_assets['polar_svg'] ?? null)->toContain('<svg')
        // `reference_lumens` = flujo contra el que la tabla de candelas está
        // normalizada (aquí, 1 lámpara x 4000 lm/lámpara del header IES) —
        // sin este campo, editar el flujo del producto después del import
        // no reescala la curva de candelas (bug corregido: parseIes() no lo
        // escribía, a diferencia de parseLdt()).
        ->and((float) (LuminaireProduct::query()->first()?->photometric_web['reference_lumens'] ?? 0))->toBe(4000.0);
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
    // Índices 26-31 (0-idx) = número de lámparas, tipo, flujo, CCT, CRI,
    // vatios del primer set de lámparas — verificado contra 8 archivos LDT
    // reales subidos por usuarios (línea 27, 1-indexada, es el número de
    // lámparas; la 28 es el tipo/texto). El fixture anterior dejaba el
    // índice 26 vacío y arrancaba en 27, un desfase de 1 línea que
    // coincidía por casualidad con un bug ya corregido en
    // ProductImportService::parseLdt().
    $lines[26] = '1';
    $lines[27] = 'LED';
    $lines[28] = '2.014';
    $lines[29] = '4000';
    $lines[30] = '80';
    $lines[31] = '21';
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

test('ldt with one c plane skips reduction factors before photometric angles', function () {
    Storage::fake();

    $user = User::factory()->create();
    $lines = array_fill(0, 32, '0');
    $lines[0] = 'Test Lighting';
    $lines[2] = '1';
    $lines[3] = '1';
    $lines[4] = '0';
    $lines[5] = '3';
    $lines[6] = '45';
    $lines[8] = 'Single C plane';
    $lines[27] = 'LED';
    $lines[28] = '2000';
    $lines[29] = '4000';
    $lines[30] = '80';
    $lines[31] = '20';
    $lines = array_merge($lines, ['0.51', '0.62', '0.70', '0.78', '0.82', '0.86', '0.90', '0.93', '0.95', '0.97'], ['0'], ['0', '45', '90'], ['500', '250', '0']);

    $file = UploadedFile::fake()->createWithContent('single-plane.ldt', implode("\n", $lines));

    $this->actingAs($user)->post(route('dialux.products.import'), [
        'file' => $file,
        'normative_standard' => 'universal',
    ])->assertCreated();

    $web = LuminaireProduct::query()->firstOrFail()->photometric_web;

    expect(array_map('floatval', $web['c_angles']))->toBe([0.0])
        ->and(array_map('floatval', $web['gamma_angles']))->toBe([0.0, 45.0, 90.0])
        ->and(array_map('floatval', $web['candela'][0]))->toBe([1000.0, 500.0, 0.0])
        ->and((float) $web['reference_lumens'])->toBe(2000.0);
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

test('authenticated users can create a luminaire manually with a synthetic photometric distribution', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Downlight Manual 15W',
            'manufacturer' => 'Marca Propia',
            'total_lumens' => 1500,
            'power_watts' => 15,
            'cct' => '4000K',
            'cri_ra' => 80,
            'beam_angle_50' => 60,
            'fixture_type' => 'recessed',
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Downlight Manual 15W')
        ->assertJsonPath('product.source_format', 'manual')
        ->assertJsonPath('product.total_lumens', 1500)
        ->assertJsonPath('product.beam_angle_50', 60);

    $product = LuminaireProduct::query()->where('user_id', $user->id)->firstOrFail();

    expect($product->photometric_web)->toHaveKeys(['c_angles', 'gamma_angles', 'candela'])
        ->and(array_map('floatval', $product->photometric_web['gamma_angles']))->toContain(0.0, 60.0, 90.0)
        ->and($product->max_candela)->toBeGreaterThan(0);

    // A la mitad del ángulo de apertura (gamma=60), la candela debe rondar la mitad del pico (definición de beam angle 50%).
    $gammaIndex = array_search(60.0, array_map('floatval', $product->photometric_web['gamma_angles']), true);
    $candelaAtBeamAngle = $product->photometric_web['candela'][0][$gammaIndex];
    expect($candelaAtBeamAngle / $product->max_candela)->toBeGreaterThan(0.45)
        ->and($candelaAtBeamAngle / $product->max_candela)->toBeLessThan(0.55);
});

test('authenticated users can create a luminaire with their own photometric curve, not just the synthetic model', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Reflector Asimétrico Propio',
            'manufacturer' => 'Marca Propia',
            'total_lumens' => 5000,
            'power_watts' => 45,
            // Curva "batwing": candela baja en nadir, pico fuera de eje — el
            // modelo sintético coseno^n nunca podría representar esta forma.
            'photometric_table' => [
                ['gamma' => 0, 'candela' => 200],
                ['gamma' => 15, 'candela' => 400],
                ['gamma' => 30, 'candela' => 800],
                ['gamma' => 45, 'candela' => 1200],
                ['gamma' => 60, 'candela' => 900],
                ['gamma' => 75, 'candela' => 300],
                ['gamma' => 90, 'candela' => 0],
            ],
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Reflector Asimétrico Propio')
        ->assertJsonPath('product.source_format', 'manual')
        // El ángulo de haz NO se declaró — se calculó de la curva real: el
        // ángulo más amplio con candela >= 50% del pico (1200 en gamma=45)
        // es gamma=60 (900/1200 = 75%), no el gamma del propio pico.
        ->assertJsonPath('product.beam_angle_50', 60)
        ->assertJsonPath('product.max_candela', 1200);

    $product = LuminaireProduct::query()->where('user_id', $user->id)->firstOrFail();

    expect($product->photometric_summary['format_version'])->toBe('manual-custom-curve')
        ->and($product->photometric_web['gamma_angles'])->toBe([0, 15, 30, 45, 60, 75, 90])
        ->and($product->photometric_web['candela'][0])->toBe([200, 400, 800, 1200, 900, 300, 0]);
});

test('manual photometric curve requires at least 3 points', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Curva incompleta',
            'total_lumens' => 1000,
            'photometric_table' => [
                ['gamma' => 0, 'candela' => 100],
                ['gamma' => 45, 'candela' => 50],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['photometric_table']);
});

test('manual luminaire creation requires beam angle and total lumens', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Sin datos fotometricos',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['total_lumens', 'beam_angle_50']);
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

test('owners can share their luminaire so other users can see and use it', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();

    $product = LuminaireProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Panel compartible',
        'manufacturer' => 'Test Lighting',
        'source_format' => 'manual',
        'total_lumens' => 3200,
        'power_watts' => 32,
        'fixture_type' => 'panel',
        'fixture_shape' => 'rectangular',
    ]);

    // Antes de compartir, otro usuario no puede verlo.
    $this->actingAs($otherUser)
        ->getJson(route('dialux.products.show', $product))
        ->assertNotFound();

    $this->actingAs($owner)
        ->patchJson(route('dialux.products.share', $product), ['is_global' => true])
        ->assertSuccessful()
        ->assertJsonPath('product.is_global', true)
        ->assertJsonPath('product.is_owner', true);

    expect($product->refresh()->is_global)->toBeTrue();

    // Ahora sí es visible y aparece marcado como no-propio para el otro usuario.
    $this->actingAs($otherUser)
        ->getJson(route('dialux.products.show', $product))
        ->assertSuccessful()
        ->assertJsonPath('product.is_owner', false);

    $this->actingAs($owner)
        ->patchJson(route('dialux.products.share', $product), ['is_global' => false])
        ->assertSuccessful()
        ->assertJsonPath('product.is_global', false);

    expect($product->refresh()->is_global)->toBeFalse();

    $this->actingAs($otherUser)
        ->getJson(route('dialux.products.show', $product))
        ->assertNotFound();
});

test('a user cannot share a luminaire that belongs to someone else', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();

    $product = LuminaireProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Panel ajeno',
        'manufacturer' => 'Test Lighting',
        'source_format' => 'manual',
        'total_lumens' => 3200,
        'power_watts' => 32,
        'fixture_type' => 'panel',
        'fixture_shape' => 'rectangular',
    ]);

    $this->actingAs($otherUser)
        ->patchJson(route('dialux.products.share', $product), ['is_global' => true])
        ->assertNotFound();

    expect($product->refresh()->is_global)->toBeFalse();
});

// ─── Fase 3 del plan maestro: procedencia fotométrica + validaciones ───────

test('ies import tags photometric provenance as manufacturer and reports it explicitly', function () {
    Storage::fake();
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

    $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal'])
        ->assertCreated();

    $product = LuminaireProduct::query()->firstOrFail();

    expect($product->photometric_web['provenance'])->toBe('manufacturer');

    $lastRow = collect($product->report_data['technical_table'])->last();
    expect($lastRow['label'])->toBe('Origen fotometría')
        ->and($lastRow['value'])->toBe('Archivo de fabricante (IES/LDT)');
});

test('ldt import tags photometric provenance as manufacturer', function () {
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
    // Índices 26-31 (0-idx) = número de lámparas, tipo, flujo, CCT, CRI,
    // vatios del primer set de lámparas — verificado contra 8 archivos LDT
    // reales subidos por usuarios (línea 27, 1-indexada, es el número de
    // lámparas; la 28 es el tipo/texto). El fixture anterior dejaba el
    // índice 26 vacío y arrancaba en 27, un desfase de 1 línea que
    // coincidía por casualidad con un bug ya corregido en
    // ProductImportService::parseLdt().
    $lines[26] = '1';
    $lines[27] = 'LED';
    $lines[28] = '2.014';
    $lines[29] = '4000';
    $lines[30] = '80';
    $lines[31] = '21';
    $lines[] = '900 600 80';
    $lines[] = '860 580 75';

    $file = UploadedFile::fake()->createWithContent('regiolux.ldt', implode("\n", $lines));

    $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal'])
        ->assertCreated();

    $product = LuminaireProduct::query()->firstOrFail();

    expect($product->photometric_web['provenance'])->toBe('manufacturer')
        ->and($product->photometric_web['symmetry'])->toBe(0);
});

test('manual synthetic photometry is tagged and reported as non-manufacturer', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Downlight Manual 15W',
            'total_lumens' => 1500,
            'beam_angle_50' => 60,
        ])
        ->assertCreated();

    $product = LuminaireProduct::query()->where('user_id', $user->id)->firstOrFail();

    expect($product->photometric_web['provenance'])->toBe('synthetic');

    $lastRow = collect($product->report_data['technical_table'])->last();
    expect($lastRow['label'])->toBe('Origen fotometría')
        ->and($lastRow['value'])->toBe('Modelo sintético aproximado (no es dato de fabricante)');
});

test('manual custom curve photometry is tagged as manual-curve, distinct from the synthetic model', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('dialux.products.store-manual'), [
            'name' => 'Curva propia',
            'total_lumens' => 2000,
            'photometric_table' => [
                ['gamma' => 0, 'candela' => 500],
                ['gamma' => 45, 'candela' => 300],
                ['gamma' => 90, 'candela' => 0],
            ],
        ])
        ->assertCreated();

    $product = LuminaireProduct::query()->where('user_id', $user->id)->firstOrFail();

    expect($product->photometric_web['provenance'])->toBe('manual-curve');

    $lastRow = collect($product->report_data['technical_table'])->last();
    expect($lastRow['value'])->toBe('Curva ingresada manualmente (no es dato de fabricante)');
});

test('an owner can update editable luminaire catalog properties', function () {
    $user = User::factory()->create();
    $product = LuminaireProduct::query()->create([
        'user_id' => $user->id,
        'name' => 'Panel original',
        'source_format' => 'manual',
        'total_lumens' => 1200,
        'power_watts' => 12,
        'cct' => '3000K',
    ]);

    $this->actingAs($user)
        ->patchJson(route('dialux.products.update', $product), [
            'name' => 'Panel actualizado',
            'manufacturer' => 'Marca propia',
            'catalog_number' => 'P-20',
            'total_lumens' => 2400,
            'power_watts' => 20,
            'cct' => '4000K',
            'cri_ra' => 90,
        ])
        ->assertSuccessful()
        ->assertJsonPath('product.name', 'Panel actualizado')
        ->assertJsonPath('product.total_lumens', 2400)
        ->assertJsonPath('product.is_owner', true);

    $this->assertDatabaseHas('luminaire_products', [
        'id' => $product->id,
        'name' => 'Panel actualizado',
        'total_lumens' => 2400,
        'cri_ra' => 90,
    ]);
});

test('a user cannot update another users luminaire', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $product = LuminaireProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Luminaria privada',
        'source_format' => 'manual',
        'total_lumens' => 1200,
    ]);

    $this->actingAs($otherUser)
        ->patchJson(route('dialux.products.update', $product), [
            'name' => 'Cambio no permitido',
            'total_lumens' => 5000,
        ])
        ->assertNotFound();

    expect($product->refresh()->name)->toBe('Luminaria privada');
});

test('ies import warns when vertical angles are not monotonically increasing', function () {
    Storage::fake();
    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('panel-bad-angles.ies', implode("\n", [
        'IESNA:LM-63-2002',
        '[MANUFAC] Test Lighting',
        '[LUMINAIRE] Panel Malformado',
        'TILT=NONE',
        '1 4000 1 3 1 1 2 0.6 0.6 0.05',
        '0 90 45',
        '0',
        '1200 100 800',
    ]));

    $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal'])
        ->assertCreated();

    $product = LuminaireProduct::query()->firstOrFail();

    expect(collect($product->report_data['warnings'])
        ->contains(fn ($w) => str_contains($w, 'no son monotónicamente crecientes')))->toBeTrue();
});

test('ies import warns when the candela matrix does not match the declared dimensions', function () {
    Storage::fake();
    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('panel-bad-matrix.ies', implode("\n", [
        'IESNA:LM-63-2002',
        '[MANUFAC] Test Lighting',
        '[LUMINAIRE] Panel Matriz Incompleta',
        'TILT=NONE',
        '1 4000 1 3 2 1 2 0.6 0.6 0.05',
        '0 45 90',
        '0 90',
        '1200 800 100',
    ]));

    $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal'])
        ->assertCreated();

    $product = LuminaireProduct::query()->firstOrFail();

    expect(collect($product->report_data['warnings'])
        ->contains(fn ($w) => str_contains($w, 'se esperaban 3')))->toBeTrue();
});

test('ies import warns when declared flux differs greatly from the integrated flux of the curve', function () {
    Storage::fake();
    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('panel-bad-flux.ies', implode("\n", [
        'IESNA:LM-63-2002',
        '[MANUFAC] Test Lighting',
        '[LUMINAIRE] Panel Flujo Inconsistente',
        'TILT=NONE',
        '1 100000 1 3 1 1 2 0.6 0.6 0.05',
        '0 45 90',
        '0',
        '1200 800 100',
    ]));

    $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal'])
        ->assertCreated();

    $product = LuminaireProduct::query()->firstOrFail();

    expect(collect($product->report_data['warnings'])
        ->contains(fn ($w) => str_contains($w, 'difiere del flujo integrado')))->toBeTrue();
});

test('ies TILT=INCLUDE is parsed without corrupting the photometric matrix', function () {
    Storage::fake();
    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('panel-tilt.ies', implode("\n", [
        'IESNA:LM-63-2002',
        '[MANUFAC] Test Lighting',
        '[LUMINAIRE] Panel con Tilt',
        'TILT=INCLUDE',
        '1',
        '2',
        '0 90',
        '1.0 0.9',
        '1 4000 1 3 1 1 2 0.6 0.6 0.05',
        '0 45 90',
        '0',
        '1200 800 100',
    ]));

    $response = $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal']);

    $response->assertCreated()->assertJsonPath('product.total_lumens', 4000);

    $product = LuminaireProduct::query()->firstOrFail();

    // json_encode colapsa floats de valor entero (0.0 -> 0) al persistir el
    // cast `array` — comparar con floatval en vez de exigir el tipo exacto.
    expect(array_map('floatval', $product->photometric_web['gamma_angles']))->toBe([0.0, 45.0, 90.0])
        ->and(array_map('floatval', $product->photometric_web['candela'][0]))->toBe([1200.0, 800.0, 100.0])
        ->and((int) $product->photometric_web['tilt']['lamp_to_luminaire_geometry'])->toBe(1)
        ->and(array_map('floatval', $product->photometric_web['tilt']['angles']))->toBe([0.0, 90.0])
        ->and(array_map('floatval', $product->photometric_web['tilt']['multipliers']))->toBe([1.0, 0.9]);

    expect(collect($product->report_data['warnings'])
        ->contains(fn ($w) => str_contains($w, 'TILT=INCLUDE detectado')))->toBeTrue();
});

test('gldf import warns that photometric matrix extraction is not implemented yet', function () {
    Storage::fake();
    $user = User::factory()->create();
    $xml = '<?xml version="1.0"?><Product><GeneralDefinitions><Name>Panel GLDF</Name>'
        .'<Manufacturer name="Test Lighting"/><Flux>3000</Flux><Wattage>30</Wattage>'
        .'</GeneralDefinitions></Product>';
    $file = UploadedFile::fake()->createWithContent('panel.gldf', $xml);

    $response = $this->actingAs($user)
        ->post(route('dialux.products.import'), ['file' => $file, 'normative_standard' => 'universal']);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Panel GLDF')
        ->assertJsonPath('product.source_format', 'gldf');

    $product = LuminaireProduct::query()->firstOrFail();

    expect($product->photometric_web)->toBeNull();

    $lastRow = collect($product->report_data['technical_table'])->last();
    expect($lastRow['value'])->toBe('Sin matriz fotométrica (aprox. Lambertiana en el cálculo)');

    expect(collect($product->report_data['warnings'])
        ->contains(fn ($w) => str_contains($w, 'no se extrae la matriz fotométrica')))->toBeTrue();
});

test('photometry repair restores legacy ldt data and synchronizes placed fixtures without losing edits', function () {
    Storage::fake();
    $user = User::factory()->create();
    $path = 'dialux/product-catalog/user_'.$user->id.'/legacy.ldt';
    $lines = array_fill(0, 32, '0');
    $lines[0] = 'Test Lighting';
    $lines[2] = '1';
    $lines[3] = '1';
    $lines[4] = '0';
    $lines[5] = '3';
    $lines[6] = '45';
    $lines[8] = 'Legacy repaired';
    $lines[27] = 'LED';
    $lines[28] = '2000';
    $lines[29] = '4000';
    $lines[30] = '80';
    $lines[31] = '20';
    $lines = array_merge($lines, ['0.51', '0.62', '0.70', '0.78', '0.82', '0.86', '0.90', '0.93', '0.95', '0.97'], ['0'], ['0', '45', '90'], ['500', '250', '0']);
    Storage::put($path, implode("\n", $lines));

    $product = LuminaireProduct::query()->create([
        'user_id' => $user->id,
        'name' => 'Nombre editado',
        'source_format' => 'ldt',
        'source_file_path' => $path,
        'total_lumens' => 1000,
        'power_watts' => 18,
        'photometric_web' => [
            'c_angles' => [0.51],
            'gamma_angles' => [0, 45, 90],
            'candela' => [[500, 250, 0]],
        ],
    ]);
    $project = DialuxProject::factory()->for($user)->create([
        'data' => [
            'scenes' => [[
                'fixtures' => [[
                    'id' => 'fixture-1',
                    'productId' => $product->id,
                    'lumens' => 750,
                    'powerWatts' => 15,
                    'x' => 1.25,
                    'z' => 4.67,
                    'photometricWeb' => $product->photometric_web,
                ]],
            ]],
        ],
    ]);

    expect(Artisan::call('dialux:repair-photometry', ['--product' => [$product->id]]))->toBe(0);

    $product->refresh();
    $fixture = $project->refresh()->data['scenes'][0]['fixtures'][0];
    $imaxRow = collect($product->report_data['technical_table'])->firstWhere('label', 'Imax');

    expect(array_map('floatval', $product->photometric_web['c_angles']))->toBe([0.0])
        ->and((float) $product->photometric_web['reference_lumens'])->toBe(2000.0)
        ->and((int) $product->photometric_web['schema_version'])->toBe(2)
        ->and($product->name)->toBe('Nombre editado')
        ->and($product->total_lumens)->toBe(1000.0)
        ->and($product->power_watts)->toBe(18.0)
        ->and($product->max_candela)->toBe(500.0)
        ->and($imaxRow['value'])->toBe('500 cd')
        ->and($product->report_assets['polar_svg'])->toContain('Imax 500 cd')
        ->and($fixture['lumens'])->toBe(750)
        ->and($fixture['powerWatts'])->toBe(15)
        ->and($fixture['x'])->toBe(1.25)
        ->and($fixture['z'])->toBe(4.67)
        ->and((float) $fixture['photometricWeb']['c_angles'][0])->toBe(0.0)
        ->and((float) $fixture['photometricWeb']['reference_lumens'])->toBe(2000.0);
});
