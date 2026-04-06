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
     * Mapa único: especialidad → tabla resumen de metrados.
     * Todas las claves usan la forma plural que coincide con el frontend.
     */
    private const TABLA_RESUMEN_MAP = [
        'arquitectura'   => 'metrado_arquitectura_resumen',
        'estructuras'    => 'metrado_estructura_resumen',
        'sanitarias'     => 'metrado_sanitarias_resumen',
        'electricas'     => 'metrado_electricas_resumen',
        'comunicaciones' => 'metrado_comunicaciones_resumen',
        'gas'            => 'metrado_gas_resumen',
    ];

    /**
     * Muestra la vista principal de ETTP
     * Ruta: /module/etts?project={id}
     */
    public function show(CostoProject $costoProject, Request $request)
    {
        // Obtener el ID del presupuesto interno del tenant
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $proyectoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        // Cargar partidas con sus secciones e imágenes (eager loading)
        $partidas = EttpPartida::where('presupuesto_id', $proyectoId)
            ->with(['secciones.imagenes'])
            ->raices()
            ->orderBy('item_order')
            ->get();

        $partidas = $this->sortPartidasByItem($partidas);

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
            ->get();

        $todas = $this->sortPartidasByItem($todas)->keyBy('id');

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
            $children = $this->sortPartidasByItem(
                $todas->where('parent_id', $node['id'])->values()
            );
            if ($children->isNotEmpty()) {
                $childNodes = $children->map(fn($p) => $this->formatPartida($p))->toArray();
                $node['_children'] = $this->attachChildren($childNodes, $todas);
            }
        }
        return $tree;
    }

    private function sortPartidasByItem($partidas)
    {
        return $partidas
            ->sort(static fn($left, $right) => EttpPartida::compareItemCodes($left->item, $right->item))
            ->values();
    }

    /**
     * Lista las especialidades que tienen resúmenes de metrados disponibles.
     */
    private function getEspecialidadesDisponibles($presupuestoId): array
    {
        $especialidades = [];

        foreach (self::TABLA_RESUMEN_MAP as $nombre => $tabla) {
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
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        // Usar el mapa constante unificado
        $tablaMap = self::TABLA_RESUMEN_MAP;

        // Claves consistentes con el frontend (todas en plural)
        $seleccionadas = array_keys(array_filter([
            'arquitectura'   => (bool) $request->input('arquitectura', 0),
            'estructuras'    => (bool) $request->input('estructuras', 0),
            'sanitarias'     => (bool) $request->input('sanitarias', 0),
            'electricas'     => (bool) $request->input('electricas', 0),
            'comunicaciones' => (bool) $request->input('comunicaciones', 0),
            'gas'            => (bool) $request->input('gas', 0),
        ]));

        if (empty($seleccionadas)) {
            return response()->json(['error' => 'Seleccione al menos una especialidad'], 422);
        }

        foreach ($seleccionadas as $especialidad) {
            try {
                $tabla = $tablaMap[$especialidad];

                $datos = DB::connection('costos_tenant')
                    ->table($tabla)
                    ->where('presupuesto_id', $presupuestoId)
                    ->get();

                if ($datos->isEmpty()) continue;

                foreach ($datos as $item) {
                    // Manejar discrepancia de nombres de columnas (base vs modular)
                    $codigo = trim((string)($item->item ?? $item->partida ?? ''));
                    $unidad = trim((string)($item->und ?? $item->unidad ?? ''));

                    if (empty($codigo)) continue;

                    // Sincronizar con tabla maestros de especificaciones
                    EttpPartida::updateOrCreate(
                        [
                            'presupuesto_id' => $presupuestoId,
                            'especialidad'   => $especialidad,
                            'item'           => $codigo,
                        ],
                        [
                            'descripcion'          => $item->descripcion,
                            'unidad'               => $unidad,
                            'resumen_source_id'    => $item->id,
                            'resumen_source_table' => $tabla,
                            'nivel'                => $item->nivel ?? 0,
                            'item_order'           => $item->item_order ?? 0,
                        ]
                    );
                }

                // 1. Intentar resolver jerarquía exacta usando la BD origen
                $this->resolverJerarquia($presupuestoId, $especialidad, $datos);

                // 2. Fallback: Para los que aún no tengan parent_id, resolver por código de ítem (01 -> 01.01)
                $todasSpecialidad = EttpPartida::where('presupuesto_id', $presupuestoId)
                    ->where('especialidad', $especialidad)
                    ->get()
                    ->keyBy('item');

                foreach ($todasSpecialidad as $item) {
                    if ($item->parent_id) continue; // Ya fue resuelto por BD origen

                    $codigo = trim((string)$item->item);
                    $partes = explode('.', $codigo);
                    if (count($partes) > 1) {
                        $parentCode = implode('.', array_slice($partes, 0, -1));
                        if (isset($todasSpecialidad[$parentCode])) {
                            $item->update(['parent_id' => $todasSpecialidad[$parentCode]->id]);
                        }
                    }
                }
            } catch (\Exception $e) {
                Log::error("Error importando especialidad {$especialidad}: " . $e->getMessage());
                continue;
            }
        }

        // Retorna el árbol completo
        $partidas = EttpPartida::where('presupuesto_id', $presupuestoId)
            ->with(['secciones.imagenes'])
            ->raices()
            ->orderBy('item_order')
            ->get();

        $partidas = $this->sortPartidasByItem($partidas);

        return response()->json($this->buildTree($partidas, $presupuestoId));
    }

    /**
     * Resuelve la jerarquía padre-hijo de las partidas ETTP
     * basándose en los parent_id del resumen de metrados.
     */
    private function resolverJerarquia($presupuestoId, $especialidad, $resumen): void
    {
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
        return self::TABLA_RESUMEN_MAP[$especialidad] ?? null;
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

    public function eliminarPartida(CostoProject $costoProject, $partidaId)
    {
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        $partida = EttpPartida::where('presupuesto_id', $presupuestoId)
            ->with(['secciones.imagenes', 'children.secciones.imagenes'])
            ->findOrFail($partidaId);

        DB::connection('costos_tenant')->beginTransaction();

        try {
            $partida->delete();
            DB::connection('costos_tenant')->commit();
            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error('Error deleting ETTP partida', ['error' => $e->getMessage(), 'partida_id' => $partidaId]);
            return response()->json(['error' => 'No se pudo eliminar la partida'], 500);
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

    public function getSecciones(CostoProject $costoProject, $partidaId)
    {
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        $partida = EttpPartida::where('presupuesto_id', $presupuestoId)
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

    public function guardarSecciones(CostoProject $costoProject, Request $request, $partidaId)
    {
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        $partida = EttpPartida::where('presupuesto_id', $presupuestoId)->findOrFail($partidaId);
        $secciones = $request->input('secciones', []);

        try {
            DB::connection('costos_tenant')->beginTransaction();

            if (!is_array($secciones)) {
                $secciones = [];
            }

            // Recopilar IDs válidos recibidos
            $idsRecibidos = collect($secciones)
                ->pluck('id')
                ->filter(fn($id) => !empty($id) && is_numeric($id))
                ->map(fn($id) => (int) $id)
                ->toArray();

            // Eliminar secciones omitidas (junto a sus imágenes atadas)
            $seccionesAEliminarQuery = EttpSeccion::where('ettp_partida_id', $partida->id)->with('imagenes');

            if (!empty($idsRecibidos)) {
                $seccionesAEliminarQuery->whereNotIn('id', $idsRecibidos);
            }

            $seccionesAEliminar = $seccionesAEliminarQuery->get();

            foreach ($seccionesAEliminar as $sD) {
                foreach ($sD->imagenes as $img) {
                    $img->delete();
                }
                $sD->delete();
            }

            // Procesar guardado/actualización
            foreach ($secciones as $index => $seccionData) {
                if (!is_array($seccionData)) {
                    continue;
                }

                $tituloBruto = $seccionData['titulo'] ?? $seccionData['title'] ?? '';
                $titulo = trim((string) $tituloBruto);
                if ($titulo === '') {
                    $titulo = 'Sección ' . ($index + 1);
                }

                $titulo = Str::limit($titulo, 150, '');
                $slug = Str::limit(EttpSeccion::generarSlug($titulo), 100, '');
                $contenidoRaw = $seccionData['contenido'] ?? $seccionData['content'] ?? null;
                $contenido = is_string($contenidoRaw) ? $contenidoRaw : (is_null($contenidoRaw) ? null : (string) $contenidoRaw);
                $orden = isset($seccionData['orden']) && is_numeric($seccionData['orden'])
                    ? (int) $seccionData['orden']
                    : ($index + 1);
                $seccion   = null;

                if (!empty($seccionData['id']) && is_numeric($seccionData['id'])) {
                    $seccion = EttpSeccion::where('ettp_partida_id', $partida->id)->find($seccionData['id']);
                    if ($seccion) {
                        $seccion->update([
                            'titulo'    => $titulo,
                            'slug'      => $slug,
                            'contenido' => $contenido,
                            'orden'     => $orden,
                        ]);
                    }
                } else {
                    $seccion = EttpSeccion::create([
                        'ettp_partida_id' => $partida->id,
                        'titulo'          => $titulo,
                        'slug'            => $slug,
                        'contenido'       => $contenido,
                        'origen'          => 'manual',
                        'orden'           => $orden,
                    ]);
                }

                if ($seccion) {
                    // Procesar imágenes en base64 insertadas offline/manual
                    if (!empty($contenido)) {
                        $contenidoModificado = preg_replace_callback('/src="data:image\/([a-zA-Z0-9.+-]+);base64,([^"]*?)"/', function ($matches) use ($seccion, $presupuestoId) {
                            $extension = strtolower($matches[1]);
                            $extension = match ($extension) {
                                'jpeg' => 'jpg',
                                'svg+xml' => 'svg',
                                default => preg_replace('/[^a-z0-9]+/', '', $extension),
                            };

                            if ($extension === '') {
                                $extension = 'png';
                            }

                            $base64Str = preg_replace('/\s+/', '', $matches[2]);
                            $imageData = base64_decode($base64Str, true);

                            if ($imageData === false) {
                                return $matches[0];
                            }

                            $nombreArchivo = Str::uuid() . '.' . $extension;
                            $path = "ettp/{$presupuestoId}/{$nombreArchivo}";

                            $stored = Storage::disk('public')->put($path, $imageData);
                            if ($stored === false) {
                                throw new \RuntimeException("No se pudo almacenar la imagen {$nombreArchivo}");
                            }

                            $dimensions = @getimagesizefromstring($imageData);

                            $imagen = EttpImagen::create([
                                'ettp_seccion_id' => $seccion->id,
                                'nombre_archivo'  => $nombreArchivo,
                                'nombre_original' => 'imagen_insertada.' . $extension,
                                'caption'         => null,
                                'orden'           => EttpImagen::where('ettp_seccion_id', $seccion->id)->count(),
                                'ancho'           => $dimensions ? $dimensions[0] : null,
                                'alto'            => $dimensions ? $dimensions[1] : null,
                            ]);
                            return 'src="' . $imagen->url . '"';
                        }, $contenido);

                        if ($contenidoModificado !== $contenido) {
                            $contenido = $contenidoModificado;
                            $seccion->update(['contenido' => $contenido]);
                        }
                    }

                    // Limpieza de imágenes huérfanas
                    $imagenes = EttpImagen::where('ettp_seccion_id', $seccion->id)->get();
                    foreach ($imagenes as $img) {
                        if (empty($contenido) || strpos($contenido, $img->nombre_archivo) === false) {
                            $img->delete();
                        }
                    }
                }
            }

            $partida->update(['estado' => 'en_progreso']);

            DB::connection('costos_tenant')->commit();

            // Refrescar y obtener las secciones actualizadas
            $seccionesActualizadas = EttpSeccion::where('ettp_partida_id', $partida->id)
                ->with('imagenes')
                ->orderBy('orden')
                ->get()
                ->map(fn($s) => [
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
                ])->toArray();

            return response()->json([
                'success'   => true,
                'secciones' => $seccionesActualizadas
            ]);
        } catch (\Throwable $e) {
            DB::connection('costos_tenant')->rollBack();
            Log::error('ETTP guardarSecciones error', [
                'costo_project_id' => $costoProject->id,
                'presupuesto_id' => $presupuestoId,
                'partida_id' => $partidaId,
                'payload' => $request->input('secciones', []),
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function eliminarSeccion(CostoProject $costoProject, $seccionId)
    {
        $seccion = EttpSeccion::with('partida')->findOrFail($seccionId);

        if ($seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para eliminar esta sección');
        }

        $seccion->delete();

        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: IMÁGENES
    // ══════════════════════════════════════════════════════════════════════

    public function subirImagen(CostoProject $costoProject, Request $request, $seccionId)
    {
        $request->validate([
            'imagen' => 'required|image|max:5120',
        ]);

        $seccion = EttpSeccion::with('partida')->findOrFail($seccionId);

        if ($seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para subir imágenes a esta sección');
        }

        $presupuestoId = $costoProject->id;

        $file = $request->file('imagen');
        $extension = $file->getClientOriginalExtension();
        $nombreOriginal = $file->getClientOriginalName();
        $nombreArchivo = Str::uuid() . '_' . Str::slug(pathinfo($nombreOriginal, PATHINFO_FILENAME)) . '.' . $extension;

        $path = $file->storeAs(
            "ettp/{$presupuestoId}",
            $nombreArchivo,
            'public'
        );

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

    public function eliminarImagen(CostoProject $costoProject, $imagenId)
    {
        $imagen = EttpImagen::with('seccion.partida')->findOrFail($imagenId);

        if ($imagen->seccion->partida->presupuesto_id != $costoProject->id) {
            abort(403, 'No tienes permiso para eliminar esta imagen');
        }

        $imagen->delete();

        return response()->json(['success' => true]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // API: GESTIÓN DE PARTIDAS HUÉRFANAS
    // ══════════════════════════════════════════════════════════════════════

    public function getHuerfanas(CostoProject $costoProject)
    {
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

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

    public function eliminarHuerfanas(CostoProject $costoProject, Request $request)
    {
        $dbService = app(\App\Services\CostoDatabaseService::class);
        $presupuestoId = $dbService->getDefaultPresupuestoId($costoProject->database_name);

        $ids = $request->input('ids', []);

        $partidas = EttpPartida::where('presupuesto_id', $presupuestoId)
            ->whereIn('id', $ids)
            ->huerfanas()
            ->get();

        foreach ($partidas as $partida) {
            foreach ($partida->secciones as $seccion) {
                foreach ($seccion->imagenes as $imagen) {
                    $imagen->delete();
                }
            }
            $partida->delete();
        }

        return response()->json([
            'success'    => true,
            'eliminadas' => $partidas->count(),
        ]);
    }

    public function testMetrados(CostoProject $costoProject)
    {
        $presupuestoId = $costoProject->id;

        $tabla = 'metrado_comunicaciones_resumen';

        try {
            $datos = DB::connection('costos_tenant')
                ->table($tabla)
                ->where('presupuesto_id', $presupuestoId)
                ->limit(5)
                ->get();

            $total = DB::connection('costos_tenant')
                ->table($tabla)
                ->count();

            $presupuestos = DB::connection('costos_tenant')
                ->table($tabla)
                ->select('presupuesto_id')
                ->distinct()
                ->get();

            return response()->json([
                'success' => true,
                'presupuesto_id_buscado' => $presupuestoId,
                'total_registros_en_tabla' => $total,
                'registros_con_presupuesto_1' => $datos->count(),
                'presupuestos_existentes' => $presupuestos,
                'primeros_5_registros' => $datos
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
