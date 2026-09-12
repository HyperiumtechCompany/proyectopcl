<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMoPartidaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'];

        return [
            'descripcion' => ['sometimes', 'string', 'max:2000'],
            'item' => ['sometimes', 'nullable', 'string', 'max:50'],
            'unidad' => ['sometimes', 'nullable', 'string', 'max:20'],
            'metrado' => $decimal,
            'mo_pu' => $decimal,
            'cot_cantidad' => $decimal,
            'cot_precio' => $decimal,
            'presupuesto' => $decimal,
            'observacion' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }
}
