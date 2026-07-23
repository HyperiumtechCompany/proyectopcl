<?php

use App\Models\Dialux\DialuxPlanFile;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
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
    $oldPath = DialuxPlanFile::query()->sole()->path;

    $this->actingAs($user)->post(
        route('dialux.plans.store', [$project, 'floor-1']),
        ['plan' => UploadedFile::fake()->createWithContent('actualizado.dwg', 'new')],
    )->assertSuccessful();

    $plan = DialuxPlanFile::query()->sole();
    expect($plan->original_name)->toBe('actualizado.dwg');
    Storage::disk('local')->assertMissing($oldPath);
    Storage::disk('local')->assertExists($plan->path);
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
