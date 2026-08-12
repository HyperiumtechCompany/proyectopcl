<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreDialuxModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('dialuxProject');

        return $project instanceof DialuxProject
            && $this->user()?->id === $project->user_id;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
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
