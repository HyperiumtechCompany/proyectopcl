<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use App\Services\GGFijoDesagregadoService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class PresupuestoController extends Controller
{
    /**
     * Cache por-request de existencia de columnas en DB tenant.
     *
     * @var array<string, bool>
     */
    private array $tenantColumnCache = [];

    /**
     * Mapping: subsection → tenant table name
     */
    private const SUBSECTION_TABLE_MAP = [
        'general' => 'presupuesto_general',
        'acus' => 'presupuesto_acus',
        'consolidado' => 'gg_consolidado',
        'gastos_generales' => 'gg_variables',
        'gastos_fijos' => 'gg_fijos',
        'supervision' => 'gg_supervision',
        'control_concurrente' => 'gg_control_concurrente',
        'remuneraciones' => 'presupuesto_remuneraciones',
        'insumos' => 'presupuesto_insumos',
        'indices' => 'presupuesto_indices',
    ];

    /**
     * Labels for each subsection
     */
    private const SUBSECTION_LABELS = [
        'general' => 'Presupuesto General',
        'acus' => 'ACUs',
        'consolidado' => 'Consolidado',
        'gastos_generales' => 'Gastos Generales',
        'gastos_fijos' => 'Gastos Fijos',
        'supervision' => 'Supervisión',
        'control_concurrente' => 'Control Concurrente',
        'remuneraciones' => 'Remuneraciones',
        'insumos' => 'Insumos',
        'indices' => 'Fórmula Polinómica',
    ];

    public function __construct(
        protected CostoDatabaseService $dbService,
        protected GGFijoDesagregadoService $desagregadoService
    ) {}

    /**
     * Muestra la vista principal del módulo presupuesto
     * Ruta: GET /costos/proyectos/{project}/presupuesto/{subsection?}
     */
    public function index(CostoProject $project, string $subsection = 'general'): Response
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);
        $this->validateSubsection($subsection);

        $tableName = self::SUBSECTION_TABLE_MAP[$subsection];

        // Read rows from the tenant DB
        $rows = $this->getOrderedRows($tableName)
            ->map(fn($row) => (array)$row)
            ->toArray();

        // Get centralized project params from tenant DB
        $projectParams = $this->dbService->getProjectParams($project->database_name);

        return Inertia::render('costos/presupuesto/Index', [
            'project' => [
                'id' => $project->id,
                'nombre' => $project->nombre,
                'fecha_inicio' => $project->fecha_inicio?->format('Y-m-d'),
                'fecha_fin' => $project->fecha_fin?->format('Y-m-d'),
            ],
            'projectParams' => $projectParams ? (array)$projectParams : null,
            'subsection' => $subsection,
            'subsectionLabel' => self::SUBSECTION_LABELS[$subsection],
            'tableName' => $tableName,
            'rows' => $rows,
            'availableSubsections' => $this->getAvailableSubsections(),
            'availableMetrados' => $this->getAvailableMetrados($project),
        ]);
    }

    /**
     * Obtiene datos de una sub-sección específica
     * Ruta: GET /costos/proyectos/{project}/presupuesto/{subsection}/data
     */
    public function show(CostoProject $project, string $subsection): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);
        $this->validateSubsection($subsection);

        $tableName = self::SUBSECTION_TABLE_MAP[$subsection];

        $rows = $this->getOrderedRows($tableName)
            ->map(fn($row) => (array)$row)
            ->toArray();

        return response()->json([
            'success' => true,
            'subsection' => $subsection,
            'rows' => $rows,
        ]);
    }

    /**
     * Actualiza datos de una sub-sección
     * Ruta: PATCH /costos/proyectos/{project}/presupuesto/{subsection}
     */
    public function update(
        CostoProject $project,
        string $subsection,
        Request $request
    ): JsonResponse {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);
        $this->validateSubsection($subsection);

        $tableName = self::SUBSECTION_TABLE_MAP[$subsection];
        $rows = $request->input('rows', []);

        // Validate input data based on subsection type
        $validationErrors = $this->validateRowsForSubsection($subsection, $rows);
        if (!empty($validationErrors)) {
            return response()->json([
                'success' => false,
                'errors' => $validationErrors,
            ], 422);
        }

        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
        $connection->beginTransaction();

        try {
            // Strategy: clear + re-insert (simple for spreadsheet-like data)
            $connection->table($tableName)->delete();

            $idMapping = []; // Maps client-side IDs to new database IDs

            foreach ($rows as $index => $row) {
                $oldId = $row['id'] ?? null;
                
                // Clean and prepare row data
                $cleanedRow = $this->prepareRowForSubsection($subsection, $row, $index, $project, $tenantPresupuestoId);

                // Remap parent_id if it exists in our mapping
                $originalParentId = $row['parent_id'] ?? null;
                if (!is_null($originalParentId)) {
                    if (isset($idMapping[$originalParentId])) {
                        $cleanedRow['parent_id'] = $idMapping[$originalParentId];
                    } else {
                        // Crucial: If the parent hasn't been inserted yet or was deleted, 
                        // set to null to avoid FK violation (500 Error)
                        $cleanedRow['parent_id'] = null;
                        
                        // Log for debugging if needed
                        // Log::debug("PresupuestoController: Parent ID {$originalParentId} not found in mapping - set to NULL");
                    }
                }

                // Insert and capture new ID
                $newId = $connection->table($tableName)->insertGetId($cleanedRow);

                // Store mapping for children that might follow
                if ($oldId) {
                    $idMapping[$oldId] = $newId;
                }

                // Sincronización automática con GG Variables
                if ($subsection === 'remuneraciones' && !empty($cleanedRow['gg_variable_id'])) {
                    // Si viene con un ID de variable de la tabla temporal de remapeo, lo usamos
                    $varId = $cleanedRow['gg_variable_id'];
                    if (isset($idMapping[$varId])) {
                        $varId = $idMapping[$varId];
                    }

                    $totalUnitario = ($cleanedRow['sueldo_basico'] ?? 0) +
                        ($cleanedRow['asignacion_familiar'] ?? 0) +
                        ($cleanedRow['essalud'] ?? 0) +
                        ($cleanedRow['cts'] ?? 0) +
                        ($cleanedRow['vacaciones'] ?? 0) +
                        ($cleanedRow['gratificacion'] ?? 0);

                    $connection->table('gg_variables')
                        ->where('id', $varId)
                        ->update([
                            'precio' => $totalUnitario,
                            'cantidad_descripcion' => $cleanedRow['cantidad'] ?? 1,
                            'cantidad_tiempo' => $cleanedRow['meses'] ?? 1,
                            'participacion' => $cleanedRow['participacion'] ?? 100,
                        ]);
                }
            }

            $connection->commit();

            // Sincronización automática de totales si es presupuesto general
            if ($subsection === 'general') {
                $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);
            }

            // Recalcular consolidado en backend para evitar circularidad y cachear totales
            if (in_array($subsection, ['general', 'gastos_fijos', 'gastos_generales', 'supervision', 'control_concurrente'], true)) {
                $this->recalculateConsolidadoSnapshot($project, null);
            }

            // Fetch updated data to return
            $updatedRows = $this->getOrderedRows($tableName)
                ->map(fn($row) => (array)$row)
                ->toArray();

            return response()->json([
                'success' => true,
                'count' => count($rows),
                'rows' => $updatedRows,
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error("Error saving presupuesto data", [
                'subsection' => $subsection,
                'project' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Devuelve el snapshot consolidado (cálculo cacheado).
     * Ruta: GET /costos/proyectos/{project}/presupuesto/consolidado/snapshot
     */
    public function getConsolidadoSnapshot(CostoProject $project): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        try {
            $row = $this->recalculateConsolidadoSnapshot($project, null);
        } catch (\Throwable $e) {
            Log::error('Error recalculating consolidado snapshot', [
                'project' => $project->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'error' => 'No se pudo calcular el consolidado',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data' => $row,
        ]);
    }

    /**
     * Guarda inputs del consolidado y recalcula.
     * Ruta: PATCH /costos/proyectos/{project}/presupuesto/consolidado/snapshot
     */
    public function saveConsolidadoSnapshot(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $inputs = [
            'utilidad_porcentaje' => $request->input('utilidad_porcentaje'),
            'igv_porcentaje' => $request->input('igv_porcentaje'),
            'componente_ii_monto' => $request->input('componente_ii_monto'),
            'componentes_extra' => $request->input('componentes_extra'),
        ];

        try {
            $row = $this->recalculateConsolidadoSnapshot($project, $inputs);
        } catch (\Throwable $e) {
            Log::error('Error saving consolidado snapshot', [
                'project' => $project->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'error' => 'No se pudo guardar el consolidado',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data' => $row,
        ]);
    }

    /**
     * Recalcula el consolidado y lo persiste en gg_consolidado.
     */
    private function recalculateConsolidadoSnapshot(CostoProject $project, ?array $inputs): array
    {
        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        $existing = $connection->table('gg_consolidado')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->first();

        $projectParams = $connection->table('project_params')->first();

        $utilidadPct = $inputs['utilidad_porcentaje'] ?? ($existing->utilidad_porcentaje ?? ($projectParams->utilidad_porcentaje ?? 5));
        $igvPct = $inputs['igv_porcentaje'] ?? ($existing->igv_porcentaje ?? ($projectParams->igv_porcentaje ?? 18));
        $componenteIIMonto = $inputs['componente_ii_monto'] ?? ($existing->componente_ii_monto ?? 0);

        $extraComponents = $inputs['componentes_extra'] ?? null;
        if ($extraComponents === null) {
            $extraComponents = $existing->componentes_extra_json ?? '[]';
            $extraComponents = is_string($extraComponents) ? json_decode($extraComponents, true) : $extraComponents;
        }
        if (!is_array($extraComponents)) {
            $extraComponents = [];
        }

        $costoDirecto = (float) $connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->sum('parcial');

        $ggFijosTotal = (float) $connection->table('gg_fijos')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->where('tipo_fila', 'detalle')
            ->sum('parcial');

        $ggVariablesTotal = (float) $connection->table('gg_variables')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->where('tipo_fila', 'detalle')
            ->sum('parcial');

        $supervisionRow = $connection->table('gg_supervision')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->where('item_codigo', 'VIII')
            ->orderBy('id', 'desc')
            ->first();
        $supervisionTotal = $supervisionRow
            ? (float) ($supervisionRow->subtotal ?? 0)
            : (float) $connection->table('gg_supervision')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->where('tipo_fila', 'detalle')
                ->sum('subtotal');

        $controlConcurrenteTotal = (float) $connection->table('gg_control_concurrente')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->where('tipo_fila', 'detalle')
            ->sum('sub_total');

        $totalGastosGenerales = $ggFijosTotal + $ggVariablesTotal;
        $utilidadTotal = $costoDirecto * ($utilidadPct / 100);
        $subTotalPresupuesto = $costoDirecto + $totalGastosGenerales + $utilidadTotal;
        $igvComponenteI = $subTotalPresupuesto * ($igvPct / 100);
        $subTotalComponenteI = $subTotalPresupuesto + $igvComponenteI;

        $componenteIIMontoNum = (float) $componenteIIMonto;
        $igvComponenteII = $componenteIIMontoNum * ($igvPct / 100);
        $subTotalComponenteII = $componenteIIMontoNum + $igvComponenteII;

        $extraTotal = 0.0;
        foreach ($extraComponents as $comp) {
            $monto = (float) ($comp['monto'] ?? 0);
            $extraTotal += $monto + ($monto * ($igvPct / 100));
        }

        $totalComponents = $subTotalComponenteI + $subTotalComponenteII + $extraTotal;
        $totalConsolidado = $totalComponents + $supervisionTotal;
        $controlConcurrenteFinanciado = $totalConsolidado * 0.02;
        $totalInversionObra = $totalConsolidado + $controlConcurrenteFinanciado;

        $payload = [
            'presupuesto_id' => $tenantPresupuestoId,
            'total_costo_directo' => round($costoDirecto, 4),
            'total_gg_fijos' => round($ggFijosTotal, 4),
            'total_gg_variables' => round($ggVariablesTotal, 4),
            'total_supervision' => round($supervisionTotal, 4),
            'total_control_concurrente' => round($controlConcurrenteTotal, 4),

            'utilidad_porcentaje' => round((float) $utilidadPct, 4),
            'igv_porcentaje' => round((float) $igvPct, 4),
            'componente_ii_monto' => round($componenteIIMontoNum, 4),
            'componentes_extra_json' => json_encode($extraComponents),

            'comp_i_costo_directo' => round($costoDirecto, 4),
            'comp_i_porcentaje' => 100.0000,
            'comp_ii_gastos_generales' => round($totalGastosGenerales, 4),
            'comp_ii_porcentaje' => $costoDirecto > 0 ? round(($totalGastosGenerales / $costoDirecto) * 100, 4) : 0,
            'comp_iii_utilidad' => round($utilidadTotal, 4),
            'comp_iii_porcentaje' => round((float) $utilidadPct, 4),
            'comp_iv_subtotal_sin_igv' => round($subTotalPresupuesto, 4),
            'comp_iv_porcentaje' => 100.0000,
            'comp_v_igv' => round($igvComponenteI, 4),
            'comp_v_porcentaje' => round((float) $igvPct, 4),
            'comp_vi_valor_con_igv' => round($subTotalComponenteI, 4),
            'comp_vi_porcentaje' => 100.0000,

            'total_presupuesto_obra' => round($totalComponents, 4),
            'total_con_igv' => round($subTotalComponenteI, 4),
            'total_inversion_obra' => round($totalInversionObra, 4),

            'total_letras' => $this->amountToWords($totalConsolidado),
            'total_inversion_obra_letras' => $this->amountToWords($totalInversionObra),
            'porcentaje_gg_sobre_cd' => $costoDirecto > 0 ? round($totalGastosGenerales / $costoDirecto, 4) : 0,
            'porcentaje_supervision_sobre_cd' => $costoDirecto > 0 ? round($supervisionTotal / $costoDirecto, 4) : 0,
            'calculado_at' => now(),
            'updated_at' => now(),
        ];

        // Filtrar payload a columnas reales (tenants pueden no tener nuevas columnas)
        $realColumns = Schema::connection('costos_tenant')->getColumnListing('gg_consolidado');
        $filteredPayload = collect($payload)
            ->filter(fn($val, $key) => in_array($key, $realColumns, true))
            ->toArray();

        if ($existing) {
            $connection->table('gg_consolidado')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update($filteredPayload);
        } else {
            $filteredPayload['created_at'] = now();
            $connection->table('gg_consolidado')->insert($filteredPayload);
        }

        return $filteredPayload + ['presupuesto_id' => $tenantPresupuestoId];
    }

    private function numberToWordsES(int $n): string
    {
        $ones = [
            '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
            'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
            'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES',
            'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
        ];
        $tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        $hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        if ($n === 0) return '';
        if ($n === 100) return 'CIEN';
        if ($n < 30) return $ones[$n];
        if ($n < 100) {
            $t = intdiv($n, 10);
            $o = $n % 10;
            return $tens[$t] . ($o ? ' Y ' . $ones[$o] : '');
        }
        $h = intdiv($n, 100);
        $rem = $n % 100;
        return $hundreds[$h] . ($rem ? ' ' . $this->numberToWordsES($rem) : '');
    }

    private function amountToWords(float $amount): string
    {
        $intPart = (int) floor($amount);
        $decPart = (int) round(($amount - $intPart) * 100);

        if ($intPart === 0) {
            $words = 'CERO';
        } else {
            $words = '';
            $rem = $intPart;
            if ($rem >= 1000000) {
                $m = intdiv($rem, 1000000);
                $words .= ($m === 1 ? 'UN MILLON' : $this->numberToWordsES($m) . ' MILLONES') . ' ';
                $rem = $rem % 1000000;
            }
            if ($rem >= 1000) {
                $k = intdiv($rem, 1000);
                $words .= ($k === 1 ? 'MIL' : $this->numberToWordsES($k) . ' MIL') . ' ';
                $rem = $rem % 1000;
            }
            if ($rem > 0) {
                $words .= $this->numberToWordsES($rem);
            }
            $words = trim($words);
        }

        return 'SON: ' . $words . ' CON ' . str_pad((string) $decPart, 2, '0', STR_PAD_LEFT) . '/100 SOLES';
    }

    /**
     * Importa estructura de partidas desde metrado
     * Ruta: POST /costos/proyectos/{project}/presupuesto/import-metrado
     */
    public function importFromMetrado(
        CostoProject $project,
        Request $request
    ): JsonResponse {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        // Validate request
        $validated = $request->validate([
            'metrado_type' => 'required|string|in:metrado_arquitectura,metrado_estructura,metrado_sanitarias,metrado_electricas,metrado_comunicaciones,metrado_gas',
        ]);

        $metradoType = $validated['metrado_type'];

        // Validate that the requested metrado module is enabled
        if (!$project->hasModule($metradoType)) {
            return response()->json([
                'success' => false,
                'message' => "El módulo {$metradoType} no está habilitado en este proyecto.",
            ], 422);
        }

        DB::connection('costos_tenant')->beginTransaction();

        try {
            // Special handling for sanitarias: read from resumen table
            if ($metradoType === 'metrado_sanitarias') {
                $metradoQuery = DB::connection('costos_tenant')
                    ->table('metrado_sanitarias_resumen')
                    ->select('partida', 'descripcion', 'unidad', 'total_general as total')
                    ->whereNotNull('partida')
                    ->where('partida', '!=', '')
                    ->orderBy('item_order')
                    ->orderBy('id');
            } else {
                // Query the metrado table for partida structure
                $metradoQuery = DB::connection('costos_tenant')
                    ->table($metradoType)
                    ->select('partida', 'descripcion', 'unidad', 'total')
                    ->whereNotNull('partida')
                    ->where('partida', '!=', '');
                if ($this->hasTenantColumn($metradoType, 'item_order')) {
                    $metradoQuery->orderBy('item_order');
                }
                if ($this->hasTenantColumn($metradoType, 'id')) {
                    $metradoQuery->orderBy('id');
                }
            }
            $metradoRows = $metradoQuery->get();

            $createdCount = 0;
            $updatedCount = 0;

            foreach ($metradoRows as $metradoRow) {
                // Check if partida already exists in presupuesto_general
                $existingPartida = DB::connection('costos_tenant')
                    ->table('presupuesto_general')
                    ->where('partida', $metradoRow->partida)
                    ->first();

                if ($existingPartida) {
                    // Update only metrado field, preserve prices
                    DB::connection('costos_tenant')
                        ->table('presupuesto_general')
                        ->where('partida', $metradoRow->partida)
                        ->update([
                            'metrado' => $metradoRow->total,
                            'metrado_source' => $metradoType,
                            'updated_at' => now(),
                        ]);
                    $updatedCount++;
                } else {
                    // Create new partida
                    $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
                    $insertData = [
                        'presupuesto_id' => $tenantPresupuestoId,
                        'partida' => $metradoRow->partida,
                        'descripcion' => $metradoRow->descripcion ?? '',
                        'unidad' => $metradoRow->unidad ?? '',
                        'metrado' => $metradoRow->total,
                        'precio_unitario' => 0,
                        'metrado_source' => $metradoType,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    if ($this->hasTenantColumn('presupuesto_general', 'item_order')) {
                        $insertData['item_order'] = 0;
                    }

                    DB::connection('costos_tenant')
                        ->table('presupuesto_general')
                        ->insert($insertData);
                    $createdCount++;
                }
            }

            DB::connection('costos_tenant')->commit();

            // Sincronizar totales tras importación
            $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
            $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);

            return response()->json([
                'success' => true,
                'message' => 'Importación completada exitosamente',
                'summary' => [
                    'created' => $createdCount,
                    'updated' => $updatedCount,
                    'total' => $createdCount + $updatedCount,
                ],
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error("Error importing metrado", [
                'metrado_type' => $metradoType,
                'project' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al importar metrado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Importa estructura de partidas desde múltiples metrados secuencialmente
     * Ruta: POST /costos/proyectos/{project}/presupuesto/import-batch-metrados
     */
    public function importBatchFromMetrados(
        CostoProject $project,
        Request $request
    ): JsonResponse {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        // Validate request
        $validated = $request->validate([
            'metrados' => 'required|array|min:1',
            'metrados.*' => 'required|string|in:metrado_arquitectura,metrado_estructura,metrado_sanitarias,metrado_electricas,metrado_comunicaciones,metrado_gas',
        ]);

        $metradosList = $validated['metrados'];

        // Validate that all requested metrado modules are enabled
        foreach ($metradosList as $metradoType) {
            if (!$project->hasModule($metradoType)) {
                return response()->json([
                    'success' => false,
                    'message' => "El módulo {$metradoType} no está habilitado en este proyecto.",
                ], 422);
            }
        }

        DB::connection('costos_tenant')->beginTransaction();

        try {
            $createdCount = 0;
            $updatedCount = 0;
            $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
            $hasItemOrder = $this->hasTenantColumn('presupuesto_general', 'item_order');

            foreach ($metradosList as $metradoType) {
                // Special handling for sanitarias: read from resumen table
                if ($metradoType === 'metrado_sanitarias') {
                    $metradoQuery = DB::connection('costos_tenant')
                        ->table('metrado_sanitarias_resumen')
                        ->select('partida', 'descripcion', 'unidad', 'total_general as total')
                        ->whereNotNull('partida')
                        ->where('partida', '!=', '')
                        ->orderBy('item_order')
                        ->orderBy('id');
                } else {
                    // Query the metrado table for partida structure
                    $metradoQuery = DB::connection('costos_tenant')
                        ->table($metradoType)
                        ->select('partida', 'descripcion', 'unidad', 'total')
                        ->whereNotNull('partida')
                        ->where('partida', '!=', '');
                    if ($this->hasTenantColumn($metradoType, 'item_order')) {
                        $metradoQuery->orderBy('item_order');
                    }
                    if ($this->hasTenantColumn($metradoType, 'id')) {
                        $metradoQuery->orderBy('id');
                    }
                }
                $metradoRows = $metradoQuery->get();

                foreach ($metradoRows as $metradoRow) {
                    // Check if partida already exists in presupuesto_general
                    $existingPartida = DB::connection('costos_tenant')
                        ->table('presupuesto_general')
                        ->where('partida', $metradoRow->partida)
                        ->first();

                    if ($existingPartida) {
                        // Update only metrado field, preserve prices
                        DB::connection('costos_tenant')
                            ->table('presupuesto_general')
                            ->where('partida', $metradoRow->partida)
                            ->update([
                                'metrado' => $metradoRow->total,
                                'metrado_source' => $metradoType,
                                'updated_at' => now(),
                            ]);
                        $updatedCount++;
                    } else {
                        // Create new partida
                        $insertData = [
                            'presupuesto_id' => $tenantPresupuestoId,
                            'partida' => $metradoRow->partida,
                            'descripcion' => $metradoRow->descripcion ?? '',
                            'unidad' => $metradoRow->unidad ?? '',
                            'metrado' => $metradoRow->total,
                            'precio_unitario' => 0,
                            'metrado_source' => $metradoType,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                        if ($hasItemOrder) {
                            $insertData['item_order'] = 0;
                        }

                        DB::connection('costos_tenant')
                            ->table('presupuesto_general')
                            ->insert($insertData);
                        $createdCount++;
                    }
                }
            }

            DB::connection('costos_tenant')->commit();

            // Sincronizar totales tras importación
            $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);

            return response()->json([
                'success' => true,
                'message' => 'Importación por lotes completada exitosamente',
                'summary' => [
                    'created' => $createdCount,
                    'updated' => $updatedCount,
                    'total' => $createdCount + $updatedCount,
                ],
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error("Error batch importing metrados", [
                'metrados' => $metradosList,
                'project' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al importar metrados: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calcula o recalcula un ACU específico
     * Ruta: POST /costos/proyectos/{project}/presupuesto/acus/calculate
     */
    public function calculateACU(
        CostoProject $project,
        Request $request
    ): JsonResponse {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        // Ensure tenant schema has required ACU columns (for legacy tenant DBs)
        $this->ensureAcuSchema();

        // Validate request data
        $validated = $request->validate([
            'id' => 'nullable|integer',
            'partida' => 'required|string|max:50',
            'descripcion' => 'required|string',
            'unidad' => 'required|string|max:20',
            'rendimiento' => 'required|numeric|min:0.0001',
            'mano_de_obra' => 'nullable|array',
            'mano_de_obra.*.descripcion' => 'required|string',
            'mano_de_obra.*.unidad' => 'required|string|max:20',
            'mano_de_obra.*.cantidad' => 'required|numeric|min:0',
            'mano_de_obra.*.recursos' => 'nullable|numeric|min:0',
            'mano_de_obra.*.precio_unitario' => 'required|numeric|min:0',
            'materiales' => 'nullable|array',
            'materiales.*.descripcion' => 'required|string',
            'materiales.*.unidad' => 'required|string|max:20',
            'materiales.*.cantidad' => 'required|numeric|min:0',
            'materiales.*.precio_unitario' => 'required|numeric|min:0',
            'materiales.*.factor_desperdicio' => 'nullable|numeric|min:1',
            'equipos' => 'nullable|array',
            'equipos.*.descripcion' => 'required|string',
            'equipos.*.unidad' => 'required|string|max:20',
            'equipos.*.cantidad' => 'required|numeric|min:0',
            'equipos.*.recursos' => 'nullable|numeric|min:0',
            'equipos.*.precio_hora' => 'required|numeric|min:0',
            'subcontratos' => 'nullable|array',
            'subcontratos.*.descripcion' => 'required|string',
            'subcontratos.*.unidad' => 'required|string|max:20',
            'subcontratos.*.cantidad' => 'required|numeric|min:0',
            'subcontratos.*.precio_unitario' => 'required|numeric|min:0',
            'subpartidas' => 'nullable|array',
            'subpartidas.*.descripcion' => 'required|string',
            'subpartidas.*.unidad' => 'required|string|max:20',
            'subpartidas.*.cantidad' => 'required|numeric|min:0',
            'subpartidas.*.precio_unitario' => 'required|numeric|min:0',
        ]);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            $rendimiento = $validated['rendimiento'];

            // Calculate mano de obra costs
            $manoDeObra = $validated['mano_de_obra'] ?? [];
            $costoManoObra = 0;
            foreach ($manoDeObra as &$componente) {
                // Formula: cantidad * precio_unitario
                $parcial = $componente['cantidad'] * $componente['precio_unitario'];
                $componente['parcial'] = round($parcial, 2);
                $costoManoObra += $componente['parcial'];
            }
            $costoManoObra = round($costoManoObra, 2);

            // Calculate materiales costs
            $materiales = $validated['materiales'] ?? [];
            $costoMateriales = 0;
            foreach ($materiales as &$componente) {
                // Formula: cantidad * precio_unitario * factor_desperdicio
                $factorDesperdicio = $componente['factor_desperdicio'] ?? 1.0;
                $parcial = $componente['cantidad'] * $componente['precio_unitario'] * $factorDesperdicio;
                $componente['parcial'] = round($parcial, 2);
                $costoMateriales += $componente['parcial'];
            }
            $costoMateriales = round($costoMateriales, 2);

            // Calculate equipos costs
            $equipos = $validated['equipos'] ?? [];
            $costoEquipos = 0;
            foreach ($equipos as &$componente) {
                $descripcion = strtolower((string)($componente['descripcion'] ?? ''));
                $isHerramientas = str_contains($descripcion, 'herramienta');

                if ($isHerramientas) {
                    // Herramientas: porcentaje de mano de obra
                    $precioBase = $costoManoObra;
                    $porcentaje = $componente['cantidad'] ?? 0;
                    $parcial = $precioBase * ($porcentaje / 100);
                    $componente['precio_hora'] = $precioBase;
                    $componente['parcial'] = round($parcial, 2);
                } else {
                    // Formula: cantidad * precio_hora
                    $parcial = $componente['cantidad'] * $componente['precio_hora'];
                    $componente['parcial'] = round($parcial, 2);
                }

                $costoEquipos += $componente['parcial'];
            }
            $costoEquipos = round($costoEquipos, 2);

            // Calculate subcontratos costs
            $subcontratos = $validated['subcontratos'] ?? [];
            $costoSubcontratos = 0;
            foreach ($subcontratos as &$componente) {
                // Formula: cantidad * precio_unitario
                $parcial = $componente['cantidad'] * $componente['precio_unitario'];
                $componente['parcial'] = round($parcial, 2);
                $costoSubcontratos += $componente['parcial'];
            }
            $costoSubcontratos = round($costoSubcontratos, 2);

            // Calculate subpartidas costs
            $subpartidas = $validated['subpartidas'] ?? [];
            $costoSubpartidas = 0;
            foreach ($subpartidas as &$componente) {
                // Formula: cantidad * precio_unitario
                $parcial = $componente['cantidad'] * $componente['precio_unitario'];
                $componente['parcial'] = round($parcial, 2);
                $costoSubpartidas += $componente['parcial'];
            }
            $costoSubpartidas = round($costoSubpartidas, 2);

            // Prepare data for database
            $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
            $acuData = [
                'presupuesto_id' => $tenantPresupuestoId,
                'partida' => $validated['partida'],
                'descripcion' => $validated['descripcion'],
                'unidad' => $validated['unidad'],
                'rendimiento' => $rendimiento,
                'mano_de_obra' => !empty($manoDeObra) ? json_encode($manoDeObra) : null,
                'costo_mano_obra' => $costoManoObra,
                'materiales' => !empty($materiales) ? json_encode($materiales) : null,
                'costo_materiales' => $costoMateriales,
                'equipos' => !empty($equipos) ? json_encode($equipos) : null,
                'costo_equipos' => $costoEquipos,
                'subcontratos' => !empty($subcontratos) ? json_encode($subcontratos) : null,
                'costo_subcontratos' => $costoSubcontratos,
                'subpartidas' => !empty($subpartidas) ? json_encode($subpartidas) : null,
                'costo_subpartidas' => $costoSubpartidas,
                'updated_at' => now(),
            ];

            // Update or insert ACU
            if (!empty($validated['id'])) {
                // Update existing ACU
                DB::connection('costos_tenant')
                    ->table('presupuesto_acus')
                    ->where('id', $validated['id'])
                    ->update($acuData);

                $acuId = $validated['id'];
            } else {
                // Insert new ACU
                $acuData['created_at'] = now();
                if ($this->hasTenantColumn('presupuesto_acus', 'item_order')) {
                    $acuData['item_order'] = 0;
                }

                $acuId = DB::connection('costos_tenant')
                    ->table('presupuesto_acus')
                    ->insertGetId($acuData);
            }

            // Fetch the complete ACU with calculated total
            $calculatedAcu = DB::connection('costos_tenant')
                ->table('presupuesto_acus')
                ->where('id', $acuId)
                ->first();

            // Decode JSON fields for response
            $acuArray = (array)$calculatedAcu;
            $acuArray['mano_de_obra'] = $acuArray['mano_de_obra'] ? json_decode($acuArray['mano_de_obra'], true) : [];
            $acuArray['materiales'] = $acuArray['materiales'] ? json_decode($acuArray['materiales'], true) : [];
            $acuArray['equipos'] = $acuArray['equipos'] ? json_decode($acuArray['equipos'], true) : [];
            $acuArray['subcontratos'] = $acuArray['subcontratos'] ? json_decode($acuArray['subcontratos'], true) : [];
            $acuArray['subpartidas'] = $acuArray['subpartidas'] ? json_decode($acuArray['subpartidas'], true) : [];

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'success' => true,
                'message' => 'ACU calculado exitosamente',
                'acu' => $acuArray,
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error("Error calculating ACU", [
                'project' => $project->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al calcular ACU: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtiene datos de un desagregado de G.G. Fijos
     * Ruta: GET /costos/proyectos/{project}/presupuesto/gastos-fijos/{ggFijoId}/desagregado
     */
    public function getGGFijoDesagregado(CostoProject $project, int $ggFijoId, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $tipoCalculo = $request->query('tipo_calculo');
        $connection = DB::connection('costos_tenant');

        if (!$tipoCalculo || $tipoCalculo === 'manual') {
            return response()->json(['success' => true, 'data' => null]);
        }

        if (str_starts_with($tipoCalculo, 'fianza_')) {
            $tableName = 'gg_fijos_fianzas';
            $field = 'tipo_fianza';
            $value = match ($tipoCalculo) {
                'fianza_fiel_cumplimiento' => 'fiel_cumplimiento',
                'fianza_adelanto_efectivo' => 'adelanto_efectivo',
                'fianza_adelanto_materiales' => 'adelanto_materiales',
                default => 'fiel_cumplimiento',
            };
        } else {
            $tableName = 'gg_fijos_polizas';
            $field = 'tipo_poliza';
            $value = match ($tipoCalculo) {
                'poliza_car' => 'car',
                'poliza_sctr' => 'sctr_salud', // Default to salud for Polizas table
                'poliza_essalud_vida' => 'essalud_vida',
                'sencico' => 'sencico',
                'itf' => 'itf',
                default => $tipoCalculo,
            };
        }

        $rows = $connection->table($tableName)
            ->where('gg_fijos_id', $ggFijoId)
            ->where($field, $value)
            ->orderBy('item_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    /**
     * Guarda datos de un desagregado de G.G. Fijos
     * Ruta: POST /costos/proyectos/{project}/presupuesto/gastos-fijos/{ggFijoId}/desagregado
     */
    public function saveGGFijoDesagregado(CostoProject $project, int $ggFijoId, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $tipoCalculo = $request->input('tipo_calculo');
        $data = $request->input('data', []);
        
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
        $data['presupuesto_id'] = $tenantPresupuestoId;

        $result = $this->desagregadoService->calculateAndSave(
            $project->database_name,
            $ggFijoId,
            $tipoCalculo,
            $data
        );

        return response()->json($result);
    }

    /**
     * Obtiene datos de un desagregado de G.G. Fijos global (sin id de gg_fijos)
     * Ruta: GET /costos/proyectos/{project}/presupuesto/gastos-fijos-global/desagregado
     */
    public function getGGFijoDesagregadoGlobal(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $tipoCalculo = $request->query('tipo_calculo');
        $connection = DB::connection('costos_tenant');

        if (!$tipoCalculo || $tipoCalculo === 'manual') {
            return response()->json(['success' => true, 'data' => []]);
        }

        if (str_starts_with($tipoCalculo, 'fianza_')) {
            $tableName = 'gg_fijos_fianzas';
            $field = 'tipo_fianza';
            $value = match ($tipoCalculo) {
                'fianza_fiel_cumplimiento' => 'fiel_cumplimiento',
                'fianza_adelanto_efectivo' => 'adelanto_efectivo',
                'fianza_adelanto_materiales' => 'adelanto_materiales',
                default => 'fiel_cumplimiento',
            };
        } else {
            $tableName = 'gg_fijos_polizas';
            $field = 'tipo_poliza';
            $value = match ($tipoCalculo) {
                'poliza_car' => 'car',
                'poliza_sctr' => 'sctr_salud',
                'poliza_essalud_vida' => 'essalud_vida',
                'sencico' => 'sencico',
                'itf' => 'itf',
                default => $tipoCalculo,
            };
        }

        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        $query = $connection->table($tableName)
            ->where('presupuesto_id', $tenantPresupuestoId);
            
        if ($value === 'sctr_salud') {
            $query->whereIn($field, ['sctr_salud', 'sctr_pension']);
        } else {
            $query->where($field, $value);
        }

        $rows = $query->orderBy('item_order')->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    /**
     * Guarda datos de un desagregado de G.G. Fijos global
     * Ruta: POST /costos/proyectos/{project}/presupuesto/gastos-fijos-global/desagregado
     */
    public function saveGGFijoDesagregadoGlobal(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $tipoCalculo = $request->input('tipo_calculo');
        $data = $request->input('data', []);
        
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
        
        // Ensure each row has presupuesto_id
        if (is_array($data)) {
            // Is it an array of associative arrays (multiple rows)?
            if (!empty($data) && isset($data[0]) && is_array($data[0])) {
                foreach ($data as &$row) {
                    $row['presupuesto_id'] = $tenantPresupuestoId;
                }
            } else {
                // It is a single associative array
                $data['presupuesto_id'] = $tenantPresupuestoId;
            }
        }

        $result = $this->desagregadoService->calculateAndSave(
            $project->database_name,
            null, // ggFijoId is null since it's global
            $tipoCalculo,
            $data
        );

        return response()->json($result);
    }

    /**
     * Obtiene los totales de GG Fijos global para sincronizar con el store de GG Fijos.
     * Ruta: GET /costos/proyectos/{project}/presupuesto/gastos-fijos-global/totals
     */
    public function getGGFijosTotals(CostoProject $project): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        $totals = [];

        // Get totals from gg_fijos_fianzas
        $fianzaTotals = $connection->table('gg_fijos_fianzas')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->select('tipo_fianza', DB::raw('SUM(garantia_fc_sin_igv) as total'))
            ->groupBy('tipo_fianza')
            ->get();

        foreach ($fianzaTotals as $row) {
            $key = 'fianza_' . $row->tipo_fianza;
            $totals[$key] = (float) $row->total;
        }

        // Get totals from gg_fijos_polizas
        $polizaTotals = $connection->table('gg_fijos_polizas')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->select('tipo_poliza', DB::raw('SUM(poliza_sin_igv) as total'))
            ->groupBy('tipo_poliza')
            ->get();

        foreach ($polizaTotals as $row) {
            $tipo = $row->tipo_poliza;
            $rowTotal = (float) $row->total;

            if (in_array($tipo, ['sctr_salud', 'sctr_pension'], true)) {
                $totals['poliza_sctr'] = ($totals['poliza_sctr'] ?? 0) + $rowTotal;
                continue;
            }

            if (in_array($tipo, ['sencico', 'itf'], true)) {
                $totals[$tipo] = ($totals[$tipo] ?? 0) + $rowTotal;
                continue;
            }

            $key = 'poliza_' . $tipo;
            $totals[$key] = ($totals[$key] ?? 0) + $rowTotal;
        }

        return response()->json([
            'success' => true,
            'totals' => $totals,
        ]);
    }

    /**
     * Obtiene los valores de GGF%, GGV% y Utilidad% para el cálculo de montoCG.
     * Ruta: GET /costos/proyectos/{project}/presupuesto/ggfijos-monto-cg
     */
    public function getGGFijosMontoCG(CostoProject $project): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        // Verificar si existen las columnas, si no, agregarlas
        $this->ensureColumnsExist($connection);

        $record = $connection->table('gg_consolidado')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'ggf_porcentaje' => $record && isset($record->ggf_porcentaje) ? (float) $record->ggf_porcentaje : 0,
                'ggv_porcentaje' => $record && isset($record->ggv_porcentaje) ? (float) $record->ggv_porcentaje : 0,
                'utilidad_porcentaje' => $record && isset($record->utilidad_porcentaje) ? (float) $record->utilidad_porcentaje : 10,
            ],
        ]);
    }

    /**
     * Guarda los valores de GGF%, GGV% y Utilidad% para el cálculo de montoCG.
     * Ruta: POST /costos/proyectos/{project}/presupuesto/ggfijos-monto-cg
     */
    public function saveGGFijosMontoCG(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $ggfPorcentaje = $request->input('ggf_porcentaje', 0);
        $ggvPorcentaje = $request->input('ggv_porcentaje', 0);
        $utilidadPorcentaje = $request->input('utilidad_porcentaje', 10);

        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        // Verificar si existen las columnas, si no, agregarlas
        $this->ensureColumnsExist($connection);

        // Upsert the record
        $connection->table('gg_consolidado')
            ->updateOrInsert(
                ['presupuesto_id' => $tenantPresupuestoId],
                [
                    'ggf_porcentaje' => $ggfPorcentaje,
                    'ggv_porcentaje' => $ggvPorcentaje,
                    'utilidad_porcentaje' => $utilidadPorcentaje,
                    'updated_at' => now(),
                ]
            );

        return response()->json([
            'success' => true,
            'data' => [
                'ggf_porcentaje' => $ggfPorcentaje,
                'ggv_porcentaje' => $ggvPorcentaje,
                'utilidad_porcentaje' => $utilidadPorcentaje,
            ],
        ]);
    }

    /**
     * Asegura que las columnas necesarias existan en la tabla gg_consolidado
     */
    private function ensureColumnsExist($connection): void
    {
        try {
            // Verificar si ggf_porcentaje existe
            $columns = $connection->getSchemaBuilder()->getColumnListing('gg_consolidado');
            if (!in_array('ggf_porcentaje', $columns)) {
                $connection->statement('ALTER TABLE gg_consolidado ADD COLUMN ggf_porcentaje DECIMAL(12,4) DEFAULT 0');
            }

            // Verificar si ggv_porcentaje existe
            $columns = $connection->getSchemaBuilder()->getColumnListing('gg_consolidado');
            if (!in_array('ggv_porcentaje', $columns)) {
                $connection->statement('ALTER TABLE gg_consolidado ADD COLUMN ggv_porcentaje DECIMAL(12,4) DEFAULT 0');
            }
        } catch (\Exception $e) {
            // Silently fail - columns might already exist
        }
    }

    /**
     * Obtiene los parámetros globales del proyecto desde el tenant DB.
     * Ruta: GET /costos/proyectos/{project}/presupuesto/params
     */
    public function getProjectParams(CostoProject $project): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $params = $this->dbService->getProjectParams($project->database_name);

        return response()->json([
            'success' => true,
            'data' => $params ? (array)$params : null,
        ]);
    }

    /**
     * Actualiza parámetros financieros globales del proyecto.
     * Ruta: PATCH /costos/proyectos/{project}/presupuesto/params
     *
     * Propaga automáticamente cambios a:
     * - gg_fijos_fianzas.base_calculo
     * - gg_fijos_polizas.base_calculo
     */
    public function updateProjectParams(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        $validated = $request->validate([
            'costo_directo'          => 'nullable|numeric|min:0',
            'utilidad_porcentaje'    => 'nullable|numeric|min:0|max:100',
            'igv_porcentaje'         => 'nullable|numeric|min:0|max:100',
            'jornada_laboral_horas'  => 'nullable|numeric|min:1|max:24',
            'rmv'                    => 'nullable|numeric|min:0',
        ]);

        $this->dbService->updateProjectFinancialParams(
            $project->database_name,
            array_filter($validated, fn($v) => $v !== null)
        );

        // Auto-propagate costo_directo to fianzas/polizas base_calculo
        if (isset($validated['costo_directo']) && $validated['costo_directo'] !== null) {
            $connection = DB::connection('costos_tenant');
            $costoDirecto = (float)$validated['costo_directo'];

            // Update base_calculo for all fianzas
            $connection->table('gg_fijos_fianzas')
                ->update(['base_calculo' => $costoDirecto]);

            // Update base_calculo for all polizas
            $connection->table('gg_fijos_polizas')
                ->update(['base_calculo' => $costoDirecto]);
        }

        // Return updated params
        $params = $this->dbService->getProjectParams($project->database_name);

        return response()->json([
            'success' => true,
            'data' => $params ? (array)$params : null,
            'message' => 'Parámetros actualizados correctamente.',
        ]);
    }


    /**
     * Exporta presupuesto a formato Excel/PDF
     * Ruta: GET /costos/proyectos/{project}/presupuesto/export
     */
    public function deleteRow(
        CostoProject $project,
        string $subsection,
        Request $request
    ): JsonResponse {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);
        $this->validateSubsection($subsection);

        $tableName = self::SUBSECTION_TABLE_MAP[$subsection];
        $rowIndex = $request->input('row_index');

        if (!is_numeric($rowIndex) || $rowIndex < 0) {
            return response()->json([
                'success' => false,
                'error' => 'Índice de fila inválido',
            ], 400);
        }

        DB::connection('costos_tenant')->beginTransaction();

        try {
            // Get all rows ordered
            $rows = $this->getOrderedRows($tableName)->toArray();

            // Check if the row exists
            if ($rowIndex >= count($rows)) {
                return response()->json([
                    'success' => false,
                    'error' => 'La fila no existe',
                ], 404);
            }

            $rowToDelete = (object)$rows[$rowIndex];
            $rowId = $rowToDelete->id ?? null;

            if (!$rowId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo obtener el ID de la fila',
                ], 400);
            }

            // Delete the row
            DB::connection('costos_tenant')
                ->table($tableName)
                ->where('id', $rowId)
                ->delete();

            // Reorder remaining rows if the table has item_order column
            if ($this->hasTenantColumn($tableName, 'item_order')) {
                $remainingRows = $this->getOrderedRows($tableName)->values()->all();
                foreach ($remainingRows as $index => $row) {
                    DB::connection('costos_tenant')
                        ->table($tableName)
                        ->where('id', $row->id)
                        ->update(['item_order' => $index]);
                }
            }

            DB::connection('costos_tenant')->commit();

            // Sincronizar totales tras eliminaciÃ³n si es presupuesto general
            if ($subsection === 'general') {
                $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
                $this->syncCostoDirecto($project->database_name, $tenantPresupuestoId);
            }

            return response()->json([
                'success' => true,
                'message' => 'Fila eliminada correctamente',
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error("Error deleting row from {$tableName}", [
                'project' => $project->id,
                'row_index' => $rowIndex,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error al eliminar la fila: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Exporta presupuesto a formato Excel/PDF
     * Ruta: GET /costos/proyectos/{project}/presupuesto/export
     */
    public function export(CostoProject $project, Request $request): Response
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        // TODO: Implement export logic
        // This will be implemented in a future task

        abort(501, 'Exportación no implementada aún');
    }

    /**
     * Get available subsections with labels
     */
    private function getAvailableSubsections(): array
    {
        return collect(self::SUBSECTION_LABELS)
            ->map(fn($label, $key) => [
                'key' => $key,
                'label' => $label,
            ])
            ->values()
            ->toArray();
    }

    /**
     * Get available metrados for import
     */
    private function getAvailableMetrados(CostoProject $project): array
    {
        $metradoTypes = [
            'metrado_arquitectura' => 'Arquitectura',
            'metrado_estructura' => 'Estructura',
            'metrado_sanitarias' => 'Sanitarias',
            'metrado_electricas' => 'Eléctricas',
            'metrado_comunicaciones' => 'Comunicaciones',
            'metrado_gas' => 'Gas',
        ];

        $availableMetrados = [];

        foreach ($metradoTypes as $type => $label) {
            if ($project->hasModule($type)) {
                // Count rows in the metrado table
                $rowCount = DB::connection('costos_tenant')
                    ->table($type)
                    ->count();

                $availableMetrados[] = [
                    'type' => $type,
                    'label' => $label,
                    'rowCount' => $rowCount,
                ];
            }
        }

        return $availableMetrados;
    }

    /**
     * Verificar que el usuario actual es dueño del proyecto
     */
    private function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    /**
     * Validar que el módulo presupuesto esté habilitado
     */
    private function validateModuleEnabled(CostoProject $project): void
    {
        $enabled = $project->enabledModules()->where('module_type', 'presupuesto')->exists();
        if (!$enabled) {
            abort(403, 'El módulo de presupuesto no está habilitado para este proyecto.');
        }
    }

    /**
     * Validar que la sub-sección existe
     */
    private function validateSubsection(string $subsection): void
    {
        if (!array_key_exists($subsection, self::SUBSECTION_TABLE_MAP)) {
            abort(404, "Sub-sección '{$subsection}' no existe.");
        }
    }

    /**
     * Validate rows data based on subsection type
     */
    private function validateRowsForSubsection(string $subsection, array $rows): array
    {
        $errors = [];

        foreach ($rows as $index => $row) {
            $rowErrors = match ($subsection) {
                'general' => $this->validateGeneralRow($row, $index),
                'acus' => $this->validateAcusRow($row, $index),
                'gastos_generales' => $this->validateGGVariablesRow($row, $index),
                'gastos_fijos' => $this->validateGGFijosRow($row, $index),
                'insumos' => $this->validateInsumosRow($row, $index),
                'remuneraciones' => $this->validateRemuneracionesRow($row, $index),
                'indices' => $this->validateIndicesRow($row, $index),
                'supervision' => $this->validateSupervisionRow($row, $index),
                default => [],
            };

            if (!empty($rowErrors)) {
                $errors["row_{$index}"] = $rowErrors;
            }
        }

        if (isset($row['costo_subcontratos']) && !is_numeric($row['costo_subcontratos'])) {
            $errors[] = 'El campo costo_subcontratos debe ser numÃ©rico';
        }

        if (isset($row['costo_subpartidas']) && !is_numeric($row['costo_subpartidas'])) {
            $errors[] = 'El campo costo_subpartidas debe ser numÃ©rico';
        }

        return $errors;
    }

    /**
     * Determine si una fila de presupuesto general es un título/subtítulo
     */
    private function isGeneralTitle(array $row): bool
    {
        return !isset($row['unidad']) || trim((string)$row['unidad']) === '';
    }

    /**
     * Validate presupuesto_general row
     */
    private function validateGeneralRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['partida'])) {
            $errors[] = 'El campo partida es requerido';
        } elseif (strlen($row['partida']) > 50) {
            $errors[] = 'El campo partida no puede exceder 50 caracteres';
        }

        if (empty($row['descripcion'])) {
            $errors[] = 'El campo descripción es requerido';
        }

        if (!$this->isGeneralTitle($row)) {
            if (!isset($row['unidad']) || trim((string)$row['unidad']) === '') {
                $errors[] = 'El campo unidad es requerido';
            } elseif (strlen((string)$row['unidad']) > 20) {
                $errors[] = 'El campo unidad no puede exceder 20 caracteres';
            }
        } elseif (isset($row['unidad']) && strlen((string)$row['unidad']) > 20) {
            $errors[] = 'El campo unidad no puede exceder 20 caracteres';
        }

        if (isset($row['metrado']) && !is_numeric($row['metrado'])) {
            $errors[] = 'El campo metrado debe ser numérico';
        }

        if (isset($row['precio_unitario']) && !is_numeric($row['precio_unitario'])) {
            $errors[] = 'El campo precio_unitario debe ser numérico';
        }

        if (isset($row['metrado_source']) && strlen($row['metrado_source']) > 50) {
            $errors[] = 'El campo metrado_source no puede exceder 50 caracteres';
        }

        return $errors;
    }

    /**
     * Validate presupuesto_acus row
     */
    private function validateAcusRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['partida'])) {
            $errors[] = 'El campo partida es requerido';
        } elseif (strlen($row['partida']) > 50) {
            $errors[] = 'El campo partida no puede exceder 50 caracteres';
        }

        if (empty($row['descripcion'])) {
            $errors[] = 'El campo descripción es requerido';
        }

        if (empty($row['unidad'])) {
            $errors[] = 'El campo unidad es requerido';
        } elseif (strlen($row['unidad']) > 20) {
            $errors[] = 'El campo unidad no puede exceder 20 caracteres';
        }

        if (isset($row['rendimiento'])) {
            if (!is_numeric($row['rendimiento'])) {
                $errors[] = 'El campo rendimiento debe ser numérico';
            } elseif ($row['rendimiento'] <= 0) {
                $errors[] = 'El campo rendimiento debe ser mayor que cero';
            }
        }

        // Validate JSON fields if present
        if (isset($row['mano_de_obra']) && !is_array($row['mano_de_obra']) && !is_null($row['mano_de_obra'])) {
            $errors[] = 'El campo mano_de_obra debe ser un array';
        }

        if (isset($row['materiales']) && !is_array($row['materiales']) && !is_null($row['materiales'])) {
            $errors[] = 'El campo materiales debe ser un array';
        }

        if (isset($row['equipos']) && !is_array($row['equipos']) && !is_null($row['equipos'])) {
            $errors[] = 'El campo equipos debe ser un array';
        }

        if (isset($row['subcontratos']) && !is_array($row['subcontratos']) && !is_null($row['subcontratos'])) {
            $errors[] = 'El campo subcontratos debe ser un array';
        }

        if (isset($row['subpartidas']) && !is_array($row['subpartidas']) && !is_null($row['subpartidas'])) {
            $errors[] = 'El campo subpartidas debe ser un array';
        }

        if (isset($row['costo_mano_obra']) && !is_numeric($row['costo_mano_obra'])) {
            $errors[] = 'El campo costo_mano_obra debe ser numérico';
        }

        if (isset($row['costo_materiales']) && !is_numeric($row['costo_materiales'])) {
            $errors[] = 'El campo costo_materiales debe ser numérico';
        }

        if (isset($row['costo_equipos']) && !is_numeric($row['costo_equipos'])) {
            $errors[] = 'El campo costo_equipos debe ser numérico';
        }

        return $errors;
    }

    /**
     * Validate gg_variables row (GG Variables tree node)
     */
    private function validateGGVariablesRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['descripcion'])) {
            $errors[] = "Fila {$index}: El campo descripción es requerido";
        }

        $tipoFila = $row['tipo_fila'] ?? 'detalle';
        if (!in_array($tipoFila, ['seccion', 'grupo', 'detalle'])) {
            $errors[] = "Fila {$index}: tipo_fila inválido";
        }

        if ($tipoFila === 'detalle') {
            if (isset($row['cantidad_descripcion']) && !is_numeric($row['cantidad_descripcion'])) {
                $errors[] = "Fila {$index}: cantidad_descripcion debe ser numérico";
            }
            if (isset($row['cantidad_tiempo']) && !is_numeric($row['cantidad_tiempo'])) {
                $errors[] = "Fila {$index}: cantidad_tiempo debe ser numérico";
            }
            if (isset($row['precio']) && !is_numeric($row['precio'])) {
                $errors[] = "Fila {$index}: precio debe ser numérico";
            }
        }

        return $errors;
    }

    /**
     * Validate gg_fijos row (GG Fijos tree node)
     */
    private function validateGGFijosRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['descripcion'])) {
            $errors[] = "Fila {$index}: El campo descripción es requerido";
        }

        $tipoFila = $row['tipo_fila'] ?? 'detalle';
        if (!in_array($tipoFila, ['seccion', 'grupo', 'detalle'])) {
            $errors[] = "Fila {$index}: tipo_fila inválido";
        }

        if ($tipoFila === 'detalle') {
            if (isset($row['cantidad']) && !is_numeric($row['cantidad'])) {
                $errors[] = "Fila {$index}: cantidad debe ser numérico";
            }
            if (isset($row['costo_unitario']) && !is_numeric($row['costo_unitario'])) {
                $errors[] = "Fila {$index}: costo_unitario debe ser numérico";
            }
        }

        return $errors;
    }

    /**
     * Validate presupuesto_insumos row
     */
    private function validateInsumosRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['codigo'])) {
            $errors[] = 'El campo código es requerido';
        } elseif (strlen($row['codigo']) > 50) {
            $errors[] = 'El campo código no puede exceder 50 caracteres';
        }

        if (empty($row['descripcion'])) {
            $errors[] = 'El campo descripción es requerido';
        }

        if (empty($row['unidad'])) {
            $errors[] = 'El campo unidad es requerido';
        } elseif (strlen($row['unidad']) > 20) {
            $errors[] = 'El campo unidad no puede exceder 20 caracteres';
        }

        if (isset($row['precio_unitario']) && !is_numeric($row['precio_unitario'])) {
            $errors[] = 'El campo precio_unitario debe ser numérico';
        }

        if (empty($row['tipo'])) {
            $errors[] = 'El campo tipo es requerido';
        } elseif (!in_array($row['tipo'], ['material', 'mano_obra', 'equipo'])) {
            $errors[] = 'El campo tipo debe ser: material, mano_obra o equipo';
        }

        if (isset($row['categoria']) && strlen($row['categoria']) > 50) {
            $errors[] = 'El campo categoría no puede exceder 50 caracteres';
        }

        return $errors;
    }

    /**
     * Validate presupuesto_remuneraciones row
     */
    private function validateRemuneracionesRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['cargo'])) {
            $errors[] = 'El campo cargo es requerido';
        } elseif (strlen($row['cargo']) > 100) {
            $errors[] = 'El campo cargo no puede exceder 100 caracteres';
        }

        if (isset($row['categoria']) && strlen($row['categoria']) > 50) {
            $errors[] = 'El campo categoría no puede exceder 50 caracteres';
        }

        if (isset($row['sueldo_basico']) && !is_numeric($row['sueldo_basico'])) {
            $errors[] = 'El campo sueldo_basico debe ser numérico';
        }

        if (isset($row['asignacion_familiar']) && !is_numeric($row['asignacion_familiar'])) {
            $errors[] = 'El campo asignacion_familiar debe ser numérico';
        }

        if (isset($row['meses'])) {
            if (!is_numeric($row['meses'])) {
                $errors[] = 'El campo meses debe ser numérico';
            } elseif ($row['meses'] < 1) {
                $errors[] = 'El campo meses debe ser al menos 1';
            }
        }

        return $errors;
    }

    /**
     * Validate presupuesto_indices row
     */
    private function validateIndicesRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['simbolo'])) {
            $errors[] = 'El campo símbolo es requerido';
        } elseif (strlen($row['simbolo']) > 10) {
            $errors[] = 'El campo símbolo no puede exceder 10 caracteres';
        }

        if (empty($row['descripcion'])) {
            $errors[] = 'El campo descripción es requerido';
        }

        if (isset($row['coeficiente']) && !is_numeric($row['coeficiente'])) {
            $errors[] = 'El campo coeficiente debe ser numérico';
        }

        if (isset($row['indice_base'])) {
            if (!is_numeric($row['indice_base'])) {
                $errors[] = 'El campo indice_base debe ser numérico';
            } elseif ($row['indice_base'] == 0) {
                $errors[] = 'El campo indice_base no puede ser cero (división por cero)';
            }
        }

        if (isset($row['indice_actual']) && !is_numeric($row['indice_actual'])) {
            $errors[] = 'El campo indice_actual debe ser numérico';
        }

        return $errors;
    }

    /**
     * Validate gg_supervision row
     */
    private function validateSupervisionRow(array $row, int $index): array
    {
        $errors = [];

        if (empty($row['item_codigo'])) {
            $errors[] = 'El campo código de ítem es requerido';
        }

        if (empty($row['concepto'])) {
            $errors[] = 'El campo concepto es requerido';
        }

        if (isset($row['cantidad']) && !is_numeric($row['cantidad'])) {
            $errors[] = 'El campo cantidad debe ser numérico';
        }

        if (isset($row['meses']) && !is_numeric($row['meses'])) {
            $errors[] = 'El campo meses debe ser numérico';
        }

        if (isset($row['importe']) && !is_numeric($row['importe'])) {
            $errors[] = 'El campo importe debe ser numérico';
        }

        return $errors;
    }

    /**
     * Prepare row data for insertion based on subsection type
     */
    private function prepareRowForSubsection(string $subsection, array $row, int $index, CostoProject $project, ?int $tenantPresupuestoId = null): array
    {
        $projectId = $project->id;
        // Set item order solo si la tabla lo soporta (tenants legacy pueden no tener la columna)
        $tableName = self::SUBSECTION_TABLE_MAP[$subsection] ?? null;
        if ($tableName && $this->hasTenantColumn($tableName, 'item_order')) {
            $row['item_order'] = $index;
        } else {
            unset($row['item_order']);
        }

        // Remove auto-increment id and force project context
        unset($row['id'], $row['project_id']);
        $row['presupuesto_id'] = $tenantPresupuestoId ?? $projectId;

        // Remove calculated columns (they are generated by the database)
        switch ($subsection) {
            case 'general':
                unset($row['parcial']);
                break;
            case 'acus':
                unset($row['costo_unitario_total']);
                break;
            case 'gastos_generales':
            case 'gastos_fijos':
            case 'supervision':
            case 'control_concurrente':
                unset($row['parcial']);
                break;
            case 'remuneraciones':
                unset($row['total_mensual_unitario'], $row['total_proyecto']);
                break;
            case 'indices':
                unset($row['monomio']);
                break;
        }

        // Convert JSON fields to JSON strings for ACUs
        if ($subsection === 'acus') {
            if (isset($row['mano_de_obra']) && is_array($row['mano_de_obra'])) {
                $row['mano_de_obra'] = json_encode($row['mano_de_obra']);
            }
            if (isset($row['materiales']) && is_array($row['materiales'])) {
                $row['materiales'] = json_encode($row['materiales']);
            }
            if (isset($row['equipos']) && is_array($row['equipos'])) {
                $row['equipos'] = json_encode($row['equipos']);
            }
        }

        // Set default values based on subsection
        $row = $this->setDefaultValues($subsection, $row);

        // Ensure timestamps
        $now = now();
        $row['created_at'] = $row['created_at'] ?? $now;
        $row['updated_at'] = $now;

        // AGGRESSIVE CLEANING: Filter only real columns of the table to avoid 500 errors
        if ($tableName) {
            $realColumns = Schema::connection('costos_tenant')->getColumnListing($tableName);
            return collect($row)
                ->filter(fn($val, $key) => in_array($key, $realColumns))
                ->toArray();
        }

        return $row;
    }

    /**
     * Set default values for fields based on subsection type
     */
    private function setDefaultValues(string $subsection, array $row): array
    {
        return match ($subsection) {
            'general' => [
                'unidad' => $row['unidad'] ?? '',  // CRITICAL: Prevent "Column 'unidad' cannot be null" error
                'metrado' => $row['metrado'] ?? 0,
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'metrado_source' => $row['metrado_source'] ?? null,
            ] + $row,
            'acus' => [
                'rendimiento' => $row['rendimiento'] ?? 1,
                'mano_de_obra' => $row['mano_de_obra'] ?? null,
                'materiales' => $row['materiales'] ?? null,
                'equipos' => $row['equipos'] ?? null,
                'costo_mano_obra' => $row['costo_mano_obra'] ?? 0,
                'costo_materiales' => $row['costo_materiales'] ?? 0,
                'costo_equipos' => $row['costo_equipos'] ?? 0,
            ] + $row,
            'gastos_generales' => [ // gg_variables table
                'tipo_fila' => $row['tipo_fila'] ?? 'detalle',
                'item_codigo' => $row['item_codigo'] ?? null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? null,
                'cantidad_descripcion' => $row['cantidad_descripcion'] ?? 0,
                'cantidad_tiempo' => $row['cantidad_tiempo'] ?? 0,
                'participacion' => $row['participacion'] ?? 100,
                'precio' => $row['precio'] ?? 0,
                'parent_id' => $row['parent_id'] ?? null,
            ] + $row,
            'gastos_fijos' => [ // gg_fijos table
                'tipo_fila' => $row['tipo_fila'] ?? 'detalle',
                'item_codigo' => $row['item_codigo'] ?? null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? null,
                'cantidad' => $row['cantidad'] ?? 0,
                'costo_unitario' => $row['costo_unitario'] ?? 0,
                'parent_id' => $row['parent_id'] ?? null,
                'tipo_calculo' => $row['tipo_calculo'] ?? 'manual',
            ] + $row,
            'insumos' => [
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'categoria' => $row['categoria'] ?? null,
            ] + $row,
            'remuneraciones' => [
                'presupuesto_id' => $row['presupuesto_id'] ?? null,
                'gg_variable_id' => $row['gg_variable_id'] ?? null,
                'cargo' => $row['cargo'] ?? 'Nuevo Cargo',
                'categoria' => $row['categoria'] ?? null,
                'participacion' => $row['participacion'] ?? 100,
                'cantidad' => $row['cantidad'] ?? 1,
                'meses' => $row['meses'] ?? 1,
                'sueldo_basico' => $row['sueldo_basico'] ?? 0,
                'asignacion_familiar' => $row['asignacion_familiar'] ?? 0,
                'snp' => $row['snp'] ?? 0,
                'essalud' => $row['essalud'] ?? 0,
                'cts' => $row['cts'] ?? 0,
                'vacaciones' => $row['vacaciones'] ?? 0,
                'gratificacion' => $row['gratificacion'] ?? 0,
            ] + $row,
            'indices' => [
                'coeficiente' => $row['coeficiente'] ?? 0,
                'indice_base' => $row['indice_base'] ?? 100,
                'indice_actual' => $row['indice_actual'] ?? 100,
                'fecha_indice_base' => $row['fecha_indice_base'] ?? null,
                'fecha_indice_actual' => $row['fecha_indice_actual'] ?? null,
            ] + $row,
            'supervision' => [ // gg_supervision table
                'tipo_fila' => $row['tipo_fila'] ?? 'detalle',
                'item_codigo' => $row['item_codigo'] ?? null,
                'concepto' => $row['concepto'] ?? '',
                'unidad' => $row['unidad'] ?? null,
                'cantidad' => $row['cantidad'] ?? 0,
                'meses' => $row['meses'] ?? 0,
                'importe' => $row['importe'] ?? 0,
                'parent_id' => $row['parent_id'] ?? null,
            ] + $row,
            default => $row,
        };
    }

    /**
     * Retorna filas ordenadas con fallback según columnas reales de la tabla.
     */
    private function getOrderedRows(string $tableName)
    {
        $connection = DB::connection('costos_tenant');
        $query = $connection->table($tableName);

        if ($tableName === 'presupuesto_remuneraciones') {
            $query->leftJoin('gg_variables', 'presupuesto_remuneraciones.gg_variable_id', '=', 'gg_variables.id')
                  ->select('presupuesto_remuneraciones.*', 'gg_variables.descripcion as cargo_gg');
        }

        if ($this->hasTenantColumn($tableName, 'item_order')) {
            $query->orderBy("$tableName.item_order");
        }
        
        if ($this->hasTenantColumn($tableName, 'id')) {
            $query->orderBy("$tableName.id");
        }

        return $query->get();
    }

    /**
     * Verifica existencia de columna en DB tenant con cache por request.
     */
    private function hasTenantColumn(string $tableName, string $column): bool
    {
        $key = "{$tableName}.{$column}";
        if (!array_key_exists($key, $this->tenantColumnCache)) {
            $this->tenantColumnCache[$key] = Schema::connection('costos_tenant')
                ->hasColumn($tableName, $column);
        }

        return $this->tenantColumnCache[$key];
    }

    /**
     * Ensure required columns exist for presupuesto_acus in legacy tenant DBs.
     */
    private function ensureAcuSchema(): void
    {
        $schema = Schema::connection('costos_tenant');
        if (!$schema->hasTable('presupuesto_acus')) {
            return;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'mano_de_obra')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->json('mano_de_obra')->nullable()
                    ->comment('Array of labor components');
            });
            $this->tenantColumnCache['presupuesto_acus.mano_de_obra'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_mano_obra')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_mano_obra', 15, 4)->default(0);
            });
            $this->tenantColumnCache['presupuesto_acus.costo_mano_obra'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'materiales')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->json('materiales')->nullable()
                    ->comment('Array of material components');
            });
            $this->tenantColumnCache['presupuesto_acus.materiales'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_materiales')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_materiales', 15, 4)->default(0);
            });
            $this->tenantColumnCache['presupuesto_acus.costo_materiales'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'equipos')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->json('equipos')->nullable()
                    ->comment('Array of equipment components');
            });
            $this->tenantColumnCache['presupuesto_acus.equipos'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_equipos')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_equipos', 15, 4)->default(0);
            });
            $this->tenantColumnCache['presupuesto_acus.costo_equipos'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'subcontratos')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->json('subcontratos')->nullable()
                    ->comment('Array of subcontract components');
            });
            $this->tenantColumnCache['presupuesto_acus.subcontratos'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_subcontratos')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_subcontratos', 15, 4)->default(0);
            });
            $this->tenantColumnCache['presupuesto_acus.costo_subcontratos'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'subpartidas')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->json('subpartidas')->nullable()
                    ->comment('Array of subpartidas components');
            });
            $this->tenantColumnCache['presupuesto_acus.subpartidas'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_subpartidas')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_subpartidas', 15, 4)->default(0);
            });
            $this->tenantColumnCache['presupuesto_acus.costo_subpartidas'] = true;
        }

        if (!$schema->hasColumn('presupuesto_acus', 'costo_unitario_total')) {
            $schema->table('presupuesto_acus', function (Blueprint $table) {
                $table->decimal('costo_unitario_total', 15, 4)
                    ->storedAs('costo_mano_obra + costo_materiales + costo_equipos + costo_subcontratos + costo_subpartidas')
                    ->comment('Calculated: sum of all component costs');
            });
            $this->tenantColumnCache['presupuesto_acus.costo_unitario_total'] = true;
        } else {
            try {
                DB::connection('costos_tenant')->statement(
                    "ALTER TABLE presupuesto_acus MODIFY COLUMN costo_unitario_total DECIMAL(15,4) GENERATED ALWAYS AS (costo_mano_obra + costo_materiales + costo_equipos + costo_subcontratos + costo_subpartidas) STORED"
                );
            } catch (\Throwable $e) {
                Log::warning('No se pudo actualizar la fórmula de costo_unitario_total', [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Recalcula el costo directo sumando los parciales de presupuesto_general
     * y actualiza project_params y presupuestos (tabla centralizada).
     */
    private function syncCostoDirecto(string $databaseName, int $tenantPresupuestoId): void
    {
        $connection = DB::connection('costos_tenant');

        // Sumar todos los parciales de presupuesto_general vinculados a este presupuesto
        // Nota: metrado * precio_unitario es la base del parcial en DB.
        $totalCostoDirecto = (float)$connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->sum(DB::raw('metrado * precio_unitario'));

        // 1. Actualizar tabla maestra de presupuestos del tenant
        if (Schema::connection('costos_tenant')->hasTable('presupuestos')) {
            $connection->table('presupuestos')
                ->where('id', $tenantPresupuestoId)
                ->update([
                    'costo_directo' => $totalCostoDirecto,
                    'updated_at'    => now(),
                ]);
        }

        // 2. Actualizar tabla de parámetros globales (project_params)
        if (Schema::connection('costos_tenant')->hasTable('project_params')) {
            $connection->table('project_params')
                ->where('id', 1)
                ->update([
                    'costo_directo' => $totalCostoDirecto,
                    'updated_at'    => now(),
                ]);
        }

        // 3. Propagación automática a base_calculo de Fianzas y Pólizas
        if (Schema::connection('costos_tenant')->hasTable('gg_fijos_fianzas')) {
            $connection->table('gg_fijos_fianzas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $totalCostoDirecto]);
        }

        if (Schema::connection('costos_tenant')->hasTable('gg_fijos_polizas')) {
            $connection->table('gg_fijos_polizas')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->update(['base_calculo' => $totalCostoDirecto]);
        }

        Log::info("PresupuestoController: Sync costo_directo [{$totalCostoDirecto}] for budget [{$tenantPresupuestoId}]");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SUPERVISIÓN — DETALLE GASTOS GENERALES (Sección IV)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Obtiene todas las filas del detalle de Gastos Generales de Supervisión.
     * Ruta: GET /costos/proyectos/{project}/presupuesto/supervision-gg-detalle
     */
    public function getSupervisionGGDetalle(CostoProject $project): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        if (!Schema::connection('costos_tenant')->hasTable('supervision_gg_detalle')) {
            return response()->json(['success' => true, 'rows' => [], 'total' => 0]);
        }

        $rows = DB::connection('costos_tenant')
            ->table('supervision_gg_detalle')
            ->orderBy('item_order')
            ->orderBy('id')
            ->get()
            ->map(fn($r) => (array)$r)
            ->toArray();

        // Calculate global total as SUM of total_seccion for root sections
        $total = DB::connection('costos_tenant')
            ->table('supervision_gg_detalle')
            ->whereNull('parent_id')
            ->where('tipo_fila', 'seccion')
            ->sum('total_seccion');

        return response()->json([
            'success' => true,
            'rows'    => $rows,
            'total'   => round((float)$total, 2),
        ]);
    }

    /**
     * Guarda/actualiza el detalle de Gastos Generales de Supervisión.
     * Estrategia: clear + re-insert con remapeo de parent_id.
     * Devuelve el total calculado para actualizar la Sección IV automáticamente.
     * Ruta: PATCH /costos/proyectos/{project}/presupuesto/supervision-gg-detalle
     */
    public function saveSupervisionGGDetalle(CostoProject $project, Request $request): JsonResponse
    {
        $this->authorizeProject($project);
        $this->validateModuleEnabled($project);

        if (!Schema::connection('costos_tenant')->hasTable('supervision_gg_detalle')) {
            return response()->json(['success' => false, 'error' => 'Tabla no existe. Ejecute las migraciones.'], 500);
        }

        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        $connection->beginTransaction();
        try {
            // Clear all rows for this presupuesto
            $connection->table('supervision_gg_detalle')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->delete();

            $idMapping   = [];
            $sectionTotals = []; // parentId (new) => sum of subtotals

            foreach ($rows as $index => $row) {
                $oldId = $row['id'] ?? null;

                // Prepare clean row
                $cleanRow = [
                    'presupuesto_id' => $tenantPresupuestoId,
                    'parent_id'      => null,
                    'tipo_fila'      => in_array($row['tipo_fila'] ?? '', ['seccion', 'detalle']) ? $row['tipo_fila'] : 'detalle',
                    'item_codigo'    => substr((string)($row['item_codigo'] ?? ''), 0, 20) ?: null,
                    'concepto'       => $row['concepto'] ?? '',
                    'unidad'         => substr((string)($row['unidad'] ?? ''), 0, 20) ?: null,
                    'cantidad'       => is_numeric($row['cantidad'] ?? null) ? (float)$row['cantidad'] : 0,
                    'meses'          => is_numeric($row['meses'] ?? null)    ? (float)$row['meses']    : 0,
                    'importe'        => is_numeric($row['importe'] ?? null)  ? (float)$row['importe']  : 0,
                    'total_seccion'  => 0, // will be updated after all children inserted
                    'item_order'     => $index,
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ];

                // Remap parent_id
                $originalParentId = $row['parent_id'] ?? null;
                if (!is_null($originalParentId) && isset($idMapping[$originalParentId])) {
                    $cleanRow['parent_id'] = $idMapping[$originalParentId];
                }

                $newId = $connection->table('supervision_gg_detalle')->insertGetId($cleanRow);

                if ($oldId) {
                    $idMapping[$oldId] = $newId;
                }
            }

            // Recalculate total_seccion for each section row
            // (sum the stored subtotal of its direct children)
            $sectionRows = $connection->table('supervision_gg_detalle')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->where('tipo_fila', 'seccion')
                ->get();

            foreach ($sectionRows as $section) {
                $sectionTotal = $connection->table('supervision_gg_detalle')
                    ->where('parent_id', $section->id)
                    ->where('tipo_fila', 'detalle')
                    ->sum('subtotal');

                $connection->table('supervision_gg_detalle')
                    ->where('id', $section->id)
                    ->update(['total_seccion' => round((float)$sectionTotal, 4)]);
            }

            // Global total = SUM of root section totals
            $grandTotal = $connection->table('supervision_gg_detalle')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->whereNull('parent_id')
                ->where('tipo_fila', 'seccion')
                ->sum('total_seccion');

            $connection->commit();

            // Return updated rows
            $updatedRows = $connection->table('supervision_gg_detalle')
                ->where('presupuesto_id', $tenantPresupuestoId)
                ->orderBy('item_order')
                ->orderBy('id')
                ->get()
                ->map(fn($r) => (array)$r)
                ->toArray();

            return response()->json([
                'success' => true,
                'rows'    => $updatedRows,
                'total'   => round((float)$grandTotal, 2),
            ]);
        } catch (\Exception $e) {
            $connection->rollBack();
            Log::error('Error saving supervision_gg_detalle', [
                'project' => $project->id,
                'error'   => $e->getMessage(),
            ]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Export helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Helper: obtiene las filas del presupuesto general desde el tenant.
     */
    private function buildPresupuestoRows(CostoProject $project): array
    {
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);
        return DB::connection('costos_tenant')
            ->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->orderBy('partida')
            ->get()
            ->map(fn($r) => (array)$r)
            ->toArray();
    }

    /**
     * Exporta el presupuesto general a CSV/Excel (UTF-8 BOM para compatibilidad con Microsoft Excel).
     * Ruta: GET /costos/proyectos/{project}/presupuesto/export/excel
     */
    public function exportExcel(CostoProject $project): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        abort_unless(Auth::check(), 403);

        $rows = $this->buildPresupuestoRows($project);
        $filename = 'presupuesto_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $project->nombre) . '_' . date('Ymd') . '.csv';

        return response()->streamDownload(function () use ($rows) {
            $f = fopen('php://output', 'w');
            // BOM para que Excel lo abra correctamente en UTF-8
            fprintf($f, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($f, ['Ítem', 'Descripción', 'Unidad', 'Metrado', 'Precio Unit.', 'Parcial'], ';');

            foreach ($rows as $row) {
                $level  = substr_count((string)($row['partida'] ?? ''), '.');
                $indent = str_repeat('  ', $level);
                fputcsv($f, [
                    $row['partida']       ?? '',
                    $indent . ($row['descripcion'] ?? ''),
                    $row['unidad']        ?? '',
                    number_format((float)($row['metrado'] ?? 0), 4, '.', ''),
                    number_format((float)($row['precio_unitario'] ?? 0), 4, '.', ''),
                    number_format((float)($row['parcial'] ?? 0), 4, '.', ''),
                ], ';');
            }
            fclose($f);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Exporta el presupuesto general como HTML imprimible (o PDF si Dompdf está disponible).
     * Ruta: GET /costos/proyectos/{project}/presupuesto/export/pdf
     */
    public function exportPdf(CostoProject $project): \Illuminate\Http\Response
    {
        abort_unless(Auth::check(), 403);

        $rows   = $this->buildPresupuestoRows($project);
        $nombre = $project->nombre;
        $fecha  = now()->format('d/m/Y');

        $levelColors = ['#1e3a5f', '#1a5276', '#1f618d', '#2471a3', '#2e86c1'];
        $bgColors    = ['#d6eaf8', '#eaf4fb', '#f2f9fd', '#ffffff', '#ffffff'];

        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Presupuesto - ' . e($nombre) . '</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 20px; }
  h1 { font-size: 14px; color: #1a3a5c; margin-bottom: 4px; }
  p.sub { color: #555; font-size: 10px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e3a5f; color: #fff; padding: 5px 8px; text-align: left; }
  th.r { text-align: right; }
  td { padding: 3px 8px; border-bottom: 1px solid #e0e0e0; }
  td.r { text-align: right; font-family: monospace; }
  .tot td { font-weight: bold; background: #d6eaf8; }
  @media print { @page { size: A4 landscape; margin: 15mm; } }
</style></head><body>
<h1>PRESUPUESTO GENERAL</h1>
<p class="sub">Proyecto: <strong>' . e($nombre) . '</strong> &nbsp;|&nbsp; ' . $fecha . '</p>
<table><thead><tr>
  <th style="width:90px">Ítem</th><th>Descripción</th>
  <th style="width:40px" class="r">Und.</th>
  <th style="width:80px" class="r">Metrado</th>
  <th style="width:80px" class="r">P. Unit.</th>
  <th style="width:90px" class="r">Parcial</th>
</tr></thead><tbody>';

        $rootTotal = 0;
        foreach ($rows as $row) {
            $level   = substr_count((string)($row['partida'] ?? ''), '.');
            $bg      = $bgColors[min($level, 4)];
            $color   = $levelColors[min($level, 4)];
            $bold    = $level <= 1 ? ' font-weight:bold;' : '';
            $indent  = $level * 16;
            $parcial = (float)($row['parcial'] ?? 0);
            if ($level === 0) $rootTotal += $parcial;

            $html .= '<tr style="background:' . $bg . ';color:' . $color . ';' . $bold . '">';
            $html .= '<td style="padding-left:' . ($indent + 8) . 'px;font-size:9px">' . e($row['partida'] ?? '') . '</td>';
            $html .= '<td style="padding-left:' . ($indent + 8) . 'px">' . e($row['descripcion'] ?? '') . '</td>';
            $html .= '<td class="r">' . e($row['unidad'] ?? '') . '</td>';
            $html .= '<td class="r">' . ((float)($row['metrado'] ?? 0) > 0 ? number_format((float)$row['metrado'], 4, '.', ',') : '') . '</td>';
            $html .= '<td class="r">' . ((float)($row['precio_unitario'] ?? 0) > 0 ? number_format((float)$row['precio_unitario'], 4, '.', ',') : '') . '</td>';
            $html .= '<td class="r">' . number_format($parcial, 2, '.', ',') . '</td>';
            $html .= '</tr>';
        }

        $html .= '<tr class="tot"><td colspan="5" style="text-align:right;padding-right:16px">COSTO DIRECTO TOTAL</td>';
        $html .= '<td class="r">' . number_format($rootTotal, 2, '.', ',') . '</td></tr>';
        $html .= '</tbody></table></body></html>';

        $filename = 'presupuesto_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $project->nombre) . '_' . date('Ymd') . '.pdf';

        // Si Dompdf (barryvdh/laravel-dompdf) está instalado, generar PDF real
        if (class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4', 'landscape');
            return $pdf->download($filename);
        }

        // Fallback: HTML con ventana de impresión automática
        $html = str_replace('</body>', '<script>window.onload=function(){window.print();}</script></body>', $html);
        return response($html, 200, [
            'Content-Type'        => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }
}
