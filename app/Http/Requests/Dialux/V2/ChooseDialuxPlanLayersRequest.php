<?php

namespace App\Http\Requests\Dialux\V2;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** Capas del plano que el ingeniero elige cargar en la versión ligera. */
class ChooseDialuxPlanLayersRequest extends FormRequest
{
    public function authorize(): bool
    {
        // El dueño del módulo lo verifica el controlador (AuthorizesDialuxModule).
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'keep' => ['required', 'array', 'min:1', 'max:5000'],
            'keep.*' => ['required', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'keep.required' => 'Elige al menos una capa del plano.',
            'keep.min' => 'Elige al menos una capa del plano.',
        ];
    }
}
