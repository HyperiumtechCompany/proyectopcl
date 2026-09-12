<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class SetGgPagoValorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'monto' => ['nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'],
        ];
    }
}
