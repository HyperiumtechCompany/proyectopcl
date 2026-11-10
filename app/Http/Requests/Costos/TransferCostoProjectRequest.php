<?php

namespace App\Http\Requests\Costos;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Transferir un proyecto a la cuenta de otro usuario: solo root/gerencia.
 */
class TransferCostoProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['root', 'gerencia']);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255', 'exists:users,email'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.exists' => 'No hay ningún usuario registrado con ese correo. Crea primero la cuenta del cliente.',
        ];
    }
}
