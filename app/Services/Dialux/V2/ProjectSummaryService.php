<?php

namespace App\Services\Dialux\V2;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;

class ProjectSummaryService
{
    /**
     * @return array<string, mixed>
     */
    public function get(DialuxProject $project): array
    {
        if (is_array($project->consolidated_summary)) {
            return $project->consolidated_summary;
        }

        $project->loadMissing([
            'modules.electricalProject',
            'modules.normativeConfig',
            'modules.planFiles',
        ]);

        $modules = $project->modules->map(function (DialuxModule $module): array {
            $scenes = collect($module->data['scenes'] ?? []);
            $rooms = $scenes->sum(fn (array $scene): int => count($scene['rooms'] ?? []));
            $cadLuminaires = $scenes->sum(fn (array $scene): int => count($scene['fixtures'] ?? []));
            $electrical = $module->electricalProject;
            $normative = $module->normativeConfig;

            return [
                'id' => $module->id,
                'name' => $module->name,
                'status' => $module->status,
                'scenes_count' => $scenes->count(),
                'rooms_count' => $rooms,
                'plans_count' => $module->planFiles->count(),
                'luminaires_count' => $electrical?->total_luminaires ?: $cadLuminaires,
                'outlets_count' => $electrical?->total_outlets ?? 0,
                'panels_count' => $electrical?->total_panels ?? 0,
                'installed_power_w' => (float) ($electrical?->installed_power_w ?? 0),
                'compliant_rooms' => $normative?->compliant_rooms ?? 0,
                'non_compliant_rooms' => $normative?->non_compliant_rooms ?? 0,
                'warning_rooms' => $normative?->warning_rooms ?? 0,
            ];
        })->values();

        $summary = [
            'generated_at' => now()->toISOString(),
            'totals' => [
                'modules' => $modules->count(),
                'scenes' => $modules->sum('scenes_count'),
                'rooms' => $modules->sum('rooms_count'),
                'plans' => $modules->sum('plans_count'),
                'luminaires' => $modules->sum('luminaires_count'),
                'outlets' => $modules->sum('outlets_count'),
                'panels' => $modules->sum('panels_count'),
                'installed_power_w' => round((float) $modules->sum('installed_power_w'), 2),
                'compliant_rooms' => $modules->sum('compliant_rooms'),
                'non_compliant_rooms' => $modules->sum('non_compliant_rooms'),
                'warning_rooms' => $modules->sum('warning_rooms'),
            ],
            'modules' => $modules->all(),
        ];

        $project->forceFill(['consolidated_summary' => $summary])->saveQuietly();

        return $summary;
    }

    public function invalidate(DialuxProject $project): void
    {
        if ($project->consolidated_summary !== null) {
            $project->forceFill(['consolidated_summary' => null])->saveQuietly();
        }
    }

    public function invalidateForModule(?DialuxModule $module): void
    {
        if ($module?->dialux_project_id) {
            DialuxProject::query()
                ->whereKey($module->dialux_project_id)
                ->whereNotNull('consolidated_summary')
                ->update(['consolidated_summary' => null]);
        }
    }
}
