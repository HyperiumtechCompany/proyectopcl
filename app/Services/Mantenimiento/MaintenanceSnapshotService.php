<?php

namespace App\Services\Mantenimiento;

use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaintenanceSnapshotService
{
    public function create(MaintenanceDocument $document, string $reason, ?int $userId): MaintenanceSnapshot
    {
        return DB::connection('costos_tenant')->transaction(function () use ($document, $reason, $userId) {
            $lockedDocument = MaintenanceDocument::query()->lockForUpdate()->findOrFail($document->id);
            $lockedDocument->load([
                'instituciones',
                'partidas',
                'matMateriales',
                'escenarios.moPartidas',
                'escenarios.moSeries.parciales',
                'escenarios.matCotizaciones',
                'escenarios.matCompras.valores',
            ]);

            return MaintenanceSnapshot::create([
                'public_id' => (string) Str::ulid(),
                'documento_id' => $lockedDocument->id,
                'revision' => $lockedDocument->revision,
                'reason' => $reason,
                'user_id' => $userId,
                'payload' => json_encode($lockedDocument->toArray(), JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);
        }, attempts: 3);
    }
}
