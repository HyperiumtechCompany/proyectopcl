<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class SetMatCompraValorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['sometimes', 'nullable', 'string', 'regex:/^\d{1,15}(\.\d{1,10})?$/'];

        return [
            'cantidad' => $decimal,
            'precio' => $decimal,
        ];
    }
}
