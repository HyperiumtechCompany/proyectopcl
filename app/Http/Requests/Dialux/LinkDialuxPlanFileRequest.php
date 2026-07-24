<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class LinkDialuxPlanFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'source_scene_id' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'source_scene_id.required' => 'Indica el piso del cual reutilizar el plano.',
        ];
    }
}
