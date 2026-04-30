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

$renderAsset = static function (?array $asset): string {
    if (!$asset) {
        return '<div class="asset-align"><div class="asset-placeholder"><span>Grafico no disponible.</span></div></div>';
    }
    if (($asset['kind'] ?? null) === 'vector' && !empty($asset['svg'])) {
        return '<div class="asset-align">' . $asset['svg'] . '</div>';
    }
    if (($asset['kind'] ?? null) === 'bitmap' && !empty($asset['dataUrl'])) {
        return '<div class="asset-align"><img src="' . e($asset['dataUrl']) . '" alt="' . e($asset['title'] ?? 'Asset') . '"></div>';
    }
    return '<div class="asset-align"><div class="asset-placeholder"><span>Asset no compatible.</span></div></div>';
};

$formatNumber = static function ($value, int $decimals = 2, string $suffix = ''): string {
    if ($value === null || $value === '') return '-';
    return number_format((float) $value, $decimals, '.', ',') . $suffix;
};

$renderFooterDate = static function () use ($document): string {
    $generatedAt = $document['generatedAt'] ?? null;
    if (!is_string($generatedAt) || trim($generatedAt) === '') return $document['footer']['right'] ?? '';
    try {
        return 'Exportado ' . \Carbon\Carbon::parse($generatedAt)->timezone('America/Lima')->format('d/m/y H:i');
    } catch (\Throwable $e) {
        return $document['footer']['right'] ?? '';
    }
};

$renderHeader = static function () use ($document): string {
    return '
        <div class="header">
            <div class="row">
                <div class="f-left">' . e($document['header']['title'] ?? '') . '</div>
                <div class="f-right">' . e($document['header']['subtitle'] ?? '') . '</div>
            </div>
            <div class="clear"></div>
        </div>';
};

$renderFooter = static function (int $pageNumber) use ($document, $renderFooterDate): string {
    return '
        <div class="footer">
            <div class="footer-col-left"><span class="footer-brand">' . e($document['footer']['left'] ?? 'DIAlux Web') . '</span></div>
            <div class="footer-col-center">' . e($renderFooterDate()) . '</div>
            <div class="footer-col-right">' . e((string) $pageNumber) . '</div>
            <div class="footer-clear"></div>
        </div>';
};

/* ── Tabla de luminarias ────────────────────────────────────── */
$renderLuminaireTable = static function (array $items, bool $totals = false) use ($document, $formatNumber): string {
    $totalsBox = '';
    if ($totals && !empty($document['luminaireTotals'])) {
        $t = $document['luminaireTotals'];
        $totalsBox = '
            <div class="luminaire-totals-box">
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">&Phi;total</div>
                    <div class="luminaire-totals-value">' . $formatNumber($t['totalLumens'] ?? 0, 0, ' lm') . '</div>
                </div>
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">P<sub>total</sub></div>
                    <div class="luminaire-totals-value">' . $formatNumber($t['totalPowerWatts'] ?? 0, 1, ' W') . '</div>
                </div>
                <div class="luminaire-totals-cell">
                    <div class="luminaire-totals-label">Rendimiento lumínico</div>
                    <div class="luminaire-totals-value">' . $formatNumber($t['overallEfficiency'] ?? 0, 1, ' lm/W') . '</div>
                </div>
            </div>';
    }

    $rows = '';
    foreach ($items as $luminaire) {
        $efficiency = $luminaire['efficiency'] ?? null;
        if ($efficiency === null && ($luminaire['lumens'] ?? 0) > 0 && ($luminaire['powerWatts'] ?? 0) > 0) {
            $efficiency = round($luminaire['lumens'] / $luminaire['powerWatts'], 1);
        }
        $rows .= '
            <tr>
                <td class="number col-unit">' . e((string) ($luminaire['quantity'] ?? 1)) . '</td>
                <td class="col-brand">' . e($luminaire['brand'] ?? '-') . '</td>
                <td class="col-code">' . e($luminaire['articleNumber'] ?? $luminaire['model'] ?? '-') . '</td>
                <td class="col-name">' . e($luminaire['name'] ?? '-') . '</td>
                <td class="number col-power">' . $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') . '</td>
                <td class="number col-flux">' . $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') . '</td>
                <td class="number col-efficiency">' . ($efficiency !== null ? $formatNumber($efficiency, 1, ' lm/W') : '-') . '</td>
            </tr>';
    }

    if ($rows === '') $rows = '<tr><td colspan="7">No hay luminarias registradas.</td></tr>';

    return $totalsBox . '
        <table class="luminaire-table">
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
            <tbody>' . $rows . '</tbody>
        </table>';
};

