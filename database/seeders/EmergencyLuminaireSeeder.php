<?php

namespace Database\Seeders;

use App\Models\LuminaireProduct;
use App\Services\ProductImportService;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;

/**
 * Luminarias de EMERGENCIA (evacuación, antipánico, señalización de salida).
 * Cumple RNE A.130 (Perú) y EN 1838 (referencia europea).
 *
 * Diferencias clave vs. `RealPhotometryLuminaireSeeder.php`:
 * - Estas están específicamente categorizadas para emergencia
 * - Se importan con metadata de tipo de emergencia (evacuation-route, antipanic-area, exit-sign)
 * - Requisitos fotométricos diferentes (baja iluminancia, uniformidad >= 0.4)
 *
 * NOTA: Los LDT reales de emergencia deben descargarse desde:
 * 1. DIALux Luminaire Finder (luminaires.dialux.com) — opción recomendada
 * 2. Fabricante oficial (Philips, LEDVANCE, Thorlux, Legrand)
 * 3. Bases de datos europeas de lighting de emergencia
 */
class EmergencyLuminaireSeeder extends Seeder
{
    /**
     * Control de modo: true = importar/actualizar siempre, false = solo si falta.
     * Usar true en deploy para forzar valores nuevos.
     * Usar false en desarrolllo local.
     */
    private bool $forceUpdate = false;

    public function __construct()
    {
        // Detectar si estamos en ambiente de producción o si se fuerza actualización
        $this->forceUpdate = env('SEEDER_FORCE_UPDATE', false);
    }

    public function run(): void
    {
        echo "\nIniciando importacion de luminarias de emergencia con fotometria oficial...\n";
        echo $this->forceUpdate ? "MODO: Fuerza actualizacion (deploy)\n" : "MODO: Solo importar faltantes\n\n";

        $this->importOrUpdate(
            articleNumber: '4099854230714',
            fileName: 'LEDVANCE-4099854230714.ldt',
            overrides: [
                'name' => 'EM EXIT E 0.7W 30M 3H EM/AC AT',
                'manufacturer' => 'LEDVANCE',
                'catalog_number' => '4099854230714',
                'article_number' => '4099854230714',
                'fixture_type' => 'surface',
                'total_lumens' => 20,
                'power_watts' => 0.7,
                'cct' => 5700,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'exit-sign',
                    'recommended_for' => ['evacuation-route'],
                    'emergency_duration_hours' => 3,
                    'viewing_distance_m' => 30,
                    'photometry_source' => 'manufacturer',
                    'source_url' => 'https://www.ledvance.com/en/product-datasheet/365519/283846',
                ],
            ],
        );

