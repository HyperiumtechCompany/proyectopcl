<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class InsumoProductoController extends Controller
{
    /**
     * Seed the insumos catalog (clases + productos) in the current tenant DB.
     * POST /costos/proyectos/{project}/presupuesto/insumos/seed
     */
    public function seedCatalog(): JsonResponse
    {
        $connection = DB::connection('costos_tenant');

        // Ensure insumo tables exist (run migration if needed)
        if (!Schema::connection('costos_tenant')->hasTable('insumo_clases')) {
            Artisan::call('migrate', [
                '--database' => 'costos_tenant',
                '--path' => 'database/migrations/costos_tenant/2026_03_07_000001_create_presupuesto_unificado_tables.php',
                '--force' => true,
            ]);
        }

        // Run the seeder
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\InsumoProductoSeeder',
            '--force' => true,
        ]);

        $claseCount = $connection->table('insumo_clases')->count();
        $productoCount = $connection->table('insumo_productos')->count();

        return response()->json([
            'success' => true,
            'message' => "Catálogo inicializado: {$claseCount} clases, {$productoCount} productos.",
            'clases' => $claseCount,
            'productos' => $productoCount,
        ]);
    }
    /**
     * Buscar productos/insumos por descripción o código.
     * GET /costos/proyectos/{project}/presupuesto/insumos/search?q=cemento&tipo=materiales
     */
    public function search(Request $request): JsonResponse
    {
        $connection = DB::connection('costos_tenant');

        $query = $connection->table('insumo_productos as p')
            ->leftJoin('insumo_clases as c', 'p.insumo_clase_id', '=', 'c.id')
            ->select([
                'p.id',
                'p.codigo_producto as codigo',
                'p.descripcion',
                'p.especificaciones',
                'p.unidad',
                'p.costo_unitario as precio',
                'p.costo_unitario_lista',
                'p.costo_flete',
                'p.tipo',
                'c.id as clase_id',
                'c.codigo as clase_codigo',
                'c.descripcion as clase_descripcion',
            ])
            ->where('p.estado', true);

        // Filtrar por tipo si se proporciona
        if ($request->filled('tipo')) {
            $query->where('p.tipo', $request->input('tipo'));
        }

        // Buscar por descripción o código
        if ($request->filled('q')) {
            $term = $request->input('q');
            $query->where(function ($q) use ($term) {
                $q->where('p.descripcion', 'like', "%{$term}%")
                  ->orWhere('p.codigo_producto', 'like', "%{$term}%");
            });
        }

        $productos = $query
            ->orderBy('p.tipo')
            ->orderBy('p.descripcion')
            ->limit(50)
            ->get()
            ->map(fn($p) => [
                'id'                   => $p->id,
                'codigo'               => $p->codigo,
                'descripcion'          => $p->descripcion,
                'especificaciones'     => $p->especificaciones,
                'unidad'               => $p->unidad,
                'precio'               => (float) $p->precio,
                'costo_unitario_lista' => (float) $p->costo_unitario_lista,
                'costo_flete'          => (float) $p->costo_flete,
                'tipo'                 => $p->tipo,
                'clase'                => $p->clase_id ? [
                    'id'          => $p->clase_id,
                    'codigo'      => $p->clase_codigo,
                    'descripcion' => $p->clase_descripcion,
                ] : null,
            ]);

        return response()->json([
            'success'   => true,
            'productos' => $productos,
        ]);
    }

    /**
     * Listar clases de insumos.
     * GET /costos/proyectos/{project}/presupuesto/insumos/clases
     */
    public function clases(): JsonResponse
    {
        $clases = DB::connection('costos_tenant')
            ->table('insumo_clases')
            ->orderBy('codigo')
            ->get();

        return response()->json([
            'success' => true,
            'clases'  => $clases,
        ]);
    }

    /**
     * Crear un nuevo producto/insumo.
     * POST /costos/proyectos/{project}/presupuesto/insumos
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codigo_producto'      => 'required|string|max:50',
            'descripcion'          => 'required|string',
            'especificaciones'     => 'nullable|string',
            'unidad'               => 'required|string|max:20',
            'costo_unitario_lista' => 'required|numeric|min:0',
            'costo_unitario'       => 'required|numeric|min:0',
            'costo_flete'          => 'nullable|numeric|min:0',
            'fecha_lista'          => 'nullable|date',
            'insumo_clase_id'      => 'required|integer',
            'tipo'                 => 'required|in:mano_de_obra,materiales,equipos',
            'estado'               => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        // Check unique codigo_producto in tenant DB
        $exists = $connection->table('insumo_productos')
            ->where('codigo_producto', $validated['codigo_producto'])
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'Ya existe un producto con ese código.',
            ], 422);
        }

        $now = now();
        $id = $connection->table('insumo_productos')->insertGetId(array_merge($validated, [
            'estado'     => $validated['estado'] ?? true,
            'costo_flete' => $validated['costo_flete'] ?? 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]));

        $producto = $connection->table('insumo_productos')->where('id', $id)->first();

        return response()->json([
            'success'  => true,
            'message'  => 'Producto creado exitosamente',
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
            'codigo_producto'      => 'sometimes|string|max:50',
            'descripcion'          => 'sometimes|string',
            'especificaciones'     => 'nullable|string',
            'unidad'               => 'sometimes|string|max:20',
            'costo_unitario_lista' => 'sometimes|numeric|min:0',
            'costo_unitario'       => 'sometimes|numeric|min:0',
            'costo_flete'          => 'nullable|numeric|min:0',
            'fecha_lista'          => 'nullable|date',
            'insumo_clase_id'      => 'sometimes|integer',
            'tipo'                 => 'sometimes|in:mano_de_obra,materiales,equipos',
            'estado'               => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        $connection->table('insumo_productos')
            ->where('id', $insumoId)
            ->update(array_merge($validated, ['updated_at' => now()]));

        $producto = $connection->table('insumo_productos')->where('id', $insumoId)->first();

        return response()->json([
            'success'  => true,
            'message'  => 'Producto actualizado exitosamente',
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
}
