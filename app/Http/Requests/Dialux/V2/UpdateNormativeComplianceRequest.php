<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNormativeComplianceRequest extends FormRequest
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
            'total_rooms' => ['required', 'integer', 'min:0'],
            'compliant_rooms' => ['required', 'integer', 'min:0'],
            'non_compliant_rooms' => ['required', 'integer', 'min:0'],
            'warning_rooms' => ['required', 'integer', 'min:0'],
            'needs_review_rooms' => ['required', 'integer', 'min:0'],
        ];
    }
}
