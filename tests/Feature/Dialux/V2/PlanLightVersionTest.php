<?php

use App\Jobs\Dialux\LightenDialuxPlan;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use App\Services\Dialux\CadPlanGeometryBuilder;
use App\Services\Dialux\CadPlanLightener;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Pares [código, valor] → texto DXF ASCII. */
function dxfFrom(array $pairs): string
{
    return implode("\r\n", array_map(fn (array $pair): string => $pair[0]."\r\n".$pair[1], $pairs))."\r\n";
}

/**
 * Plano de muestra como el del usuario: muros, un árbol como BLOQUE pesado
 * insertado en "Arboles y Arbustos", un bloque de puerta usado por dos capas
 * (compartido), un sombreado, un marco en espacio PAPEL y un bloque sin uso.
 */
function samplePlanDxf(): string
{
    $tree = [];
    for ($i = 0; $i < 60; $i++) {
        $tree[] = [0, 'CIRCLE'];
        $tree[] = [8, '0'];
        $tree[] = [10, (string) $i];
        $tree[] = [20, '0'];
        $tree[] = [40, '0.5'];
    }

    return dxfFrom([
        [0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1027'], [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'BLOCKS'],
        [0, 'BLOCK'], [2, '*Model_Space'], [0, 'ENDBLK'],
        [0, 'BLOCK'], [2, 'ARBOL'], [10, '0'], [20, '0'],
        ...$tree,
        [0, 'ENDBLK'],
        [0, 'BLOCK'], [2, 'PUERTA'], [10, '0'], [20, '0'],
        [0, 'ARC'], [8, '0'], [10, '0'], [20, '0'], [40, '0.9'], [50, '0'], [51, '90'],
        [0, 'ENDBLK'],
        [0, 'BLOCK'], [2, 'SIN_USO'], [10, '0'], [20, '0'],
        ...$tree,
        [0, 'ENDBLK'],
        [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'ENTITIES'],
        [0, 'LINE'], [8, 'MUROS'], [10, '0'], [20, '0'], [11, '10'], [21, '0'],
        [0, 'LINE'], [8, 'MUROS'], [10, '10'], [20, '0'], [11, '10'], [21, '8'],
        [0, 'INSERT'], [8, 'Arboles y Arbustos'], [2, 'ARBOL'], [10, '3'], [20, '3'],
        [0, 'INSERT'], [8, 'MUROS'], [2, 'PUERTA'], [10, '5'], [20, '0'],
        [0, 'INSERT'], [8, '13. PUERTAS.'], [2, 'PUERTA'], [10, '7'], [20, '0'],
        [0, 'HATCH'], [8, 'SOMBRA'], [2, 'ANSI31'], [10, '1'], [20, '1'],
        [0, 'LINE'], [8, 'MARCO'], [67, '1'], [10, '0'], [20, '0'], [11, '42'], [21, '0'],
        [0, 'TEXT'], [8, 'TEXTOS'], [10, '2'], [20, '2'], [1, 'Aula 1'],
        [0, 'ENDSEC'],
        [0, 'EOF'],
    ]);
}

function tempDxf(string $contents): string
{
    $dir = sys_get_temp_dir().'/dxf-light-'.Str::uuid();
    mkdir($dir);
    file_put_contents("$dir/in.dxf", $contents);

    return $dir;
}

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    Storage::set('local', Storage::build([
        'driver' => 'local',
        'root' => sys_get_temp_dir().'/dialux-plan-light-tests-'.Str::uuid(),
        'throw' => true,
    ]));
});

test('el análisis pesa cada capa con los bloques que solo ella usa', function () {
    $dir = tempDxf(samplePlanDxf());
    $analysis = app(CadPlanLightener::class)->analyzeDxf("$dir/in.dxf");
    $layers = $analysis['layers'];

    // El árbol (bloque de 60 círculos) pesa en su capa, no en la base.
    expect($layers['Arboles y Arbustos']['bytes'])->toBeGreaterThan($layers['MUROS']['bytes'])
        ->and(array_key_first($layers))->toBe('Arboles y Arbustos')
        // Espacio papel y sombreados no cuentan; tampoco su capa.
        ->and($layers)->not->toHaveKey('MARCO')
        ->and($layers)->not->toHaveKey('SOMBRA')
        ->and($layers['MUROS']['entities'])->toBe(3);

    // Estimación con TODAS las capas = base + Σ capas (el bloque sin uso no pesa).
    $lightener = app(CadPlanLightener::class);
    expect($lightener->estimateBytes($analysis, null))
        ->toBe($analysis['base_bytes'] + array_sum(array_column($layers, 'bytes')))
        ->and($lightener->estimateBytes($analysis, ['MUROS']))->toBeLessThan($lightener->estimateBytes($analysis, null));
});

