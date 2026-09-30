<?php

namespace App\Jobs\Dialux;

use App\Models\Dialux\DialuxPlan;
use App\Services\Dialux\CadPlanLightener;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Genera, en segundo plano, la versión ligera de un plano CAD pesado (ver
 * `CadPlanLightener`). La página nunca espera: el editor consulta el estado.
 *
 * 1. DWG → DXF (una sola vez; el DXF convertido se guarda para no repetirlo).
 * 2. Análisis de pesos por capa.
 * 3. Sin capas elegidas: si TODO cabe bajo el tope, se escribe la versión
 *    ligera; si no, estado `needs_layers` y el ingeniero elige qué capas cargar.
 *    Con capas elegidas: se escribe solo con ellas.
 */
class LightenDialuxPlan implements ShouldQueue
{
    use Queueable;

    /** Un intento: reintentar un archivo que agotó el tiempo solo repite el costo. */
    public int $tries = 1;

    public int $timeout;

    /**
     * @param  array<int, string>|null  $keepLayers  capas elegidas por el ingeniero (null = decidir solo)
     */
    public function __construct(public int $planId, public ?array $keepLayers = null)
    {
        $this->timeout = (int) config('dialux.plan_light.timeout', 1800);
        $this->onConnection(config('dialux.plan_light.connection', 'database-cad'));
        $this->onQueue(config('dialux.plan_light.queue', 'cad'));
    }

    public function handle(CadPlanLightener $lightener): void
    {
        $plan = DialuxPlan::query()->find($this->planId);
        if (! $plan) {
            return;
        }
        $plan->forceFill(['light_status' => 'processing', 'light_error' => null])->save();

        $disk = Storage::disk($plan->disk);
        $workDir = storage_path('app/private/tmp/plan-light-'.$plan->id.'-'.Str::random(6));
        File::ensureDirectoryExists($workDir);
        $cap = (int) config('dialux.plan_light.threshold_bytes.dxf', 20_000_000);

        try {
            $dxf = $this->convertedDxf($plan, $lightener, $workDir);
            $analysis = $lightener->analyzeDxf($dxf);

            if ($this->keepLayers === null && $lightener->estimateBytes($analysis, null) > $cap) {
                // No cabe todo: el ingeniero elige qué capas cargar.
                $plan->forceFill([
                    'light_status' => 'needs_layers',
                    'light_layers' => $this->layersPayload($lightener, $analysis, null, $cap),
                ])->save();

                return;
            }

            $lightTmp = $workDir.'/ligero.dxf';
            $report = $lightener->writeLight($dxf, $lightTmp, $this->keepLayers, $analysis);

            if ($report['bytes'] > $cap) {
                $plan->forceFill([
                    'light_status' => 'needs_layers',
                    'light_layers' => $this->layersPayload($lightener, $analysis, $this->keepLayers, $cap),
                    'light_error' => sprintf(
                        'Con esas capas el plano pesa %.1f MB (máximo %.0f MB): desmarca más capas.',
                        $report['bytes'] / 1_000_000,
                        $cap / 1_000_000,
                    ),
                ])->save();

                return;
            }

            $lightPath = dirname($plan->path).'/'.pathinfo($plan->path, PATHINFO_FILENAME).'-ligero.dxf';
            $stream = fopen($lightTmp, 'rb');
            $disk->put($lightPath, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }

            $plan->forceFill([
                'light_status' => 'ready',
                'light_path' => $lightPath,
                'light_size_bytes' => $report['bytes'],
                'light_error' => null,
                'light_layers' => $this->layersPayload($lightener, $analysis, $this->keepLayers, $cap),
            ])->save();

            Log::info('[dialux] plano aligerado', [
                'plan' => $plan->id,
                'original_bytes' => $plan->size_bytes,
                'dxf_bytes' => $analysis['total_bytes'],
                'light_bytes' => $report['bytes'],
                'layers' => $this->keepLayers === null ? 'todas' : count($this->keepLayers),
                'dropped' => $report['dropped_by_type'],
            ]);
        } catch (Throwable $error) {
            $plan->forceFill([
                'light_status' => 'failed',
                'light_error' => Str::limit($error->getMessage(), 500),
            ])->save();
            Log::warning('[dialux] no se pudo aligerar el plano', ['plan' => $plan->id, 'error' => $error->getMessage()]);
        } finally {
            File::deleteDirectory($workDir);
        }
    }

    /** DXF del plano: el original, o el convertido desde el DWG (guardado para no repetir la conversión). */
    private function convertedDxf(DialuxPlan $plan, CadPlanLightener $lightener, string $workDir): string
    {
        $disk = Storage::disk($plan->disk);
        $extension = strtolower(pathinfo($plan->path, PATHINFO_EXTENSION));
        if ($extension === 'dxf') {
            return $disk->path($plan->path);
        }
        if ($extension !== 'dwg') {
            throw new RuntimeException('Solo se aligeran planos DXF o DWG.');
        }
        if ($plan->light_converted_path && $disk->exists($plan->light_converted_path)) {
            return $disk->path($plan->light_converted_path);
        }

        $converted = $lightener->convertDwgToDxf($disk->path($plan->path), $workDir, $this->timeout);
        $convertedPath = dirname($plan->path).'/'.pathinfo($plan->path, PATHINFO_FILENAME).'-convertido.dxf';
        $stream = fopen($converted, 'rb');
        $disk->put($convertedPath, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
        $plan->forceFill(['light_converted_path' => $convertedPath])->save();

        return $disk->path($convertedPath);
    }

    /** @return array<string, mixed> */
    private function layersPayload(CadPlanLightener $lightener, array $analysis, ?array $keepLayers, int $cap): array
    {
        return [
            'layers' => $lightener->layerChoices($analysis, $keepLayers),
            'base_bytes' => $analysis['base_bytes'],
            'dxf_bytes' => $analysis['total_bytes'],
            'cap_bytes' => $cap,
        ];
    }

    public function failed(?Throwable $exception): void
    {
        // Tiempo agotado o worker caído: que el editor no quede esperando para siempre.
        DialuxPlan::query()->whereKey($this->planId)->update([
            'light_status' => 'failed',
            'light_error' => Str::limit($exception?->getMessage() ?? 'La optimización no terminó.', 500),
        ]);
    }
}
