<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class SetMatCotizacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['sometimes', 'nullable', 'string', 'regex:/^\d{1,15}(\.\d{1,10})?$/'];

        return [
            'proveedor' => ['sometimes', 'nullable', 'string', 'max:120'],
            'cantidad' => $decimal,
            'precio' => $decimal,
        ];
    }
}
