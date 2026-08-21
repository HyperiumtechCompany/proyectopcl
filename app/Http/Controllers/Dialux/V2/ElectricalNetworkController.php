<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\V2\UpdateElectricalNetworkRequest;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\V2\ElectricalNetworkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ElectricalNetworkController extends Controller
{
    use AuthorizesDialuxProject;

    public function __construct(private readonly ElectricalNetworkService $networks) {}

    public function show(DialuxProject $dialuxProject): Response|JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);
        $network = $this->networks->networkFor($dialuxProject);
        $payload = [
            'network' => ['version' => $network->version, 'data' => $network->data],
            'ports' => $this->networks->portsFor($dialuxProject),
            'conductors' => $this->networks->conductorsFor($dialuxProject),
        ];

        if (request()->wantsJson()) {
            return response()->json($payload);
        }

        return Inertia::render('dialux/v2/ElectricalNetwork', [
            'project' => ['id' => $dialuxProject->id, 'name' => $dialuxProject->name],
            'generalModuleId' => $dialuxProject->modules()->where('kind', 'general')->value('id'),
            ...$payload,
        ]);
    }

    public function update(UpdateElectricalNetworkRequest $request, DialuxProject $dialuxProject): JsonResponse
    {
        $this->authorizeProyecto($dialuxProject);

        $topologyErrors = $this->networks->validateTopology($request->validated('data'));
        if ($topologyErrors !== []) {
            throw ValidationException::withMessages(['data' => $topologyErrors]);
        }

        $network = DB::transaction(function () use ($request, $dialuxProject) {
            $network = $dialuxProject->electricalNetwork()->lockForUpdate()->first();
            $network ??= $this->networks->networkFor($dialuxProject);
            if ($network->version !== $request->integer('version')) {
                throw ValidationException::withMessages(['version' => 'La red fue modificada en otra sesión. Recarga antes de guardar.']);
            }
            $network->update(['version' => $network->version + 1, 'data' => $request->validated('data')]);

            return $network->fresh();
        });

        return response()->json(['network' => ['version' => $network->version, 'data' => $network->data]]);
    }
}
