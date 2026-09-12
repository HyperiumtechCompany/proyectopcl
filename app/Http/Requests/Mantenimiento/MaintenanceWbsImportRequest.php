<?php

namespace App\Http\Requests\Mantenimiento;

use Illuminate\Foundation\Http\FormRequest;

class MaintenanceWbsImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source_hash' => ['required', 'string', 'size:64'],
            'idempotency_key' => ['required', 'uuid'],
        ];
    }
}
