<?php

namespace App\Services\Dialux;

use Generator;
use RuntimeException;

/**
 * Plano CAD → GEOMETRÍA para dibujarse con WebGL en el navegador.
 *
 * El visor CAD del navegador interpreta el DXF completo en memoria: con un
 * plano real de cientos de MB se queda sin memoria aunque se recorte. Aquí,
 * en el servidor y una sola vez, el DXF se interpreta en flujo y se reduce a
 * lo único que hace falta para verlo y dibujar encima: líneas.
 *
 *  - Bloques expandidos (anidados) con su posición, escala, giro, espejo y
 *    matrices (MINSERT). En un bloque, lo que está en la capa 0 hereda la
 *    capa del bloque insertado (regla de AutoCAD).
 *  - Arcos, círculos, elipses, splines (NURBS) y polilíneas con curvatura
 *    (bulge) teselados en tiras de puntos; cotas por su bloque anónimo.
 *  - Textos (TEXT, MTEXT, ATTRIB) con posición, altura y giro.
 *  - Color y visibilidad por capa como en el archivo (apagada/congelada).
 *
 * Coordenadas: se calcula en doble precisión y se guarda en float32
 * RELATIVO a un origen (el primer punto): la precisión es la del dibujo.
 * Relleno, 3D, imágenes y espacio papel no se incluyen.
 *
 * Formato (.dxg, little-endian):
 *   "DXG1" · uint32 largo del encabezado · encabezado JSON (relleno a 4)
 *   · por capa: uint32[tiras] cantidad de puntos de cada tira, float32[2·puntos].
 */
class CadPlanGeometryBuilder
{
    private const SKIPPED = [
        'HATCH', 'MPOLYGON', 'IMAGE', 'OLE2FRAME', 'OLEFRAME', 'WIPEOUT', 'ACAD_PROXY_ENTITY',
        '3DSOLID', 'BODY', 'REGION', 'MESH', 'SURFACE', 'PLANESURFACE', 'EXTRUDEDSURFACE',
        'LOFTEDSURFACE', 'REVOLVEDSURFACE', 'SWEPTSURFACE', 'NURBSURFACE', 'POINTCLOUD',
        'POINTCLOUDEX', 'PDFUNDERLAY', 'DWFUNDERLAY', 'DGNUNDERLAY', 'LIGHT', 'SUN', 'XLINE', 'RAY',
        'POINT', 'ATTDEF', 'VIEWPORT',
    ];

    /**
     * Versión del procesamiento: al mejorarlo se sube, y los planos ya
     * procesados con una anterior se regeneran solos al abrirse.
     * 2 = curvas según su tamaño + líneas unidas en tiras.
     */
    public const VERSION = 2;

    /** Segmentos por vuelta completa cuando el plano no declara su extensión. */
    private const SEGMENTS_PER_TURN = 24;

    /** Límites de segmentos por vuelta con la subdivisión adaptativa. */
    private const MIN_SEGMENTS_PER_TURN = 12;

    private const MAX_SEGMENTS_PER_TURN = 72;

    /** Flecha máxima de la cuerda, como fracción de la extensión del plano. */
    private const CHORD_TOLERANCE_RATIO = 2e-5;

    private const MAX_NESTING = 10;

    /** @var array<string, array{strips: array<string, array{counts: array<int,int>, points: string}>, inserts: array, texts: array, base: array{0: float, 1: float}}> */
    private array $blocks = [];

    /** @var array<string, array<string, array{counts: array<int,int>, points: string}>> bloque aplanado (doble precisión, coords locales) */
    private array $flattened = [];

    /** @var array<string, array{color: int, visible: bool}> */
    private array $layerTable = [];

    /** @var array<string, array{counts: string, points: string, n: int, p: int, open: int, endX: ?float, endY: ?float}> salida por capa (float32 relativo; `open` = puntos de la tira aún abierta) */
    private array $out = [];

    /** @var array<int, array{0: float, 1: float, 2: float, 3: float, 4: string, 5: string}> */
    private array $texts = [];

    /** Flecha máxima admitida al subdividir curvas (unidades del plano); null = fija por vuelta. */
    private ?float $chordTolerance = null;

    private ?float $ox = null;

    private float $oy = 0.0;

    private float $minX = INF;

    private float $minY = INF;

    private float $maxX = -INF;

    private float $maxY = -INF;

    /** @var array<string, resource> */
    private array $spill = [];

    private string $workDir = '';

