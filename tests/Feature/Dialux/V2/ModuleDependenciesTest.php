<?php

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use App\Services\ProjectQuotaService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    Storage::set('local', Storage::build([
        'driver' => 'local',
        'root' => sys_get_temp_dir().'/dialux-v2-plan-tests-'.Str::uuid(),
        'throw' => true,
    ]));
});

test('dependent dialux tables support isolated v2 module links', function () {
    foreach (['dialux_plans', 'dialux_plan_files', 'dialux_project_normative_configs', 'dialux_electrical_projects'] as $table) {
        expect(Schema::hasColumn($table, 'dialux_module_id'))->toBeTrue();
    }
});

test('a module stores links and downloads plans without using the v1 project key', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $parameters = [$project, $module, 'floor-1'];
    $this->actingAs($user)
        ->post(route('dialux-v2.modules.plans.store', $parameters), [
            'plan' => UploadedFile::fake()->create('planta.dxf', 12, 'application/dxf'),
        ])
        ->assertSuccessful()
        ->assertJsonPath('file_name', 'planta.dxf');

    $plan = $module->plans()->firstOrFail();
    expect($plan->dialux_project_id)->toBeNull()
        ->and($module->planFiles()->where('scene_id', 'floor-1')->exists())->toBeTrue();
    Storage::disk('local')->assertExists($plan->path);

    $this->actingAs($user)
        ->get(route('dialux-v2.modules.plans.show', $parameters))
        ->assertDownload('planta.dxf');

    $this->actingAs($user)
        ->deleteJson(route('dialux-v2.modules.plans.destroy', $parameters))
        ->assertSuccessful();
    Storage::disk('local')->assertMissing($plan->path);
});

test('a plan can be reused only between scenes of the same module', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)->post(route('dialux-v2.modules.plans.store', [$project, $module, 'floor-1']), [
        'plan' => UploadedFile::fake()->create('base.dwg', 12, 'application/octet-stream'),
    ])->assertSuccessful();

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.plans.link', [$project, $module, 'floor-2']), [
            'source_scene_id' => 'floor-1',
        ])
        ->assertSuccessful();

    expect($module->planFiles()->count())->toBe(2)
        ->and($module->planFiles()->pluck('dialux_plan_id')->unique()->count())->toBe(1);
});

test('normative configuration and compliance belong to one module', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $parameters = [$project, $module];

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.normative.store', $parameters), [
            'country_code' => 'PE',
            'region' => 'americas_peru',
            'primary_standard' => 'rne_peru',
        ])
        ->assertCreated()
        ->assertJsonPath('data.dialux_module_id', $module->id)
        ->assertJsonPath('data.dialux_project_id', null);

    $this->actingAs($user)
        ->patchJson(route('dialux-v2.modules.normative.compliance.update', $parameters), [
            'total_rooms' => 5,
            'compliant_rooms' => 3,
            'non_compliant_rooms' => 1,
            'warning_rooms' => 1,
            'needs_review_rooms' => 0,
        ])
        ->assertSuccessful();

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.normative.show', $parameters))
        ->assertSuccessful()
        ->assertJsonPath('data.total_rooms', 5);
});

test('electrical autosave is isolated by module', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $first = DialuxModule::factory()->for($project, 'project')->create();
    $second = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)
        ->postJson(route('dialux-v2.modules.electrical.store', [$project, $first]), [
            'voltage_v' => 220,
            'data' => ['panels' => [['id' => 'panel-a']]],
            'total_panels' => 1,
        ])
        ->assertCreated();

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.electrical.show', [$project, $first]))
        ->assertSuccessful()
        ->assertJsonPath('data.data.panels.0.id', 'panel-a');

    $this->actingAs($user)
        ->getJson(route('dialux-v2.modules.electrical.show', [$project, $second]))
        ->assertSuccessful()
        ->assertJsonPath('exists', false);
});

test('modules do not consume additional project quota', function () {
    $user = User::factory()->create(['plan' => 'mensual']);
    $project = DialuxProject::factory()->for($user)->create();
    DialuxModule::factory()->count(DialuxModule::MAX_PER_PROJECT)->for($project, 'project')->create();

    app(ProjectQuotaService::class)->assertCanCreate($user, 'dialux');

    expect(DialuxProject::where('user_id', $user->id)->count())->toBe(1);
});

test('module dependencies reject another project or owner', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = DialuxProject::factory()->for($owner)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();
    $otherProject = DialuxProject::factory()->for($owner)->create();

    $this->actingAs($intruder)
        ->getJson(route('dialux-v2.modules.electrical.show', [$project, $module]))
        ->assertForbidden();

    $this->actingAs($owner)
        ->getJson(route('dialux-v2.modules.normative.show', [$otherProject, $module]))
        ->assertNotFound();
});
