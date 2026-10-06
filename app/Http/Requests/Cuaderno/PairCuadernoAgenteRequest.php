<?php

namespace App\Http\Requests\Cuaderno;

use Illuminate\Foundation\Http\FormRequest;

class PairCuadernoAgenteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'codigo' => ['required', 'string', 'regex:/^[A-Z2-9]{8}$/'],
            'nombre' => ['required', 'string', 'max:120'],
            'plataforma' => ['nullable', 'string', 'max:120'],
            'version' => ['nullable', 'string', 'max:40'],
            'tipo' => ['nullable', 'in:pc,extension'],
        ];
    }
}
