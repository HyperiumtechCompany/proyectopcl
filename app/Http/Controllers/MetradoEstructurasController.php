<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Inertia\Inertia;
use Inertia\Response;

class MetradoEstructurasController extends Controller
{
    /**
     * Table names within the tenant DB.
     */
    private const TABLE_METRADO = 'metrado_estructura';
    private const TABLE_RESUMEN = 'metrado_estructura_resumen';

    // Columnas del metrado
    private const METRADO_COLUMNS = [
        'item', 'descripcion', 'und', 'elem_simil', 'largo', 'ancho', 'alto', 
        'nveces', 'long', 'area', 'vol', 'kg', 'parcial', 'total', 'obs'
    ];

    // ─── Index (Inertia page) ────────────────────────────────────────────────────

    public function index(CostoProject $costoProject): Response
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return Inertia::render('costos/metrados/EstructurasIndex', [
            'project' => [
                'id'     => $costoProject->id,
                'nombre' => $costoProject->nombre,
            ],
            'metrado' => $this->queryTableRows(self::TABLE_METRADO),
            'resumen' => $this->queryTableRows(self::TABLE_RESUMEN),
        ]);
    }

    // ─── Metrado CRUD ────────────────────────────────────────────────────────────

    public function getMetrado(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return response()->json([
            'success' => true,
            'rows'    => $this->queryTableRows(self::TABLE_METRADO),
        ]);
    }

    public function updateMetrado(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $connection->beginTransaction();

        try {
            $connection->table(self::TABLE_METRADO)->delete();

            foreach ($rows as $index => $row) {
                $cleanRow = [
                    'item'        => $row['item'] ?? ($index + 1),
                    'descripcion' => $row['descripcion'] ?? null,
                    'und'         => $row['und'] ?? null,
                    'elem_simil'  => $this->toDecimal($row['elem_simil'] ?? 0),
                    'largo'       => $this->toDecimal($row['largo'] ?? 0),
                    'ancho'       => $this->toDecimal($row['ancho'] ?? 0),
                    'alto'        => $this->toDecimal($row['alto'] ?? 0),
                    'nveces'      => $this->toDecimal($row['nveces'] ?? 0),
                    'long'        => $this->toDecimal($row['long'] ?? 0),
                    'area'        => $this->toDecimal($row['area'] ?? 0),
                    'vol'         => $this->toDecimal($row['vol'] ?? 0),
                    'kg'          => $this->toDecimal($row['kg'] ?? 0),
                    'parcial'     => $this->toDecimal($row['parcial'] ?? 0),
                    'total'       => $this->toDecimal($row['total'] ?? 0),
                    'obs'         => $row['obs'] ?? null,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ];

                $connection->table(self::TABLE_METRADO)->insert($cleanRow);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryTableRows(self::TABLE_METRADO),
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error('Error saving metrado estructuras', [
                'project' => $costoProject->id,
                'error'  => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    // ─── Resumen CRUD ────────────────────────────────────────────────────────────

    public function getResumen(CostoProject $costoProject): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        return response()->json([
            'success' => true,
            'rows'    => $this->queryTableRows(self::TABLE_RESUMEN),
        ]);
    }

    public function updateResumen(CostoProject $costoProject, Request $request): JsonResponse
    {
        $this->authorizeProject($costoProject);
        $this->validateModuleEnabled($costoProject);

        $rows = $request->input('rows', []);
        $connection = DB::connection('costos_tenant');
        $connection->beginTransaction();

        try {
            // Create table if not exists
            if (!Schema::connection('costos_tenant')->hasTable(self::TABLE_RESUMEN)) {
                Schema::connection('costos_tenant')->create(self::TABLE_RESUMEN, function (Blueprint $table) {
                    $table->id();
                    $table->integer('item')->default(0);
                    $table->string('descripcion', 500)->nullable();
                    $table->string('und', 20)->nullable();
                    $table->decimal('parcial', 14, 4)->default(0);
                    $table->decimal('total', 14, 4)->default(0);
                    $table->timestamps();
                });
            }

            $connection->table(self::TABLE_RESUMEN)->delete();

            foreach ($rows as $index => $row) {
                $connection->table(self::TABLE_RESUMEN)->insert([
                    'item'        => $row['item'] ?? ($index + 1),
                    'descripcion' => $row['descripcion'] ?? null,
                    'und'         => $row['und'] ?? null,
                    'parcial'     => $this->toDecimal($row['parcial'] ?? 0),
                    'total'       => $this->toDecimal($row['total'] ?? 0),
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $connection->commit();

            return response()->json([
                'success' => true,
                'count'   => count($rows),
                'rows'    => $this->queryTableRows(self::TABLE_RESUMEN),
            ]);
        } catch (\Exception $e) {
            if ($connection->transactionLevel() > 0) {
                $connection->rollBack();
            }
            Log::error('Error saving metrado estructuras resumen', [
                'project' => $costoProject->id,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private function queryTableRows(string $table): array
    {
        try {
            return DB::connection('costos_tenant')
                ->table($table)
                ->orderBy('id')
                ->get()
                ->map(fn($row) => (array) $row)
                ->toArray();
        } catch (\Exception $e) {
            Log::warning("Table {$table} does not exist or error: " . $e->getMessage());
            return [];
        }
    }

    private function toDecimal(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }

    private function validateModuleEnabled(CostoProject $project): void
    {
        $enabled = $project->enabledModules()
            ->where('module_type', 'metrado_estructura')
            ->exists();

        if (!$enabled) {
            abort(403, 'El módulo de estructuras no está habilitado para este proyecto.');
        }
    }
}
