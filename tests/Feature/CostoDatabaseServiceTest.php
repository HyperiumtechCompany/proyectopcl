<?php

namespace Tests\Feature;

use App\Services\CostoDatabaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CostoDatabaseServiceTest extends TestCase
{
    use RefreshDatabase;

    protected CostoDatabaseService $dbService;
    protected string $testDbName;

    protected function setUp(): void
    {
        parent::setUp();

        // Skip tests if not using MySQL
        if (config('database.default') !== 'mysql') {
            $this->markTestSkipped('This test requires MySQL database connection');
        }

        $this->dbService = app(CostoDatabaseService::class);
        $this->testDbName = 'costos_test_' . time();
    }

    protected function tearDown(): void
    {
        // Clean up test database if it exists
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

    public function test_tenant_migration_creates_all_core_tables(): void
    {
        // Create test database
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        // Run tenant migrations
        $this->dbService->runTenantMigrations($this->testDbName);

        // Switch to tenant connection to verify tables
        $this->dbService->setTenantConnection($this->testDbName);

        // Verify all core tables exist
        $tables = [
            'project_meta',
            'presupuestos',
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_sanitarias',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
            'cronograma_general',
            'cronograma_valorizado',
            'cronograma_materiales',
            'especificaciones_tecnicas',
            'presupuesto_general',
            'presupuesto_acus',
            'presupuesto_insumos',
            'presupuesto_remuneraciones',
            'presupuesto_indices',
            'gg_fijos',
            'gg_fijos_fianzas',
            'gg_fijos_polizas',
            'gg_variables',
            'gg_supervision',
            'gg_control_concurrente',
            'gg_consolidado',
            'insumo_clases',
            'insumo_productos',
            'metrado_sanitarias_config',
            'metrado_sanitarias_modulos',
            'metrado_sanitarias_exterior',
            'metrado_sanitarias_cisterna',
            'metrado_sanitarias_resumen',
        ];

        foreach ($tables as $table) {
            $exists = DB::connection('costos_tenant')
                ->select("SHOW TABLES LIKE '{$table}'");

            $this->assertNotEmpty(
                $exists,
                "Table {$table} should exist in tenant database"
            );
        }
    }

    public function test_metrados_have_presupuesto_id_column(): void
    {
        // Create test database and run migrations
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $this->dbService->runTenantMigrations($this->testDbName);
        $this->dbService->setTenantConnection($this->testDbName);

        $metradoTables = [
            'metrado_arquitectura',
            'metrado_estructura',
            'metrado_sanitarias',
            'metrado_electricas',
            'metrado_comunicaciones',
            'metrado_gas',
        ];

        foreach ($metradoTables as $table) {
            $columns = DB::connection('costos_tenant')
                ->select("DESCRIBE {$table}");

            $columnNames = array_column($columns, 'Field');

            $this->assertContains(
                'presupuesto_id',
                $columnNames,
                "Table {$table} should have presupuesto_id column"
            );
        }
    }

    public function test_create_default_presupuesto_method(): void
    {
        // Create test database and run migrations
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $this->dbService->runTenantMigrations($this->testDbName);

        // Create default presupuesto
        $id = $this->dbService->createDefaultPresupuesto($this->testDbName, 'Test Project');

        $this->assertGreaterThan(0, $id);

        // Verify it exists
        $row = DB::connection('costos_tenant')
            ->table('presupuestos')
            ->where('id', $id)
            ->first();

        $this->assertNotNull($row);
        $this->assertEquals('Test Project', $row->nombre);
    }

    public function test_presupuesto_general_has_correct_structure(): void
    {
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );
        $this->dbService->runTenantMigrations($this->testDbName);
        $this->dbService->setTenantConnection($this->testDbName);

        // Create a presupuesto for FK
        $presupuestoId = $this->dbService->createDefaultPresupuesto($this->testDbName, 'Test');

        // Verify presupuesto_general columns
        $columns = DB::connection('costos_tenant')
            ->select("DESCRIBE presupuesto_general");

        $columnNames = array_column($columns, 'Field');

        $this->assertContains('partida', $columnNames);
        $this->assertContains('descripcion', $columnNames);
        $this->assertContains('unidad', $columnNames);
        $this->assertContains('metrado', $columnNames);
        $this->assertContains('precio_unitario', $columnNames);
        $this->assertContains('parcial', $columnNames);
        $this->assertContains('metrado_source', $columnNames);
        $this->assertContains('presupuesto_id', $columnNames);

        // Insert test data
        $insertedId = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->insertGetId([
                'presupuesto_id' => $presupuestoId,
                'partida' => '01.01.01',
                'descripcion' => 'Test partida',
                'unidad' => 'm2',
                'metrado' => 100.50,
                'precio_unitario' => 25.75,
                'item_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

        $this->assertGreaterThan(0, $insertedId);

        // Verify calculated column: parcial = metrado * precio_unitario
        $row = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('id', $insertedId)
            ->first();

        $this->assertNotNull($row);
        $expectedParcial = 100.50 * 25.75;
        $this->assertEquals($expectedParcial, (float) $row->parcial);
    }
}
