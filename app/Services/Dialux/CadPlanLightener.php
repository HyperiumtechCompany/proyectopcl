<?php

namespace App\Services\Dialux;

use Generator;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Versión LIGERA de un plano CAD para abrirse en el navegador.
 *
 * El motor CAD del editor corre en la pestaña del usuario: un DWG/DXF de
 * decenas o cientos de MB agota su memoria. Aquí, en el servidor y en
 * segundo plano:
 *  1. un DWG se convierte a DXF con el conversor configurado
 *     (`dialux.plan_light.dwg_converter`: ODA File Converter o LibreDWG);
 *  2. el DXF se ANALIZA en flujo: cuánto pesa cada capa, incluidos los
 *     bloques que solo usa esa capa (p.ej. los árboles de "Arboles y
 *     Arbustos"), para que el ingeniero elija qué capas cargar;
 *  3. se ESCRIBE la versión ligera: sin sombreados/imágenes/3D/proxies, sin
 *     espacio papel, solo las capas elegidas, y con los bloques que ya nadie
 *     usa vaciados. Lo que se conserva mantiene sus coordenadas exactas: la
 *     calibración y las longitudes no cambian.
 *
 * Todo se recorre por GRUPOS (código 0 + sus pares), con memoria constante
 * aunque el archivo pese cientos de MB.
 */
class CadPlanLightener
{
    /** Entidades que se descartan siempre (relleno, raster, 3D y objetos de terceros). */
    public const DROPPED_ENTITIES = [
        'HATCH', 'MPOLYGON', 'IMAGE', 'OLE2FRAME', 'OLEFRAME', 'WIPEOUT',
        'ACAD_PROXY_ENTITY', '3DSOLID', 'BODY', 'REGION', 'MESH', 'POLYFACEMESH', '3DFACE',
        'SURFACE', 'PLANESURFACE', 'EXTRUDEDSURFACE', 'LOFTEDSURFACE', 'REVOLVEDSURFACE',
        'SWEPTSURFACE', 'NURBSURFACE', 'POINTCLOUD', 'POINTCLOUDEX', 'PDFUNDERLAY',
        'DWFUNDERLAY', 'DGNUNDERLAY', 'HELIX', 'LIGHT', 'SUN',
    ];

    /** Entidades que pertenecen a la anterior (vértices, atributos): siguen su suerte. */
    private const SUB_ENTITIES = ['VERTEX', 'ATTRIB', 'SEQEND'];

    /** Entidades que referencian un bloque por nombre (código 2). */
    private const BLOCK_REFERENCES = ['INSERT', 'MINSERT', 'DIMENSION', 'ACAD_TABLE'];

    /** Bloques pequeños (flechas, símbolos) se conservan siempre: no pesan y los usan estilos. */
    private const SMALL_BLOCK_BYTES = 2048;

    /**
     * Capas que por defecto NO se cargan: decorativas para trazar la
     * instalación (el ingeniero puede volver a marcarlas).
     */
    public const DEFAULT_EXCLUDED_LAYER_PATTERN = '/mobili|mueble|silla|sofa|mesa|cama|sanit|arbol|arbust|vegeta|jard|planta[s ]|cesped|equipam|detalle|cortina|persona|vehic|auto[s ]|achur|hatch|sombra|textura|trama|logo|norte/i';

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
                'El servidor aún no tiene conversor de DWG. Sube el mismo plano como DXF (AutoCAD → Guardar como → DXF 2013): sigue siendo vectorial y se optimiza igual.',
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
     * Grupos del DXF: cada uno empieza en un código 0 (SECTION, entrada de
     * tabla, entidad, objeto, EOF) e incluye sus pares hasta el siguiente.
     *
     * @return Generator<int, array{type: string, section: ?string, block: ?string, raw: string, layer: ?string, name: ?string, paper: bool}>
     */
    private function groups(string $path): Generator
    {
        $in = @fopen($path, 'rb');
        if (! $in) {
            throw new RuntimeException('No se pudo leer el DXF.');
        }
        $head = fread($in, 22);
        if ($head !== false && str_starts_with($head, 'AutoCAD Binary DXF')) {
            fclose($in);
            throw new RuntimeException('DXF binario no soportado: guárdalo como DXF ASCII.');
        }
        rewind($in);

        $section = null;
        $block = null;
        $current = null;
        /** Dentro de un grupo de aplicación 102 {…} (reactores, diccionario): se omite. */
        $inAppGroup = false;

        $emit = function (array $group) use (&$section, &$block): array {
            $group['section'] = $section;
            $group['block'] = $block;
            if ($group['type'] === 'SECTION') {
                $section = strtoupper((string) $group['name']);
                $group['section'] = $section;
            } elseif ($group['type'] === 'ENDSEC') {
                $section = null;
            } elseif ($group['type'] === 'BLOCK') {
                $block = (string) $group['name'];
                $group['block'] = $block;
            } elseif ($group['type'] === 'ENDBLK') {
                $block = null;
            }

            return $group;
        };

        try {
            while (($codeLine = fgets($in)) !== false) {
                $valueLine = fgets($in);
                if ($valueLine === false) {
                    break;
                }
                $code = trim($codeLine);
                $value = rtrim($valueLine, "\r\n");

                // Compactación de la GEOMETRÍA (entidades y bloques), sin
                // cambio visual: sin dueño (330), sin reactores/diccionarios
                // (102 {…} y 360), sin datos extendidos de aplicaciones
                // (1000–1071) y números a 6 decimales (ODA escribe 15–17).
                if ($code !== '0' && ($section === 'ENTITIES' || $section === 'BLOCKS')) {
                    if ($code === '102') {
                        $inAppGroup = str_starts_with(trim($value), '{');

                        continue;
                    }
                    if ($inAppGroup) {
                        continue;
                    }
                    $numeric = (int) $code;
                    if ($code === '330' || $code === '360' || ($numeric >= 1000 && $numeric <= 1071)) {
                        continue;
                    }
                    if ($numeric >= 10 && $numeric <= 59 && is_numeric($value)) {
                        $value = self::compactNumber($value);
                    }
                }
                $pair = $code."\r\n".$value."\r\n";

                if ($code === '0') {
                    $inAppGroup = false;
                    if ($current !== null) {
                        yield $emit($current);
                    }
                    $current = [
                        'type' => strtoupper(trim($value)),
                        'raw' => $pair,
                        'layer' => null,
                        'name' => null,
                        'paper' => false,
                    ];

                    continue;
                }
                if ($current === null) {
                    continue;
                }
                $current['raw'] .= $pair;
                if ($code === '8' && $current['layer'] === null) {
                    $current['layer'] = trim($value);
                } elseif ($code === '2' && $current['name'] === null) {
                    $current['name'] = trim($value);
                } elseif ($code === '67' && trim($value) === '1') {
                    $current['paper'] = true;
                }
            }
            if ($current !== null) {
                yield $emit($current);
            }
        } finally {
            fclose($in);
        }
    }

    /** Número a lo sumo con 6 decimales, sin ceros sobrantes ("12.500000" → "12.5"). */
    private static function compactNumber(string $value): string
    {
        $trimmed = trim($value);
        if (! str_contains($trimmed, '.') && ! str_contains($trimmed, 'e') && ! str_contains($trimmed, 'E')) {
            return $trimmed;
        }
        $compact = rtrim(rtrim(sprintf('%.6F', (float) $trimmed), '0'), '.');

        return $compact === '-0' || $compact === '' ? '0' : $compact;
    }

    private function isDropped(string $type): bool
    {
        static $dropped = null;
        $dropped ??= array_flip(self::DROPPED_ENTITIES);

        return isset($dropped[$type]);
    }

    /** Contenido de otras láminas (espacio papel): no sirve para dibujar encima del plano. */
    private static function isPaperSpaceBlock(string $name): bool
    {
        return str_starts_with(strtoupper($name), '*PAPER_SPACE');
    }

    private static function isAlwaysKeptBlock(string $name, int $bytes): bool
    {
        if (self::isPaperSpaceBlock($name)) {
            return false;
        }

        return str_starts_with(strtoupper($name), '*MODEL_SPACE') || $bytes <= self::SMALL_BLOCK_BYTES;
    }

    /**
     * Pesos del plano por capa, para que el ingeniero elija qué cargar.
     *
     * - peso de una capa = sus entidades del espacio modelo + los bloques que
     *   SOLO usan entidades de esa capa (un árbol como bloque pesa en "Arboles");
     * - `base_bytes` = lo que queda siempre (cabecera, tablas, objetos,
     *   bloques compartidos entre capas).
     * Estimación de la versión ligera = base + Σ peso de las capas elegidas.
     *
     * @return array{
     *     layers: array<string, array{entities: int, bytes: int}>,
     *     base_bytes: int,
     *     total_bytes: int,
     *     top_refs: array<string, array<string, true>>,
     *     block_children: array<string, array<string, true>>,
     *     block_bytes: array<string, int>,
     * }
     */
    public function analyzeDxf(string $path): array
    {
        $layers = [];
        $otherBytes = 0;
        $blockBytes = [];
        $blockChildren = [];
        /** @var array<string, array<string, true>> $topRefs capa → bloques que referencia */
        $topRefs = [];
        $parentDropped = false;

        foreach ($this->groups($path) as $group) {
            $type = $group['type'];
            $bytes = strlen($group['raw']);
            $section = $group['section'];

            if ($section === 'ENTITIES' && ! in_array($type, ['SECTION', 'ENDSEC'], true)) {
                $isSub = in_array($type, self::SUB_ENTITIES, true);
                $drop = $isSub ? $parentDropped : ($this->isDropped($type) || $group['paper']);
                if (! $isSub) {
                    $parentDropped = $drop;
                }
                if ($drop) {
                    continue;
                }
                $layer = $group['layer'] ?? '0';
                $layers[$layer] ??= ['entities' => 0, 'bytes' => 0];
                $layers[$layer]['bytes'] += $bytes;
                if (! $isSub) {
                    $layers[$layer]['entities']++;
                }
                if (in_array($type, self::BLOCK_REFERENCES, true) && $group['name'] !== null) {
                    $topRefs[$layer][$group['name']] = true;
                }

                continue;
            }

            $blockName = $group['block'];
            if ($section === 'BLOCKS' && $blockName !== null && ! in_array($type, ['BLOCK', 'ENDBLK'], true)) {
                if ($this->isDropped($type)) {
                    continue;
                }
                $blockBytes[$blockName] = ($blockBytes[$blockName] ?? 0) + $bytes;
                if (in_array($type, self::BLOCK_REFERENCES, true) && $group['name'] !== null) {
                    $blockChildren[$blockName][$group['name']] = true;
                }

                continue;
            }

            $otherBytes += $bytes;
        }

        // Qué capas llegan a cada bloque (siguiendo bloques anidados).
        $users = [];
        foreach ($topRefs as $layer => $blocks) {
            foreach ($this->reachableBlocks(array_keys($blocks), $blockChildren) as $block) {
                $users[$block][$layer] = true;
            }
        }
        $base = $otherBytes;
        foreach ($blockBytes as $block => $bytes) {
            if (self::isAlwaysKeptBlock($block, $bytes)) {
                $base += $bytes;
            } elseif (isset($users[$block]) && count($users[$block]) === 1) {
                $layer = array_key_first($users[$block]);
                $layers[$layer]['bytes'] += $bytes;
            } elseif (isset($users[$block]) && ! self::isPaperSpaceBlock($block)) {
                $base += $bytes;
            }
            // Bloque sin uso en el espacio modelo: se vacía, no pesa.
        }

        uasort($layers, fn (array $a, array $b): int => $b['bytes'] <=> $a['bytes']);

        return [
            'layers' => $layers,
            'base_bytes' => $base,
            'total_bytes' => (int) filesize($path),
            'top_refs' => $topRefs,
            'block_children' => $blockChildren,
            'block_bytes' => $blockBytes,
        ];
    }

    /**
     * @param  array<int, string>  $roots
     * @param  array<string, array<string, true>>  $children
     * @return array<int, string>
     */
    private function reachableBlocks(array $roots, array $children): array
    {
        $seen = [];
        $queue = $roots;
        while ($queue !== []) {
            $block = array_pop($queue);
            if (isset($seen[$block])) {
                continue;
            }
            $seen[$block] = true;
            foreach (array_keys($children[$block] ?? []) as $child) {
                if (! isset($seen[$child])) {
                    $queue[] = $child;
                }
            }
        }

        return array_keys($seen);
    }

    /** Tamaño estimado (bytes) de la versión ligera con esas capas. */
    public function estimateBytes(array $analysis, ?array $keepLayers): int
    {
        $total = $analysis['base_bytes'];
        foreach ($analysis['layers'] as $name => $layer) {
            if ($keepLayers === null || in_array($name, $keepLayers, true)) {
                $total += $layer['bytes'];
            }
        }

        return $total;
    }

    /**
     * Escribe la versión ligera: sin entidades pesadas ni espacio papel, solo
     * `$keepLayers` (null = todas) y con los bloques sin uso vaciados (se
     * conserva su cabecera: las tablas siguen apuntando a un bloque válido).
     *
     * @return array{kept: int, dropped: int, dropped_by_type: array<string, int>, bytes: int}
     */
    public function writeLight(string $source, string $target, ?array $keepLayers = null, ?array $analysis = null): array
    {
        $analysis ??= $this->analyzeDxf($source);
        $keep = $keepLayers === null ? null : array_flip($keepLayers);

        $roots = [];
        foreach ($analysis['top_refs'] as $layer => $blocks) {
            if ($keep === null || isset($keep[$layer])) {
                array_push($roots, ...array_keys($blocks));
            }
        }
        $usedBlocks = array_flip($this->reachableBlocks($roots, $analysis['block_children']));

        $out = @fopen($target, 'wb');
        if (! $out) {
            throw new RuntimeException('No se pudo escribir el DXF ligero.');
        }

        $kept = 0;
        $dropped = 0;
        $droppedByType = [];
        $parentDropped = false;

        try {
            foreach ($this->groups($source) as $group) {
                $type = $group['type'];
                $section = $group['section'];
                $write = true;

                if ($section === 'ENTITIES' && ! in_array($type, ['SECTION', 'ENDSEC'], true)) {
                    $isSub = in_array($type, self::SUB_ENTITIES, true);
                    if ($isSub) {
                        $write = ! $parentDropped;
                    } else {
                        $reason = $this->isDropped($type) ? $type
                            : ($group['paper'] ? 'ESPACIO PAPEL'
                                : ($keep !== null && ! isset($keep[$group['layer'] ?? '0']) ? 'CAPA NO ELEGIDA' : null));
                        $write = $reason === null;
                        $parentDropped = ! $write;
                        if ($reason !== null) {
                            $dropped++;
                            $droppedByType[$reason] = ($droppedByType[$reason] ?? 0) + 1;
                        } else {
                            $kept++;
                        }
                    }
                } elseif ($section === 'BLOCKS' && $group['block'] !== null && ! in_array($type, ['BLOCK', 'ENDBLK'], true)) {
                    $block = $group['block'];
                    $blockKept = ! self::isPaperSpaceBlock($block) && (
                        isset($usedBlocks[$block])
                        || self::isAlwaysKeptBlock($block, $analysis['block_bytes'][$block] ?? 0)
                    );
                    if (! $blockKept) {
                        $write = false;
                        $droppedByType['BLOQUE SIN USO'] = ($droppedByType['BLOQUE SIN USO'] ?? 0) + 1;
                    } elseif ($this->isDropped($type)) {
                        $write = false;
                        $dropped++;
                        $droppedByType[$type] = ($droppedByType[$type] ?? 0) + 1;
                    }
                }

                if ($write) {
                    fwrite($out, $group['raw']);
                }
            }
        } finally {
            fclose($out);
        }

        arsort($droppedByType);

        return [
            'kept' => $kept,
            'dropped' => $dropped,
            'dropped_by_type' => $droppedByType,
            'bytes' => (int) filesize($target),
        ];
    }

    /** Capas del análisis para el editor, con la elección por defecto (decorativas desmarcadas). */
    public function layerChoices(array $analysis, ?array $previousKeep = null): array
    {
        $choices = [];
        foreach ($analysis['layers'] as $name => $layer) {
            $choices[] = [
                'name' => (string) $name,
                'entities' => $layer['entities'],
                'bytes' => $layer['bytes'],
                'keep' => $previousKeep !== null
                    ? in_array((string) $name, $previousKeep, true)
                    : preg_match(self::DEFAULT_EXCLUDED_LAYER_PATTERN, (string) $name) !== 1,
            ];
        }

        return $choices;
    }

    /**
     * Compatibilidad: versión ligera con TODAS las capas.
     *
     * @return array{kept: int, dropped: int, dropped_by_type: array<string, int>, bytes: int}
     */
    public function slimDxf(string $source, string $target): array
    {
        return $this->writeLight($source, $target);
    }
}
