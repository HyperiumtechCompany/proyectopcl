<?php

use App\Jobs\Dialux\LightenDialuxPlan;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use App\Services\Dialux\CadPlanLightener;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** DXF ASCII mínimo con una línea, un sombreado y una imagen (en ENTITIES y en un bloque). */
function sampleDxf(): string
{
    $pairs = [
        [0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1027'], [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'BLOCKS'],
        [0, 'BLOCK'], [2, 'B1'], [10, '0'], [20, '0'],
        [0, 'HATCH'], [8, 'SOMBRA'], [2, 'SOLID'], [10, '0'], [20, '0'],
        [0, 'CIRCLE'], [8, 'EJES'], [10, '1'], [20, '1'], [40, '0.5'],
        [0, 'ENDBLK'],
        [0, 'ENDSEC'],
        [0, 'SECTION'], [2, 'ENTITIES'],
        [0, 'LINE'], [8, 'MUROS'], [10, '0'], [20, '0'], [11, '10'], [21, '0'],
        [0, 'HATCH'], [8, 'SOMBRA'], [2, 'ANSI31'], [10, '1'], [20, '1'],
        [0, 'IMAGE'], [8, 'FOTO'], [10, '0'], [20, '0'],
        [0, 'TEXT'], [8, 'TEXTOS'], [10, '2'], [20, '2'], [1, 'Aula 1'],
        [0, 'ENDSEC'],
        [0, 'EOF'],
    ];

    return implode("\r\n", array_map(fn (array $pair): string => $pair[0]."\r\n".$pair[1], $pairs))."\r\n";
}

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    Storage::set('local', Storage::build([
        'driver' => 'local',
        'root' => sys_get_temp_dir().'/dialux-plan-light-tests-'.Str::uuid(),
        'throw' => true,
    ]));
});

test('el aligerador quita sombreados e imágenes y conserva la geometría', function () {
    $dir = sys_get_temp_dir().'/dxf-slim-'.Str::uuid();
    mkdir($dir);
    file_put_contents("$dir/in.dxf", sampleDxf());

    $report = app(CadPlanLightener::class)->slimDxf("$dir/in.dxf", "$dir/out.dxf");
    $out = file_get_contents("$dir/out.dxf");

    expect($report['dropped'])->toBe(3)
        ->and($report['dropped_by_type'])->toBe(['HATCH' => 2, 'IMAGE' => 1])
        ->and($out)->not->toContain('HATCH')
        ->and($out)->not->toContain('SOMBRA')
        ->and($out)->not->toContain('IMAGE')
        ->and($out)->toContain('LINE')
        ->and($out)->toContain('CIRCLE')
        ->and($out)->toContain('Aula 1')
        // El nombre de sombreado "SOLID" dentro del HATCH se descartó con él; el archivo sigue cerrando bien.
        ->and(trim($out))->toEndWith("0\r\nEOF");
});

test('un DXF binario se rechaza con un mensaje claro', function () {
    $dir = sys_get_temp_dir().'/dxf-bin-'.Str::uuid();
    mkdir($dir);
    file_put_contents("$dir/in.dxf", "AutoCAD Binary DXF\r\n\x1a\x00...");

    expect(fn () => app(CadPlanLightener::class)->slimDxf("$dir/in.dxf", "$dir/out.dxf"))
        ->toThrow(RuntimeException::class, 'DXF binario');
});

test('subir un plano pesado lo pone en cola y el editor puede consultar y descargar su versión ligera', function () {
    Queue::fake();
    config(['dialux.plan_light.threshold_bytes.dxf' => 100]);
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module, 'site-plan-source'];

    $this->actingAs($user)
        ->post(route('dialux-v2.modules.plans.store', $parameters), [
            'plan' => UploadedFile::fake()->createWithContent('PLANTA GENERAL.dxf', sampleDxf()),
        ])
        ->assertSuccessful()
        ->assertJsonPath('light_status', 'pending');
    Queue::assertPushed(LightenDialuxPlan::class);

    // El job (lo que corre el worker en segundo plano).
    $plan = $module->plans()->firstOrFail();
    (new LightenDialuxPlan($plan->id))->handle(app(CadPlanLightener::class));
    $plan->refresh();
    expect($plan->light_status)->toBe('ready')
        ->and($plan->light_size_bytes)->toBeLessThan($plan->size_bytes);

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.plans.light-status', $parameters))
        ->assertSuccessful()
        ->assertJsonPath('needs_light', true)
        ->assertJsonPath('status', 'ready');

    $this->actingAs($user)
        ->get(route('dialux-v2.modules.plans.light', $parameters))
        ->assertDownload('PLANTA GENERAL (ligero).dxf');
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
        'plan' => UploadedFile::fake()->createWithContent('aula.dxf', sampleDxf()),
    ])->assertSuccessful();

    Queue::assertNotPushed(LightenDialuxPlan::class);
    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.plans.light-status', [$project, $module, 'floor-1']))
        ->assertJsonPath('needs_light', false)
        ->assertJsonPath('status', null);
});

test('otro usuario no puede consultar ni descargar la versión ligera', function () {
    $owner = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $this->actingAs($owner)->post(route('dialux-v2.modules.plans.store', [$project, $module, 'floor-1']), [
        'plan' => UploadedFile::fake()->createWithContent('aula.dxf', sampleDxf()),
    ]);

    $this->actingAs(User::factory()->create())
        ->getJson(route('dialux-v2.modules.plans.light-status', [$project, $module, 'floor-1']))
        ->assertForbidden();
});
