<?php

namespace App\Http\Controllers\GastFin;

use App\Http\Controllers\Controller;
use App\Http\Requests\GastFin\GastFinMatCompraRequest;
use App\Http\Requests\GastFin\SetGastFinMatCompraValorRequest;
use App\Http\Requests\GastFin\SetGastFinMatCotizacionRequest;
use App\Http\Requests\GastFin\SetGastFinMoValorRequest;
use App\Http\Requests\GastFin\StoreGastFinMatInsumoRequest;
use App\Http\Requests\GastFin\StoreGastFinMoPagoRequest;
use App\Http\Requests\GastFin\UpdateGastFinGrupoRequest;
use App\Http\Requests\GastFin\UpdateGastFinMatInsumoRequest;
use App\Http\Requests\GastFin\UpdateGastFinMoPagoRequest;
use App\Http\Requests\Mantenimiento\UpdateResumenParametrosRequest;
use App\Models\CostoProject;
use App\Models\GastFin\GastFinMatCompra;
use App\Models\GastFin\GastFinMatInsumo;
use App\Models\GastFin\GastFinMoPago;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Services\GastFin\GastFinDocumentService;
use App\Services\GastFin\GastFinMatService;
use App\Services\GastFin\GastFinMoService;
use App\Services\GastFin\GastFinResumenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gast. Fin. (Gastos Financieros), modo de Delphin. Un documento por presupuesto, resuelto en
 * cada petición: el frontend no maneja ids de documento salvo para GG, que reutiliza las rutas
 * de Mantenimiento con el public_id que devuelve show().
 *
 * Igual que Mantenimiento: sin route-model-binding para modelos de costos_tenant
 * (SubstituteBindings corre antes de SetCostosDatabase).
 */
class GastFinController extends Controller
{
    public function __construct(
        private readonly GastFinDocumentService $documents,
        private readonly GastFinMoService $mo,
        private readonly GastFinMatService $mat,
        private readonly GastFinResumenService $resumen,
    ) {}

    public function show(Request $request, CostoProject $costoProject): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json([
            'document' => ['id' => $document->public_id, 'revision' => (int) $document->revision],
            'grupos' => $this->documents->grupos($document),
        ]);
    }

    public function updateGrupo(UpdateGastFinGrupoRequest $request, CostoProject $costoProject, string $grupoRef): JsonResponse
    {
        $document = $this->document($request, $costoProject);
        $revision = $this->documents->updateGrupo($document, $grupoRef, $request->validated());

        return response()->json(['revision' => $revision, 'grupos' => $this->documents->grupos($document), 'mo' => $this->mo->payload($document)]);
    }

    public function resumen(Request $request, CostoProject $costoProject): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json(['revision' => (int) $document->revision, 'resumen' => $this->resumen->payload($document)]);
    }

    public function updateParametros(UpdateResumenParametrosRequest $request, CostoProject $costoProject): JsonResponse
    {
        return response()->json($this->resumen->updateParametros($this->document($request, $costoProject), $request->validated()));
    }

    public function mo(Request $request, CostoProject $costoProject): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mo->response($document, (int) $document->revision));
    }

    public function storeMoPago(StoreGastFinMoPagoRequest $request, CostoProject $costoProject): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mo->addPago($document, $request->string('nombre')->toString(), $request->validated('fecha')), 201);
    }

    public function updateMoPago(UpdateGastFinMoPagoRequest $request, CostoProject $costoProject, string $pagoId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mo->updatePago($document, $this->moPago($document, $pagoId), $request->validated()));
    }

    public function destroyMoPago(Request $request, CostoProject $costoProject, string $pagoId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mo->deletePago($document, $this->moPago($document, $pagoId)));
    }

    public function setMoValor(SetGastFinMoValorRequest $request, CostoProject $costoProject, string $pagoId, string $grupoRef, string $franja): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mo->setValor($document, $this->moPago($document, $pagoId), $grupoRef, $franja, $request->validated()));
    }

    public function mat(Request $request, CostoProject $costoProject, string $grupoRef): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->response($document, $grupoRef, (int) $document->revision));
    }

    public function setMatCotizacion(SetGastFinMatCotizacionRequest $request, CostoProject $costoProject, string $grupoRef): JsonResponse
    {
        $document = $this->document($request, $costoProject);
        $data = $request->safe()->except('insumo_key');

        return response()->json($this->mat->setCotizacion($document, $grupoRef, $request->validated('insumo_key'), $data));
    }

    public function storeMatCompra(GastFinMatCompraRequest $request, CostoProject $costoProject, string $grupoRef): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->addCompra($document, $grupoRef, $request->validated('fecha')), 201);
    }

    public function updateMatCompra(GastFinMatCompraRequest $request, CostoProject $costoProject, string $compraId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->updateCompra($document, $this->matCompra($document, $compraId), $request->validated('fecha')));
    }

    public function destroyMatCompra(Request $request, CostoProject $costoProject, string $compraId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->deleteCompra($document, $this->matCompra($document, $compraId)));
    }

    public function setMatCompraValor(SetGastFinMatCompraValorRequest $request, CostoProject $costoProject, string $compraId): JsonResponse
    {
        $document = $this->document($request, $costoProject);
        $data = $request->safe()->except('insumo_key');

        return response()->json($this->mat->setCompraValor($document, $this->matCompra($document, $compraId), $request->validated('insumo_key'), $data));
    }

    public function storeMatInsumo(StoreGastFinMatInsumoRequest $request, CostoProject $costoProject, string $grupoRef): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->addManual($document, $grupoRef, $request->string('descripcion')->toString(), $request->validated('unidad')), 201);
    }

    public function updateMatInsumo(UpdateGastFinMatInsumoRequest $request, CostoProject $costoProject, string $insumoId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->updateManual($document, $this->matInsumo($document, $insumoId), $request->validated()));
    }

    public function destroyMatInsumo(Request $request, CostoProject $costoProject, string $insumoId): JsonResponse
    {
        $document = $this->document($request, $costoProject);

        return response()->json($this->mat->deleteInsumo($document, $this->matInsumo($document, $insumoId)));
    }

    private function document(Request $request, CostoProject $project): MaintenanceDocument
    {
        abort_unless($project->user_id === $request->user()?->id, 403);

        return $this->documents->resolve($project);
    }

    private function moPago(MaintenanceDocument $document, string $id): GastFinMoPago
    {
        return GastFinMoPago::query()->where('documento_id', $document->id)->where('public_id', $id)->firstOrFail();
    }

    private function matCompra(MaintenanceDocument $document, string $id): GastFinMatCompra
    {
        return GastFinMatCompra::query()->where('documento_id', $document->id)->where('public_id', $id)->firstOrFail();
    }

    private function matInsumo(MaintenanceDocument $document, string $id): GastFinMatInsumo
    {
        return GastFinMatInsumo::query()->where('documento_id', $document->id)->where('public_id', $id)->firstOrFail();
    }
}
