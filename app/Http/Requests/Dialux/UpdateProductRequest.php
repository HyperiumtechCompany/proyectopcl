<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
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
        ];
    }
}
