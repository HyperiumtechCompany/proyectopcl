<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithoutMiddleware;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MetradoSanitariasTest extends TestCase
{
    use RefreshDatabase;

    private CostoDatabaseService $dbService;
    private User $user;
    private CostoProject $project;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->withoutMiddleware([
            \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
        ]);

        $this->dbService = app(CostoDatabaseService::class);
        $this->user = User::factory()->create();
        
        // Create project in main DB
        $this->project = CostoProject::create([
            'user_id' => $this->user->id,
            'nombre' => 'Test Project Sanitarias',
            'database_name' => 'costos_test_sanitarias_' . time(),
        ]);

        // Enable module
        $this->project->modules()->create([
            'module_type' => 'metrado_sanitarias',
            'enabled' => true,
            'config' => ['cantidad_modulos' => 2],
        ]);

        // Create tenant DB and run migrations
        $this->dbService->createDatabase($this->project);
        
        // Ensure connection is set for the test session
        $this->dbService->setTenantConnection($this->project->database_name);
        
        // Initialize config
        DB::connection('costos_tenant')->table('metrado_sanitarias_config')->insert([
            'cantidad_modulos' => 2,
            'nombre_proyecto' => $this->project->nombre,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Ensure Auth::id() works in the controller
        $this->actingAs($this->user);
    }

    protected function tearDown(): void
    {
        if (isset($this->project)) {
            $this->dbService->dropDatabase($this->project);
        }
        parent::tearDown();
    }

    public function test_can_get_sanitarias_config(): void
    {
        $response = $this->actingAs($this->user)
            ->get("/costos/{$this->project->id}/metrado-sanitarias/config");

        $response->assertStatus(200)
            ->assertJsonPath('config.cantidad_modulos', 2);
    }

    public function test_can_update_sanitarias_config(): void
    {
        $response = $this->actingAs($this->user)
            ->patch("/costos/{$this->project->id}/metrado-sanitarias/config", [
                'cantidad_modulos' => 5,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('config.cantidad_modulos', 5);

        // Verify in tenant DB
        $this->dbService->setTenantConnection($this->project->database_name);
        $config = DB::connection('costos_tenant')->table('metrado_sanitarias_config')->first();
        $this->assertEquals(5, $config->cantidad_modulos);
    }

    public function test_can_save_and_retrieve_modulo_data(): void
    {
        $rows = [
            [
                'partida' => '01.01',
                'descripcion' => 'Punto de desague',
                'unidad' => 'und',
                'total' => 10.5,
                'nivel' => 1,
            ],
            [
                'partida' => '01.02',
                'descripcion' => 'Tuberia 2"',
                'unidad' => 'm',
                'total' => 45.0,
                'nivel' => 1,
            ]
        ];

        $response = $this->actingAs($this->user)
            ->patch("/costos/{$this->project->id}/metrado-sanitarias/modulo/1", [
                'rows' => $rows,
                'modulo_nombre' => 'Modulo de Prueba 1'
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('count', 2);

        // Retrieve data
        $getResponse = $this->actingAs($this->user)
            ->get("/costos/{$this->project->id}/metrado-sanitarias/modulo/1");

        $getResponse->assertStatus(200)
            ->assertJsonCount(2, 'rows')
            ->assertJsonPath('rows.0.partida', '01.01')
            ->assertJsonPath('rows.0.modulo_nombre', 'Modulo de Prueba 1');
    }

    public function test_can_save_red_exterior_data(): void
    {
        $rows = [
            [
                'partida' => 'EXT.01',
                'descripcion' => 'Red exterior agua',
                'total' => 100.0,
            ]
        ];

        $response = $this->actingAs($this->user)
            ->patch("/costos/{$this->project->id}/metrado-sanitarias/exterior", [
                'rows' => $rows
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('count', 1);

        $this->dbService->setTenantConnection($this->project->database_name);
        $this->assertEquals(1, DB::connection('costos_tenant')->table('metrado_sanitarias_exterior')->count());
    }

    public function test_can_save_resumen_data(): void
    {
        $rows = [
            [
                'partida' => 'RES.01',
                'descripcion' => 'Instalaciones Sanitarias',
                'total_modulos' => 500,
                'total_exterior' => 100,
                'total_cisterna' => 50,
                'total_general' => 650,
            ]
        ];

        $response = $this->actingAs($this->user)
            ->patch("/costos/{$this->project->id}/metrado-sanitarias/resumen", [
                'rows' => $rows
            ]);

        $response->assertStatus(200);

        $this->dbService->setTenantConnection($this->project->database_name);
        $resumen = DB::connection('costos_tenant')->table('metrado_sanitarias_resumen')->first();
        $this->assertEquals(650, (float)$resumen->total_general);
    }
}
