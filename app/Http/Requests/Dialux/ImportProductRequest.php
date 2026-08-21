<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Foundation\Http\FormRequest;

class ImportProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'extensions:ies,ldt,gldf,txt,xml'],
            'name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'product_image' => ['nullable', 'image', 'max:4096'],
            'brand_logo' => ['nullable', 'image', 'max:2048'],
            'normative_standard' => ['nullable', 'in:en_12464,ies_na,universal'],
            'fixture_type' => ['nullable', 'in:recessed,pendant,surface,spot,strip,panel,tube,other'],
            'fixture_shape' => ['nullable', 'in:round,square,rectangular,cylindrical'],
            'dimensions' => ['nullable', 'array'],
            'dimensions.length' => ['nullable', 'numeric', 'min:0'],
            'dimensions.width' => ['nullable', 'numeric', 'min:0'],
            'dimensions.height' => ['nullable', 'numeric', 'min:0'],
            'dimensions.radius' => ['nullable', 'numeric', 'min:0'],
            // Correcciones del usuario en el modal de previsualización
            // (Ronda 21, `plan_ldt_ies_lector_editor.md`) — un archivo real
            // puede declarar un flujo/potencia distinto al de la ficha
            // técnica del fabricante (ver Ronda 3/8 del plan de paridad,
            // `reference_lumens`); estos overrides NO tocan la curva de
            // candela en sí, solo la magnitud reportada — el mismo mecanismo
            // `candelaScale` que ya usa `ProductImportService`.
            'total_lumens' => ['nullable', 'numeric', 'min:0'],
            'power_watts' => ['nullable', 'numeric', 'min:0'],
            'cct' => ['nullable', 'string', 'max:20'],
            'cri_ra' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lamp_type' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Debes seleccionar un archivo fotometrico.',
            'file.max' => 'El archivo no puede superar los 10 MB.',
            'file.mimes' => 'Solo se permiten archivos .ies, .ldt o .gldf.',
            'product_image.image' => 'La imagen del producto debe ser un archivo de imagen valido.',
            'product_image.max' => 'La imagen del producto no puede superar los 4 MB.',
            'brand_logo.image' => 'El logo de la marca debe ser un archivo de imagen valido.',
            'brand_logo.max' => 'El logo de la marca no puede superar los 2 MB.',
            'normative_standard.in' => 'Normativa invalida. Usa: en_12464, ies_na o universal.',
            'fixture_type.in' => 'Tipo de luminaria invalido.',
        ];
    }
}
