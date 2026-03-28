<?php

namespace App\Http\Controllers;

use App\Models\CostoProject;
use App\Models\CostoProjectModule;
use App\Models\Ubigeo;
use App\Services\CostoDatabaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CostoProjectController extends Controller
{
    public function __construct(
        protected CostoDatabaseService $dbService,
    ) {}

    /**
     * Lista de proyectos de costos del usuario.
     */
    public function index()
    {
        $projects = CostoProject::where('user_id', Auth::id())
            ->with('enabledModules')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn(CostoProject $p) => [
                'id' => $p->id,
                'nombre' => $p->nombre,
                'uei' => $p->uei,
                'unidad_ejecutora' => $p->unidad_ejecutora,
                'codigo_cui' => $p->codigo_cui,
                'status' => $p->status,
                'modules_count' => $p->enabledModules->count(),
                'created_at' => $p->created_at->format('d/m/Y'),
                'updated_at' => $p->updated_at->diffForHumans(),
            ]);

        return Inertia::render('costos/Index', [
            'projects' => $projects,
        ]);
    }

    /**
     * Formulario wizard para crear un proyecto.
     */
    public function create()
    {
        return Inertia::render('costos/Create', [
            'moduleTypes' => CostoProject::MODULE_TYPES,
        ]);
    }

    /**
     * Almacenar nuevo proyecto y crear su base de datos aislada.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'uei' => 'nullable|string|max:100',
            'unidad_ejecutora' => 'nullable|string|max:255',
            'codigo_snip' => 'nullable|string|max:50',
            'codigo_cui' => 'nullable|string|max:50',
            'codigo_local' => 'nullable|string|max:50',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
            'codigos_modulares' => 'nullable|array',
            'codigos_modulares.inicial' => 'nullable|string|max:50',
            'codigos_modulares.primaria' => 'nullable|string|max:50',
            'codigos_modulares.secundaria' => 'nullable|string|max:50',
            'departamento_id' => 'nullable|string|max:6',
            'provincia_id' => 'nullable|string|max:6',
            'distrito_id' => 'nullable|string|max:6',
            'centro_poblado' => 'nullable|string|max:255',
            'modules' => 'required|array|min:1',
            'modules.*' => 'string|in:' . implode(',', CostoProject::MODULE_TYPES),
            'sanitarias_cantidad_modulos' => 'nullable|integer|min:1|max:50',
            'plantilla_logo_izq' => 'nullable|image|max:2048',
            'plantilla_logo_der' => 'nullable|image|max:2048',
            'plantilla_firma' => 'nullable|image|max:2048',
        ]);

        $dbName = CostoProject::generateDatabaseName(Auth::id());
        $project = null;
        $cantidadModulos = $validated['sanitarias_cantidad_modulos'] ?? 1;

        try {

            // 1️⃣ Crear registro en BD principal
            $project = CostoProject::create([
                'user_id' => Auth::id(),
                'nombre' => $validated['nombre'],
                'uei' => $validated['uei'] ?? null,
                'unidad_ejecutora' => $validated['unidad_ejecutora'] ?? null,
                'codigo_snip' => $validated['codigo_snip'] ?? null,
                'codigo_cui' => $validated['codigo_cui'] ?? null,
                'codigo_local' => $validated['codigo_local'] ?? null,
                'fecha_inicio' => $validated['fecha_inicio'] ?? null,
                'fecha_fin' => $validated['fecha_fin'] ?? null,
                'codigos_modulares' => $validated['codigos_modulares'] ?? null,
                'departamento_id' => $validated['departamento_id'] ?? null,
                'provincia_id' => $validated['provincia_id'] ?? null,
                'distrito_id' => $validated['distrito_id'] ?? null,
                'centro_poblado' => $validated['centro_poblado'] ?? null,
                'database_name' => $dbName,
                'plantilla_logo_izq' => $request->hasFile('plantilla_logo_izq') ? $request->file('plantilla_logo_izq')->store('costos/templates', 'public') : null,
                'plantilla_logo_der' => $request->hasFile('plantilla_logo_der') ? $request->file('plantilla_logo_der')->store('costos/templates', 'public') : null,
                'plantilla_firma' => $request->hasFile('plantilla_firma') ? $request->file('plantilla_firma')->store('costos/templates', 'public') : null,
            ]);

            // 2️⃣ Crear módulos seleccionados
            foreach ($validated['modules'] as $moduleType) {

                $moduleConfig = null;

                if (in_array($moduleType, ['metrado_sanitarias', 'metrado_arquitectura', 'metrado_estructura'], true)) {
                    $moduleConfig = [
                        'cantidad_modulos' => $cantidadModulos
                    ];
                }

                CostoProjectModule::create([
                    'costo_project_id' => $project->id,
                    'module_type' => $moduleType,
                    'enabled' => true,
                    'config' => $moduleConfig,
                ]);
            }

            // 3️⃣ Crear base de datos aislada
            $this->dbService->createDatabase($project);

            // 4️⃣ Configuración inicial para sanitarias
            if (array_intersect($validated['modules'], ['metrado_sanitarias', 'metrado_arquitectura', 'metrado_estructura'])) {

                $this->dbService->setTenantConnection($dbName);

                foreach ([
                    'metrado_sanitarias' => 'metrado_sanitarias_config',
                    'metrado_arquitectura' => 'metrado_arquitectura_config',
                    'metrado_estructura' => 'metrado_estructura_config',
                ] as $moduleType => $tableName) {
                    if (!in_array($moduleType, $validated['modules'], true)) {
                        continue;
                    }

                    DB::connection('costos_tenant')
                        ->table($tableName)
                        ->updateOrInsert(
                            ['id' => 1],
                            [
                                'cantidad_modulos' => $cantidadModulos,
                                'nombre_proyecto' => $validated['nombre'],
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]
                        );
                }
            }

            return redirect()->route('costos.show', $project)
                ->with('success', 'Proyecto de costos creado exitosamente.');

        } catch (\Exception $e) {

            Log::error('Error creating costos project', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Limpieza si algo falló
            if ($project && $this->dbService->databaseExists($dbName)) {
                try {
                    $this->dbService->dropDatabase($project);
                } catch (\Exception $dropEx) {
                    Log::error('Failed to cleanup DB', [
                        'error' => $dropEx->getMessage()
                    ]);
                }
            }

            if ($project) {
                $project->modules()->delete();
                $project->delete();
            }

            return back()->withErrors([
                'general' => 'Error al crear el proyecto: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Dashboard del proyecto.
     */
    public function show(CostoProject $costoProject)
    {
        $this->authorizeProject($costoProject);

        $costoProject->load('enabledModules');

        return Inertia::render('costos/Show', [
            'project' => [
                'id' => $costoProject->id,
                'nombre' => $costoProject->nombre,
                'uei' => $costoProject->uei,
                'unidad_ejecutora' => $costoProject->unidad_ejecutora,
                'codigo_snip' => $costoProject->codigo_snip,
                'codigo_cui' => $costoProject->codigo_cui,
                'codigo_local' => $costoProject->codigo_local,
                'fecha_inicio' => $costoProject->fecha_inicio?->format('Y-m-d'),
                'fecha_fin' => $costoProject->fecha_fin?->format('Y-m-d'),
                'codigos_modulares' => $costoProject->codigos_modulares,
                'departamento_id' => $costoProject->departamento_id,
                'provincia_id' => $costoProject->provincia_id,
                'distrito_id' => $costoProject->distrito_id,
                'departamento_nombre' => $costoProject->departamento_id ? Ubigeo::find($costoProject->departamento_id)?->departamento : null,
                'provincia_nombre' => $costoProject->provincia_id ? Ubigeo::find($costoProject->provincia_id)?->provincia : null,
                'distrito_nombre' => $costoProject->distrito_id ? Ubigeo::find($costoProject->distrito_id)?->distrito : null,
                'centro_poblado' => $costoProject->centro_poblado,
                'status' => $costoProject->status,
                'plantilla_logo_izq' => $costoProject->plantilla_logo_izq ? asset('storage/' . $costoProject->plantilla_logo_izq) : null,
                'plantilla_logo_der' => $costoProject->plantilla_logo_der ? asset('storage/' . $costoProject->plantilla_logo_der) : null,
                'plantilla_firma' => $costoProject->plantilla_firma ? asset('storage/' . $costoProject->plantilla_firma) : null,
                'modules' => $costoProject->enabledModules->pluck('module_type')->toArray(),
                'created_at' => $costoProject->created_at->format('d/m/Y'),
            ],
        ]);
    }

    /**
     * Edit Proyecto
     */
    public function edit(CostoProject $costoProject)
    {
        $this->authorizeProject($costoProject);

        $costoProject->load('enabledModules');

        return Inertia::render('costos/Edit', [
            'moduleTypes' => CostoProject::MODULE_TYPES,
            'project' => [
                'id' => $costoProject->id,
                'nombre' => $costoProject->nombre,
                'uei' => $costoProject->uei,
                'unidad_ejecutora' => $costoProject->unidad_ejecutora,
                'codigo_snip' => $costoProject->codigo_snip,
                'codigo_cui' => $costoProject->codigo_cui,
                'codigo_local' => $costoProject->codigo_local,
                'fecha_inicio' => $costoProject->fecha_inicio?->format('Y-m-d'),
                'fecha_fin' => $costoProject->fecha_fin?->format('Y-m-d'),
                'codigos_modulares' => $costoProject->codigos_modulares,
                'departamento_id' => $costoProject->departamento_id,
                'provincia_id' => $costoProject->provincia_id,
                'distrito_id' => $costoProject->distrito_id,
                'departamento_nombre' => $costoProject->departamento_id ? Ubigeo::find($costoProject->departamento_id)?->departamento : null,
                'provincia_nombre' => $costoProject->provincia_id ? Ubigeo::find($costoProject->provincia_id)?->provincia : null,
                'distrito_nombre' => $costoProject->distrito_id ? Ubigeo::find($costoProject->distrito_id)?->distrito : null,
                'centro_poblado' => $costoProject->centro_poblado,
                'status' => $costoProject->status,
                'plantilla_logo_izq' => $costoProject->plantilla_logo_izq ? asset('storage/' . $costoProject->plantilla_logo_izq) : null,
                'plantilla_logo_der' => $costoProject->plantilla_logo_der ? asset('storage/' . $costoProject->plantilla_logo_der) : null,
                'plantilla_firma' => $costoProject->plantilla_firma ? asset('storage/' . $costoProject->plantilla_firma) : null,
                'modules' => $costoProject->enabledModules->pluck('module_type')->toArray(),
            ],
        ]);
    }

    /**
     * Actualiza el proyecto y sincroniza sus módulos.
     */
    public function update(Request $request, CostoProject $costoProject)
    {
        $this->authorizeProject($costoProject);

        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'uei' => 'nullable|string|max:100',
            'unidad_ejecutora' => 'nullable|string|max:255',
            'codigo_snip' => 'nullable|string|max:50',
            'codigo_cui' => 'nullable|string|max:50',
            'codigo_local' => 'nullable|string|max:50',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
            'codigos_modulares' => 'nullable|array',
            'codigos_modulares.inicial' => 'nullable|string|max:50',
            'codigos_modulares.primaria' => 'nullable|string|max:50',
            'codigos_modulares.secundaria' => 'nullable|string|max:50',
            'departamento_id' => 'nullable|string|max:6',
            'provincia_id' => 'nullable|string|max:6',
            'distrito_id' => 'nullable|string|max:6',
            'centro_poblado' => 'nullable|string|max:255',
            'modules' => 'required|array|min:1',
            'modules.*' => 'string|in:' . implode(',', CostoProject::MODULE_TYPES),
            'sanitarias_cantidad_modulos' => 'nullable|integer|min:1|max:50',
            'plantilla_logo_izq' => 'nullable|image|max:2048',
            'plantilla_logo_der' => 'nullable|image|max:2048',
            'plantilla_firma' => 'nullable|image|max:2048',
        ]);

        try {
            DB::beginTransaction();

            $costoProject->update([
                'nombre' => $validated['nombre'],
                'uei' => $validated['uei'] ?? null,
                'unidad_ejecutora' => $validated['unidad_ejecutora'] ?? null,
                'codigo_snip' => $validated['codigo_snip'] ?? null,
                'codigo_cui' => $validated['codigo_cui'] ?? null,
                'codigo_local' => $validated['codigo_local'] ?? null,
                'fecha_inicio' => $validated['fecha_inicio'] ?? null,
                'fecha_fin' => $validated['fecha_fin'] ?? null,
                'codigos_modulares' => $validated['codigos_modulares'] ?? null,
                'departamento_id' => $validated['departamento_id'] ?? null,
                'provincia_id' => $validated['provincia_id'] ?? null,
                'distrito_id' => $validated['distrito_id'] ?? null,
                'centro_poblado' => $validated['centro_poblado'] ?? null,
            ]);

            if ($request->hasFile('plantilla_logo_izq')) {
                if ($costoProject->plantilla_logo_izq) {
                    Storage::disk('public')->delete($costoProject->plantilla_logo_izq);
                }
                $costoProject->plantilla_logo_izq = $request->file('plantilla_logo_izq')->store('costos/templates', 'public');
            }
            if ($request->hasFile('plantilla_logo_der')) {
                if ($costoProject->plantilla_logo_der) {
                    Storage::disk('public')->delete($costoProject->plantilla_logo_der);
                }
                $costoProject->plantilla_logo_der = $request->file('plantilla_logo_der')->store('costos/templates', 'public');
            }
            if ($request->hasFile('plantilla_firma')) {
                if ($costoProject->plantilla_firma) {
                    Storage::disk('public')->delete($costoProject->plantilla_firma);
                }
                $costoProject->plantilla_firma = $request->file('plantilla_firma')->store('costos/templates', 'public');
            }
            $costoProject->save();

            $currentModules = $costoProject->enabledModules()->pluck('module_type')->toArray();
            $newModules = $validated['modules'];

            $modulesToAdd = array_diff($newModules, $currentModules);
            $modulesToRemove = array_diff($currentModules, $newModules);

            if (!empty($modulesToRemove)) {
                $costoProject->modules()->whereIn('module_type', $modulesToRemove)->delete();
            }

            $cantidadModulos = $validated['sanitarias_cantidad_modulos'] ?? 1;

            foreach ($modulesToAdd as $moduleType) {
                $moduleConfig = null;
                if (in_array($moduleType, ['metrado_sanitarias', 'metrado_arquitectura', 'metrado_estructura'], true)) {
                    $moduleConfig = ['cantidad_modulos' => $cantidadModulos];
                }

                CostoProjectModule::create([
                    'costo_project_id' => $costoProject->id,
                    'module_type' => $moduleType,
                    'enabled' => true,
                    'config' => $moduleConfig,
                ]);
            }

            $structuralAdded = array_intersect($modulesToAdd, ['metrado_sanitarias', 'metrado_arquitectura', 'metrado_estructura']);
            if (!empty($structuralAdded)) {
                $this->dbService->setTenantConnection($costoProject->database_name);
                foreach (['metrado_sanitarias' => 'metrado_sanitarias_config', 'metrado_arquitectura' => 'metrado_arquitectura_config', 'metrado_estructura' => 'metrado_estructura_config'] as $moduleType => $tableName) {
                    if (in_array($moduleType, $structuralAdded, true)) {
                        DB::connection('costos_tenant')->table($tableName)->updateOrInsert(
                            ['id' => 1],
                            ['cantidad_modulos' => $cantidadModulos, 'nombre_proyecto' => $validated['nombre'], 'created_at' => now(), 'updated_at' => now()]
                        );
                    }
                }
            }

            DB::commit();

            return redirect()->route('costos.show', $costoProject)
                ->with('success', 'Proyecto actualizado exitosamente.');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating costos project', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors([
                'general' => 'Error al actualizar el proyecto: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Eliminar proyecto.
     */
    public function destroy(CostoProject $costoProject)
    {
        $this->authorizeProject($costoProject);

        $this->dbService->dropDatabase($costoProject);

        $costoProject->delete();

        return redirect()->route('costos.index')
            ->with('success', 'Proyecto eliminado correctamente.');
    }

    /**
     * Verificar dueño del proyecto.
     */
    protected function authorizeProject(CostoProject $project): void
    {
        if ($project->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }
}
