<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreElectricalProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dialux_project_id' => ['required', 'string', 'max:64'],
            'reference_standard' => ['sometimes', 'string', 'max:64'],
            'voltage_v' => ['sometimes', 'integer', 'min:100', 'max:1000'],
            'phases' => ['sometimes', 'integer', 'in:1,3'],
            'frequency_hz' => ['sometimes', 'integer', 'in:50,60'],
            'data' => ['sometimes', 'nullable', 'array'],
            'total_rooms' => ['sometimes', 'integer', 'min:0'],
            'total_luminaires' => ['sometimes', 'integer', 'min:0'],
            'total_outlets' => ['sometimes', 'integer', 'min:0'],
            'total_panels' => ['sometimes', 'integer', 'min:0'],
            'installed_power_w' => ['sometimes', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'dialux_project_id.required' => 'El identificador del proyecto DIALux es obligatorio.',
            'phases.in' => 'El número de fases debe ser 1 (monofásico) o 3 (trifásico).',
            'frequency_hz.in' => 'La frecuencia debe ser 50 o 60 Hz.',
        ];
    }
}
