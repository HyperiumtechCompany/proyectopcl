<?php

namespace App\Http\Requests\ValorizacionV2;

use Illuminate\Foundation\Http\FormRequest;

class CrearValorizacionV2Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Nombre de la valorización + datos iniciales (plantilla vacía o ejemplo, los
     * arma el frontend con la misma forma que se guarda).
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
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
