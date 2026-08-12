<?php

namespace App\Services\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DialuxModuleService
{
    public function __construct(private readonly ProjectSummaryService $summaries) {}

    /**
     * @param  array{name: string, description?: string|null}  $attributes
     */
    public function create(DialuxProject $project, array $attributes): DialuxModule
    {
        return DB::transaction(function () use ($project, $attributes): DialuxModule {
            $lockedProject = DialuxProject::query()->lockForUpdate()->findOrFail($project->id);
            $this->ensureCapacity($lockedProject);

            $nextOrder = ((int) $lockedProject->modules()->max('sort_order')) + 1;

            return $lockedProject->modules()->create([
                ...$attributes,
                'sort_order' => $nextOrder,
                'status' => 'draft',
                'data' => null,
            ]);
        }, attempts: 3);
    }

    public function duplicate(DialuxProject $project, DialuxModule $source, ?string $name): DialuxModule
    {
        return DB::transaction(function () use ($project, $source, $name): DialuxModule {
            $lockedProject = DialuxProject::query()->lockForUpdate()->findOrFail($project->id);
            $this->ensureCapacity($lockedProject);

            return $lockedProject->modules()->create([
                'name' => $name ?: "{$source->name} (copia)",
                'description' => $source->description,
                'sort_order' => ((int) $lockedProject->modules()->max('sort_order')) + 1,
                'status' => 'draft',
                'data' => $source->data,
            ]);
        }, attempts: 3);
    }

    /**
     * @param  array<int, array{id: int, sort_order: int}>  $positions
     * @return Collection<int, DialuxModule>
     */
    public function reorder(DialuxProject $project, array $positions): Collection
    {
        return DB::transaction(function () use ($project, $positions): Collection {
            $moduleIds = collect($positions)->pluck('id');
            $ownedCount = $project->modules()->whereKey($moduleIds)->count();

            if ($ownedCount !== $moduleIds->count()) {
                throw ValidationException::withMessages([
                    'modules' => 'Todos los módulos deben pertenecer al proyecto indicado.',
                ]);
            }

            foreach ($positions as $position) {
                $project->modules()
                    ->whereKey($position['id'])
                    ->update(['sort_order' => $position['sort_order']]);
            }

            $this->summaries->invalidate($project);

            return $project->modules()->get();
        }, attempts: 3);
    }

    private function ensureCapacity(DialuxProject $project): void
    {
        if ($project->modules()->count() >= DialuxModule::MAX_PER_PROJECT) {
            throw ValidationException::withMessages([
                'name' => 'El proyecto ya alcanzó el límite de 25 módulos.',
            ]);
        }
    }
}
