<?php

namespace App\Http\Requests\Dialux\V2;

use App\Models\Dialux\DialuxProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateElectricalNetworkRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('dialuxProject');

        return $project instanceof DialuxProject && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'data' => ['required', 'array'],
            'data.schemaVersion' => ['required', 'integer', 'in:1'],
            'data.rootNodeId' => ['nullable', 'string', 'max:100'],
            'data.settings' => ['required', 'array'],
            'data.settings.nominalVoltageV' => ['required', 'numeric', 'gt:0'],
            'data.settings.phases' => ['required', 'integer', Rule::in([1, 3])],
            'data.settings.connectionType' => ['required', Rule::in(['star', 'delta'])],
            'data.settings.frequencyHz' => ['required', 'integer', Rule::in([50, 60])],
            'data.settings.conductorMaterial' => ['required', Rule::in(['copper', 'aluminium'])],
            'data.settings.workingTemperatureC' => ['required', 'numeric'],
            'data.settings.defaultPowerFactor' => ['required', 'numeric', 'gt:0', 'max:1'],
            'data.settings.designFactor' => ['sometimes', 'numeric', 'gte:1'],
            'data.settings.feederDropLimitPercent' => ['required', 'numeric', 'gt:0'],
            'data.settings.totalDropLimitPercent' => ['required', 'numeric', 'gt:0'],
            'data.nodes' => ['required', 'array', 'max:500'],
            'data.nodes.*.id' => ['required', 'string', 'distinct', 'max:100'],
            'data.nodes.*.type' => ['required', Rule::in(['service', 'meter', 'ats', 'generator', 'ups', 'main_panel', 'module_panel_port'])],
            'data.nodes.*.label' => ['required', 'string', 'max:120'],
            'data.nodes.*.moduleId' => ['nullable', 'integer'],
            'data.nodes.*.moduleName' => ['nullable', 'string', 'max:120'],
            'data.nodes.*.sceneId' => ['nullable', 'string', 'max:100'],
            'data.nodes.*.sceneName' => ['nullable', 'string', 'max:120'],
            'data.nodes.*.deviceId' => ['nullable', 'string', 'max:100'],
            'data.nodes.*.panelRole' => ['nullable', Rule::in(['distribution', 'sub_distribution'])],
            'data.nodes.*.collapsed' => ['nullable', 'boolean'],
            'data.nodes.*.position.x' => ['required', 'numeric'],
            'data.nodes.*.position.y' => ['required', 'numeric'],
            'data.edges' => ['required', 'array', 'max:1000'],
            'data.edges.*.id' => ['required', 'string', 'distinct', 'max:100'],
            'data.edges.*.sourceNodeId' => ['required', 'string', 'max:100'],
            'data.edges.*.targetNodeId' => ['required', 'string', 'different:data.edges.*.sourceNodeId', 'max:100'],
            'data.edges.*.sectionMm2' => ['required', 'numeric', 'gt:0'],
            'data.edges.*.horizontalLengthM' => ['required', 'numeric', 'min:0'],
            'data.edges.*.verticalLengthM' => ['required', 'numeric', 'min:0'],
            'data.edges.*.label' => ['nullable', 'string', 'max:150'],
            'data.edges.*.lengthMode' => ['required', Rule::in(['manual', 'plan', 'combined'])],
            'data.edges.*.conductorType' => ['required', 'string', 'max:80'],
            'data.edges.*.conductorMaterial' => ['required', Rule::in(['copper', 'aluminium'])],
            'data.edges.*.earthSectionMm2' => ['nullable', 'numeric', 'gt:0'],
            'data.edges.*.wireConfiguration' => ['required', 'string', 'max:80'],
            'data.edges.*.powerFactor' => ['nullable', 'numeric', 'gt:0', 'max:1'],
            'data.edges.*.demandFactor' => ['nullable', 'numeric', 'gt:0', 'max:1'],
        ];
    }
}
