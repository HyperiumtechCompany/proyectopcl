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
            'fixture_type' => ['nullable', 'in:recessed,pendant,surface,spot,strip,panel,tube,other'],
            'fixture_shape' => ['nullable', 'in:round,square,rectangular,cylindrical'],
            'dimensions' => ['nullable', 'array'],
            'dimensions.length' => ['nullable', 'numeric', 'min:0'],
            'dimensions.width' => ['nullable', 'numeric', 'min:0'],
            'dimensions.height' => ['nullable', 'numeric', 'min:0'],
            // Radio real del producto — solo aplica a fixture_shape
            // 'round'/'cylindrical'; para esos casos manda sobre length/width
            // al dibujar el símbolo (ver OverlayFixtures en el frontend).
            'dimensions.radius' => ['nullable', 'numeric', 'min:0'],
            // "Tipo de lámpara" (ej. "14W LED") — Ronda 21d, corrige el
            // hallazgo real del usuario: sin este campo editable, un
            // producto importado con el tipo de lámpara mal declarado (o sin
            // declarar) no se puede corregir sin volver a subir el archivo.
            // Vive en `metadata.lamp_type`, no en una columna propia.
            'lamp_type' => ['nullable', 'string', 'max:255'],
            // Reemplazo del archivo fotométrico original (Ronda 21e) — un
            // producto importado con el archivo equivocado/incompleto (o
            // GLDF sin matriz real) se puede corregir sin perder su `id` ni
            // las referencias que ya existan en proyectos guardados.
            'file' => ['nullable', 'file', 'max:10240', 'extensions:ies,ldt,gldf,txt,xml'],
            'product_image' => ['nullable', 'image', 'max:5120'],
            'brand_logo' => ['nullable', 'image', 'max:2048'],
            'clear_product_image' => ['nullable', 'boolean'],
            'clear_brand_logo' => ['nullable', 'boolean'],
        ];
    }
}
