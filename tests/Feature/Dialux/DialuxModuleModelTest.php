<?php

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Support\Facades\Schema;

test('dialux v2 tables expose the project and module columns', function () {
    expect(Schema::hasColumns('dialux_projects', [
        'description',
        'client_name',
        'location',
        'project_code',
        'status',
        'consolidated_summary',
    ]))->toBeTrue()
        ->and(Schema::hasColumns('dialux_modules', [
            'dialux_project_id',
            'name',
            'description',
            'sort_order',
            'status',
            'data',
        ]))->toBeTrue();
});

test('a dialux module belongs to its project and casts snapshot data', function () {
    $project = DialuxProject::factory()->create();
    $snapshot = ['scenes' => [['id' => 'scene-1']]];

    $module = DialuxModule::factory()->for($project, 'project')->create([
        'sort_order' => 2,
        'data' => $snapshot,
    ]);

    expect($module->project->is($project))->toBeTrue()
        ->and($module->sort_order)->toBe(2)
        ->and($module->data)->toBe($snapshot);
});

test('a dialux project returns modules by sort order', function () {
    $project = DialuxProject::factory()->create();

    DialuxModule::factory()->for($project, 'project')->create(['name' => 'Segundo', 'sort_order' => 20]);
    DialuxModule::factory()->for($project, 'project')->create(['name' => 'Primero', 'sort_order' => 10]);

    expect($project->modules->pluck('name')->all())->toBe(['Primero', 'Segundo']);
});

test('deleting a dialux project cascades to its modules', function () {
    $project = DialuxProject::factory()->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $project->delete();

    $this->assertDatabaseMissing('dialux_modules', ['id' => $module->id]);
});
