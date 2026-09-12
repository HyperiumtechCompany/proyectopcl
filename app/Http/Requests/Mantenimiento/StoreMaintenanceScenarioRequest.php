<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaintenanceScenarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo_hoja' => ['required', 'in:mo,mat,gg'],
            'nombre' => ['required', 'string', 'max:60'],
            'duplicar_de' => ['nullable', 'string', 'size:26'],
        ];
    }
}