    /**
     * @return array{layers: int, strips: int, points: int, texts: int, bytes: int}
     */
    public function build(string $dxfPath, string $targetPath): array
    {
        $this->reset();
        $this->workDir = dirname($targetPath).'/dxg-'.bin2hex(random_bytes(4));
        @mkdir($this->workDir, 0775, true);

        try {
            $polyline = null;
            $currentBlock = null;
            foreach ($this->groups($dxfPath) as $group) {
                [$type, $section, $pairs] = [$group['type'], $group['section'], $group['pairs']];

                if ($type === 'SECTION' && strtoupper((string) $this->first($pairs, 2, '')) === 'HEADER') {
                    $this->readHeader($pairs);

                    continue;
                }

                if ($section === 'TABLES' && $type === 'LAYER') {
                    $this->readLayer($pairs);

                    continue;
                }
                if ($section === 'BLOCKS') {
                    if ($type === 'BLOCK') {
                        $name = (string) $this->first($pairs, 2, '');
                        $currentBlock = $name;
                        $this->blocks[$name] = [
                            'strips' => [],
                            'inserts' => [],
                            'texts' => [],
                            'base' => [(float) $this->first($pairs, 10, 0), (float) $this->first($pairs, 20, 0)],
                        ];

                        continue;
                    }
                    if ($type === 'ENDBLK') {
                        $polyline = $this->closePolyline($polyline, $currentBlock);
                        $currentBlock = null;

                        continue;
                    }
                    if ($currentBlock !== null && ! str_starts_with(strtoupper($currentBlock), '*PAPER_SPACE')) {
                        $polyline = $this->entity($type, $pairs, $polyline, $currentBlock);
                    }

                    continue;
                }
                if ($section === 'ENTITIES') {
                    if ($this->first($pairs, 67, '0') === '1') {
                        continue; // espacio papel
                    }
                    $polyline = $this->entity($type, $pairs, $polyline, null);
                }
            }
            $this->closePolyline($polyline, null);

            return $this->write($targetPath);
        } finally {
            foreach ($this->spill as $handle) {
                if (is_resource($handle)) {
                    fclose($handle);
                }
            }
            $this->spill = [];
            array_map('unlink', glob($this->workDir.'/*') ?: []);
            @rmdir($this->workDir);
        }
    }

    private function reset(): void
    {
        $this->blocks = [];
        $this->flattened = [];
        $this->layerTable = [];
        $this->out = [];
        $this->texts = [];
        $this->ox = null;
        $this->oy = 0.0;
        $this->chordTolerance = null;
        $this->minX = $this->minY = INF;
        $this->maxX = $this->maxY = -INF;
    }

    // ── Lectura ─────────────────────────────────────────────────────────────

    /**
     * @return Generator<int, array{type: string, section: ?string, pairs: array<int, array{0: int, 1: string}>}>
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
        $current = null;
        try {
            while (($codeLine = fgets($in)) !== false) {
                $valueLine = fgets($in);
                if ($valueLine === false) {
                    break;
                }
                $code = (int) trim($codeLine);
                $value = rtrim($valueLine, "\r\n");
                if ($code === 0) {
                    if ($current !== null) {
                        if ($current['type'] === 'SECTION') {
                            $section = strtoupper((string) $this->first($current['pairs'], 2, ''));
                        } elseif ($current['type'] === 'ENDSEC') {
                            $section = null;
                        }
                        $current['section'] = $current['type'] === 'SECTION' ? null : $section;
                        yield $current;
                    }
                    $current = ['type' => strtoupper(trim($value)), 'section' => $section, 'pairs' => []];

                    continue;
                }
                if ($current !== null) {
                    $current['pairs'][] = [$code, $value];
                }
            }
            if ($current !== null) {
                $current['section'] = $section;
                yield $current;
            }
        } finally {
            fclose($in);
        }
    }

    /** @param array<int, array{0: int, 1: string}> $pairs */
    private function first(array $pairs, int $code, mixed $default = null): mixed
    {
        foreach ($pairs as [$c, $v]) {
            if ($c === $code) {
                return trim($v);
            }
        }

        return $default;
    }

    /**
     * Extensión declarada ($EXTMIN/$EXTMAX) → tolerancia de subdivisión: un
     * círculo de 1 m y la curva de una vía de 50 m no necesitan los mismos
     * segmentos. Sin extensión válida, se usa la fija por vuelta.
     *
     * @param  array<int, array{0: int, 1: string}>  $pairs
     */
    private function readHeader(array $pairs): void
    {
        $values = [];
        $variable = null;
        foreach ($pairs as [$code, $value]) {
            if ($code === 9) {
                $variable = trim($value);
            } elseif (($variable === '$EXTMIN' || $variable === '$EXTMAX') && ($code === 10 || $code === 20)) {
                $values[$variable.$code] = (float) $value;
            }
        }
        if (count($values) !== 4) {
            return;
        }
        $extent = max($values['$EXTMAX10'] - $values['$EXTMIN10'], $values['$EXTMAX20'] - $values['$EXTMIN20']);
        if (is_finite($extent) && $extent > 0 && $extent < 1e12) {
            $this->chordTolerance = $extent * self::CHORD_TOLERANCE_RATIO;
        }
    }

