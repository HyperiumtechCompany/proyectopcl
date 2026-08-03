<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreDialuxProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del proyecto es obligatorio.',
        ];
    }
}
