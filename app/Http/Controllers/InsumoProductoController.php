<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
            '--class' => 'Database\\Seeders\\diccionarioSeeder',
            '--force' => true,
        ]);
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\unidadSeeder',
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
            'message' => "Catálogo inicializado: {$diccionarioCount} diccionarios, {$unidadCount} unidades, {$insumoCount} insumos base.",
            'diccionarios' => $diccionarioCount,
            'unidades' => $unidadCount,
            'insumos' => $insumoCount,
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
                'unidad_id'            => $p->unidad_id,
                'diccionario_id'       => $p->diccionario_id,
                'tipo_proveedor'       => $p->tipo_proveedor,
                'precio'               => (float) $p->precio,
                'costo_unitario_lista' => (float) $p->costo_unitario_lista,
                'costo_flete'          => (float) $p->costo_flete,
                'tipo'                 => $p->tipo,
                'diccionario'          => $p->diccionario_id_rel ? [
                    'id'          => $p->diccionario_id_rel,
                    'codigo'      => $p->diccionario_codigo,
                    'descripcion' => $p->diccionario_descripcion,
                ] : null,
                'unidad'               => $p->unidad_id_rel ? [
                    'id'                   => $p->unidad_id_rel,
                    'descripcion'          => $p->unidad_descripcion,
                    'descripcion_singular' => $p->unidad_descripcion_singular,
                    'abreviatura_unidad'   => $p->abreviatura_unidad,
                ] : null,
            ]);

        return response()->json([
            'success'   => true,
            'productos' => $productos,
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
            'success'      => true,
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
            'success'  => true,
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
            'descripcion'          => 'required|string',
            'especificaciones'     => 'nullable|string',
            'unidad_id'            => 'required|integer',
            'diccionario_id'       => 'required|integer',
            'tipo_proveedor'       => 'required|string|size:3',
            'costo_unitario_lista' => 'required|numeric|min:0',
            'costo_unitario'       => 'required|numeric|min:0',
            'costo_flete'          => 'nullable|numeric|min:0',
            'fecha_lista'          => 'nullable|date',
            'tipo'                 => 'required|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'estado'               => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        // Generar código de producto automáticamente
        $diccionario = $connection->table('diccionario')->where('id', $validated['diccionario_id'])->first();
        if (!$diccionario) {
             return response()->json(['success' => false, 'message' => 'Diccionario inválido.'], 422);
        }

        $prefix = $diccionario->codigo . $validated['tipo_proveedor'];
        
        $lastM = $connection->table('insumo_productos')
            ->where('codigo_producto', 'like', $prefix . '%')
            ->orderBy('codigo_producto', 'desc')
            ->first();
            
        $nextSequence = 1;
        if ($lastM) {
            $lastSequence = substr($lastM->codigo_producto, strlen($prefix));
            if (is_numeric($lastSequence)) {
                $nextSequence = intval($lastSequence) + 1;
            }
        }
        
        $codigoProducto = $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);

        $now = now();
        $id = $connection->table('insumo_productos')->insertGetId(array_merge($validated, [
            'codigo_producto' => $codigoProducto,
            'estado'          => $validated['estado'] ?? true,
            'costo_flete'     => $validated['costo_flete'] ?? 0,
            'created_at'      => $now,
            'updated_at'      => $now,
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
            'descripcion'          => 'sometimes|string',
            'especificaciones'     => 'nullable|string',
            'unidad_id'            => 'sometimes|integer',
            'diccionario_id'       => 'sometimes|integer',
            'tipo_proveedor'       => 'sometimes|string|size:3',
            'costo_unitario_lista' => 'sometimes|numeric|min:0',
            'costo_unitario'       => 'sometimes|numeric|min:0',
            'costo_flete'          => 'nullable|numeric|min:0',
            'fecha_lista'          => 'nullable|date',
            'tipo'                 => 'sometimes|in:mano_de_obra,materiales,equipos,subcontratos,subpartidas',
            'estado'               => 'nullable|boolean',
        ]);

        $connection = DB::connection('costos_tenant');

        // We assume auto-generated codes don't change frequently. If they do, they'll be left as is.

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

