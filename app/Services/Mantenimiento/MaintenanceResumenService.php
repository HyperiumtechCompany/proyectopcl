<?php

namespace App\Services\Mantenimiento;

use App\Domain\Mantenimiento\Resumen\ResumenCalculator;
use App\Models\Mantenimiento\MaintenanceDocument;
use Illuminate\Support\Facades\DB;

class MaintenanceResumenService
{
    public function __construct(
        private readonly ResumenCalculator $calculator,
        private readonly MaintenanceMoService $mo,
        private readonly MaintenanceMatService $mat,
        private readonly MaintenanceGgService $gg,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function payload(MaintenanceDocument $document): array
    {
        $mo = $this->mo->payload($document, $this->scenarios->activeFor($document, 'mo'));
        $mat = $this->mat->payload($document, $this->scenarios->activeFor($document, 'mat'));
        $gg = $this->gg->payload($document, $this->scenarios->activeFor($document, 'gg'));

        return $this->calculator->payload($mo, $mat, $gg, $document->parametros);
    }

    public function updateParametros(MaintenanceDocument $document, array $data): array
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $data) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $current = ResumenCalculator::normalizeParametros($locked->parametros);
            $locked->parametros = ResumenCalculator::normalizeParametros(array_replace_recursive($current, $data));
            $locked->increment('revision');
            $locked->save();

            return ['revision' => (int) $locked->revision, 'resumen' => $this->payload($locked->refresh())];
        }, attempts: 3);
    }
}
