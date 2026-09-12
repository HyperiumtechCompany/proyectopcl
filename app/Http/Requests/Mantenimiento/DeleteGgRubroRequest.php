<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class DeleteGgRubroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'grupo' => ['required', 'string', 'in:fijo,variable'],
            'rubro' => ['required', 'string', 'max:150'],
        ];
    }
}
