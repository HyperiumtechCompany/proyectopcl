<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use Illuminate\Foundation\Http\FormRequest;

class CuadernoRunnerStartRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        return [];
    }
}
