<?php

namespace App\Console\Commands;

use App\Services\Cuaderno\CuadernoExtensionPackage;
use Illuminate\Console\Command;

class CuadernoExtensionCommand extends Command
{
    protected $signature = 'cuaderno:extension
        {--origin=* : Sitios de Costos que la extensión puede usar (por defecto APP_URL)}
        {--output= : Ruta del zip (por defecto storage/app/private/cuaderno/extension.zip)}';

    protected $description = 'Empaqueta el Asistente del Cuaderno (extensión de Chrome/Edge) para probarlo o publicarlo en las tiendas.';

    public function handle(CuadernoExtensionPackage $package): int
    {
        $origins = $this->option('origin') ?: [config('app.url')];
        $output = $this->option('output') ?: storage_path('app/private/cuaderno/extension.zip');
        $this->info('Extensión creada: '.$package->build($origins, $output));
        $this->line('Sitios de Costos incluidos: '.implode(', ', $origins));

        return self::SUCCESS;
    }
}
