<?php

namespace App\Http\Requests\Cuaderno;

use Illuminate\Foundation\Http\FormRequest;

class UploadCuadernoArchivoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'path' => ['required', 'string', 'regex:#^cuaderno-downloads/[a-f0-9-]{36}/[a-f0-9-]{36}$#'],
            'archivo' => ['required', 'file', 'max:102400'],
        ];
    }
}