    /** Segmentos para un arco de radio `$radius` y barrido `$sweep` (rad). */
    private function segments(float $radius, float $sweep, int $minimum): int
    {
        $turns = abs($sweep) / (2 * M_PI);
        if ($this->chordTolerance === null || $radius <= 0) {
            return max($minimum, (int) ceil($turns * self::SEGMENTS_PER_TURN));
        }
        // Flecha s ≈ r·θ²/8 → θ = √(8·s/r); nunca más del 5 % del radio.
        $tolerance = min($this->chordTolerance, 0.05 * $radius);
        $perTurn = (int) ceil(2 * M_PI / sqrt(8 * $tolerance / $radius));
        $perTurn = max(self::MIN_SEGMENTS_PER_TURN, min(self::MAX_SEGMENTS_PER_TURN, $perTurn));

        return max($minimum, (int) ceil($turns * $perTurn));
    }

    /** @param array<int, array{0: int, 1: string}> $pairs */
    private function readLayer(array $pairs): void
    {
        $name = (string) $this->first($pairs, 2, '');
        if ($name === '') {
            return;
        }
        $color = (int) $this->first($pairs, 62, 7);
        $flags = (int) $this->first($pairs, 70, 0);
        $this->layerTable[$name] = [
            'color' => abs($color) ?: 7,
            // Color negativo = capa apagada; bit 1 = congelada.
            'visible' => $color >= 0 && ($flags & 1) === 0,
        ];
    }

    // ── Entidades ───────────────────────────────────────────────────────────

    /**
     * Interpreta una entidad. `$block` = null → espacio modelo (coords del mundo).
     *
     * @param  array<int, array{0: int, 1: string}>  $pairs
     */
    private function entity(string $type, array $pairs, ?array $polyline, ?string $block): ?array
    {
        if ($type === 'VERTEX') {
            if ($polyline !== null) {
                $polyline['vertices'][] = [
                    (float) $this->first($pairs, 10, 0),
                    (float) $this->first($pairs, 20, 0),
                    (float) $this->first($pairs, 42, 0),
                ];
            }

            return $polyline;
        }
        if ($type === 'SEQEND') {
            return $this->closePolyline($polyline, $block);
        }
        $polyline = $this->closePolyline($polyline, $block);
        if (in_array($type, self::SKIPPED, true)) {
            return null;
        }
        $layer = (string) $this->first($pairs, 8, '0');
        $flip = (float) $this->first($pairs, 230, 1) < 0;

        switch ($type) {
            case 'LINE':
                $this->strip($block, $layer, [
                    (float) $this->first($pairs, 10, 0), (float) $this->first($pairs, 20, 0),
                    (float) $this->first($pairs, 11, 0), (float) $this->first($pairs, 21, 0),
                ]);
                break;
            case 'LWPOLYLINE':
                $vertices = [];
                foreach ($pairs as [$c, $v]) {
                    if ($c === 10) {
                        $vertices[] = [(float) $v, 0.0, 0.0];
                    } elseif ($c === 20 && $vertices !== []) {
                        $vertices[count($vertices) - 1][1] = (float) $v;
                    } elseif ($c === 42 && $vertices !== []) {
                        $vertices[count($vertices) - 1][2] = (float) $v;
                    }
                }
                $closed = ((int) $this->first($pairs, 70, 0) & 1) === 1;
                $this->strip($block, $layer, $this->bulgePolyline($vertices, $closed), $flip);
                break;
            case 'POLYLINE':
                $flags = (int) $this->first($pairs, 70, 0);
                if (($flags & (16 | 64)) !== 0) {
                    return null; // malla 3D
                }

                return ['layer' => $layer, 'closed' => ($flags & 1) === 1, 'flip' => $flip, 'vertices' => []];
            case 'CIRCLE':
                $this->strip($block, $layer, $this->arc(
                    (float) $this->first($pairs, 10, 0), (float) $this->first($pairs, 20, 0),
                    (float) $this->first($pairs, 40, 0), 0, 2 * M_PI,
                ), $flip);
                break;
            case 'ARC':
                $start = deg2rad((float) $this->first($pairs, 50, 0));
                $end = deg2rad((float) $this->first($pairs, 51, 360));
                if ($end <= $start) {
                    $end += 2 * M_PI;
                }
                $this->strip($block, $layer, $this->arc(
                    (float) $this->first($pairs, 10, 0), (float) $this->first($pairs, 20, 0),
                    (float) $this->first($pairs, 40, 0), $start, $end,
                ), $flip);
                break;
            case 'ELLIPSE':
                $this->strip($block, $layer, $this->ellipse($pairs));
                break;
            case 'SPLINE':
                $this->strip($block, $layer, $this->spline($pairs));
                break;
            case 'SOLID':
            case 'TRACE':
                $p = [];
                foreach ([[10, 20], [11, 21], [13, 23], [12, 22], [10, 20]] as [$cx, $cy]) {
                    $p[] = (float) $this->first($pairs, $cx, 0);
                    $p[] = (float) $this->first($pairs, $cy, 0);
                }
                $this->strip($block, $layer, $p, $flip);
                break;
            case 'LEADER':
                $p = [];
                foreach ($pairs as [$c, $v]) {
                    if ($c === 10) {
                        $p[] = (float) $v;
                    } elseif ($c === 20) {
                        $p[] = (float) $v;
                    }
                }
                $this->strip($block, $layer, $p);
                break;
            case 'INSERT':
            case 'MINSERT':
            case 'DIMENSION':
            case 'ACAD_TABLE':
                $name = (string) $this->first($pairs, 2, '');
                if ($name === '') {
                    break;
                }
                // Cotas y tablas: su bloque anónimo ya está en coordenadas del mundo.
                $isRef = $type === 'INSERT' || $type === 'MINSERT';
                $insert = [
                    'name' => $name,
                    'layer' => $layer,
                    'matrices' => $isRef ? $this->insertMatrices($pairs, $name, $flip) : [[1, 0, 0, 1, 0, 0]],
                ];
                if ($block === null) {
                    $this->emitInsert($insert, null);
                } else {
                    $this->blocks[$block]['inserts'][] = $insert;
                }
                break;
            case 'TEXT':
            case 'ATTRIB':
            case 'MTEXT':
                $this->text($type, $pairs, $layer, $block, $flip);
                break;
        }

        return null;
    }

