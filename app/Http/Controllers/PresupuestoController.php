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
}
