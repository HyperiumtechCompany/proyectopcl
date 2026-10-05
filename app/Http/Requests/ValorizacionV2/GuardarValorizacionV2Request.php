<?php

namespace App\Http\Requests\ValorizacionV2;

use Illuminate\Foundation\Http\FormRequest;

class GuardarValorizacionV2Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * El contenido de `datos` lo valida y normaliza el frontend (store de solo
     * entradas, cálculos puros). Aquí se exige la forma mínima para no guardar
     * basura y la revisión para detectar guardados simultáneos.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'revision' => ['required', 'integer', 'min:1'],
            'schema_version' => ['required', 'integer', 'min:1'],
            'datos' => ['required', 'array'],
            'datos.periodo' => ['required', 'array'],
            'datos.periodo.numero' => ['required', 'integer', 'min:1'],
            'datos.periodo.mes' => ['required', 'date_format:Y-m-d'],
            'datos.fichaTecnica' => ['required', 'array'],
            'datos.parametros' => ['required', 'array'],
            'datos.presupuesto' => ['required', 'array'],
            'datos.presupuesto.partidas' => ['present', 'array'],
        ];
    }
}