    private function closePolyline(?array $polyline, ?string $block): ?array
    {
        if ($polyline !== null && count($polyline['vertices']) >= 2) {
            $this->strip($block, $polyline['layer'], $this->bulgePolyline($polyline['vertices'], $polyline['closed']), $polyline['flip']);
        }

        return null;
    }

    /** @param array<int, array{0: int, 1: string}> $pairs */
    private function text(string $type, array $pairs, string $layer, ?string $block, bool $flip): void
    {
        $x = (float) $this->first($pairs, 10, 0);
        $y = (float) $this->first($pairs, 20, 0);
        if ($type !== 'MTEXT' && ((int) $this->first($pairs, 72, 0) !== 0 || (int) $this->first($pairs, 73, 0) !== 0)) {
            $x = (float) $this->first($pairs, 11, $x);
            $y = (float) $this->first($pairs, 21, $y);
        }
        $height = (float) $this->first($pairs, 40, 1);
        $rotation = deg2rad((float) $this->first($pairs, 50, 0));
        if ($type === 'MTEXT' && $this->first($pairs, 11) !== null && $this->first($pairs, 50) === null) {
            $rotation = atan2((float) $this->first($pairs, 21, 0), (float) $this->first($pairs, 11, 1));
        }
        $content = '';
        if ($type === 'MTEXT') {
            foreach ($pairs as [$c, $v]) {
                if ($c === 3 || $c === 1) {
                    $content .= $v;
                }
            }
            $content = $this->plainMtext($content);
        } else {
            $content = (string) $this->first($pairs, 1, '');
        }
        $content = trim($content);
        if ($content === '' || $height <= 0) {
            return;
        }
        if ($flip) {
            $x = -$x;
            $rotation = M_PI - $rotation;
        }
        $text = [$x, $y, $height, $rotation, mb_substr($content, 0, 200), $layer];
        if ($block === null) {
            $this->emitText($text, [1, 0, 0, 1, 0, 0], null);
        } else {
            $this->blocks[$block]['texts'][] = $text;
        }
    }

    /** Texto plano de un MTEXT: sin códigos de formato. */
    private function plainMtext(string $raw): string
    {
        $text = str_replace(['\\P', '\\p', '\\~'], [' ', ' ', ' '], $raw);
        $text = preg_replace('/\\\\[ACcFfHhQTWw][^;]*;/', '', $text) ?? $text;
        $text = preg_replace('/\\\\[LlOoKk]/', '', $text) ?? $text;
        $text = preg_replace('/\\\\S([^^#\\/;]*)[\\^#\\/]([^;]*);/', '$1/$2', $text) ?? $text;
        $text = str_replace(['{', '}'], '', $text);

        return preg_replace('/\s+/u', ' ', $text) ?? $text;
    }

    // ── Geometría ───────────────────────────────────────────────────────────

    /**
     * @param  array<int, array{0: float, 1: float, 2: float}>  $vertices  x, y, bulge
     * @return array<int, float>
     */
    private function bulgePolyline(array $vertices, bool $closed): array
    {
        $count = count($vertices);
        if ($count < 2) {
            return [];
        }
        $points = [$vertices[0][0], $vertices[0][1]];
        $segments = $closed ? $count : $count - 1;
        for ($i = 0; $i < $segments; $i++) {
            [$x1, $y1, $bulge] = $vertices[$i];
            [$x2, $y2] = $vertices[($i + 1) % $count];
            if (abs($bulge) > 1e-9) {
                $theta = 4 * atan($bulge);
                $chord = hypot($x2 - $x1, $y2 - $y1);
                if ($chord > 1e-12) {
                    $radius = $chord / (2 * sin(abs($theta) / 2));
                    $mx = ($x1 + $x2) / 2;
                    $my = ($y1 + $y2) / 2;
                    $sagitta = $radius * cos(abs($theta) / 2);
                    $nx = -($y2 - $y1) / $chord;
                    $ny = ($x2 - $x1) / $chord;
                    $sign = $bulge > 0 ? 1 : -1;
                    $cx = $mx + $nx * $sagitta * $sign;
                    $cy = $my + $ny * $sagitta * $sign;
                    $a1 = atan2($y1 - $cy, $x1 - $cx);
                    $steps = $this->segments(abs($radius), $theta, 2);
                    for ($k = 1; $k < $steps; $k++) {
                        $a = $a1 + $theta * $k / $steps;
                        $points[] = $cx + $radius * cos($a);
                        $points[] = $cy + $radius * sin($a);
                    }
                }
            }
            $points[] = $x2;
            $points[] = $y2;
        }

        return $points;
    }

