<?php

namespace Tests\Unit;

use App\Services\CostoDatabaseService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class CostoDatabaseServiceTest extends TestCase
{
    public function test_create_presupuesto_tables_method_exists(): void
    {
        $service = new CostoDatabaseService();
        
        $this->assertTrue(
            method_exists($service, 'createPresupuestoTables'),
            'CostoDatabaseService should have createPresupuestoTables method'
        );
    }

    public function test_create_presupuesto_tables_has_correct_signature(): void
    {
        $reflection = new ReflectionClass(CostoDatabaseService::class);
        $method = $reflection->getMethod('createPresupuestoTables');
        
        // Verify method is public
        $this->assertTrue(
            $method->isPublic(),
            'createPresupuestoTables should be a public method'
        );
        
        // Verify method has one parameter
        $parameters = $method->getParameters();
        $this->assertCount(
            1,
            $parameters,
            'createPresupuestoTables should have exactly one parameter'
        );
        
        // Verify parameter name and type
        $param = $parameters[0];
        $this->assertEquals(
            'databaseName',
            $param->getName(),
            'Parameter should be named databaseName'
        );
        
        $this->assertTrue(
            $param->hasType(),
            'Parameter should have a type hint'
        );
        
        $this->assertEquals(
            'string',
            $param->getType()->getName(),
            'Parameter should be of type string'
        );
        
        // Verify return type
        $this->assertTrue(
            $method->hasReturnType(),
            'Method should have a return type'
        );
        
        $this->assertEquals(
            'void',
            $method->getReturnType()->getName(),
            'Method should return void'
        );
    }

    public function test_service_has_all_required_methods(): void
    {
        $service = new CostoDatabaseService();
        
        $requiredMethods = [
            'createDatabase',
            'dropDatabase',
            'setTenantConnection',
            'runTenantMigrations',
            'rollbackTenantMigrations',
            'databaseExists',
            'createPresupuestoTables', // New method
        ];
        
        foreach ($requiredMethods as $method) {
            $this->assertTrue(
                method_exists($service, $method),
                "CostoDatabaseService should have {$method} method"
            );
        }
    }
}
