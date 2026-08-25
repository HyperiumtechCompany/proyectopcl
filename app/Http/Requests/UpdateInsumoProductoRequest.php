<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInsumoProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'codigo_producto' => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('costos_tenant.insumo_productos', 'codigo_producto')
                    ->ignore($this->route('insumoId')),
            ],
            'descripcion' => ['sometimes', 'string'],
            'especificaciones' => ['nullable', 'string'],
            'unidad_id' => ['sometimes', 'integer'],
            'unidad' => ['sometimes', 'string', 'max:20'],
            'diccionario_id' => ['sometimes', 'integer'],
            'tipo_proveedor' => ['sometimes', 'string', 'size:3'],
            'costo_unitario_lista' => ['sometimes', 'numeric', 'min:0'],
            'costo_unitario' => ['sometimes', 'numeric', 'min:0'],
            'costo_flete' => ['nullable', 'numeric', 'min:0'],
            'fecha_lista' => ['nullable', 'date'],
            'tipo' => ['sometimes', Rule::in(['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas'])],
            'estado' => ['nullable', 'boolean'],
        ];
    }
}
