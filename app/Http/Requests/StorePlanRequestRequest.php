<?php

namespace App\Http\Requests;

use App\Models\PlanRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePlanRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public form — anyone can request a plan.
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'plan' => ['required', Rule::in(['free', 'mensual', 'anual', ...PlanRequest::BUSINESS_PLANS])],
            'empresa' => [
                Rule::requiredIf(fn () => in_array($this->input('plan'), PlanRequest::BUSINESS_PLANS, true)),
                'nullable',
                'string',
                'max:255',
            ],
            'comprobante' => [
                // Solo los planes individuales pagos tienen precio fijo y piden comprobante ya;
                // free no paga, y negocios/empresarial se coordinan por contacto directo.
                Rule::requiredIf(fn () => in_array($this->input('plan'), ['mensual', 'anual'], true)),
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,pdf',
                'max:5120',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'Ingresa un correo electrónico válido.',
            'plan.required' => 'Selecciona un plan.',
            'plan.in' => 'El plan seleccionado no es válido.',
            'empresa.required' => 'Indica el nombre de tu empresa.',
            'comprobante.required' => 'Sube el comprobante de pago para este plan.',
            'comprobante.mimes' => 'El comprobante debe ser una imagen (JPG, PNG) o un PDF.',
            'comprobante.max' => 'El comprobante no debe superar los 5MB.',
        ];
    }
}