/* ── Potencia específica ────────────────────────────────────── */
$formatPowerDensity = static function ($powerWatts, $area, $referenceLux) use ($formatNumber): string {
    if ($powerWatts === null || $area === null || (float) $area <= 0) return '-';
    $density = (float) $powerWatts / (float) $area;
    $lines = [$formatNumber($density, 2, ' W/m&sup2;')];
    if ($referenceLux !== null && (float) $referenceLux > 0) {
        $lines[] = $formatNumber($density / ((float) $referenceLux / 100), 2, ' W/m&sup2;/100 lx (&Aacute;rea)');
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
            $rows .= '
                <tr>
                    <td class="number">' . e((string) ($luminaire['quantity'] ?? 1)) . '</td>
                    <td>' . e($luminaire['brand'] ?? '-') . '</td>
                    <td>' . e($luminaire['articleNumber'] ?? $luminaire['model'] ?? '-') . '</td>
                    <td>' . e($luminaire['name'] ?? '-') . '</td>
                    <td class="number">' . $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') . '</td>
                    <td class="number">' . $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') . '</td>
                </tr>';
        }
        if ($rows === '') $rows = '<tr><td colspan="6">No hay luminarias registradas para este ambiente.</td></tr>';

        $targetLux      = $ambient['targetLux'] ?? null;
        $perpendicularLux = $ambient['avgLux'] ?? $targetLux;

        $html .= '
            <div class="ambient-local-block">
                <h3 class="ambient-local-title">' . e(strtoupper((string) ($ambient['ambientName'] ?? 'Ambiente'))) . '</h3>
                <table class="ambient-metric-row">
                    <tr>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">P<sub>total</sub></div>
                            <div class="ambient-metric-value">' . $formatNumber($ambient['totalPowerWatts'] ?? null, 1, ' W') . '</div>
                        </td>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">A<sub>local</sub></div>
                            <div class="ambient-metric-value">' . $formatNumber($ambient['area'] ?? null, 2, ' m&sup2;') . '</div>
                        </td>
                        <td class="ambient-metric-card wide">
                            <div class="ambient-metric-label">Potencia espec&iacute;fica de conexi&oacute;n</div>
                            <div class="ambient-metric-value">' . $formatPowerDensity($ambient['totalPowerWatts'] ?? null, $ambient['area'] ?? null, $targetLux) . '</div>
                        </td>
                        <td class="ambient-metric-card">
                            <div class="ambient-metric-label">E<sub>perpendicular</sub> (Plano &uacute;til)</div>
                            <div class="ambient-metric-value">' . $formatNumber($perpendicularLux, 0, ' lx') . '</div>
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
                    <tbody>' . $rows . '</tbody>
                </table>
            </div>';
    }
    return $html !== '' ? $html : '<div class="placeholder-box">No hay ambientes registrados.</div>';
};

/* ── Tabla de objetos de cálculo ────────────────────────────── */
$renderCalculationObjectsTable = static function ($ambients) use ($formatNumber): string {
    $rows = '';
    foreach ($ambients as $detail) {
        $rows .= '
            <tr>
                <td class="calculation-properties">
                    <strong>Plano &uacute;til (' . e($detail['ambientName'] ?? 'Ambiente') . ')</strong><br>
                    <span class="calculation-context">Recinto: ' . e($detail['roomName'] ?? 'Sin recinto') . '</span><br>
                    Iluminancia perpendicular (Adaptativamente)<br>
                    <span class="calculation-context">Altura: ' . $formatNumber($detail['usefulPlaneHeight'] ?? null, 3, ' m') . ' &middot; Zona marginal: ' . $formatNumber($detail['marginalZone'] ?? null, 3, ' m') . '</span>
                </td>
                <td class="number">' . $formatNumber($detail['avgLux'] ?? null, 0, ' lx') . '<br>(' . $formatNumber($detail['targetLux'] ?? null, 0, ' lx') . ')<span class="calculation-check"></span></td>
                <td class="number">' . $formatNumber($detail['minLux'] ?? null, 1, ' lx') . '</td>
                <td class="number">' . $formatNumber($detail['maxLux'] ?? null, 0, ' lx') . '</td>
                <td class="number">' . $formatNumber($detail['uniformity'] ?? null, 2) . '<br>(' . $formatNumber($detail['uniformityTarget'] ?? null, 2) . ')<span class="calculation-check"></span></td>
                <td class="number">' . $formatNumber($detail['g2'] ?? null, 2) . '</td>
                <td class="number"><span class="calculation-index">' . e($detail['calculationIndex'] ?? '-') . '</span></td>
            </tr>';
    }
    if ($rows === '') $rows = '<tr><td colspan="7">Sin superficies calculadas.</td></tr>';

    return '
        <table class="luminaire-table calculation-table">
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
            <tbody>' . $rows . '</tbody>
        </table>';
};

