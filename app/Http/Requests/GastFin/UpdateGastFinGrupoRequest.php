<?php

namespace App\Http\Requests\GastFin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGastFinGrupoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo' => ['sometimes', 'nullable', 'string', 'in:modulo,institucion,piso'],
            'mo_aprobado' => ['sometimes', 'nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'],
            'mat_aprobado' => ['sometimes', 'nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'],
        ];
    }
}
