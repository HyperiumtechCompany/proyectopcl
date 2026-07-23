<?php

namespace App\Http\Controllers\Dialux;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreDialuxProjectRequest;
use App\Http\Requests\Dialux\UpdateDialuxProjectRequest;
use App\Models\Dialux\DialuxProject;
use App\Services\ProjectQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    use AuthorizesDialuxProject;

    public function __construct(protected ProjectQuotaService $quotaService) {}

    /**
     * Lista de proyectos DIAlux del usuario autenticado.
     */
    public function index(): Response
    {
        $proyectos = DialuxProject::where('user_id', Auth::id())
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (DialuxProject $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'is_demo' => $p->is_demo,
                'demo_expires_at' => $p->demo_expires_at?->toISOString(),
                'created_at' => $p->created_at->format('d/m/Y'),
                'updated_at' => $p->updated_at->diffForHumans(),
            ]);

        return Inertia::render('dialux/Index', [
            'proyectos' => $proyectos,
        ]);
    }

    /**
     * Crea un proyecto DIAlux vacío. El dibujo se genera en el frontend
     * (plantilla en blanco) y se guarda en el primer autosave.
     */
    public function store(StoreDialuxProjectRequest $request): RedirectResponse
    {
        $this->quotaService->assertCanCreate($request->user(), 'dialux');

        $proyecto = DialuxProject::create([
            'user_id' => Auth::id(),
            'name' => $request->validated('name'),
            'data' => null,
            ...$this->quotaService->demoAttributesFor($request->user()),
        ]);

        return redirect()->route('dialux.show', $proyecto)
            ->with('success', 'Proyecto creado correctamente.');
    }

    /**
     * Editor DIAlux (2D/3D) de un proyecto concreto.
     */
    public function show(DialuxProject $dialuxProject): Response
    {
        $this->authorizeProyecto($dialuxProject);

        return Inertia::render('dialux/Show', [
            'project' => [
                'id' => (string) $dialuxProject->id,
                'name' => $dialuxProject->name,
                'data' => $dialuxProject->data,
            ],
        ]);
    }

    /**
     * Renombra el proyecto (desde el listado) o guarda el avance del dibujo
     * (autosave desde el editor). Ambos casos comparten el mismo endpoint:
     * las visitas Inertia devuelven redirect, las peticiones fetch del
     * editor reciben JSON para no forzar un reload del canvas.
     */
    public function update(UpdateDialuxProjectRequest $request, DialuxProject $dialuxProject): RedirectResponse|JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $dialuxProject->update($request->validated());

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Proyecto guardado correctamente.',
                'updated_at' => $dialuxProject->updated_at->toISOString(),
            ]);
        }

        return back()->with('success', 'Proyecto actualizado correctamente.');
    }

    /**
     * Elimina el proyecto DIAlux.
     */
    public function destroy(DialuxProject $dialuxProject): RedirectResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $dialuxProject->delete();

        return redirect()->route('dialux.index')
            ->with('success', 'Proyecto eliminado correctamente.');
    }
}
