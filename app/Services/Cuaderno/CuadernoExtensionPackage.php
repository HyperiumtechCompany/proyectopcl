<?php

namespace App\Services\Cuaderno;

use RuntimeException;
use ZipArchive;

/**
 * Builds the browser extension ("Asistente del Cuaderno") as a zip ready to load in Chrome/Edge
 * or to publish in their stores. The Costos sites it may talk to are written in its manifest.
 */
class CuadernoExtensionPackage
{
    private const SOURCES = [
        'background.js' => 'extension/cuaderno/background.js',
        'executor.js' => 'extension/cuaderno/executor.js',
        'costos-bridge.js' => 'extension/cuaderno/costos-bridge.js',
        // Same page functions as the desktop connector, verified against the real portal.
        'dom.js' => 'scripts/cuaderno/dom.mjs',
    ];

    /** @param list<string> $origins Costos sites, e.g. https://ingenieros.tech */
    public function build(array $origins, string $target): string
    {
        $origins = array_values(array_unique(array_filter(array_map(
            fn (string $origin): ?string => preg_match('#^https?://[a-z0-9.-]+(:\d+)?$#i', rtrim($origin, '/')) ? rtrim($origin, '/') : null,
            $origins,
        ))));
        if ($origins === []) {
            throw new RuntimeException('Indica al menos un sitio de Costos (https://…).');
        }
        $manifest = json_decode((string) file_get_contents(base_path('extension/cuaderno/manifest.json')), true, flags: JSON_THROW_ON_ERROR);
        $patterns = array_map(fn (string $origin): string => $origin.'/*', $origins);
        $manifest['host_permissions'] = [...$manifest['host_permissions'], ...$patterns];
        $manifest['content_scripts'][0]['matches'] = $patterns;

        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0750, true);
        }
        $zip = new ZipArchive;
        $zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        foreach (self::SOURCES as $name => $path) {
            $zip->addFile(base_path($path), $name);
        }
        $zip->close();

        return $target;
    }
}
