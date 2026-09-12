<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class UpdateResumenParametrosRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['sometimes', 'nullable', 'string', 'regex:/^-?\d{1,15}(\.\d{1,10})?$/'];

        return [
            'expediente' => ['sometimes', 'array'],
            'expediente.*' => $decimal,
            'aprobado_ideal' => ['sometimes', 'array'],
            'aprobado_ideal.*' => $decimal,
            'apoyo_tecnico' => ['sometimes', 'array'],
            'apoyo_tecnico.*' => $decimal,
            'aportes_socios' => ['sometimes', 'array'],
            'aportes_socios.socio1' => ['sometimes', 'array'],
            'aportes_socios.socio1.*' => $decimal,
            'aportes_socios.socio2' => ['sometimes', 'array'],
            'aportes_socios.socio2.*' => $decimal,
            'monto_invertir' => ['sometimes', 'array'],
            'monto_invertir.*' => ['sometimes', 'array'],
            'monto_invertir.*.*' => $decimal,
            'avance_obra_pct' => ['sometimes', 'array'],
            'avance_obra_pct.*' => $decimal,
        ];
    }
}
