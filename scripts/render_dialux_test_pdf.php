<?php

/**
 * Renderiza el payload de prueba (storage/app/dialux-test-payload.json) con la
 * misma lógica del controlador formalExport y guarda el PDF en
 * storage/app/dialux-test.pdf para inspección visual.
 *
 * LIMITACION CONOCIDA: NO replica el split portrait/landscape + merge con
 * FPDI que hace Editor2DController::formalExport() desde Fase 10 (fix del
 * bug de paginas apaisadas que dompdf no rota). Este script genera un solo
 * PDF con setPaper('a4','portrait'), asi que cualquier pagina landscape
 * (plano general, listas de ambientes/objetos de calculo) saldra recortada
 * aqui aunque el endpoint real ya no tenga ese problema. Para verificar el
 * render real end-to-end, usar un test Pest que pegue al endpoint real.
 *
 * Uso: php scripts/render_dialux_test_pdf.php
 */

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$payloadPath = __DIR__.'/../storage/app/dialux-test-payload.json';
if (! file_exists($payloadPath)) {
    fwrite(STDERR, "No existe el payload: {$payloadPath}\n");
    exit(1);
}

$payload = json_decode(file_get_contents($payloadPath), true);
$document = $payload['document'];

$assetsById = collect($document['assets'] ?? [])->keyBy('id');
$ambientDetailsById = collect($document['ambientDetails'] ?? [])->keyBy('ambientId');
$levelsBySceneId = collect($document['levels'] ?? [])->keyBy('sceneId');
$pages = collect($document['pages'] ?? [])
    ->sortBy('pageNumber')
    ->map(function (array $page) use ($assetsById, $ambientDetailsById, $levelsBySceneId): array {
        $pageAssets = collect($page['assetIds'] ?? [])
            ->map(fn (string $assetId): ?array => $assetsById->get($assetId))
            ->filter()
            ->values()
            ->all();

        if (($page['kind'] ?? null) === 'ambient-detail') {
            $page['kind'] = 'ambient-summary';
        }

        $page['assets'] = $pageAssets;
        $page['ambientDetail'] = isset($page['ambientId'])
            ? $ambientDetailsById->get($page['ambientId'])
            : null;
        $page['levelSummary'] = isset($page['sceneId'])
            ? $levelsBySceneId->get($page['sceneId'])
            : null;

        return $page;
    })
    ->values()
    ->all();

$tocPages = collect($pages)->where('kind', 'toc')->values()->all();
$contentPages = collect($pages)
    ->reject(fn (array $page): bool => $page['kind'] === 'cover' || $page['kind'] === 'toc')
    ->values()
    ->all();
$coverPage = collect($pages)->firstWhere('kind', 'cover');
$coverAsset = collect($coverPage['assetIds'] ?? [])
    ->map(fn (string $assetId): ?array => $assetsById->get($assetId))
    ->first();

$pdf = Pdf::loadView('dialux.export.formal-pdf', [
    'document' => $document,
    'pages' => $pages,
    'coverAsset' => $coverAsset,
    'tocPages' => $tocPages,
    'contentPages' => $contentPages,
    'tocChunks' => collect($document['toc'] ?? [])->chunk(24)->values()->all(),
])
    ->setPaper('a4', 'portrait')
    ->setOptions([
        'isHtml5ParserEnabled' => true,
        'isCssFloatEnabled' => true,
        'isRemoteEnabled' => false,
        'defaultFont' => 'DejaVu Sans',
        'dpi' => 96,
        'debugKeepTemp' => false,
    ]);

$outPath = __DIR__.'/../storage/app/dialux-test.pdf';
file_put_contents($outPath, $pdf->output());

echo 'PDF generado: '.$outPath.' ('.number_format(filesize($outPath) / 1024, 1)." KB)\n";