    /** @return array<int, float> */
    private function arc(float $cx, float $cy, float $r, float $start, float $end): array
    {
        if ($r <= 0) {
            return [];
        }
        $sweep = $end - $start;
        $steps = $this->segments($r, $sweep, 4);
        $points = [];
        for ($k = 0; $k <= $steps; $k++) {
            $a = $start + $sweep * $k / $steps;
            $points[] = $cx + $r * cos($a);
            $points[] = $cy + $r * sin($a);
        }

        return $points;
    }

    /**
     * @param  array<int, array{0: int, 1: string}>  $pairs
     * @return array<int, float>
     */
    private function ellipse(array $pairs): array
    {
        $cx = (float) $this->first($pairs, 10, 0);
        $cy = (float) $this->first($pairs, 20, 0);
        $mx = (float) $this->first($pairs, 11, 1);
        $my = (float) $this->first($pairs, 21, 0);
        $ratio = (float) $this->first($pairs, 40, 1);
        $start = (float) $this->first($pairs, 41, 0);
        $end = (float) $this->first($pairs, 42, 2 * M_PI);
        if ($end <= $start) {
            $end += 2 * M_PI;
        }
        $major = hypot($mx, $my);
        if ($major <= 0) {
            return [];
        }
        $angle = atan2($my, $mx);
        $minor = $major * $ratio;
        $cos = cos($angle);
        $sin = sin($angle);
        $sweep = $end - $start;
        $steps = $this->segments($major, $sweep, 4);
        $points = [];
        for ($k = 0; $k <= $steps; $k++) {
            $t = $start + $sweep * $k / $steps;
            $ex = $major * cos($t);
            $ey = $minor * sin($t);
            $points[] = $cx + $ex * $cos - $ey * $sin;
            $points[] = $cy + $ex * $sin + $ey * $cos;
        }

        return $points;
    }

    /**
     * NURBS por de Boor (con pesos); sin nodos válidos, sus puntos de ajuste.
     *
     * @param  array<int, array{0: int, 1: string}>  $pairs
     * @return array<int, float>
     */
    private function spline(array $pairs): array
    {
        $degree = (int) $this->first($pairs, 71, 3);
        $knots = [];
        $control = [];
        $weights = [];
        $fit = [];
        foreach ($pairs as [$c, $v]) {
            if ($c === 40) {
                $knots[] = (float) $v;
            } elseif ($c === 10) {
                $control[] = [(float) $v, 0.0];
            } elseif ($c === 20 && $control !== []) {
                $control[count($control) - 1][1] = (float) $v;
            } elseif ($c === 41) {
                $weights[] = (float) $v;
            } elseif ($c === 11) {
                $fit[] = [(float) $v, 0.0];
            } elseif ($c === 21 && $fit !== []) {
                $fit[count($fit) - 1][1] = (float) $v;
            }
        }
        $n = count($control);
        if ($n < 2 || count($knots) !== $n + $degree + 1 || $degree < 1) {
            $source = $fit !== [] ? $fit : $control;

            return array_merge(...array_map(fn (array $p): array => [$p[0], $p[1]], $source ?: [[0, 0]]));
        }
        if (count($weights) !== $n) {
            $weights = array_fill(0, $n, 1.0);
        }
        $u0 = $knots[$degree];
        $u1 = $knots[$n];
        $samples = min(96, max(8, $n * 4));
        $points = [];
        for ($s = 0; $s <= $samples; $s++) {
            $u = $u0 + ($u1 - $u0) * $s / $samples;
            $k = $degree;
            while ($k < $n - 1 && $u >= $knots[$k + 1]) {
                $k++;
            }
            $d = [];
            for ($j = 0; $j <= $degree; $j++) {
                $i = $k - $degree + $j;
                $w = $weights[$i];
                $d[$j] = [$control[$i][0] * $w, $control[$i][1] * $w, $w];
            }
            for ($r = 1; $r <= $degree; $r++) {
                for ($j = $degree; $j >= $r; $j--) {
                    $i = $k - $degree + $j;
                    $den = $knots[$i + $degree - $r + 1] - $knots[$i];
                    $alpha = $den > 0 ? ($u - $knots[$i]) / $den : 0;
                    for ($c = 0; $c < 3; $c++) {
                        $d[$j][$c] = (1 - $alpha) * $d[$j - 1][$c] + $alpha * $d[$j][$c];
                    }
                }
            }
            $w = $d[$degree][2] ?: 1;
            $points[] = $d[$degree][0] / $w;
            $points[] = $d[$degree][1] / $w;
        }

        return $points;
    }