/* ── Tabla de resultados por ambiente ───────────────────────── */
$renderAmbientResultsTable = static function (array $detail) use ($formatNumber): string {
    $powerDensity = (($detail['totalPowerWatts'] ?? null) !== null && ($detail['area'] ?? 0) > 0)
        ? ((float) $detail['totalPowerWatts'] / (float) $detail['area']) : null;
    $powerDensityPerLux = ($powerDensity !== null && ($detail['targetLux'] ?? 0) > 0)
        ? $powerDensity / ((float) $detail['targetLux'] / 100) : null;
    $consumption = (($detail['totalPowerWatts'] ?? null) !== null)
        ? ((float) $detail['totalPowerWatts'] * 8 * 365 / 1000) : null;

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
                    <td class="result-number">' . $formatNumber($detail['avgLux'] ?? null, 0, ' lx') . '</td>
                    <td class="result-number">&ge; ' . $formatNumber($detail['targetLux'] ?? null, 0, ' lx') . '</td>
                    <td class="result-check"><span class="verification-check"></span></td>
                    <td class="result-number"><span class="calculation-index">' . e($detail['calculationIndex'] ?? '-') . '</span></td>
                </tr>
                <tr>
                    <td>U<sub>o</sub> (g1)</td>
                    <td class="result-number">' . $formatNumber($detail['uniformity'] ?? null, 2) . '</td>
                    <td class="result-number">&ge; ' . $formatNumber($detail['uniformityTarget'] ?? null, 2) . '</td>
                    <td class="result-check"><span class="verification-check"></span></td>
                    <td class="result-number"><span class="calculation-index">' . e($detail['calculationIndex'] ?? '-') . '</span></td>
                </tr>
                <tr>
                    <td>Potencia espec&iacute;fica de conexi&oacute;n</td>
                    <td class="result-number">' . $formatNumber($powerDensity, 2, ' W/m&sup2;') . '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td class="result-number">' . $formatNumber($powerDensityPerLux, 2, ' W/m&sup2;/100 lx') . '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td><strong>Evaluaci&oacute;n del deslumbramiento</strong></td>
                    <td>R<sub>UG, max</sub></td>
                    <td class="result-number">' . $formatNumber($detail['ugr'] ?? null, 0) . '</td>
                    <td class="result-number">&le; ' . $formatNumber($detail['ugrLimit'] ?? null, 0) . '</td>
                    <td class="result-check"><span class="verification-check"></span></td>
                    <td></td>
                </tr>
                <tr>
                    <td><strong>Valores de consumo</strong></td>
                    <td>Consumo</td>
                    <td class="result-number">' . $formatNumber($consumption, 0, ' kWh/a') . '</td>
                    <td class="result-number">m&aacute;x. 150 kWh/a</td>
                    <td class="result-check"><span class="verification-check"></span></td>
                    <td></td>
                </tr>
                <tr>
                    <td rowspan="2"><strong>&Aacute;rea</strong></td>
                    <td>Potencia espec&iacute;fica de conexi&oacute;n</td>
                    <td class="result-number">' . $formatNumber($powerDensity, 2, ' W/m&sup2;') . '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td class="result-number">' . $formatNumber($powerDensityPerLux, 2, ' W/m&sup2;/100 lx') . '</td>
                    <td class="result-number">-</td>
                    <td></td>
                    <td></td>
                </tr>
            </tbody>
        </table>
        <div class="ambient-note">
            (1) Valores calculados desde los resultados almacenados del ambiente.<br>
            (2) Consumo estimado para una jornada referencial de 8 h/d&iacute;a.
        </div>';
};

/* ── Fichas de producto por ambiente ────────────────────────── */
$renderAmbientProductCards = static function (array $detail, $pageAssets) use ($formatNumber, $renderAsset): string {
    $html = '';
    foreach (($detail['luminaires'] ?? []) as $luminaire) {
        $photoAsset       = collect($pageAssets)->firstWhere('id', $luminaire['productPhotoAssetId'] ?? null);
        $logoAsset        = collect($pageAssets)->firstWhere('id', $luminaire['brandLogoAssetId'] ?? null);
        $lineDrawingAsset = collect($pageAssets)->firstWhere('id', $luminaire['lineDrawingAssetId'] ?? null);
        $polarAsset       = collect($pageAssets)->firstWhere('id', $luminaire['polarDiagramAssetId'] ?? null);
        $imageAsset       = is_array($photoAsset) ? $photoAsset : (is_array($lineDrawingAsset) ? $lineDrawingAsset : null);
        $hasPolarAsset    = is_array($polarAsset);
        $isCompact        = !$imageAsset && !$hasPolarAsset;

        $html .= '
            <div class="product-sheet-card' . ($isCompact ? ' compact' : '') . '">
                <div class="product-sheet-header">
                    <h3>' . e($luminaire['name'] ?? '-') . '</h3>
                    <p>' . e($luminaire['brand'] ?? 'Fabricante no definido') . '</p>
                </div>
                <div class="product-sheet-left-col">
                    ' . (is_array($logoAsset) ? '<div class="product-image-container" style="height:18mm;">' . $renderAsset($logoAsset) . '</div>' : '') . '
                    ' . ($imageAsset ? '<div class="product-image-container">' . $renderAsset($imageAsset) . '</div>' : '') . '
                    <table class="product-table">
                        <tr><th>N&deg; de art&iacute;culo</th><td>' . e($luminaire['articleNumber'] ?? '-') . '</td></tr>
                        <tr><th>P</th><td>' . $formatNumber($luminaire['powerWatts'] ?? null, 1, ' W') . '</td></tr>
                        <tr><th>&Phi;<sub>Luminaria</sub></th><td>' . $formatNumber($luminaire['lumens'] ?? null, 0, ' lm') . '</td></tr>
                        <tr><th>Rendimiento</th><td>' . $formatNumber($luminaire['efficiency'] ?? null, 1, ' lm/W') . '</td></tr>
                    </table>
                </div>
                ' . ($hasPolarAsset ? '<div class="product-sheet-right-col"><div class="polar-diagram-container">' . $renderAsset($polarAsset) . '</div></div>' : '') . '
                <div class="clear"></div>
            </div>';
    }
    return $html !== '' ? $html : '<div class="placeholder-box">No hay productos registrados para este ambiente.</div>';
};
@endphp

{{-- ════════════════════════════════════════════════════════
     PÁGINAS
     ════════════════════════════════════════════════════════ --}}
