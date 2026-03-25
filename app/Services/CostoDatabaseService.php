<?php

namespace App\Services;

use App\Models\CostoProject;
use App\Models\Ubigeo;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CostoDatabaseService
{
    /**
     * Create a new MySQL database for a costos project and run tenant migrations.
     *
     * Flow:
     *  1. CREATE DATABASE
     *  2. Configure costos_tenant connection
     *  3. Run all tenant migrations (single unified file)
     *  4. Auto-create default presupuesto record
     *  5. Sync project params to tenant DB
     *  6. Auto-seed insumos catalog
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

        // 3. Auto-create default presupuesto record
        $presupuestoId = $this->createDefaultPresupuesto($dbName, $project->nombre);

        Log::info("CostoDatabaseService: Created default presupuesto [{$presupuestoId}] on [{$dbName}]");

        // 4. Sync project params to tenant DB
        $this->syncProjectParams($dbName, $project);

        // 5. Auto-seed the insumos catalog
        $this->seedInsumosCatalog($dbName);
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

    /**
     * Create the default presupuesto record in the tenant database.
     *
     * This is auto-called when a project is created. All metrados, cronogramas,
     * and ETTs can optionally link to this presupuesto via presupuesto_id.
     *
     * @param string $databaseName The tenant database name
     * @param string $projectName  The project name (used as presupuesto name)
     * @return int The ID of the created presupuesto
     */
    public function createDefaultPresupuesto(string $databaseName, string $projectName): int
    {
        $this->setTenantConnection($databaseName);

        return DB::connection('costos_tenant')
            ->table('presupuestos')
            ->insertGetId([
                'nombre'      => $projectName,
                'descripcion' => 'Presupuesto principal del proyecto',
                'moneda'      => 'SOLES',
                'fecha'       => now()->toDateString(),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
    }

    /**
     * Get the default (first) presupuesto ID from the tenant database.
     *
     * @param string $databaseName The tenant database name
     * @return int|null
     */
    public function getDefaultPresupuestoId(string $databaseName): ?int
    {
        $this->setTenantConnection($databaseName);

        $row = DB::connection('costos_tenant')
            ->table('presupuestos')
            ->orderBy('id')
            ->first(['id']);

        return $row?->id;
    }

    /**
     * Seed the insumos catalog (clases and productos) in the tenant database.
     * Called automatically after creating presupuesto tables.
     */
    public function seedInsumosCatalog(string $databaseName): void
    {
        $this->setTenantConnection($databaseName);

        try {
            Artisan::call('db:seed', [
                '--class' => 'Database\\Seeders\\InsumoProductoSeeder',
                '--force' => true,
            ]);

            Log::info("CostoDatabaseService: Seeded insumos catalog on [{$databaseName}]", [
                'output' => Artisan::output(),
            ]);
        } catch (\Exception $e) {
            Log::warning("CostoDatabaseService: Failed to seed insumos on [{$databaseName}]", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Sync project parameters from main DB (costo_projects) to tenant DB (project_params).
     *
     * Auto-calculates:
     *  - duracion_dias  = DATEDIFF(fecha_fin, fecha_inicio)
     *  - duracion_meses = duracion_dias / 30
     *
     * Resolves ubigeo IDs to readable names.
     *
     * Called:
     *  - When project is first created (from createDatabase)
     *  - When project data is updated (from CostoProjectController@update)
     */
    public function syncProjectParams(string $databaseName, CostoProject $project): void
    {
        $this->setTenantConnection($databaseName);

        // Auto-calculate durations from dates
        $diasObra = 0;
        $mesesObra = 0.0;
        if ($project->fecha_inicio && $project->fecha_fin) {
            $diasObra = $project->fecha_inicio->diffInDays($project->fecha_fin);
            $mesesObra = round($diasObra / 30, 2);
        }

        // Resolve ubigeo IDs to names
        $depNombre = null;
        $provNombre = null;
        $distNombre = null;

        if ($project->departamento_id) {
            $dep = Ubigeo::find($project->departamento_id);
            $depNombre = $dep?->departamento;
        }
        if ($project->provincia_id) {
            $prov = Ubigeo::find($project->provincia_id);
            $provNombre = $prov?->provincia;
        }
        if ($project->distrito_id) {
            $dist = Ubigeo::find($project->distrito_id);
            $distNombre = $dist?->distrito;
        }

        DB::connection('costos_tenant')->table('project_params')->updateOrInsert(
            ['id' => 1], // Always a single record
            [
                'nombre'              => $project->nombre,
                'uei'                 => $project->uei,
                'unidad_ejecutora'    => $project->unidad_ejecutora,
                'codigo_snip'         => $project->codigo_snip,
                'codigo_cui'          => $project->codigo_cui,
                'codigo_local'        => $project->codigo_local,
                'fecha_inicio'        => $project->fecha_inicio?->format('Y-m-d'),
                'fecha_fin'           => $project->fecha_fin?->format('Y-m-d'),
                'duracion_dias'       => $diasObra,
                'duracion_meses'      => $mesesObra,
                'departamento'        => $depNombre,
                'provincia'           => $provNombre,
                'distrito'            => $distNombre,
                'centro_poblado'      => $project->centro_poblado,
                'updated_at'          => now(),
            ]
        );

        Log::info("CostoDatabaseService: Synced project_params on [{$databaseName}]", [
            'duracion_dias'  => $diasObra,
            'duracion_meses' => $mesesObra,
        ]);
    }

    /**
     * Get the project params from the tenant database.
     */
    public function getProjectParams(string $databaseName): ?object
    {
        $this->setTenantConnection($databaseName);

        return DB::connection('costos_tenant')
            ->table('project_params')
            ->first();
    }

    /**
     * Update specific financial params in the tenant DB.
     * Used when costo_directo changes, utilidad changes, etc.
     */
    public function updateProjectFinancialParams(string $databaseName, array $params): void
    {
        $this->setTenantConnection($databaseName);

        $allowed = [
            'costo_directo',
            'utilidad_porcentaje',
            'igv_porcentaje',
            'jornada_laboral_horas',
            'rmv',
        ];

        $filtered = array_intersect_key($params, array_flip($allowed));
        if (empty($filtered)) {
            return;
        }

        $filtered['updated_at'] = now();

        DB::connection('costos_tenant')
            ->table('project_params')
            ->where('id', 1)
            ->update($filtered);

        Log::info("CostoDatabaseService: Updated financial params on [{$databaseName}]", $filtered);
    }
    /**
     * Recalcula el costo directo sumando los parciales de presupuesto_general
     * y actualiza project_params y presupuestos (tabla centralizada).
     */
    public function syncCostoDirecto(string $databaseName, int $tenantPresupuestoId): void
    {
        $this->setTenantConnection($databaseName);
        $connection = DB::connection('costos_tenant');

        // Sumar todos los parciales de presupuesto_general vinculados a este presupuesto
        // Nota: metrado * precio_unitario es la base del parcial en DB.
        $totalCostoDirecto = (float)$connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->sum(DB::raw('metrado * precio_unitario'));

        // 1. Actualizar tabla maestra de presupuestos del tenant
        if (\Illuminate\Support\Facades\Schema::connection('costos_tenant')->hasTable('presupuestos')) {
            $connection->table('presupuestos')
                ->where('id', $tenantPresupuestoId)
                ->update([
                    'costo_directo' => $totalCostoDirecto,
                    'updated_at'    => now(),
                ]);
        }

        // 2. Actualizar tabla de parámetros globales (project_params)
        if (\Illuminate\Support\Facades\Schema::connection('costos_tenant')->hasTable('project_params')) {
            $connection->table('project_params')
                ->where('id', 1)
                ->update([
                    'costo_directo' => $totalCostoDirecto,
                    'updated_at'    => now(),
                ]);
        }

        // 3. Propagación automática a base_calculo de Fianzas y Pólizas
        if (\Illuminate\Support\Facades\Schema::connection('costos_tenant')->hasTable('gg_fijos_fianzas')) {
            $connection->table('gg_fijos_fianzas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $totalCostoDirecto]);
        }

        if (\Illuminate\Support\Facades\Schema::connection('costos_tenant')->hasTable('gg_fijos_polizas')) {
            $connection->table('gg_fijos_polizas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $totalCostoDirecto]);
        }

        Log::info("CostoDatabaseService: Sync costo_directo [{$totalCostoDirecto}] for budget [{$tenantPresupuestoId}]");
    }

    /**
     * Propaga la actualización de un insumo a todos los ACUs que lo utilizan.
     */
    public function propagateInsumoUpdate($projectIdentifier, $insumo): void
    {
        try {
            $project = $projectIdentifier instanceof CostoProject 
                ? $projectIdentifier 
                : CostoProject::findOrFail($projectIdentifier);

            $this->setTenantConnection($project->database_name);
            $connection = DB::connection('costos_tenant');
            $tenantPresupuestoId = $this->getDefaultPresupuestoId($project->database_name);

            // 1. Buscar y actualizar directamente en las 5 nuevas tablas de componentes
            $childTables = [
                'acu_mano_de_obra' => 'precio_unitario',
                'acu_materiales'   => 'precio_unitario',
                'acu_equipos'      => 'precio_hora',
                'acu_subcontratos' => 'precio_unitario',
                'acu_subpartidas'  => 'precio_unitario',
            ];

            $affectedAcuIds = [];
            foreach ($childTables as $table => $priceField) {
                $affected = $connection->table($table)
                    ->where('insumo_id', $insumo->id)
                    ->get();
                
                if ($affected->isNotEmpty()) {
                    foreach ($affected as $row) {
                        $affectedAcuIds[] = $row->acu_id;
                        
                        // Recalcular parcial del item
                        $cant = (float)$row->cantidad;
                        $prec = (float)$insumo->costo_unitario;
                        $falc = (float)($row->factor_desperdicio ?? 1);
                        $parcial = round($cant * $prec * ($table === 'acu_materiales' ? $falc : 1), 4);

                        $connection->table($table)
                            ->where('id', $row->id)
                            ->update([
                                $priceField  => $prec,
                                'parcial'    => $parcial,
                                'updated_at' => now(),
                            ]);
                    }
                }
            }

            $affectedAcuIds = array_unique($affectedAcuIds);
            if (empty($affectedAcuIds)) return;

            // 2. Refrescar los ACUs afectados (JSON + Totales)
            $updatedPartidas = [];
            foreach ($affectedAcuIds as $acuId) {
                // Obtenemos los nuevos totales e items desde las tablas hijas
                $mo = $connection->table('acu_mano_de_obra')->where('acu_id', $acuId)->orderBy('item_order')->get();
                $ma = $connection->table('acu_materiales')->where('acu_id', $acuId)->orderBy('item_order')->get();
                $eq = $connection->table('acu_equipos')->where('acu_id', $acuId)->orderBy('item_order')->get();
                $sc = $connection->table('acu_subcontratos')->where('acu_id', $acuId)->orderBy('item_order')->get();
                $sp = $connection->table('acu_subpartidas')->where('acu_id', $acuId)->orderBy('item_order')->get();

                $costoMo = $mo->sum('parcial');
                $costoMa = $ma->sum('parcial');
                $costoEq = $eq->sum('parcial');
                $costoSc = $sc->sum('parcial');
                $costoSp = $sp->sum('parcial');

                $acu = $connection->table('presupuesto_acus')->where('id', $acuId)->first();
                if ($acu) {
                    $connection->table('presupuesto_acus')
                        ->where('id', $acuId)
                        ->update([
                            'mano_de_obra'       => json_encode($mo),
                            'materiales'         => json_encode($ma),
                            'equipos'            => json_encode($eq),
                            'subcontratos'       => json_encode($sc),
                            'subpartidas'        => json_encode($sp),
                            'costo_mano_obra'    => $costoMo,
                            'costo_materiales'   => $costoMa,
                            'costo_equipos'      => $costoEq,
                            'costo_subcontratos' => $costoSc,
                            'costo_subpartidas'  => $costoSp,
                            'updated_at'         => now(),
                        ]);
                    
                    $updatedPartidas[] = $acu->partida;
                }
            }

            // 3. Si hubo ACUs actualizados, sincronizar con presupuesto_general
            if (!empty($updatedPartidas)) {
                foreach (array_unique($updatedPartidas) as $partida) {
                    // Obtener el nuevo total del ACU (el trigger o columna calculada debería haberlo hecho ya)
                    $acuRes = $connection->table('presupuesto_acus')
                        ->where('presupuesto_id', $tenantPresupuestoId)
                        ->where('partida', $partida)
                        ->first();
                    
                    if ($acuRes) {
                        $connection->table('presupuesto_general')
                            ->where('presupuesto_id', $tenantPresupuestoId)
                            ->where('partida', $partida)
                            ->update([
                                'precio_unitario' => (float)($acuRes->costo_unitario_total ?? 0),
                                'updated_at'      => now(),
                            ]);
                    }
                }

                // 4. Recalcular costo directo total
                $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);
            }

        } catch (\Exception $e) {
            Log::error("Error propagating insumo update", [
                'insumo_id' => $insumo->id ?? null,
                'error'     => $e->getMessage()
            ]);
        }
    }
}

