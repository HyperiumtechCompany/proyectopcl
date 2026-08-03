<?php

namespace App\Http\Requests\GestorProyectos;

use Illuminate\Foundation\Http\FormRequest;

class StoreGestorProyectoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'numero_expediente' => ['nullable', 'string', 'max:255'],
            'responsable' => ['nullable', 'string', 'max:255'],
            'cantidad_modulos' => ['nullable', 'integer', 'min:0'],
            'monto_designado' => ['nullable', 'numeric', 'min:0'],
            'tiempo_estimado_dias' => ['nullable', 'integer', 'min:0'],
            'fecha_inicio' => ['nullable', 'date'],
            'fecha_fin' => ['nullable', 'date', 'after_or_equal:fecha_inicio'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre del proyecto es obligatorio.',
        ];
    }
}
