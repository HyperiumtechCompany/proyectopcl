<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use App\Models\CuadernoAsiento;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCuadernoAsientoRequest extends FormRequest
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
        return [
            'nota_local' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
