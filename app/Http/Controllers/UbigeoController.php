<?php

namespace App\Http\Controllers;

use App\Models\Ubigeo;
use Illuminate\Http\JsonResponse;

class UbigeoController extends Controller
{
    /**
     * List all departamentos.
     */
    public function departamentos(): JsonResponse
    {
        $departamentos = Ubigeo::departamentos()->map(fn($u) => [
            'id' => $u->id,
            'nombre' => $u->departamento,
        ]);

        return response()->json($departamentos);
    }

    /**
     * List provincias by departamento.
     */
    public function provincias(string $departamentoId): JsonResponse
    {
        $provincias = Ubigeo::provinciasByDepartamento($departamentoId)->map(fn($u) => [
            'id' => $u->id,
            'nombre' => $u->provincia,
        ]);

        return response()->json($provincias);
    }

    /**
     * List distritos by provincia.
     */
    public function distritos(string $provinciaId): JsonResponse
    {
        $distritos = Ubigeo::distritosByProvincia($provinciaId)->map(fn($u) => [
            'id' => $u->id,
            'nombre' => $u->distrito,
        ]);

        return response()->json($distritos);
    }
}
