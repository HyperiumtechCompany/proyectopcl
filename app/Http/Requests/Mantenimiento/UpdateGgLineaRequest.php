<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGgLineaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['sometimes', 'nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'];

        return [
            'rubro' => ['sometimes', 'string', 'max:150'],
            'descripcion' => ['sometimes', 'string', 'max:2000'],
            'unidad' => ['sometimes', 'nullable', 'string', 'max:20'],
            'cantidad' => $decimal,
            'costo_unitario' => $decimal,
            'gasto_proyectado' => $decimal,
        ];
    }
}
