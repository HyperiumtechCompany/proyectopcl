<?php

namespace App\Concerns;

use Illuminate\Http\UploadedFile;

trait DetectsDwgCompatibility
{
    /**
     * Los primeros 6 bytes de un DWG son su código de versión AutoCAD
     * (ej. "AC1032" = R2018). El visor CAD del proyecto, el paquete
     * "mlightcad/cad-simple-viewer", parsea DWG con LibreDWG vía WASM;
     * LibreDWG mismo documenta que puede leer todas las versiones pero
     * "algunos objetos avanzados de R2010+ fallan al leer y se omiten en
     * silencio" — sin error, solo geometría faltante (muros, hatch,
     * texto), mientras entidades simples (círculos, líneas) sí llegan.
     * Confirmado en 2026-08-18 con un DWG R2018 real que rendereaba
     * incompleto. DXF no pasa por LibreDWG (usa el converter nativo del
     * paquete "mlightcad/data-model"), por eso no aplica esta advertencia.
     */
    private const DWG_VERSION_NAMES = [
        'AC1006' => 'R10',
        'AC1009' => 'R11/R12',
        'AC1012' => 'R13',
        'AC1014' => 'R14',
        'AC1015' => 'R2000',
        'AC1018' => 'R2004',
        'AC1021' => 'R2007',
        'AC1024' => 'R2010',
        'AC1027' => 'R2013',
        'AC1032' => 'R2018',
    ];

    /** Primer código de versión (R2010) a partir del cual LibreDWG puede omitir objetos avanzados. */
    private const DWG_RISK_THRESHOLD = 'AC1024';

    /**
     * Devuelve un mensaje de advertencia si el archivo es un DWG en una
     * versión donde el parser puede perder geometría, o `null` si no
     * aplica (no es DWG, o es una versión anterior a R2010).
     */
    protected function detectDwgCompatibilityWarning(UploadedFile $file): ?string
    {
        if (strtolower($file->getClientOriginalExtension()) !== 'dwg') {
            return null;
        }

        $handle = @fopen($file->getRealPath(), 'rb');
        if (! $handle) {
            return null;
        }

        $header = fread($handle, 6);
        fclose($handle);

        if (! is_string($header) || strlen($header) < 6 || ! str_starts_with($header, 'AC1')) {
            return null;
        }

        if (strcmp($header, self::DWG_RISK_THRESHOLD) < 0) {
            return null;
        }

        $versionName = self::DWG_VERSION_NAMES[$header] ?? $header;

        return "Este plano es DWG {$versionName}. El visor puede omitir muros, achurados (hatch) o texto en este formato — ".
            'si notas elementos faltantes frente al original, exporta el plano como DXF (o DWG R2013 o anterior) desde AutoCAD y vuelve a subirlo.';
    }
}
