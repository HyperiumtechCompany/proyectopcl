<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class StoreMatMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['nullable', 'string', 'regex:/^\d{1,15}(\.\d{1,10})?$/'];

        return [
            'partida_id' => ['required', 'string', 'size:26'],
            'descripcion' => ['required', 'string', 'max:2000'],
            'unidad' => ['nullable', 'string', 'max:20'],
            'cantidad' => $decimal,
            'precio_unitario' => $decimal,
        ];
    }

    public function validated($key = null, $default = null): array
    {
        return array_diff_key(parent::validated(), ['partida_id' => null]);
    }
}
