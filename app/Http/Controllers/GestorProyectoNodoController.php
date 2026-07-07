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

        $nextOrder = GestorProyectoNodo::where('gestor_proyecto_id', $gestorProyecto->id)
            ->where('parent_id', $validated['parent_id'])
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
     * Elimina un nodo (y sus descendientes en cascada). El nodo raíz no se puede eliminar.
     */
    public function destroy(GestorProyecto $gestorProyecto, GestorProyectoNodo $nodo)
    {
        $this->authorizeProyecto($gestorProyecto);
        $this->authorizeNodo($gestorProyecto, $nodo);

        if ($nodo->parent_id === null) {
            return response()->json([
                'message' => 'El nodo raíz no se puede eliminar. Elimina el proyecto completo en su lugar.',
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
    }

    protected function authorizeNodo(GestorProyecto $gestorProyecto, GestorProyectoNodo $nodo): void
    {
        if ($nodo->gestor_proyecto_id !== $gestorProyecto->id) {
            abort(404);
        }
    }
}
