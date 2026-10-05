<?php

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\User;
use App\Models\ValorizacionV2\ValorizacionV2Documento;
use App\Services\CostoDatabaseService;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/** Crea la base del tenant con sus migraciones (requiere MySQL, como los tests de mantenimiento). */
function crearTenantValorizacionV2(): array
{
    if (config('database.default') !== 'mysql') {
        test()->markTestSkipped('Requiere conexión MySQL (base de datos del tenant).');
    }

    $dbName = 'costos_test_valv2_'.str_replace('.', '_', uniqid('', true));
    DB::connection('mysql')->statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    app(CostoDatabaseService::class)->runTenantMigrations($dbName);

    $user = User::factory()->create();
    $project = CostoProject::factory()->create(['user_id' => $user->id, 'database_name' => $dbName]);
    CostoProjectModule::create(['costo_project_id' => $project->id, 'module_type' => 'crono_valorizado', 'enabled' => true]);

    return [$user, $project, $dbName];
}

function borrarTenantValorizacionV2(string $dbName): void
{
    DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$dbName}`");
}

/** Peticiones con token CSRF válido (el middleware no se salta en tests). */
beforeEach(function () {
    $this->withSession(['_token' => 'test-token'])->withHeaders(['X-CSRF-TOKEN' => 'test-token']);
});

function datosValorizacionV2(int $numero = 2): array
{
    return [
        'periodo' => ['numero' => $numero, 'mes' => '2026-07-01'],
        'fichaTecnica' => ['datosGenerales' => ['obra' => 'Obra de prueba']],
        'parametros' => ['gastosGenerales' => '0.10', 'utilidad' => '0.07', 'igv' => '0.18'],
        'presupuesto' => ['fuente' => 'excel', 'partidas' => []],
    ];
}

/** Crea una valorización por HTTP y devuelve su public_id. */
function crearValorizacionV2($test, User $user, CostoProject $project, string $nombre = 'Valorización contrato principal'): string
{
    $test->actingAs($user)
        ->post("/costos/{$project->id}/valorizacion-v2", ['nombre' => $nombre, 'schema_version' => 1, 'datos' => datosValorizacionV2()])
        ->assertRedirect();

    return ValorizacionV2Documento::query()->where('nombre', $nombre)->value('public_id');
}

it('redirects guests to login', function () {
    $project = CostoProject::factory()->create();

    $this->get("/costos/{$project->id}/valorizacion-v2")->assertRedirect('/login');
});

it('forbids listing or creating valorizaciones on another user\'s project', function () {
    $project = CostoProject::factory()->create();
    $intruso = User::factory()->create();

    $this->actingAs($intruso)->get("/costos/{$project->id}/valorizacion-v2")->assertForbidden();
    $this->actingAs($intruso)->postJson("/costos/{$project->id}/valorizacion-v2", ['nombre' => 'X', 'schema_version' => 1, 'datos' => datosValorizacionV2()])->assertForbidden();
});

it('lists, creates several valorizaciones and opens each one in the editor', function () {
    [$user, $project, $dbName] = crearTenantValorizacionV2();

    try {
        $this->actingAs($user)->get("/costos/{$project->id}/valorizacion-v2")
            ->assertInertia(fn (Assert $page) => $page->component('costos/valorizacion-v2/Index')->where('documentos', [])->where('proyectos', [['id' => $project->id, 'nombre' => $project->nombre]]));

        $principal = crearValorizacionV2($this, $user, $project, 'Contrato principal');
        crearValorizacionV2($this, $user, $project, 'Adicional N°01');

        $this->actingAs($user)->get("/costos/{$project->id}/valorizacion-v2")
            ->assertInertia(fn (Assert $page) => $page->has('documentos', 2)->where('documentos.0.obra', 'Obra de prueba'));

        $this->actingAs($user)->get("/costos/{$project->id}/valorizacion-v2/{$principal}")
            ->assertInertia(fn (Assert $page) => $page
                ->component('costos/valorizacion-v2/Editor')
                ->where('documento.nombre', 'Contrato principal')
                ->where('documento.revision', 1)
                ->has('documentos', 2)
            );
    } finally {
        borrarTenantValorizacionV2($dbName);
    }
});

it('saves with optimistic revision, duplicates, renames and deletes', function () {
    [$user, $project, $dbName] = crearTenantValorizacionV2();

    try {
        $id = crearValorizacionV2($this, $user, $project);
        $url = "/costos/{$project->id}/valorizacion-v2/{$id}";

        $this->actingAs($user)->putJson($url, ['revision' => 1, 'schema_version' => 1, 'datos' => datosValorizacionV2(3)])->assertOk()->assertJson(['revision' => 2]);
        $this->actingAs($user)->putJson($url, ['revision' => 1, 'schema_version' => 1, 'datos' => datosValorizacionV2()])
            ->assertStatus(409)->assertJsonPath('revision', 2)->assertJsonPath('datos.periodo.numero', 3);

        $this->actingAs($user)->post("{$url}/duplicar")->assertRedirect();
        expect(ValorizacionV2Documento::query()->count())->toBe(2);

        $this->actingAs($user)->patch("{$url}/nombre", ['nombre' => 'Renombrada'])->assertRedirect();
        expect(ValorizacionV2Documento::query()->where('public_id', $id)->value('nombre'))->toBe('Renombrada');

        $this->actingAs($user)->delete($url)->assertRedirect("/costos/{$project->id}/valorizacion-v2");
        expect(ValorizacionV2Documento::query()->count())->toBe(1);
    } finally {
        borrarTenantValorizacionV2($dbName);
    }
});

it('approves a valorización once, freezing the saved data, and can reopen it', function () {
    [$user, $project, $dbName] = crearTenantValorizacionV2();

    try {
        $id = crearValorizacionV2($this, $user, $project);
        $url = "/costos/{$project->id}/valorizacion-v2/{$id}";
        $aprobacion = ['revision' => 1, 'numero' => 2, 'mes' => '2026-07-01', 'resumen' => ['valorizado' => '224198.55', 'liquido' => '215230.55', 'avanceAcumulado' => '0.9782']];

        $this->actingAs($user)->postJson("{$url}/cortes", [...$aprobacion, 'revision' => 9])->assertStatus(409);
        $this->actingAs($user)->postJson("{$url}/cortes", $aprobacion)->assertCreated()->assertJsonPath('corte.numero', 2);
        $this->actingAs($user)->postJson("{$url}/cortes", $aprobacion)->assertUnprocessable();

        $this->actingAs($user)->get($url)->assertInertia(fn (Assert $page) => $page->where('cortes.0.numero', 2)->where('cortes.0.resumen.liquido', '215230.55'));

        $this->actingAs($user)->deleteJson("{$url}/cortes/2")->assertOk();
        $this->actingAs($user)->get($url)->assertInertia(fn (Assert $page) => $page->where('cortes', []));
    } finally {
        borrarTenantValorizacionV2($dbName);
    }
});
