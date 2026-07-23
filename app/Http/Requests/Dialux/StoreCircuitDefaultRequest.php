<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreCircuitDefaultRequest extends FormRequest
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
            'circuit_type' => ['required', 'string', 'in:lighting,outlets,feeder,special'],
            'installation_category' => ['required', 'string', 'in:residencial,educativa,industrial'],
            'min_section_mm2' => ['required', 'numeric', 'min:0.5', 'max:1000'],
            'max_voltage_drop_pct' => ['required', 'numeric', 'min:0.5', 'max:10'],
            'demand_factor' => ['required', 'numeric', 'min:0.1', 'max:1'],
            'breaker_poles' => ['required', 'integer', 'in:1,2,3,4'],
        ];
    }
}
