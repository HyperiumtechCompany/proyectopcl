<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class SetGastFinMatCompraValorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'insumo_key' => ['required', 'string', 'max:255'],
            'cantidad' => ['sometimes', 'nullable', 'string', 'regex:/^\d{1,11}(\.\d{1,10})?$/'],
            'precio' => ['sometimes', 'nullable', 'string', 'regex:/^\d{1,11}(\.\d{1,10})?$/'],
            'proveedor' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }
}
