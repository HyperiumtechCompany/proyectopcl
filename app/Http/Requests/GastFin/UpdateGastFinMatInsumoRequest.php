<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGastFinMatInsumoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'descripcion' => ['sometimes', 'required', 'string', 'max:500'],
            'unidad' => ['sometimes', 'nullable', 'string', 'max:20'],
        ];
    }
}
