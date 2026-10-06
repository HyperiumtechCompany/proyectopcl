<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use Illuminate\Foundation\Http\FormRequest;

class CuadernoPdfZipRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        return [
            'desde' => ['nullable', 'integer', 'min:1'],
            'hasta' => ['nullable', 'integer', 'min:1', 'gte:desde'],
            'ids' => ['nullable', 'array', 'max:5000'],
            'ids.*' => ['integer', 'min:1'],
        ];
    }
}
