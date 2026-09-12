<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMoSeriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fecha' => ['sometimes', 'nullable', 'date'],
            'etiqueta' => ['sometimes', 'nullable', 'string', 'max:60'],
        ];
    }
}