test('la versión ligera deja solo las capas elegidas y vacía los bloques que nadie usa', function () {
    $dir = tempDxf(samplePlanDxf());
    $lightener = app(CadPlanLightener::class);
    $report = $lightener->writeLight("$dir/in.dxf", "$dir/out.dxf", ['MUROS', 'TEXTOS']);
    $out = file_get_contents("$dir/out.dxf");

    expect($out)->toContain('MUROS')
        ->and($out)->toContain('Aula 1')
        ->and($out)->not->toContain('Arboles y Arbustos')
        ->and($out)->not->toContain('SOMBRA')
        ->and($out)->not->toContain('MARCO')
        // Bloques: el del árbol y el sin uso quedan vacíos (se conserva su cabecera);
        // la puerta la sigue usando MUROS.
        ->and($out)->toContain("2\r\nARBOL")
        ->and($out)->not->toContain('CIRCLE')
        ->and($out)->toContain('ARC')
        ->and(trim($out))->toEndWith("0\r\nEOF")
        ->and($report['dropped_by_type'])->toHaveKeys(['CAPA NO ELEGIDA', 'ESPACIO PAPEL', 'HATCH', 'BLOQUE SIN USO'])
        ->and($report['bytes'])->toBeLessThan(filesize("$dir/in.dxf"));

    // Todas las capas: árbol completo, sin papel ni sombreado.
    $lightener->writeLight("$dir/in.dxf", "$dir/all.dxf");
    $all = file_get_contents("$dir/all.dxf");
    expect($all)->toContain('CIRCLE')->and($all)->not->toContain('MARCO')->and($all)->not->toContain('HATCH');
});

test('las capas decorativas vienen desmarcadas por defecto', function () {
    $dir = tempDxf(samplePlanDxf());
    $lightener = app(CadPlanLightener::class);
    $choices = collect($lightener->layerChoices($lightener->analyzeDxf("$dir/in.dxf")))->keyBy('name');

    expect($choices['Arboles y Arbustos']['keep'])->toBeFalse()
        ->and($choices['MUROS']['keep'])->toBeTrue()
        ->and($choices['13. PUERTAS.']['keep'])->toBeTrue();
});

test('un DXF binario se rechaza con un mensaje claro', function () {
    $dir = tempDxf("AutoCAD Binary DXF\r\n\x1a\x00...");

    expect(fn () => app(CadPlanLightener::class)->writeLight("$dir/in.dxf", "$dir/out.dxf"))
        ->toThrow(RuntimeException::class, 'DXF binario');
});

test('un plano pesado se convierte en segundo plano a geometría completa y el editor la descarga', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dxf' => 100]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module, 'site-plan-source'];

    $this->actingAs($user)
        ->post(route('dialux-v2.modules.plans.store', $parameters), [
            'plan' => UploadedFile::fake()->createWithContent('PLANTA GENERAL.dxf', samplePlanDxf()),
        ])
        ->assertSuccessful()
        ->assertJsonPath('light_status', 'pending');
    Queue::assertPushed(LightenDialuxPlan::class);

    // Lo que corre el worker: TODAS las capas, sin pedir elegir.
    $plan = $module->plans()->firstOrFail();
    (new LightenDialuxPlan($plan->id))->handle(app(CadPlanLightener::class));
    expect($plan->refresh()->light_status)->toBe('ready')
        ->and($plan->light_layers['format'])->toBe('geometry');

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.plans.light-status', $parameters))
        ->assertSuccessful()
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('format', 'geometry');

    $response = $this->actingAs($user)->get(route('dialux-v2.modules.plans.light', $parameters));
    $response->assertSuccessful()->assertHeader('Content-Encoding', 'gzip');
    $dxg = gzdecode($response->streamedContent());
    expect(substr($dxg, 0, 4))->toBe('DXG1');
    $header = json_decode(substr($dxg, 8, unpack('V', substr($dxg, 4, 4))[1]), true);
    // Muros, puertas y árboles (bloques expandidos); sin espacio papel ni sombreados.
    expect(array_column($header['layers'], 'name'))->toContain('MUROS', 'Arboles y Arbustos', '13. PUERTAS.')
        ->and(array_column($header['layers'], 'name'))->not->toContain('MARCO', 'SOMBRA');
});

