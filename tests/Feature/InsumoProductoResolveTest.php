<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InsumoProductoResolveTest extends TestCase
{
    use RefreshDatabase;

    protected CostoDatabaseService $dbService;

    protected User $user;

    protected CostoProject $project;

    protected string $testDbName;

    protected function setUp(): void
    {
        parent::setUp();

        if (config('database.default') !== 'mysql') {
            $this->markTestSkipped('This test requires MySQL database connection');
        }

        $this->withoutMiddleware(ValidateCsrfToken::class);

        $this->dbService = app(CostoDatabaseService::class);
        $this->user = User::factory()->create();
        $this->project = CostoProject::factory()->create([
            'user_id' => $this->user->id,
            'nombre' => 'Test Project',
        ]);
        $this->testDbName = $this->project->database_name;

        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $this->dbService->runTenantMigrations($this->testDbName);
        $this->dbService->setTenantConnection($this->testDbName);

        DB::connection('costos_tenant')->table('diccionario')->insert([
            ['codigo' => '47', 'descripcion' => 'Mano de obra', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::connection('costos_tenant')->table('unidad')->insert([
            'descripcion' => 'Hora hombre', 'descripcion_singular' => 'hora hombre',
            'orden' => '1', 'informacion_unidad' => '', 'abreviatura_unidad' => 'hh',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        if (config('database.default') === 'mysql') {
            try {
                if ($this->dbService->databaseExists($this->testDbName)) {
                    DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$this->testDbName}`");
                }
            } catch (\Exception $e) {
                // Ignore cleanup errors
            }
        }

        parent::tearDown();
    }

    public function test_resolve_matches_existing_insumo_by_normalized_descripcion(): void
    {
        DB::connection('costos_tenant')->table('insumo_productos')->insert([
            'codigo_producto' => '471060001',
            'descripcion' => 'Operario',
            'diccionario_id' => 1,
            'tipo_proveedor' => '106',
            'costo_unitario' => 25.5,
            'tipo' => 'mano_de_obra',
            'estado' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->postJson(
            "/costos/proyectos/{$this->project->id}/presupuesto/insumos/resolve",
            [
                'items' => [
                    ['key' => 'k1', 'tipo' => 'mano_de_obra', 'descripcion' => '  OPERARIO  ', 'unidad' => 'hh', 'cod_insumo' => '47'],
                    ['key' => 'k2', 'tipo' => 'mano_de_obra', 'descripcion' => 'Peón', 'unidad' => 'hh', 'cod_insumo' => '47'],
                ],
            ],
        );

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);

        $items = collect($response->json('items'))->keyBy('key');

        $this->assertTrue($items['k1']['matched']);
        $this->assertEquals(25.5, $items['k1']['costo_unitario']);

        $this->assertFalse($items['k2']['matched']);
        $this->assertEquals('47', $items['k2']['diccionario_sugerido']['codigo']);
    }

    public function test_create_batch_inserts_new_insumo_with_generated_codigo_and_resolved_unidad(): void
    {
        $response = $this->actingAs($this->user)->postJson(
            "/costos/proyectos/{$this->project->id}/presupuesto/insumos/create-batch",
            [
                'items' => [
                    ['key' => 'k1', 'tipo' => 'mano_de_obra', 'descripcion' => 'Peón', 'unidad' => 'HH', 'precio' => 20, 'diccionario_id' => 1],
                ],
            ],
        );

        $response->assertStatus(200);
        $response->assertJson(['success' => true]);

        $item = $response->json('items')[0];
        $this->assertTrue($item['created']);

        $producto = DB::connection('costos_tenant')->table('insumo_productos')->where('id', $item['insumo_id'])->first();
        $this->assertNotNull($producto);
        $this->assertEquals('47106'.'0001', $producto->codigo_producto);
        $this->assertEquals(20, $producto->costo_unitario);

        $unidad = DB::connection('costos_tenant')->table('unidad')->where('id', $producto->unidad_id)->first();
        $this->assertEquals('hh', $unidad->abreviatura_unidad);
    }

    public function test_create_batch_does_not_duplicate_when_insumo_already_exists(): void
    {
        DB::connection('costos_tenant')->table('insumo_productos')->insert([
            'codigo_producto' => '471060001',
            'descripcion' => 'Capataz',
            'diccionario_id' => 1,
            'tipo_proveedor' => '106',
            'costo_unitario' => 30,
            'tipo' => 'mano_de_obra',
            'estado' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->user)->postJson(
            "/costos/proyectos/{$this->project->id}/presupuesto/insumos/create-batch",
            [
                'items' => [
                    ['key' => 'k1', 'tipo' => 'mano_de_obra', 'descripcion' => 'capataz', 'unidad' => 'hh', 'precio' => 99, 'diccionario_id' => 1],
                ],
            ],
        );

        $response->assertStatus(200);
        $item = $response->json('items')[0];
        $this->assertFalse($item['created']);

        $count = DB::connection('costos_tenant')->table('insumo_productos')->where('descripcion', 'Capataz')->count();
        $this->assertEquals(1, $count);
    }
}
