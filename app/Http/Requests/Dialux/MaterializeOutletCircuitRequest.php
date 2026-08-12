<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class MaterializeOutletCircuitRequest extends FormRequest
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
            // ID del Circuit analítico -- marca de idempotencia (regenerar
            // reemplaza solo lo que este circuito ya había generado antes).
            'circuit_id' => ['required', 'string', 'max:64'],
            // ElectricalRoom.sourceRoomId -- el Room real del plano CAD.
            'source_room_id' => ['required', 'string', 'max:64'],
            // Ya calculado por el motor JS (computeElectricalDerived) en el
            // momento del click -- el backend no reimplementa esa regla de
            // negocio, solo materializa la cantidad ya decidida.
            'quantity' => ['required', 'integer', 'min:1', 'max:200'],
            'outlet_type_code' => ['required', 'string', 'max:64'],
            'start_offset' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            // ID del ElectricalDevice del canvas vinculado al Panel del
            // circuito (ver linkedAnalyticPanelId) -- opcional: sin panel
            // ubicado en el plano, solo se generan los tomacorrientes.
            'panel_id' => ['sometimes', 'nullable', 'string', 'max:64'],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity.max' => 'La cantidad calculada (:input) excede el límite de 200 tomacorrientes por generación.',
        ];
    }
}
