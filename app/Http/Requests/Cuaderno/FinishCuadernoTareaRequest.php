<?php

namespace App\Http\Requests\Cuaderno;

use Illuminate\Foundation\Http\FormRequest;

class FinishCuadernoTareaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:completada,fallida'],
            // The connector's answer is validated again by CuadernoRunner, as with the local runner.
            'result' => ['required_if:status,completada', 'array'],
            'error' => ['required_if:status,fallida', 'nullable', 'string', 'regex:/^[a-z_]{1,60}$/'],
        ];
    }
}
