<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CostoModuleController extends Controller
{
    /**
     * Mapping: moduleType → tenant table name(s)
     */
    private const MODULE_TABLE_MAP = [
        'metrado_arquitectura'   => 'metrado_arquitectura',
        'metrado_estructura'     => 'metrado_estructura',
        'metrado_sanitarias'     => 'metrado_sanitarias',
        'metrado_electricas'     => 'metrado_electricas',
        'metrado_comunicaciones' => 'metrado_comunicaciones',
        'metrado_gas'            => 'metrado_gas',
        'crono_general'          => 'cronograma_general',
        'crono_valorizado'       => 'cronograma_valorizado',
        'crono_materiales'       => 'cronograma_materiales',
        'etts'                   => 'especificaciones_tecnicas',
    ];


    /**
     * Columns per module table (for frontend column definitions).
     * Keys that match across all metrados share the same base columns.
     */
    private const MODULE_COLUMNS = [
        'metrado_base' => [
            ['key' => 'partida',     'label' => 'Partida',     'width' => 80],
            ['key' => 'descripcion', 'label' => 'Descripción', 'width' => 250],
            ['key' => 'unidad',      'label' => 'Und',         'width' => 50],
            ['key' => 'elsim',       'label' => 'elem_simil.', 'width' => 80],
            ['key' => 'largo',       'label' => 'Largo',       'width' => 80],
            ['key' => 'ancho',       'label' => 'Ancho',       'width' => 80],
            ['key' => 'alto',        'label' => 'Alto',        'width' => 80],
            ['key' => 'nveces',      'label' => 'N° veces',    'width' => 80],
            ['key' => 'lon',         'label' => 'Lon.',        'width' => 80],
            ['key' => 'area',        'label' => 'Area',        'width' => 80],
            ['key' => 'vol',         'label' => 'Vol.',        'width' => 90],
            ['key' => 'kg',          'label' => 'Kg.',         'width' => 90],
            ['key' => 'und',         'label' => 'Und.',        'width' => 90],
            ['key' => 'total',       'label' => 'Total',       'width' => 90],
            ['key' => 'observacion', 'label' => 'Obs.',        'width' => 120],
        ],
        'metrado_sanitarias_extra' => [
            ['key' => 'modulos', 'label' => 'Módulos', 'width' => 70],
        ],
    ];

    private const MODULE_LABELS = [
        'metrado_arquitectura'   => 'Metrado Arquitectura',
        'metrado_estructura'     => 'Metrado Estructura',
        'metrado_sanitarias'     => 'Metrado Sanitarias',
        'metrado_electricas'     => 'Metrado Eléctricas',
        'metrado_comunicaciones' => 'Metrado Comunicaciones',
        'metrado_gas'            => 'Metrado Gas',
        'crono_general'          => 'Cronograma General',
        'crono_valorizado'       => 'Cronograma Valorizado',
        'crono_materiales'       => 'Cronograma Materiales',
        'etts'                   => 'Especificaciones Técnicas',
    ];

    public function __construct(
        protected CostoDatabaseService $dbService,
    ) {}

    /**
     * Show a module's spreadsheet for a project.
     * The middleware SetCostosDatabase already switched the connection.
     */
    public function show(CostoProject $costoProject, string $moduleType)
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleType($moduleType);
        $this->validateModuleEnabled($costoProject, $moduleType);

        // Sanitarias has a specialized controller with modular structure
        if ($moduleType === 'metrado_sanitarias') {
            return redirect()->route('costos.metrado-sanitarias.index', ['costoProject' => $costoProject->id]);
        }

        // Eléctricas has a specialized controller with modular structure
        if ($moduleType === 'metrado_electricas') {
            return redirect()->route('metrado-electricas.index', ['costoProject' => $costoProject->id]);
        }

        // Comunicaciones has a specialized controller with modular structure
        if ($moduleType === 'metrado_comunicaciones') {
            return redirect()->route('metrado-comunicaciones.index', ['costoProject' => $costoProject->id]);
        }

        // Arquitectura has a specialized controller with modular structure
        if ($moduleType === 'metrado_arquitectura') {
            return redirect()->route('costos.metrado-arquitectura.index', ['costoProject' => $costoProject->id]);
        }

        // Estructura has a specialized controller with modular structure
        if ($moduleType === 'metrado_estructura') {
            return redirect()->route('costos.metrado-estructuras.index', ['costoProject' => $costoProject->id]);
        }

        // Gas has a specialized controller with modular structure
        if ($moduleType === 'metrado_gas') {
            return redirect()->route('costos.metrado-gas.index', ['costoProject' => $costoProject->id]);
        }

        $tableName = self::MODULE_TABLE_MAP[$moduleType];

        // Read rows from the tenant DB
        $rows = DB::connection('costos_tenant')
            ->table($tableName)
            ->orderBy('item_order')
            ->orderBy('id')
            ->get()
            ->map(fn($row) => (array)$row)
            ->toArray();

        // Build column definitions
        $columns = $this->getColumnsForModule($moduleType);

        return Inertia::render('costos/modules/ModuleView', [
            'project' => [
                'id' => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'moduleType' => $moduleType,
            'moduleLabel' => self::MODULE_LABELS[$moduleType] ?? $moduleType,
            'tableName' => $tableName,
            'columns' => $columns,
            'rows' => $rows,
        ]);
    }

    /**
     * Update (save) module data — receives rows from Luckysheet/spreadsheet.
     */
    public function update(CostoProject $costoProject, string $moduleType, Request $request)
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleType($moduleType);

        $tableName = self::MODULE_TABLE_MAP[$moduleType];
        $rows = $request->input('rows', []);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            // Strategy: clear + re-insert (simple for spreadsheet-like data)
            DB::connection('costos_tenant')->table($tableName)->truncate();

            foreach ($rows as $index => $row) {
                // Remove non-column keys and set order
                $row['item_order'] = $index;
                unset($row['id']); // auto-increment

                // Ensure timestamps
                $now = now();
                $row['created_at'] = $row['created_at'] ?? $now;
                $row['updated_at'] = $now;

                DB::connection('costos_tenant')->table($tableName)->insert($row);
            }

            DB::connection('costos_tenant')->commit();

            return response()->json(['success' => true, 'count' => count($rows)]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error("Error saving module data", [
                'module' => $moduleType,
                'project' => $costoProject->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get column definitions for a given module type.
     */
    private function getColumnsForModule(string $moduleType): array
    {
        // All metrados share base columns
        if (str_starts_with($moduleType, 'metrado_')) {
            $cols = self::MODULE_COLUMNS['metrado_base'];

            // Sanitarias has extra 'modulos' column — insert after 'unidad'
            if ($moduleType === 'metrado_sanitarias') {
                $insertAt = 3; // after unidad (index 2), before cantidad
                array_splice($cols, $insertAt, 0, self::MODULE_COLUMNS['metrado_sanitarias_extra']);
            }
        }

        // For non-metrado modules, return generic columns from DB schema
        return $this->getColumnsFromSchema($moduleType);
    }

    /**
     * Auto-detect columns from the tenant DB table schema.
     */
    private function getColumnsFromSchema(string $moduleType): array
    {
        $tableName = self::MODULE_TABLE_MAP[$moduleType];
        $schemaColumns = DB::connection('costos_tenant')
            ->getSchemaBuilder()
            ->getColumnListing($tableName);

        $skip = ['id', 'created_at', 'updated_at', 'item_order'];

        return collect($schemaColumns)
            ->filter(fn($col) => !in_array($col, $skip))
            ->map(fn($col) => [
                'key' => $col,
                'label' => ucfirst(str_replace('_', ' ', $col)),
                'width' => 120,
            ])
            ->values()
            ->toArray();
    }

    private function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    private function validateModuleType(string $moduleType): void
    {
        if (!array_key_exists($moduleType, self::MODULE_TABLE_MAP)) {
            abort(404, "Módulo '{$moduleType}' no existe.");
        }
    }

    private function validateModuleEnabled(CostoProject $project, string $moduleType): void
    {
        $enabled = $project->enabledModules()->where('module_type', $moduleType)->exists();
        if (!$enabled) {
            abort(403, "El módulo '{$moduleType}' no está habilitado para este proyecto.");
        }
    }
}