    /**
     * Matrices afines [a, b, c, d, e, f] (x' = a·x + c·y + e; y' = b·x + d·y + f)
     * de un INSERT/MINSERT: base del bloque, escala, giro, matriz de copias y
     * espejo por extrusión negativa (sistema de coordenadas del objeto).
     *
     * @param  array<int, array{0: int, 1: string}>  $pairs
     * @return array<int, array<int, float>>
     */
    private function insertMatrices(array $pairs, string $name, bool $flip): array
    {
        $base = $this->blocks[$name]['base'] ?? [0.0, 0.0];
        $px = (float) $this->first($pairs, 10, 0);
        $py = (float) $this->first($pairs, 20, 0);
        $sx = (float) $this->first($pairs, 41, 1) ?: 1.0;
        $sy = (float) $this->first($pairs, 42, $sx) ?: 1.0;
        $rot = deg2rad((float) $this->first($pairs, 50, 0));
        $cols = max(1, (int) $this->first($pairs, 70, 1));
        $rows = max(1, (int) $this->first($pairs, 71, 1));
        $colSpacing = (float) $this->first($pairs, 44, 0);
        $rowSpacing = (float) $this->first($pairs, 45, 0);
        $cos = cos($rot);
        $sin = sin($rot);
        $matrices = [];
        for ($r = 0; $r < min($rows, 50); $r++) {
            for ($c = 0; $c < min($cols, 50); $c++) {
                $ox = $px + $cos * $c * $colSpacing - $sin * $r * $rowSpacing;
                $oy = $py + $sin * $c * $colSpacing + $cos * $r * $rowSpacing;
                // q = o + R·S·(l − b)
                $a = $cos * $sx;
                $b = $sin * $sx;
                $cc = -$sin * $sy;
                $d = $cos * $sy;
                $e = $ox - ($a * $base[0] + $cc * $base[1]);
                $f = $oy - ($b * $base[0] + $d * $base[1]);
                $matrices[] = $flip ? [-$a, $b, -$cc, $d, -$e, $f] : [$a, $b, $cc, $d, $e, $f];
            }
        }

        return $matrices;
    }

    /** @return array<int, float> */
    private static function compose(array $outer, array $inner): array
    {
        [$a1, $b1, $c1, $d1, $e1, $f1] = $outer;
        [$a2, $b2, $c2, $d2, $e2, $f2] = $inner;

        return [
            $a1 * $a2 + $c1 * $b2,
            $b1 * $a2 + $d1 * $b2,
            $a1 * $c2 + $c1 * $d2,
            $b1 * $c2 + $d1 * $d2,
            $a1 * $e2 + $c1 * $f2 + $e1,
            $b1 * $e2 + $d1 * $f2 + $f1,
        ];
    }

    // ── Acumulación ─────────────────────────────────────────────────────────

    /** Tira de puntos (x, y, x, y…): en un bloque se guarda local; en el modelo va a la salida. */
    private function strip(?string $block, string $layer, array $points, bool $flip = false): void
    {
        $count = intdiv(count($points), 2);
        if ($count < 2) {
            return;
        }
        if ($flip) {
            for ($i = 0; $i < count($points); $i += 2) {
                $points[$i] = -$points[$i];
            }
        }
        if ($block !== null) {
            $this->blocks[$block]['strips'][$layer] ??= ['counts' => [], 'points' => ''];
            $this->blocks[$block]['strips'][$layer]['counts'][] = $count;
            $this->blocks[$block]['strips'][$layer]['points'] .= pack('e*', ...$points);

            return;
        }
        $this->emit($layer, [$count], $points);
    }

    /**
     * Bloque aplanado (incluye sus bloques anidados), en coordenadas locales y
     * doble precisión. La capa "0" queda como "0" (la resuelve quien inserta).
     *
     * @return array<string, array{counts: array<int,int>, points: string}>
     */
    private function flatten(string $name, int $depth = 0): array
    {
        if (isset($this->flattened[$name])) {
            return $this->flattened[$name];
        }
        $block = $this->blocks[$name] ?? null;
        if ($block === null || $depth > self::MAX_NESTING || str_starts_with(strtoupper($name), '*PAPER_SPACE')) {
            return [];
        }
        $result = $block['strips'];
        foreach ($block['inserts'] as $insert) {
            $child = $this->flatten($insert['name'], $depth + 1);
            foreach ($insert['matrices'] as $matrix) {
                foreach ($child as $layer => $data) {
                    // (PHP convierte la clave '0' en el entero 0: se compara como texto.)
                    $target = (string) $layer === '0' ? $insert['layer'] : (string) $layer;
                    $result[$target] ??= ['counts' => [], 'points' => ''];
                    array_push($result[$target]['counts'], ...$data['counts']);
                    $result[$target]['points'] .= self::transformPacked($data['points'], $matrix);
                }
            }
        }
        $this->flattened[$name] = $result;

        return $result;
    }

