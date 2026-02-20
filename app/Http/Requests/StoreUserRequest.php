<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('users.create');
    }

    public function rules(): array
    {
        return [
            'name'                  => ['required', 'string', 'max:255'],
            'email'                 => ['required', 'email', 'max:255', 'unique:users,email'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'phone'                 => ['nullable', 'string', 'max:20'],
            'avatar'                => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'dni'                   => ['nullable', 'string', 'max:12'],
            'position'              => ['nullable', 'string', 'max:255'],
            'plan'                  => ['required', Rule::in(['free', 'mensual', 'anual', 'lifetime'])],
            'status'                => ['required', Rule::in(['active', 'inactive', 'blocked'])],
            'role_id'               => ['nullable', 'integer', 'exists:roles,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'      => 'El nombre es obligatorio.',
            'email.required'     => 'El correo electrónico es obligatorio.',
            'email.unique'       => 'Este correo ya está registrado.',
            'password.required'  => 'La contraseña es obligatoria.',
            'password.min'       => 'La contraseña debe tener al menos 8 caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'plan.required'      => 'El plan es obligatorio.',
            'plan.in'            => 'El plan seleccionado no es válido.',
            'status.required'    => 'El estado es obligatorio.',
        ];
    }
}
