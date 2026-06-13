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
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>|string>
     */
    public function rules(): array
    {
        return [
            'document' => ['required', 'array'],
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
            'document.pages' => ['required', 'array', 'min:3'],
            'document.pages.*.id' => ['required', 'string', 'max:160'],
            'document.pages.*.kind' => ['required', 'string', 'in:cover,preliminary-observations,toc,luminaire-list,product-sheet,terrain-cad,terrain-drawn,terrain-architectural,ambient-list,calculation-object-list,ambient-summary,ambient-results,ambient-detail,ambient-plan,ambient-luminaires,ambient-products,ambient-calculation-object,ambient-useful-plane,room-ambient-list,room-luminaires,room-calculation-object,glossary,placeholder'],
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
            'document.toc' => ['required', 'array', 'min:2'],
            'document.toc.*.sectionId' => ['required', 'string'],
            'document.toc.*.title' => ['required', 'string', 'max:255'],
            'document.toc.*.subtitle' => ['nullable', 'string', 'max:255'],
            'document.toc.*.level' => ['required', 'integer', 'min:0'],
            'document.toc.*.pageNumber' => ['required', 'integer', 'min:0'],
            'document.toc.*.kind' => ['nullable', 'string', 'in:item,section-label,section-heading'],
            'document.toc.*.size' => ['nullable', 'string', 'in:small,large'],
            'document.luminaires' => ['present', 'array'],
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
            'document.ambientDetails' => ['present', 'array'],
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
            'document.ambientDetails.*.luminaires' => ['present', 'array'],
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
            'document.ambientDetails.*.fixturePositions' => ['nullable', 'array'],
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
            'document.assets' => ['required', 'array'],
            'document.assets.*.id' => ['required', 'string', 'max:160'],
            'document.assets.*.title' => ['required', 'string', 'max:255'],
            'document.assets.*.purpose' => ['required', 'string', 'max:80'],
            'document.assets.*.kind' => ['required', 'string', 'in:bitmap,vector,structured'],
            'document.assets.*.mimeType' => ['required', 'string', 'max:100'],
            'document.assets.*.width' => ['nullable', 'numeric'],
            'document.assets.*.height' => ['nullable', 'numeric'],
            'document.assets.*.dataUrl' => ['nullable', 'string'],
            'document.assets.*.svg' => ['nullable', 'string'],
            'document.assets.*.data' => ['nullable', 'array'],
            'document.assets.*.data.type' => ['nullable', 'string', 'max:100'],
            'document.assets.*.data.items' => ['nullable', 'array'],
            'document.assets.*.data.items.*.label' => ['nullable', 'string'],
            'document.assets.*.data.items.*.value' => ['nullable', 'string'],
        ];
    }
}
