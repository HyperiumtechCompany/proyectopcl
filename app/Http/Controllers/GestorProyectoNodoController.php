<?php

namespace App\Http\Controllers;

use App\Http\Requests\GestorProyectos\StoreGestorProyectoNodoRequest;
use App\Http\Requests\GestorProyectos\UpdateGestorProyectoNodoRequest;
use App\Models\GestorProyecto;
use App\Models\GestorProyectoNodo;
use Illuminate\Support\Facades\Auth;

class GestorProyectoNodoController extends Controller
{
    /**
     * Crea un nodo hijo dentro del proyecto.
     */
    public function store(StoreGestorProyectoNodoRequest $request, GestorProyecto $gestorProyecto)
    {
        $this->authorizeProyecto($gestorProyecto);

        $validated = $request->validated();

        $parent = GestorProyectoNodo::findOrFail($validated['parent_id']);

        if ($parent->role === 'tail') {
            return response()->json([
                'message' => 'El nodo de cierre (Expediente Técnico) no puede tener hijos.',
            ], 422);
        }

        // Se excluye el nodo cola del calculo de orden para que los nuevos hermanos
        // siempre queden antes que el, sin importar su orden fijo alto (ver TAIL_ORDER).
        $nextOrder = GestorProyectoNodo::where('gestor_proyecto_id', $gestorProyecto->id)
            ->where('parent_id', $validated['parent_id'])
            ->where(fn ($query) => $query->whereNull('role')->orWhere('role', '!=', 'tail'))
            ->max('order');

        $nodo = $gestorProyecto->nodos()->create([
            ...$validated,
            'order' => ($nextOrder === null ? 0 : $nextOrder + 1),
        ]);

        return response()->json(['nodo' => $nodo], 201);
    }

    /**
     * Edita título, tipo, apariencia, estado o contenido de un nodo.
     */
    public function update(UpdateGestorProyectoNodoRequest $request, GestorProyecto $gestorProyecto, GestorProyectoNodo $nodo)
    {
        $this->authorizeProyecto($gestorProyecto);
        $this->authorizeNodo($gestorProyecto, $nodo);

        $nodo->update($request->validated());

        return response()->json(['nodo' => $nodo]);
    }

    /**
     * Elimina un nodo (y sus descendientes en cascada). La cabeza y la cola del proyecto no se pueden eliminar.
     */
    public function destroy(GestorProyecto $gestorProyecto, GestorProyectoNodo $nodo)
    {
        $this->authorizeProyecto($gestorProyecto);
        $this->authorizeNodo($gestorProyecto, $nodo);

        if ($nodo->parent_id === null || $nodo->role === 'head') {
            return response()->json([
                'message' => 'El nodo raíz (cabeza) no se puede eliminar. Elimina el proyecto completo en su lugar.',
            ], 422);
        }

        if ($nodo->role === 'tail') {
            return response()->json([
                'message' => 'El nodo de cierre (Expediente Técnico) no se puede eliminar.',
            ], 422);
        }

        $nodo->delete();

        return response()->json(['deleted' => true]);
    }

    protected function authorizeProyecto(GestorProyecto $gestorProyecto): void
    {
        if ($gestorProyecto->user_id !== Auth::id()) {
            abort(403, 'No tienes acceso a este proyecto.');
        }

        if ($gestorProyecto->is_demo && $gestorProyecto->demo_expires_at?->isPast()) {
            abort(403, 'Tu demo expiró. Actualiza tu plan para seguir accediendo.');
        }
    }

    protected function authorizeNodo(GestorProyecto $gestorProyecto, GestorProyectoNodo $nodo): void
    {
        if ($nodo->gestor_proyecto_id !== $gestorProyecto->id) {
            abort(404);
        }
    }
}