@foreach ($pages as $page)
@php
    $pageAssets  = is_array($page['assets'] ?? null) ? $page['assets'] : [];
    $summaryAsset = collect($pageAssets)->first(fn(array $a): bool =>
        ($a['kind'] ?? null) === 'structured' && ($a['data']['type'] ?? null) === 'summary'
    );
    $summaryItems = is_array($summaryAsset['data']['items'] ?? null) ? $summaryAsset['data']['items'] : [];
    $overviewAsset = collect($pageAssets)->first(fn(array $a): bool =>
        in_array($a['id'] ?? '', ['viewer-capture', 'cad-overview-svg', 'formal-cover-svg'], true) ||
        in_array($a['purpose'] ?? null, ['cad-overview', 'viewer-capture'], true)
    );
    $coverVisual = collect($pageAssets)->firstWhere('id', 'viewer-capture-3d')
        ?? collect($pageAssets)->firstWhere('id', 'formal-cover-svg')
        ?? collect($pageAssets)->firstWhere('id', 'viewer-capture')
        ?? collect($pageAssets)->first();
@endphp

<section class="page {{ $page['kind'] === 'cover' ? 'cover-page' : '' }}">
    <div class="watermark">HYPERIUMTECH</div>

    {{-- ══ PORTADA ══════════════════════════════════════════ --}}
    @if ($page['kind'] === 'cover')
        <div class="cover-shell">

            {{-- Barra superior --}}
            <div class="cover-top-bar">
                <div class="cover-brand">HYPERIUMTECH</div>
                <div class="cover-project-tag">DIAlux Web · Reporte formal de iluminación</div>
            </div>

            {{-- Bloque de información: título + metadatos + resumen --}}
            <div class="cover-info">
                <div class="cover-info-left">
                    <h1 class="cover-title">{{ $document['title'] }}</h1>
                    @if (!empty($document['subtitle']))
                        <p class="cover-subtitle">{{ $document['subtitle'] }}</p>
                    @endif
                    <table class="meta-grid">
                        @foreach ($document['metadata'] as $meta)
                            <tr>
                                <td class="meta-label">{{ $meta['label'] }}</td>
                                <td class="meta-value">{{ $meta['value'] }}</td>
                            </tr>
                        @endforeach
                    </table>
                </div>
                <div class="cover-info-right">
                    <div class="cover-exec-box">
                        <p class="cover-exec-title">Resumen ejecutivo</p>
                        <p>Informe técnico de iluminación preparado para revisión y aprobación.
                           Incluye síntesis del proyecto, inventario de luminarias y criterios técnicos.</p>
                        <p>La portada asegura que toda la información principal quede en una sola hoja.</p>
                    </div>
                </div>
                <div class="clear"></div>
            </div>

            {{-- Imagen 3D — ocupa TODO el espacio restante de la página --}}
            <div class="cover-image-wrap">
                @if (is_array($coverVisual))
                    {!! $renderAsset($coverVisual) !!}
                @else
                    <div class="cover-image-empty"></div>
                @endif
            </div>

        </div>

    {{-- ══ PÁGINAS INTERNAS ═════════════════════════════════ --}}
    @else
        {!! $renderHeader() !!}

        <div class="page-body">
            <h2 class="section-title">{{ $page['title'] }}</h2>
            @if (!empty($page['subtitle']))
                <p class="section-subtitle">{{ $page['subtitle'] }}</p>
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
                        <div class="asset-box-base asset-md">
                            {!! $renderAsset(is_array($overviewAsset) ? $overviewAsset : null) !!}
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
                    $chunkIndex = (int) (collect($tocPages)->search(
                        fn(array $tocPage): bool => $tocPage['id'] === $page['id'],
                    ) ?: 0);
                    $chunk = $tocChunks[$chunkIndex] ?? [];
                    $dots  = str_repeat('.', 300);
                @endphp
                @foreach ($chunk as $entry)
                    @php $kind = $entry['kind'] ?? 'item'; @endphp
                    @if ($kind === 'section-label')
                        <div class="toc-section-label">{{ $entry['title'] }}</div>
                    @elseif ($kind === 'section-heading')
                        <div class="toc-section-heading {{ ($entry['size'] ?? 'large') === 'small' ? 'small' : '' }}">
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
                            <div style="margin:-1mm 0 2mm {{ ($entry['level'] ?? 0) > 0 ? '6mm' : '0' }};color:#64748b;font-size:9px;line-height:1.3;">
                                {{ $entry['subtitle'] }}
                            </div>
                        @endif
                    @endif
                @endforeach

            {{-- Lista global de luminarias --}}
            @elseif ($page['kind'] === 'luminaire-list')
                {!! $renderLuminaireTable($document['luminaires'] ?? [], true) !!}

            {{-- Ficha de producto individual --}}
            @elseif ($page['kind'] === 'product-sheet')
                @php
                    $luminaireId      = str_replace('product-sheet:', '', $page['sectionId']);
                    $lum              = collect($document['luminaires'])->firstWhere('id', $luminaireId);
                    $photoAsset       = collect($pageAssets)->firstWhere('id', $lum['productPhotoAssetId'] ?? null);
                    $logoAsset        = collect($pageAssets)->firstWhere('id', $lum['brandLogoAssetId'] ?? null);
                    $lineDrawingAsset = collect($pageAssets)->firstWhere('id', $lum['lineDrawingAssetId'] ?? null);
                    $polarDiagramAsset = collect($pageAssets)->firstWhere('id', $lum['polarDiagramAssetId'] ?? null);
                    $technicalRows    = $lum['reportData']['technical_table'] ?? null;
                @endphp
                <div class="product-sheet-card">
                    @if ($lum)
                        <div class="product-sheet-header">
                            <h3>{{ $lum['brand'] ?? 'Fabricante no especificado' }} &mdash; {{ $lum['name'] }}</h3>
                            <p>Potencia: {{ $formatNumber($lum['powerWatts'] ?? null, 1, ' W') }} &bull; CCT: {{ ($lum['cct'] ?? null) ? $lum['cct'].' K' : '-' }}</p>
                        </div>
                        <div class="row">
                            <div class="product-sheet-left-col">
                                @if ($logoAsset)
                                    <div class="product-image-container" style="height:18mm;">
                                        {!! $renderAsset(is_array($logoAsset) ? $logoAsset : null) !!}
                                    </div>
                                @endif
                                @if ($photoAsset || $lineDrawingAsset)
                                    <div class="product-image-container">
                                        {!! $renderAsset(is_array($photoAsset) ? $photoAsset : (is_array($lineDrawingAsset) ? $lineDrawingAsset : null)) !!}
                                    </div>
                                @endif
                                <table class="product-table">
                                    @if (is_array($technicalRows) && count($technicalRows) > 0)
                                        @foreach ($technicalRows as $row)
                                            <tr><th>{{ $row['label'] ?? '-' }}</th><td>{{ $row['value'] ?? '-' }}</td></tr>
                                        @endforeach
                                    @else
                                        <tr><th>N&deg; art.</th><td>{{ $lum['articleNumber'] ?? $lum['model'] ?? '-' }}</td></tr>
                                        <tr><th>P</th><td>{{ $formatNumber($lum['powerWatts'] ?? null, 1, ' W') }}</td></tr>
                                        <tr><th>Flujo luminoso</th><td>{{ $formatNumber($lum['lumens'] ?? null, 0, ' lm') }}</td></tr>
                                        <tr><th>Rendimiento</th><td>{{ $lum['efficiency'] ? $formatNumber($lum['efficiency'], 1, ' lm/W') : '-' }}</td></tr>
                                        <tr><th>CCT</th><td>{{ ($lum['cct'] ?? null) ? $lum['cct'].' K' : '-' }}</td></tr>
                                        <tr><th>CRI</th><td>{{ $lum['cri'] ?? '-' }}</td></tr>
                                    @endif
                                </table>
                                @if (!empty($lum['description']))
                                    <div style="margin-bottom:2mm;">
                                        <strong style="font-size:9px;color:#0f172a;">Descripción:</strong><br>
                                        <span style="color:#475569;font-size:9px;line-height:1.4;">{{ $lum['description'] }}</span>
                                    </div>
                                @endif
                                @if (!empty($lum['applications']))
                                    <div style="margin-bottom:2mm;">
                                        <strong style="font-size:9px;color:#0f172a;">Aplicaciones:</strong><br>
                                        <span style="color:#475569;font-size:9px;line-height:1.4;">{{ $lum['applications'] }}</span>
                                    </div>
                                @endif
                            </div>
                            <div class="product-sheet-right-col">
                                <div class="polar-diagram-container">
                                    {!! $renderAsset(is_array($polarDiagramAsset) ? $polarDiagramAsset : null) !!}
                                </div>
                                <div class="detail-block-title" style="margin-bottom:2mm;">Evaluación del deslumbramiento según UGR</div>
                                @if (!empty($lum['ugrDiagramValue']) || !empty($lum['ugrTable']))
                                    <div class="placeholder-box">
                                        {{ $lum['ugrDiagramValue'] ?? 'Tabla UGR estructurada proporcionada' }}
                                    </div>
                                @else
                                    <div class="placeholder-box">Información UGR no disponible</div>
                                @endif
                            </div>
                        </div>
                        <div class="clear"></div>
                    @else
                        <p>No se encontró la luminaria.</p>
                    @endif
                </div>

            {{-- Lista de ambientes --}}
            @elseif ($page['kind'] === 'ambient-list')
                <div class="detail-block-title" style="margin-bottom:2mm;">Lista de locales / Escena de luz 1</div>
                {!! $renderAmbientLocalBlocks($document['ambientDetails'] ?? []) !!}

            {{-- Plano CAD — imagen llena toda la página --}}
            @elseif ($page['kind'] === 'terrain-cad')
                @php
                    $cadAsset = collect($pageAssets)->firstWhere('id', 'viewer-capture')
                             ?? collect($pageAssets)->firstWhere('id', 'cad-base-bitmap')
                             ?? collect($pageAssets)->firstWhere('id', 'cad-overview-svg')
                             ?? collect($pageAssets)->first();
                @endphp
                @if (is_array($cadAsset))
                    <div class="terrain-full">
                        {!! $renderAsset($cadAsset) !!}
                    </div>
                @else
                    <div class="placeholder-box">Plano CAD no disponible en esta exportación.</div>
                @endif

            {{-- Plano arquitectónico — imagen llena toda la página --}}
            @elseif ($page['kind'] === 'terrain-architectural')
                @php
                    $drawnTerrain = collect($pageAssets)->firstWhere('id', 'viewer-capture')
                                 ?? collect($pageAssets)->firstWhere('id', 'drawn-terrain-svg')
                                 ?? collect($pageAssets)->firstWhere('id', 'cad-base-bitmap')
                                 ?? collect($pageAssets)->first();
                @endphp
                @if (is_array($drawnTerrain))
                    <div class="terrain-full">
                        {!! $renderAsset($drawnTerrain) !!}
                    </div>
                @else
                    <div class="placeholder-box">Plano Arquitectónico no disponible en esta exportación.</div>
                @endif

            {{-- Recinto: plan + tabla de ambientes --}}
            @elseif ($page['kind'] === 'room-ambient-list')
                @php
                    $roomAmbients = collect($document['ambientDetails'] ?? [])->filter(fn($a) => $a['roomId'] === ($page['roomId'] ?? null));
                    $drawnAsset   = collect($pageAssets)->first();
                @endphp
                @if ($drawnAsset)
                    <div class="terrain-plan-wrap">
                        {!! $renderAsset(is_array($drawnAsset) ? $drawnAsset : null) !!}
                    </div>
                @endif
                <div class="detail-block-title" style="margin-bottom:2mm;">Lista de locales / Escena de luz 1</div>
                <table class="luminaire-table">
                    <thead>
                        <tr>
                            <th>Local</th>
                            <th class="number">P total</th>
                            <th class="number">A local</th>
                            <th class="number">Potencia</th>
                            <th class="number">E perpendicular</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($roomAmbients as $ambient)
                            <tr>
                                <td>{{ $ambient['roomName'] }} &gt; {{ $ambient['ambientName'] }}</td>
                                <td class="number">{{ $formatNumber($ambient['totalPowerWatts'], 1, ' W') }}</td>
                                <td class="number">{{ $formatNumber($ambient['area'], 2, ' m²') }}</td>
                                <td class="number">{{ $formatNumber($ambient['totalPowerWatts'], 1, ' W') }}</td>
                                <td class="number">{{ $formatNumber($ambient['avgLux'] ?? null, 2, ' lx') }} ({{ $formatNumber($ambient['targetLux'], 0, ' lx') }})</td>
                            </tr>
                        @empty
                            <tr><td colspan="5">No hay ambientes registrados para este recinto.</td></tr>
                        @endforelse
                    </tbody>
                </table>

            {{-- Recinto: luminarias --}}
            @elseif ($page['kind'] === 'room-luminaires')
                @php
                    $roomAmbients  = collect($document['ambientDetails'] ?? [])->filter(fn($a) => $a['roomId'] === ($page['roomId'] ?? null));
                    $roomLuminaires = $roomAmbients->pluck('luminaires')->flatten(1)->unique('id')->all();
                @endphp
                {!! $renderLuminaireTable($roomLuminaires, false) !!}

            {{-- Recinto: objeto de cálculo --}}
            @elseif ($page['kind'] === 'room-calculation-object')
                @php
                    $roomAmbients = collect($document['ambientDetails'] ?? [])->filter(fn($a) => $a['roomId'] === ($page['roomId'] ?? null));
                @endphp
                <div class="detail-block-title" style="margin-bottom:2mm;">Objetos de c&aacute;lculo / Escena de luz 1</div>
                {!! $renderCalculationObjectsTable($roomAmbients) !!}

            {{-- Lista global de objetos de cálculo --}}
            @elseif ($page['kind'] === 'calculation-object-list')
                @php $drawnAsset = collect($pageAssets)->first(); @endphp
                @if ($drawnAsset)
                    <div class="terrain-plan-wrap">
                        {!! $renderAsset(is_array($drawnAsset) ? $drawnAsset : null) !!}
                    </div>
                @endif
                <div class="detail-block-title" style="margin-bottom:2mm;">Planos &uacute;tiles</div>
                {!! $renderCalculationObjectsTable($document['ambientDetails'] ?? []) !!}

            {{-- Resumen de ambiente --}}
            @elseif ($page['kind'] === 'ambient-summary' && !empty($page['ambientDetail']))
                @php $detail = $page['ambientDetail']; @endphp
                <div class="ambient-summary-left">
                    <div class="detail-block-title">Resultados lum&iacute;nicos</div>
                    <table class="metric-grid">
                        <tr><td class="metric-label">Recinto asociado</td><td class="metric-value">{{ $detail['roomName'] }}</td></tr>
                        <tr><td class="metric-label">Perfil de actividad</td><td class="metric-value">{{ $detail['activity'] ?? 'No especificada' }}</td></tr>
                        <tr><td class="metric-label">&Aacute;rea del plano &uacute;til</td><td class="metric-value">{{ $formatNumber($detail['area'], 2, ' m²') }}</td></tr>
                        <tr><td class="metric-label">Lux objetivo (Em) / calculados</td><td class="metric-value">{{ $formatNumber($detail['targetLux'], 0) }} / {{ $formatNumber($detail['avgLux'], 2) }}</td></tr>
                        <tr><td class="metric-label">Emin / Emax</td><td class="metric-value">{{ $formatNumber($detail['minLux'], 0) }} / {{ $formatNumber($detail['maxLux'], 0) }} lx</td></tr>
                        <tr><td class="metric-label">Uniformidad (Uo) / referencia</td><td class="metric-value">{{ $formatNumber($detail['uniformity'], 3) }} / {{ $formatNumber($detail['uniformityTarget'], 3) }}</td></tr>
                        <tr><td class="metric-label">UGR m&aacute;x. admitido / calculado</td><td class="metric-value">{{ $formatNumber($detail['ugrLimit'], 0) }} / {{ $formatNumber($detail['ugr'], 2) }}</td></tr>
                        <tr><td class="metric-label">L&uacute;menes req. / disponibles</td><td class="metric-value">{{ $formatNumber($detail['lumensRequired'], 0, ' lm') }} / {{ $formatNumber($detail['fixtureLumens'], 0, ' lm') }}</td></tr>
                        <tr><td class="metric-label">Potencia total instalada</td><td class="metric-value">{{ $formatNumber($detail['totalPowerWatts'], 1, ' W') }}</td></tr>
                        <tr>
                            <td class="metric-label">Evaluaci&oacute;n general</td>
                            <td class="metric-value" style="color:{{ $detail['complianceLabel'] === 'Cumple' ? '#16a34a' : '#dc2626' }};font-weight:bold;">
                                {{ $detail['complianceLabel'] }}
                            </td>
                        </tr>
                    </table>
                </div>
                <div class="ambient-summary-right">
                    <div class="detail-block-title">Consumo y cobertura</div>
                    <table class="metric-grid">
                        <tr><td class="metric-label">Luminarias propuestas</td><td class="metric-value">{{ $formatNumber($detail['fixtureCount'], 0) }}</td></tr>
                        <tr><td class="metric-label">Cant. exacta / redondeada</td><td class="metric-value">{{ $formatNumber($detail['exactQuantity'], 2) }} / {{ $formatNumber($detail['roundedQuantity'], 0) }}</td></tr>
                        <tr><td class="metric-label">Cobertura</td><td class="metric-value">{{ $detail['coverage'] }}</td></tr>
                    </table>
                </div>
                <div class="clear"></div>

            {{-- Plano de situación de luminarias --}}
            @elseif ($page['kind'] === 'ambient-plan')
                @php
                    $detail    = $page['ambientDetail'] ?? null;
                    $planAsset = collect($pageAssets)->firstWhere('id', $detail['planAssetId'] ?? null) ?? collect($pageAssets)->first();
                    $firstLuminaire       = is_array($detail['luminaires'][0] ?? null) ? $detail['luminaires'][0] : null;
                    $photoAsset           = $firstLuminaire ? collect($pageAssets)->firstWhere('id', $firstLuminaire['productPhotoAssetId'] ?? null) : null;
                    $logoAsset            = $firstLuminaire ? collect($pageAssets)->firstWhere('id', $firstLuminaire['brandLogoAssetId'] ?? null) : null;
                    $lineDrawingAsset     = $firstLuminaire ? collect($pageAssets)->firstWhere('id', $firstLuminaire['lineDrawingAssetId'] ?? null) : null;
                    $polarAsset           = $firstLuminaire ? collect($pageAssets)->firstWhere('id', $firstLuminaire['polarDiagramAssetId'] ?? null) : null;
                    $situationVisualAssets = collect([$logoAsset, $photoAsset, $lineDrawingAsset, $polarAsset])->filter(fn($a) => is_array($a))->values();
                @endphp
                <div class="detail-block-title" style="margin-bottom:2mm;">Plano de situaci&oacute;n de luminarias</div>
                @if ($detail && $firstLuminaire)
                    <div class="situation-product-layout {{ $situationVisualAssets->isEmpty() ? 'no-media' : '' }}">
                        <div class="situation-product-left">
                            @if ($situationVisualAssets->isNotEmpty())
                                <div class="situation-product-assets">
                                    @foreach ($situationVisualAssets as $visualAsset)
                                        <div class="situation-product-asset {{ $situationVisualAssets->count() <= 2 ? 'single' : '' }}">
                                            {!! $renderAsset(is_array($visualAsset) ? $visualAsset : null) !!}
                                        </div>
                                    @endforeach
                                    <div class="clear"></div>
                                </div>
                            @endif
                            <table class="product-table">
                                <tr><th>Fabricante</th><td>{{ $firstLuminaire['brand'] ?? '-' }}</td></tr>
                                <tr><th>N&deg; de art&iacute;culo</th><td>{{ $firstLuminaire['articleNumber'] ?? '-' }}</td></tr>
                                <tr><th>Nombre del art&iacute;culo</th><td>{{ $firstLuminaire['name'] ?? '-' }}</td></tr>
                                <tr><th>L&aacute;mpara</th><td>{{ $firstLuminaire['name'] ?? '-' }}</td></tr>
                            </table>
                        </div>
                        <div class="situation-product-right">
                            <table class="product-table">
                                <tr><th>P</th><td>{{ $formatNumber($firstLuminaire['powerWatts'] ?? null, 1, ' W') }}</td></tr>
                                <tr><th>&Phi;<sub>Luminaria</sub></th><td>{{ $formatNumber($firstLuminaire['lumens'] ?? null, 0, ' lm') }}</td></tr>
                            </table>
                            <div class="ambient-asset-container" style="height:70mm;">
                                {!! $renderAsset(is_array($planAsset) ? $planAsset : null) !!}
                            </div>
                        </div>
                        <div class="clear"></div>
                    </div>
                    <div class="fixture-position-title">{{ count($detail['fixturePositions'] ?? []) }} x {{ $firstLuminaire['brand'] ?? '-' }} {{ $firstLuminaire['name'] ?? '-' }}</div>
                    <table class="luminaire-table">
                        <thead>
                            <tr>
                                <th>Tipo</th>
                                <th class="number">X</th>
                                <th class="number">Y</th>
                                <th class="number">Altura de montaje</th>
                                <th class="number">Luminaria</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($detail['fixturePositions'] ?? [] as $position)
                                <tr>
                                    <td>{{ $position['name'] ?? 'Luminaria' }}</td>
                                    <td class="number">{{ $formatNumber($position['x'] ?? null, 3, ' m') }}</td>
                                    <td class="number">{{ $formatNumber($position['y'] ?? null, 3, ' m') }}</td>
                                    <td class="number">{{ $formatNumber($position['mountingHeight'] ?? null, 3, ' m') }}</td>
                                    <td class="number"><span class="calculation-index">{{ $loop->iteration }}</span></td>
                                </tr>
                            @empty
                                <tr><td colspan="5">No hay posiciones de luminarias registradas.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
                @else
                    <div class="ambient-empty-note">
                        Ambiente sin luminarias asignadas. Se mantiene en el reporte como ambiente independiente para resultados, verificaci&oacute;n y objeto de c&aacute;lculo.
                    </div>
                    <div class="ambient-asset-container">
                        {!! $renderAsset(is_array($planAsset) ? $planAsset : null) !!}
                    </div>
                @endif

            {{-- Luminarias por ambiente --}}
            @elseif ($page['kind'] === 'ambient-luminaires' && !empty($page['ambientDetail']))
                {!! $renderLuminaireTable($page['ambientDetail']['luminaires'] ?? [], false) !!}

            {{-- Resultados por ambiente --}}
            @elseif ($page['kind'] === 'ambient-results' && !empty($page['ambientDetail']))
                {!! $renderAmbientResultsTable($page['ambientDetail']) !!}

            {{-- Fichas de productos por ambiente --}}
            @elseif ($page['kind'] === 'ambient-products' && !empty($page['ambientDetail']))
                <div class="detail-block-title" style="margin-bottom:2mm;">Productos usados en el ambiente</div>
                {!! $renderAmbientProductCards($page['ambientDetail'], $pageAssets) !!}

            {{-- Objetos de cálculo por ambiente --}}
            @elseif ($page['kind'] === 'ambient-calculation-object' && !empty($page['ambientDetail']))
                @php $detail = $page['ambientDetail']; @endphp
                <div class="detail-block-title" style="margin-bottom:2mm;">Superficies de cálculo</div>
                <table class="luminaire-table calculation-table">
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
                                <span class="calculation-context">Recinto: {{ $detail['roomName'] ?? 'Sin recinto' }}</span><br>
                                <span class="calculation-context">
                                    Iluminancia perpendicular (Adaptativamente)<br>
                                    Altura: {{ $formatNumber($detail['usefulPlaneHeight'] ?? null, 3, ' m') }},
                                    Zona marginal: {{ $formatNumber($detail['marginalZone'] ?? null, 3, ' m') }}
                                </span>
                            </td>
                            <td class="number">{{ $formatNumber($detail['avgLux'], 2) }} lx ({{ $formatNumber($detail['targetLux'], 0) }} lx)</td>
                            <td class="number">{{ $formatNumber($detail['minLux'], 2) }} lx</td>
                            <td class="number">{{ $formatNumber($detail['maxLux'], 2) }} lx</td>
                            <td class="number">{{ $formatNumber($detail['uniformity'], 3) }} ({{ $formatNumber($detail['uniformityTarget'], 3) }})</td>
                            <td class="number">{{ $formatNumber($detail['g2'] ?? null, 3) }}</td>
                            <td class="number">{{ $detail['calculationIndex'] ?? '-' }}</td>
                        </tr>
                    </tbody>
                </table>

            {{-- Plano útil del ambiente --}}
            @elseif ($page['kind'] === 'ambient-useful-plane')
                <div class="ambient-asset-container">
                    {!! $renderAsset(collect($pageAssets)->first()) !!}
                </div>

            {{-- Glosario --}}
            @elseif ($page['kind'] === 'glossary')
                <table class="glossary-grid">
                    <tr>
                        <td class="glossary-term">Em (lx)</td>
                        <td class="glossary-definition">Iluminancia media mantenida en la superficie de referencia (plano útil). Representa el valor promedio de lux calculado sobre toda el área, considerando la depreciación de las luminarias.</td>
                    </tr>
                    <tr>
                        <td class="glossary-term">Emin / Emax</td>
                        <td class="glossary-definition">Iluminancia mínima y máxima calculada respectivamente en la grilla del plano de evaluación. Identifica los puntos más oscuros y brillantes del local.</td>
                    </tr>
                    <tr>
                        <td class="glossary-term">Uo (Uniformidad)</td>
                        <td class="glossary-definition">Uniformidad general de iluminancias (Uo = Emin / Em). Evalúa si la luz se distribuye de forma pareja o si existen caídas bruscas. La normativa exige valores referenciales según perfil del local.</td>
                    </tr>
                    <tr>
                        <td class="glossary-term">UGR</td>
                        <td class="glossary-definition">Unified Glare Rating. Índice para prever la probabilidad de que una instalación de iluminación interior produzca un deslumbramiento molesto en la visión de los usuarios (valores menores indican menor deslumbramiento).</td>
                    </tr>
                    <tr>
                        <td class="glossary-term">Flujo luminoso (lm)</td>
                        <td class="glossary-definition">Cantidad total de luz emitida por la luminaria en todas las direcciones. Dato base para estimar la cantidad de luminarias necesarias para alcanzar el E objetivo.</td>
                    </tr>
                    <tr>
                        <td class="glossary-term">Plano útil</td>
                        <td class="glossary-definition">Superficie imaginaria sobre la cual se espera tener la iluminación requerida para desempeñar una actividad. Generalmente se ajusta entre 0.75m a 0.85m del suelo.</td>
                    </tr>
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
