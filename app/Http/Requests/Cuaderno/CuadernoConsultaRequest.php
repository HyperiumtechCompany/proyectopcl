<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use Illuminate\Foundation\Http\FormRequest;

class CuadernoConsultaRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:120'],
            'tipo' => ['nullable', 'string', 'max:255'],
            'estado' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
