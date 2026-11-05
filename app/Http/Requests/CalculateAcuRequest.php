<?php

namespace App\Http\Requests;

use App\Services\S10PdfSnapshot;
use Illuminate\Foundation\Http\FormRequest;

class CalculateAcuRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'id' => 'nullable|integer',
            'partida' => 'required|string|max:50',
            'descripcion' => 'required|string',
            'unidad' => 'required|string|max:20',
            'rendimiento' => 'required|numeric|min:0.0001',
            'mano_de_obra' => 'nullable|array',
            'mano_de_obra.*.descripcion' => 'required|string',
            'mano_de_obra.*.unidad' => 'required|string|max:20',
            'mano_de_obra.*.cantidad' => 'required|numeric|min:0',
            'mano_de_obra.*.recursos' => 'nullable|numeric|min:0',
            'mano_de_obra.*.precio_unitario' => 'required|numeric|min:0',
            'mano_de_obra.*.insumo_id' => 'nullable|integer',
            'mano_de_obra.*.cod_insumo' => 'nullable|string|max:50',
            'mano_de_obra.*.codigo_producto' => 'nullable|string|max:50',
            'mano_de_obra.*.proveedor' => 'nullable|string|max:100',
            'materiales' => 'nullable|array',
            'materiales.*.descripcion' => 'required|string',
            'materiales.*.unidad' => 'required|string|max:20',
            'materiales.*.cantidad' => 'required|numeric|min:0',
            'materiales.*.precio_unitario' => 'required|numeric|min:0',
            'materiales.*.factor_desperdicio' => 'nullable|numeric|min:1',
            'materiales.*.insumo_id' => 'nullable|integer',
            'materiales.*.cod_insumo' => 'nullable|string|max:50',
            'materiales.*.codigo_producto' => 'nullable|string|max:50',
            'materiales.*.proveedor' => 'nullable|string|max:100',
            'equipos' => 'nullable|array',
            'equipos.*.descripcion' => 'required|string',
            'equipos.*.unidad' => 'required|string|max:20',
            'equipos.*.cantidad' => 'required|numeric|min:0',
            'equipos.*.recursos' => 'nullable|numeric|min:0',
            'equipos.*.precio_hora' => 'required|numeric|min:0',
            'equipos.*.insumo_id' => 'nullable|integer',
            'equipos.*.cod_insumo' => 'nullable|string|max:50',
            'equipos.*.codigo_producto' => 'nullable|string|max:50',
            'equipos.*.proveedor' => 'nullable|string|max:100',
            'subcontratos' => 'nullable|array',
            'subcontratos.*.descripcion' => 'required|string',
            'subcontratos.*.unidad' => 'required|string|max:20',
            'subcontratos.*.cantidad' => 'required|numeric|min:0',
            'subcontratos.*.precio_unitario' => 'required|numeric|min:0',
            'subcontratos.*.insumo_id' => 'nullable|integer',
            'subcontratos.*.cod_insumo' => 'nullable|string|max:50',
            'subcontratos.*.codigo_producto' => 'nullable|string|max:50',
            'subcontratos.*.proveedor' => 'nullable|string|max:100',
            'subpartidas' => 'nullable|array',
            'subpartidas.*.descripcion' => 'required|string',
            'subpartidas.*.unidad' => 'required|string|max:20',
            'subpartidas.*.cantidad' => 'required|numeric|min:0',
            'subpartidas.*.precio_unitario' => 'required|numeric|min:0',
            'subpartidas.*.insumo_id' => 'nullable|integer',
            'subpartidas.*.cod_insumo' => 'nullable|string|max:50',
            'subpartidas.*.codigo_producto' => 'nullable|string|max:50',
            'subpartidas.*.proveedor' => 'nullable|string|max:100',
            'update_project_prices' => 'nullable|boolean',
        ];
        foreach (S10PdfSnapshot::SECTIONS as $section) {
            $prefix = $section.'.*.source_pdf';
            $rules[$prefix] = ['sometimes', 'array:format,quantity,price,partial,unit,original_unit,description,code,resources,factor,rendimiento,original_rendimiento,declared_cost,page'];
            $rules[$prefix.'.format'] = ['required_with:'.$prefix, 'in:s10_pdf'];
            foreach (['quantity', 'price', 'partial', 'resources', 'factor', 'rendimiento', 'declared_cost'] as $field) {
                $rules[$prefix.'.'.$field] = ['required_with:'.$prefix, 'numeric', 'min:0'];
            }
            foreach (['unit', 'description'] as $field) {
                $rules[$prefix.'.'.$field] = ['required_with:'.$prefix, 'string'];
            }
            $rules[$prefix.'.original_unit'] = ['nullable', 'string'];
            $rules[$prefix.'.original_rendimiento'] = ['nullable', 'numeric', 'min:0'];
            $rules[$prefix.'.code'] = ['nullable', 'string', 'max:50'];
            $rules[$prefix.'.page'] = ['required_with:'.$prefix, 'integer', 'min:1'];
        }

        return $rules;
    }
}
