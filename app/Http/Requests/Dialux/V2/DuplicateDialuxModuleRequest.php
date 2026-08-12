<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DuplicateDialuxModuleRequest extends FormRequest
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
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $project = $this->route('dialuxProject');

                if ($project instanceof DialuxProject
                    && $project->modules()->count() >= DialuxModule::MAX_PER_PROJECT) {
                    $validator->errors()->add('name', 'El proyecto ya alcanzó el límite de 25 módulos.');
                }
            },
        ];
    }
}
