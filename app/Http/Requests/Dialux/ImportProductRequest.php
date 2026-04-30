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
