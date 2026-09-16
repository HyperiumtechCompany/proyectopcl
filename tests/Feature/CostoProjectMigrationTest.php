<?php

use App\Models\CostoProject;
use App\Models\User;
use App\Services\CostoDatabaseService;

it('actualiza la base del proyecto y confirma el resultado', function () {
    $user = User::factory()->create();
    $project = CostoProject::factory()->create(['user_id' => $user->id]);

    $service = Mockery::mock(CostoDatabaseService::class);
    $service->shouldReceive('runTenantMigrations')->once()->with($project->database_name);
    app()->instance(CostoDatabaseService::class, $service);

    $this->actingAs($user)
        ->from(route('costos.show', $project))
        ->post(route('costos.migrate', $project))
        ->assertRedirect(route('costos.show', $project))
        ->assertSessionHas('success', 'Base de datos del proyecto actualizada correctamente.');
});

it('muestra el error si falla la migracion del proyecto', function () {
    $user = User::factory()->create();
    $project = CostoProject::factory()->create(['user_id' => $user->id]);

    $service = Mockery::mock(CostoDatabaseService::class);
    $service->shouldReceive('runTenantMigrations')->once()->with($project->database_name)
        ->andThrow(new RuntimeException('No se pudieron aplicar las migraciones del proyecto.'));
    app()->instance(CostoDatabaseService::class, $service);

    $this->actingAs($user)
        ->from(route('costos.show', $project))
        ->post(route('costos.migrate', $project))
        ->assertRedirect(route('costos.show', $project))
        ->assertSessionHas('error', 'No se pudieron aplicar las migraciones del proyecto.');
});
