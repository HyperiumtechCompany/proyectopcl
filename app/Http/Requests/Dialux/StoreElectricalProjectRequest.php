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
            'demand_power_w' => ['sometimes', 'numeric', 'min:0'],
            'derived_summary' => ['sometimes', 'nullable', 'array'],
            'derived_summary.version' => ['required_with:derived_summary', 'integer', 'in:1'],
            'derived_summary.circuits' => ['sometimes', 'array', 'max:5000'],
            'derived_summary.circuits.*.circuitId' => ['required', 'string', 'max:100'],
            'derived_summary.circuits.*.panelId' => ['required', 'string', 'max:100'],
            'derived_summary.circuits.*.floorId' => ['nullable', 'string', 'max:100'],
            'derived_summary.circuits.*.floorName' => ['nullable', 'string', 'max:150'],
            'derived_summary.circuits.*.code' => ['required', 'string', 'max:100'],
            'derived_summary.circuits.*.type' => ['required', 'string', 'max:30'],
            'derived_summary.circuits.*.description' => ['nullable', 'string', 'max:500'],
            'derived_summary.circuits.*.totalPowerW' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.demandPowerW' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.currentA' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.designCurrentA' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.lengthM' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.calculatedHorizontalLengthM' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.calculatedVerticalLengthM' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.sectionMm2' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.conductorLabel' => ['nullable', 'string', 'max:200'],
            'derived_summary.circuits.*.breakerA' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.voltageDropPct' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.cumulativeVoltageDropPct' => ['required', 'numeric', 'min:0'],
            'derived_summary.circuits.*.status' => ['required', 'string', 'in:ok,advertencia,error'],
            'derived_summary.circuits.*.warnings' => ['sometimes', 'array', 'max:30'],
            'derived_summary.circuits.*.warnings.*' => ['string', 'max:500'],
            'derived_summary.feeders' => ['sometimes', 'array', 'max:1000'],
            'derived_summary.panels' => ['required_with:derived_summary', 'array', 'max:500'],
            'derived_summary.panels.*.panelId' => ['required', 'string', 'max:100'],
            'derived_summary.panels.*.panelLabel' => ['nullable', 'string', 'max:150'],
            'derived_summary.panels.*.parentPanelId' => ['nullable', 'string', 'max:100'],
            'derived_summary.panels.*.feederLengthM' => ['nullable', 'numeric', 'min:0'],
            'derived_summary.panels.*.circuitCount' => ['nullable', 'integer', 'min:0'],
            'derived_summary.panels.*.installedPowerW' => ['required', 'numeric', 'min:0'],
            'derived_summary.panels.*.demandPowerW' => ['required', 'numeric', 'min:0'],
            'derived_summary.panels.*.ownInstalledPowerW' => ['sometimes', 'numeric', 'min:0'],
            'derived_summary.panels.*.ownDemandPowerW' => ['sometimes', 'numeric', 'min:0'],
            'derived_summary.panels.*.currentA' => ['required', 'numeric', 'min:0'],
            'derived_summary.panels.*.mainBreakerA' => ['required', 'numeric', 'min:0'],
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
