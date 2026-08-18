<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <title>{{ $document['title'] }}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
    <style>
        {!! file_get_contents(resource_path('css/style-exportado-dialux.css')) !!}
    </style>
</head>

<body>
    @php
        /* ── Helpers ───────────────────────────────────────────────── */

        /* ── Render de assets con encuadre explícito ─────────────────────
           dompdf NO soporta object-fit, así que el ajuste "contain" se calcula
           aquí: con las dimensiones reales del asset y la caja destino (mm) se
           emiten width/height exactos, centrados con margin auto. Sin caja se
           cae al ancho completo (comportamiento previo). */
        /* Gira un data URL de imagen 90° con GD (no depende del soporte de
           CSS transform de dompdf, que se probó y no recorta de forma
           fiable el contenido rotado — ver nota en $renderAsset). Si GD no
           puede decodificar el formato, devuelve el original sin rotar. */
        $rotateBitmapDataUrl90 = static function (string $dataUrl): string {
            if (!preg_match('/^data:image\/(\w+);base64,(.+)$/s', $dataUrl, $m)) {
                return $dataUrl;
            }
            $raw = base64_decode($m[2], true);
            if ($raw === false) {
                return $dataUrl;
            }
            $image = @imagecreatefromstring($raw);
            if ($image === false) {
                return $dataUrl;
            }
            $rotated = imagerotate($image, -90, 0);
            imagedestroy($image);
            if ($rotated === false) {
                return $dataUrl;
            }
            imagesavealpha($rotated, true);
            ob_start();
            imagepng($rotated);
            $png = ob_get_clean();
            imagedestroy($rotated);
            if ($png === false) {
                return $dataUrl;
            }
            return 'data:image/png;base64,' . base64_encode($png);
        };

        $renderAsset = static function (?array $asset, ?float $boxWidthMm = null, ?float $boxHeightMm = null, bool $vCenter = false, bool $autoRotate = false) use ($rotateBitmapDataUrl90): string {
            if (!$asset) {
                return '<div class="asset-align"><div class="asset-placeholder"><span>Grafico no disponible.</span></div></div>';
            }

            $assetWidth = (float) ($asset['width'] ?? 0);
            $assetHeight = (float) ($asset['height'] ?? 0);
            $dimsStyle = '';
            $vOffsetStyle = '';
            $hOffsetStyle = '';
            $svgWidthAttr = '100%';
            $svgHeightAttr = '100%';
            // Girar solo aplica a bitmaps: el <svg> vectorial rota con GD de
            // forma trivial vía rasterizado, pero un <g transform="rotate()">
            // dentro del propio SVG no se comporta de forma fiable en dompdf
            // (probado: el contenido queda mal recortado). En producción real
            // estos planos SIEMPRE llegan como bitmap (el navegador los
            // rasteriza antes de enviarlos — ver svgToPlanBitmap), así que el
            // caso vectorial es solo un fallback de entornos sin navegador
            // (tests) donde igualmente no vale la pena girar.
            $rotate = false;
            $displayW = null;
            $displayH = null;

            if ($boxWidthMm !== null && $assetWidth > 0 && $assetHeight > 0) {
                $boxH = $boxHeightMm ?? $boxWidthMm;
                $normalScale = min($boxWidthMm / $assetWidth, $boxH / $assetHeight);

                // Girar 90° aprovecha mejor la caja cuando la orientación del
                // plano (alto vs ancho) no coincide con la de la caja destino
                // (p. ej. un edificio angosto y alto en una página apaisada):
                // se compara el resultado con y sin girar y se usa el que
                // rinda una imagen más grande. Umbral 10% para no girar por
                // una ganancia marginal que no compense perder la orientación
                // "natural" del plano.
                if ($autoRotate && ($asset['kind'] ?? null) === 'bitmap') {
                    $rotatedScale = min($boxWidthMm / $assetHeight, $boxH / $assetWidth);
                    $rotate = $rotatedScale > $normalScale * 1.1;
                }

                $fitScale = $rotate ? min($boxWidthMm / $assetHeight, $boxH / $assetWidth) : $normalScale;
                // Tras girar 90°, la huella visual intercambia ancho y alto.
                $displayW = round(($rotate ? $assetHeight : $assetWidth) * $fitScale, 2);
                $displayH = round(($rotate ? $assetWidth : $assetHeight) * $fitScale, 2);
                $dimsStyle = "width:{$displayW}mm;height:{$displayH}mm;";
                $svgWidthAttr = "{$displayW}mm";
                $svgHeightAttr = "{$displayH}mm";
                if ($vCenter && $displayH < $boxH) {
                    $vOffsetStyle = 'margin-top:' . round(($boxH - $displayH) / 2, 2) . 'mm;';
                }
                // Centrado horizontal aritmético: dompdf no centra de forma
                // fiable ni con margin:auto ni con text-align en este caso.
                if ($displayW < $boxWidthMm) {
                    $hOffsetStyle = 'margin-left:' . round(($boxWidthMm - $displayW) / 2, 2) . 'mm;';
                }
            }

            if (($asset['kind'] ?? null) === 'vector' && !empty($asset['svg'])) {
                // Inline SVG: dompdf renders paths/curves/arcs correctly this way.
                // Base64 img tags lose scaling and SVG curve fidelity in dompdf.
                $svg = $asset['svg'];
                $svg = preg_replace('/(<svg\b[^>]*)\bwidth="\d+(?:\.\d+)?(?:px)?"/i', '$1 width="' . $svgWidthAttr . '"', $svg);
                $svg = preg_replace('/(<svg\b[^>]*)\bheight="\d+(?:\.\d+)?(?:px)?"/i', '$1 height="' . $svgHeightAttr . '"', $svg);
                return '<div class="asset-align" style="display:block;text-align:left;' . $vOffsetStyle . $hOffsetStyle . ($dimsStyle !== '' ? $dimsStyle : 'width:100%;') . '">' . $svg . '</div>';
            }
            if (($asset['kind'] ?? null) === 'bitmap' && !empty($asset['dataUrl'])) {
                // text-align:left neutraliza el text-align:center heredado de los
                // contenedores: dompdf lo aplica también a bloques y duplicaría
                // el centrado ya calculado en margin-left.
                $dataUrl = $rotate ? $rotateBitmapDataUrl90($asset['dataUrl']) : $asset['dataUrl'];
                $imgStyle = $dimsStyle !== ''
                    ? 'display:block;' . $vOffsetStyle . $hOffsetStyle . $dimsStyle
                    : 'width:100%;height:auto;max-width:100%;display:block;';
                return '<div class="asset-align" style="width:100%;text-align:left;"><img src="' .
                    e($dataUrl) .
                    '" alt="' .
                    e($asset['title'] ?? 'Asset') .
                    '" style="' . $imgStyle . '"></div>';
            }
            return '<div class="asset-align"><div class="asset-placeholder"><span>Asset no compatible.</span></div></div>';
        };

        $formatNumber = static function ($value, int $decimals = 2, string $suffix = ''): string {
            if ($value === null || $value === '') {
                return '-';
            }
            return number_format((float) $value, $decimals, '.', ',') . $suffix;
        };

        $renderFooterDate = static function () use ($document): string {
            $generatedAt = $document['generatedAt'] ?? null;
            if (!is_string($generatedAt) || trim($generatedAt) === '') {
                return $document['footer']['right'] ?? '';
            }
            try {
                return 'Exportado ' .
                    \Carbon\Carbon::parse($generatedAt)->timezone('America/Lima')->format('d/m/y H:i');
            } catch (\Throwable $e) {
                return $document['footer']['right'] ?? '';
            }
        };

        $renderHeader = static function () use ($document): string {
            return '
        <div class="header">
            <div class="row">
                <div class="f-left">' .
                e($document['header']['title'] ?? '') .
                '</div>
                <div class="f-right">' .
                e($document['header']['subtitle'] ?? '') .
                '</div>
            </div>
            <div class="clear"></div>
        </div>';
        };

        $renderFooter = static function (int $pageNumber) use ($document, $renderFooterDate): string {
            return '
        <div class="footer">
            <div class="footer-col-left"><span class="footer-brand">' .
                e($document['footer']['left'] ?? 'PCL') .
                '</span></div>
            <div class="footer-col-center">' .
                e($renderFooterDate()) .
                '</div>
            <div class="footer-col-right">' .
                e((string) $pageNumber) .
                '</div>
            <div class="footer-clear"></div>
        </div>';
        };

        /* ── Tabla de luminarias ────────────────────────────────────── */
        $renderLuminaireTable = static function (array $items, bool $totals = false, ?array $totalsOverride = null) use (
            $document,
            $formatNumber,
        ): string {
            $totalsBox = '';
            $t = $totalsOverride ?? ($document['luminaireTotals'] ?? []);
            if ($totals && !empty($t)) {
                $totalsBox =
                    '
            <div class="luminaire-totals-box">
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">&Phi;total</div>
                    <div class="luminaire-totals-value">' .
                    $formatNumber($t['totalLumens'] ?? 0, 0, ' lm') .
                    '</div>
                </div>
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">P<sub>total</sub></div>
                    <div class="luminaire-totals-value">' .
                    $formatNumber($t['totalPowerWatts'] ?? 0, 1, ' W') .
                    '</div>
                </div>
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">Rendimiento lumínico</div>
                    <div class="luminaire-totals-value">' .
                    $formatNumber($t['overallEfficiency'] ?? 0, 1, ' lm/W') .
                    '</div>
                </div>
            </div>';
            }

            $rows = '';
            foreach ($items as $luminaire) {
                $efficiency = $luminaire['efficiency'] ?? null;
                if ($efficiency === null && ($luminaire['lumens'] ?? 0) > 0 && ($luminaire['powerWatts'] ?? 0) > 0) {
                    $efficiency = round($luminaire['lumens'] / $luminaire['powerWatts'], 1);
                }
                $rows .=
                    '
            <tr>
                <td class="number col-unit">' .
                    e((string) ($luminaire['quantity'] ?? 1)) .
                    '</td>
                <td class="col-brand">' .
                    e($luminaire['brand'] ?? '-') .
                    '</td>
                <td class="col-code">' .
                    e($luminaire['articleNumber'] ?? ($luminaire['model'] ?? '-')) .
                    '</td>
                <td class="col-name">' .
                    e($luminaire['name'] ?? '-') .
                    '</td>
                <td class="number col-power">' .
                    $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') .
                    '</td>
                <td class="number col-flux">' .
                    $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') .
                    '</td>
                <td class="number col-efficiency">' .
                    ($efficiency !== null ? $formatNumber($efficiency, 1, ' lm/W') : '-') .
                    '</td>
            </tr>';
            }

            if ($rows === '') {
                $rows = '<tr><td colspan="7">No hay luminarias registradas.</td></tr>';
            }

            return $totalsBox .
                '
        <table class="luminaire-table project-luminaire-table">
            <thead>
                <tr>
                    <th class="number">Unidad</th>
                    <th>Fabricante</th>
                    <th>N&deg; de art</th>
                    <th>Nombre del artículo</th>
                    <th class="number">P (W)</th>
                    <th class="number">&Phi; (lm)</th>
                    <th class="number">Rendimiento</th>
                </tr>
            </thead>
            <tbody>' .
                $rows .
                '</tbody>
        </table>';
        };

        /* ── Potencia específica (estilo DIALux evo) ────────────────────
           Dos líneas: sobre el área total del local y sobre el plano útil
           (área menos zona marginal). Ambas se normalizan con la iluminancia
           media calculada Ē, no con el valor nominal. */
        $formatPowerDensity = static function ($powerWatts, $area, $usefulArea, $avgLux) use ($formatNumber): string {
            if ($powerWatts === null || $area === null || (float) $area <= 0) {
                return '-';
            }
            $buildLine = static function (float $density, $avgLux, string $label) use ($formatNumber): string {
                $line = $formatNumber($density, 2, ' W/m&sup2;');
                if ($avgLux !== null && (float) $avgLux > 0) {
                    $line .= ' = ' . $formatNumber($density / ((float) $avgLux / 100), 2, ' W/m&sup2;/100 lx');
                }
                return $line . ' (' . $label . ')';
            };
            $lines = [$buildLine((float) $powerWatts / (float) $area, $avgLux, '&Aacute;rea')];
            if ($usefulArea !== null && (float) $usefulArea > 0) {
                $lines[] = $buildLine((float) $powerWatts / (float) $usefulArea, $avgLux, 'Plano &uacute;til');
            }
            return implode('<br>', $lines);
        };

        /* ── Bloques de ambientes locales ───────────────────────────── */
        $renderAmbientLocalBlocks = static function ($ambients) use ($formatNumber, $formatPowerDensity): string {
            $html = '';
            foreach ($ambients as $ambient) {
                $ambientLuminaires = is_array($ambient['luminaires'] ?? null) ? $ambient['luminaires'] : [];
                $rows = '';
                foreach ($ambientLuminaires as $luminaire) {
                    $rows .=
                        '
                <tr>
                    <td class="number">' .
                        e((string) ($luminaire['quantity'] ?? 1)) .
                        '</td>
                    <td>' .
                        e($luminaire['brand'] ?? '-') .
                        '</td>
                    <td>' .
                        e($luminaire['articleNumber'] ?? ($luminaire['model'] ?? '-')) .
                        '</td>
                    <td>' .
                        e($luminaire['name'] ?? '-') .
                        '</td>
                    <td class="number">' .
                        $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') .
                        '</td>
                    <td class="number">' .
                        $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') .
                        '</td>
                </tr>';
                }
                if ($rows === '') {
                    $rows = '<tr><td colspan="6">No hay luminarias registradas para este ambiente.</td></tr>';
                }

                $targetLux = $ambient['targetLux'] ?? null;
                $perpendicularLux = $ambient['avgLux'] ?? $targetLux;

                $html .=
                    '
            <div class="ambient-local-block">
                <h3 class="ambient-local-title">' .
                    e(strtoupper((string) ($ambient['ambientName'] ?? 'Ambiente'))) .
                    '</h3>
                <table class="ambient-metric-row">
                    <tr>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">P<sub>total</sub></div>
                            <div class="ambient-metric-value">' .
                    $formatNumber($ambient['totalPowerWatts'] ?? null, 1, ' W') .
                    '</div>
                        </td>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">A<sub>local</sub></div>
                            <div class="ambient-metric-value">' .
                    $formatNumber($ambient['area'] ?? null, 2, ' m&sup2;') .
                    '</div>
                        </td>
                        <td class="ambient-metric-card wide">
                            <div class="ambient-metric-label">Potencia espec&iacute;fica de conexi&oacute;n</div>
                            <div class="ambient-metric-value">' .
                    $formatPowerDensity(
                        $ambient['totalPowerWatts'] ?? null,
                        $ambient['area'] ?? null,
                        $ambient['usefulArea'] ?? null,
                        $perpendicularLux,
                    ) .
                    '</div>
                        </td>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">E<sub>perpendicular</sub> (Plano &uacute;til)</div>
                            <div class="ambient-metric-value">' .
                    $formatNumber($perpendicularLux, 0, ' lx') .
                    '</div>
                        </td>
                    </tr>
                </table>
                <table class="luminaire-table ambient-local-table">
                    <thead>
                        <tr>
                            <th class="number">Uni.</th>
                            <th>Fabricante</th>
                            <th>N&deg; de art&iacute;culo</th>
                            <th>Nombre del art&iacute;culo</th>
                            <th class="number">P</th>
                            <th class="number">&Phi;<sub>Luminaria</sub></th>
                        </tr>
                    </thead>
                    <tbody>' .
                    $rows .
                    '</tbody>
                </table>
            </div>';
            }
            return $html !== '' ? $html : '<div class="placeholder-box">No hay ambientes registrados.</div>';
        };

        /* ── Tabla de objetos de cálculo ────────────────────────────── */
        $renderCalculationObjectsTable = static function ($ambients) use ($formatNumber): string {
            $rows = '';
            foreach ($ambients as $detail) {
                $rows .=
                    '
            <tr>
                <td class="calculation-properties">
                    <strong>Plano &uacute;til (' .
                    e($detail['ambientName'] ?? 'Ambiente') .
                    ')</strong><br>
                    <span class="calculation-context">Recinto: ' .
                    e($detail['roomName'] ?? 'Sin recinto') .
                    '</span><br>
                    Iluminancia perpendicular (Adaptativamente)<br>
                    <span class="calculation-context">Altura: ' .
                    $formatNumber($detail['usefulPlaneHeight'] ?? null, 3, ' m') .
                    ' &middot; Zona marginal: ' .
                    $formatNumber($detail['marginalZone'] ?? null, 3, ' m') .
                    '</span>
                </td>
                <td class="number">' .
                    $formatNumber($detail['avgLux'] ?? null, 0, ' lx') .
                    '<br>(' .
                    $formatNumber($detail['targetLux'] ?? null, 0, ' lx') .
                    ')<span class="calculation-check"></span></td>
                <td class="number">' .
                    $formatNumber($detail['minLux'] ?? null, 1, ' lx') .
                    '</td>
                <td class="number">' .
                    $formatNumber($detail['maxLux'] ?? null, 0, ' lx') .
                    '</td>
                <td class="number">' .
                    $formatNumber($detail['uniformity'] ?? null, 2) .
                    '<br>(' .
                    $formatNumber($detail['uniformityTarget'] ?? null, 2) .
                    ')<span class="calculation-check"></span></td>
                <td class="number">' .
                    $formatNumber($detail['g2'] ?? null, 2) .
                    '</td>
                <td class="number"><span class="calculation-index">' .
                    e($detail['calculationIndex'] ?? '-') .
                    '</span></td>
            </tr>';
            }
            if ($rows === '') {
                $rows = '<tr><td colspan="7">Sin superficies calculadas.</td></tr>';
            }

            return '
        <table class="luminaire-table calculation-table">
            <colgroup>
                <col style="width:31%;">
                <col style="width:12%;">
                <col style="width:10.5%;">
                <col style="width:10.5%;">
                <col style="width:14%;">
                <col style="width:11%;">
                <col style="width:11%;">
            </colgroup>
            <thead>
                <tr>
                    <th>Propiedades</th>
                    <th class="number">E<br>(Nominal)</th>
                    <th class="number">E<sub>min</sub></th>
                    <th class="number">E<sub>m&aacute;x</sub></th>
                    <th class="number">U<sub>o</sub> (g1)<br>(Nominal)</th>
                    <th class="number">g<sub>2</sub></th>
                    <th class="number">&Iacute;ndice</th>
                </tr>
            </thead>
            <tbody>' .
                $rows .
                '</tbody>
        </table>';
        };

        /* ── Tabla de resultados por ambiente ───────────────────────── */
        // Fase 13 (§11: "mostrar engineVersion, modo y warnings"): un solo
        // punto de cambio cubre tanto `ambient-summary` como
        // `ambient-results` (ambas llaman a $renderAmbientResultsTable).
        $renderAmbientProvenance = static function (array $detail): string {
            $provenance = $detail['provenance'] ?? null;
            $warnings = $detail['warnings'] ?? [];
            $html = '';

            if (is_array($provenance) && !empty($provenance['engineVersion'])) {
                $calculatedAtLabel = !empty($provenance['calculatedAt'])
                    ? e($provenance['calculatedAt'])
                    : 'sin fecha registrada';
                $html .= '<div class="ambient-provenance">Motor de c&aacute;lculo: '
                    . e($provenance['engineVersion'])
                    . ' &middot; calculado: ' . $calculatedAtLabel . '</div>';
            }

            if (is_array($warnings) && count($warnings) > 0) {
                $items = collect($warnings)
                    ->map(fn(array $w): string => '<li>' . e($w['message'] ?? '') . '</li>')
                    ->implode('');
                $html .= '<div class="ambient-warnings"><strong>Advertencias del c&aacute;lculo:</strong><ul>' . $items . '</ul></div>';
            }

            return $html;
        };

        $renderAmbientResultsTable = static function (array $detail) use ($formatNumber, $renderAmbientProvenance): string {
            // Iluminancia de referencia: la media calculada Ē; cae al nominal si no hay cálculo.
            $referenceLux = ($detail['avgLux'] ?? null) ?: ($detail['targetLux'] ?? null);
            $usefulArea = ($detail['usefulArea'] ?? null) ?: ($detail['area'] ?? null);
            $powerDensity =
                ($detail['totalPowerWatts'] ?? null) !== null && ($detail['area'] ?? 0) > 0
                    ? (float) $detail['totalPowerWatts'] / (float) $detail['area']
                    : null;
            $usefulPowerDensity =
                ($detail['totalPowerWatts'] ?? null) !== null && ($usefulArea ?? 0) > 0
                    ? (float) $detail['totalPowerWatts'] / (float) $usefulArea
                    : null;
            $powerDensityPerLux =
                $powerDensity !== null && ($referenceLux ?? 0) > 0
                    ? $powerDensity / ((float) $referenceLux / 100)
                    : null;
            $usefulPowerDensityPerLux =
                $usefulPowerDensity !== null && ($referenceLux ?? 0) > 0
                    ? $usefulPowerDensity / ((float) $referenceLux / 100)
                    : null;
            $dailyOperatingHours = (float) ($detail['dailyOperatingHours'] ?? 8);
            $consumption =
                ($detail['totalPowerWatts'] ?? null) !== null
                    ? ((float) $detail['totalPowerWatts'] * $dailyOperatingHours * 365) / 1000
                    : null;
            // Ronda 21h: este renglón ANTES fabricaba un "límite" de consumo
            // copiando literalmente el lux normativo del ambiente (`targetLux`,
            // ej. 500) y relabeleándolo como kWh/a — sin ninguna base
            // normativa real. Producía un "Conforme"/"No conforme" sin
            // sentido (hallazgo real: un ambiente con 946 kWh/a marcado "No
            // conforme" contra "máx. 500 kWh/a", donde 500 solo era el lux
            // exigido). Ningún proyecto de este sistema tiene hoy una fuente
            // normativa citable para un límite de consumo anual por ambiente
            // (es un concepto tipo LENI/EN 15193-1, ajeno al RNE EM.010
            // peruano) — hasta que se cite una norma real y aplicable, el
            // consumo se muestra como dato informativo, "No regulado", nunca
            // "conforme"/"no conforme".

            // Estado real por métrica (RequirementEvaluation), no un check decorativo fijo.
            $evaluationsByMetric = collect($detail['requirementEvaluations'] ?? [])
                ->keyBy('metric');
            $renderVerificationCell = static function (string $metric) use ($evaluationsByMetric): string {
                $evaluation = $evaluationsByMetric->get($metric);
                // Sin evaluación registrada para esta métrica = la actividad
                // normativa seleccionada NO la regula (ej. UGR en
                // estacionamientos, Uo en baños — ver `buildRequirementEvaluations`
                // en `buildDialuxExportSnapshot.ts`, que directamente NO agrega
                // una entrada en ese caso). Es un estado DISTINTO de "hay un
                // límite pero el motor no pudo evaluarlo" (`not-evaluated`) —
                // antes ambos casos caían en el mismo "No evaluado", igual que
                // si el diseño tuviera un problema real sin tenerlo (el panel
                // en vivo, ResultsPanel.tsx, ya distinguía "no regulado" de
                // "no evaluado" — el PDF no).
                if ($evaluation === null) {
                    return '<span class="verification-status status-not-regulated">No regulado</span>';
                }
                $status = $evaluation['status'] ?? 'not-evaluated';
                $label = match ($status) {
                    'pass' => 'Conforme',
                    'fail' => 'No conforme',
                    'stale' => 'Desactualizado',
                    default => 'No evaluado',
                };

                return '<span class="verification-status status-' . e($status) . '">' . e($label) . '</span>';
            };

            return '
        <div class="detail-block-title" style="margin-bottom:2mm;">Resultados</div>
        <table class="ambient-results-table">
            <thead>
                <tr>
                    <th></th><th>Tama&ntilde;o</th>
                    <th class="result-number">Calculado</th>
                    <th class="result-number">Nominal</th>
                    <th class="result-check">Verificaci&oacute;n</th>
                    <th class="result-number">&Iacute;ndice</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td rowspan="4"><strong>Plano &uacute;til</strong></td>
                    <td>E<sub>perpendicular</sub></td>
                    <td class="result-number">' .
                $formatNumber($detail['avgLux'] ?? null, 0, ' lx') .
                '</td>
                    <td class="result-number">&ge; ' .
                $formatNumber($detail['targetLux'] ?? null, 0, ' lx') .
                '</td>
                    <td class="result-check">' .
                $renderVerificationCell('illuminance') .
                '</td>
                    <td class="result-number"><span class="calculation-index">' .
                e($detail['calculationIndex'] ?? '-') .
                '</span></td>
                </tr>
                <tr>
                    <td>U<sub>o</sub> (g1)</td>
                    <td class="result-number">' .
                $formatNumber($detail['uniformity'] ?? null, 2) .
                '</td>
                    <td class="result-number">&ge; ' .
                $formatNumber($detail['uniformityTarget'] ?? null, 2) .
                '</td>
                    <td class="result-check">' .
                $renderVerificationCell('uniformity') .
                '</td>
                    <td class="result-number"><span class="calculation-index">' .
                e($detail['calculationIndex'] ?? '-') .
                '</span></td>
                </tr>
                <tr>
                    <td>Potencia espec&iacute;fica de conexi&oacute;n</td>
                    <td class="result-number">' .
                $formatNumber($usefulPowerDensity, 2, ' W/m&sup2;') .
                '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td class="result-number">' .
                $formatNumber($usefulPowerDensityPerLux, 2, ' W/m&sup2;/100 lx') .
                '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td><strong>Evaluaci&oacute;n del deslumbramiento</strong></td>
                    <td>R<sub>UG, max</sub></td>
                    <td class="result-number">' .
                $formatNumber($detail['ugr'] ?? null, 0) .
                (!empty($detail['ugrIsManual']) ? ' <span style="font-size:7pt;color:#b45309;">(manual)</span>' : '') .
                '</td>
                    <td class="result-number">&le; ' .
                $formatNumber($detail['ugrLimit'] ?? null, 0) .
                '</td>
                    <td class="result-check">' .
                $renderVerificationCell('ugr') .
                '</td>
                    <td></td>
                </tr>
                <tr>
                    <td><strong>Reproducci&oacute;n crom&aacute;tica</strong></td>
                    <td>R<sub>a</sub></td>
                    <td class="result-number">' .
                $formatNumber($detail['ra'] ?? null, 0) .
                '</td>
                    <td class="result-number">' .
                (($detail['raRequired'] ?? null) !== null ? '&ge; ' . $formatNumber($detail['raRequired'], 0) : '-') .
                '</td>
                    <td class="result-check">' .
                $renderVerificationCell('ra') .
                '</td>
                    <td></td>
                </tr>
                <tr>
                    <td><strong>Valores de consumo</strong></td>
                    <td>Consumo</td>
                    <td class="result-number">' .
                $formatNumber($consumption, 0, ' kWh/a') .
                '</td>
                    <td class="result-number">-</td>
                    <td class="result-check">' .
                '<span class="verification-status status-not-regulated">No regulado</span>' .
                '</td>
                    <td></td>
                </tr>' .
                (($detail['leni'] ?? null) !== null
                    ? '<tr>
                    <td></td>
                    <td>LENI (' . htmlspecialchars((string) ($detail['leni']['buildingTypeLabel'] ?? ''), ENT_QUOTES) . ')</td>
                    <td class="result-number">' .
                        $formatNumber($detail['leni']['leniKwhPerM2Year'] ?? null, 1, ' kWh/(m&sup2;&middot;a)') .
                        '</td>
                    <td class="result-number">-</td>
                    <td class="result-check">' .
                        '<span class="verification-status status-not-regulated">Calculado (3)</span>' .
                        '</td>
                    <td></td>
                </tr>'
                    : '') .
                '<tr>
                    <td rowspan="2"><strong>&Aacute;rea</strong></td>
                    <td>Potencia espec&iacute;fica de conexi&oacute;n</td>
                    <td class="result-number">' .
                $formatNumber($powerDensity, 2, ' W/m&sup2;') .
                '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td class="result-number">' .
                $formatNumber($powerDensityPerLux, 2, ' W/m&sup2;/100 lx') .
                '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        <div class="ambient-note">
            (1)
Valores calculados desde los resultados almacenados del ambiente.<br>
            (2) Consumo estimado para una jornada referencial de ' .
                rtrim(rtrim(number_format($dailyOperatingHours, 1, '.', ''), '0'), '.') .
                ' h/d&iacute;a (promedio simple P&times;horas&times;365 &mdash; no reproduce la evaluaci&oacute;n
            energ&eacute;tica horaria de DIALux evo, que considera autonom&iacute;a de luz diurna, orientaci&oacute;n
            real y atenuaci&oacute;n por escena).' .
                (($detail['leni'] ?? null) !== null
                    ? '<br>(3) LENI = m&eacute;todo simplificado EN 15193-1, con horas/factores de referencia
            <strong>pendientes de verificaci&oacute;n normativa</strong> (no una cita confirmada de la norma) y
            energ&iacute;a par&aacute;sita (standby de controles) no modelada &mdash; puede subestimar el consumo
            real. Nunca representa una declaraci&oacute;n de "conforme a EN 15193".'
                    : '') .
                '
        </div>' . $renderAmbientProvenance($detail);
        };

        /* ── Fichas de producto por ambiente ────────────────────────── */
        $renderAmbientProductCards = static function (array $detail, $pageAssets) use (
            $formatNumber,
            $renderAsset,
        ): string {
            $html = '';
            foreach ($detail['luminaires'] ?? [] as $luminaire) {
                $photoAsset = collect($pageAssets)->firstWhere('id', $luminaire['productPhotoAssetId'] ?? null);
                $logoAsset = collect($pageAssets)->firstWhere('id', $luminaire['brandLogoAssetId'] ?? null);
                $lineDrawingAsset = collect($pageAssets)->firstWhere('id', $luminaire['lineDrawingAssetId'] ?? null);
                $polarAsset = collect($pageAssets)->firstWhere('id', $luminaire['polarDiagramAssetId'] ?? null);
                $imageAsset = is_array($photoAsset)
                    ? $photoAsset
                    : (is_array($lineDrawingAsset)
                        ? $lineDrawingAsset
                        : null);
                $hasPolarAsset = is_array($polarAsset);
                $isCompact = !$imageAsset && !$hasPolarAsset;

                $html .=
                    '
            <div class="product-sheet-card' .
                    ($isCompact ? ' compact' : '') .
                    '">
                <div class="product-sheet-header">
                    <h3>' .
                    e($luminaire['name'] ?? '-') .
                    '</h3>
                    <p>' .
                    e($luminaire['brand'] ?? 'Fabricante no definido') .
                    '</p>
                </div>
                <div class="product-sheet-left-col">
                    ' .
                    (is_array($logoAsset)
                        ? '<div class="product-image-container" style="height:18mm;">' .
                            $renderAsset($logoAsset, 70, 15, true) .
                            '</div>'
                        : '') .
                    '
                    ' .
                    ($imageAsset
                        ? '<div class="product-image-container">' . $renderAsset($imageAsset, 70, 46, true) . '</div>'
                        : '') .
                    '
                    <table class="product-table">
                        <tr><th>N&deg; de art&iacute;culo</th><td>' .
                    e($luminaire['articleNumber'] ?? '-') .
                    '</td></tr>
                        <tr><th>P</th><td>' .
                    $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') .
                    '</td></tr>
                        <tr><th>&Phi;<sub>Luminaria</sub></th><td>' .
                    $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') .
                    '</td></tr>
                        <tr><th>Rendimiento</th><td>' .
                    $formatNumber($luminaire['efficiency'] ?? null, 1, ' lm/W') .
                    '</td></tr>
                    </table>
                </div>
                ' .
                    ($hasPolarAsset
                        ? '<div class="product-sheet-right-col"><div class="polar-diagram-container">' .
                            $renderAsset($polarAsset, 84, 86, true) .
                            '</div></div>'
                        : '') .
                    '
                <div class="clear"></div>
            </div>';
            }
            return $html !== ''
                ? $html
                : '<div class="placeholder-box">No hay productos registrados para este ambiente.</div>';
        };
    @endphp

    {{-- ════════════════════════════════════════════════════════
     PÁGINAS
     ════════════════════════════════════════════════════════ --}}
    @foreach ($pages as $page)
        @php
            $pageAssets = is_array($page['assets'] ?? null) ? $page['assets'] : [];
            $summaryAsset = collect($pageAssets)->first(
                fn(array $a): bool => ($a['kind'] ?? null) === 'structured' &&
                    ($a['data']['type'] ?? null) === 'summary',
            );
            $summaryItems = is_array($summaryAsset['data']['items'] ?? null) ? $summaryAsset['data']['items'] : [];
            $overviewAsset = collect($pageAssets)->first(
                fn(array $a): bool => in_array(
                    $a['id'] ?? '',
                    ['viewer-capture', 'cad-overview-svg', 'formal-cover-svg'],
                    true,
                ) || in_array($a['purpose'] ?? null, ['cad-overview', 'viewer-capture'], true),
            );
            $coverVisual =
                collect($pageAssets)->firstWhere('id', 'viewer-capture-3d') ??
                (collect($pageAssets)->firstWhere('id', 'formal-cover-svg') ??
                    (collect($pageAssets)->firstWhere('id', 'viewer-capture') ?? collect($pageAssets)->first()));

            // Editor2DController ya precalcula esto (mismo criterio abajo) para
            // poder repartir las páginas entre el render portrait y el
            // landscape antes de fusionarlos con FPDI. Si no viene precalculado
            // (p. ej. tests que renderizan esta vista directamente) se aplica
            // la misma regla aquí como antes.
            if (array_key_exists('isLandscape', $page)) {
                $isLandscapePage = (bool) $page['isLandscape'];
            } else {
                // Default landscape pages (tables)
                $landscapePageKinds = ['ambient-list', 'room-ambient-list', 'calculation-object-list'];

                $isLandscapePage = in_array($page['kind'] ?? '', $landscapePageKinds, true);

                // Dynamically set orientation for plan pages based on asset dimensions
                if (in_array($page['kind'] ?? '', ['terrain-cad', 'terrain-architectural'], true)) {
                    $mainAsset = collect($pageAssets)->first();
                    if ($mainAsset && isset($mainAsset['width'], $mainAsset['height'])) {
                        $isLandscapePage = $mainAsset['width'] > $mainAsset['height'];
                    }
                }
            }
        @endphp

        <section
            class="page {{ $page['kind'] === 'cover' ? 'cover-page' : '' }} {{ $isLandscapePage ? 'page-landscape' : '' }}">
            <div class="watermark">PCL</div>

            {{-- ══ PORTADA ══════════════════════════════════════════ --}}
            @if ($page['kind'] === 'cover')
                @php
                    $metaByLabel = collect($document['metadata'])->keyBy('label');
                    $estadoCalculo = $metaByLabel->get('Estado calculo')['value'] ?? '-';
                    $luxPromedio   = $metaByLabel->get('Lux promedio')['value'] ?? '-';
                    $ambientesVal  = $metaByLabel->get('Ambientes')['value'] ?? '-';
                    $luminariasVal = $metaByLabel->get('Luminarias')['value'] ?? '-';
                    $coverMetaCols = ['Proyecto', 'Escena', 'Exportado', 'Formato'];
                    $coverMeta = collect($document['metadata'])
                        ->filter(fn($m) => in_array($m['label'], $coverMetaCols, true))
                        ->values();
                    $isConforme = str_starts_with($estadoCalculo, 'Conforme');
                @endphp
                <div class="cover-shell">

                    {{-- Barra superior oscura: marca + etiqueta de documento --}}
                    <div class="cover-top-bar">
                        <div class="cover-brand">PCL</div>
                        <div class="cover-project-tag">Informe Luminot&eacute;cnico &middot; PCL</div>
                    </div>

                    {{-- Franja de clasificación teal --}}
                    <div class="cover-class-bar">
                        REPORTE T&Eacute;CNICO DE ILUMINACI&Oacute;N &mdash; DISE&Ntilde;O LUMINOT&Eacute;CNICO FORMAL
                    </div>

                    {{-- Bloque de información: título + metadatos + KPIs --}}
                    <div class="cover-info">
                        <div class="cover-info-left">
                            <h1 class="cover-title">{{ $document['title'] }}</h1>
                            @if (!empty($document['subtitle']))
                                <p class="cover-subtitle">{{ $document['subtitle'] }}</p>
                            @endif
                            <table class="meta-grid">
                                @foreach ($coverMeta as $meta)
                                    <tr>
                                        <td class="meta-label">{{ $meta['label'] }}</td>
                                        <td class="meta-value">{{ $meta['value'] }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </div>
                        <div class="cover-info-right">
                            {{-- KPI cards 2×2 --}}
                            <div class="cover-kpi-half">
                                <div class="cover-kpi-cell">
                                    <div class="cover-kpi-label">Estado c&aacute;lculo</div>
                                    <div class="cover-kpi-value {{ $isConforme ? 'cover-kpi-ok' : 'cover-kpi-warn' }}">
                                        {{ $estadoCalculo }}
                                    </div>
                                </div>
                                <div class="cover-kpi-cell">
                                    <div class="cover-kpi-label">Lux promedio</div>
                                    <div class="cover-kpi-value cover-kpi-neutral">{{ $luxPromedio }} lx</div>
                                </div>
                                <div class="cover-kpi-cell">
                                    <div class="cover-kpi-label">Ambientes</div>
                                    <div class="cover-kpi-value cover-kpi-neutral">{{ $ambientesVal }}</div>
                                </div>
                                <div class="cover-kpi-cell">
                                    <div class="cover-kpi-label">Luminarias</div>
                                    <div class="cover-kpi-value cover-kpi-neutral">{{ $luminariasVal }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="clear"></div>
                    </div>

                    {{-- Imagen 3D — ocupa el espacio visual restante de la portada --}}
                    <div class="cover-image-wrap">
                        @if (is_array($coverVisual))
                            {!! $renderAsset($coverVisual, 210, 215, true) !!}
                        @else
                            <div class="cover-image-empty"></div>
                        @endif
                    </div>

                </div>

                {{-- ══ PÁGINAS INTERNAS ═════════════════════════════════ --}}
            @else
                {!! $renderHeader() !!}

                @php
                    $fullplanKinds = ['terrain-cad', 'terrain-architectural', 'ambient-useful-plane'];
                @endphp
                <div
                    class="page-body{{ in_array($page['kind'] ?? '', $fullplanKinds, true) ? ' page-body-fullplan' : '' }}">
                    @if (!in_array($page['kind'] ?? '', $fullplanKinds, true))
                        <h2 class="section-title">{{ $page['title'] }}</h2>
                        @if (!empty($page['subtitle']))
                            <p class="section-subtitle">{{ $page['subtitle'] }}</p>
                        @endif
                    @endif

                    {{-- Observaciones preliminares --}}
                    @if ($page['kind'] === 'preliminary-observations')
                        <div class="observations-layout">
                            <div class="observations-left">
                                <div class="observations-copy">
                                    @foreach ($page['notes'] ?? [] as $note)
                                        <p>{{ $note }}</p>
                                    @endforeach
                                </div>
                            </div>
                            <div class="observations-right">
                                <div class="observations-graphic">
                                    {!! $renderAsset(is_array($overviewAsset) ? $overviewAsset : null, 66, 62, true) !!}
                                </div>
                                @if (!empty($summaryItems))
                                    <div class="summary-card" style="margin-top:3mm; padding:4mm;">
                                        <p class="summary-title">Resumen del proyecto</p>
                                        <table class="metric-grid">
                                            @foreach ($summaryItems as $item)
                                                <tr>
                                                    <td class="metric-label">{{ $item['label'] ?? '' }}</td>
                                                    <td class="metric-value">{{ $item['value'] ?? '' }}</td>
                                                </tr>
                                            @endforeach
                                        </table>
                                    </div>
                                @endif
                            </div>
                            <div class="clear"></div>
                        </div>

                        {{-- Índice de contenidos --}}
                    @elseif ($page['kind'] === 'toc')
                        @php
                            $chunkIndex =
                                (int) (collect($tocPages)->search(
                                    fn(array $tocPage): bool => $tocPage['id'] === $page['id'],
                                ) ?:
                                0);
                            $chunk = $tocChunks[$chunkIndex] ?? [];
                            $dots = str_repeat('.', 300);
                        @endphp
                        @foreach ($chunk as $entry)
                            @php $kind = $entry['kind'] ?? 'item'; @endphp
                            @if ($kind === 'section-label')
                                <div class="toc-section-label">{{ $entry['title'] }}</div>
                            @elseif ($kind === 'section-heading')
                                <div
                                    class="toc-section-heading {{ ($entry['size'] ?? 'large') === 'small' ? 'small' : '' }}">
                                    {{ $entry['title'] }}
                                </div>
                            @else
                                <table class="toc-row {{ ($entry['level'] ?? 0) > 0 ? 'toc-indent' : '' }}">
                                    <tr>
                                        <td class="toc-cell-title">{{ $entry['title'] }}</td>
                                        <td class="toc-cell-dots">{{ $dots }}</td>
                                        <td class="toc-cell-page">{{ $entry['pageNumber'] }}</td>
                                    </tr>
                                </table>
                                @if (!empty($entry['subtitle']))
                                    <div
                                        style="margin:-1mm 0 2mm {{ ($entry['level'] ?? 0) > 0 ? '6mm' : '0' }};color:#64748b;font-size:9px;line-height:1.3;">
                                        {{ $entry['subtitle'] }}
                                    </div>
                                @endif
                            @endif
                        @endforeach

                        {{-- Lista global de luminarias (puede paginarse en continuaciones) --}}
                    @elseif ($page['kind'] === 'luminaire-list')
                        @php
                            $luminaireRangeStart = $page['rowRangeStart'] ?? 0;
                            $luminaireRangeEnd = $page['rowRangeEnd'] ?? count($document['luminaires'] ?? []);
                            $luminairePageItems = array_slice(
                                $document['luminaires'] ?? [],
                                $luminaireRangeStart,
                                $luminaireRangeEnd - $luminaireRangeStart,
                            );
                        @endphp
                        {!! $renderLuminaireTable($luminairePageItems, $luminaireRangeStart === 0) !!}

                        {{-- Ficha de producto individual --}}
                    @elseif ($page['kind'] === 'product-sheet')
                        @php
                            $luminaireId = str_replace('product-sheet:', '', $page['sectionId']);
                            $lum = collect($document['luminaires'])->firstWhere('id', $luminaireId);
                            $photoAsset = collect($pageAssets)->firstWhere('id', $lum['productPhotoAssetId'] ?? null);
                            $logoAsset = collect($pageAssets)->firstWhere('id', $lum['brandLogoAssetId'] ?? null);
                            $lineDrawingAsset = collect($pageAssets)->firstWhere(
                                'id',
                                $lum['lineDrawingAssetId'] ?? null,
                            );
                            $polarDiagramAsset = collect($pageAssets)->firstWhere(
                                'id',
                                $lum['polarDiagramAssetId'] ?? null,
                            );
                            $technicalRows = $lum['reportData']['technical_table'] ?? null;
                            $ugrTableComputed = $lum['reportData']['ugrTableComputed'] ?? null;
                            $ugrTablesComputed = $lum['reportData']['ugrTablesComputed'] ?? null;
                        @endphp
                        <div class="product-sheet-card">
                            @if ($lum)
                                <div class="product-sheet-header">
                                    <h3>{{ $lum['brand'] ?? 'Fabricante no especificado' }} &mdash;
                                        {{ $lum['name'] }}</h3>
                                    <p>Potencia: {{ $formatNumber($lum['powerWatts'] ?? null, 1, ' W') }} &bull; CCT:
                                        {{ $lum['cct'] ?? null ? $lum['cct'] . ' K' : '-' }}</p>
                                </div>
                                <div class="row">
                                    <div class="product-sheet-left-col">
                                        {{-- Logo y foto/dibujo se muestran siempre (con su propio fallback
                                             "Gráfico no disponible." de $renderAsset) en vez de desaparecer
                                             en silencio cuando el producto no trae esos assets. --}}
                                        <div class="product-image-container" style="height:18mm;">
                                            {!! $renderAsset(is_array($logoAsset) ? $logoAsset : null, 70, 15, true) !!}
                                        </div>
                                        <div class="product-image-container">
                                            {!! $renderAsset(is_array($photoAsset) ? $photoAsset : (is_array($lineDrawingAsset) ? $lineDrawingAsset : null), 70, 46, true) !!}
                                        </div>
                                        <table class="product-table">
                                            @if (is_array($technicalRows) && count($technicalRows) > 0)
                                                @foreach ($technicalRows as $row)
                                                    <tr>
                                                        <th>{{ $row['label'] ?? '-' }}</th>
                                                        <td>{{ $row['value'] ?? '-' }}</td>
                                                    </tr>
                                                @endforeach
                                            @else
                                                <tr>
                                                    <th>N&deg; art.</th>
                                                    <td>{{ $lum['articleNumber'] ?? ($lum['model'] ?? '-') }}</td>
                                                </tr>
                                                <tr>
                                                    <th>P</th>
                                                    <td>{{ $formatNumber($lum['powerWatts'] ?? null, 1, ' W') }}</td>
                                                </tr>
                                                <tr>
                                                    <th>Flujo luminoso</th>
                                                    <td>{{ $formatNumber($lum['lumens'] ?? null, 0, ' lm') }}</td>
                                                </tr>
                                                <tr>
                                                    <th>Rendimiento</th>
                                                    <td>{{ $lum['efficiency'] ? $formatNumber($lum['efficiency'], 1, ' lm/W') : '-' }}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th>CCT</th>
                                                    <td>{{ $lum['cct'] ?? null ? $lum['cct'] . ' K' : '-' }}</td>
                                                </tr>
                                                <tr>
                                                    <th>CRI</th>
                                                    <td>{{ $lum['cri'] ?? '-' }}</td>
                                                </tr>
                                            @endif
                                        </table>
                                        @if (!empty($lum['description']))
                                            <div style="margin-bottom:2mm;">
                                                <strong style="font-size:9px;color:#0f172a;">Descripción:</strong><br>
                                                <span
                                                    style="color:#475569;font-size:9px;line-height:1.4;">{{ $lum['description'] }}</span>
                                            </div>
                                        @endif
                                        @if (!empty($lum['applications']))
                                            <div style="margin-bottom:2mm;">
                                                <strong style="font-size:9px;color:#0f172a;">Aplicaciones:</strong><br>
                                                <span
                                                    style="color:#475569;font-size:9px;line-height:1.4;">{{ $lum['applications'] }}</span>
                                            </div>
                                        @endif
                                    </div>
                                    <div class="product-sheet-right-col">
                                        <div class="polar-diagram-container">
                                            {!! $renderAsset(is_array($polarDiagramAsset) ? $polarDiagramAsset : null, 84, 86, true) !!}
                                        </div>
                                    </div>
                                </div>
                                <div class="clear"></div>

                                {{-- Ronda 21c: grilla UGR de ancho completo, no la columna de 50%
                                     (11 columnas densas — sala + 5 combinaciones de reflectancia ×
                                     2 orientaciones — no caben legibles en la mitad de una página A4). --}}
                                <div class="detail-block-title" style="margin-top:2mm;margin-bottom:2mm;">
                                    Evaluación del deslumbramiento según UGR
                                </div>
                                @if (is_array($ugrTablesComputed) && count($ugrTablesComputed) > 0 && !empty($ugrTablesComputed[0]['entries']))
                                    <table class="product-table" style="font-size:7px;width:100%;">
                                        <tr>
                                            <th rowspan="2" style="vertical-align:bottom;">Sala de referencia</th>
                                            @foreach ($ugrTablesComputed as $ugrTable)
                                                <th colspan="2" style="text-align:center;">
                                                    {{ $ugrTable['reflectances']['ceiling'] ?? '-' }}/{{ $ugrTable['reflectances']['wall'] ?? '-' }}/{{ $ugrTable['reflectances']['floor'] ?? '-' }}
                                                </th>
                                            @endforeach
                                        </tr>
                                        <tr>
                                            @foreach ($ugrTablesComputed as $ugrTable)
                                                <th>⊥</th>
                                                <th>∥</th>
                                            @endforeach
                                        </tr>
                                        @foreach ($ugrTablesComputed[0]['entries'] as $roomIndex => $firstRow)
                                            <tr>
                                                <td>{{ $firstRow['roomLabel'] ?? '-' }}</td>
                                                @foreach ($ugrTablesComputed as $ugrTable)
                                                    @php $ugrRow = $ugrTable['entries'][$roomIndex] ?? null; @endphp
                                                    <td>{{ $formatNumber($ugrRow['ugrCrosswise'] ?? null, 1) }}</td>
                                                    <td>{{ $formatNumber($ugrRow['ugrEndwise'] ?? null, 1) }}</td>
                                                @endforeach
                                            </tr>
                                        @endforeach
                                    </table>
                                    {{-- Fase 15/21c: nunca se presenta como dato de fabricante — el
                                         disclaimer de procedencia va siempre visible junto a la tabla. --}}
                                    <p style="font-size:6.5px;color:#64748b;margin-top:1mm;">
                                        {{ $ugrTablesComputed[0]['disclaimer'] ?? '' }}
                                        Combinaciones de reflectancia habituales (techo/pared/piso) — no una
                                        transcripción letra por letra del grid del texto CIE 117 pagado.
                                        ⊥ = transversal (perpendicular al eje de la luminaria) · ∥ = longitudinal (a lo largo del eje).
                                    </p>
                                @elseif (is_array($ugrTableComputed) && !empty($ugrTableComputed['entries']))
                                    <table class="product-table" style="font-size:8px;">
                                        <tr>
                                            <th>Sala de referencia</th>
                                            <th>UGR transversal</th>
                                            <th>UGR longitudinal</th>
                                        </tr>
                                        @foreach ($ugrTableComputed['entries'] as $ugrRow)
                                            <tr>
                                                <td>{{ $ugrRow['roomLabel'] ?? '-' }}</td>
                                                <td>{{ $formatNumber($ugrRow['ugrCrosswise'] ?? null, 1) }}</td>
                                                <td>{{ $formatNumber($ugrRow['ugrEndwise'] ?? null, 1) }}</td>
                                            </tr>
                                        @endforeach
                                    </table>
                                    <p style="font-size:7px;color:#64748b;margin-top:1mm;">
                                        {{ $ugrTableComputed['disclaimer'] ?? '' }}
                                    </p>
                                @else
                                    <div class="placeholder-box">Información UGR no disponible</div>
                                @endif
                            @else
                                <p>No se encontró la luminaria.</p>
                            @endif
                        </div>

                        {{-- Lista de locales — tabla compacta para no desbordar la hoja --}}
                    @elseif ($page['kind'] === 'ambient-list')
                        @php
                            $ambientListAsset =
                                collect($pageAssets)->firstWhere('id', 'composite-plan-bitmap') ??
                                (collect($pageAssets)->firstWhere('id', 'drawn-terrain-svg') ??
                                    (collect($pageAssets)->firstWhere('id', 'cad-base-bitmap') ??
                                        (collect($pageAssets)->firstWhere('id', 'viewer-capture') ??
                                            collect($pageAssets)->first())));
                            $listAmbients = $document['ambientDetails'] ?? [];
                        @endphp
                        @if (is_array($ambientListAsset))
                            <div class="terrain-plan-wrap" style="height:128mm;">
                                {!! $renderAsset($ambientListAsset, 184, 124, true, true) !!}
                            </div>
                        @endif
                        <table class="luminaire-table ambient-list-table" style="margin-top:3mm; table-layout:fixed;">
                            <thead>
                                <tr>
                                    <th style="text-align:left; width:36%;">Local</th>
                                    <th class="number" style="width:12%;">&Aacute;rea (m&sup2;)</th>
                                    <th class="number" style="width:14%;">Em (lx)</th>
                                    <th class="number" style="width:14%;">&ge; (lx)</th>
                                    <th class="number" style="width:12%;">Uo</th>
                                    <th class="number" style="width:12%;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($listAmbients as $amb)
                                    <tr>
                                        <td style="text-align:left;">{{ strtoupper($amb['ambientName'] ?? '-') }}</td>
                                        <td class="number">{{ $formatNumber($amb['area'] ?? null, 1) }}</td>
                                        <td class="number">{{ $formatNumber($amb['avgLux'] ?? null, 0) }}</td>
                                        <td class="number">{{ $formatNumber($amb['targetLux'] ?? null, 0) }}</td>
                                        <td class="number">{{ $formatNumber($amb['uniformity'] ?? null, 2) }}</td>
                                        <td class="number">{{ $amb['complianceLabel'] ?? '-' }}</td>
                                    </tr>
                                @empty
                                    <tr><td colspan="6">Sin ambientes registrados.</td></tr>
                                @endforelse
                            </tbody>
                        </table>

                        {{-- Plano CAD — imagen llena toda la página --}}
                    @elseif ($page['kind'] === 'terrain-cad')
                        @php
                            $cadAsset =
                                collect($pageAssets)->firstWhere('id', 'cad-overview-svg') ??
                                (collect($pageAssets)->firstWhere('id', 'cad-base-bitmap') ??
                                    (collect($pageAssets)->firstWhere('id', 'viewer-capture') ??
                                        collect($pageAssets)->first()));
                        @endphp
                        @if (is_array($cadAsset))
                            <div class="terrain-full-page">
                                {!! $isLandscapePage ? $renderAsset($cadAsset, 255, 140, true, true) : $renderAsset($cadAsset, 188, 226, true, true) !!}
                            </div>
                        @else
                            <div class="placeholder-box">Plano CAD no disponible en esta exportación.</div>
                        @endif

                        {{-- Plano arquitectónico — imagen llena toda la página --}}
                    @elseif ($page['kind'] === 'terrain-architectural')
                        @php
                            $drawnTerrain =
                                collect($pageAssets)->firstWhere('id', 'composite-isolux-bitmap') ??
                                (collect($pageAssets)->firstWhere('id', 'terrain-with-isolux-svg') ??
                                    (collect($pageAssets)->firstWhere('id', 'drawn-terrain-svg') ??
                                        (collect($pageAssets)->firstWhere('id', 'cad-base-bitmap') ??
                                            collect($pageAssets)->first())));
                        @endphp
                        @if (is_array($drawnTerrain))
                            <div class="terrain-full-page">
                                {!! $isLandscapePage ? $renderAsset($drawnTerrain, 255, 140, true, true) : $renderAsset($drawnTerrain, 188, 226, true, true) !!}
                            </div>
                        @else
                            <div class="placeholder-box">Plano Arquitectónico no disponible en esta exportación.</div>
                        @endif

                        {{-- Recinto: plan + tabla de ambientes --}}
                    @elseif ($page['kind'] === 'room-ambient-list')
                        @php
                            $roomAmbients = collect($document['ambientDetails'] ?? [])
                                ->filter(fn($a) => $a['roomId'] === ($page['roomId'] ?? null))
                                ->values()
                                ->all();
                        @endphp
                        {!! $renderAmbientLocalBlocks($roomAmbients) !!}

                        {{-- Recinto: luminarias --}}
                    @elseif ($page['kind'] === 'room-luminaires')
                        @php
                            $roomAmbients = collect($document['ambientDetails'] ?? [])->filter(
                                fn($a) => $a['roomId'] === ($page['roomId'] ?? null),
                            );
                            // El mismo producto repetido en varios locales del recinto se
                            // consolida en una sola fila sumando cantidades (estilo DIALux evo).
                            $roomLuminaires = $roomAmbients
                                ->pluck('luminaires')
                                ->flatten(1)
                                ->groupBy(
                                    fn(array $l): string => ($l['brand'] ?? '') .
                                        '|' .
                                        ($l['articleNumber'] ?? '') .
                                        '|' .
                                        ($l['name'] ?? ''),
                                )
                                ->map(function ($group) {
                                    $first = $group->first();
                                    $first['quantity'] = (int) $group->sum('quantity');
                                    return $first;
                                })
                                ->values()
                                ->all();
                        @endphp
                        {!! $renderLuminaireTable($roomLuminaires, false) !!}

                        {{-- Recinto: objeto de cálculo --}}
                    @elseif ($page['kind'] === 'room-calculation-object')
                        @php
                            $roomAmbients = collect($document['ambientDetails'] ?? [])->filter(
                                fn($a) => $a['roomId'] === ($page['roomId'] ?? null),
                            );
                        @endphp
                        <div class="detail-block-title" style="margin-bottom:2mm;">Objetos de c&aacute;lculo / Escena de
                            luz 1</div>
                        {!! $renderCalculationObjectsTable($roomAmbients) !!}

                        {{-- Objetos de cálculo (filtrado por recinto, paginado si excede una hoja) --}}
                    @elseif ($page['kind'] === 'calculation-object-list')
                        @php
                            $pageRoomId = $page['roomId'] ?? null;
                            $calcAmbientsFull = $pageRoomId
                                ? collect($document['ambientDetails'] ?? [])
                                    ->filter(fn(array $a): bool => ($a['roomId'] ?? null) === $pageRoomId)
                                    ->values()
                                    ->all()
                                : ($document['ambientDetails'] ?? []);
                            $calcRangeStart = $page['rowRangeStart'] ?? 0;
                            $calcRangeEnd = $page['rowRangeEnd'] ?? count($calcAmbientsFull);
                            $calcAmbients = array_slice(
                                $calcAmbientsFull,
                                $calcRangeStart,
                                $calcRangeEnd - $calcRangeStart,
                            );
                        @endphp
                        <div class="detail-block-title" style="margin-bottom:2mm;">Planos &uacute;tiles</div>
                        {!! $renderCalculationObjectsTable($calcAmbients) !!}

                        {{-- Lista de luminarias consolidada del nivel (Scene), puede paginarse --}}
                    @elseif ($page['kind'] === 'level-luminaire-list')
                        @php
                            $levelSummary = $page['levelSummary'] ?? null;
                            $levelLuminairesFull = $levelSummary['luminaires'] ?? [];
                            $levelRangeStart = $page['rowRangeStart'] ?? 0;
                            $levelRangeEnd = $page['rowRangeEnd'] ?? count($levelLuminairesFull);
                            $levelPageItems = array_slice(
                                $levelLuminairesFull,
                                $levelRangeStart,
                                $levelRangeEnd - $levelRangeStart,
                            );
                        @endphp
                        <div class="detail-block-title" style="margin-bottom:2mm;">
                            Lista de luminarias &mdash; {{ $levelSummary['sceneName'] ?? ($page['sceneName'] ?? 'Nivel') }}
                        </div>
                        {!! $renderLuminaireTable(
                            $levelPageItems,
                            $levelRangeStart === 0,
                            $levelSummary['luminaireTotals'] ?? null,
                        ) !!}

                        {{-- Resumen de ambiente --}}
                    @elseif ($page['kind'] === 'ambient-summary' && !empty($page['ambientDetail']))
                        @php $detail = $page['ambientDetail']; @endphp

                        {{-- Información principal del local (sin imagen — va en Plano de situación) --}}
                        <div class="detail-block-title" style="margin-bottom:3mm;">Informaci&oacute;n principal del local</div>
                        <table class="metric-grid" style="width:100%; margin-bottom:5mm;">
                            <tr>
                                <td class="metric-label" style="width:60%">Recinto base asociado</td>
                                <td class="metric-value">{{ $detail['roomName'] }}</td>
                            </tr>
                            <tr>
                                <td class="metric-label">&Aacute;rea del local</td>
                                <td class="metric-value">{{ $formatNumber($detail['area'] ?? null, 2, ' m²') }}</td>
                            </tr>
                            <tr>
                                <td class="metric-label">Altura interior del local</td>
                                <td class="metric-value">{{ $formatNumber($detail['interiorHeight'] ?? null, 3, ' m') }}</td>
                            </tr>
                            <tr>
                                <td class="metric-label">Grado de reflexi&oacute;n (Techo / Paredes / Suelo)</td>
                                <td class="metric-value">
                                    @if (is_null($detail['reflectionCeiling'] ?? null) || is_null($detail['reflectionWall'] ?? null) || is_null($detail['reflectionFloor'] ?? null))
                                        No asignado (no usado en el c&aacute;lculo)
                                    @else
                                        {{ $detail['reflectionCeiling'] }}% /
                                        {{ $detail['reflectionWall'] }}% /
                                        {{ $detail['reflectionFloor'] }}%
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td class="metric-label">Altura del plano &uacute;til</td>
                                <td class="metric-value">{{ $formatNumber($detail['usefulPlaneHeight'] ?? null, 3, ' m') }}</td>
                            </tr>
                            <tr>
                                <td class="metric-label">Factor de degradaci&oacute;n</td>
                                <td class="metric-value">{{ $formatNumber($detail['maintenanceFactor'] ?? null, 2) }}</td>
                            </tr>
                            <tr>
                                <td class="metric-label">Zona marginal</td>
                                <td class="metric-value">{{ $formatNumber($detail['marginalZone'] ?? null, 3, ' m') }}</td>
                            </tr>
                        </table>

                        {{-- Tabla de resultados luminotécnicos --}}
                        {!! $renderAmbientResultsTable($detail) !!}

                        {{-- Plano de situación de luminarias (sub-sección 2 por local) --}}
                    @elseif ($page['kind'] === 'ambient-plan')
                        @php
                            $detail = $page['ambientDetail'] ?? null;
                            $planAsset = collect($pageAssets)->firstWhere('id', $detail['planAssetId'] ?? null);
                            $isoluxAsset = collect($pageAssets)->firstWhere('id', $detail['isoluxAssetId'] ?? null);
                            $hasBoth = is_array($planAsset) && is_array($isoluxAsset);
                        @endphp

                        {{-- Gráficos: plan + isolux en 2 columnas, o solo uno si el otro no existe --}}
                        @if ($hasBoth)
                            <div class="ambient-plan-grid">
                                <div class="ambient-plan-left-col">
                                    <div class="ambient-plan-col-label">Plano de luminarias</div>
                                    {!! $renderAsset(is_array($planAsset) ? $planAsset : null, 98, 94, true) !!}
                                </div>
                                <div class="ambient-plan-right-col">
                                    <div class="ambient-plan-col-label">Plano &uacute;til &mdash; Isolux (lx)</div>
                                    {!! $renderAsset(is_array($isoluxAsset) ? $isoluxAsset : null, 80, 94, true) !!}
                                </div>
                                <div class="clear"></div>
                            </div>
                        @elseif (is_array($planAsset) || is_array($isoluxAsset))
                            @php $singleGraphic = is_array($planAsset) ? $planAsset : $isoluxAsset; @endphp
                            <div class="ambient-asset-container" style="height:130mm;">
                                {!! $renderAsset($singleGraphic, 184, 126, true) !!}
                            </div>
                        @else
                            <div class="ambient-empty-note">
                                Ambiente sin plano disponible. Se mantiene en el reporte para resultados y objeto de
                                c&aacute;lculo.
                            </div>
                        @endif

                        {{-- Posiciones de luminarias agrupadas por producto (estilo DIALux evo) --}}
                        @if ($detail && !empty($detail['fixturePositions']))
                            @php
                                $positionGroups = collect($detail['fixturePositions'])->groupBy(
                                    fn(array $p): string => ($p['brand'] ?? '') .
                                        '|' .
                                        ($p['articleNumber'] ?? '') .
                                        '|' .
                                        preg_replace('/\s*[\[\(]\d+[\]\)]\s*$/', '', $p['productName'] ?? ''),
                                );
                            @endphp
                            @foreach ($positionGroups as $group)
                                @php
                                    $firstPos = $group->first();
                                    $groupLabel = trim(
                                        ($firstPos['brand'] ?? '') .
                                            ' ' .
                                            preg_replace('/\s*[\[\(]\d+[\]\)]\s*$/', '', $firstPos['productName'] ?? ''),
                                    );
                                @endphp
                                <div class="fixture-position-title" style="margin-top:2mm;">
                                    {{ $group->count() }} x {{ $groupLabel !== '' ? $groupLabel : 'Luminaria' }}</div>
                                <table class="luminaire-table fixture-position-table">
                                    <thead>
                                        <tr>
                                            <th class="number">X</th>
                                            <th class="number">Y</th>
                                            <th class="number">Altura de montaje</th>
                                            <th class="number">Luminaria</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach ($group as $position)
                                            <tr>
                                                <td class="number">{{ $formatNumber($position['x'] ?? null, 3, ' m') }}
                                                </td>
                                                <td class="number">{{ $formatNumber($position['y'] ?? null, 3, ' m') }}
                                                </td>
                                                <td class="number">
                                                    {{ $formatNumber($position['mountingHeight'] ?? null, 3, ' m') }}</td>
                                                <td class="number"><span
                                                        class="calculation-index">{{ $loop->iteration }}</span></td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            @endforeach
                        @endif

                        {{-- Luminarias por ambiente --}}
                    @elseif ($page['kind'] === 'ambient-luminaires' && !empty($page['ambientDetail']))
                        {!! $renderLuminaireTable($page['ambientDetail']['luminaires'] ?? [], false) !!}

                        {{-- Resultados por ambiente --}}
                    @elseif ($page['kind'] === 'ambient-results' && !empty($page['ambientDetail']))
                        {!! $renderAmbientResultsTable($page['ambientDetail']) !!}

                        {{-- Fichas de productos por ambiente --}}
                    @elseif ($page['kind'] === 'ambient-products' && !empty($page['ambientDetail']))
                        <div class="detail-block-title" style="margin-bottom:2mm;">Productos usados en el ambiente
                        </div>
                        {!! $renderAmbientProductCards($page['ambientDetail'], $pageAssets) !!}

                        {{-- Objetos de cálculo por ambiente --}}
                    @elseif ($page['kind'] === 'ambient-calculation-object' && !empty($page['ambientDetail']))
                        @php $detail = $page['ambientDetail']; @endphp
                        <div class="detail-block-title" style="margin-bottom:2mm;">Superficies de cálculo</div>
                        <table class="luminaire-table calculation-table">
                            <colgroup>
                                <col style="width:31%;">
                                <col style="width:12%;">
                                <col style="width:10.5%;">
                                <col style="width:10.5%;">
                                <col style="width:14%;">
                                <col style="width:11%;">
                                <col style="width:11%;">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Propiedades</th>
                                    <th class="number">E (nominal)</th>
                                    <th class="number">Emin</th>
                                    <th class="number">Emax</th>
                                    <th class="number">Uo (g1) (nominal)</th>
                                    <th class="number">g2</th>
                                    <th class="number">Índice</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="calculation-properties">
                                        <strong>Plano &uacute;til ({{ $detail['ambientName'] }})</strong><br>
                                        <span class="calculation-context">Recinto:
                                            {{ $detail['roomName'] ?? 'Sin recinto' }}</span><br>
                                        <span class="calculation-context">
                                            Iluminancia perpendicular (Adaptativamente)<br>
                                            Altura: {{ $formatNumber($detail['usefulPlaneHeight'] ?? null, 3, ' m') }},
                                            Zona marginal:
                                            {{ $formatNumber($detail['marginalZone'] ?? null, 3, ' m') }}
                                        </span>
                                    </td>
                                    <td class="number">{{ $formatNumber($detail['avgLux'], 2) }} lx
                                        ({{ $formatNumber($detail['targetLux'], 0) }} lx)</td>
                                    <td class="number">{{ $formatNumber($detail['minLux'], 2) }} lx</td>
                                    <td class="number">{{ $formatNumber($detail['maxLux'], 2) }} lx</td>
                                    <td class="number">{{ $formatNumber($detail['uniformity'], 3) }}
                                        ({{ $formatNumber($detail['uniformityTarget'], 3) }})</td>
                                    <td class="number">{{ $formatNumber($detail['g2'] ?? null, 3) }}</td>
                                    <td class="number">{{ $detail['calculationIndex'] ?? '-' }}</td>
                                </tr>
                            </tbody>
                        </table>

                        {{-- Plano útil / Iluminancia perpendicular (sub-sección 5, fullplan) --}}
                    @elseif ($page['kind'] === 'ambient-useful-plane')
                        <div class="terrain-full-page">
                            {!! $renderAsset(collect($pageAssets)->first(), 188, 226, true) !!}
                        </div>

                        {{-- Anexo comparativo de escenas lumínicas (Fase 13, §11: "anexos
                             comparativos") — dormido hoy: ninguna UI crea 2+ lightingScenes
                             por nivel, así que este page kind nunca aparece en un informe real
                             todavía; queda listo para cuando esa UI exista. --}}
                    @elseif ($page['kind'] === 'lighting-scene-comparison')
                        @php $sceneComparison = $page['sceneComparison'] ?? null; @endphp
                        @if (is_array($sceneComparison))
                            <p class="ambient-provenance" style="margin-bottom:3mm;">
                                Nivel: {{ $sceneComparison['levelName'] ?? '-' }} &middot;
                                {{ $sceneComparison['baselineSceneName'] ?? '-' }} vs.
                                {{ $sceneComparison['comparisonSceneName'] ?? '-' }}
                            </p>
                            <table class="luminaire-table" style="table-layout:fixed;">
                                <thead>
                                    <tr>
                                        <th style="text-align:left; width:40%;">Objeto</th>
                                        <th class="number" style="width:15%;">&Delta;E avg (lx)</th>
                                        <th class="number" style="width:15%;">&Delta;E min (lx)</th>
                                        <th class="number" style="width:15%;">&Delta;Uo</th>
                                        <th class="number" style="width:15%;">&Delta;UGR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($sceneComparison['entries'] ?? [] as $entry)
                                        <tr>
                                            <td style="text-align:left;">{{ $entry['objectName'] ?? '-' }}</td>
                                            <td class="number">{{ $formatNumber($entry['avgLuxDelta'] ?? null, 1) }}</td>
                                            <td class="number">{{ $formatNumber($entry['minLuxDelta'] ?? null, 1) }}</td>
                                            <td class="number">{{ $formatNumber($entry['uniformityDelta'] ?? null, 3) }}</td>
                                            <td class="number">{{ $formatNumber($entry['ugrDelta'] ?? null, 1) }}</td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="5">Sin objetos en com&uacute;n entre ambas escenas.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        @else
                            <div class="placeholder-box">No hay datos de comparaci&oacute;n disponibles para esta p&aacute;gina.</div>
                        @endif

                        {{-- Informe de alumbrado de EMERGENCIA (Fase 14, §11) — documento
                             DISTINTO del informe normal (puerta de salida: "los resultados
                             de emergencia nunca se confunden con iluminación normal"). --}}
                    @elseif ($page['kind'] === 'emergency-cover')
                        <div class="detail-block-title" style="font-size:14px; margin-bottom:4mm;">{{ $page['title'] }}</div>
                        @foreach ($page['notes'] ?? [] as $note)
                            <p>{{ $note }}</p>
                        @endforeach
                    @elseif ($page['kind'] === 'emergency-compliance-table')
                        @php $emergencyRooms = $page['emergencyRooms'] ?? []; @endphp
                        @if (empty($emergencyRooms))
                            <div class="placeholder-box">Este proyecto no tiene ambientes marcados como ruta de evacuaci&oacute;n o &aacute;rea antip&aacute;nico.</div>
                        @endif
                        @foreach ($emergencyRooms as $emergencyRoom)
                            <div class="ambient-provenance" style="margin-bottom:2mm;">
                                <strong>{{ $emergencyRoom['roomName'] ?? '-' }}</strong>
                                ({{ ($emergencyRoom['roomType'] ?? null) === 'evacuation-route' ? 'Ruta de evacuaci&oacute;n' : 'Área antip&aacute;nico' }})
                                &mdash; Nivel: {{ $emergencyRoom['levelName'] ?? '-' }}
                                @if (!empty($emergencyRoom['criticalPoint']))
                                    &middot; Punto cr&iacute;tico: ({{ $formatNumber($emergencyRoom['criticalPoint']['x'] ?? null, 2) }}, {{ $formatNumber($emergencyRoom['criticalPoint']['y'] ?? null, 2) }})
                                @endif
                            </div>
                            <table class="luminaire-table" style="table-layout:fixed; margin-bottom:4mm;">
                                <thead>
                                    <tr>
                                        <th style="text-align:left; width:40%;">Norma</th>
                                        <th class="number" style="width:20%;">Exigido (lx)</th>
                                        <th class="number" style="width:20%;">Calculado (lx)</th>
                                        <th class="result-check" style="width:20%;">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($emergencyRoom['evaluations'] ?? [] as $evaluation)
                                        <tr>
                                            <td style="text-align:left;">
                                                {{ $evaluation['source'] ?? '-' }}
                                                {{ ($evaluation['mandatory'] ?? false) ? '(obligatoria)' : '(referencia)' }}
                                            </td>
                                            <td class="number">{{ $formatNumber($evaluation['requiredLux'] ?? null, 1) }}</td>
                                            <td class="number">{{ $formatNumber($evaluation['calculatedLux'] ?? null, 1) }}</td>
                                            <td class="result-check">
                                                @php $evalStatus = $evaluation['status'] ?? 'not-evaluated'; @endphp
                                                <span class="verification-status status-{{ e($evalStatus) }}">
                                                    {{ match ($evalStatus) {
                                                        'pass' => 'Conforme',
                                                        'fail' => 'No conforme',
                                                        default => 'No evaluado',
                                                    } }}
                                                </span>
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        @endforeach

                        {{-- Glosario --}}
                    @elseif ($page['kind'] === 'glossary')
                        @php
                            $glossaryFull = $document['glossary'] ?? [];
                            $glossaryRangeStart = $page['rowRangeStart'] ?? 0;
                            $glossaryRangeEnd = $page['rowRangeEnd'] ?? count($glossaryFull);
                            $glossaryPageItems = array_slice(
                                $glossaryFull,
                                $glossaryRangeStart,
                                $glossaryRangeEnd - $glossaryRangeStart,
                            );
                            $glossaryCurrentLetter = null;
                        @endphp
                        @if (empty($glossaryPageItems))
                            <div class="placeholder-box">Este informe no utiliza términos de glosario.</div>
                        @endif
                        <table class="glossary-grid">
                            @foreach ($glossaryPageItems as $entry)
                                @if (($entry['letter'] ?? null) !== $glossaryCurrentLetter)
                                    @php $glossaryCurrentLetter = $entry['letter'] ?? null; @endphp
                                    <tr>
                                        <td colspan="2" class="glossary-letter-heading">{{ $glossaryCurrentLetter }}</td>
                                    </tr>
                                @endif
                                <tr>
                                    <td class="glossary-term">{{ $entry['term'] }}{{ !empty($entry['abbreviation']) ? ' (' . $entry['abbreviation'] . ')' : '' }}</td>
                                    <td class="glossary-definition">{{ $entry['definition'] }}</td>
                                </tr>
                            @endforeach
                        </table>

                        {{-- Fallback para tipos no reconocidos --}}
                    @else
                        <div class="placeholder-box">
                            @forelse ($page['notes'] ?? [] as $note)
                                <div>{{ $note }}</div>
                            @empty
                                <div>Página reservada para contenido técnico del reporte.</div>
                            @endforelse
                        </div>
                    @endif
                </div>

                {!! $renderFooter($page['pageNumber']) !!}
            @endif
        </section>
    @endforeach
</body>
</html>
