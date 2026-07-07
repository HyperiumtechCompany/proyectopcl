<?php

namespace App\Http\Controllers;

use App\Http\Requests\GestorProyectos\StoreGestorProyectoRequest;
use App\Http\Requests\GestorProyectos\UpdateGestorProyectoRequest;
use App\Models\GestorProyecto;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class GestorProyectoController extends Controller
{
    /**
     * Lista de proyectos del gestor pertenecientes al usuario.
     */
    public function index()
    {
        $proyectos = GestorProyecto::where('user_id', Auth::id())
            ->withCount('nodos')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (GestorProyecto $p) => [
                'id' => $p->id,
                'nombre' => $p->nombre,
                'descripcion' => $p->descripcion,
                'nodos_count' => $p->nodos_count,
                'created_at' => $p->created_at->format('d/m/Y'),
                'updated_at' => $p->updated_at->diffForHumans(),
            ]);

        return Inertia::render('gestor-proyectos/Index', [
            'proyectos' => $proyectos,
        ]);
    }

    /**
     * Crea un proyecto nuevo con su nodo raíz "Proyecto".
     */
    public function store(StoreGestorProyectoRequest $request)
    {
        $proyecto = GestorProyecto::create([
            'user_id' => Auth::id(),
            ...$request->validated(),
        ]);

        $proyecto->nodos()->create([
            'parent_id' => null,
            'title' => 'Proyecto',
            'type' => 'text',
            'shape' => 'square',
            'color' => 'violet',
            'status' => 'En curso',
            'content' => ['text' => 'Nodo raíz del proyecto. Agrega hijos para construir el flujo de trabajo.'],
            'order' => 0,
        ]);

        return redirect()->route('gestor-proyectos.show', $proyecto)
            ->with('success', 'Proyecto creado correctamente.');
    }

    /**
     * Editor visual (AutoMap) del proyecto.
     */
    public function show(GestorProyecto $gestorProyecto)
    {
        $this->authorizeProyecto($gestorProyecto);

        return Inertia::render('gestor-proyectos/Show', [
            'proyecto' => [
                'id' => $gestorProyecto->id,
                'nombre' => $gestorProyecto->nombre,
                'descripcion' => $gestorProyecto->descripcion,
            ],
            'nodos' => $gestorProyecto->nodos()->orderBy('order')->get([
                'id', 'parent_id', 'title', 'type', 'shape', 'color', 'status', 'content', 'order',
            ]),
        ]);
    }

    /**
     * Renombra o cambia la descripción del proyecto.
     */
    public function update(UpdateGestorProyectoRequest $request, GestorProyecto $gestorProyecto)
    {
        $this->authorizeProyecto($gestorProyecto);

        $gestorProyecto->update($request->validated());

        return back()->with('success', 'Proyecto actualizado correctamente.');
    }

    /**
     * Elimina el proyecto y todos sus nodos.
     */
    public function destroy(GestorProyecto $gestorProyecto)
    {
        $this->authorizeProyecto($gestorProyecto);

        $gestorProyecto->delete();

        return redirect()->route('gestor-proyectos.index')
            ->with('success', 'Proyecto eliminado correctamente.');
    }

    /**
     * Verificar dueño del proyecto.
     */
    protected function authorizeProyecto(GestorProyecto $gestorProyecto): void
    {
        if ($gestorProyecto->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }
    }
}
