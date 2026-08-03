<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreConductorRequest extends FormRequest
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
            'material' => ['required', 'string', 'in:cobre,aluminio'],
            'section_mm2' => ['required', 'numeric', 'min:0.5', 'max:1000'],
            'awg_ref' => ['sometimes', 'nullable', 'string', 'max:8'],
            'insulation' => ['required', 'string', 'max:16'],
            'ampacity_a' => ['required', 'numeric', 'min:1', 'max:2000'],
            'price_per_meter' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100000'],
        ];
    }
}
