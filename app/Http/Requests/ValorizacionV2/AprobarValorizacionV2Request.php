<?php

namespace App\Http\Requests\ValorizacionV2;

use Illuminate\Foundation\Http\FormRequest;

class AprobarValorizacionV2Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        $monto = 'regex:/^-?\d{1,15}(\.\d{1,10})?$/';

        return [
            'revision' => ['required', 'integer', 'min:1'],
            'numero' => ['required', 'integer', 'min:1'],
            'mes' => ['required', 'date_format:Y-m-d'],
            'resumen' => ['required', 'array'],
            'resumen.valorizado' => ['required', 'string', $monto],
            'resumen.liquido' => ['required', 'string', $monto],
            'resumen.avanceAcumulado' => ['required', 'string', $monto],
        ];
    }
}
