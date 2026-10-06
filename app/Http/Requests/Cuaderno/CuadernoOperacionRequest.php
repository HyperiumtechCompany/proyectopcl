<?php

namespace App\Http\Requests\Cuaderno;

use App\Models\CostoProject;
use App\Services\Cuaderno\CuadernoAgentBridge;
use App\Services\Cuaderno\CuadernoRunner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CuadernoOperacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('costoProject');

        return $project instanceof CostoProject && $this->user()?->id === $project->user_id;
    }

    public function rules(): array
    {
        $rules = ['vinculo_id' => ['required', 'integer']];
        if ($this->routeIs('costos.cuaderno.connect')) {
            // The first connection creates the link from the official notebook.
            $rules['vinculo_id'] = ['nullable', 'integer'];
            // With the browser extension the holder signs in on their own OECE tab:
            // no credentials travel through Costos.
            $credentials = Rule::requiredIf(fn (): bool => ! $this->viaExtension());
            $rules['usuario'] = [$credentials, 'nullable', 'string', 'max:100'];
            $rules['password'] = [$credentials, 'nullable', 'string', 'max:255'];
        }
        if ($this->routeIs('costos.cuaderno.select')) {
            $rules['choice'] = ['required', 'string', 'regex:/^[a-f0-9]{64}$/'];
        }
        if ($this->routeIs('costos.cuaderno.confirm')) {
            $rules['confirmacion'] = ['required', 'accepted'];
            $rules['reemplazar'] = ['sometimes', 'boolean'];
        }
        // Guided read-only capture of screens not mapped yet.
        if ($this->routeIs('costos.cuaderno.capture')) {
            $rules['target'] = ['nullable', Rule::in(['nuevo', 'adjuntos'])];
            $rules['numero'] = ['nullable', 'integer', 'min:1'];
        }
        if ($this->routeIs('costos.cuaderno.screen', 'costos.cuaderno.interact')) {
            $rules['shot'] = ['sometimes', 'boolean'];
        }
        // Remote control of the invisible official browser: fill fields, click, type or press a key.
        if ($this->routeIs('costos.cuaderno.interact')) {
            $rules['kind'] = ['required', Rule::in(['form', 'click', 'type', 'key'])];
            $rules['fields'] = ['exclude_unless:kind,form', 'present', 'array', 'max:60'];
            $rules['fields.*.ref'] = ['required', 'integer', 'min:1'];
            $rules['fields.*.value'] = ['nullable', 'string', 'max:2000'];
            $rules['fields.*.checked'] = ['sometimes', 'boolean'];
            $rules['submit'] = ['exclude_unless:kind,form', 'nullable', 'integer', 'min:1'];
            $rules['x'] = ['exclude_unless:kind,click', 'required', 'numeric', 'between:0,4000'];
            $rules['y'] = ['exclude_unless:kind,click', 'required', 'numeric', 'between:0,4000'];
            $rules['text'] = ['exclude_unless:kind,type', 'required', 'string', 'max:2000'];
            $rules['key'] = ['exclude_unless:kind,key', 'required', Rule::in(['Enter', 'Tab', 'Backspace', 'Escape'])];
        }

        return $rules;
    }

    private function viaExtension(): bool
    {
        return app(CuadernoRunner::class)->usesAgents()
            && app(CuadernoAgentBridge::class)->onlineAgent($this->user())?->tipo === 'extension';
    }
}
