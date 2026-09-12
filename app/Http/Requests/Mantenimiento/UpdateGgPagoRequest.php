<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGgPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fecha' => ['sometimes', 'nullable', 'date'],
            'etiqueta' => ['sometimes', 'nullable', 'string', 'max:80'],
        ];
    }
}
