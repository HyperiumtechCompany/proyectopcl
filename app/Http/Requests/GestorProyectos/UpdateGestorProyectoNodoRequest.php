<?php

namespace App\Http\Requests\GestorProyectos;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGestorProyectoNodoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['text', 'table', 'image', 'video'])],
            'shape' => ['required', Rule::in(['circle', 'square'])],
            'color' => ['required', Rule::in(['violet', 'sky', 'emerald', 'amber', 'rose', 'fuchsia', 'cyan'])],
            'status' => ['required', Rule::in(['Completo', 'En curso', 'Pendiente'])],
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
        ];
    }
}
