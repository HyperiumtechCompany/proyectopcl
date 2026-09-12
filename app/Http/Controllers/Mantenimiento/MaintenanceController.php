<?php

namespace App\Http\Controllers\Mantenimiento;

use App\Http\Controllers\Controller;
use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceGgLinea;
use App\Models\Mantenimiento\MaintenanceGgPago;
use App\Models\Mantenimiento\MaintenanceMatCompra;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenanceMoSeries;
use App\Models\Mantenimiento\MaintenancePartida;
use App\Models\Mantenimiento\MaintenanceScenario;
use Illuminate\Http\Request;

abstract class MaintenanceController extends Controller
{
    protected function authorizeProject(Request $request, CostoProject $project): void
    {
        abort_unless($project->user_id === $request->user()?->id, 403);
        abort_unless($project->hasModule('mantenimiento'), 404);
    }

    protected function document(string $id): MaintenanceDocument
    {
        return MaintenanceDocument::query()->where('public_id', $id)->firstOrFail();
    }

    protected function partida(MaintenanceDocument $document, string $id): MaintenancePartida
    {
        return $document->partidas()->where('public_id', $id)->firstOrFail();
    }

    protected function series(MaintenanceDocument $document, string $id): MaintenanceMoSeries
    {
        $serie = MaintenanceMoSeries::query()->where('public_id', $id)->firstOrFail();
        abort_unless($serie->escenario->documento_id === $document->id, 404);

        return $serie;
    }

    protected function scenario(MaintenanceDocument $document, string $id): MaintenanceScenario
    {
        return $document->escenarios()->where('public_id', $id)->firstOrFail();
    }

    protected function material(MaintenanceDocument $document, string $id): MaintenanceMatMaterial
    {
        return $document->matMateriales()->where('public_id', $id)->firstOrFail();
    }

    protected function compra(MaintenanceDocument $document, string $id): MaintenanceMatCompra
    {
        $compra = MaintenanceMatCompra::query()->where('public_id', $id)->firstOrFail();
        abort_unless($compra->escenario->documento_id === $document->id, 404);

        return $compra;
    }

    protected function ggLinea(MaintenanceDocument $document, string $id): MaintenanceGgLinea
    {
        return $document->ggLineas()->where('public_id', $id)->firstOrFail();
    }

    protected function ggPago(MaintenanceDocument $document, string $id): MaintenanceGgPago
    {
        $pago = MaintenanceGgPago::query()->where('public_id', $id)->firstOrFail();
        abort_unless($pago->escenario->documento_id === $document->id, 404);

        return $pago;
    }
}