test('con capas elegidas explícitamente se genera la versión DXF ligera', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dxf' => 100]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module, 'site-plan-source'];
    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', $parameters), [
        'plan' => UploadedFile::fake()->createWithContent('PLANTA GENERAL.dxf', samplePlanDxf()),
    ]);
    $plan = $module->plans()->firstOrFail();
    (new LightenDialuxPlan($plan->id))->handle(app(CadPlanLightener::class));

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.plans.light-layers', $parameters), ['keep' => ['MUROS']])
        ->assertSuccessful()
        ->assertJsonPath('status', 'pending');
    Queue::assertPushed(LightenDialuxPlan::class, fn (LightenDialuxPlan $job) => $job->keepLayers === ['MUROS']);

    config(['dialux.plan_light.threshold_bytes.dxf' => 20_000_000]);
    (new LightenDialuxPlan($plan->id, ['MUROS']))->handle(app(CadPlanLightener::class));
    expect($plan->refresh()->light_status)->toBe('ready');

    $this->actingAs($user)
        ->get(route('dialux-v2.modules.plans.light', $parameters))
        ->assertDownload('PLANTA GENERAL (ligero).dxf');
});

test('elegir capas exige al menos una', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.plans.light-layers', [$project, $module, 'floor-1']), ['keep' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('keep');
});

test('un DWG sin conversor configurado falla con un aviso útil (no deja al editor esperando)', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dwg' => 10, 'dialux.plan_light.dwg_converter' => null]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', [$project, $module, 'site-plan-source']), [
        'plan' => UploadedFile::fake()->create('plano.dwg', 50),
    ])->assertSuccessful();

    $plan = $module->plans()->firstOrFail();
    (new LightenDialuxPlan($plan->id))->handle(app(CadPlanLightener::class));

    expect($plan->refresh()->light_status)->toBe('failed')
        ->and($plan->light_error)->toContain('DXF');
});

test('un plano liviano no se pone en cola ni pide versión ligera', function () {
    Queue::fake();
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', [$project, $module, 'floor-1']), [
        'plan' => UploadedFile::fake()->createWithContent('aula.dxf', samplePlanDxf()),
    ])->assertSuccessful();

    Queue::assertNotPushed(LightenDialuxPlan::class);
    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.plans.light-status', [$project, $module, 'floor-1']))
        ->assertJsonPath('needs_light', false)
        ->assertJsonPath('status', null);
});

test('otro usuario no puede consultar ni elegir capas', function () {
    $owner = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $this->actingAs($owner)->post(route('dialux-v2.modules.plans.store', [$project, $module, 'floor-1']), [
        'plan' => UploadedFile::fake()->createWithContent('aula.dxf', samplePlanDxf()),
    ]);
    $intruder = User::factory()->create();

    $this->actingAs($intruder)
        ->getJson(route('dialux-v2.modules.plans.light-status', [$project, $module, 'floor-1']))
        ->assertForbidden();
    $this->actingAs($intruder)
        ->postJson(route('dialux-v2.modules.plans.light-layers', [$project, $module, 'floor-1']), ['keep' => ['MUROS']])
        ->assertForbidden();
});

test('un plano ya procesado con el método anterior se reconvierte a geometría al consultarlo', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dxf' => 100]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module, 'site-plan-source'];
    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', $parameters), [
        'plan' => UploadedFile::fake()->createWithContent('PLANTA GENERAL.dxf', samplePlanDxf()),
    ]);
    $plan = $module->plans()->firstOrFail();
    $plan->forceFill(['light_status' => 'needs_layers', 'light_layers' => ['layers' => []]])->save();

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.plans.light-status', $parameters))
        ->assertSuccessful()
        ->assertJsonPath('status', 'pending');
    Queue::assertPushed(LightenDialuxPlan::class, 2);
});

test('una geometría de una versión anterior del procesamiento se regenera al consultarla', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dxf' => 100]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module, 'site-plan-source'];
    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', $parameters), [
        'plan' => UploadedFile::fake()->createWithContent('PLANTA GENERAL.dxf', samplePlanDxf()),
    ]);
    $plan = $module->plans()->firstOrFail();
    (new LightenDialuxPlan($plan->id))->handle(app(CadPlanLightener::class));
    expect($plan->refresh()->light_layers['version'])->toBe(CadPlanGeometryBuilder::VERSION);

    // Vigente: no se vuelve a encolar.
    $this->actingAs($user)->getJson(route('dialux-v2.modules.plans.light-status', $parameters))
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('raw_bytes', $plan->light_layers['raw_bytes']);
    Queue::assertPushed(LightenDialuxPlan::class, 1);

    // Procesada con la versión 1: se regenera.
    $plan->forceFill(['light_layers' => array_merge($plan->light_layers, ['version' => 1])])->save();
    $this->actingAs($user)->getJson(route('dialux-v2.modules.plans.light-status', $parameters))
        ->assertJsonPath('status', 'pending');
    Queue::assertPushed(LightenDialuxPlan::class, 2);
});
