<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\EttpPartida;
use App\Models\EttpSeccion;
use App\Models\EttpImagen;
use App\Models\CostoProject;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class EttpController extends Controller
{
    /**
     * Muestra la vista principal de ETTP
     * Ruta: /module/etts?project={id}
     */
    public function show(CostoProject $costoProject, Request $request)
    {
        $proyectoId = $costoProject->id;

        // Cargar partidas con sus secciones e imágenes (eager loading)
        $partidas = EttpPartida::where('presupuesto_id', $proyectoId)
            ->with(['secciones.imagenes'])
            ->raices()
            ->orderBy('item_order')
            ->get();

        // Construir árbol jerárquico
        $arbol = $this->buildTree($partidas, $proyectoId);

        return Inertia::render('costos/ettp/etts', [
            'proyecto'   => array_merge($costoProject->toArray(), [
                'plantilla_logo_izq_url'  => $costoProject->plantilla_logo_izq
                    ? asset('storage/' . $costoProject->plantilla_logo_izq) : null,
                'plantilla_logo_der_url'  => $costoProject->plantilla_logo_der
                    ? asset('storage/' . $costoProject->plantilla_logo_der) : null,
                'portada_logo_center_url' => $costoProject->portada_logo_center
                    ? asset('storage/' . $costoProject->portada_logo_center) : null,
                'plantilla_firma_url'     => $costoProject->plantilla_firma
                    ? asset('storage/' . $costoProject->plantilla_firma) : null,
            ]),
            'partidas'       => $arbol,
            'especialidades' => $this->getEspecialidadesDisponibles($proyectoId),
        ]);
    }

    /**
     * Construye el árbol jerárquico de partidas con sus secciones.
     */
    private function buildTree($partidas, $presupuestoId): array
    {
        // Cargar TODAS las partidas del presupuesto para construir el árbol
        $todas = EttpPartida::where('presupuesto_id', $presupuestoId)
            ->with(['secciones.imagenes'])
            ->orderBy('item_order')
            ->get()
            ->keyBy('id');

        $tree = [];

        foreach ($todas as $partida) {
            $node = $this->formatPartida($partida);

            if ($partida->parent_id && $todas->has($partida->parent_id)) {
                // Es hija, se agrega después
            } else {
                $tree[] = $node;
            }
        }

        // Asignar hijos recursivamente
        return $this->attachChildren($tree, $todas);
    }

    /**
     * Formatea una partida para el frontend.
     */
    private function formatPartida($partida): array
    {
        return [
            'id'            => $partida->id,
            'item'          => $partida->item,
            'partida'       => $partida->partida,
            'descripcion'   => $partida->descripcion,
            'unidad'        => $partida->unidad,
            'especialidad'  => $partida->especialidad,
            'estado'        => $partida->estado,
            'huerfano'      => $partida->huerfano,
            'nivel'         => $partida->nivel,
            'secciones'     => $partida->secciones->map(fn($s) => [
                'id'        => $s->id,
                'title'     => $s->titulo,
                'titulo'    => $s->titulo,
                'slug'      => $s->slug,
                'content'   => $s->contenido,
                'contenido' => $s->contenido,
                'origen'    => $s->origen,
                'orden'     => $s->orden,
                'imagenes'  => $s->imagenes->map(fn($i) => [
                    'id'              => $i->id,
                    'nombre_archivo'  => $i->nombre_archivo,
                    'nombre_original' => $i->nombre_original,
                    'caption'         => $i->caption,
                    'url'             => $i->url,
                    'orden'           => $i->orden,
                ])->toArray(),
            ])->toArray(),
            '_children' => [],
        ];
    }

    /**
     * Asigna hijos recursivamente al árbol.
     */
    private function attachChildren(array $tree, $todas): array
    {
        foreach ($tree as &$node) {
            $children = $todas->where('parent_id', $node['id'])->values();
            if ($children->isNotEmpty()) {
                $childNodes = $children->map(fn($p) => $this->formatPartida($p))->toArray();
                $node['_children'] = $this->attachChildren($childNodes, $todas);
            }
        }
        return $tree;
    }

    /**
     * Lista las especialidades que tienen resúmenes de metrados disponibles.
     */
    private function getEspecialidadesDisponibles($presupuestoId): array
    {
        $especialidades = [];
        $tablas = [
            'arquitectura'   => 'metrado_arquitectura_resumen',
            'estructuras'    => 'metrado_estructura_resumen',
            'sanitarias'     => 'metrado_sanitarias_resumen',
            'electricas'     => 'metrado_electricas_resumen',
            'comunicaciones' => 'metrado_comunicaciones_resumen',
            'gas'            => 'metrado_gas_resumen',
        ];

        foreach ($tablas as $nombre => $tabla) {
            try {
                $count = DB::connection('costos_tenant')
                    ->table($tabla)
                    ->where('presupuesto_id', $presupuestoId)
                    ->count();

                $especialidades[] = [
                    'nombre' => $nombre,
                    'tabla'  => $tabla,
                    'total'  => $count,
                    'disponible' => $count > 0,
                ];
            } catch (\Exception $e) {
                $especialidades[] = [
                    'nombre' => $nombre,
                    'tabla'  => $tabla,
                    'total'  => 0,
                    'disponible' => false,
                ];
            }
        }

        return $especialidades;
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: IMPORTAR METRADOS → ETTP
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Importa partidas desde un resumen de metrados al sistema ETTP.
     * POST /ettp/importar-metrados
     */
    public function importarMetrados(CostoProject $costoProject, Request $request)
    {
        $presupuestoId = $costoProject->id;
        
        $flags = [
            'arquitectura'   => $request->input('arquitectura', 0),
            'estructura'     => $request->input('estructura', 0),
            'sanitarias'     => $request->input('sanitarias', 0),
            'electricas'     => $request->input('electricas', 0),
            'comunicacion'   => $request->input('comunicacion', 0),
            'gas'            => $request->input('gas', 0),
        ];

        $especialidadesAImportar = [];
        foreach ($flags as $key => $value) {
            if ($value == 1) {
                // Ajuste de nombres internos (frontend comunicacion -> backend comunicaciones)
                $name = ($key === 'estructura') ? 'estructuras' : (($key === 'comunicacion') ? 'comunicaciones' : $key);
                $especialidadesAImportar[] = $name;
            }
        }

        if (empty($especialidadesAImportar)) {
            return response()->json(['error' => 'No se seleccionó ninguna especialidad'], 422);
        }

        DB::connection('costos_tenant')->beginTransaction();

        try {
            foreach ($especialidadesAImportar as $especialidad) {
                $tablaResumen = $this->getTablaResumen($especialidad);
                if (!$tablaResumen) continue;

                $resumen = DB::connection('costos_tenant')
                    ->table($tablaResumen)
                    ->where('presupuesto_id', $presupuestoId)
                    ->orderBy('item_order')
                    ->get();

                if ($resumen->isEmpty()) continue;

                // Obtener ETTP existentes de esta especialidad
                $ettpExistentes = EttpPartida::where('presupuesto_id', $presupuestoId)
                    ->where('especialidad', $especialidad)
                    ->get()
                    ->keyBy('resumen_source_id');

                $idsResumen = $resumen->pluck('id')->toArray();
                $ettpIds = $ettpExistentes->pluck('resumen_source_id')->filter()->toArray();
                $idsEliminados = array_diff($ettpIds, $idsResumen);

                // Marcar huérfanas
                if (!empty($idsEliminados)) {
                    EttpPartida::where('presupuesto_id', $presupuestoId)
                        ->where('especialidad', $especialidad)
                        ->whereIn('resumen_source_id', $idsEliminados)
                        ->update(['huerfano' => true]);
                }

                // Desmarcar las que volvieron
                EttpPartida::where('presupuesto_id', $presupuestoId)
                    ->where('especialidad', $especialidad)
                    ->whereIn('resumen_source_id', $idsResumen)
                    ->where('huerfano', true)
                    ->update(['huerfano' => false]);

                // Importar
                foreach ($resumen as $index => $fila) {
                    $existente = $ettpExistentes->get($fila->id);
                    $descripcion = $fila->descripcion ?? $fila->titulo ?? 'Sin descripción';

                    if ($existente) {
                        $existente->update([
                            'item'        => $fila->item ?? $existente->item,
                            'descripcion' => $descripcion,
                            'unidad'      => $fila->und ?? $fila->unidad ?? $existente->unidad,
                            'item_order'  => $index,
                            'nivel'       => $fila->nivel ?? 0,
                            'huerfano'    => false,
                        ]);
                    } else {
                        $partida = EttpPartida::create([
                            'presupuesto_id'      => $presupuestoId,
                            'especialidad'        => $especialidad,
                            'item'                => $fila->item ?? '',
                            'partida'             => $fila->partida ?? null,
                            'descripcion'         => $descripcion,
                            'unidad'              => $fila->und ?? $fila->unidad ?? '',
                            'resumen_source_id'   => $fila->id,
                            'resumen_source_table' => $tablaResumen,
                            'nivel'               => $fila->nivel ?? 0,
                            'item_order'          => $index,
                            'estado'              => 'pendiente',
                        ]);

                        foreach (EttpSeccion::seccionesDefault() as $seccion) {
                            EttpSeccion::create([
                                'ettp_partida_id' => $partida->id,
                                'titulo'          => $seccion['titulo'],
                                'slug'            => $seccion['slug'],
                                'origen'          => 'manual',
                                'orden'           => $seccion['orden'],
                            ]);
                        }
                    }
                }

                $this->resolverJerarquia($presupuestoId, $especialidad, $resumen);
            }

            DB::connection('costos_tenant')->commit();

            // Retornar el árbol actualizado para el frontend
            $partidasImportadas = EttpPartida::where('presupuesto_id', $presupuestoId)
                ->with(['secciones.imagenes'])
                ->raices()
                ->orderBy('item_order')
                ->get();
            
            return response()->json($this->buildTree($partidasImportadas, $presupuestoId));

        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error('Error batch import ETTP', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Resuelve la jerarquía padre-hijo de las partidas ETTP
     * basándose en los parent_id del resumen de metrados.
     */
    private function resolverJerarquia($presupuestoId, $especialidad, $resumen): void
    {
        // Mapa: resumen_source_id → ettp_partida_id
        $mapaIds = EttpPartida::where('presupuesto_id', $presupuestoId)
            ->where('especialidad', $especialidad)
            ->whereNotNull('resumen_source_id')
            ->pluck('id', 'resumen_source_id')
            ->toArray();

        foreach ($resumen as $fila) {
            if (!empty($fila->parent_id) && isset($mapaIds[$fila->id]) && isset($mapaIds[$fila->parent_id])) {
                EttpPartida::where('id', $mapaIds[$fila->id])
                    ->update(['parent_id' => $mapaIds[$fila->parent_id]]);
            }
        }
    }

    /**
     * Retorna el nombre de la tabla resumen según la especialidad.
     */
    private function getTablaResumen(string $especialidad): ?string
    {
        $map = [
            'arquitectura'   => 'metrado_arquitectura_resumen',
            'estructuras'    => 'metrado_estructura_resumen',
            'sanitarias'     => 'metrado_sanitarias_resumen',
            'electricas'     => 'metrado_electricas_resumen',
            'comunicaciones' => 'metrado_comunicaciones_resumen',
            'gas'            => 'metrado_gas_resumen',
        ];

        return $map[$especialidad] ?? null;
    }

    /**
     * Guarda cambios generales en las partidas (ítems, descripciones, etc) desde el árbol.
     * POST /guardar-especificaciones-tecnicas/{proyectoId}
     */
    public function guardarEspecificaciones(CostoProject $costoProject, Request $request)
    {
        $data = $request->input('especificaciones_tecnicas', []);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            $this->recursiveSavePartidas($data);
            DB::connection('costos_tenant')->commit();
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error('Error saving ETTP specifications', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Guarda recursivamente las partidas del árbol.
     */
    private function recursiveSavePartidas(array $nodes): void
    {
        foreach ($nodes as $node) {
            if (isset($node['id'])) {
                $partida = EttpPartida::find($node['id']);
                if ($partida) {
                    $partida->update([
                        'item'        => $node['item'] ?? $partida->item,
                        'descripcion' => $node['descripcion'] ?? $partida->descripcion,
                        'unidad'      => $node['unidad'] ?? $partida->unidad,
                    ]);
                }
            }

            if (!empty($node['_children'])) {
                $this->recursiveSavePartidas($node['_children']);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: CRUD DE SECCIONES
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Obtiene las secciones de una partida con sus imágenes.
     * GET /ettp/partida/{id}/secciones
     */
    public function getSecciones(CostoProject $costoProject, $partidaId)
    {
        $partida = EttpPartida::where('presupuesto_id', $costoProject->id)
            ->with('secciones.imagenes')
            ->findOrFail($partidaId);

        return response()->json([
            'partida'   => [
                'id'          => $partida->id,
                'item'        => $partida->item,
                'descripcion' => $partida->descripcion,
                'estado'      => $partida->estado,
                'huerfano'    => $partida->huerfano,
            ],
            'secciones' => $partida->secciones->map(fn($s) => [
                'id'        => $s->id,
                'title'     => $s->titulo,
                'titulo'    => $s->titulo,
                'slug'      => $s->slug,
                'content'   => $s->contenido,
                'contenido' => $s->contenido,
                'origen'    => $s->origen,
                'orden'     => $s->orden,
                'imagenes'  => $s->imagenes->map(fn($i) => [
                    'id'              => $i->id,
                    'nombre_archivo'  => $i->nombre_archivo,
                    'nombre_original' => $i->nombre_original,
                    'caption'         => $i->caption,
                    'url'             => $i->url,
                    'orden'           => $i->orden,
                ])->toArray(),
            ])->toArray(),
        ]);
    }

    /**
     * Guarda/actualiza las secciones de una partida.
     * PUT /ettp/partida/{id}/secciones
     */
    public function guardarSecciones(CostoProject $costoProject, Request $request, $partidaId)
    {
        $partida = EttpPartida::where('presupuesto_id', $costoProject->id)->findOrFail($partidaId);
        $secciones = $request->input('secciones', []);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            foreach ($secciones as $seccionData) {
                $titulo    = $seccionData['titulo'] ?? $seccionData['title'] ?? '';
                $contenido = $seccionData['contenido'] ?? $seccionData['content'] ?? null;

                if (isset($seccionData['id'])) {
                    // Actualizar sección existente
                    $seccion = EttpSeccion::find($seccionData['id']);
                    if ($seccion) {
                        $seccion->update([
                            'titulo'    => $titulo,
                            'slug'      => EttpSeccion::generarSlug($titulo),
                            'contenido' => $contenido,
                            'orden'     => $seccionData['orden'] ?? $seccion->orden,
                        ]);
                    }
                } else {
                    // Crear nueva sección
                    EttpSeccion::create([
                        'ettp_partida_id' => $partida->id,
                        'titulo'          => $titulo,
                        'slug'            => EttpSeccion::generarSlug($titulo),
                        'contenido'       => $contenido,
                        'origen'          => 'manual',
                        'orden'           => $seccionData['orden'] ?? 0,
                    ]);
                }
            }

            // Actualizar estado de la partida
            $partida->update(['estado' => 'en_progreso']);

            DB::connection('costos_tenant')->commit();

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Elimina una sección específica.
     * DELETE /ettp/seccion/{id}
     */
    public function eliminarSeccion(CostoProject $costoProject, $seccionId)
    {
        $seccion = EttpSeccion::with('partida')->findOrFail($seccionId);

        if ($seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para eliminar esta sección');
        }

        // Las imágenes se eliminan por cascade + el model event borra archivos
        $seccion->delete();

        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: IMÁGENES
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Sube una imagen a una sección.
     * POST /ettp/seccion/{id}/imagen
     */
    public function subirImagen(CostoProject $costoProject, Request $request, $seccionId)
    {
        $request->validate([
            'imagen' => 'required|image|max:5120', // 5MB max
        ]);

        $seccion = EttpSeccion::with('partida')->findOrFail($seccionId);

        // Validar que la sección pertenece al proyecto
        if ($seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para subir imágenes a esta sección');
        }

        $presupuestoId = $costoProject->id;

        $file = $request->file('imagen');
        $extension = $file->getClientOriginalExtension();
        $nombreOriginal = $file->getClientOriginalName();
        $nombreArchivo = Str::uuid() . '_' . Str::slug(pathinfo($nombreOriginal, PATHINFO_FILENAME)) . '.' . $extension;

        // Guardar en storage local
        $path = $file->storeAs(
            "public/ettp/{$presupuestoId}",
            $nombreArchivo
        );

        // Obtener dimensiones si es posible
        $dimensions = @getimagesize($file->getRealPath());

        $imagen = EttpImagen::create([
            'ettp_seccion_id' => $seccion->id,
            'nombre_archivo'  => $nombreArchivo,
            'nombre_original' => $nombreOriginal,
            'caption'         => $request->input('caption'),
            'orden'           => EttpImagen::where('ettp_seccion_id', $seccion->id)->count(),
            'ancho'           => $dimensions ? $dimensions[0] : null,
            'alto'            => $dimensions ? $dimensions[1] : null,
        ]);

        return response()->json([
            'success' => true,
            'imagen'  => [
                'id'              => $imagen->id,
                'nombre_archivo'  => $imagen->nombre_archivo,
                'nombre_original' => $imagen->nombre_original,
                'url'             => $imagen->url,
                'caption'         => $imagen->caption,
            ],
        ]);
    }

    /**
     * Elimina una imagen (registro + archivo físico).
     * DELETE /ettp/imagen/{id}
     */
    public function eliminarImagen(CostoProject $costoProject, $imagenId)
    {
        $imagen = EttpImagen::with('seccion.partida')->findOrFail($imagenId);

        if ($imagen->seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para eliminar esta imagen');
        }
        // El model event `deleting` elimina el archivo físico
        $imagen->delete();

        return response()->json(['success' => true]);
    }


    // ══════════════════════════════════════════════════════════════════════
    // API: GESTIÓN DE PARTIDAS HUÉRFANAS
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Obtiene las partidas huérfanas de un presupuesto.
     * GET /ettp/huerfanas/{presupuestoId}
     */
    public function getHuerfanas(CostoProject $costoProject)
    {
        $huerfanas = EttpPartida::where('presupuesto_id', $costoProject->id)
            ->huerfanas()
            ->with('secciones')
            ->get();

        return response()->json([
            'total'     => $huerfanas->count(),
            'partidas'  => $huerfanas->map(fn($p) => [
                'id'          => $p->id,
                'item'        => $p->item,
                'descripcion' => $p->descripcion,
                'especialidad' => $p->especialidad,
                'tiene_contenido' => $p->secciones->some(fn($s) => !empty($s->contenido)),
            ])->toArray(),
        ]);
    }

    /**
     * Elimina partidas huérfanas seleccionadas.
     * POST /ettp/eliminar-huerfanas
     */
    public function eliminarHuerfanas(CostoProject $costoProject, Request $request)
    {
        $ids = $request->input('ids', []);

        $partidas = EttpPartida::where('presupuesto_id', $costoProject->id)
            ->whereIn('id', $ids)
            ->huerfanas()
            ->get();

        foreach ($partidas as $partida) {
            // Eliminar imágenes físicas de todas las secciones
            foreach ($partida->secciones as $seccion) {
                foreach ($seccion->imagenes as $imagen) {
                    $imagen->delete(); // El model event elimina el archivo
                }
            }
            $partida->delete(); // Cascade elimina secciones
        }

        return response()->json([
            'success'    => true,
            'eliminadas' => $partidas->count(),
        ]);
    }
}