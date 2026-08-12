<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class PlacePanelRequest extends FormRequest
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
            'panel_id' => ['required', 'string', 'max:64'],
            'code' => ['required', 'string', 'max:64'],
            // true = Panel.parentPanelId === null (tablero general / TG),
            // false = tablero de distribución (TD).
            'is_root' => ['required', 'boolean'],
            // ElectricalFloor.level (1-based) -- mapea a scene.floorIndex+1,
            // mismo criterio que importRoomsFromCad. Ausente = primer nivel.
            'floor_level' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }
}
