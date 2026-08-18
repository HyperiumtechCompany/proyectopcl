<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class InsumoProductoController extends Controller
{
    /**
     * Seed the insumos catalog (diccionario + unidades) in the current tenant DB.
     * POST /costos/proyectos/{project}/presupuesto/insumos/seed
     */
    public function seedCatalog(): JsonResponse
    {
        $connection = DB::connection('costos_tenant');

        // Run the seeders
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\DiccionarioSeeder',
            '--force' => true,
        ]);
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\UnidadSeeder',
            '--force' => true,
        ]);
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\InsumoProductoSeeder',
            '--force' => true,
        ]);

        $diccionarioCount = $connection->table('diccionario')->count();
        $unidadCount = $connection->table('unidad')->count();
        $insumoCount = $connection->table('insumo_productos')->count();

        return response()->json([
            'success' => true,
            'message' => "CatÃ¡logo inicializado: {$diccionarioCount} diccionarios, {$unidadCount} unidades, {$insumoCount} insumos base.",
            'diccionarios' => $diccionarioCount,
            'unidades' => $unidadCount,
            'insumos' => $insumoCount,
        ]);
    }

    /**
     * Buscar productos/insumos por descripciÃ³n o cÃ³digo.
     * GET /costos/proyectos/{project}/presupuesto/insumos/search?q=cemento&tipo=materiales
     */
    public function search(Request $request, $project): JsonResponse
    {
        $tipo = $request->query('tipo');
        $search = $request->query('q');
        $usadosOnly = $request->boolean('usados_only');
        $especialidad = $request->query('especialidad');

        $connection = DB::connection('costos_tenant');

        // Cuando se solicita "solo usados", los insumos se obtienen directamente
        // de las tablas hijas de ACU (una por cada tipo), de modo que se muestren
        // incluso los que no estÃƒÂ¡n enlazados al catÃƒÂ¡logo maestro.
        if ($usadosOnly) {
            $tableMap = [
                'mano_de_obra' => [
                    'table' => 'acu_mano_de_obra',
                    'price_column' => 'precio_unitario',
                    'unit_column' => 'unidad',
                ],
                'materiales' => [
                    'table' => 'acu_materiales',
                    'price_column' => 'precio_unitario',
                    'unit_column' => 'unidad',
                ],
                'equipos' => [
                    'table' => 'acu_equipos',
                    'price_column' => 'precio_hora',
                    'unit_column' => 'unidad',
                ],
                'subcontratos' => [
                    'table' => 'acu_subcontratos',
                    'price_column' => 'precio_unitario',
                    'unit_column' => 'unidad',
                ],
                'subpartidas' => [
                    'table' => 'acu_subpartidas',
                    'price_column' => 'precio_unitario',
                    'unit_column' => 'unidad',
                ],
            ];

            if (! $tipo || ! isset($tableMap[$tipo])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe especificar un tipo vÃ¡lido para listar insumos usados.',
                    'productos' => [],
                ], 422);
            }

            $conf = $tableMap[$tipo];

            $projectModel = $project instanceof CostoProject
                ? $project
                : CostoProject::findOrFail($project);
            $tenantPresupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($projectModel->database_name);

            $query = $connection->table("{$conf['table']} as t")
                ->join('presupuesto_acus as a', 't.acu_id', '=', 'a.id')
                ->join('presupuesto_general as g', function ($join) use ($tenantPresupuestoId) {
                    $join->on('a.partida', '=', 'g.partida')
                        ->where('g.presupuesto_id', '=', $tenantPresupuestoId);
                })
                ->leftJoin('insumo_productos as p', 't.insumo_id', '=', 'p.id')
                ->leftJoin('diccionario as d', 'p.diccionario_id', '=', 'd.id')
                ->leftJoin('unidad as u', 'p.unidad_id', '=', 'u.id')
                ->select([
                    't.insumo_id',
                    DB::raw("COALESCE(p.id, JSON_UNQUOTE(JSON_EXTRACT(t.descripcion, '$'))) as group_id"),
                    DB::raw('MAX(p.codigo_producto) as codigo'),
                    DB::raw('COALESCE(MAX(p.descripcion), MAX(t.descripcion)) as descripcion'),
                    DB::raw("COALESCE(MAX(u.descripcion_singular), MAX(u.abreviatura_unidad), MAX(t.{$conf['unit_column']})) as unidad_nombre"),
                    DB::raw('MAX(p.tipo_proveedor) as tipo_proveedor'),
                    DB::raw("MAX(COALESCE(p.costo_unitario, t.{$conf['price_column']}, 0)) as precio"),
                    DB::raw('SUM(CASE WHEN LOWER(t.descripcion) LIKE \'%herramienta%\' THEN (t.cantidad / 100.0) * COALESCE(g.metrado, 0) ELSE t.cantidad * COALESCE(g.metrado, 0) END) as cantidad_total'),
                    DB::raw('SUM(t.parcial * COALESCE(g.metrado, 0)) as parcial_total'),
                ])
                ->where('a.presupuesto_id', $tenantPresupuestoId)
                ->groupBy('t.insumo_id', 'group_id');

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('t.descripcion', 'like', "%{$search}%")
                        ->orWhere('p.descripcion', 'like', "%{$search}%")
                        ->orWhere('p.codigo_producto', 'like', "%{$search}%");
                });
            }

            if ($especialidad && $especialidad !== 'todas') {
                $query->where('g.partida', 'like', "{$especialidad}%");
            }

            $rows = $query
                ->orderBy(DB::raw('COALESCE(MAX(p.descripcion), MAX(t.descripcion))'))
                ->limit(500)
                ->get();

            $productos = $rows->map(function ($row) use ($tipo) {
                $precio = (float) $row->precio;
                $cantidadTotal = (float) $row->cantidad_total;

                return [
                    'id' => $row->insumo_id ? 'ins-'.$row->insumo_id : 'desc-'.md5((string) $row->descripcion),
                    'insumo_id' => $row->insumo_id,
                    'codigo' => $row->codigo ?: '-',
                    'descripcion' => $row->descripcion,
                    'unidad_nombre' => $row->unidad_nombre ?: '-',
                    'proveedor' => $row->tipo_proveedor ?: 'SIN CLASIFICAR',
                    'cantidad' => $cantidadTotal,
                    'precio' => $precio,
                    'total' => round((float) $row->parcial_total, 2),
                    'tipo' => $tipo,
                ];
            })->values()->toArray();

            return response()->json([
                'success' => true,
                'productos' => $productos,
            ]);
        }

        $query = $connection->table('insumo_productos as p')
            ->leftJoin('diccionario as d', 'p.diccionario_id', '=', 'd.id')
            ->leftJoin('unidad as u', 'p.unidad_id', '=', 'u.id')
            ->select([
                'p.id',
                'p.codigo_producto as codigo',
                'p.descripcion',
                'p.especificaciones',
                'p.unidad_id',
                'p.diccionario_id',
                'p.tipo_proveedor',
                'p.costo_unitario as precio',
                'p.costo_unitario_lista',
                'p.costo_flete',
                'p.tipo',
                'd.id as diccionario_id_rel',
                'd.codigo as diccionario_codigo',
                'd.descripcion as diccionario_descripcion',
                'u.id as unidad_id_rel',
                'u.descripcion as unidad_descripcion',
                'u.descripcion_singular as unidad_descripcion_singular',
                'u.abreviatura_unidad',
            ])
            ->where('p.estado', true);

        if ($tipo) {
            $query->where('p.tipo', $tipo);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('p.descripcion', 'like', "%{$search}%")
                    ->orWhere('p.codigo_producto', 'like', "%{$search}%");
            });
        }

        $productos = $query
            ->orderBy('p.tipo')
            ->orderBy('p.descripcion')
            ->limit(50)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'codigo' => $p->codigo,
                'descripcion' => $p->descripcion,
                'especificaciones' => $p->especificaciones,
                'unidad_id' => $p->unidad_id,
                'diccionario_id' => $p->diccionario_id,
                'tipo_proveedor' => $p->tipo_proveedor,
                'precio' => (float) $p->precio,
                'costo_unitario_lista' => (float) $p->costo_unitario_lista,
                'costo_flete' => (float) $p->costo_flete,
                'tipo' => $p->tipo,
                'diccionario' => $p->diccionario_id_rel ? [
                    'id' => $p->diccionario_id_rel,
                    'codigo' => $p->diccionario_codigo,
                    'descripcion' => $p->diccionario_descripcion,
                ] : null,
                'unidad' => $p->unidad_id_rel ? [
                    'id' => $p->unidad_id_rel,
                    'descripcion' => $p->unidad_descripcion,
                    'descripcion_singular' => $p->unidad_descripcion_singular,
                    'abreviatura_unidad' => $p->abreviatura_unidad,
                ] : null,
            ]);

        return response()->json([
            'success' => true,
            'productos' => $productos,
        ]);
    }

    /**
     * Listar especialidades del presupuesto general.
     * GET /costos/proyectos/{project}/presupuesto/insumos/especialidades
     */
    public function especialidades(Request $request, $project): JsonResponse
    {
        $connection = DB::connection('costos_tenant');

        $projectModel = $project instanceof CostoProject
            ? $project
            : CostoProject::findOrFail($project);
        $tenantPresupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($projectModel->database_name);

        // Obtener todas y filtrar en memoria
        $todas = $connection->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->get(['partida', 'descripcion']);

        // Filtrar estrictamente solo aquellas partidas que sean exactamente un par de nÃºmeros (ej. '01', '02', '10')
        $especialidades = $todas->filter(function ($item) {
            $cleanPartida = trim((string) $item->partida);

            return preg_match('/^\d{2}$/', $cleanPartida);
        })->sortBy('partida')->values();

        // Formatear para el frontend listando "02 Estructuras"
        $formatted = $especialidades->map(function ($item) {
            $cleanPartida = trim((string) $item->partida);

            return [
                'value' => $cleanPartida, // enviamos '02' para que en la bÃºsqueda (like 02%) coincida perfectamente
                'label' => $cleanPartida.' '.$item->descripcion,
            ];
        });

        return response()->json([
            'success' => true,
            'especialidades' => $formatted,
        ]);
    }

    /**
     * Listar diccionarios.
     * GET /costos/proyectos/{project}/presupuesto/insumos/diccionarios
     */
    public function diccionarios(): JsonResponse
    {
        $diccionarios = DB::connection('costos_tenant')
            ->table('diccionario')
            ->orderBy('descripcion')
            ->get();

        return response()->json([
            'success' => true,
            'diccionarios' => $diccionarios,
        ]);
    }

    /**
     * Listar unidades.
     * GET /costos/proyectos/{project}/presupuesto/insumos/unidades
     */
    public function unidades(): JsonResponse
    {
        $unidades = DB::connection('costos_tenant')
            ->table('unidad')
            ->orderBy('descripcion_singular')
            ->get();

        return response()->json([
            'success' => true,
            'unidades' => $unidades,
        ]);
    }

    /**
     * Crear un nuevo producto/insumo.
     * POST /costos/proyectos/{project}/presupuesto/insumos
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'descripcion' => 'required|string',
            'especificaciones' => 'nullable|string',
            'unidad_id' => 'required|integer',
            'diccionario_id' => 'required|integer',
            'tipo_proveedor' => 'required|string|size:3',
            'costo_unitario_lista' => 'required|numeric|min:0',
            'costo_unitario' => 'required|numeric|min:0',
            'costo_flete' => 'nullable|numeric|min:0',
            'fecha_lista' => 'nullable|date',
            'tipo' => 'required|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'estado' => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        // Generar cÃ³digo de producto automÃ¡ticamente
        $diccionario = $connection->table('diccionario')->where('id', $validated['diccionario_id'])->first();
        if (! $diccionario) {
            return response()->json(['success' => false, 'message' => 'Diccionario invÃ¡lido.'], 422);
        }

        $diccionarioCodigo = data_get($diccionario, 'codigo', '');
        $prefix = $diccionarioCodigo.$validated['tipo_proveedor'];

        $lastM = $connection->table('insumo_productos')
            ->where('codigo_producto', 'like', $prefix.'%')
            ->orderBy('codigo_producto', 'desc')
            ->first();

        $nextSequence = 1;
        if ($lastM) {
            $lastSequence = substr((string) $lastM->codigo_producto, strlen($prefix));
            if (is_numeric($lastSequence)) {
                $nextSequence = intval($lastSequence) + 1;
            }
        }

        $codigoProducto = $prefix.str_pad($nextSequence, 4, '0', STR_PAD_LEFT);

        $now = now();
        $id = $connection->table('insumo_productos')->insertGetId(array_merge($validated, [
            'codigo_producto' => $codigoProducto,
            'estado' => $validated['estado'] ?? true,
            'costo_flete' => $validated['costo_flete'] ?? 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]));

        $producto = $connection->table('insumo_productos')->where('id', $id)->first();

        return response()->json([
            'success' => true,
            'message' => 'Producto creado exitosamente',
            'producto' => $producto,
        ], 201);
    }

    /**
     * Actualizar un producto/insumo existente.
     * PUT /costos/proyectos/{project}/presupuesto/insumos/{insumoId}
     */
    public function update(Request $request, $project, $insumoId): JsonResponse
    {
        $validated = $request->validate([
            'descripcion' => 'sometimes|string',
            'especificaciones' => 'nullable|string',
            'unidad_id' => 'sometimes|integer',
            'diccionario_id' => 'sometimes|integer',
            'tipo_proveedor' => 'sometimes|string|size:3',
            'costo_unitario_lista' => 'sometimes|numeric|min:0',
            'costo_unitario' => 'sometimes|numeric|min:0',
            'costo_flete' => 'nullable|numeric|min:0',
            'fecha_lista' => 'nullable|date',
            'tipo' => 'sometimes|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'estado' => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        // We assume auto-generated codes don't change frequently. If they do, they'll be left as is.

        $connection->table('insumo_productos')
            ->where('id', $insumoId)
            ->update(array_merge($validated, ['updated_at' => now()]));

        $producto = $connection->table('insumo_productos')->where('id', $insumoId)->first();

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // PROPAGACIÃ“N DE PRECIO A ACUS Y PRESUPUESTO
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if ($producto) {
            app(CostoDatabaseService::class)->propagateInsumoUpdate($project, $producto);
        }

        return response()->json([
            'success' => true,
            'message' => 'Producto actualizado exitosamente',
            'producto' => $producto,
        ]);
    }

    /**
     * Eliminar un producto/insumo.
     * DELETE /costos/proyectos/{project}/presupuesto/insumos/{insumoId}
     */
    public function destroy($project, $insumoId): JsonResponse
    {
        DB::connection('costos_tenant')
            ->table('insumo_productos')
            ->where('id', $insumoId)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Producto eliminado exitosamente',
        ]);
    }

    /**
     * Reemplazar o renombrar un insumo a nivel de todo el proyecto.
     * POST /costos/proyectos/{project}/presupuesto/insumos/replace-project-insumo
     */
    public function replaceProjectInsumo(Request $request, $project): JsonResponse
    {
        $validated = $request->validate([
            'tipo' => 'required|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'old_insumo_id' => 'nullable|integer',
            'old_descripcion' => 'nullable|string',
            'new_insumo_id' => 'nullable|integer',
            'new_descripcion' => 'nullable|string',
            'new_precio' => 'nullable|numeric',
        ]);

        $tipo = $validated['tipo'];

        $tableMap = [
            'mano_de_obra' => ['table' => 'acu_mano_de_obra', 'price_column' => 'precio_unitario', 'unit_column' => 'unidad'],
            'materiales' => ['table' => 'acu_materiales', 'price_column' => 'precio_unitario', 'unit_column' => 'unidad'],
            'equipos' => ['table' => 'acu_equipos', 'price_column' => 'precio_hora', 'unit_column' => 'unidad'],
            'subcontratos' => ['table' => 'acu_subcontratos', 'price_column' => 'precio_unitario', 'unit_column' => 'unidad'],
            'subpartidas' => ['table' => 'acu_subpartidas', 'price_column' => 'precio_unitario', 'unit_column' => 'unidad'],
        ];

        $conf = $tableMap[$tipo];
        $connection = DB::connection('costos_tenant');

        $projectModel = $project instanceof CostoProject ? $project : CostoProject::findOrFail($project);
        $tenantPresupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($projectModel->database_name);

        $query = $connection->table("{$conf['table']} as t")
            ->join('presupuesto_acus as a', 't.acu_id', '=', 'a.id')
            ->where('a.presupuesto_id', $tenantPresupuestoId);

        if (! empty($validated['old_insumo_id'])) {
            $query->where('t.insumo_id', $validated['old_insumo_id']);
        } else {
            $query->where('t.descripcion', $validated['old_descripcion'])
                ->whereNull('t.insumo_id');
        }

        $items = $query->select('t.*')->get();

        if ($items->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontraron items para reemplazar en este proyecto.',
            ], 404);
        }

        // Si se seleccionÃ³ un insumo de catÃ¡logo para reemplazar:
        $newInsumo = null;
        if (! empty($validated['new_insumo_id'])) {
            $newInsumo = $connection->table('insumo_productos')->where('id', $validated['new_insumo_id'])->first();
            if (! $newInsumo) {
                return response()->json(['success' => false, 'message' => 'El insumo de reemplazo no existe.'], 404);
            }
        }

        $affectedAcuIds = [];

        foreach ($items as $item) {
            $affectedAcuIds[] = $item->acu_id;

            $updateData = [];
            if ($newInsumo) {
                $updateData['insumo_id'] = $newInsumo->id;
                $updateData['descripcion'] = $newInsumo->descripcion;
                $updateData[$conf['price_column']] = $newInsumo->costo_unitario;
                // Fetch unidad_nombre if needed, or leave it to join
                $unidad = $newInsumo->unidad_id ? $connection->table('unidad')->where('id', $newInsumo->unidad_id)->first() : null;
                $updateData[$conf['unit_column']] = $unidad ? ($unidad->abreviatura_unidad ?? $unidad->descripcion_singular) : null;
            } else {
                if (! empty($validated['new_descripcion'])) {
                    $updateData['descripcion'] = $validated['new_descripcion'];
                }
                if (isset($validated['new_precio'])) {
                    $updateData[$conf['price_column']] = $validated['new_precio'];
                }
            }

            if (! empty($updateData)) {
                // Recalcular parcial â€” 10 decimales (no 4), igual que calculateACU()/
                // CostoDatabaseService::recalculateAcuFromJson(). recalculateAcus() abajo
                // suma este campo directo hacia costo_unitario_total/Costo Directo; con
                // metrados grandes hasta 6dp se queda corto y se amplifica a cÃ©ntimos
                // frente a Insumos Consolidados (que recalcula cantidad Ã— precio_unitario
                // crudos, sin leer "parcial").
                $cant = (float) $item->cantidad;
                $prec = (float) ($updateData[$conf['price_column']] ?? $item->{$conf['price_column']});
                $falc = (float) ($item->factor_desperdicio ?? 1);
                $parcial = round($cant * $prec * ($tipo === 'materiales' ? $falc : 1), 10);

                $updateData['parcial'] = $parcial;
                $updateData['updated_at'] = now();

                $connection->table($conf['table'])->where('id', $item->id)->update($updateData);
            }
        }

        $affectedAcuIds = array_unique($affectedAcuIds);

        // Disparar recÃ¡lculo de los ACUs afectados
        app(CostoDatabaseService::class)->propagateInsumoUpdate($projectModel, (object) ['id' => -1]); // Triggers update for the ACUs we just saved

        // The propagateInsumoUpdate currently works differently: it takes an insumo and finds ACUs.
        // We modified ACU components directly, so we need to recalculate the ACU JSONs and totals.
        $this->recalculateAcus($connection, $affectedAcuIds, $tenantPresupuestoId, $projectModel);

        return response()->json([
            'success' => true,
            'message' => 'Insumos reemplazados correctamente en el proyecto.',
        ]);
    }

    /**
     * Actualizar nombre y/o precio de un insumo NO vinculado al catÃ¡logo
     * (insumo_id = null) en todas las tablas acu_* por coincidencia de descripciÃ³n.
     *
     * Este endpoint es el equivalente para insumos huÃ©rfanos de lo que
     * InsumoProductoController::update + CostoDatabaseService::propagateInsumoUpdate
     * hace para insumos del catÃ¡logo. No elimina ni crea registros; solo actualiza
     * descripcion y/o precio en cada fila coincidente y recalcula parciales.
     *
     * POST /costos/proyectos/{project}/presupuesto/insumos/update-unlinked
     * Body: { tipo, old_descripcion, new_descripcion?, new_precio? }
     */
    public function updateUnlinkedInsumo(Request $request, $project): JsonResponse
    {
        $validated = $request->validate([
            'tipo' => 'required|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'old_descripcion' => 'required|string',
            'new_descripcion' => 'nullable|string',
            'new_precio' => 'nullable|numeric|min:0',
        ]);

        $tipo = $validated['tipo'];
        $oldDescripcion = trim($validated['old_descripcion']);
        $newDescripcion = isset($validated['new_descripcion']) ? trim($validated['new_descripcion']) : null;
        $newPrecio = $validated['new_precio'] ?? null;

        // Al menos uno debe estar presente
        if ($newDescripcion === null && $newPrecio === null) {
            return response()->json([
                'success' => false,
                'message' => 'Debe proporcionar new_descripcion o new_precio.',
            ], 422);
        }

        $tableMap = [
            'mano_de_obra' => ['table' => 'acu_mano_de_obra',  'price_column' => 'precio_unitario'],
            'materiales' => ['table' => 'acu_materiales',    'price_column' => 'precio_unitario'],
            'equipos' => ['table' => 'acu_equipos',       'price_column' => 'precio_hora'],
            'subcontratos' => ['table' => 'acu_subcontratos',  'price_column' => 'precio_unitario'],
            'subpartidas' => ['table' => 'acu_subpartidas',   'price_column' => 'precio_unitario'],
        ];

        $conf = $tableMap[$tipo];
        $connection = DB::connection('costos_tenant');

        $projectModel = $project instanceof CostoProject ? $project : CostoProject::findOrFail($project);
        $tenantPresupuestoId = app(CostoDatabaseService::class)->getDefaultPresupuestoId($projectModel->database_name);

        // Buscar filas huÃ©rfanas que coincidan por descripciÃ³n (con o sin insumo_id â€”
        // cubrimos tambiÃ©n las que ya tienen insumo_id si se busca por old_descripcion,
        // pero solo actualizamos texto/precio en las columnas locales del ACU).
        $items = $connection->table($conf['table'])
            ->join('presupuesto_acus as a', $conf['table'].'.acu_id', '=', 'a.id')
            ->where('a.presupuesto_id', $tenantPresupuestoId)
            ->whereRaw('UPPER(TRIM('.$conf['table'].'.descripcion)) = ?', [strtoupper($oldDescripcion)])
            ->select($conf['table'].'.*')
            ->get();

        if ($items->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontraron filas con esa descripciÃ³n en el proyecto.',
            ], 404);
        }

        $affectedAcuIds = [];

        foreach ($items as $item) {
            $affectedAcuIds[] = $item->acu_id;

            $updateData = ['updated_at' => now()];

            if ($newDescripcion !== null && $newDescripcion !== '') {
                $updateData['descripcion'] = $newDescripcion;
            }

            if ($newPrecio !== null) {
                $updateData[$conf['price_column']] = $newPrecio;

                // Recalcular parcial con la nueva precision (10dp como el resto del sistema)
                $cant = (float) ($item->cantidad ?? 0);
                $factor = (float) ($item->factor_desperdicio ?? 1);
                $isMateria = ($tipo === 'materiales');
                $updateData['parcial'] = round($cant * $newPrecio * ($isMateria ? $factor : 1), 10);
            }

            $connection->table($conf['table'])
                ->where('id', $item->id)
                ->update($updateData);
        }

        $affectedAcuIds = array_unique($affectedAcuIds);
        $this->recalculateAcus($connection, $affectedAcuIds, $tenantPresupuestoId, $projectModel);

        return response()->json([
            'success' => true,
            'message' => 'Insumo actualizado y propagado correctamente.',
            'filas_afectadas' => count($items),
            'acus_afectados' => count($affectedAcuIds),
        ]);
    }

    private function recalculateAcus($connection, $affectedAcuIds, $tenantPresupuestoId, $projectModel): void
    {
        $updatedPartidas = [];
        foreach ($affectedAcuIds as $acuId) {
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
                        // 'costo_unitario_total' es una generated column y se calcula automaticamente
                        'updated_at' => now(),
                    ]);

                $updatedPartidas[] = $acu->partida;
            }
        }

        if (! empty($updatedPartidas)) {
            foreach (array_unique($updatedPartidas) as $partida) {
                $acuRes = $connection->table('presupuesto_acus')
                    ->where('presupuesto_id', $tenantPresupuestoId)
                    ->where('partida', $partida)
                    ->first();

                if ($acuRes) {
                    // Match por codigo normalizado â€” presupuesto_acus.partida y
                    // presupuesto_general.partida pueden diferir en padding de ceros
                    // (ver CostoDatabaseService::normalizePartidaCode()); un WHERE
                    // exacto puede actualizar 0 filas y dejar precio_unitario stale.
                    $dbService = app(CostoDatabaseService::class);
                    $normalizedPartida = $dbService->normalizePartidaCode($partida);
                    $generalRows = $connection->table('presupuesto_general')
                        ->where('presupuesto_id', $tenantPresupuestoId)
                        ->get(['id', 'partida']);
                    foreach ($generalRows as $generalRow) {
                        if ($dbService->normalizePartidaCode($generalRow->partida) === $normalizedPartida) {
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
            app(CostoDatabaseService::class)->syncCostoDirecto($projectModel->database_name, $tenantPresupuestoId);
        }
    }
}
