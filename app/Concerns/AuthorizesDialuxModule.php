<?php

namespace App\Concerns;

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;

trait AuthorizesDialuxModule
{
    use AuthorizesDialuxProject;

    protected function authorizeModule(DialuxProject $project, DialuxModule $module): void
    {
        $this->authorizeProyecto($project);
        abort_unless($module->dialux_project_id === $project->id, 404);
    }
}
