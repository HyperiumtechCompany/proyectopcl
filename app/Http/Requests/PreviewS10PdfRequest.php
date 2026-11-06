<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PreviewS10PdfRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // El controlador comprueba el acceso al proyecto y al módulo.
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['pdf_bytes' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail): void {
            if (strlen($value) > 20 * 1024 * 1024) {
                $fail('El PDF supera 20 MB.');
            }
            if (! str_contains(substr($value, 0, 1024), '%PDF-')) {
                $fail('Selecciona un archivo PDF válido.');
            }
        }]];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['pdf_bytes' => $this->getContent()]);
    }
}
