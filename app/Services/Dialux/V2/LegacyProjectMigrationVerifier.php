<?php

namespace App\Services\Dialux\V2;

use Illuminate\Support\Facades\DB;

class LegacyProjectMigrationVerifier
{
    /**
     * @return array{valid: bool, projects_without_modules: int, orphaned_dependencies: array<string, int>, mismatched_dependencies: array<string, int>}
     */
    public function report(): array
    {
        $orphaned = [
            'dialux_plans' => $this->legacyRowsWithoutModule('dialux_plans'),
            'dialux_plan_files' => $this->legacyRowsWithoutModule('dialux_plan_files'),
            'dialux_project_normative_configs' => $this->legacyRowsWithoutModule('dialux_project_normative_configs'),
            'dialux_electrical_projects' => $this->legacyRowsWithoutModule('dialux_electrical_projects'),
        ];

        $mismatched = [
            'dialux_plans' => $this->numericProjectMismatch('dialux_plans'),
            'dialux_plan_files' => $this->numericProjectMismatch('dialux_plan_files'),
            'dialux_project_normative_configs' => $this->ownedProjectMismatch('dialux_project_normative_configs'),
            'dialux_electrical_projects' => $this->ownedProjectMismatch('dialux_electrical_projects'),
        ];

        $projectsWithoutModules = DB::table('dialux_projects')
            ->leftJoin('dialux_modules', 'dialux_modules.dialux_project_id', '=', 'dialux_projects.id')
            ->whereNull('dialux_modules.id')
            ->count('dialux_projects.id');

        return [
            'valid' => $projectsWithoutModules === 0
                && array_sum($orphaned) === 0
                && array_sum($mismatched) === 0,
            'projects_without_modules' => $projectsWithoutModules,
            'orphaned_dependencies' => $orphaned,
            'mismatched_dependencies' => $mismatched,
        ];
    }

    private function legacyRowsWithoutModule(string $table): int
    {
        return DB::table($table)
            ->whereNotNull('dialux_project_id')
            ->whereNull('dialux_module_id')
            ->count();
    }

    private function numericProjectMismatch(string $table): int
    {
        return DB::table($table)
            ->join('dialux_modules', 'dialux_modules.id', '=', $table.'.dialux_module_id')
            ->whereNotNull($table.'.dialux_project_id')
            ->whereColumn($table.'.dialux_project_id', '!=', 'dialux_modules.dialux_project_id')
            ->count();
    }

    private function ownedProjectMismatch(string $table): int
    {
        return DB::table($table)
            ->join('dialux_modules', 'dialux_modules.id', '=', $table.'.dialux_module_id')
            ->join('dialux_projects', 'dialux_projects.id', '=', 'dialux_modules.dialux_project_id')
            ->select([
                $table.'.dialux_project_id as legacy_project_id',
                $table.'.user_id as dependency_user_id',
                'dialux_projects.id as project_id',
                'dialux_projects.user_id as project_user_id',
                'dialux_projects.data as project_data',
            ])
            ->get()
            ->filter(function ($row): bool {
                $projectData = json_decode($row->project_data ?? 'null', true);
                $validIdentifiers = array_filter([
                    (string) $row->project_id,
                    is_array($projectData) ? ($projectData['id'] ?? null) : null,
                ]);

                return (int) $row->dependency_user_id !== (int) $row->project_user_id
                    || ! in_array((string) $row->legacy_project_id, $validIdentifiers, true);
            })
            ->count();
    }
}
