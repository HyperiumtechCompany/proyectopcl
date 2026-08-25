<?php

namespace App\Services;

use App\Models\CostoProject;
use App\Models\Ubigeo;
use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

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
        // No-op if already pointed at this database. DB::purge()+reconnect() below
        // tears down the live PDO handle, which silently orphans any in-flight
        // transaction: callers like calculateACU()/update() call this (directly or
        // via getDefaultPresupuestoId()/syncCostoDirecto()) *inside* an already-open
        // costos_tenant transaction on every request (SetCostosDatabase middleware
        // already set it once). The orphaned connection's uncommitted locks then
        // block the freshly-reconnected session's writes to the same rows until
        // innodb_lock_wait_timeout fires — SQLSTATE HY000 1205 "Lock wait timeout
        // exceeded", surfaced to the user as ACU/cronograma save 500s. Only a real
        // switch to a different tenant database needs to purge+reconnect.
        if (config('database.connections.costos_tenant.database') === $databaseName) {
            return;
        }

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
     * Ensure the presupuesto-related tables exist on a tenant database
     * (idempotent: delegates to the tenant migration runner, which Laravel
     * already skips for migrations that were previously applied).
     */
    public function createPresupuestoTables(string $databaseName): void
    {
        $this->runTenantMigrations($databaseName);
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
            'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
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
     * @param  string  $databaseName  The tenant database name
     * @param  string  $projectName  The project name (used as presupuesto name)
     * @return int The ID of the created presupuesto
     */
    public function createDefaultPresupuesto(string $databaseName, string $projectName): int
    {
        $this->setTenantConnection($databaseName);

        return DB::connection('costos_tenant')
            ->table('presupuestos')
            ->insertGetId([
                'nombre' => $projectName,
                'descripcion' => 'Presupuesto principal del proyecto',
                'moneda' => 'SOLES',
                'fecha' => now()->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
    }

    /**
     * Get the default (first) presupuesto ID from the tenant database.
     *
     * @param  string  $databaseName  The tenant database name
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
                '--database' => 'costos_tenant',
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
                'nombre' => $project->nombre,
                'uei' => $project->uei,
                'unidad_ejecutora' => $project->unidad_ejecutora,
                'codigo_snip' => $project->codigo_snip,
                'codigo_cui' => $project->codigo_cui,
                'codigo_local' => $project->codigo_local,
                'fecha_inicio' => $project->fecha_inicio?->format('Y-m-d'),
                'fecha_fin' => $project->fecha_fin?->format('Y-m-d'),
                'duracion_dias' => $diasObra,
                'duracion_meses' => $mesesObra,
                'departamento' => $depNombre,
                'provincia' => $provNombre,
                'distrito' => $distNombre,
                'centro_poblado' => $project->centro_poblado,
                'updated_at' => now(),
            ]
        );

        Log::info("CostoDatabaseService: Synced project_params on [{$databaseName}]", [
            'duracion_dias' => $diasObra,
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
     * Garantiza que presupuesto_general.parcial sea columna regular (no GENERATED).
     * Algunos tenant DBs más antiguos o re-creados pueden conservar la definición STORED GENERATED.
     */
    private function ensureParcialRegularColumn(): void
    {
        $connection = DB::connection('costos_tenant');
        $dbName = $connection->getDatabaseName();

        $col = $connection->selectOne(
            "SELECT EXTRA FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'presupuesto_general' AND COLUMN_NAME = 'parcial'",
            [$dbName]
        );

        if ($col && stripos((string) $col->EXTRA, 'GENERATED') !== false) {
            $connection->statement('ALTER TABLE presupuesto_general DROP COLUMN parcial');
            $connection->statement(
                'ALTER TABLE presupuesto_general ADD COLUMN parcial DECIMAL(20,10) NOT NULL DEFAULT 0 AFTER precio_unitario'
            );
            // Repoblar parcial para filas hoja con datos ya existentes
            $connection->statement(
                'UPDATE presupuesto_general SET parcial = ROUND(metrado * precio_unitario, 10) WHERE metrado > 0 OR precio_unitario > 0'
            );

            Log::info('CostoDatabaseService: converted presupuesto_general.parcial from GENERATED to regular column', ['db' => $dbName]);
        }
    }

    /**
     * Amplía una columna DECIMAL a 10 decimales si aún no lo está. 6 decimales
     * ya aplanaba precio_unitario/costo_unitario_total lo suficiente como para
     * que, al multiplicarse por metrados grandes (decenas de miles), el error
     * de redondeo del séptimo decimal se amplificara a varios céntimos —
     * verificado con datos reales (metrado=75,500.52 × error 0.00000044 =
     * 0.033 de diferencia entre Costo Directo e Insumos Consolidados). 10
     * decimales dejan ese error muy por debajo de un céntimo incluso para
     * metrados de cientos de millones. Consulta information_schema primero
     * para no re-ejecutar el ALTER (costoso en tablas grandes) cuando la
     * columna ya tiene la precisión objetivo.
     */
    private function widenColumnScale(string $table, string $column, int $scale = 10, int $precision = 20): void
    {
        $connection = DB::connection('costos_tenant');
        $dbName = $connection->getDatabaseName();

        $schema = Schema::connection('costos_tenant');
        if (! $schema->hasTable($table) || ! $schema->hasColumn($table, $column)) {
            return;
        }

        $col = $connection->selectOne(
            'SELECT NUMERIC_SCALE AS scale FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$dbName, $table, $column]
        );

        if ($col && (int) $col->scale >= $scale) {
            return;
        }

        try {
            $connection->statement(
                "ALTER TABLE {$table} MODIFY COLUMN {$column} DECIMAL({$precision},{$scale}) NOT NULL DEFAULT 0"
            );
        } catch (\Throwable $e) {
            Log::warning("No se pudo ampliar la precisión de {$table}.{$column}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function widenPresupuestoGeneralPrecision(): void
    {
        $this->widenColumnScale('presupuesto_general', 'precio_unitario');
        $this->widenColumnScale('presupuesto_general', 'parcial');
    }

    /**
     * Amplía a 6 decimales las columnas de presupuesto_acus/acu_* que participan
     * en el cálculo del ACU. Se llama desde syncCostoDirecto() para que cualquier
     * punto de entrada que lo invoque (Delphin, Presupuesto General, import Excel)
     * auto-repare tenants antiguos, no solo el flujo de guardado de un ACU.
     */
    public function widenAcuPrecisionColumns(): void
    {
        foreach ([
            'costo_mano_obra', 'costo_materiales', 'costo_equipos', 'costo_subcontratos', 'costo_subpartidas',
        ] as $column) {
            $this->widenColumnScale('presupuesto_acus', $column);
        }

        $connection = DB::connection('costos_tenant');
        $dbName = $connection->getDatabaseName();
        $schema = Schema::connection('costos_tenant');

        if ($schema->hasTable('presupuesto_acus') && $schema->hasColumn('presupuesto_acus', 'costo_unitario_total')) {
            $col = $connection->selectOne(
                "SELECT NUMERIC_SCALE AS scale FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'presupuesto_acus' AND COLUMN_NAME = 'costo_unitario_total'",
                [$dbName]
            );

            if (! $col || (int) $col->scale < 10) {
                try {
                    $connection->statement(
                        'ALTER TABLE presupuesto_acus MODIFY COLUMN costo_unitario_total DECIMAL(20,10) GENERATED ALWAYS AS (costo_mano_obra + costo_materiales + costo_equipos + costo_subcontratos + costo_subpartidas) STORED'
                    );
                } catch (\Throwable $e) {
                    Log::warning('No se pudo actualizar la fórmula de costo_unitario_total', [
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        foreach ([
            'acu_mano_de_obra' => 'precio_unitario',
            'acu_materiales' => 'precio_unitario',
            'acu_equipos' => 'precio_hora',
            'acu_subcontratos' => 'precio_unitario',
            'acu_subpartidas' => 'precio_unitario',
        ] as $table => $priceColumn) {
            $this->widenColumnScale($table, $priceColumn);
            $this->widenColumnScale($table, 'parcial');
            $this->widenColumnScale($table, 'cantidad', 6, 12);
        }
    }

    /**
     * Recalcula el costo directo sumando los parciales de presupuesto_general
     * y actualiza project_params y presupuestos (tabla centralizada).
     */
    public function syncCostoDirecto(string $databaseName, int $tenantPresupuestoId): void
    {
        $this->setTenantConnection($databaseName);
        $connection = DB::connection('costos_tenant');

        $this->ensureParcialRegularColumn();
        $this->widenPresupuestoGeneralPrecision();
        $this->widenAcuPrecisionColumns();
        $this->recalculateACUCategories($connection, $tenantPresupuestoId);
        $this->recalculateParciales($connection, $tenantPresupuestoId);

        // costo_directo = sum of all partida parciales (rows with unidad and metrado/precio > 0)
        // This is the most reliable total since title parciales may be affected by duplicate WBS codes
        $costoDirecto = (float) $connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->whereNotNull('unidad')
            ->where('unidad', '!=', '')
            ->where(function ($q) {
                $q->where('metrado', '>', 0)
                    ->orWhere('precio_unitario', '>', 0);
            })
            ->sum('parcial');

        // Fallback: if no partida rows found, try root-level titles
        if ($costoDirecto <= 0) {
            $costoDirecto = (float) $connection->table('presupuesto_general')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->whereRaw('partida NOT LIKE "%.%"')
                ->whereNotNull('partida')
                ->where('partida', '!=', '')
                ->sum('parcial');
        }

        // 1. Actualizar tabla maestra de presupuestos del tenant
        if (Schema::connection('costos_tenant')->hasTable('presupuestos')) {
            $connection->table('presupuestos')
                ->where('id', $tenantPresupuestoId)
                ->update([
                    'costo_directo' => $costoDirecto,
                    'updated_at' => now(),
                ]);
        }

        // 2. Actualizar tabla de parámetros globales (project_params)
        if (Schema::connection('costos_tenant')->hasTable('project_params')) {
            $connection->table('project_params')
                ->where('id', 1)
                ->update([
                    'costo_directo' => $costoDirecto,
                    'updated_at' => now(),
                ]);
        }

        // 3. Propagación automática a base_calculo de Fianzas y Pólizas
        if (Schema::connection('costos_tenant')->hasTable('gg_fijos_fianzas')) {
            $connection->table('gg_fijos_fianzas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $costoDirecto]);
        }

        if (Schema::connection('costos_tenant')->hasTable('gg_fijos_polizas')) {
            $connection->table('gg_fijos_polizas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $costoDirecto]);
        }

        Log::info("CostoDatabaseService: Sync costo_directo [{$costoDirecto}] for budget [{$tenantPresupuestoId}]");
    }

    /**
     * Decodes an ACU component JSON column (mano_de_obra, materiales, ...) into an array.
     * Query builder rows return JSON columns as raw strings, unlike Eloquent casts.
     */
    private function decodeAcuComponentField(mixed $raw): array
    {
        if (is_array($raw)) {
            return $raw;
        }
        if (! is_string($raw) || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Normaliza un código de partida rellenando cada segmento a 2 dígitos
     * (ej. "2.3.7.1.3" → "02.03.07.01.03"). presupuesto_acus.partida y
     * presupuesto_general.partida pueden guardar el mismo código WBS con
     * distinto padding (uno importado con ceros, el otro sin ellos) — un
     * WHERE partida = ? exacto entre ambas tablas puede no encontrar NINGUNA
     * fila y dejar precio_unitario desincronizado en silencio. Debe coincidir
     * con normalizedPartida() en InsumosConsolidadosModal.tsx.
     */
    public function normalizePartidaCode(string $value): string
    {
        $parts = array_filter(explode('.', $value), fn ($p) => $p !== '');

        return implode('.', array_map(fn ($p) => str_pad($p, 2, '0', STR_PAD_LEFT), $parts));
    }

    private function roundAcuCantidad(mixed $cantidad): float
    {
        // 4 decimales — mismo criterio que calculateACU() (PresupuestoController) y
        // roundCantidad() en AcuPanel.tsx/usePresupuestoAcu.ts. Antes truncaba a 3,
        // más agresivo que el resto del sistema, en cada auto-reparación (cada carga
        // de Delphin vía syncCostoDirecto).
        return round((float) ($cantidad ?? 0), 4);
    }

    /**
     * Recalcula los costos por categoría de un ACU a partir de sus componentes JSON —
     * la MISMA fuente que lee el frontend (AcuPanel, Insumos Consolidados vía
     * presupuesto_acus.mano_de_obra/materiales/...). Las tablas relacionales
     * acu_mano_de_obra/etc. son un índice secundario (propagación de precios al
     * catálogo) con su propia precisión de columna; recalcular desde ahí en vez del
     * JSON reintroducía la misma divergencia que se quiere eliminar.
     *
     * ACUs guardados antes de la corrección de precisión tienen su parcial de ítem
     * aplanado a 2 o 6 decimales (ej. 1.48 o 6.907501 en vez de 6.9075005600) — este
     * método lo recalcula a 10 decimales y solo reescribe el JSON/columnas si el
     * valor realmente cambió. La sincronización de precio_unitario hacia
     * presupuesto_general (al final del método) corre siempre, incluso si nada
     * cambió aquí, porque el match es por código de partida normalizado y una
     * corrida anterior pudo haber corregido costo_unitario_total sin lograr
     * propagarlo (ver normalizePartidaCode()).
     */
    private function recalculateAcuFromJson($connection, object $acu, int $tenantPresupuestoId, array $generalIdByNormalizedPartida = []): void
    {
        $manoDeObra = $this->decodeAcuComponentField($acu->mano_de_obra ?? null);
        $costoManoObra = 0.0;
        $manoDeObraChanged = false;
        foreach ($manoDeObra as &$item) {
            $cantidad = $this->roundAcuCantidad($item['cantidad'] ?? 0);
            if (abs($cantidad - (float) ($item['cantidad'] ?? 0)) > 0.0000001) {
                $item['cantidad'] = $cantidad;
                $manoDeObraChanged = true;
            }
            $parcial = round($cantidad * (float) ($item['precio_unitario'] ?? 0), 10);
            if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001) {
                $item['parcial'] = $parcial;
                $manoDeObraChanged = true;
            }
            $costoManoObra += (float) $item['parcial'];
        }
        unset($item);

        $materiales = $this->decodeAcuComponentField($acu->materiales ?? null);
        $costoMateriales = 0.0;
        $materialesChanged = false;
        foreach ($materiales as &$item) {
            $cantidad = $this->roundAcuCantidad($item['cantidad'] ?? 0);
            if (abs($cantidad - (float) ($item['cantidad'] ?? 0)) > 0.0000001) {
                $item['cantidad'] = $cantidad;
                $materialesChanged = true;
            }
            $factor = (float) ($item['factor_desperdicio'] ?? 1) ?: 1.0;
            $parcial = round($cantidad * (float) ($item['precio_unitario'] ?? 0) * $factor, 10);
            if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001) {
                $item['parcial'] = $parcial;
                $materialesChanged = true;
            }
            $costoMateriales += (float) $item['parcial'];
        }
        unset($item);

        $equipos = $this->decodeAcuComponentField($acu->equipos ?? null);
        $costoEquipos = 0.0;
        $equiposChanged = false;
        foreach ($equipos as &$item) {
            $isHerramientas = stripos((string) ($item['descripcion'] ?? ''), 'herramienta') !== false;
            $cantidad = $this->roundAcuCantidad($item['cantidad'] ?? 0);
            if (abs($cantidad - (float) ($item['cantidad'] ?? 0)) > 0.0000001) {
                $item['cantidad'] = $cantidad;
                $equiposChanged = true;
            }

            if ($isHerramientas) {
                $parcial = round($costoManoObra * ($cantidad / 100.0), 10);
                if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001 || abs($costoManoObra - (float) ($item['precio_hora'] ?? 0)) > 0.0000000001) {
                    $item['parcial'] = $parcial;
                    $item['precio_hora'] = $costoManoObra;
                    $equiposChanged = true;
                }
            } else {
                $parcial = round($cantidad * (float) ($item['precio_hora'] ?? 0), 10);
                if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001) {
                    $item['parcial'] = $parcial;
                    $equiposChanged = true;
                }
            }
            $costoEquipos += (float) $item['parcial'];
        }
        unset($item);

        $subcontratos = $this->decodeAcuComponentField($acu->subcontratos ?? null);
        $costoSubcontratos = 0.0;
        $subcontratosChanged = false;
        foreach ($subcontratos as &$item) {
            $cantidad = $this->roundAcuCantidad($item['cantidad'] ?? 0);
            if (abs($cantidad - (float) ($item['cantidad'] ?? 0)) > 0.0000001) {
                $item['cantidad'] = $cantidad;
                $subcontratosChanged = true;
            }
            $parcial = round($cantidad * (float) ($item['precio_unitario'] ?? 0), 10);
            if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001) {
                $item['parcial'] = $parcial;
                $subcontratosChanged = true;
            }
            $costoSubcontratos += (float) $item['parcial'];
        }
        unset($item);

        $subpartidas = $this->decodeAcuComponentField($acu->subpartidas ?? null);
        $costoSubpartidas = 0.0;
        $subpartidasChanged = false;
        foreach ($subpartidas as &$item) {
            $cantidad = $this->roundAcuCantidad($item['cantidad'] ?? 0);
            if (abs($cantidad - (float) ($item['cantidad'] ?? 0)) > 0.0000001) {
                $item['cantidad'] = $cantidad;
                $subpartidasChanged = true;
            }
            $parcial = round($cantidad * (float) ($item['precio_unitario'] ?? 0), 10);
            if (abs($parcial - (float) ($item['parcial'] ?? 0)) > 0.0000000001) {
                $item['parcial'] = $parcial;
                $subpartidasChanged = true;
            }
            $costoSubpartidas += (float) $item['parcial'];
        }
        unset($item);

        // Umbral ajustado a 10dp (antes 1e-6 con 6dp): con metrados grandes, una
        // mejora de precisión de unas pocas 1e-7 ya vale la pena persistir, o el
        // auto-heal la descarta como "sin cambios" y el precio_unitario stale
        // sigue amplificándose en Costo Directo.
        $categoryChanged = abs($costoManoObra - (float) $acu->costo_mano_obra) > 0.0000000001
            || abs($costoMateriales - (float) $acu->costo_materiales) > 0.0000000001
            || abs($costoEquipos - (float) $acu->costo_equipos) > 0.0000000001
            || abs($costoSubcontratos - (float) $acu->costo_subcontratos) > 0.0000000001
            || abs($costoSubpartidas - (float) $acu->costo_subpartidas) > 0.0000000001;

        if ($categoryChanged || $manoDeObraChanged || $materialesChanged || $equiposChanged || $subcontratosChanged || $subpartidasChanged) {
            $update = [
                'costo_mano_obra' => $costoManoObra,
                'costo_materiales' => $costoMateriales,
                'costo_equipos' => $costoEquipos,
                'costo_subcontratos' => $costoSubcontratos,
                'costo_subpartidas' => $costoSubpartidas,
                'updated_at' => now(),
            ];
            if ($manoDeObraChanged) {
                $update['mano_de_obra'] = json_encode($manoDeObra);
            }
            if ($materialesChanged) {
                $update['materiales'] = json_encode($materiales);
            }
            if ($equiposChanged) {
                $update['equipos'] = json_encode($equipos);
            }
            if ($subcontratosChanged) {
                $update['subcontratos'] = json_encode($subcontratos);
            }
            if ($subpartidasChanged) {
                $update['subpartidas'] = json_encode($subpartidas);
            }

            $connection->table('presupuesto_acus')->where('id', $acu->id)->update($update);
        }

        // Sincroniza precio_unitario SIEMPRE, no solo cuando este ACU cambió en esta
        // corrida: si una corrida anterior ya corrigió costo_unitario_total pero el
        // match con presupuesto_general falló (código con distinto padding de ceros),
        // el guard de "sin cambios" de arriba nunca vuelve a intentar propagarlo — el
        // valor stale queda atascado para siempre en Costo Directo.
        $fresh = $connection->table('presupuesto_acus')->where('id', $acu->id)->first();
        $newTotal = (float) ($fresh->costo_unitario_total ?? ($costoManoObra + $costoMateriales + $costoEquipos + $costoSubcontratos + $costoSubpartidas));

        // Match por código normalizado, no por string exacto: presupuesto_acus.partida
        // y presupuesto_general.partida pueden diferir en padding de ceros (ver
        // normalizePartidaCode()) — un WHERE partida = ? exacto aquí puede actualizar
        // 0 filas y dejar precio_unitario/Costo Directo con el valor viejo para
        // siempre, sin que ningún error lo delate.
        $generalId = $generalIdByNormalizedPartida[$this->normalizePartidaCode($acu->partida)] ?? null;
        if ($generalId !== null) {
            $connection->table('presupuesto_general')
                ->where('id', $generalId)
                ->where('precio_unitario', '!=', $newTotal)
                ->update(['precio_unitario' => $newTotal, 'updated_at' => now()]);
        }
    }

    /**
     * Recalcula los costos por categoría de cada ACU del presupuesto. Ver
     * recalculateAcuFromJson() para el detalle de la fuente y el porqué.
     */
    public function recalculateACUCategories($connection, int $tenantPresupuestoId): void
    {
        $acus = $connection->table('presupuesto_acus')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->get();

        $generalIdByNormalizedPartida = [];
        foreach ($connection->table('presupuesto_general')->where('presupuesto_id', $tenantPresupuestoId)->get(['id', 'partida']) as $row) {
            $generalIdByNormalizedPartida[$this->normalizePartidaCode($row->partida)] = $row->id;
        }

        foreach ($acus as $acu) {
            $this->recalculateAcuFromJson($connection, $acu, $tenantPresupuestoId, $generalIdByNormalizedPartida);
        }
    }

    /**
     * Recalcula los parciales de las filas padre (títulos/subtítulos) de presupuesto_general.
     * Las partidas (hojas): parcial = round(metrado × precio_unitario, 10).
     * Los títulos/subtítulos (padres): parcial = suma de parciales de sus hijos directos.
     */
    public function recalculateParciales($connection, int $tenantPresupuestoId): void
    {
        $rows = $connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->orderByRaw('LENGTH(partida) - LENGTH(REPLACE(partida, ".", "")) DESC')
            ->orderBy('partida')
            ->get();

        $parentCodes = [];
        foreach ($rows as $row) {
            $parts = explode('.', $row->partida);
            if (count($parts) > 1) {
                array_pop($parts);
                $parentCodes[] = implode('.', $parts);
            }
        }
        $parentCodes = array_unique($parentCodes);

        $parciales = [];
        foreach ($rows as $row) {
            if (! in_array($row->partida, $parentCodes)) {
                $newParcial = round((float) $row->metrado * (float) $row->precio_unitario, 10);
                $parciales[$row->partida] = $newParcial;

                // Umbral ajustado a la nueva precisión (10dp, antes 1e-5 con 6dp): con
                // metrados grandes, un error de solo 1e-6 en precio_unitario ya se
                // amplifica a céntimos — un umbral más laxo dejaría esa corrección sin
                // aplicar en tenants existentes.
                if (abs($newParcial - (float) ($row->parcial ?? 0)) > 0.0000000001) {
                    $connection->table('presupuesto_general')
                        ->where('id', $row->id)
                        ->update(['parcial' => $newParcial, 'updated_at' => now()]);
                }
            }
        }

        foreach ($rows as $row) {
            if (in_array($row->partida, $parentCodes)) {
                $prefix = $row->partida.'.';
                $sum = 0;

                foreach ($parciales as $childPartida => $childParcial) {
                    if (str_starts_with($childPartida, $prefix)) {
                        $remaining = substr($childPartida, strlen($prefix));
                        if (! str_contains($remaining, '.')) {
                            $sum += $childParcial;
                        }
                    }
                }

                $parciales[$row->partida] = round($sum, 10);
                $connection->table('presupuesto_general')
                    ->where('id', $row->id)
                    ->update([
                        'parcial' => round($sum, 10),
                        'updated_at' => now(),
                    ]);
            }
        }
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
                'acu_materiales' => 'precio_unitario',
                'acu_equipos' => 'precio_hora',
                'acu_subcontratos' => 'precio_unitario',
                'acu_subpartidas' => 'precio_unitario',
            ];

            $affectedAcuIds = [];
            foreach ($childTables as $table => $priceField) {
                $affected = $connection->table($table)
                    ->where('insumo_id', $insumo->id)
                    ->get();

                if ($affected->isNotEmpty()) {
                    foreach ($affected as $row) {
                        $affectedAcuIds[] = $row->acu_id;

                        // Herramientas (equipos con descripción "herramienta...", ej.
                        // "HERRAMIENTAS MANUALES"): su precio real NUNCA es el precio de
                        // catálogo del insumo — es un % de la mano de obra del propio ACU
                        // (ver calculateACU()/recalculateAcuFromJson(): parcial =
                        // costoManoObra × cantidad/100). Aplicarles esta propagación de
                        // precio de catálogo sin ese caso especial escribía
                        // cantidad × precio_nuevo directo (ej. 3 × 1.972 = 5.916 en vez de
                        // 0.03 × 1.972 = 0.05916, 100x de más) — confirmado en producción:
                        // corrompió "HERRAMIENTAS MANUALES" en decenas de ACUs a la vez, en
                        // un solo evento, porque ese insumo se reutiliza en casi todos los
                        // ACUs del proyecto. Se omiten aquí; su valor correcto se restaura
                        // solo en el próximo recalculateAcuFromJson()/calculateACU() (ya que
                        // ninguno de los dos toca el precio de catálogo para este caso).
                        if ($table === 'acu_equipos' && stripos((string) $row->descripcion, 'herramienta') !== false) {
                            continue;
                        }

                        // Recalcular parcial del item — 10 decimales (no 2), igual que
                        // calculateACU()/recalculateAcuFromJson(): con metrados grandes,
                        // hasta 6dp en costo_mano_obra/etc. se amplifica a céntimos frente
                        // a Insumos Consolidados (este último recalcula desde cantidad ×
                        // precio_unitario crudos, sin pasar por este campo "parcial").
                        $cant = (float) $row->cantidad;
                        $prec = (float) $insumo->costo_unitario;
                        $falc = (float) ($row->factor_desperdicio ?? 1);
                        $parcial = round($cant * $prec * ($table === 'acu_materiales' ? $falc : 1), 10);

                        $updateData = [
                            $priceField => $prec,
                            'descripcion' => $insumo->descripcion,
                            'parcial' => $parcial,
                            'updated_at' => now(),
                        ];

                        if (! empty($insumo->codigo)) {
                            $updateData['cod_insumo'] = $insumo->codigo;
                            $updateData['codigo_producto'] = $insumo->codigo;
                        }

                        if (! empty($insumo->unidad)) {
                            $updateData['unidad'] = $insumo->unidad;
                        }

                        $connection->table($table)
                            ->where('id', $row->id)
                            ->update($updateData);
                    }
                }
            }

            $affectedAcuIds = array_unique($affectedAcuIds);
            if (empty($affectedAcuIds)) {
                return;
            }

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
                            'mano_de_obra' => json_encode($mo),
                            'materiales' => json_encode($ma),
                            'equipos' => json_encode($eq),
                            'subcontratos' => json_encode($sc),
                            'subpartidas' => json_encode($sp),
                            'costo_mano_obra' => $costoMo,
                            'costo_materiales' => $costoMa,
                            'costo_equipos' => $costoEq,
                            'costo_subcontratos' => $costoSc,
                            'costo_subpartidas' => $costoSp,
                            'updated_at' => now(),
                        ]);

                    $updatedPartidas[] = $acu->partida;
                }
            }

            // 3. Si hubo ACUs actualizados, sincronizar con presupuesto_general
            if (! empty($updatedPartidas)) {
                foreach (array_unique($updatedPartidas) as $partida) {
                    // Obtener el nuevo total del ACU (el trigger o columna calculada debería haberlo hecho ya)
                    $acuRes = $connection->table('presupuesto_acus')
                        ->where('presupuesto_id', $tenantPresupuestoId)
                        ->where('partida', $partida)
                        ->first();

                    if ($acuRes) {
                        // Match por código normalizado — presupuesto_acus.partida y
                        // presupuesto_general.partida pueden diferir en padding de ceros
                        // (ver normalizePartidaCode()); un WHERE exacto puede actualizar
                        // 0 filas y dejar precio_unitario desincronizado en silencio.
                        $normalizedPartida = $this->normalizePartidaCode($partida);
                        $generalRows = $connection->table('presupuesto_general')
                            ->where('presupuesto_id', $tenantPresupuestoId)
                            ->get(['id', 'partida']);
                        foreach ($generalRows as $generalRow) {
                            if ($this->normalizePartidaCode($generalRow->partida) === $normalizedPartida) {
                                $connection->table('presupuesto_general')
                                    ->where('id', $generalRow->id)
                                    ->update([
                                        'precio_unitario' => (float) ($acuRes->costo_unitario_total ?? 0),
                                        'updated_at' => now(),
                                    ]);
                            }
                        }
                    }
                }

                // 4. Recalcular costo directo total
                $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);
            }

        } catch (\Exception $e) {
            // Cuando esto se llama desde dentro de la transacción de calculateACU()
            // (PresupuestoController::calculateACU -> update_project_prices), un deadlock
            // aquí hace que InnoDB aborte TODA la transacción abierta, no solo este UPDATE.
            // Tragarnos el error en silencio dejaba a calculateACU() creyendo que la
            // transacción seguía viva: intentaba hacer commit() sobre una transacción ya
            // abortada por MySQL y fallaba con "There is no active transaction", un error
            // que el retry-loop de calculateACU no reconoce como deadlock y por tanto no
            // reintenta. Relanzar el deadlock deja que ese retry-loop lo maneje como
            // corresponde (reintentar la transacción completa).
            $concurrencyDetector = new ConcurrencyErrorDetector;
            if ($concurrencyDetector->causedByConcurrencyError($e)) {
                throw $e;
            }

            Log::error('Error propagating insumo update', [
                'insumo_id' => $insumo->id ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
