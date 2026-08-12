<?php

namespace App\Http\Requests\Dialux\V2;

use App\Http\Requests\Dialux\StoreNormativeConfigRequest as BaseStoreNormativeConfigRequest;
use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;

class StoreNormativeConfigRequest extends BaseStoreNormativeConfigRequest
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

    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['dialux_project_id']);

        return $rules;
    }
}
