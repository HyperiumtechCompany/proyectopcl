<?php

use App\Models\Dialux\DialuxProject;
use App\Models\User;
use App\Services\Dialux\V2\LegacyProjectMigrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function createLegacyDependencies(DialuxProject $project, string $documentId): void
{
    $now = now();
    $planId = DB::table('dialux_plans')->insertGetId([
        'dialux_project_id' => $project->id,
        'dialux_module_id' => null,
        'original_name' => 'plano.dxf',
        'mime_type' => 'application/dxf',
        'size_bytes' => 128,
        'disk' => 'local',
        'path' => 'dialux/planos/plano.dxf',
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    DB::table('dialux_plan_files')->insert([
        'dialux_project_id' => $project->id,
        'dialux_module_id' => null,
        'scene_id' => 'scene-1',
        'dialux_plan_id' => $planId,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    DB::table('dialux_project_normative_configs')->insert([
        'dialux_project_id' => $documentId,
        'dialux_module_id' => null,
        'user_id' => $project->user_id,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    DB::table('dialux_electrical_projects')->insert([
        'dialux_project_id' => (string) $project->id,
        'dialux_module_id' => null,
        'user_id' => $project->user_id,
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}

it('converts each legacy project into one module and relinks its dependencies', function () {
    $user = User::factory()->create();
    $documentId = 'legacy-document-uuid';
    $project = DialuxProject::factory()->for($user)->create([
        'status' => 'active',
        'data' => ['id' => $documentId, 'scenes' => [['id' => 'scene-1']]],
    ]);
    createLegacyDependencies($project, $documentId);

    $migrated = app(LegacyProjectMigrationService::class)->migrate();
    $module = $project->modules()->sole();

    expect($migrated)->toBe(1)
        ->and($module->name)->toBe('Módulo 1')
        ->and($module->status)->toBe('draft')
        ->and($module->data)->toBe($project->data);

    foreach (['dialux_plans', 'dialux_plan_files', 'dialux_project_normative_configs', 'dialux_electrical_projects'] as $table) {
        expect(DB::table($table)->where('dialux_module_id', $module->id)->count())->toBe(1);
    }
});

it('is idempotent and does not alter projects that already have modules', function () {
    $project = DialuxProject::factory()->create(['data' => ['scenes' => []]]);
    $existing = $project->modules()->create([
        'name' => 'Módulo existente',
        'sort_order' => 0,
        'status' => 'in_progress',
        'data' => ['scenes' => []],
    ]);

    $service = app(LegacyProjectMigrationService::class);

    expect($service->migrate())->toBe(0)
        ->and($service->migrate())->toBe(0)
        ->and($project->modules()->count())->toBe(1)
        ->and($project->modules()->sole()->is($existing))->toBeTrue();
});

it('verifies the post migration integrity and fails when a legacy project remains', function () {
    $project = DialuxProject::factory()->create();

    $this->artisan('dialux:v2:verify-migration')->assertFailed();

    app(LegacyProjectMigrationService::class)->migrate();

    $this->artisan('dialux:v2:verify-migration')
        ->expectsOutputToContain('La migración DIALux v2 es consistente.')
        ->assertSuccessful();

    expect($project->fresh()->modules)->toHaveCount(1);
});

it('keeps dependency ownership isolated between projects of the same user', function () {
    $user = User::factory()->create();
    $first = DialuxProject::factory()->for($user)->create(['data' => ['id' => 'doc-first']]);
    $second = DialuxProject::factory()->for($user)->create(['data' => ['id' => 'doc-second']]);
    createLegacyDependencies($first, 'doc-first');
    createLegacyDependencies($second, 'doc-second');

    app(LegacyProjectMigrationService::class)->migrate();

    expect(DB::table('dialux_project_normative_configs')
        ->where('dialux_project_id', 'doc-first')
        ->value('dialux_module_id'))->toBe($first->modules()->sole()->id)
        ->and(DB::table('dialux_project_normative_configs')
            ->where('dialux_project_id', 'doc-second')
            ->value('dialux_module_id'))->toBe($second->modules()->sole()->id);
});
