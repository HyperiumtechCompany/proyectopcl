<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreManualProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'catalog_number' => ['nullable', 'string', 'max:255'],
            'total_lumens' => ['required', 'numeric', 'min:1'],
            'power_watts' => ['nullable', 'numeric', 'min:0.1'],
            'cct' => ['nullable', 'string', 'max:20'],
            'cri_ra' => ['nullable', 'numeric', 'min:0', 'max:100'],
            // Si el usuario ingresa una curva fotométrica real (photometric_table),
            // el ángulo de haz se calcula de esa curva y ya no hace falta declararlo.
            'beam_angle_50' => ['required_without:photometric_table', 'nullable', 'numeric', 'min:1', 'max:179'],
            // Curva fotométrica real ingresada a mano: pares (gamma en grados 0-180,
            // candela en cd), asumiendo simetría rotacional (un solo plano C). Permite
            // registrar luminarias propias con datos de fábrica reales, sin depender
            // de un archivo IES/LDT ni de la aproximación sintética coseno^n.
            'photometric_table' => ['nullable', 'array', 'min:3'],
            'photometric_table.*.gamma' => ['required', 'numeric', 'min:0', 'max:180'],
            'photometric_table.*.candela' => ['required', 'numeric', 'min:0'],
            'fixture_type' => ['nullable', 'in:recessed,pendant,surface,spot,strip,panel,tube,other'],
            'fixture_shape' => ['nullable', 'in:round,square,rectangular,cylindrical'],
            'dimensions' => ['nullable', 'array'],
            'dimensions.length' => ['nullable', 'numeric', 'min:0'],
            'dimensions.width' => ['nullable', 'numeric', 'min:0'],
            'dimensions.height' => ['nullable', 'numeric', 'min:0'],
            'product_image' => ['nullable', 'image', 'max:4096'],
            'brand_logo' => ['nullable', 'image', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre de la luminaria es obligatorio.',
            'total_lumens.required' => 'El flujo luminoso total (lm) es obligatorio.',
            'total_lumens.min' => 'El flujo luminoso debe ser mayor a 0.',
            'beam_angle_50.required_without' => 'El ángulo de apertura (beam angle 50%) es obligatorio salvo que ingreses una curva fotométrica propia.',
            'beam_angle_50.max' => 'El ángulo de apertura debe estar entre 1 y 179 grados.',
            'photometric_table.min' => 'La curva fotométrica necesita al menos 3 puntos (gamma, candela).',
        ];
    }
}
