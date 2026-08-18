<?php

use App\Models\Dialux\DialuxPlan;
use App\Models\Dialux\DialuxPlanFile;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    Storage::set('local', Storage::build([
        'driver' => 'local',
        'root' => sys_get_temp_dir().'/dialux-plan-tests-'.Str::uuid(),
        'throw' => true,
    ]));
});

function dialuxProjectWithFloor(User $user, string $sceneId = 'floor-1'): DialuxProject
{
    return DialuxProject::create([
        'user_id' => $user->id,
        'name' => 'Proyecto con plano',
        'data' => [
            'id' => 'project-data',
            'name' => 'Proyecto con plano',
            'scenes' => [['id' => $sceneId, 'name' => 'Primer piso']],
        ],
    ]);
}

it('guarda y descarga el plano privado de un piso', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);
    $file = UploadedFile::fake()->createWithContent('arquitectura.dxf', "0\nSECTION\n0\nEOF");

    $this->actingAs($user)
        ->post(route('dialux.plans.store', [$project, 'floor-1']), ['plan' => $file], [
            'Accept' => 'application/json',
        ])
        ->assertSuccessful()
        ->assertJsonPath('file_name', 'arquitectura.dxf');

    $plan = DialuxPlanFile::query()->sole();
    Storage::disk('local')->assertExists($plan->path);

    $this->actingAs($user)
        ->get(route('dialux.plans.show', [$project, 'floor-1']))
        ->assertSuccessful()
        ->assertHeader('content-disposition');

    $this->actingAs($user)
        ->head(route('dialux.plans.show', [$project, 'floor-1']))
        ->assertSuccessful();
});

it('reemplaza el archivo del mismo piso y conserva archivos de otros pisos', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);

    $this->actingAs($user)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('anterior.dxf', 'old')],
    )->assertSuccessful();
    $oldPath = DialuxPlanFile::query()->sole()->plan->path;

    $this->actingAs($user)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('actualizado.dwg', 'new')],
    )->assertSuccessful();

    $plan = DialuxPlanFile::query()->sole()->plan;
    expect($plan->original_name)->toBe('actualizado.dwg');
    Storage::disk('local')->assertMissing($oldPath);
    Storage::disk('local')->assertExists($plan->path);
});

it('permite reutilizar el plano de otro piso sin duplicar el archivo', function () {
    $user = User::factory()->create();
    $project = DialuxProject::create([
        'user_id' => $user->id,
        'name' => 'Proyecto multipiso',
        'data' => [
            'id' => 'project-data',
            'name' => 'Proyecto multipiso',
            'scenes' => [
                ['id' => 'floor-1', 'name' => 'Primer piso'],
                ['id' => 'floor-2', 'name' => 'Segundo piso'],
            ],
        ],
    ]);

    $this->actingAs($user)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('planta-tipica.dxf', 'igual')],
    )->assertSuccessful();

    $this->actingAs($user)
        ->postJson(route('dialux.plans.link', [$project, 'floor-2']), ['source_scene_id' => 'floor-1'])
        ->assertSuccessful()
        ->assertJsonPath('file_name', 'planta-tipica.dxf');

    expect(DialuxPlanFile::query()->count())->toBe(2);
    expect(DialuxPlan::query()->count())->toBe(1);

    $binding1 = DialuxPlanFile::query()->where('scene_id', 'floor-1')->sole();
    $binding2 = DialuxPlanFile::query()->where('scene_id', 'floor-2')->sole();
    expect($binding1->dialux_plan_id)->toBe($binding2->dialux_plan_id);

    $this->actingAs($user)
        ->get(route('dialux.plans.show', [$project, 'floor-2']))
        ->assertSuccessful();
});

