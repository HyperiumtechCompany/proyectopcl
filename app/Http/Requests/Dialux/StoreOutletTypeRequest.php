<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreOutletTypeRequest extends FormRequest
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
            'code' => ['required', 'string', 'alpha_dash', 'max:32'],
            'name' => ['required', 'string', 'max:120'],
            'height_m' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:15'],
            'height_label' => ['sometimes', 'nullable', 'string', 'max:60'],
            'use_description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ip_rating' => ['sometimes', 'nullable', 'string', 'max:8'],
            'box_type' => ['sometimes', 'nullable', 'string', 'max:60'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
