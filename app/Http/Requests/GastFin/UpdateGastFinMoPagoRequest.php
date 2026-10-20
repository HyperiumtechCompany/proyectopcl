<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGastFinMoPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['sometimes', 'required', 'string', 'max:60'],
            'fecha' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
