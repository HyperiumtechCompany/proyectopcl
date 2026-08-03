<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDialuxProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'data' => ['sometimes', 'nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del proyecto es obligatorio.',
        ];
    }
}
