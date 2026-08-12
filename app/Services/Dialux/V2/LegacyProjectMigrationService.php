<?php

namespace App\Services\Dialux\V2;

use App\Models\Dialux\DialuxProject;
use Illuminate\Support\Facades\DB;

class LegacyProjectMigrationService
{
    /**
     * Convierte proyectos que todavía no tienen módulos y conserva los
     * identificadores de V1 para que ambas versiones sigan operativas.
     */
    public function migrate(): int
    {
        $migrated = 0;

        DialuxProject::query()
            ->whereDoesntHave('modules')
            ->orderBy('id')
            ->chunkById(100, function ($projects) use (&$migrated): void {
                foreach ($projects as $project) {
                    $didMigrate = DB::transaction(function () use ($project): bool {
                        $lockedProject = DialuxProject::query()
                            ->lockForUpdate()
                            ->findOrFail($project->id);

                        if ($lockedProject->modules()->exists()) {
                            return false;
                        }

                        $module = $lockedProject->modules()->create([
                            'name' => 'Módulo 1',
                            'description' => 'Módulo inicial migrado desde DIALux v1.',
                            'sort_order' => 0,
                            'status' => $this->moduleStatus($lockedProject->status),
                            'data' => $lockedProject->data,
                        ]);

                        DB::table('dialux_plans')
                            ->where('dialux_project_id', $lockedProject->id)
                            ->whereNull('dialux_module_id')
                            ->update(['dialux_module_id' => $module->id]);

                        DB::table('dialux_plan_files')
                            ->where('dialux_project_id', $lockedProject->id)
                            ->whereNull('dialux_module_id')
                            ->update(['dialux_module_id' => $module->id]);

                        $legacyIdentifiers = array_values(array_unique(array_filter([
                            (string) $lockedProject->id,
                            is_array($lockedProject->data) ? ($lockedProject->data['id'] ?? null) : null,
                        ], fn ($value): bool => is_string($value) && $value !== '')));

                        foreach (['dialux_project_normative_configs', 'dialux_electrical_projects'] as $table) {
                            DB::table($table)
                                ->where('user_id', $lockedProject->user_id)
                                ->whereIn('dialux_project_id', $legacyIdentifiers)
                                ->whereNull('dialux_module_id')
                                ->update(['dialux_module_id' => $module->id]);
                        }

                        return true;
                    });

                    if ($didMigrate) {
                        $migrated++;
                    }
                }
            });

        return $migrated;
    }

    private function moduleStatus(?string $status): string
    {
        return in_array($status, ['draft', 'in_progress', 'completed', 'archived'], true)
            ? $status
            : 'draft';
    }
}
