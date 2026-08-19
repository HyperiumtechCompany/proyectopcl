<?php

namespace Database\Seeders;

use App\Models\Dialux\DialuxNormativeRequirement;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DialuxNormativeRequirementsSeeder extends Seeder
{
    /**
     * Archivo fuente de cada norma → standard con el que se siembra en
     * dialux_normative_requirements. Agregar aquí una fila para sumar una
     * norma nueva al mismo patrón (ver [[dialux-normativa-fuente-unica]]).
     *
     * @var array<string, string>
     */
    private const SOURCES = [
        'normativa_luminarias_peru.json' => 'rne_peru',
        'normativa_en1838.json' => 'en_1838',
        // Fase 14 (plan maestro §11, "Emergencia"): fuente OBLIGATORIA real
        // de alumbrado de emergencia en Perú — 'rne_peru' (EM.010) no trata
        // este tema en absoluto (verificado por texto completo del RNE).
        'normativa_a130.json' => 'rne_a130',
        'normativa_en12464_1.json' => 'en_12464_1',
        'normativa_en12464_2.json' => 'en_12464_2',
        'normativa_en13201_2.json' => 'en_13201_2',
        'normativa_en12193.json' => 'en_12193',
        'normativa_iesna.json' => 'iesna_handbook',
        'normativa_en15193.json' => 'en_15193',
    ];

    /**
     * Siembra los requisitos mínimos de iluminación de cada norma listada en
     * self::SOURCES desde su archivo JSON en database/data/.
     */
    public function run(): void
    {
        $total = 0;

        foreach (self::SOURCES as $fileName => $standard) {
            $total += $this->seedStandard($fileName, $standard);
        }

        $this->command?->info("Requisitos normativos sembrados: {$total}");
    }

    private function seedStandard(string $fileName, string $standard): int
    {
        $path = database_path("data/{$fileName}");

        if (! file_exists($path)) {
            throw new RuntimeException("No se encontró {$path}");
        }

        $json = json_decode((string) file_get_contents($path), true);

        if (! is_array($json) || ! isset($json['requisitos_minimos_iluminacion'])) {
            throw new RuntimeException("JSON de normativa inválido o sin requisitos_minimos_iluminacion en {$fileName}.");
        }

        $rows = [];
        $now = now();

        foreach ($json['requisitos_minimos_iluminacion'] as $categoryKey => $category) {
            $categoryName = $category['categoria'] ?? (string) $categoryKey;

            if (isset($category['areas'])) {
                $this->collectAreas($rows, $category['areas'], $standard, (string) $categoryKey, $categoryName, null, null, $now);
            }

            foreach ($category['subcategorias'] ?? [] as $subKey => $sub) {
                $this->collectAreas(
                    $rows,
                    $sub['areas'] ?? [],
                    $standard,
                    (string) $categoryKey,
                    $categoryName,
                    (string) $subKey,
                    $sub['nombre'] ?? null,
                    $now,
                );
            }
        }

        DB::transaction(function () use ($rows, $standard): void {
            DialuxNormativeRequirement::query()->where('standard', $standard)->delete();

            foreach (array_chunk($rows, 100) as $chunk) {
                DialuxNormativeRequirement::query()->insert($chunk);
            }
        });

        return count($rows);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<int, array<string, mixed>>  $areas
     */
    private function collectAreas(
        array &$rows,
        array $areas,
        string $standard,
        string $categoryKey,
        string $categoryName,
        ?string $subcategoryKey,
        ?string $subcategoryName,
        CarbonInterface $now,
    ): void {
        foreach ($areas as $area) {
            if (! isset($area['area'])) {
                continue;
            }

            $requirements = $area['requisitos'] ?? null;

            if (is_string($requirements)) {
                $requirements = [$requirements];
            }

            $rows[] = [
                'standard' => $standard,
                'category_key' => $categoryKey,
                'category' => $categoryName,
                'subcategory_key' => $subcategoryKey,
                'subcategory' => $subcategoryName,
                'area_name' => $area['area'],
                'em_lux' => isset($area['Em_lux']) ? (float) $area['Em_lux'] : null,
                'ugrl' => isset($area['UGRL']) ? (int) $area['UGRL'] : null,
                'uo' => isset($area['Uo']) ? (float) $area['Uo'] : null,
                'ra' => isset($area['Ra']) ? (int) $area['Ra'] : null,
                'lpd_wm2' => isset($area['lpd_wm2']) ? (float) $area['lpd_wm2'] : null,
                'hours_yr' => isset($area['hours_yr']) ? (int) $area['hours_yr'] : null,
                'requirements' => $requirements !== null ? json_encode($requirements, JSON_UNESCAPED_UNICODE) : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
    }
}
