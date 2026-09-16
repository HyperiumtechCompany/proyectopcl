<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GuardarPagoValorizacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'min:1'],
            'periodo_key' => ['required', 'string', 'max:20'],
            'reajuste' => ['nullable', 'numeric', 'between:-999999999999.99,999999999999.99'],
            'penalidades' => ['nullable', 'numeric', 'between:0,999999999999.99'],
            'monto_pagado' => ['nullable', 'required_with:fecha_pago', 'numeric', 'between:0,999999999999.99'],
            'fecha_pago' => ['nullable', 'date'],
        ];
    }
}
