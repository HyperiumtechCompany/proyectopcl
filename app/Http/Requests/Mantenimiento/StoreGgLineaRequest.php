<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class StoreGgLineaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['nullable', 'string', 'regex:/^\d{1,15}(\.\d{1,10})?$/'];

        return [
            'grupo' => ['required', 'string', 'in:fijo,variable'],
            'rubro' => ['required', 'string', 'max:150'],
            'descripcion' => ['required', 'string', 'max:2000'],
            'unidad' => ['nullable', 'string', 'max:20'],
            'cantidad' => $decimal,
            'costo_unitario' => $decimal,
            'gasto_proyectado' => $decimal,
        ];
    }
}
