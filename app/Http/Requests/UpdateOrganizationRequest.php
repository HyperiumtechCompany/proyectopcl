<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('plans.manage');
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
            'plan' => ['required', Rule::in(['negocios', 'empresarial'])],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre de la organización es obligatorio.',
            'plan.required' => 'El plan es obligatorio.',
            'plan.in' => 'El plan seleccionado no es válido.',
        ];
    }
}
