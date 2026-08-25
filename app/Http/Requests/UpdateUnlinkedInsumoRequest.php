<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUnlinkedInsumoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo' => ['required', Rule::in(['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'])],
            'old_descripcion' => ['required', 'string'],
            'new_codigo' => ['nullable', 'string', 'max:50'],
            'new_descripcion' => ['nullable', 'string'],
            'new_unidad' => ['nullable', 'string', 'max:20'],
            'new_precio' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
