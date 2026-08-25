<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MergeProjectInsumosRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('target')) {
            $this->merge(['target' => array_merge((array) $this->input('target', []), [
                'descripcion' => trim((string) $this->input('target.descripcion')),
            ])]);
        }

        if ($this->has('target_descripcion')) {
            $this->merge([
                'target_descripcion' => trim((string) $this->input('target_descripcion')),
            ]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo' => ['required', Rule::in(['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'])],
            'target' => ['nullable', 'array', 'required_without:target_descripcion'],
            'target.insumo_id' => ['nullable', 'integer'],
            'target.codigo' => ['nullable', 'string', 'max:50'],
            'target.codigo_producto' => ['nullable', 'string', 'max:50'],
            'target.descripcion' => ['required_with:target', 'string'],
            'target.unidad' => ['required_with:target', 'string', 'max:20'],
            'target.precio' => ['required_with:target', 'numeric', 'min:0'],
            'target_descripcion' => ['nullable', 'string', 'required_without:target'],
            'sources' => ['required', 'array', 'min:2'],
            'sources.*.insumo_id' => ['nullable', 'integer'],
            'sources.*.descripcion' => ['required', 'string'],
            'sources.*.unidad' => ['required', 'string', 'max:20'],
            'sources.*.codigo' => ['nullable', 'string', 'max:50'],
        ];
    }
}
