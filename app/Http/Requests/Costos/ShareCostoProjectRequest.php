<?php

namespace App\Http\Requests\Costos;

use App\Models\CostoProject;
use App\Models\CostoProjectCollaborator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Generar código o invitar por correo: solo el dueño, con rol editor o lector.
 * El correo es opcional (sin correo = generar/regenerar código del rol).
 */
class ShareCostoProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject && $project->isOwnedBy($this->user());
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'role' => ['required', 'string', Rule::in(CostoProjectCollaborator::ROLES)],
            'email' => ['nullable', 'email', 'max:255', 'exists:users,email'],
            'regenerate' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.exists' => 'No hay ningún usuario registrado con ese correo. Pídele que cree su cuenta primero.',
            'role.in' => 'El permiso debe ser Editor o Lector.',
        ];
    }
}
