<?php

namespace App\Services\Dialux;

use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Versión LIGERA de un plano CAD para abrirse en el navegador.
 *
 * El motor CAD del editor corre en la pestaña del usuario: un DWG/DXF de
 * decenas de MB (sombreados, imágenes, sólidos, proxies) agota su memoria.
 * Aquí, en el servidor y en segundo plano:
 *  1. un DWG se convierte a DXF con el conversor configurado
 *     (`dialux.plan_light.dwg_converter`: ODA File Converter o LibreDWG);
 *  2. el DXF se recorre EN FLUJO (pares código/valor, memoria constante) y
 *     se descartan las entidades que no sirven para dibujar ni medir encima
 *     del plano, dentro de ENTITIES y BLOCKS.
 * Líneas, polilíneas, arcos, círculos, textos, cotas y bloques se conservan
 * con sus coordenadas exactas: la calibración y las longitudes no cambian.
 */
class CadPlanLightener
{
    /** Entidades que se descartan (relleno, raster, 3D y objetos de terceros). */
    public const DROPPED_ENTITIES = [
        'HATCH', 'MPOLYGON', 'IMAGE', 'OLE2FRAME', 'OLEFRAME', 'WIPEOUT',
        'ACAD_PROXY_ENTITY', '3DSOLID', 'BODY', 'REGION', 'MESH', 'POLYFACEMESH', '3DFACE',
        'SURFACE', 'PLANESURFACE', 'EXTRUDEDSURFACE', 'LOFTEDSURFACE', 'REVOLVEDSURFACE',
        'SWEPTSURFACE', 'NURBSURFACE', 'POINTCLOUD', 'POINTCLOUDEX', 'PDFUNDERLAY',
        'DWFUNDERLAY', 'DGNUNDERLAY', 'HELIX', 'LIGHT', 'SUN',
    ];

    /**
     * Convierte un DWG a DXF con el comando configurado.
     *
     * @throws RuntimeException si no hay conversor o falla.
     */
    public function convertDwgToDxf(string $dwgPath, string $workDir, int $timeoutSeconds): string
    {
        $template = config('dialux.plan_light.dwg_converter');
        if (! is_string($template) || trim($template) === '') {
            throw new RuntimeException(
                'El servidor no tiene conversor de DWG configurado. Sube el plano como DXF (AutoCAD → Guardar como → DXF) o una imagen PNG/JPG.',
            );
        }

        $inputDir = $workDir.'/in';
        $outputDir = $workDir.'/out';
        @mkdir($inputDir, 0775, true);
        @mkdir($outputDir, 0775, true);
        $inputName = 'plano.dwg';
        $input = $inputDir.'/'.$inputName;
        if (! copy($dwgPath, $input)) {
            throw new RuntimeException('No se pudo preparar el DWG para convertirlo.');
        }
        $output = $outputDir.'/plano.dxf';

        $command = strtr($template, [
            '{input}' => $input,
            '{output}' => $output,
            '{input_dir}' => $inputDir,
            '{output_dir}' => $outputDir,
            '{input_name}' => $inputName,
        ]);

        $result = Process::timeout($timeoutSeconds)->run($command);
        $produced = is_file($output) ? $output : (glob($outputDir.'/*.dxf')[0] ?? null);
        if (! $produced || filesize($produced) === 0) {
            throw new RuntimeException(
                'No se pudo convertir el DWG a DXF'.($result->failed() ? ': '.trim($result->errorOutput() ?: $result->output()) : '.'),
            );
        }

        return $produced;
    }

    /**
     * Copia `$source` (DXF ASCII) en `$target` sin las entidades pesadas.
     *
     * @return array{kept: int, dropped: int, dropped_by_type: array<string, int>}
     *
     * @throws RuntimeException si no es un DXF ASCII legible.
     */
    public function slimDxf(string $source, string $target): array
    {
        $in = @fopen($source, 'rb');
        if (! $in) {
            throw new RuntimeException('No se pudo leer el DXF.');
        }
        $head = fread($in, 22);
        if ($head !== false && str_starts_with($head, 'AutoCAD Binary DXF')) {
            fclose($in);
            throw new RuntimeException('DXF binario no soportado: guárdalo como DXF ASCII.');
        }
        rewind($in);

        $out = @fopen($target, 'wb');
        if (! $out) {
            fclose($in);
            throw new RuntimeException('No se pudo escribir el DXF ligero.');
        }

        $dropped = array_flip(self::DROPPED_ENTITIES);
        $section = null;
        $awaitingSectionName = false;
        $skipping = false;
        $kept = 0;
        $droppedCount = 0;
        $droppedByType = [];

        while (($codeLine = fgets($in)) !== false) {
            $valueLine = fgets($in);
            if ($valueLine === false) {
                break;
            }
            $code = trim($codeLine);
            $value = rtrim($valueLine, "\r\n");

            if ($code === '0') {
                $type = strtoupper(trim($value));
                $awaitingSectionName = $type === 'SECTION';
                if ($type === 'ENDSEC') {
                    $section = null;
                }
                $inGeometry = $section === 'ENTITIES' || $section === 'BLOCKS';
                $skipping = $inGeometry && isset($dropped[$type]);
                if ($skipping) {
                    $droppedCount++;
                    $droppedByType[$type] = ($droppedByType[$type] ?? 0) + 1;

                    continue;
                }
                if ($inGeometry && ! in_array($type, ['BLOCK', 'ENDBLK', 'ENDSEC', 'SEQEND', 'VERTEX', 'ATTRIB'], true)) {
                    $kept++;
                }
            } elseif ($skipping) {
                continue;
            } elseif ($awaitingSectionName && $code === '2') {
                $section = strtoupper(trim($value));
                $awaitingSectionName = false;
            }

            fwrite($out, $code."\r\n".$value."\r\n");
        }

        fclose($in);
        fclose($out);

        arsort($droppedByType);

        return ['kept' => $kept, 'dropped' => $droppedCount, 'dropped_by_type' => $droppedByType];
    }
}
