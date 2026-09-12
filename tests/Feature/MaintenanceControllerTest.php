<?php

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function createMaintenanceTenant(): array
{
    if (config('database.default') !== 'mysql') {
        test()->markTestSkipped('Requiere conexión MySQL.');
    }

    $dbName = 'costos_test_mant_'.str_replace('.', '_', uniqid('', true));
    $service = app(CostoDatabaseService::class);
    DB::connection('mysql')->statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $service->runTenantMigrations($dbName);

    $user = User::factory()->create();
    $project = CostoProject::factory()->create(['user_id' => $user->id, 'database_name' => $dbName]);
    CostoProjectModule::create(['costo_project_id' => $project->id, 'module_type' => 'mantenimiento', 'enabled' => true]);

    return [$user, $project, $dbName];
}

function dropMaintenanceTenant(string $dbName): void
{
    if (config('database.default') === 'mysql') {
        DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$dbName}`");
    }
}

it('opens a maintenance document after configuring the tenant connection', function () {
    [$user, $project, $dbName] = createMaintenanceTenant();

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $document = MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Plan']);

        $this->actingAs($user)
            ->get("/costos/{$project->id}/mantenimiento/{$document->public_id}")
            ->assertSuccessful()
            ->assertInertia(fn (Assert $page) => $page
                ->component('costos/mantenimiento/Editor')
                ->where('document.nombre', 'Plan')
                ->where('imported', false)
                ->where('mo', null)
            );
    } finally {
        dropMaintenanceTenant($dbName);
    }
});

it('deletes a maintenance document', function () {
    [$user, $project, $dbName] = createMaintenanceTenant();

    try {
        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        $document = MaintenanceDocument::create(['public_id' => (string) Str::ulid(), 'nombre' => 'Descartable']);

        $this->actingAs($user)
            ->withSession(['_token' => 'test-token'])
            ->delete("/costos/{$project->id}/mantenimiento/{$document->public_id}", ['_token' => 'test-token'])
            ->assertRedirect("/costos/{$project->id}/mantenimiento");

        app(CostoDatabaseService::class)->setTenantConnection($dbName);
        expect(MaintenanceDocument::query()->where('public_id', $document->public_id)->exists())->toBeFalse();
    } finally {
        dropMaintenanceTenant($dbName);
    }
});
