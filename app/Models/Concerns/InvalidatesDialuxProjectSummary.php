<?php

namespace App\Models\Concerns;

use App\Services\Dialux\V2\ProjectSummaryService;

trait InvalidatesDialuxProjectSummary
{
    protected static function bootInvalidatesDialuxProjectSummary(): void
    {
        static::saved(fn ($model) => app(ProjectSummaryService::class)
            ->invalidateForModule($model->module()->first()));
        static::deleted(fn ($model) => app(ProjectSummaryService::class)
            ->invalidateForModule($model->module()->first()));
    }
}
