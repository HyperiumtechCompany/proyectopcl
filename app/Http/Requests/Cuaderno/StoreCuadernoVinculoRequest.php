<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCuadernoVinculoRequest extends FormRequest
{
    public const ROLES = [
        'SUPERVISOR',
        'INSPECTOR DE OBRA',
        'RESIDENTE DE OBRA',
        'JEFE DE ELABORACIÓN DE EXPEDIENTE TÉCNICO',
        'LÍDER REVISOR',
        'MONITOR',
    ];

    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject
            && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        return [
            'entidad' => ['required', 'string', 'max:255'],
            'obra' => ['required', 'string', 'max:3000'],
            'contrato' => ['nullable', 'string', 'max:255'],
            'codigo_cui' => ['nullable', 'string', 'max:50'],
            'rol' => ['required', Rule::in(self::ROLES)],
            'external_id' => ['nullable', 'string', 'max:120'],
            'confirmacion' => ['required', 'accepted'],
            'password' => ['prohibited'],
            'token' => ['prohibited'],
            'estado' => ['prohibited'],
            'active_slot' => ['prohibited'],
            'user_id' => ['prohibited'],
            'costo_project_id' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'entidad.required' => 'Indica la entidad del cuaderno.',
            'obra.required' => 'Indica la obra o prestación del cuaderno.',
            'rol.required' => 'Selecciona tu rol en el cuaderno.',
            'rol.in' => 'Selecciona uno de los roles disponibles.',
            'confirmacion.accepted' => 'Confirma que los datos corresponden a este proyecto.',
            'confirmacion.required' => 'Confirma que los datos corresponden a este proyecto.',
        ];
    }
}