        $this->importOrUpdate(
            articleNumber: '4099854230677',
            fileName: 'LEDVANCE-4099854230677.ldt',
            overrides: [
                'name' => 'EM BULKHEAD E 1.3W 3H EM/AC AT',
                'manufacturer' => 'LEDVANCE',
                'catalog_number' => '4099854230677',
                'article_number' => '4099854230677',
                'fixture_type' => 'surface',
                'total_lumens' => 200,
                'power_watts' => 1.3,
                'cct' => 5700,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'min_iluminance_rne' => 0.5,
                    'min_iluminance_en' => 0.5,
                    'uniformity_requirement' => 0.4,
                    'beam_angle_type' => 'broad',
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                    'emergency_duration_hours' => 3,
                    'ip_rating' => 'IP65',
                    'photometry_source' => 'manufacturer',
                    'source_url' => 'https://www.ledvance.com/en/product-datasheet/365513/283840',
                ],
            ],
        );

        $this->updateEmergencyMetadata(
            articleNumber: 'RC18820',
            updates: [
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'min_iluminance_rne' => 0.5,
                    'min_iluminance_en' => 1.0,
                    'uniformity_requirement' => 0.4,
                    'beam_angle_type' => 'broad',
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                ],
            ],
        );
    }

    /**
     * Definiciones historicas conservadas temporalmente como referencia.
     * No se ejecutan porque no corresponden a articulos comerciales verificables.
     */
    private function runLegacy(): void
    {
        echo "\n🔄 Iniciando importación de luminarias de EMERGENCIA...\n";
        echo $this->forceUpdate ? "⚡ MODO: Fuerza actualización (deploy)\n" : "📦 MODO: Solo importar faltantes\n\n";

        // ─── CATEGORÍA 1: SEÑALIZACIÓN DE SALIDA (EXIT Signs) ─────────────────────

        // Philips Safety Exit Sign — LED, bajo consumo
        // Especificaciones típicas: 2x150lm, 2x1.6W, 3000K
        // Descargado de: luminaires.dialux.com o philips.com
        $this->importOrUpdate(
            articleNumber: 'PHILIPS-EXIT-LED',
            fileName: 'Philips-Emergency-Exit-Sign.ldt',
            overrides: [
                'name' => 'Safety Exit Sign LED',
                'manufacturer' => 'Philips',
                'article_number' => 'PHILIPS-EXIT-LED',
                'fixture_type' => 'surface',
                'total_lumens' => 300,      // 2x150
                'power_watts' => 3.2,       // 2x1.6
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'exit-sign',
                    'recommended_for' => ['evacuation-route'],
                ],
            ],
        );

        // LEDVANCE Emergency Sign — compacto, montaje en pared/techo
        // Especificaciones típicas: 280-350lm, 3-5W
        // Descargado de: luminaires.dialux.com o ledvance.com
        $this->importOrUpdate(
            articleNumber: 'LEDVANCE-EXIT-SIGN',
            fileName: 'LEDVANCE-Emergency-Exit-Sign.ldt',
            overrides: [
                'name' => 'Emergency Exit Sign Compact',
                'manufacturer' => 'LEDVANCE',
                'article_number' => 'LEDVANCE-EXIT-SIGN',
                'fixture_type' => 'surface',
                'total_lumens' => 300,
                'power_watts' => 4,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'exit-sign',
                    'recommended_for' => ['evacuation-route'],
                ],
            ],
        );

        // ─── CATEGORÍA 2: ANTIPÁNICO Y GENERAL DE EMERGENCIA ───────────────────

        // Adaptación: THORLUX RADIANCE CORRIDOR — ya existe en tu catálogo
        // Reutilizar RC18820 pero marcar como apto para emergencia en metadata
        $this->updateEmergencyMetadata(
            articleNumber: 'RC18820',
            updates: [
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'min_iluminance_rne' => 0.5,      // lux — RNE A.130
                    'min_iluminance_en' => 1.0,       // lux — EN 1838
                    'uniformity_requirement' => 0.4,
                    'beam_angle_type' => 'broad',
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                ],
            ],
        );

        // Philips Compact Emergency Light — montaje superficial, distribución broad
        // Especificaciones típicas: 2100-2500lm, 20-25W
        // Descargado de: philips.com/en/lighting/professional
        $this->importOrUpdate(
            articleNumber: 'PHILIPS-EMERGENCY-BROAD',
            fileName: 'Philips-Emergency-Compact-25W.ldt',
            overrides: [
                'name' => 'Compact Emergency Light 25W Broad',
                'manufacturer' => 'Philips',
                'article_number' => 'PHILIPS-EMERGENCY-BROAD',
                'fixture_type' => 'surface',
                'total_lumens' => 2300,
                'power_watts' => 25,
                'cct' => 4000,
                'beam_angle_50' => 120,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'min_iluminance_rne' => 0.5,
                    'min_iluminance_en' => 1.0,
                    'uniformity_requirement' => 0.4,
                    'beam_angle_type' => 'broad',
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                ],
            ],
        );

        // LEDVANCE Emergency Bulkhead 30W — para zonas amplias
        // Especificaciones típicas: 2500-2700lm, 30W
        // Descargado de: ledvance.com o luminaires.dialux.com
        $this->importOrUpdate(
            articleNumber: 'LEDVANCE-EMERGENCY-BULKHEAD-30',
            fileName: 'LEDVANCE-Emergency-Bulkhead-30W.ldt',
            overrides: [
                'name' => 'Emergency Bulkhead 30W Surface',
                'manufacturer' => 'LEDVANCE',
                'article_number' => 'LEDVANCE-EMERGENCY-BULKHEAD-30',
                'fixture_type' => 'surface',
                'total_lumens' => 2600,
                'power_watts' => 30,
                'cct' => 4000,
                'beam_angle_50' => 130,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'min_iluminance_rne' => 0.5,
                    'min_iluminance_en' => 1.0,
                    'uniformity_requirement' => 0.4,
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                ],
            ],
        );

        // ─── CATEGORÍA 3: CINTA Y SEÑALIZACIÓN DE PISO ───────────────────────────

        // Legrand Emergency Floor Strip — para marcación de rutas, bajo consumo
        // Especificaciones típicas: 100-150lm, 1-2W
        // Descargado de: legrand.com o luminaires.dialux.com
        $this->importOrUpdate(
            articleNumber: 'LEGRAND-FLOOR-STRIP-LED',
            fileName: 'Legrand-Emergency-Floor-Strip.ldt',
            overrides: [
                'name' => 'Emergency Floor Strip LED 1.2W',
                'manufacturer' => 'Legrand',
                'article_number' => 'LEGRAND-FLOOR-STRIP-LED',
                'fixture_type' => 'strip',
                'total_lumens' => 120,
                'power_watts' => 1.2,
                'cct' => 6500,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'evacuation-marking',
                    'mounting' => 'floor-surface',
                    'marking_type' => 'wayfinding-dot',
                    'recommended_for' => ['evacuation-route'],
                ],
            ],
        );

        // Philips Route Marking — para direccionamiento de evacuación
        // Especificaciones típicas: 100-200lm, 1.5-2W
        // Descargado de: philips.com
        $this->importOrUpdate(
            articleNumber: 'PHILIPS-ROUTE-MARKING',
            fileName: 'Philips-Emergency-Route-Marking.ldt',
            overrides: [
                'name' => 'Route Marking LED 1.5W',
                'manufacturer' => 'Philips',
                'article_number' => 'PHILIPS-ROUTE-MARKING',
                'fixture_type' => 'strip',
                'total_lumens' => 150,
                'power_watts' => 1.5,
                'cct' => 6500,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'evacuation-marking',
                    'mounting' => 'floor-surface',
                    'marking_type' => 'wayfinding-dot',
                    'recommended_for' => ['evacuation-route'],
                ],
            ],
        );

        // ─── CATEGORÍA 4: ILUMINARIA INDUSTRIAL CON EMERGENCIA INTEGRADA ────────

        // Zumtobel Emergency Pendant — para espacios amplios con emergencia integrada
        // Especificaciones típicas: 2000-2200lm (emergencia), 18-20W
        // Ya puede estar en catálogo; si no, importar
        $this->importOrUpdate(
            articleNumber: 'ZUMTOBEL-EMERGENCY-PENDANT',
            fileName: 'Zumtobel-Emergency-Pendant-20W.ldt',
            overrides: [
                'name' => 'Emergency Pendant Suspended 20W',
                'manufacturer' => 'Zumtobel',
                'article_number' => 'ZUMTOBEL-EMERGENCY-PENDANT',
                'fixture_type' => 'pendant',
                'total_lumens' => 2100,
                'power_watts' => 20,
                'cct' => 4000,
                'is_global' => true,
                'metadata' => [
                    'emergency_type' => 'antipanic-area',
                    'mounting' => 'suspended',
                    'min_iluminance_rne' => 0.5,
                    'recommended_for' => ['evacuation-route', 'antipanic-area'],
                ],
            ],
        );
    }

    /**
     * Importa una luminaria si no existe en base de datos (por article_number).
     *
     * @param  array<string, mixed>  $overrides
     */
    /**
     * Importa o actualiza luminaria según modo forceUpdate.
     *
     * - Si forceUpdate = false (desarrollo): solo importa si no existe
     * - Si forceUpdate = true (deploy): reemplaza/reimporta siempre
     *
     * @param  string  $articleNumber  Identificador único de artículo
     * @param  string  $fileName  Nombre del archivo LDT
     * @param  array<string, mixed>  $overrides  Campos a sobrescribir
     */
    private function importOrUpdate(string $articleNumber, string $fileName, array $overrides): void
    {
        $filePath = database_path("seeders/fixtures/luminaires-emergency/{$fileName}");
        $existing = LuminaireProduct::withTrashed()
            ->where('article_number', $articleNumber)
            ->first();

        // ─── CASO 1: Existe y NO forzamos actualización (desarrollo)
        if ($existing && ! $this->forceUpdate) {
            if ($existing->trashed()) {
                $existing->restore();
                echo "♻️  Restaurada: {$existing->name} (ya existía)\n";
            }

            return;
        }

        // Nunca retirar un producto vigente si el artefacto que debe
        // reemplazarlo no viajó con el deploy.
        if (! file_exists($filePath)) {
            echo "⚠️  Archivo no encontrado: {$fileName}\n";
            echo "   Se conserva la luminaria existente sin cambios.\n";
            echo "   Archivo esperado en: {$filePath}\n\n";

            return;
        }

        // ─── CASO 2: Existe y forzamos actualización (deploy)
        if ($existing && $this->forceUpdate) {
            // Soft delete (para mantener historial)
            $existing->delete();
            echo "🗑️  Marcada para reemplazo: {$existing->name}\n";
        }

        // ─── CASO 3: Importar (nuevo o fuerza update)
        try {
            $uploadedFile = new UploadedFile(
                path: $filePath,
                originalName: $fileName,
                mimeType: $this->guessMimeType($fileName),
                error: null,
                test: true
            );

            $importService = new ProductImportService;
            $result = $importService->import(
                file: $uploadedFile,
                userId: null,
                overrides: $overrides,
            );
            $product = $result['product'];

            $status = $this->forceUpdate ? '🔄 Reimportada' : '✅ Importada';
            echo "{$status}: {$product->name} ({$product->article_number})\n";
        } catch (\Exception $e) {
            if ($existing && $this->forceUpdate && $existing->trashed()) {
                $existing->restore();
            }

            echo "❌ Error importando {$fileName}: {$e->getMessage()}\n";

            throw $e;
        }
    }

    /**
     * Actualiza metadata de una luminaria existente para marcarla como apta para emergencia.
     *
     * @param  array<string, mixed>  $updates
     */
    private function updateEmergencyMetadata(string $articleNumber, array $updates): void
    {
        $product = LuminaireProduct::withTrashed()
            ->where('article_number', $articleNumber)
            ->first();

        if (! $product) {
            echo "⚠️  No encontrada: {$articleNumber}\n";

            return;
        }

        if ($product->trashed()) {
            $product->restore();
        }

        // Fusionar metadata existente con nuevos campos
        $existingMetadata = $this->normalizeMetadata($product->metadata);
        $newMetadata = array_merge(
            $existingMetadata,
            $this->normalizeMetadata($updates['metadata'] ?? []),
        );

        $product->update([
            'fixture_type' => $updates['fixture_type'] ?? $product->fixture_type,
            'metadata' => $newMetadata,
        ]);

        echo "✅ Actualizada: {$product->name} como apta para emergencia\n";
    }

    /**
     * Normaliza valores legacy guardados como JSON o JSON doblemente codificado.
     *
     * @return array<string, mixed>
     */
    private function normalizeMetadata(mixed $metadata): array
    {
        for ($attempt = 0; $attempt < 2 && is_string($metadata); $attempt++) {
            $decoded = json_decode($metadata, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return [];
            }

            $metadata = $decoded;
        }

        return is_array($metadata) ? $metadata : [];
    }

    /**
     * Adivina el MIME type según la extensión.
     */
    private function guessMimeType(string $fileName): string
    {
        if (str_ends_with($fileName, '.ldt')) {
            return 'text/plain';
        }
        if (str_ends_with($fileName, '.ies')) {
            return 'text/plain';
        }

        return 'application/octet-stream';
    }
}
