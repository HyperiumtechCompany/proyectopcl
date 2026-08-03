<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreNormativeConfigRequest;
use App\Models\Dialux\DialuxNormativeConfig;
use App\Models\Dialux\DialuxNormativeRequirement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NormativeConfigController extends Controller
{
    /**
     * Catálogo completo de requisitos mínimos de iluminación de la norma
     * (EM.010 RNE Perú), sembrado desde database/data/normativa_luminarias_peru.json.
     */
    public function requirements(Request $request): JsonResponse
    {
        $standard = $request->query('standard', 'rne_peru');

        $requirements = DialuxNormativeRequirement::query()
            ->where('standard', $standard)
            ->orderBy('id')
            ->get();

        return response()->json([
            'standard' => $standard,
            'count' => $requirements->count(),
            'data' => $requirements,
        ]);
    }

    /**
     * Retorna la configuración normativa del proyecto DIALux para el usuario autenticado.
     * Si no existe una configuración previa, retorna valores por defecto.
     */
    public function show(Request $request, string $dialuxProjectId): JsonResponse
    {
        $config = DialuxNormativeConfig::query()
            ->where('dialux_project_id', $dialuxProjectId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $config) {
            return response()->json([
                'data' => null,
                'exists' => false,
            ]);
        }

        return response()->json([
            'data' => $config,
            'exists' => true,
        ]);
    }

    /**
     * Crea o actualiza la configuración normativa del proyecto.
     * Usa updateOrCreate para garantizar una sola config activa por proyecto.
     */
    public function store(StoreNormativeConfigRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $config = DialuxNormativeConfig::query()->updateOrCreate(
            [
                'dialux_project_id' => $validated['dialux_project_id'],
                'user_id' => $request->user()->id,
            ],
            array_merge($validated, [
                'user_id' => $request->user()->id,
                'norms_consulted_at' => $validated['norms_consulted_at'] ?? now()->toDateString(),
                'disclaimer' => $validated['disclaimer'] ?? $this->buildDefaultDisclaimer($validated['primary_standard']),
            ]),
        );

        return response()->json([
            'data' => $config,
            'message' => 'Configuración normativa guardada correctamente.',
        ], $config->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Actualiza únicamente el resumen de cumplimiento (cache de resultados calculados).
     */
    public function updateCompliance(Request $request, string $dialuxProjectId): JsonResponse
    {
        $request->validate([
            'total_rooms' => ['required', 'integer', 'min:0'],
            'compliant_rooms' => ['required', 'integer', 'min:0'],
            'non_compliant_rooms' => ['required', 'integer', 'min:0'],
            'warning_rooms' => ['required', 'integer', 'min:0'],
            'needs_review_rooms' => ['required', 'integer', 'min:0'],
        ]);

        $updated = DialuxNormativeConfig::query()
            ->where('dialux_project_id', $dialuxProjectId)
            ->where('user_id', $request->user()->id)
            ->update($request->only([
                'total_rooms',
                'compliant_rooms',
                'non_compliant_rooms',
                'warning_rooms',
                'needs_review_rooms',
            ]));

        if (! $updated) {
            return response()->json(['message' => 'Configuración normativa no encontrada.'], 404);
        }

        return response()->json(['message' => 'Resumen de cumplimiento actualizado.']);
    }

    /**
     * Genera el texto de disclaimer según la norma seleccionada.
     */
    private function buildDefaultDisclaimer(string $primaryStandard): string
    {
        $disclaimers = [
            'en_12464' => 'Los valores de iluminancia, UGR, uniformidad y Ra presentados están basados en la norma EN 12464-1:2021 (Iluminación de lugares de trabajo interiores), publicada por el Comité Europeo de Normalización (CEN/TC 169). Los datos mostrados son parámetros técnicos fácticos de carácter público. Para información completa, consulte la publicación oficial.',
            'ies_na' => 'Los valores presentados están basados en el IES Lighting Handbook (HB-10-17) y las recomendaciones de la Illuminating Engineering Society (IES). Los datos mostrados son parámetros técnicos fácticos de carácter público. Para información completa, consulte las publicaciones oficiales de la IES.',
            'rne_peru' => 'Los valores de iluminancia presentados están basados en la Norma EM.010 del Reglamento Nacional de Edificaciones (RNE) del Ministerio de Vivienda, Construcción y Saneamiento del Perú (MVCS). Los datos mostrados son parámetros técnicos de carácter oficial y público.',
            'en_1838' => 'Los valores de iluminación de emergencia presentados están basados en la norma EN 1838:2019 (Aplicaciones de la iluminación — Alumbrado de emergencia), publicada por el Comité Europeo de Normalización (CEN/TC 169). Los datos mostrados son parámetros técnicos fácticos de carácter público. Para información completa, consulte la publicación oficial.',
            'nfpa101' => 'Los valores presentados están basados en la NFPA 101 Life Safety Code, publicada por la National Fire Protection Association. Para información completa, consulte la publicación oficial.',
            'ds024' => 'Los valores presentados están basados en el DS-024-2016-EM (Reglamento de Seguridad y Salud Ocupacional en Minería), publicado por el Ministerio de Energía y Minas del Perú. Para información completa, consulte la publicación oficial.',
        ];

        return $disclaimers[$primaryStandard] ?? 'Los valores normativos presentados son parámetros técnicos fácticos obtenidos de fuentes oficiales. Consulte las publicaciones oficiales correspondientes para información completa.';
    }
}
