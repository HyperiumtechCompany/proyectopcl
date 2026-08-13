<?php

namespace Database\Seeders;

use App\Models\LuminaireProduct;
use App\Services\ProductImportService;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;

/**
 * Luminarias con fotometría REAL de fabricante (archivo IES/LDT descargado
 * del fabricante o del DIALux Luminaire Finder), a diferencia de
 * `LuminaireProductSeeder` (catálogo de demostración con curvas sintéticas).
 *
 * Cada entrada aquí pasó por `ProductImportService::import()` — el mismo
 * parser que usa la app en producción — para que `photometric_web` salga
 * calculado exactamente igual que si un usuario subiera el archivo desde la
 * UI, en vez de copiar un array de candelas a mano (ver
 * planes/plan_cierre_brecha_paridad_dialux_evo.md §-8: un array copiado a
 * mano en un fixture de test tuvo un bug de escala ×1.365 que pasó
 * desapercibido durante varias rondas hasta compararlo contra este mismo
 * parser real).
 */
class RealPhotometryLuminaireSeeder extends Seeder
{
    public function run(): void
    {
        $this->importIfMissing(
            articleNumber: 'TEG18046',
            fileName: 'TEG18046.ldt',
            overrides: [
                'manufacturer' => 'Thorlux Lighting',
                'article_number' => 'TEG18046',
                'fixture_type' => 'surface',
                'fixture_shape' => 'round',
                'dimensions' => ['radius' => 0.0615, 'height' => 0.12],
                'is_global' => true,
            ],
        );

        // Los siguientes 4 se agregaron para ampliar el catálogo real más
        // allá de las dos luminarias tipo downlight (Thorlux) heredadas del
        // benchmark Pozuzo — cubren los tipos de uso más comunes en
        // proyectos peruanos (oficina/aula, industrial, pasillos/almacenes).
        // Descargados de luminaires.dialux.com (mismo origen legítimo que
        // TEG18046, sin necesidad de licencia DIALux evo).
        $this->importIfMissing(
            articleNumber: '4099854082863',
            fileName: 'LEDVANCE-4099854082863.ldt',
            overrides: [
                'manufacturer' => 'LEDVANCE',
                'article_number' => '4099854082863',
                'fixture_type' => 'panel',
                'fixture_shape' => 'square',
                'dimensions' => ['length' => 0.595, 'width' => 0.595, 'height' => 0.034],
                'is_global' => true,
            ],
        );

        $this->importIfMissing(
            articleNumber: 'RHU-4AN2-Exxx-xxN',
            fileName: 'Dialight-RHU-4AN2.ies',
            overrides: [
                'manufacturer' => 'Dialight',
                'article_number' => 'RHU-4AN2-Exxx-xxN',
                'fixture_type' => 'industrial',
                'fixture_shape' => 'rectangular',
                'dimensions' => ['length' => 0.7448, 'width' => 0.4318, 'height' => 0.15],
                'is_global' => true,
            ],
        );

        $this->importIfMissing(
            articleNumber: '42184911',
            fileName: 'Zumtobel-42184911.ldt',
            overrides: [
                'manufacturer' => 'Zumtobel',
                'article_number' => '42184911',
                'fixture_type' => 'linear',
                'fixture_shape' => 'rectangular',
                'dimensions' => ['length' => 1.498, 'width' => 0.06, 'height' => 0.085],
                'is_global' => true,
            ],
        );

        // El archivo declara internamente el nombre "LEO" (no "CitySoul",
        // el nombre comercial visible en la página del fabricante) — mismo
        // tipo de divergencia que `ProductImportService::import()` ya sabe
        // detectar cuando se pasa un override de `name` explícito; aquí no
        // se fuerza un nombre para no ocultar el que el archivo realmente
        // declara. Confirmar con el fabricante antes de presentarlo al
        // cliente como "CitySoul" si eso importa comercialmente.
        $this->importIfMissing(
            articleNumber: 'BGP530',
            fileName: 'Philips-BGP530.ldt',
            overrides: [
                'manufacturer' => 'Philips',
                'article_number' => 'BGP530',
                'fixture_type' => 'street',
                'fixture_shape' => 'square',
                'dimensions' => ['length' => 0.54, 'width' => 0.54, 'height' => 0.10],
                'is_global' => true,
            ],
        );

        // SUSTITUTO de GF19140 ("G4 LED Plain - 22W - SMART - Corridor Lens"),
        // no el producto original — Thorlux gatea sus datasheets/IES/LDT
        // detrás de un login que no tenemos, y el artículo GF19140 ya no
        // existe en DIALux Luminaire Finder (confirmado, no es un fallo de
        // red — ver planes/plan_cierre_brecha_paridad_dialux_evo.md §-15).
        // Mismo fabricante (Thorlux), misma familia de óptica asimétrica
        // "corridor" (no una Lambertiana genérica), specs cercanas (2980 lm
        // vs. 2580 lm declarados, 27 W vs. 26 W — ~15% más flujo, no
        // idéntico). Se usa donde antes se usaba la aproximación Lambertiana
        // de GF19140 (ambiente "Guarderías"/"Caseta de control" del
        // benchmark Pozuzo) — NO se reimporta bajo el artículo GF19140 para
        // no aparentar ser el producto original.
        $this->importIfMissing(
            articleNumber: 'RC18820',
            fileName: 'Thorlux-RC18820.ldt',
            overrides: [
                'manufacturer' => 'Thorlux Lighting',
                'article_number' => 'RC18820',
                'fixture_type' => 'linear',
                'fixture_shape' => 'rectangular',
                'dimensions' => ['length' => 1.195, 'width' => 0.142, 'height' => 0.055],
                'is_global' => true,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function importIfMissing(string $articleNumber, string $fileName, array $overrides): void
    {
        $existing = LuminaireProduct::withTrashed()
            ->where('article_number', $articleNumber)
            ->first();

        $path = __DIR__."/fixtures/luminaires/{$fileName}";
        if (! is_file($path)) {
            $this->command?->warn("Archivo fotométrico no encontrado: {$path} — se omite '{$articleNumber}'.");

            return;
        }

        $file = new UploadedFile($path, $fileName, null, null, true);
        $result = app(ProductImportService::class)->import($file, null, $overrides);

        // Si producción ya conserva este artículo, actualizamos esa misma fila
        // para mantener su id y las referencias de proyectos existentes.
        if ($existing !== null) {
            $imported = $result['product'];
            $attributes = $imported->getAttributes();
            unset($attributes['id'], $attributes['created_at'], $attributes['updated_at'], $attributes['deleted_at']);

            $existing->forceFill($attributes);
            $existing->deleted_at = null;
            $existing->save();
            $imported->forceDelete();
            $result['product'] = $existing->refresh();
        }

        foreach ($result['warnings'] as $warning) {
            $this->command?->warn("[{$articleNumber}] {$warning}");
        }

        $action = $existing === null ? 'importado' : 'actualizado';
        $this->command?->info("LuminaireProduct '{$articleNumber}' {$action} (id={$result['product']->id}) desde fotometría real de fabricante.");
    }
}