it('borra el archivo físico solo cuando ningún otro piso lo referencia', function () {
    $user = User::factory()->create();
    $project = DialuxProject::create([
        'user_id' => $user->id,
        'name' => 'Proyecto multipiso',
        'data' => [
            'id' => 'project-data',
            'name' => 'Proyecto multipiso',
            'scenes' => [
                ['id' => 'floor-1', 'name' => 'Primer piso'],
                ['id' => 'floor-2', 'name' => 'Segundo piso'],
            ],
        ],
    ]);

    $this->actingAs($user)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('compartido.dxf', 'igual')],
    )->assertSuccessful();
    $this->actingAs($user)
        ->postJson(route('dialux.plans.link', [$project, 'floor-2']), ['source_scene_id' => 'floor-1'])
        ->assertSuccessful();

    $planPath = DialuxPlan::query()->sole()->path;

    $this->actingAs($user)
        ->delete(route('dialux.plans.destroy', [$project, 'floor-1']))
        ->assertSuccessful();

    Storage::disk('local')->assertExists($planPath);
    expect(DialuxPlanFile::query()->where('scene_id', 'floor-1')->exists())->toBeFalse();

    $this->actingAs($user)
        ->delete(route('dialux.plans.destroy', [$project, 'floor-2']))
        ->assertSuccessful();

    Storage::disk('local')->assertMissing($planPath);
    expect(DialuxPlan::query()->count())->toBe(0);
});

it('impide que otro usuario suba o descargue el plano', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = dialuxProjectWithFloor($owner);

    $this->actingAs($owner)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('privado.dxf', 'secret')],
    )->assertSuccessful();

    $this->actingAs($intruder)
        ->get(route('dialux.plans.show', [$project, 'floor-1']))
        ->assertForbidden();
    $this->actingAs($intruder)
        ->post(
            route('dialux.plans.store', [$project, 'floor-1']),
            ['plan' => UploadedFile::fake()->createWithContent('intruso.dxf', 'x')],
        )
        ->assertForbidden();
});

it('advierte al subir un DWG R2010+ porque LibreDWG puede omitir geometría en silencio (Ronda 21g)', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);
    // "AC1032" = cabecera real de un DWG R2018 (AutoCAD 2018+) — confirmado
    // contra un archivo real que renderizaba incompleto (sin muros/hatch/texto)
    // en el visor. LibreDWG documenta que puede omitir objetos avanzados de
    // R2010+ sin lanzar error, por eso la detección es solo por versión, no
    // por resultado de parseo.
    $file = UploadedFile::fake()->createWithContent('r2018.dwg', 'AC1032'.str_repeat("\0", 40));

    $this->actingAs($user)
        ->post(route('dialux.plans.store', [$project, 'floor-1']), ['plan' => $file], ['Accept' => 'application/json'])
        ->assertSuccessful()
        ->assertJsonPath('warning', fn ($warning) => is_string($warning) && str_contains($warning, 'R2018'));
});

it('no advierte al subir un DWG anterior a R2010', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);
    // "AC1015" = R2000 — fuera del rango de riesgo documentado por LibreDWG.
    $file = UploadedFile::fake()->createWithContent('r2000.dwg', 'AC1015'.str_repeat("\0", 40));

    $this->actingAs($user)
        ->post(route('dialux.plans.store', [$project, 'floor-1']), ['plan' => $file], ['Accept' => 'application/json'])
        ->assertSuccessful()
        ->assertJsonPath('warning', null);
});

it('no advierte al subir un DXF aunque declare una versión reciente', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);
    // DXF nunca pasa por LibreDWG (usa el converter nativo de data-model) —
    // la advertencia debe ser exclusiva de la extensión .dwg.
    $file = UploadedFile::fake()->createWithContent('plano.dxf', "0\nSECTION\n0\nEOF");

    $this->actingAs($user)
        ->post(route('dialux.plans.store', [$project, 'floor-1']), ['plan' => $file], ['Accept' => 'application/json'])
        ->assertSuccessful()
        ->assertJsonPath('warning', null);
});

it('rechaza extensiones que no sean CAD', function () {
    $user = User::factory()->create();
    $project = dialuxProjectWithFloor($user);

    $this->actingAs($user)
        ->post(
            route('dialux.plans.store', [$project, 'floor-1']),
            ['plan' => UploadedFile::fake()->createWithContent('archivo.txt', 'text')],
            ['Accept' => 'application/json'],
        )
        ->assertUnprocessable()
        ->assertJsonValidationErrors('plan');
});
