<?php

namespace App\Services;

use App\Models\CostoProject;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CostoDatabaseService
{
    /**
     * Create a new MySQL database for a costos project and run tenant migrations.
     */
    public function createDatabase(CostoProject $project): void
    {
        $dbName = $project->database_name;

        // 1. Create the database using the main connection
        $charset = config('database.connections.mysql.charset', 'utf8mb4');
        $collation = config('database.connections.mysql.collation', 'utf8mb4_unicode_ci');

        DB::connection('mysql')->statement(
            "CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET {$charset} COLLATE {$collation}"
        );

        Log::info("CostoDatabaseService: Created database [{$dbName}] for project [{$project->id}]");

        // 2. Configure the tenant connection and run migrations
        $this->setTenantConnection($dbName);
        $this->runTenantMigrations($dbName);
    }

    /**
     * Drop the database for a costos project.
     */
    public function dropDatabase(CostoProject $project): void
    {
        $dbName = $project->database_name;

        DB::connection('mysql')->statement("DROP DATABASE IF EXISTS `{$dbName}`");

        Log::info("CostoDatabaseService: Dropped database [{$dbName}] for project [{$project->id}]");
    }

    /**
     * Set the costos_tenant connection to point to a specific database.
     */
    public function setTenantConnection(string $databaseName): void
    {
        // Ensure the full connection config exists (not just database key)
        $mysqlConfig = config('database.connections.mysql');
        $tenantConfig = array_merge($mysqlConfig, [
            'database' => $databaseName,
        ]);

        Config::set('database.connections.costos_tenant', $tenantConfig);

        // Purge cached connection so it reconnects with new DB name
        DB::purge('costos_tenant');
        DB::reconnect('costos_tenant');
    }

    /**
     * Run tenant-specific migrations on the given database.
     */
    public function runTenantMigrations(string $databaseName): void
    {
        $this->setTenantConnection($databaseName);

        // Verify connection works before running migrations
        DB::connection('costos_tenant')->getPdo();

        Artisan::call('migrate', [
            '--database' => 'costos_tenant',
            '--path' => 'database/migrations/costos_tenant',
            '--force' => true,
        ]);

        Log::info("CostoDatabaseService: Ran tenant migrations on [{$databaseName}]", [
            'output' => Artisan::output(),
        ]);
    }

    /**
     * Rollback tenant-specific migrations on the given database.
     */
    public function rollbackTenantMigrations(string $databaseName): void
    {
        $this->setTenantConnection($databaseName);

        Artisan::call('migrate:rollback', [
            '--database' => 'costos_tenant',
            '--path' => 'database/migrations/costos_tenant',
            '--force' => true,
        ]);
    }

    /**
     * Check if a tenant database exists.
     */
    public function databaseExists(string $databaseName): bool
    {
        $result = DB::connection('mysql')->select(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
            [$databaseName]
        );

        return count($result) > 0;
    }
}
