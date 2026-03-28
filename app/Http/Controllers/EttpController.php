<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\EttpPartida;
use App\Models\EttpSeccion;
use App\Models\EttpImagen;
use App\Models\EttpTemplate;
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
    public function show(Request $request)
    {
        $proyectoId = $request->query('project');

        $proyecto = CostoProject::find($proyectoId);

        // Cargar partidas con sus secciones e imágenes (eager loading)
        $partidas = EttpPartida::where('presupuesto_id', $proyectoId)
            ->with(['secciones.imagenes'])
            ->raices()
            ->orderBy('item_order')
            ->get();

        // Construir árbol jerárquico
        $arbol = $this->buildTree($partidas, $proyectoId);

        return Inertia::render('costos/ettp/etts', [
            'proyecto'   => $proyecto,
            'partidas'   => $arbol,
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
                'titulo'    => $s->titulo,
                'slug'      => $s->slug,
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
    public function importarMetrados(Request $request)
    {
        $request->validate([
            'presupuesto_id' => 'required|integer',
            'especialidad'   => 'required|string',
        ]);

        $presupuestoId = $request->input('presupuesto_id');
        $especialidad  = $request->input('especialidad');

        $tablaResumen = $this->getTablaResumen($especialidad);
        if (!$tablaResumen) {
            return response()->json(['error' => "Especialidad '{$especialidad}' no válida"], 422);
        }

        try {
            // Obtener partidas del resumen de metrados
            $resumen = DB::connection('costos_tenant')
                ->table($tablaResumen)
                ->where('presupuesto_id', $presupuestoId)
                ->orderBy('item_order')
                ->get();

            if ($resumen->isEmpty()) {
                return response()->json(['error' => 'No hay datos en el resumen de metrados'], 404);
            }

            $creadas = 0;
            $actualizadas = 0;
            $huerfanas = 0;

            DB::connection('costos_tenant')->beginTransaction();

            // Obtener IDs actuales del resumen
            $idsResumen = $resumen->pluck('id')->toArray();

            // Obtener ETTP existentes de esta especialidad
            $ettpExistentes = EttpPartida::where('presupuesto_id', $presupuestoId)
                ->where('especialidad', $especialidad)
                ->get()
                ->keyBy('resumen_source_id');

            // Marcar huérfanas: las que ya no están en el resumen
            $ettpIds = $ettpExistentes->pluck('resumen_source_id')->filter()->toArray();
            $idsEliminados = array_diff($ettpIds, $idsResumen);

            if (!empty($idsEliminados)) {
                EttpPartida::where('presupuesto_id', $presupuestoId)
                    ->where('especialidad', $especialidad)
                    ->whereIn('resumen_source_id', $idsEliminados)
                    ->update(['huerfano' => true]);
                $huerfanas = count($idsEliminados);
            }

            // Desmarcar las que volvieron a aparecer
            EttpPartida::where('presupuesto_id', $presupuestoId)
                ->where('especialidad', $especialidad)
                ->whereIn('resumen_source_id', $idsResumen)
                ->where('huerfano', true)
                ->update(['huerfano' => false]);

            // Importar/actualizar partidas
            foreach ($resumen as $index => $fila) {
                $existente = $ettpExistentes->get($fila->id);

                if ($existente) {
                    // Actualizar datos desde el resumen
                    $existente->update([
                        'item'        => $fila->item ?? null,
                        'descripcion' => $fila->descripcion ?? $fila->titulo ?? null,
                        'unidad'      => $fila->und ?? $fila->unidad ?? null,
                        'item_order'  => $index,
                        'nivel'       => $fila->nivel ?? 0,
                        'huerfano'    => false,
                    ]);
                    $actualizadas++;
                } else {
                    // Crear nueva partida ETTP
                    $partida = EttpPartida::create([
                        'presupuesto_id'      => $presupuestoId,
                        'especialidad'        => $especialidad,
                        'item'                => $fila->item ?? null,
                        'partida'             => $fila->partida ?? null,
                        'descripcion'         => $fila->descripcion ?? $fila->titulo ?? null,
                        'unidad'              => $fila->und ?? $fila->unidad ?? null,
                        'resumen_source_id'   => $fila->id,
                        'resumen_source_table' => $tablaResumen,
                        'parent_id'           => null, // Se resolverá después
                        'nivel'               => $fila->nivel ?? 0,
                        'item_order'          => $index,
                        'estado'              => 'pendiente',
                    ]);

                    // Crear secciones default
                    foreach (EttpSeccion::seccionesDefault() as $seccion) {
                        EttpSeccion::create([
                            'ettp_partida_id' => $partida->id,
                            'titulo'          => $seccion['titulo'],
                            'slug'            => $seccion['slug'],
                            'contenido'       => null,
                            'origen'          => 'manual',
                            'orden'           => $seccion['orden'],
                        ]);
                    }

                    $creadas++;
                }
            }

            // Resolver jerarquía padre-hijo usando parent_id del resumen
            $this->resolverJerarquia($presupuestoId, $especialidad, $resumen);

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'success'      => true,
                'creadas'      => $creadas,
                'actualizadas' => $actualizadas,
                'huerfanas'    => $huerfanas,
                'message'      => "Importación completada: {$creadas} nuevas, {$actualizadas} actualizadas, {$huerfanas} huérfanas",
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error('Error importando metrados a ETTP', [
                'error'         => $e->getMessage(),
                'presupuesto'   => $presupuestoId,
                'especialidad'  => $especialidad,
            ]);

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

    // ══════════════════════════════════════════════════════════════════════
    // API: CRUD DE SECCIONES
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Obtiene las secciones de una partida con sus imágenes.
     * GET /ettp/partida/{id}/secciones
     */
    public function getSecciones($partidaId)
    {
        $partida = EttpPartida::with('secciones.imagenes')->findOrFail($partidaId);

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
                'titulo'    => $s->titulo,
                'slug'      => $s->slug,
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
    public function guardarSecciones(Request $request, $partidaId)
    {
        $partida = EttpPartida::findOrFail($partidaId);
        $secciones = $request->input('secciones', []);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            foreach ($secciones as $seccionData) {
                if (isset($seccionData['id'])) {
                    // Actualizar sección existente
                    $seccion = EttpSeccion::find($seccionData['id']);
                    if ($seccion) {
                        $seccion->update([
                            'titulo'    => $seccionData['titulo'],
                            'slug'      => EttpSeccion::generarSlug($seccionData['titulo']),
                            'contenido' => $seccionData['contenido'] ?? null,
                            'orden'     => $seccionData['orden'] ?? $seccion->orden,
                        ]);
                    }
                } else {
                    // Crear nueva sección
                    EttpSeccion::create([
                        'ettp_partida_id' => $partida->id,
                        'titulo'          => $seccionData['titulo'],
                        'slug'            => EttpSeccion::generarSlug($seccionData['titulo']),
                        'contenido'       => $seccionData['contenido'] ?? null,
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
    public function eliminarSeccion($seccionId)
    {
        $seccion = EttpSeccion::with('imagenes')->findOrFail($seccionId);

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
    public function subirImagen(Request $request, $seccionId)
    {
        $request->validate([
            'imagen' => 'required|image|max:5120', // 5MB max
        ]);

        $seccion = EttpSeccion::with('partida')->findOrFail($seccionId);
        $presupuestoId = $seccion->partida->presupuesto_id;

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
    public function eliminarImagen($imagenId)
    {
        $imagen = EttpImagen::findOrFail($imagenId);
        // El model event `deleting` elimina el archivo físico
        $imagen->delete();

        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: TEMPLATES
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Busca un template para una partida por código y especialidad.
     * POST /ettp/buscar-template
     */
    public function buscarTemplate(Request $request)
    {
        $codigo = $request->input('codigo');
        $especialidad = $request->input('especialidad');

        $template = EttpTemplate::buscarPorPartida($codigo, $especialidad);

        if (!$template) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found'     => true,
            'template'  => [
                'id'     => $template->id,
                'titulo' => $template->titulo,
                'secciones' => $template->secciones->map(fn($s) => [
                    'titulo'           => $s->titulo,
                    'slug'             => $s->slug,
                    'contenido_default' => $s->contenido_default,
                    'orden'            => $s->orden,
                ])->toArray(),
            ],
        ]);
    }

    /**
     * Aplica un template a una partida ETTP.
     * POST /ettp/partida/{id}/aplicar-template
     */
    public function aplicarTemplate(Request $request, $partidaId)
    {
        $partida = EttpPartida::findOrFail($partidaId);
        $templateId = $request->input('template_id');

        $template = EttpTemplate::with('secciones')->findOrFail($templateId);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            // Eliminar secciones actuales vacías
            $partida->secciones()
                ->whereNull('contenido')
                ->orWhere('contenido', '')
                ->delete();

            // Crear secciones del template
            foreach ($template->secciones as $tplSeccion) {
                // Verificar si ya existe una sección con este slug
                $existe = $partida->secciones()->where('slug', $tplSeccion->slug)->exists();

                if (!$existe) {
                    EttpSeccion::create([
                        'ettp_partida_id' => $partida->id,
                        'titulo'          => $tplSeccion->titulo,
                        'slug'            => $tplSeccion->slug,
                        'contenido'       => $tplSeccion->contenido_default,
                        'origen'          => 'template',
                        'orden'           => $tplSeccion->orden,
                    ]);
                }
            }

            DB::connection('costos_tenant')->commit();

            return response()->json([
                'success'   => true,
                'secciones' => $partida->fresh()->secciones->toArray(),
            ]);
        } catch (\Exception $e) {
            DB::connection('costos_tenant')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: GESTIÓN DE PARTIDAS HUÉRFANAS
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Obtiene las partidas huérfanas de un presupuesto.
     * GET /ettp/huerfanas/{presupuestoId}
     */
    public function getHuerfanas($presupuestoId)
    {
        $huerfanas = EttpPartida::where('presupuesto_id', $presupuestoId)
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
    public function eliminarHuerfanas(Request $request)
    {
        $ids = $request->input('ids', []);

        $partidas = EttpPartida::whereIn('id', $ids)->huerfanas()->get();

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