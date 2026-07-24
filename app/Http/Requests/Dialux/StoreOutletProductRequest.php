<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreOutletProductRequest extends FormRequest
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
            'device_type' => ['required', 'in:outlet_floor,outlet_initial,outlet_high_180,outlet_floor_box,outlet_waterproof,outlet_ceiling,outlet_rack'],
            'rated_power_w' => ['required', 'numeric', 'min:1'],
            'ip_rating' => ['nullable', 'string', 'max:10'],
            'is_global' => ['nullable', 'boolean'],
            'product_image' => ['nullable', 'image', 'max:4096'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del tomacorriente es obligatorio.',
            'device_type.required' => 'El tipo de montaje es obligatorio.',
            'device_type.in' => 'El tipo de montaje no es válido.',
            'rated_power_w.required' => 'La potencia asignada (W) es obligatoria.',
            'rated_power_w.min' => 'La potencia asignada debe ser mayor a 0.',
        ];
    }
}
