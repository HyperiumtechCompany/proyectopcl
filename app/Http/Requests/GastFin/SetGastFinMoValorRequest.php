<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class SetGastFinMoValorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'etiqueta' => ['sometimes', 'nullable', 'string', 'max:40'],
            'monto' => ['sometimes', 'nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'],
        ];
    }
}