    private static function transformPacked(string $packed, array $m): string
    {
        if ($packed === '') {
            return '';
        }
        $values = unpack('e*', $packed);
        $out = [];
        $n = count($values);
        for ($i = 1; $i < $n; $i += 2) {
            $x = $values[$i];
            $y = $values[$i + 1];
            $out[] = $m[0] * $x + $m[2] * $y + $m[4];
            $out[] = $m[1] * $x + $m[3] * $y + $m[5];
        }

        return pack('e*', ...$out);
    }

    /** INSERT en el espacio modelo: su bloque aplanado, transformado, a la salida. */
    private function emitInsert(array $insert, ?array $parentMatrix): void
    {
        $flat = $this->flatten($insert['name']);
        foreach ($insert['matrices'] as $matrix) {
            $world = $parentMatrix ? self::compose($parentMatrix, $matrix) : $matrix;
            foreach ($flat as $layer => $data) {
                // (PHP convierte la clave '0' en el entero 0: se compara como texto.)
                $target = (string) $layer === '0' ? $insert['layer'] : (string) $layer;
                $values = unpack('e*', $data['points']) ?: [];
                $points = [];
                $n = count($values);
                for ($i = 1; $i < $n; $i += 2) {
                    $points[] = $world[0] * $values[$i] + $world[2] * $values[$i + 1] + $world[4];
                    $points[] = $world[1] * $values[$i] + $world[3] * $values[$i + 1] + $world[5];
                }
                $this->emit($target, $data['counts'], $points);
            }
            $this->emitBlockTexts($insert['name'], $insert['layer'], $world, 0);
        }
    }

    private function emitBlockTexts(string $name, string $insertLayer, array $matrix, int $depth): void
    {
        $block = $this->blocks[$name] ?? null;
        if ($block === null || $depth > self::MAX_NESTING) {
            return;
        }
        foreach ($block['texts'] as $text) {
            $this->emitText($text, $matrix, $insertLayer);
        }
        foreach ($block['inserts'] as $insert) {
            foreach ($insert['matrices'] as $inner) {
                $layer = $insert['layer'] === '0' ? $insertLayer : $insert['layer'];
                $this->emitBlockTexts($insert['name'], $layer, self::compose($matrix, $inner), $depth + 1);
            }
        }
    }

    private function emitText(array $text, array $m, ?string $insertLayer): void
    {
        if (count($this->texts) >= 60_000) {
            return;
        }
        [$x, $y, $h, $rot, $content, $layer] = $text;
        $wx = $m[0] * $x + $m[2] * $y + $m[4];
        $wy = $m[1] * $x + $m[3] * $y + $m[5];
        $scale = hypot($m[1], $m[3]);
        $angle = $rot + atan2($m[1], $m[0]);
        $this->origin($wx, $wy);
        $this->texts[] = [
            round($wx - $this->ox, 4),
            round($wy - $this->oy, 4),
            round($h * ($scale ?: 1), 4),
            round($angle, 5),
            $content,
            $layer === '0' && $insertLayer !== null ? $insertLayer : $layer,
        ];
    }

    private function origin(float $x, float $y): void
    {
        if ($this->ox === null) {
            $this->ox = $x;
            $this->oy = $y;
        }
    }

