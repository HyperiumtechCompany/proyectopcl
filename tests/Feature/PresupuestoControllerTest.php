<?php

namespace Tests\Feature;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\User;
use App\Services\CostoDatabaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PresupuestoControllerTest extends TestCase
{
    use RefreshDatabase;

    protected CostoDatabaseService $dbService;
    protected User $user;
    protected CostoProject $project;
    protected string $testDbName;

    protected function setUp(): void
    {
        parent::setUp();

        // Skip tests if not using MySQL
        if (config('database.default') !== 'mysql') {
            $this->markTestSkipped('This test requires MySQL database connection');
        }

        $this->dbService = app(CostoDatabaseService::class);

        // Create test user
        $this->user = User::factory()->create();

        // Create test project
        $this->project = CostoProject::factory()->create([
            'user_id' => $this->user->id,
            'nombre' => 'Test Project',
        ]);

        $this->testDbName = $this->project->database_name;

        // Create tenant database
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        // Create presupuesto tables
        $this->dbService->createPresupuestoTables($this->testDbName);

        // Enable presupuesto module
        CostoProjectModule::create([
            'costo_project_id' => $this->project->id,
            'module_type' => 'presupuesto',
        ]);

        // Set tenant connection
        $this->dbService->setTenantConnection($this->testDbName);
    }

    protected function tearDown(): void
    {
        // Clean up test database
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

    public function test_update_validates_general_subsection_data(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/general", [
                'rows' => [
                    [
                        'partida' => '01.01.01',
                        'descripcion' => 'Test partida',
                        'unidad' => 'm2',
                        'metrado' => 100.50,
                        'precio_unitario' => 25.75,
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'count' => 1,
        ]);

        // Verify data was saved
        $this->dbService->setTenantConnection($this->testDbName);
        $row = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->first();

        $this->assertNotNull($row);
        $this->assertEquals('01.01.01', $row->partida);
        $this->assertEquals('Test partida', $row->descripcion);
    }

    public function test_update_rejects_invalid_general_data(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/general", [
                'rows' => [
                    [
                        // Missing required 'partida' field
                        'descripcion' => 'Test partida',
                        'unidad' => 'm2',
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
        $response->assertJsonStructure([
            'errors',
        ]);
    }

    public function test_update_validates_acus_subsection_data(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/acus", [
                'rows' => [
                    [
                        'partida' => '01.01.01',
                        'descripcion' => 'Test ACU',
                        'unidad' => 'm2',
                        'rendimiento' => 8.5,
                        'mano_de_obra' => [
                            [
                                'descripcion' => 'Operario',
                                'unidad' => 'hh',
                                'cantidad' => 1.0,
                                'precio_unitario' => 25.50,
                                'parcial' => 25.50,
                            ],
                        ],
                        'materiales' => [],
                        'equipos' => [],
                        'costo_mano_obra' => 25.50,
                        'costo_materiales' => 0,
                        'costo_equipos' => 0,
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'count' => 1,
        ]);

        // Verify data was saved
        $this->dbService->setTenantConnection($this->testDbName);
        $row = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->first();

        $this->assertNotNull($row);
        $this->assertEquals('01.01.01', $row->partida);
        $this->assertEquals(8.5, (float) $row->rendimiento);
    }

    public function test_update_rejects_invalid_acus_rendimiento(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/acus", [
                'rows' => [
                    [
                        'partida' => '01.01.01',
                        'descripcion' => 'Test ACU',
                        'unidad' => 'm2',
                        'rendimiento' => 0, // Invalid: must be > 0
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
    }

    public function test_update_validates_insumos_tipo_field(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos", [
                'rows' => [
                    [
                        'codigo' => 'MAT-001',
                        'descripcion' => 'Cemento',
                        'unidad' => 'bol',
                        'precio_unitario' => 22.00,
                        'tipo' => 'material',
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'count' => 1,
        ]);
    }

    public function test_update_rejects_invalid_insumos_tipo(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/insumos", [
                'rows' => [
                    [
                        'codigo' => 'MAT-001',
                        'descripcion' => 'Cemento',
                        'unidad' => 'bol',
                        'precio_unitario' => 22.00,
                        'tipo' => 'invalid_type', // Invalid
                    ],
                ],
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
    }

    public function test_update_returns_updated_data(): void
    {
        $response = $this->actingAs($this->user)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/general", [
                'rows' => [
                    [
                        'partida' => '01.01.01',
                        'descripcion' => 'Test partida',
                        'unidad' => 'm2',
                        'metrado' => 100.50,
                        'precio_unitario' => 25.75,
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'count',
            'rows' => [
                '*' => [
                    'id',
                    'partida',
                    'descripcion',
                    'unidad',
                    'metrado',
                    'precio_unitario',
                    'parcial', // Calculated column
                    'item_order',
                ],
            ],
        ]);

        // Verify calculated column
        $rows = $response->json('rows');
        $this->assertCount(1, $rows);
        $expectedParcial = 100.50 * 25.75;
        $this->assertEquals($expectedParcial, (float) $rows[0]['parcial']);
    }

    public function test_update_requires_authentication(): void
    {
        $response = $this->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/general", [
            'rows' => [],
        ]);

        $response->assertStatus(401);
    }

    public function test_update_requires_project_ownership(): void
    {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->patchJson("/costos/proyectos/{$this->project->id}/presupuesto/general", [
                'rows' => [],
            ]);

        $response->assertStatus(403);
    }

    public function test_import_from_metrado_creates_new_partidas(): void
    {
        // Enable metrado_arquitectura module
        CostoProjectModule::create([
            'costo_project_id' => $this->project->id,
            'module_type' => 'metrado_arquitectura',
        ]);

        // Create metrado_arquitectura table
        $this->dbService->setTenantConnection($this->testDbName);
        DB::connection('costos_tenant')->statement("
            CREATE TABLE IF NOT EXISTS metrado_arquitectura (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                item_order INT DEFAULT 0,
                partida VARCHAR(50) NULL,
                descripcion TEXT NULL,
                unidad VARCHAR(20) NULL,
                total DECIMAL(14, 4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");

        // Insert test metrado data
        DB::connection('costos_tenant')->table('metrado_arquitectura')->insert([
            [
                'partida' => '01.01.01',
                'descripcion' => 'Excavación masiva',
                'unidad' => 'm3',
                'total' => 150.50,
                'item_order' => 1,
            ],
            [
                'partida' => '01.01.02',
                'descripcion' => 'Relleno compactado',
                'unidad' => 'm3',
                'total' => 75.25,
                'item_order' => 2,
            ],
        ]);

        // Import from metrado
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'metrado_arquitectura',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'message' => 'Importación completada exitosamente',
            'summary' => [
                'created' => 2,
                'updated' => 0,
                'total' => 2,
            ],
        ]);

        // Verify partidas were created in presupuesto_general
        $partidas = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->orderBy('partida')
            ->get();

        $this->assertCount(2, $partidas);
        $this->assertEquals('01.01.01', $partidas[0]->partida);
        $this->assertEquals('Excavación masiva', $partidas[0]->descripcion);
        $this->assertEquals('m3', $partidas[0]->unidad);
        $this->assertEquals(150.50, (float) $partidas[0]->metrado);
        $this->assertEquals('metrado_arquitectura', $partidas[0]->metrado_source);
        $this->assertEquals(0, (float) $partidas[0]->precio_unitario);
    }

    public function test_import_from_metrado_updates_existing_partidas(): void
    {
        // Enable metrado_estructura module
        CostoProjectModule::create([
            'costo_project_id' => $this->project->id,
            'module_type' => 'metrado_estructura',
        ]);

        // Create metrado_estructura table
        $this->dbService->setTenantConnection($this->testDbName);
        DB::connection('costos_tenant')->statement("
            CREATE TABLE IF NOT EXISTS metrado_estructura (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                item_order INT DEFAULT 0,
                partida VARCHAR(50) NULL,
                descripcion TEXT NULL,
                unidad VARCHAR(20) NULL,
                total DECIMAL(14, 4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");

        // Insert existing partida in presupuesto_general with price
        DB::connection('costos_tenant')->table('presupuesto_general')->insert([
            'partida' => '02.01.01',
            'descripcion' => 'Concreto f\'c=210 kg/cm2',
            'unidad' => 'm3',
            'metrado' => 50.00,
            'precio_unitario' => 350.00,
            'metrado_source' => null,
            'item_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Insert metrado data with updated quantity
        DB::connection('costos_tenant')->table('metrado_estructura')->insert([
            'partida' => '02.01.01',
            'descripcion' => 'Concreto f\'c=210 kg/cm2',
            'unidad' => 'm3',
            'total' => 75.50,
            'item_order' => 1,
        ]);

        // Import from metrado
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'metrado_estructura',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'summary' => [
                'created' => 0,
                'updated' => 1,
                'total' => 1,
            ],
        ]);

        // Verify partida was updated (metrado changed, price preserved)
        $partida = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('partida', '02.01.01')
            ->first();

        $this->assertNotNull($partida);
        $this->assertEquals(75.50, (float) $partida->metrado); // Updated
        $this->assertEquals(350.00, (float) $partida->precio_unitario); // Preserved
        $this->assertEquals('metrado_estructura', $partida->metrado_source);
    }

    public function test_import_from_metrado_validates_module_enabled(): void
    {
        // Don't enable metrado_sanitarias module

        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'metrado_sanitarias',
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'message' => 'El módulo metrado_sanitarias no está habilitado en este proyecto.',
        ]);
    }

    public function test_import_from_metrado_validates_metrado_type(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'invalid_type',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['metrado_type']);
    }

    public function test_import_from_metrado_requires_metrado_type(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                // Missing metrado_type
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['metrado_type']);
    }

    public function test_import_from_metrado_skips_empty_partidas(): void
    {
        // Enable metrado_electricas module
        CostoProjectModule::create([
            'costo_project_id' => $this->project->id,
            'module_type' => 'metrado_electricas',
        ]);

        // Create metrado_electricas table
        $this->dbService->setTenantConnection($this->testDbName);
        DB::connection('costos_tenant')->statement("
            CREATE TABLE IF NOT EXISTS metrado_electricas (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                item_order INT DEFAULT 0,
                partida VARCHAR(50) NULL,
                descripcion TEXT NULL,
                unidad VARCHAR(20) NULL,
                total DECIMAL(14, 4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");

        // Insert metrado data with some empty partidas
        DB::connection('costos_tenant')->table('metrado_electricas')->insert([
            [
                'partida' => '03.01.01',
                'descripcion' => 'Salida de luz',
                'unidad' => 'pto',
                'total' => 25.00,
                'item_order' => 1,
            ],
            [
                'partida' => null, // Empty partida - should be skipped
                'descripcion' => 'Header row',
                'unidad' => '',
                'total' => 0,
                'item_order' => 2,
            ],
            [
                'partida' => '', // Empty partida - should be skipped
                'descripcion' => 'Another header',
                'unidad' => '',
                'total' => 0,
                'item_order' => 3,
            ],
        ]);

        // Import from metrado
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'metrado_electricas',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'summary' => [
                'created' => 1, // Only one valid partida
                'updated' => 0,
                'total' => 1,
            ],
        ]);

        // Verify only valid partida was imported
        $partidas = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->get();

        $this->assertCount(1, $partidas);
        $this->assertEquals('03.01.01', $partidas[0]->partida);
    }

    public function test_import_from_metrado_requires_authentication(): void
    {
        $response = $this->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
            'metrado_type' => 'metrado_arquitectura',
        ]);

        $response->assertStatus(401);
    }

    public function test_import_from_metrado_requires_project_ownership(): void
    {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/import-metrado", [
                'metrado_type' => 'metrado_arquitectura',
            ]);

        $response->assertStatus(403);
    }

    public function test_calculate_acu_creates_new_acu_with_all_components(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.01.01',
                'descripcion' => 'Concreto f\'c=210 kg/cm2',
                'unidad' => 'm3',
                'rendimiento' => 8.0,
                'mano_de_obra' => [
                    [
                        'descripcion' => 'Operario',
                        'unidad' => 'hh',
                        'cantidad' => 1.0,
                        'precio_unitario' => 25.50,
                    ],
                    [
                        'descripcion' => 'Oficial',
                        'unidad' => 'hh',
                        'cantidad' => 0.5,
                        'precio_unitario' => 20.00,
                    ],
                ],
                'materiales' => [
                    [
                        'descripcion' => 'Cemento Portland Tipo I',
                        'unidad' => 'bol',
                        'cantidad' => 8.5,
                        'precio_unitario' => 22.00,
                        'factor_desperdicio' => 1.05,
                    ],
                ],
                'equipos' => [
                    [
                        'descripcion' => 'Mezcladora de concreto',
                        'unidad' => 'hm',
                        'cantidad' => 1.0,
                        'precio_hora' => 15.00,
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'message' => 'ACU calculado exitosamente',
        ]);

        $acu = $response->json('acu');

        // Verify basic fields
        $this->assertEquals('01.01.01', $acu['partida']);
        $this->assertEquals('Concreto f\'c=210 kg/cm2', $acu['descripcion']);
        $this->assertEquals('m3', $acu['unidad']);
        $this->assertEquals(8.0, (float) $acu['rendimiento']);

        // Verify mano de obra calculation: (cantidad * precio_unitario) / rendimiento
        // Operario: (1.0 * 25.50) / 8.0 = 3.1875 -> 3.19
        // Oficial: (0.5 * 20.00) / 8.0 = 1.25
        // Total: 3.19 + 1.25 = 4.44
        $this->assertEquals(4.44, (float) $acu['costo_mano_obra']);
        $this->assertCount(2, $acu['mano_de_obra']);
        $this->assertEquals(3.19, (float) $acu['mano_de_obra'][0]['parcial']);
        $this->assertEquals(1.25, (float) $acu['mano_de_obra'][1]['parcial']);

        // Verify materiales calculation: cantidad * precio_unitario * factor_desperdicio
        // Cemento: 8.5 * 22.00 * 1.05 = 196.35
        $this->assertEquals(196.35, (float) $acu['costo_materiales']);
        $this->assertCount(1, $acu['materiales']);
        $this->assertEquals(196.35, (float) $acu['materiales'][0]['parcial']);

        // Verify equipos calculation: (cantidad * precio_hora) / rendimiento
        // Mezcladora: (1.0 * 15.00) / 8.0 = 1.875 -> 1.88
        $this->assertEquals(1.88, (float) $acu['costo_equipos']);
        $this->assertCount(1, $acu['equipos']);
        $this->assertEquals(1.88, (float) $acu['equipos'][0]['parcial']);

        // Verify total: 4.44 + 196.35 + 1.88 = 202.67
        $this->assertEquals(202.67, (float) $acu['costo_unitario_total']);

        // Verify data was saved in database
        $this->dbService->setTenantConnection($this->testDbName);
        $savedAcu = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('partida', '01.01.01')
            ->first();

        $this->assertNotNull($savedAcu);
        $this->assertEquals(4.44, (float) $savedAcu->costo_mano_obra);
        $this->assertEquals(196.35, (float) $savedAcu->costo_materiales);
        $this->assertEquals(1.88, (float) $savedAcu->costo_equipos);
        $this->assertEquals(202.67, (float) $savedAcu->costo_unitario_total);
    }

    public function test_calculate_acu_updates_existing_acu(): void
    {
        // Insert existing ACU
        $this->dbService->setTenantConnection($this->testDbName);
        $acuId = DB::connection('costos_tenant')->table('presupuesto_acus')->insertGetId([
            'partida' => '01.02.01',
            'descripcion' => 'Excavación manual',
            'unidad' => 'm3',
            'rendimiento' => 4.0,
            'mano_de_obra' => json_encode([]),
            'costo_mano_obra' => 0,
            'materiales' => json_encode([]),
            'costo_materiales' => 0,
            'equipos' => json_encode([]),
            'costo_equipos' => 0,
            'item_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Update ACU with new calculations
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'id' => $acuId,
                'partida' => '01.02.01',
                'descripcion' => 'Excavación manual',
                'unidad' => 'm3',
                'rendimiento' => 4.0,
                'mano_de_obra' => [
                    [
                        'descripcion' => 'Peón',
                        'unidad' => 'hh',
                        'cantidad' => 1.0,
                        'precio_unitario' => 18.00,
                    ],
                ],
                'materiales' => [],
                'equipos' => [],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        $acu = $response->json('acu');

        // Verify calculation: (1.0 * 18.00) / 4.0 = 4.50
        $this->assertEquals(4.50, (float) $acu['costo_mano_obra']);
        $this->assertEquals(0, (float) $acu['costo_materiales']);
        $this->assertEquals(0, (float) $acu['costo_equipos']);
        $this->assertEquals(4.50, (float) $acu['costo_unitario_total']);

        // Verify only one ACU exists (update, not insert)
        $count = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->count();
        $this->assertEquals(1, $count);
    }

    public function test_calculate_acu_handles_empty_components(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.03.01',
                'descripcion' => 'Test ACU sin componentes',
                'unidad' => 'm2',
                'rendimiento' => 1.0,
                'mano_de_obra' => [],
                'materiales' => [],
                'equipos' => [],
            ]);

        $response->assertStatus(200);

        $acu = $response->json('acu');

        $this->assertEquals(0, (float) $acu['costo_mano_obra']);
        $this->assertEquals(0, (float) $acu['costo_materiales']);
        $this->assertEquals(0, (float) $acu['costo_equipos']);
        $this->assertEquals(0, (float) $acu['costo_unitario_total']);
    }

    public function test_calculate_acu_applies_default_factor_desperdicio(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.04.01',
                'descripcion' => 'Test material sin factor desperdicio',
                'unidad' => 'm2',
                'rendimiento' => 1.0,
                'mano_de_obra' => [],
                'materiales' => [
                    [
                        'descripcion' => 'Arena gruesa',
                        'unidad' => 'm3',
                        'cantidad' => 0.5,
                        'precio_unitario' => 50.00,
                        // No factor_desperdicio specified, should default to 1.0
                    ],
                ],
                'equipos' => [],
            ]);

        $response->assertStatus(200);

        $acu = $response->json('acu');

        // Calculation: 0.5 * 50.00 * 1.0 = 25.00
        $this->assertEquals(25.00, (float) $acu['costo_materiales']);
        $this->assertEquals(25.00, (float) $acu['materiales'][0]['parcial']);
    }

    public function test_calculate_acu_validates_required_fields(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                // Missing required fields
                'rendimiento' => 1.0,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['partida', 'descripcion', 'unidad']);
    }

    public function test_calculate_acu_validates_rendimiento_positive(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.05.01',
                'descripcion' => 'Test',
                'unidad' => 'm2',
                'rendimiento' => 0, // Invalid: must be > 0
                'mano_de_obra' => [],
                'materiales' => [],
                'equipos' => [],
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['rendimiento']);
    }

    public function test_calculate_acu_validates_component_fields(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.06.01',
                'descripcion' => 'Test',
                'unidad' => 'm2',
                'rendimiento' => 1.0,
                'mano_de_obra' => [
                    [
                        // Missing required fields
                        'descripcion' => 'Operario',
                    ],
                ],
                'materiales' => [],
                'equipos' => [],
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors([
            'mano_de_obra.0.unidad',
            'mano_de_obra.0.cantidad',
            'mano_de_obra.0.precio_unitario',
        ]);
    }

    public function test_calculate_acu_rounds_to_two_decimals(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.07.01',
                'descripcion' => 'Test rounding',
                'unidad' => 'm2',
                'rendimiento' => 3.0,
                'mano_de_obra' => [
                    [
                        'descripcion' => 'Operario',
                        'unidad' => 'hh',
                        'cantidad' => 1.0,
                        'precio_unitario' => 25.55,
                    ],
                ],
                'materiales' => [],
                'equipos' => [],
            ]);

        $response->assertStatus(200);

        $acu = $response->json('acu');

        // Calculation: (1.0 * 25.55) / 3.0 = 8.516666... -> 8.52
        $this->assertEquals(8.52, (float) $acu['costo_mano_obra']);
        $this->assertEquals(8.52, (float) $acu['mano_de_obra'][0]['parcial']);
    }

    public function test_calculate_acu_requires_authentication(): void
    {
        $response = $this->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
            'partida' => '01.08.01',
            'descripcion' => 'Test',
            'unidad' => 'm2',
            'rendimiento' => 1.0,
        ]);

        $response->assertStatus(401);
    }

    public function test_calculate_acu_requires_project_ownership(): void
    {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->postJson("/costos/proyectos/{$this->project->id}/presupuesto/acus/calculate", [
                'partida' => '01.09.01',
                'descripcion' => 'Test',
                'unidad' => 'm2',
                'rendimiento' => 1.0,
            ]);

        $response->assertStatus(403);
    }
}
