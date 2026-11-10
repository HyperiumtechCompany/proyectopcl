<?php

use App\Http\Middleware\SetCostosDatabase;
use App\Models\CostoProject;
use App\Models\CostoProjectCollaborator;
use App\Models\CuadernoVinculo;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpKernel\Exception\HttpException;

function paidUser(): User
{
    return User::factory()->create(['plan' => 'mensual']);
}

/** Corre SetCostosDatabase sobre una petición del usuario dado; devuelve el status final. */
function runCostosMiddleware(User $user, CostoProject $project, string $method): int
{
    $request = Request::create('/?project='.$project->id, $method, server: ['HTTP_ACCEPT' => 'application/json']);
    $request->setUserResolver(fn () => $user);
    test()->actingAs($user);

    try {
        return app(SetCostosDatabase::class)->handle($request, fn () => response('ok'))->getStatusCode();
    } catch (HttpException $e) {
        return $e->getStatusCode();
    }
}

test('owner generates a code per role and a user joins with the matching permission', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create();

    $codes = $this->actingAs($owner)
        ->postJson(route('costos.share.store', $project), ['role' => 'viewer'])
        ->assertSuccessful()
        ->json('codes');

    expect($codes['viewer'])->toHaveLength(8)->and($codes['editor'])->toBeNull();

    $guest = User::factory()->create();
    $this->actingAs($guest)
        ->post(route('costos.join'), ['code' => strtolower($codes['viewer'])])
        ->assertRedirect(route('costos.show', $project));

    expect($project->fresh()->accessRoleFor($guest))->toBe('viewer');
});

test('shared projects appear in the guest list with their permission and owner', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create();
    $guest = User::factory()->create();
    $project->collaborators()->attach($guest->id, ['role' => 'editor', 'joined_at' => now()]);
    CostoProject::factory()->create(); // ajeno, no debe aparecer

    $this->actingAs($guest)
        ->get(route('costos.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('costos/Index')
            ->has('projects', 1)
            ->where('projects.0.access', 'editor')
            ->where('projects.0.owner_name', $owner->name));
});

test('owner invites by email and only the owner can manage sharing', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create();
    $invitee = User::factory()->create();

    $this->actingAs($owner)
        ->postJson(route('costos.share.store', $project), ['role' => 'editor', 'email' => $invitee->email])
        ->assertSuccessful()
        ->assertJsonPath('collaborators.0.role', 'editor');

    $this->actingAs($invitee)
        ->postJson(route('costos.share.store', $project), ['role' => 'editor'])
        ->assertForbidden();

    $this->actingAs($owner)
        ->postJson(route('costos.share.store', $project), ['role' => 'viewer', 'email' => 'nadie@example.com'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

test('free plan owners cannot share', function () {
    $owner = User::factory()->create(['plan' => 'free']);
    $project = CostoProject::factory()->for($owner)->create();

    $this->actingAs($owner)
        ->postJson(route('costos.share.store', $project), ['role' => 'viewer'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('quota');
});

test('viewers cannot write, editors can, strangers cannot enter', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create(['database_name' => 'nonexistent_db_for_this_test']);
    $viewer = User::factory()->create();
    $editor = User::factory()->create();
    $project->collaborators()->attach([
        $viewer->id => ['role' => CostoProjectCollaborator::ROLE_VIEWER],
        $editor->id => ['role' => CostoProjectCollaborator::ROLE_EDITOR],
    ]);

    // 403 = bloqueado por acceso; 500 = pasó el acceso y falló después por la BD de prueba inexistente.
    expect(runCostosMiddleware($viewer, $project, 'POST'))->toBe(403)
        ->and(runCostosMiddleware($viewer, $project, 'GET'))->toBe(500)
        ->and(runCostosMiddleware($editor, $project, 'POST'))->toBe(500)
        ->and(runCostosMiddleware(User::factory()->create(), $project, 'GET'))->toBe(403);
});

test('collaborators cannot edit or delete the project itself', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create();
    $editor = User::factory()->create();
    $project->collaborators()->attach($editor->id, ['role' => 'editor']);

    $this->actingAs($editor)->delete(route('costos.destroy', $project))->assertForbidden();
    expect(CostoProject::find($project->id))->not->toBeNull();
});

test('gerencia transfers a project to the client account', function () {
    $gerencia = paidUser();
    $gerencia->assignRole(Role::firstOrCreate(['name' => 'gerencia', 'guard_name' => 'web']));
    $project = CostoProject::factory()->for($gerencia)->create();
    $project->shareCodeFor('editor');
    $tester = User::factory()->create();
    $project->collaborators()->attach($tester->id, ['role' => 'editor']);
    $vinculo = new CuadernoVinculo(['entidad' => 'X', 'obra' => 'Y']);
    $vinculo->forceFill(['costo_project_id' => $project->id, 'user_id' => $gerencia->id, 'session_key' => 'secreto'])->save();

    $client = paidUser();

    $this->actingAs($gerencia)
        ->post(route('costos.transfer', $project), ['email' => $client->email])
        ->assertRedirect(route('costos.index'));

    $project->refresh();
    expect($project->user_id)->toBe($client->id)
        ->and($project->share_code_editor)->toBeNull()
        ->and($project->collaborators()->count())->toBe(0)
        ->and($project->accessRoleFor($gerencia))->toBeNull()
        ->and($vinculo->fresh()->getAttributes()['session_key'])->toBeNull()
        ->and($vinculo->fresh()->user_id)->toBe($client->id);
});

test('only root or gerencia can transfer, and the client quota is respected', function () {
    $owner = paidUser();
    $project = CostoProject::factory()->for($owner)->create();
    $client = paidUser();

    $this->actingAs($owner)
        ->post(route('costos.transfer', $project), ['email' => $client->email])
        ->assertForbidden();

    $owner->assignRole(Role::firstOrCreate(['name' => 'gerencia', 'guard_name' => 'web']));
    CostoProject::factory()->count(10)->for($client)->create(); // mensual = 10 costos

    $this->actingAs($owner)
        ->post(route('costos.transfer', $project), ['email' => $client->email])
        ->assertSessionHasErrors('email');

    expect($project->fresh()->user_id)->toBe($owner->id);
});
