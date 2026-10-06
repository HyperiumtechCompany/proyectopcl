<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use App\Models\CuadernoAsiento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCuadernoReferenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');
        $asiento = $this->route('asiento');

        return $project instanceof CostoProject && $asiento instanceof CuadernoAsiento
            && $this->user()?->id === $project->user_id
            && $asiento->vinculo?->costo_project_id === $project->id;
    }

    public function rules(): array
    {
        $asiento = $this->route('asiento');

        return [
            'numero' => [
                'required', 'integer', 'min:1',
                Rule::notIn([$asiento->numero]),
                Rule::exists('cuaderno_asientos', 'numero')->where('cuaderno_vinculo_id', $asiento->cuaderno_vinculo_id),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'numero.required' => 'Indica el número del asiento a enlazar.',
            'numero.not_in' => 'Un asiento no puede enlazarse consigo mismo.',
            'numero.exists' => 'Ese número no está en los asientos importados de este cuaderno.',
        ];
    }
}
