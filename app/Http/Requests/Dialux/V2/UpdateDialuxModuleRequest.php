<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDialuxModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('dialuxProject');
        $module = $this->route('dialuxModule');

        return $project instanceof DialuxProject
            && $module instanceof DialuxModule
            && $this->user()?->id === $project->user_id
            && $module->dialux_project_id === $project->id;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', Rule::in(DialuxModule::STATUSES)],
            'data' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
