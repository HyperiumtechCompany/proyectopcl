<?php

namespace Tests\Feature;

use App\Services\CostoDatabaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
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

    public function test_create_presupuesto_tables_method_exists(): void
    {
        $this->assertTrue(
            method_exists($this->dbService, 'createPresupuestoTables'),
            'CostoDatabaseService should have createPresupuestoTables method'
        );
    }

    public function test_create_presupuesto_tables_creates_all_six_tables(): void
    {
        // Create test database
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        // Execute the method
        $this->dbService->createPresupuestoTables($this->testDbName);

        // Switch to tenant connection to verify tables
        $this->dbService->setTenantConnection($this->testDbName);

        // Verify all six tables exist
        $tables = [
            'presupuesto_general',
            'presupuesto_acus',
            'presupuesto_gastos_generales',
            'presupuesto_insumos',
            'presupuesto_remuneraciones',
            'presupuesto_indices',
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

    public function test_create_presupuesto_tables_creates_correct_structure(): void
    {
        // Create test database
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        // Execute the method
        $this->dbService->createPresupuestoTables($this->testDbName);

        // Switch to tenant connection
        $this->dbService->setTenantConnection($this->testDbName);

        // Verify presupuesto_general has calculated 'parcial' column
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
        $this->assertContains('item_order', $columnNames);

        // Verify presupuesto_acus has JSON columns
        $acusColumns = DB::connection('costos_tenant')
            ->select("DESCRIBE presupuesto_acus");
        
        $acusColumnNames = array_column($acusColumns, 'Field');
        
        $this->assertContains('mano_de_obra', $acusColumnNames);
        $this->assertContains('materiales', $acusColumnNames);
        $this->assertContains('equipos', $acusColumnNames);
        $this->assertContains('costo_unitario_total', $acusColumnNames);
    }

    public function test_create_presupuesto_tables_can_insert_data(): void
    {
        // Create test database
        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$this->testDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        );

        // Execute the method
        $this->dbService->createPresupuestoTables($this->testDbName);

        // Switch to tenant connection
        $this->dbService->setTenantConnection($this->testDbName);

        // Insert test data into presupuesto_general
        $insertedId = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->insertGetId([
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

        // Verify the calculated 'parcial' column
        $row = DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('id', $insertedId)
            ->first();

        $this->assertNotNull($row);
        $this->assertEquals('01.01.01', $row->partida);
        
        // Verify calculated column: parcial = metrado * precio_unitario
        $expectedParcial = 100.50 * 25.75;
        $this->assertEquals($expectedParcial, (float) $row->parcial);
    }
}
