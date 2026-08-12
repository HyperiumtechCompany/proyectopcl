<?php

namespace App\Http\Controllers\Dialux\V2;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreDialuxProjectRequest;
use App\Models\Dialux\DialuxProject;
use App\Services\Dialux\V2\DialuxModuleService;
use App\Services\ProjectQuotaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    use AuthorizesDialuxProject;

    public function __construct(
        private readonly ProjectQuotaService $quota,
        private readonly DialuxModuleService $modules,
    ) {}

    public function index(): Response
    {
        $projects = DialuxProject::query()
            ->where('user_id', auth()->id())
            ->has('modules')
            ->withCount('modules')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (DialuxProject $project): array => [
                'id' => $project->id,
                'name' => $project->name,
                'status' => $project->status,
                'client_name' => $project->client_name,
                'location' => $project->location,
                'modules_count' => $project->modules_count,
                'updated_at' => $project->updated_at->diffForHumans(),
            ]);

        return Inertia::render('dialux/v2/Index', ['projects' => $projects]);
    }

    public function store(StoreDialuxProjectRequest $request): RedirectResponse
    {
        $this->quota->assertCanCreate($request->user(), 'dialux');

        $project = DB::transaction(function () use ($request): DialuxProject {
            $project = DialuxProject::query()->create([
                'user_id' => $request->user()->id,
                'name' => $request->validated('name'),
                'status' => 'draft',
                'data' => null,
                ...$this->quota->demoAttributesFor($request->user()),
            ]);

            $this->modules->create($project, ['name' => 'Módulo 1']);

            return $project;
        });

        return redirect()->route('dialux-v2.projects.show', $project)
            ->with('success', 'Proyecto v2 creado correctamente.');
    }

    public function show(DialuxProject $dialuxProject): Response
    {
        $this->authorizeProyecto($dialuxProject);
        $dialuxProject->load([
            'modules.electricalProject',
            'modules.normativeConfig',
        ]);

        return Inertia::render('dialux/v2/Project', [
            'project' => $this->projectPayload($dialuxProject),
            'modules' => $dialuxProject->modules->map(fn ($module): array => [
                'id' => $module->id,
                'name' => $module->name,
                'description' => $module->description,
                'status' => $module->status,
                'sort_order' => $module->sort_order,
                'rooms_count' => collect($module->data['scenes'] ?? [])->sum(
                    fn (array $scene): int => count($scene['rooms'] ?? []),
                ),
                'luminaires_count' => $module->electricalProject?->total_luminaires ?? 0,
                'installed_power_w' => $module->electricalProject?->installed_power_w ?? 0,
                'compliant_rooms' => $module->normativeConfig?->compliant_rooms ?? 0,
                'non_compliant_rooms' => $module->normativeConfig?->non_compliant_rooms ?? 0,
            ])->values(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function projectPayload(DialuxProject $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'client_name' => $project->client_name,
            'location' => $project->location,
            'project_code' => $project->project_code,
            'status' => $project->status,
        ];
    }
}
