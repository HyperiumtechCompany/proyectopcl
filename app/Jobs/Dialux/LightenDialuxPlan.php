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
 * `CadPlanLightener`). La página nunca espera: el editor consulta el estado
 * y abre la versión ligera cuando está lista.
 */
class LightenDialuxPlan implements ShouldQueue
{
    use Queueable;

    /** Un intento: reintentar un archivo que agotó el tiempo solo repite el costo. */
    public int $tries = 1;

    public int $timeout;

    public function __construct(public int $planId)
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

        try {
            $sourcePath = $disk->path($plan->path);
            $extension = strtolower(pathinfo($plan->path, PATHINFO_EXTENSION));
            $dxf = match ($extension) {
                'dxf' => $sourcePath,
                'dwg' => $lightener->convertDwgToDxf($sourcePath, $workDir, $this->timeout),
                default => throw new RuntimeException('Solo se aligeran planos DXF o DWG.'),
            };

            $lightTmp = $workDir.'/ligero.dxf';
            $report = $lightener->slimDxf($dxf, $lightTmp);

            $lightPath = dirname($plan->path).'/'.pathinfo($plan->path, PATHINFO_FILENAME).'-ligero.dxf';
            $stream = fopen($lightTmp, 'rb');
            $disk->put($lightPath, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
            if ($plan->light_path && $plan->light_path !== $lightPath) {
                $disk->delete($plan->light_path);
            }

            $plan->forceFill([
                'light_status' => 'ready',
                'light_path' => $lightPath,
                'light_size_bytes' => filesize($lightTmp) ?: null,
                'light_error' => null,
            ])->save();

            Log::info('[dialux] plano aligerado', [
                'plan' => $plan->id,
                'original_bytes' => $plan->size_bytes,
                'light_bytes' => $plan->light_size_bytes,
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

    public function failed(?Throwable $exception): void
    {
        // Tiempo agotado o worker caído: que el editor no quede esperando para siempre.
        DialuxPlan::query()->whereKey($this->planId)->update([
            'light_status' => 'failed',
            'light_error' => Str::limit($exception?->getMessage() ?? 'La optimización no terminó.', 500),
        ]);
    }
}
