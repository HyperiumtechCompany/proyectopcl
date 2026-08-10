<?php

namespace App\Console\Commands;

use App\Models\Dialux\DialuxProject;
use App\Models\LuminaireProduct;
use App\Services\ProductImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class RepairDialuxPhotometry extends Command
{
    protected $signature = 'dialux:repair-photometry {--product=* : IDs concretos} {--dry-run : Solo diagnosticar}';

    protected $description = 'Reprocesa fotometrías IES/LDT legacy y sincroniza sus instancias en proyectos DIAlux';

    public function handle(ProductImportService $service): int
    {
        $ids = array_values(array_filter(array_map('intval', $this->option('product'))));
        $query = LuminaireProduct::query()
            ->whereIn('source_format', ['ies', 'ldt', 'gldf'])
            ->whereNotNull('source_file_path');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }

        $products = $query->get()->filter(function (LuminaireProduct $product): bool {
            $web = $product->photometric_web;
            $legacyOffset = is_array($web)
                && count($web['c_angles'] ?? []) === 1
                && abs((float) ($web['c_angles'][0] ?? 0)) > 0.01;

            // Bug del binario Rust (`dialux-photometry`, corregido): para
            // luminarias simétricas que declaran más planos C de los que
            // publican, `c_angles` no se truncaba a la cantidad real de
            // filas de `candela` — el consumidor JS (`candelaFromPhotometricWeb`)
            // asume `c_angles[i]` <-> `candela[i]` 1 a 1 y crashea al indexar
            // un plano fuera de rango.
            $mismatchedPlaneCount = is_array($web)
                && count($web['c_angles'] ?? []) !== count($web['candela'] ?? []);

            return $legacyOffset || $mismatchedPlaneCount || ! is_array($web) || empty($web['reference_lumens']) || ($web['schema_version'] ?? 0) < 2;
        });

        if ($products->isEmpty()) {
            $this->info('No se encontraron fotometrías pendientes de reparación.');

            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $repaired = [];
        $failures = 0;

        DB::beginTransaction();
        try {
            foreach ($products as $product) {
                try {
                    $result = $service->repairStoredProduct($product, ! $dryRun);
                    $repaired[$product->id] = $result['product'];
                    $this->line(sprintf(
                        '%s #%d %s — C0=%s°, referencia=%s lm',
                        $dryRun ? '[SIMULACIÓN]' : '[REPARADO]',
                        $product->id,
                        $product->name,
                        $result['product']->photometric_web['c_angles'][0] ?? '-',
                        $result['product']->photometric_web['reference_lumens'] ?? '-',
                    ));
                    foreach ($result['warnings'] as $warning) {
                        $this->warn("  #{$product->id}: {$warning}");
                    }
                } catch (Throwable $error) {
                    $failures++;
                    $this->error("#{$product->id} {$product->name}: {$error->getMessage()}");
                }
            }

            $updatedProjects = $this->syncProjects($repaired, $dryRun);
            $dryRun ? DB::rollBack() : DB::commit();
            $this->info(sprintf('%d producto(s), %d proyecto(s), %d fallo(s).', count($repaired), $updatedProjects, $failures));
        } catch (Throwable $error) {
            DB::rollBack();
            throw $error;
        }

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    /** @param array<int, LuminaireProduct> $products */
    private function syncProjects(array $products, bool $dryRun): int
    {
        if ($products === []) {
            return 0;
        }

        $updated = 0;
        DialuxProject::query()->each(function (DialuxProject $project) use ($products, $dryRun, &$updated): void {
            $data = $project->data ?? [];
            $changed = false;
            foreach ($data['scenes'] ?? [] as $sceneIndex => $scene) {
                foreach ($scene['fixtures'] ?? [] as $fixtureIndex => $fixture) {
                    $productId = (int) ($fixture['productId'] ?? 0);
                    if (! isset($products[$productId])) {
                        continue;
                    }
                    $product = $products[$productId];
                    $data['scenes'][$sceneIndex]['fixtures'][$fixtureIndex]['photometricWeb'] = $product->photometric_web;
                    $data['scenes'][$sceneIndex]['fixtures'][$fixtureIndex]['reportData'] = $product->report_data;
                    $data['scenes'][$sceneIndex]['fixtures'][$fixtureIndex]['reportAssets'] = $product->report_assets;
                    $changed = true;
                }
            }
            if ($changed) {
                $updated++;
                if (! $dryRun) {
                    $project->update(['data' => $data]);
                }
            }
        });

        return $updated;
    }
}
