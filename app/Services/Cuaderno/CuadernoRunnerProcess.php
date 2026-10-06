<?php

namespace App\Services\Cuaderno;

/**
 * Starts the local connector (scripts/cuaderno-runner.mjs) detached from the web request.
 * Only for local installations where Costos and the holder's browser share the same computer.
 */
class CuadernoRunnerProcess
{
    public function canStart(): bool
    {
        return (bool) config('cuaderno.runner_autostart');
    }

    public function start(): void
    {
        $node = (string) (config('cuaderno.node_path') ?: 'node');
        $script = base_path('scripts/cuaderno-runner.mjs');
        $log = storage_path('logs/cuaderno-runner.log');

        if (PHP_OS_FAMILY === 'Windows') {
            $handle = popen(sprintf('start "" /B "%s" "%s" >> "%s" 2>&1', $node, $script, $log), 'r');
            if ($handle !== false) {
                pclose($handle);
            }

            return;
        }

        exec(sprintf('nohup %s %s >> %s 2>&1 &', escapeshellarg($node), escapeshellarg($script), escapeshellarg($log)));
    }
}
