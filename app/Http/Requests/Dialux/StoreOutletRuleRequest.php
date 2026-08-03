<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreOutletRuleRequest extends FormRequest
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
            'room_type' => ['required', 'string', 'max:64'],
            'method' => ['required', 'string', 'in:area,perimeter,fixed'],
            'value' => ['required', 'numeric', 'min:0.01', 'max:10000'],
            'unit' => ['required', 'string', 'in:m2_per_point,m_per_point,points'],
            'power_per_outlet_va' => ['sometimes', 'numeric', 'min:0', 'max:10000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