    /**
     * Tiras en coordenadas del MUNDO → salida float32 relativa al origen.
     *
     * Para que el plano pese menos en la red y en la tarjeta gráfica: se
     * quitan puntos repetidos y tiras sin largo; una tira que EMPIEZA donde
     * terminó la anterior de la misma capa (líneas sueltas que forman un
     * contorno) se une a ella; y una tira con coordenadas inválidas se
     * descarta (antes iba a (0, 0) y alejaba todo el plano UTM).
     *
     * @param  array<int, int>  $counts
     * @param  array<int, float>  $points
     */
    private function emit(string $layer, array $counts, array $points): void
    {
        if (count($points) < 4) {
            return;
        }
        $this->out[$layer] ??= ['counts' => '', 'points' => '', 'n' => 0, 'p' => 0, 'open' => 0, 'endX' => null, 'endY' => null];
        $bucket = &$this->out[$layer];
        $relative = [];
        $at = 0;
        foreach ($counts as $count) {
            $strip = [];
            $valid = true;
            $prevX = $prevY = null;
            for ($k = 0; $k < $count; $k++, $at += 2) {
                $x = $points[$at] ?? NAN;
                $y = $points[$at + 1] ?? NAN;
                if (! is_finite($x) || ! is_finite($y)) {
                    $valid = false;

                    continue;
                }
                if ($x === $prevX && $y === $prevY) {
                    continue;
                }
                $strip[] = $x;
                $strip[] = $y;
                $prevX = $x;
                $prevY = $y;
            }
            $n = count($strip);
            if (! $valid || $n < 4) {
                continue;
            }
            $this->origin($strip[0], $strip[1]);
            for ($i = 0; $i < $n; $i += 2) {
                $x = $strip[$i];
                $y = $strip[$i + 1];
                if ($x < $this->minX) {
                    $this->minX = $x;
                }
                if ($x > $this->maxX) {
                    $this->maxX = $x;
                }
                if ($y < $this->minY) {
                    $this->minY = $y;
                }
                if ($y > $this->maxY) {
                    $this->maxY = $y;
                }
            }
            $startX = $strip[0] - $this->ox;
            $startY = $strip[1] - $this->oy;
            $from = 0;
            if ($bucket['open'] > 0 && $bucket['endX'] === $startX && $bucket['endY'] === $startY) {
                // Continúa la tira anterior: no se repite el punto de unión.
                $from = 2;
            } elseif ($bucket['open'] > 0) {
                $bucket['counts'] .= pack('V', $bucket['open']);
                $bucket['n']++;
                $bucket['open'] = 0;
            }
            for ($i = $from; $i < $n; $i += 2) {
                $relative[] = $strip[$i] - $this->ox;
                $relative[] = $strip[$i + 1] - $this->oy;
            }
            $added = intdiv($n - $from, 2);
            $bucket['open'] += $added;
            $bucket['p'] += $added;
            $bucket['endX'] = $strip[$n - 2] - $this->ox;
            $bucket['endY'] = $strip[$n - 1] - $this->oy;
        }
        foreach (array_chunk($relative, 16384) as $chunk) {
            $bucket['points'] .= pack('g*', ...$chunk);
        }
        if (strlen($bucket['points']) > 4_000_000) {
            $this->flush($layer);
        }
        unset($bucket);
    }

    /** Cierra la tira abierta de la capa (su cantidad de puntos pasa a la salida). */
    private function closeStrip(string $layer): void
    {
        if ($this->out[$layer]['open'] > 0) {
            $this->out[$layer]['counts'] .= pack('V', $this->out[$layer]['open']);
            $this->out[$layer]['n']++;
            $this->out[$layer]['open'] = 0;
            $this->out[$layer]['endX'] = $this->out[$layer]['endY'] = null;
        }
    }

    private function flush(string $layer): void
    {
        foreach (['counts', 'points'] as $part) {
            $key = $layer."\0".$part;
            if (! isset($this->spill[$key])) {
                $this->spill[$key] = fopen($this->workDir.'/'.md5($key).'.bin', 'w+b');
            }
            fwrite($this->spill[$key], $this->out[$layer][$part]);
            $this->out[$layer][$part] = '';
        }
    }

    /** @return array{layers: int, strips: int, points: int, texts: int, bytes: int} */
    private function write(string $targetPath): array
    {
        $layers = [];
        $offset = 0;
        $strips = 0;
        $points = 0;
        $names = array_keys($this->out);
        foreach ($names as $name) {
            $this->closeStrip($name);
            $this->flush($name);
            $bucket = $this->out[$name];
            $table = $this->layerTable[$name] ?? ['color' => 7, 'visible' => true];
            $layers[] = [
                'name' => (string) $name,
                'color' => $table['color'],
                'visible' => $table['visible'],
                'strips' => $bucket['n'],
                'points' => $bucket['p'],
                'offset' => $offset,
            ];
            $offset += $bucket['n'] * 4 + $bucket['p'] * 8;
            $strips += $bucket['n'];
            $points += $bucket['p'];
        }

        $header = json_encode([
            'version' => self::VERSION,
            'origin' => [$this->ox ?? 0.0, $this->oy],
            'bbox' => is_finite($this->minX) ? [$this->minX, $this->minY, $this->maxX, $this->maxY] : [0, 0, 0, 0],
            'layers' => $layers,
            'texts' => $this->texts,
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $header .= str_repeat(' ', (4 - (strlen($header) % 4)) % 4);

        $out = fopen($targetPath, 'wb');
        if (! $out) {
            throw new RuntimeException('No se pudo escribir la geometría del plano.');
        }
        fwrite($out, 'DXG1'.pack('V', strlen($header)).$header);
        foreach ($names as $name) {
            foreach (['counts', 'points'] as $part) {
                $handle = $this->spill[$name."\0".$part] ?? null;
                if ($handle) {
                    rewind($handle);
                    stream_copy_to_stream($handle, $out);
                }
            }
        }
        fclose($out);

        return [
            'layers' => count($layers),
            'strips' => $strips,
            'points' => $points,
            'texts' => count($this->texts),
            'bytes' => (int) filesize($targetPath),
        ];
    }
}
