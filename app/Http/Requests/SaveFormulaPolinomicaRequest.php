<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveFormulaPolinomicaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'parent_id' => ['required', 'integer', 'min:1'],
            // Se permiten borradores con más de ocho raíces para que el usuario
            // pueda guardarlos mientras termina de agrupar la fórmula.
            'estructura' => ['required', 'array'],
            'estructura.*.id' => ['required', 'string', 'max:100'],
            'estructura.*.nomenclatura' => ['required', 'string', 'max:10'],
            'estructura.*.root' => ['required', 'array'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $ids = [];
            foreach ((array) $this->input('estructura', []) as $index => $monomio) {
                $this->validateNode((array) ($monomio['root'] ?? []), "estructura.$index.root", $ids, $validator, 0);
            }
        }];
    }

    private function validateNode(array $node, string $path, array &$ids, Validator $validator, int $depth): void
    {
        if ($depth > 50) {
            $validator->errors()->add($path, 'El árbol excede la profundidad permitida.');

            return;
        }

        foreach (['id', 'code', 'descripcion'] as $field) {
            if (! isset($node[$field]) || ! is_string($node[$field]) || trim($node[$field]) === '') {
                $validator->errors()->add("$path.$field", "El campo $field es obligatorio.");
            }
        }

        $id = (string) ($node['id'] ?? '');
        if ($id !== '' && isset($ids[$id])) {
            $validator->errors()->add("$path.id", 'Un nodo no puede repetirse en la fórmula.');
        }
        $ids[$id] = true;

        foreach (['coefCalculado', 'coefDefinido'] as $field) {
            if (! isset($node[$field]) || ! is_numeric($node[$field]) || (float) $node[$field] < 0 || (float) $node[$field] > 1) {
                $validator->errors()->add("$path.$field", "El campo $field debe estar entre 0 y 1.");
            }
        }

        $children = $node['children'] ?? null;
        if (! is_array($children)) {
            $validator->errors()->add("$path.children", 'Los hijos deben ser un arreglo.');

            return;
        }
        if (count($children) > 2) {
            $validator->errors()->add("$path.children", 'Cada monomio admite como máximo dos hijos directos.');
        }

        foreach ($children as $index => $child) {
            $this->validateNode((array) $child, "$path.children.$index", $ids, $validator, $depth + 1);
        }
    }
}
