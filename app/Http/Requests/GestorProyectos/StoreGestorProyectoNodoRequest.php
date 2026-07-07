<?php

namespace App\Http\Requests\GestorProyectos;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGestorProyectoNodoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $gestorProyectoId = $this->route('gestorProyecto');
        $gestorProyectoId = is_object($gestorProyectoId) ? $gestorProyectoId->id : $gestorProyectoId;

        return [
            'parent_id' => [
                'required',
                'integer',
                Rule::exists('gestor_proyecto_nodos', 'id')->where('gestor_proyecto_id', $gestorProyectoId),
            ],
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['text', 'table', 'image', 'video'])],
            'shape' => ['required', Rule::in(['circle', 'square'])],
            'color' => ['required', Rule::in(['violet', 'sky', 'emerald', 'amber', 'rose', 'fuchsia', 'cyan'])],
            'status' => ['required', Rule::in(['Completo', 'En curso', 'Pendiente'])],
            'peso' => ['nullable', 'numeric', 'min:0'],
            'dias' => ['nullable', 'numeric', 'min:0'],
            'content' => ['nullable', 'array'],
            'content.text' => ['nullable', 'string'],
            'content.headers' => ['nullable', 'array'],
            'content.headers.*' => ['string', 'max:255'],
            'content.rows' => ['nullable', 'array'],
            'content.rows.*' => ['array'],
            'content.rows.*.*' => ['nullable', 'string', 'max:500'],
            'content.url' => ['nullable', 'string', 'max:2000'],
            'content.caption' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título del nodo es obligatorio.',
            'parent_id.required' => 'El nodo padre es obligatorio.',
            'parent_id.exists' => 'El nodo padre no pertenece a este proyecto.',
        ];
    }
}
