<?php

namespace App\Http\Requests\Dialux;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;

class FormalExportRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Log validation errors before throwing so we can diagnose 422 issues.
     */
    protected function failedValidation(Validator $validator): never
    {
        Log::error('[DIAlux FormalExport] Validation failed', [
            'errors' => $validator->errors()->toArray(),
        ]);

        throw new HttpResponseException(
            response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $validator->errors()->toArray(),
            ], 422)
        );
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'document.schemaVersion.in' => 'La version del documento no es compatible con este servidor. Version soportada: 1.',
            'document.schemaVersion.required' => 'El documento debe declarar document.schemaVersion.',
            'document.assets.*.dataUrl.max' => 'El asset excede el tamano maximo permitido para dataUrl.',
            'document.assets.*.dataUrl.regex' => 'El asset dataUrl debe ser una imagen base64 valida (data:image/tipo;base64,...).',
            'document.pages.max' => 'El documento excede el numero maximo de paginas permitido.',
            'document.assets.max' => 'El documento excede el numero maximo de assets permitido.',
            'dialux_project_id.required' => 'Falta indicar a que proyecto pertenece este reporte.',
            'dialux_project_id.exists' => 'El proyecto indicado no existe.',
        ];
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>|string>
     */
    public function rules(): array
    {
        return [
            // El reporte se genera a partir de un payload ya calculado en el
            // cliente (no se lee el proyecto de la BD para renderizar), pero
            // igual se exige y valida la propiedad para auditar/limitar el
            // uso de este endpoint por proyecto real del usuario autenticado
            // (ver Editor2DController::formalExport, que verifica dueño).
            'dialux_project_id' => ['required', 'exists:dialux_projects,id'],
            'document' => ['required', 'array'],
            'document.schemaVersion' => ['required', 'integer', 'in:1'],
            'document.title' => ['required', 'string', 'max:255'],
            'document.subtitle' => ['nullable', 'string', 'max:255'],
            'document.fileBaseName' => ['required', 'string', 'max:160'],
            'document.generatedAt' => ['required', 'string'],
            'document.header' => ['required', 'array'],
            'document.header.title' => ['required', 'string', 'max:255'],
            'document.header.subtitle' => ['nullable', 'string', 'max:255'],
            'document.footer' => ['required', 'array'],
            'document.footer.left' => ['nullable', 'string', 'max:255'],
            'document.footer.right' => ['nullable', 'string', 'max:255'],
            'document.metadata' => ['required', 'array'],
            'document.metadata.*.label' => ['required', 'string', 'max:255'],
            'document.metadata.*.value' => ['required', 'string', 'max:255'],
            // min:1 (antes min:3): el informe de emergencia (Fase 14) es un
            // documento legítimo de solo 2 páginas (portada + tabla de
            // cumplimiento) — el export formal normal siempre supera esto
            // de sobra por su propio contenido, así que bajar el mínimo no
            // relaja nada para ese caso.
            'document.pages' => ['required', 'array', 'min:1', 'max:800'],
            'document.pages.*.id' => ['required', 'string', 'max:160'],
            'document.pages.*.kind' => ['required', 'string', 'in:cover,preliminary-observations,toc,luminaire-list,product-sheet,terrain-cad,terrain-drawn,terrain-architectural,ambient-list,calculation-object-list,ambient-summary,ambient-results,ambient-detail,ambient-plan,ambient-luminaires,ambient-products,ambient-calculation-object,ambient-useful-plane,room-ambient-list,room-luminaires,room-calculation-object,level-luminaire-list,lighting-scene-comparison,emergency-cover,emergency-compliance-table,glossary,placeholder'],
            'document.pages.*.sectionId' => ['required', 'string'],
            'document.pages.*.pageNumber' => ['required', 'integer', 'min:1'],
            'document.pages.*.title' => ['required', 'string', 'max:255'],
            'document.pages.*.subtitle' => ['nullable', 'string', 'max:255'],
            'document.pages.*.assetIds' => ['array'],
            'document.pages.*.assetIds.*' => ['required', 'string', 'max:160'],
            'document.pages.*.notes' => ['array'],
            'document.pages.*.notes.*' => ['required', 'string', 'max:500'],
            'document.pages.*.ambientId' => ['nullable', 'string', 'max:160'],
            'document.pages.*.roomId' => ['nullable', 'string', 'max:160'],
            'document.pages.*.sceneId' => ['nullable', 'string', 'max:160'],
            'document.pages.*.sceneName' => ['nullable', 'string', 'max:255'],
            'document.pages.*.rowRangeStart' => ['nullable', 'integer', 'min:0'],
            'document.pages.*.rowRangeEnd' => ['nullable', 'integer', 'min:0'],
            // Fase 13 (§11: "anexos comparativos") — el builder ya arma el
            // objeto completo en el frontend, sin join en el backend.
            'document.pages.*.sceneComparison' => ['nullable', 'array'],
            'document.pages.*.sceneComparison.id' => ['required_with:document.pages.*.sceneComparison', 'string', 'max:160'],
            'document.pages.*.sceneComparison.levelId' => ['required_with:document.pages.*.sceneComparison', 'string', 'max:160'],
            'document.pages.*.sceneComparison.levelName' => ['required_with:document.pages.*.sceneComparison', 'string', 'max:255'],
            'document.pages.*.sceneComparison.baselineSceneName' => ['required_with:document.pages.*.sceneComparison', 'string', 'max:255'],
            'document.pages.*.sceneComparison.comparisonSceneName' => ['required_with:document.pages.*.sceneComparison', 'string', 'max:255'],
            'document.pages.*.sceneComparison.entries' => ['array'],
            'document.pages.*.sceneComparison.entries.*.objectId' => ['required', 'string', 'max:160'],
            'document.pages.*.sceneComparison.entries.*.objectName' => ['required', 'string', 'max:255'],
            'document.pages.*.sceneComparison.entries.*.levelId' => ['required', 'string', 'max:160'],
            'document.pages.*.sceneComparison.entries.*.avgLuxDelta' => ['required', 'numeric'],
            'document.pages.*.sceneComparison.entries.*.minLuxDelta' => ['required', 'numeric'],
            'document.pages.*.sceneComparison.entries.*.maxLuxDelta' => ['required', 'numeric'],
            'document.pages.*.sceneComparison.entries.*.uniformityDelta' => ['required', 'numeric'],
            'document.pages.*.sceneComparison.entries.*.ugrDelta' => ['required', 'numeric'],
            // Fase 14 (§11, "Emergencia"): el builder ya arma el objeto
            // completo en el frontend (RNE A.130 / EN 1838 evaluadas por
            // separado, nunca fusionadas), sin join en el backend — mismo
            // patrón que sceneComparison de la Fase 13.
            'document.pages.*.emergencyRooms' => ['nullable', 'array'],
            'document.pages.*.emergencyRooms.*.roomId' => ['required', 'string', 'max:160'],
            'document.pages.*.emergencyRooms.*.roomName' => ['required', 'string', 'max:255'],
            'document.pages.*.emergencyRooms.*.roomType' => ['required', 'string', 'in:evacuation-route,antipanic-area'],
            'document.pages.*.emergencyRooms.*.levelId' => ['required', 'string', 'max:160'],
            'document.pages.*.emergencyRooms.*.levelName' => ['required', 'string', 'max:255'],
            'document.pages.*.emergencyRooms.*.minLux' => ['nullable', 'numeric'],
            'document.pages.*.emergencyRooms.*.criticalPoint' => ['nullable', 'array'],
            'document.pages.*.emergencyRooms.*.criticalPoint.x' => ['required_with:document.pages.*.emergencyRooms.*.criticalPoint', 'numeric'],
            'document.pages.*.emergencyRooms.*.criticalPoint.y' => ['required_with:document.pages.*.emergencyRooms.*.criticalPoint', 'numeric'],
            'document.pages.*.emergencyRooms.*.evaluations' => ['array'],
            'document.pages.*.emergencyRooms.*.evaluations.*.standard' => ['required', 'string', 'in:rne_a130,en_1838'],
            'document.pages.*.emergencyRooms.*.evaluations.*.source' => ['required', 'string', 'max:255'],
            'document.pages.*.emergencyRooms.*.evaluations.*.mandatory' => ['required', 'boolean'],
            'document.pages.*.emergencyRooms.*.evaluations.*.metric' => ['required', 'string', 'in:illuminance'],
            'document.pages.*.emergencyRooms.*.evaluations.*.requiredLux' => ['required', 'numeric'],
            'document.pages.*.emergencyRooms.*.evaluations.*.calculatedLux' => ['nullable', 'numeric'],
            'document.pages.*.emergencyRooms.*.evaluations.*.status' => ['required', 'string', 'in:pass,fail,not-evaluated'],
            'document.toc' => ['required', 'array', 'min:2', 'max:900'],
            'document.toc.*.sectionId' => ['required', 'string'],
            'document.toc.*.title' => ['required', 'string', 'max:255'],
            'document.toc.*.subtitle' => ['nullable', 'string', 'max:255'],
            'document.toc.*.level' => ['required', 'integer', 'min:0'],
            'document.toc.*.pageNumber' => ['required', 'integer', 'min:0'],
            'document.toc.*.kind' => ['nullable', 'string', 'in:item,section-label,section-heading'],
            'document.toc.*.size' => ['nullable', 'string', 'in:small,large'],
            'document.luminaires' => ['present', 'array', 'max:5000'],
            'document.luminaires.*.id' => ['required', 'string', 'max:160'],
            'document.luminaires.*.name' => ['required', 'string', 'max:255'],
            'document.luminaires.*.model' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.brand' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.articleNumber' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.fixtureShape' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.shape' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.lumens' => ['nullable', 'numeric'],
            'document.luminaires.*.powerWatts' => ['nullable', 'numeric'],
            'document.luminaires.*.efficiency' => ['nullable', 'numeric'],
            'document.luminaires.*.roomName' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.ambientName' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.quantity' => ['required', 'integer', 'min:1'],
            'document.luminaires.*.cct' => ['nullable', 'numeric'],
            'document.luminaires.*.cri' => ['nullable', 'numeric'],
            'document.luminaires.*.description' => ['nullable', 'string'],
            'document.luminaires.*.applications' => ['nullable', 'string'],
            'document.luminaires.*.reportData' => ['nullable', 'array'],
            'document.luminaires.*.reportData.technical_table' => ['nullable', 'array'],
            'document.luminaires.*.reportData.technical_table.*.label' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.reportData.technical_table.*.value' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.reportData.warnings' => ['nullable', 'array'],
            'document.luminaires.*.reportData.warnings.*' => ['string', 'max:500'],
            // Fase 15, Parte B: tabla de referencia UGR calculada por el
            // motor propio — nunca se presenta como dato de fabricante sin
            // este contrato completo (procedencia/método/disclaimer citados).
            'document.luminaires.*.reportData.ugrTableComputed' => ['nullable', 'array'],
            'document.luminaires.*.reportData.ugrTableComputed.provenance' => ['nullable', 'string', 'in:manufacturer,engine-calculated'],
            'document.luminaires.*.reportData.ugrTableComputed.method' => ['nullable', 'string', 'max:255'],
            'document.luminaires.*.reportData.ugrTableComputed.disclaimer' => ['nullable', 'string', 'max:500'],
            'document.luminaires.*.reportData.ugrTableComputed.shr' => ['nullable', 'numeric'],
            'document.luminaires.*.reportData.ugrTableComputed.reflectances' => ['nullable', 'array'],
            'document.luminaires.*.reportData.ugrTableComputed.reflectances.ceiling' => ['nullable', 'numeric'],
            'document.luminaires.*.reportData.ugrTableComputed.reflectances.wall' => ['nullable', 'numeric'],
            'document.luminaires.*.reportData.ugrTableComputed.reflectances.floor' => ['nullable', 'numeric'],
            'document.luminaires.*.reportData.ugrTableComputed.entries' => ['nullable', 'array'],
            'document.luminaires.*.reportData.ugrTableComputed.entries.*.roomLabel' => ['nullable', 'string', 'max:120'],
            'document.luminaires.*.reportData.ugrTableComputed.entries.*.ugrCrosswise' => ['nullable', 'numeric'],
            'document.luminaires.*.reportData.ugrTableComputed.entries.*.ugrEndwise' => ['nullable', 'numeric'],
            'document.luminaires.*.reportAssets' => ['nullable', 'array'],
            'document.luminaires.*.reportAssets.polar_svg' => ['nullable', 'string'],
            'document.luminaires.*.ugrTable' => ['nullable', 'array'],
            'document.luminaires.*.ugrDiagramValue' => ['nullable', 'string'],
            'document.luminaires.*.polarDiagramAssetId' => ['nullable', 'string', 'max:160'],
            'document.luminaires.*.productPhotoAssetId' => ['nullable', 'string', 'max:160'],
            'document.luminaires.*.brandLogoAssetId' => ['nullable', 'string', 'max:160'],
            'document.luminaires.*.lineDrawingAssetId' => ['nullable', 'string', 'max:160'],
            'document.luminaireTotals' => ['nullable', 'array'],
            'document.luminaireTotals.totalLumens' => ['nullable', 'numeric'],
            'document.luminaireTotals.totalPowerWatts' => ['nullable', 'numeric'],
            'document.luminaireTotals.overallEfficiency' => ['nullable', 'numeric'],
            'document.levels' => ['present', 'array', 'max:50'],
            'document.levels.*.sceneId' => ['required', 'string', 'max:160'],
            'document.levels.*.sceneName' => ['required', 'string', 'max:255'],
            'document.levels.*.floorIndex' => ['required', 'integer'],
            'document.levels.*.ambientCount' => ['required', 'integer', 'min:0'],
            'document.levels.*.calculatedAmbientCount' => ['required', 'integer', 'min:0'],
            'document.levels.*.compliantAmbientCount' => ['required', 'integer', 'min:0'],
            'document.levels.*.fixtureCount' => ['required', 'integer', 'min:0'],
            'document.levels.*.luminaires' => ['present', 'array', 'max:5000'],
            'document.levels.*.luminaires.*.id' => ['required', 'string', 'max:160'],
            'document.levels.*.luminaires.*.name' => ['required', 'string', 'max:255'],
            'document.levels.*.luminaires.*.model' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.brand' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.articleNumber' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.fixtureShape' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.shape' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.lumens' => ['nullable', 'numeric'],
            'document.levels.*.luminaires.*.powerWatts' => ['nullable', 'numeric'],
            'document.levels.*.luminaires.*.efficiency' => ['nullable', 'numeric'],
            'document.levels.*.luminaires.*.roomName' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.ambientName' => ['nullable', 'string', 'max:255'],
            'document.levels.*.luminaires.*.quantity' => ['required', 'integer', 'min:1'],
            'document.levels.*.luminaireTotals' => ['nullable', 'array'],
            'document.levels.*.luminaireTotals.totalLumens' => ['nullable', 'numeric'],
            'document.levels.*.luminaireTotals.totalPowerWatts' => ['nullable', 'numeric'],
            'document.levels.*.luminaireTotals.overallEfficiency' => ['nullable', 'numeric'],
            'document.glossary' => ['present', 'array', 'max:200'],
            'document.glossary.*.letter' => ['required', 'string', 'max:8'],
            'document.glossary.*.term' => ['required', 'string', 'max:160'],
            'document.glossary.*.definition' => ['required', 'string', 'max:2000'],
            'document.glossary.*.abbreviation' => ['nullable', 'string', 'max:80'],
            'document.ambientDetails' => ['present', 'array', 'max:2000'],
            'document.ambientDetails.*.ambientId' => ['required', 'string', 'max:160'],
            'document.ambientDetails.*.roomId' => ['required', 'string', 'max:160'],
            'document.ambientDetails.*.roomName' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.ambientName' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.activity' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.area' => ['required', 'numeric'],
            'document.ambientDetails.*.perimeter' => ['nullable', 'numeric'],
            'document.ambientDetails.*.usefulArea' => ['nullable', 'numeric'],
            'document.ambientDetails.*.targetLux' => ['required', 'numeric'],
            'document.ambientDetails.*.avgLux' => ['nullable', 'numeric'],
            'document.ambientDetails.*.minLux' => ['nullable', 'numeric'],
            'document.ambientDetails.*.maxLux' => ['nullable', 'numeric'],
            'document.ambientDetails.*.uniformity' => ['nullable', 'numeric'],
            'document.ambientDetails.*.g2' => ['nullable', 'numeric'],
            'document.ambientDetails.*.uniformityTarget' => ['nullable', 'numeric'],
            'document.ambientDetails.*.ugr' => ['nullable', 'numeric'],
            'document.ambientDetails.*.ugrLimit' => ['nullable', 'numeric'],
            'document.ambientDetails.*.interiorHeight' => ['nullable', 'numeric'],
            'document.ambientDetails.*.reflectionCeiling' => ['nullable', 'numeric'],
            'document.ambientDetails.*.reflectionWall' => ['nullable', 'numeric'],
            'document.ambientDetails.*.reflectionFloor' => ['nullable', 'numeric'],
            'document.ambientDetails.*.maintenanceFactor' => ['nullable', 'numeric'],
            'document.ambientDetails.*.usefulPlaneHeight' => ['nullable', 'numeric'],
            'document.ambientDetails.*.marginalZone' => ['nullable', 'numeric'],
            'document.ambientDetails.*.calculationIndex' => ['nullable', 'string', 'max:40'],
            'document.ambientDetails.*.fixtureCount' => ['required', 'integer', 'min:0'],
            'document.ambientDetails.*.totalPowerWatts' => ['nullable', 'numeric'],
            'document.ambientDetails.*.lumensRequired' => ['required', 'numeric'],
            'document.ambientDetails.*.fixtureLumens' => ['required', 'numeric'],
            'document.ambientDetails.*.exactQuantity' => ['required', 'numeric'],
            'document.ambientDetails.*.roundedQuantity' => ['required', 'numeric'],
            'document.ambientDetails.*.coverage' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.complianceLabel' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.planAssetId' => ['nullable', 'string', 'max:160'],
            'document.ambientDetails.*.isoluxAssetId' => ['nullable', 'string', 'max:160'],
            'document.ambientDetails.*.requirementEvaluations' => ['nullable', 'array'],
            'document.ambientDetails.*.requirementEvaluations.*.metric' => ['required', 'string', 'max:80'],
            'document.ambientDetails.*.requirementEvaluations.*.calculatedValue' => ['nullable', 'numeric'],
            'document.ambientDetails.*.requirementEvaluations.*.operator' => ['required', 'string', 'in:>=,<=,>,<,='],
            'document.ambientDetails.*.requirementEvaluations.*.requiredValue' => ['nullable', 'numeric'],
            'document.ambientDetails.*.requirementEvaluations.*.unit' => ['required', 'string', 'max:40'],
            'document.ambientDetails.*.requirementEvaluations.*.status' => ['required', 'string', 'in:pass,fail,not-evaluated,stale'],
            'document.ambientDetails.*.requirementEvaluations.*.source' => ['nullable', 'string', 'max:160'],
            'document.ambientDetails.*.provenance' => ['nullable', 'array'],
            'document.ambientDetails.*.provenance.engine' => ['nullable', 'string', 'max:120'],
            'document.ambientDetails.*.provenance.engineVersion' => ['nullable', 'string', 'max:40'],
            'document.ambientDetails.*.provenance.calculatedAt' => ['nullable', 'string'],
            'document.ambientDetails.*.provenance.status' => ['nullable', 'string', 'in:calculated,stale,imported,not-calculated'],
            // Fase 13 (§11: "mostrar engineVersion, modo y warnings"): estos
            // dos campos de `provenance` se agregaron en la Fase 11 pero
            // nunca se validaron aquí — sin regla, `validated()` los
            // descartaba antes de llegar al Blade, dejando esa trazabilidad
            // inaccesible en el request real (nunca lo notó ningún test).
            'document.ambientDetails.*.provenance.snapshotHash' => ['nullable', 'string', 'max:64'],
            'document.ambientDetails.*.provenance.configSummary' => ['nullable', 'string', 'max:255'],
            // Mismo hallazgo: `warnings` por ambiente (Fase 11) tampoco se validaba.
            'document.ambientDetails.*.warnings' => ['array'],
            'document.ambientDetails.*.warnings.*.code' => ['required', 'string', 'max:120'],
            'document.ambientDetails.*.warnings.*.message' => ['required', 'string', 'max:1000'],
            'document.ambientDetails.*.warnings.*.objectId' => ['nullable', 'string', 'max:160'],
            'document.ambientDetails.*.luminaires' => ['present', 'array', 'max:500'],
            'document.ambientDetails.*.luminaires.*.id' => ['required', 'string', 'max:160'],
            'document.ambientDetails.*.luminaires.*.name' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.model' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.brand' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.articleNumber' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.fixtureShape' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.shape' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.lumens' => ['nullable', 'numeric'],
            'document.ambientDetails.*.luminaires.*.powerWatts' => ['nullable', 'numeric'],
            'document.ambientDetails.*.luminaires.*.efficiency' => ['nullable', 'numeric'],
            'document.ambientDetails.*.luminaires.*.roomName' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.ambientName' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.luminaires.*.quantity' => ['required', 'integer', 'min:1'],
            'document.ambientDetails.*.fixturePositions' => ['nullable', 'array', 'max:1000'],
            'document.ambientDetails.*.fixturePositions.*.id' => ['required', 'string', 'max:160'],
            'document.ambientDetails.*.fixturePositions.*.name' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.fixturePositions.*.productName' => ['required', 'string', 'max:255'],
            'document.ambientDetails.*.fixturePositions.*.x' => ['required', 'numeric'],
            'document.ambientDetails.*.fixturePositions.*.y' => ['required', 'numeric'],
            'document.ambientDetails.*.fixturePositions.*.mountingHeight' => ['nullable', 'numeric'],
            'document.ambientDetails.*.fixturePositions.*.brand' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.fixturePositions.*.articleNumber' => ['nullable', 'string', 'max:255'],
            'document.ambientDetails.*.fixturePositions.*.lumens' => ['nullable', 'numeric'],
            'document.ambientDetails.*.fixturePositions.*.powerWatts' => ['nullable', 'numeric'],
            // 'present' (no 'required'): el informe de emergencia (Fase 14)
            // es un documento legítimo sin ningún asset (sin CDL, sin
            // planos) — Laravel trata un array vacío como "vacío" bajo
            // 'required', rechazando ese caso válido.
            'document.assets' => ['present', 'array', 'max:1500'],
            'document.assets.*.id' => ['required', 'string', 'max:160'],
            'document.assets.*.title' => ['required', 'string', 'max:255'],
            'document.assets.*.purpose' => ['required', 'string', 'max:80'],
            'document.assets.*.kind' => ['required', 'string', 'in:bitmap,vector,structured'],
            'document.assets.*.mimeType' => ['required', 'string', 'max:100'],
            'document.assets.*.width' => ['nullable', 'numeric'],
            'document.assets.*.height' => ['nullable', 'numeric'],
            // Solo se aceptan imagenes embebidas como base64 real (nunca URLs
            // remotas: Dompdf tiene isRemoteEnabled desactivado, pero esta
            // regla ademas evita cadenas malformadas o no-base64 en el campo.
            'document.assets.*.dataUrl' => [
                'nullable',
                'string',
                'max:20000000',
                'regex:/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+\/]+={0,2}$/',
            ],
            'document.assets.*.svg' => ['nullable', 'string'],
            'document.assets.*.data' => ['nullable', 'array'],
            'document.assets.*.data.type' => ['nullable', 'string', 'max:100'],
            'document.assets.*.data.items' => ['nullable', 'array'],
            'document.assets.*.data.items.*.label' => ['nullable', 'string'],
            'document.assets.*.data.items.*.value' => ['nullable', 'string'],
        ];
    }
}
