<?php

namespace App\Http\Requests;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class GuardarRhEmRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'min:1'],
            'mes' => ['required', 'string', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'personal' => ['present', 'array', 'max:100'],
            'personal.*.id' => ['required', 'string', 'max:50'],
            'personal.*.cargo' => ['required', 'string', 'max:120'],
            'personal.*.nombre' => ['required', 'string', 'max:160'],
            'personal.*.dias' => ['present', 'array'],
            'personal.*.dias.*' => ['required', 'integer', 'between:1,31'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $mes = $this->input('mes');
            if (! is_string($mes) || ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mes)) {
                return;
            }

            $diasDelMes = Carbon::createFromFormat('!Y-m', $mes)->daysInMonth;
            $ids = [];
            $personal = $this->input('personal', []);
            if (! is_array($personal)) {
                return;
            }
            foreach ($personal as $index => $persona) {
                if (! is_array($persona)) {
                    continue;
                }
                $id = $persona['id'] ?? null;
                if (is_string($id) && in_array($id, $ids, true)) {
                    $validator->errors()->add("personal.$index.id", 'Cada persona debe tener un identificador distinto.');
                }
                $ids[] = $id;
                $dias = $persona['dias'] ?? [];
                if (! is_array($dias)) {
                    continue;
                }
                if (count($dias) === count(array_filter($dias, 'is_scalar')) && count($dias) !== count(array_unique($dias))) {
                    $validator->errors()->add("personal.$index.dias", 'Un día no puede repetirse para la misma persona.');
                }
                foreach ($dias as $day) {
                    if (is_numeric($day) && (int) $day > $diasDelMes) {
                        $validator->errors()->add("personal.$index.dias", 'El día no pertenece al mes seleccionado.');
                        break;
                    }
                }
            }
        }];
    }
}
