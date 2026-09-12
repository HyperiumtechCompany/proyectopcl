<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class StoreMoPartidaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['nullable', 'string', 'regex:/^\d{1,15}(\.\d{1,10})?$/'];

        return [
            'parent_id' => ['nullable', 'string', 'size:26'],
            'tipo' => ['nullable', 'in:ie,bloque,partida'],
            'item' => ['nullable', 'string', 'max:50'],
            'descripcion' => ['required', 'string', 'max:2000'],
            'unidad' => ['nullable', 'string', 'max:20'],
            'metrado' => $decimal,
            'precio_unitario' => $decimal,
            'mo_pu' => $decimal,
        ];
    }
}
