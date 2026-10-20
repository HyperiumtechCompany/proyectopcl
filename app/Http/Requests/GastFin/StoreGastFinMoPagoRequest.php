<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class StoreGastFinMoPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:60'],
            'fecha' => ['nullable', 'date'],
        ];
    }
}
