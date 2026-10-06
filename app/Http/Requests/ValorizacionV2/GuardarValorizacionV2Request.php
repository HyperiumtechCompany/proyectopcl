<?php

namespace App\Http\Requests\ValorizacionV2;

use Illuminate\Foundation\Http\FormRequest;

class GuardarValorizacionV2Request extends FormRequest
{
    use ReglasDatosValorizacion;

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
            ...$this->reglasDatos(),
        ];
    }
}
