<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreDialuxPlanFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'plan' => ['required', 'file', 'max:102400', 'extensions:dxf,dwg'],
        ];
    }

    public function messages(): array
    {
        return [
            'plan.required' => 'Selecciona un archivo DXF o DWG.',
            'plan.extensions' => 'El plano debe ser un archivo DXF o DWG.',
            'plan.max' => 'El plano no puede superar los 100 MB.',
        ];
    }
}
