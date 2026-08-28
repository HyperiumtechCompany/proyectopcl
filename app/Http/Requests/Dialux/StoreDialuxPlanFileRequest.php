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
            // png/jpg/jpeg: el editor de emplazamiento (Dialux v2) sube aquí
            // la imagen YA renderizada de un DXF/DWG importado (captura del
            // motor CAD) — no un plano CAD editable. El editor de interiores
            // sigue subiendo dxf/dwg crudos como siempre.
            'plan' => ['required', 'file', 'max:102400', 'extensions:dxf,dwg,png,jpg,jpeg'],
        ];
    }

    public function messages(): array
    {
        return [
            'plan.required' => 'Selecciona un archivo.',
            'plan.extensions' => 'El plano debe ser un archivo DXF, DWG, PNG o JPG.',
            'plan.max' => 'El plano no puede superar los 100 MB.',
        ];
    }
}
