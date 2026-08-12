<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;

class ReorderDialuxModulesRequest extends FormRequest
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
            'modules' => ['required', 'array', 'min:1', 'max:25'],
            'modules.*.id' => ['required', 'integer', 'distinct'],
            'modules.*.sort_order' => ['required', 'integer', 'min:0', 'max:65535', 'distinct'],
        ];
    }
}
