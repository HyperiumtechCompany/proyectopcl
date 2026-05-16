<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class StoreNormativeConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<string>>
     */
    public function rules(): array
    {
        return [
            'dialux_project_id' => ['required', 'string', 'max:255'],
            'country_code' => ['required', 'string', 'size:2'],
            'region' => ['required', 'string', 'in:europe,americas_usa,americas_peru'],
            'installation_type' => ['nullable', 'string', 'max:100'],
            'primary_standard' => ['required', 'string', 'in:en_12464,ies_na,rne_peru,nfpa101,ds024'],
            'reference_standards' => ['nullable', 'array'],
            'reference_standards.*' => ['string', 'in:en_12464,ies_na,rne_peru,nfpa101,ds024'],
            'priority_order' => ['nullable', 'array'],
            'priority_order.*' => ['string'],
            'auto_detect_enabled' => ['boolean'],
            'cross_norm_comparison_enabled' => ['boolean'],
            'total_rooms' => ['integer', 'min:0'],
            'compliant_rooms' => ['integer', 'min:0'],
            'non_compliant_rooms' => ['integer', 'min:0'],
            'warning_rooms' => ['integer', 'min:0'],
            'needs_review_rooms' => ['integer', 'min:0'],
            'normative_version' => ['nullable', 'string', 'max:100'],
            'norms_consulted_at' => ['nullable', 'date'],
            'disclaimer' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'country_code.size' => 'El código de país debe ser de 2 caracteres (ISO 3166-1 alpha-2).',
            'region.in' => 'La región debe ser: europe, americas_usa o americas_peru.',
            'primary_standard.in' => 'La norma primaria debe ser: en_12464, ies_na, rne_peru, nfpa101 o ds024.',
            'reference_standards.*.in' => 'Cada norma de referencia debe ser: en_12464, ies_na, rne_peru, nfpa101 o ds024.',
        ];
    }
}
