<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOutletProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'manufacturer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'catalog_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'device_type' => ['sometimes', 'required', 'in:outlet_floor,outlet_initial,outlet_high_180,outlet_floor_box,outlet_waterproof,outlet_ceiling,outlet_rack'],
            'rated_power_w' => ['sometimes', 'required', 'numeric', 'min:1'],
            'ip_rating' => ['sometimes', 'nullable', 'string', 'max:10'],
            'product_image' => ['sometimes', 'nullable', 'image', 'max:4096'],
        ];
    }
}
