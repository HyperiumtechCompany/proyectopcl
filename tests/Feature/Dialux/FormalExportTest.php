<?php

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('authenticated users can export a formal dialux pdf', function () {
    $user = User::factory()->create();

    $payload = [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'fileBaseName' => 'proyecto-demo-reporte-formal',
            'generatedAt' => now()->toIso8601String(),
            'header' => [
                'title' => 'Proyecto Demo',
                'subtitle' => 'Planta Baja',
            ],
            'footer' => [
                'left' => 'DIAlux Web',
                'right' => now()->format('Y-m-d'),
            ],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
                ['label' => 'Escena', 'value' => 'Planta Baja'],
            ],
            'pages' => [
                [
                    'id' => 'page-cover',
                    'kind' => 'cover',
                    'sectionId' => 'cover',
                    'pageNumber' => 1,
                    'title' => 'Portada',
                    'subtitle' => 'Planta Baja',
                    'assetIds' => ['formal-cover-svg'],
                    'notes' => [],
                ],
                [
                    'id' => 'page-preliminary-observations',
                    'kind' => 'preliminary-observations',
                    'sectionId' => 'preliminary-observations',
                    'pageNumber' => 2,
                    'title' => 'Observaciones preliminares',
                    'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                    'assetIds' => ['project-summary-data'],
                    'notes' => [
                        'Objetivo del estudio: documentar en formato formal el estado del modelado luminico.',
                    ],
                ],
                [
                    'id' => 'page-content-1',
                    'kind' => 'toc',
                    'sectionId' => 'content',
                    'pageNumber' => 3,
                    'title' => 'Contenido',
                    'subtitle' => 'Indice del documento',
                    'assetIds' => [],
                    'notes' => [],
                ],
                [
                    'id' => 'page-luminaires',
                    'kind' => 'luminaire-list',
                    'sectionId' => 'luminaire-list',
                    'pageNumber' => 4,
                    'title' => 'Lista de luminarias',
                    'subtitle' => '1 item tipificado',
                    'assetIds' => [],
                    'notes' => [],
                ],
            ],
            'toc' => [
                [
                    'sectionId' => 'cover',
                    'title' => 'Portada',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 1,
                ],
                [
                    'sectionId' => 'preliminary-observations',
                    'title' => 'Observaciones preliminares',
                    'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                    'level' => 0,
                    'pageNumber' => 2,
                ],
                [
                    'sectionId' => 'content',
                    'title' => 'Contenido',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 3,
                ],
                [
                    'sectionId' => 'luminaire-list',
                    'title' => 'Lista de luminarias',
                    'subtitle' => '1 item tipificado',
                    'level' => 0,
                    'pageNumber' => 4,
                ],
            ],
            'luminaires' => [
                [
                    'id' => 'fixture-1',
                    'name' => 'Panel 60x60',
                    'model' => 'panel',
                    'lumens' => 4000,
                    'powerWatts' => null,
                    'roomName' => 'Oficina',
                    'ambientName' => 'Oficina',
                    'quantity' => 1,
                ],
            ],
            'ambientDetails' => [],
            'assets' => [
                [
                    'id' => 'formal-cover-svg',
                    'title' => 'Portada formal 3D',
                    'purpose' => 'formal-cover',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0f172a" /></svg>',
                ],
                [
                    'id' => 'project-summary-data',
                    'title' => 'Resumen del proyecto',
                    'purpose' => 'project-summary',
                    'kind' => 'structured',
                    'mimeType' => 'application/json',
                    'data' => [
                        'type' => 'summary',
                        'items' => [
                            ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    expect($response->headers->get('content-disposition'))->toContain('proyecto-demo-reporte-formal.pdf');
});

test('authenticated users can export a formal dialux pdf with the frontend payload shape', function () {
    $user = User::factory()->create();

    $payload = [
        'document' => [
            'formatVersion' => '1.0.0',
            'title' => 'Proyecto DIAlux · Reporte DIAlux',
            'subtitle' => 'Planta 1',
            'fileBaseName' => 'proyecto-dialux-reporte-formal',
            'generatedAt' => now()->toIso8601String(),
            'paper' => [
                'format' => 'A4',
                'orientation' => 'portrait',
            ],
            'header' => [
                'title' => 'Proyecto DIAlux',
                'subtitle' => 'Planta 1',
            ],
            'footer' => [
                'left' => 'DIAlux Web',
                'right' => now()->format('Y-m-d'),
            ],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto DIAlux'],
                ['label' => 'Escena', 'value' => 'Planta 1'],
                ['label' => 'Exportado', 'value' => now()->toIso8601String()],
                ['label' => 'Formato', 'value' => 'A4 vertical'],
            ],
            'pages' => [
                [
                    'id' => 'page-cover',
                    'kind' => 'cover',
                    'sectionId' => 'cover',
                    'pageNumber' => 1,
                    'title' => 'Portada',
                    'subtitle' => 'Planta 1',
                    'assetIds' => ['formal-cover-svg'],
                    'notes' => [],
                ],
                [
                    'id' => 'page-preliminary-observations',
                    'kind' => 'preliminary-observations',
                    'sectionId' => 'preliminary-observations',
                    'pageNumber' => 2,
                    'title' => 'Observaciones preliminares',
                    'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                    'assetIds' => ['project-summary-data'],
                    'notes' => [
                        'Objetivo del estudio: documentar en formato formal el estado del modelado luminico.',
                    ],
                ],
                [
                    'id' => 'page-content-1',
                    'kind' => 'toc',
                    'sectionId' => 'content',
                    'pageNumber' => 3,
                    'title' => 'Contenido',
                    'subtitle' => 'Indice del documento',
                    'assetIds' => [],
                    'notes' => [],
                ],
                [
                    'id' => 'page-luminaire-list',
                    'kind' => 'luminaire-list',
                    'sectionId' => 'luminaire-list',
                    'pageNumber' => 4,
                    'title' => 'Lista de luminarias',
                    'subtitle' => 'Sin luminarias registradas',
                    'assetIds' => [],
                    'notes' => ['No hay luminarias cargadas en la escena activa.'],
                ],
            ],
            'toc' => [
                [
                    'sectionId' => 'cover',
                    'title' => 'Portada',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 1,
                ],
                [
                    'sectionId' => 'preliminary-observations',
                    'title' => 'Observaciones preliminares',
                    'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                    'level' => 0,
                    'pageNumber' => 2,
                ],
                [
                    'sectionId' => 'content',
                    'title' => 'Contenido',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 3,
                ],
                [
                    'sectionId' => 'luminaire-list',
                    'title' => 'Lista de luminarias',
                    'subtitle' => 'Sin luminarias registradas',
                    'level' => 0,
                    'pageNumber' => 4,
                ],
            ],
            'luminaires' => [],
            'ambientDetails' => [],
            'assets' => [
                [
                    'id' => 'formal-cover-svg',
                    'title' => 'Portada formal 3D',
                    'purpose' => 'formal-cover',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0f172a" /></svg>',
                    'width' => 100,
                    'height' => 40,
                ],
                [
                    'id' => 'viewer-capture',
                    'title' => 'Captura del CAD Viewer',
                    'purpose' => 'viewer-capture',
                    'kind' => 'bitmap',
                    'mimeType' => 'image/png',
                    'dataUrl' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRfoAAAAASUVORK5CYII=',
                    'width' => 1,
                    'height' => 1,
                ],
                [
                    'id' => 'project-summary-data',
                    'title' => 'Resumen del proyecto',
                    'purpose' => 'project-summary',
                    'kind' => 'structured',
                    'mimeType' => 'application/json',
                    'data' => [
                        'type' => 'summary',
                        'items' => [
                            ['label' => 'Proyecto', 'value' => 'Proyecto DIAlux'],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    expect($response->headers->get('content-disposition'))->toContain('proyecto-dialux-reporte-formal.pdf');
});

test('authenticated users can export a formal dialux pdf with legacy ambient detail pages', function () {
    $user = User::factory()->create();

    $payload = [
        'document' => [
            'formatVersion' => '1.0.0',
            'title' => 'Proyecto DIAlux · Reporte DIAlux',
            'subtitle' => 'Planta 1',
            'fileBaseName' => 'proyecto-dialux-reporte-formal',
            'generatedAt' => now()->toIso8601String(),
            'paper' => [
                'format' => 'A4',
                'orientation' => 'portrait',
            ],
            'header' => [
                'title' => 'Proyecto DIAlux',
                'subtitle' => 'Planta 1',
            ],
            'footer' => [
                'left' => 'DIAlux Web',
                'right' => now()->format('Y-m-d'),
            ],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto DIAlux'],
                ['label' => 'Escena', 'value' => 'Planta 1'],
                ['label' => 'Exportado', 'value' => now()->toIso8601String()],
                ['label' => 'Formato', 'value' => 'A4 vertical'],
                ['label' => 'Ambientes', 'value' => '2'],
            ],
            'pages' => [
                [
                    'id' => 'page-cover',
                    'kind' => 'cover',
                    'sectionId' => 'cover',
                    'pageNumber' => 1,
                    'title' => 'Portada',
                    'subtitle' => 'Planta 1',
                    'assetIds' => ['formal-cover-svg'],
                    'notes' => [],
                    'ambientId' => null,
                ],
                [
                    'id' => 'page-content-1',
                    'kind' => 'toc',
                    'sectionId' => 'content',
                    'pageNumber' => 2,
                    'title' => 'Contenido',
                    'subtitle' => 'Índice del documento',
                    'assetIds' => [],
                    'notes' => [],
                    'ambientId' => null,
                ],
                [
                    'id' => 'page-luminaire-list',
                    'kind' => 'luminaire-list',
                    'sectionId' => 'luminaire-list',
                    'pageNumber' => 3,
                    'title' => 'Inventario de luminarias',
                    'subtitle' => '1 item(s) tipificados',
                    'assetIds' => [],
                    'notes' => [],
                    'ambientId' => null,
                ],
                [
                    'id' => 'page-ambient-detail-room-1::ambient-1',
                    'kind' => 'ambient-detail',
                    'sectionId' => 'ambient-detail:room-1::ambient-1',
                    'pageNumber' => 4,
                    'title' => 'Recinto Modulo XIV',
                    'subtitle' => 'Ambiente GUARDIANIA',
                    'assetIds' => ['ambient-plan-svg-room-1::ambient-1'],
                    'notes' => [],
                    'ambientId' => 'room-1::ambient-1',
                ],
                [
                    'id' => 'page-ambient-detail-room-1::ambient-2',
                    'kind' => 'ambient-detail',
                    'sectionId' => 'ambient-detail:room-1::ambient-2',
                    'pageNumber' => 5,
                    'title' => 'Recinto Modulo XIV',
                    'subtitle' => 'Ambiente SS.HH DE SERVICIO',
                    'assetIds' => ['ambient-plan-svg-room-1::ambient-2'],
                    'notes' => [],
                    'ambientId' => 'room-1::ambient-2',
                ],
            ],
            'toc' => [
                [
                    'sectionId' => 'cover',
                    'title' => 'Portada',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 1,
                ],
                [
                    'sectionId' => 'content',
                    'title' => 'Contenido',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 2,
                ],
                [
                    'sectionId' => 'luminaire-list',
                    'title' => 'Inventario de luminarias',
                    'subtitle' => '1 item(s) tipificados',
                    'level' => 0,
                    'pageNumber' => 3,
                ],
                [
                    'sectionId' => 'ambient-detail:room-1::ambient-1',
                    'title' => 'Recinto Modulo XIV',
                    'subtitle' => 'Ambiente GUARDIANIA',
                    'level' => 1,
                    'pageNumber' => 4,
                ],
                [
                    'sectionId' => 'ambient-detail:room-1::ambient-2',
                    'title' => 'Recinto Modulo XIV',
                    'subtitle' => 'Ambiente SS.HH DE SERVICIO',
                    'level' => 1,
                    'pageNumber' => 5,
                ],
            ],
            'luminaires' => [
                [
                    'id' => 'fixture-1',
                    'name' => 'Luminaria G1×1 [1]',
                    'model' => 'recessed',
                    'lumens' => 4000,
                    'powerWatts' => null,
                    'roomName' => 'Modulo XIV',
                    'ambientName' => null,
                    'quantity' => 2,
                ],
            ],
            'ambientDetails' => [
                [
                    'ambientId' => 'room-1::ambient-1',
                    'roomId' => 'room-1',
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'GUARDIANIA',
                    'activity' => null,
                    'area' => 3.28,
                    'targetLux' => 500,
                    'avgLux' => null,
                    'minLux' => null,
                    'maxLux' => null,
                    'uniformity' => null,
                    'uniformityTarget' => 0.4,
                    'ugr' => null,
                    'ugrLimit' => 22,
                    'fixtureCount' => 1,
                    'totalPowerWatts' => null,
                    'lumensRequired' => 2072.9,
                    'fixtureLumens' => 4000,
                    'exactQuantity' => 0.52,
                    'roundedQuantity' => 1,
                    'coverage' => 'Excessive',
                    'complianceLabel' => 'Revisar',
                    'planAssetId' => 'ambient-plan-svg-room-1::ambient-1',
                    'isoluxAssetId' => null,
                    'luminaires' => [
                        [
                            'id' => 'fixture-ambient-1',
                            'name' => 'Luminaria G1×1 [1]',
                            'type' => 'Recessed',
                            'shape' => 'Square',
                            'brand' => null,
                            'lumens' => 4000,
                            'powerWatts' => null,
                            'quantity' => 1,
                        ],
                    ],
                ],
                [
                    'ambientId' => 'room-1::ambient-2',
                    'roomId' => 'room-1',
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'SS.HH DE SERVICIO',
                    'activity' => null,
                    'area' => 3.25,
                    'targetLux' => 500,
                    'avgLux' => null,
                    'minLux' => null,
                    'maxLux' => null,
                    'uniformity' => null,
                    'uniformityTarget' => 0.4,
                    'ugr' => null,
                    'ugrLimit' => 22,
                    'fixtureCount' => 1,
                    'totalPowerWatts' => null,
                    'lumensRequired' => 2050.3,
                    'fixtureLumens' => 4000,
                    'exactQuantity' => 0.51,
                    'roundedQuantity' => 1,
                    'coverage' => 'Excessive',
                    'complianceLabel' => 'Revisar',
                    'planAssetId' => 'ambient-plan-svg-room-1::ambient-2',
                    'isoluxAssetId' => null,
                    'luminaires' => [
                        [
                            'id' => 'fixture-ambient-2',
                            'name' => 'Luminaria G1×1 [1]',
                            'type' => 'Recessed',
                            'shape' => 'Round',
                            'brand' => null,
                            'lumens' => 4000,
                            'powerWatts' => null,
                            'quantity' => 1,
                        ],
                    ],
                ],
            ],
            'assets' => [
                [
                    'id' => 'formal-cover-svg',
                    'title' => 'Portada formal 3D',
                    'purpose' => 'formal-cover',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0f172a" /></svg>',
                ],
                [
                    'id' => 'ambient-plan-svg-room-1::ambient-1',
                    'title' => 'Plano ambiente 1',
                    'purpose' => 'ambient-plan',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0d9488" /></svg>',
                ],
                [
                    'id' => 'ambient-plan-svg-room-1::ambient-2',
                    'title' => 'Plano ambiente 2',
                    'purpose' => 'ambient-plan',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#14b8a6" /></svg>',
                ],
            ],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    expect($response->headers->get('content-disposition'))->toContain('proyecto-dialux-reporte-formal.pdf');
});

test('formal dialux blade renders the fixed front matter structure', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => [
                'title' => 'Proyecto Demo',
                'subtitle' => 'Planta Baja',
            ],
            'footer' => [
                'left' => 'DIAlux Web',
                'right' => '2026-04-21',
            ],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
            ],
            'luminaires' => [],
        ],
        'pages' => [
            [
                'id' => 'page-cover',
                'kind' => 'cover',
                'sectionId' => 'cover',
                'pageNumber' => 1,
                'title' => 'Portada',
                'subtitle' => 'Planta Baja',
                'assets' => [
                    [
                        'id' => 'formal-cover-svg',
                        'kind' => 'vector',
                        'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0f172a" /></svg>',
                    ],
                ],
                'notes' => [],
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-preliminary-observations',
                'kind' => 'preliminary-observations',
                'sectionId' => 'preliminary-observations',
                'pageNumber' => 2,
                'title' => 'Observaciones preliminares',
                'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                'assets' => [
                    [
                        'id' => 'project-summary-data',
                        'kind' => 'structured',
                        'data' => [
                            'type' => 'summary',
                            'items' => [
                                ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
                            ],
                        ],
                    ],
                ],
                'notes' => [
                    'Objetivo del estudio: documentar en formato formal el estado del modelado luminico.',
                ],
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-content-1',
                'kind' => 'toc',
                'sectionId' => 'content',
                'pageNumber' => 3,
                'title' => 'Contenido',
                'subtitle' => 'Indice del documento',
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => [
            'id' => 'formal-cover-svg',
            'kind' => 'vector',
            'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#0f172a" /></svg>',
        ],
        'tocPages' => [
            [
                'id' => 'page-content-1',
                'pageNumber' => 3,
            ],
        ],
        'contentPages' => [],
        'tocChunks' => [[
            [
                'title' => 'Portada',
                'subtitle' => null,
                'pageNumber' => 1,
                'level' => 0,
            ],
            [
                'title' => 'Observaciones preliminares',
                'subtitle' => 'Base tecnica y criterios iniciales del reporte',
                'pageNumber' => 2,
                'level' => 0,
            ],
        ]],
    ]);

    $view->assertSee('Observaciones preliminares');
    $view->assertSee('Contenido');
    $view->assertSee('Resumen del proyecto');
    $view->assertSee('cover-image-wrap', false);
});

test('formal dialux blade renders calculated local and calculation object values', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => [
                'title' => 'Proyecto Demo',
                'subtitle' => 'Planta Baja',
            ],
            'footer' => [
                'left' => 'DIAlux Web',
                'right' => '2026-04-21',
            ],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-1',
                    'name' => 'Panel LED 120x30',
                    'model' => 'panel',
                    'brand' => 'Osram',
                    'articleNumber' => 'PANEL-40W',
                    'fixtureShape' => 'rectangular',
                    'shape' => 'rectangular',
                    'lumens' => 4000,
                    'powerWatts' => 40,
                    'efficiency' => 100,
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'GUARDIANIA',
                    'quantity' => 2,
                ],
            ],
            'luminaireTotals' => [
                'totalLumens' => 8000,
                'totalPowerWatts' => 80,
                'overallEfficiency' => 100,
            ],
            'ambientDetails' => [
                [
                    'ambientId' => 'room-1::ambient-1',
                    'roomId' => 'room-1',
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'GUARDIANIA',
                    'activity' => null,
                    'area' => 3.28,
                    'targetLux' => 500,
                    'avgLux' => 540.25,
                    'minLux' => 332.1,
                    'maxLux' => 688.9,
                    'uniformity' => 0.615,
                    'g2' => 0.482,
                    'uniformityTarget' => 0.4,
                    'ugr' => 18.2,
                    'ugrLimit' => 22,
                    'usefulPlaneHeight' => 0.8,
                    'marginalZone' => 0.2,
                    'calculationIndex' => 'WP1',
                    'fixtureCount' => 1,
                    'totalPowerWatts' => 40,
                    'lumensRequired' => 2072.9,
                    'fixtureLumens' => 4000,
                    'exactQuantity' => 0.52,
                    'roundedQuantity' => 1,
                    'coverage' => 'Optimal',
                    'complianceLabel' => 'Cumple',
                    'planAssetId' => null,
                    'isoluxAssetId' => null,
                    'luminaires' => [
                        [
                            'id' => 'fixture-1',
                            'name' => 'Panel LED 120x30',
                            'model' => 'panel',
                            'brand' => 'Osram',
                            'articleNumber' => 'PANEL-40W',
                            'fixtureShape' => 'rectangular',
                            'shape' => 'rectangular',
                            'lumens' => 4000,
                            'powerWatts' => 40,
                            'efficiency' => 100,
                            'roomName' => 'Modulo XIV',
                            'ambientName' => 'GUARDIANIA',
                            'quantity' => 1,
                        ],
                    ],
                    'fixturePositions' => [
                        [
                            'id' => 'fixture-1',
                            'name' => '1era Luminaria',
                            'productName' => 'Panel LED 120x30',
                            'x' => 0.944,
                            'y' => 1.241,
                            'mountingHeight' => 2.9,
                            'brand' => 'Osram',
                            'articleNumber' => 'PANEL-40W',
                            'lumens' => 4000,
                            'powerWatts' => 40,
                        ],
                    ],
                ],
            ],
        ],
        'pages' => [
            [
                'id' => 'page-luminaire-list',
                'kind' => 'luminaire-list',
                'sectionId' => 'luminaire-list',
                'pageNumber' => 1,
                'title' => 'Lista de luminarias',
                'subtitle' => null,
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-terrain-ambient-list',
                'kind' => 'ambient-list',
                'sectionId' => 'ambient-list',
                'pageNumber' => 2,
                'title' => 'Lista de locales / Escena de luz 1',
                'subtitle' => 'Terreno 1 - Edificacion 1',
                'assets' => [
                    [
                        'id' => 'drawn-terrain-svg',
                        'title' => 'Plano arquitectonico',
                        'purpose' => 'drawn-terrain',
                        'kind' => 'vector',
                        'mimeType' => 'image/svg+xml',
                        'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="300" height="160" fill="#f8fafc" /></svg>',
                    ],
                ],
                'notes' => [],
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-terrain-calculation-objects',
                'kind' => 'calculation-object-list',
                'sectionId' => 'calculation-object-list',
                'pageNumber' => 3,
                'title' => 'Objetos de cálculo / Escena de luz 1',
                'subtitle' => 'Terreno 1 - Edificacion 1',
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-ambient-results-room-1::ambient-1',
                'kind' => 'ambient-results',
                'sectionId' => 'ambient-results:room-1::ambient-1',
                'pageNumber' => 6,
                'title' => 'Resultados',
                'subtitle' => 'GUARDIANIA',
                'assets' => [],
                'notes' => [],
                'roomId' => 'room-1',
                'ambientDetail' => [
                    'ambientId' => 'room-1::ambient-1',
                    'roomId' => 'room-1',
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'GUARDIANIA',
                    'activity' => null,
                    'area' => 3.28,
                    'targetLux' => 500,
                    'avgLux' => 540.25,
                    'minLux' => 332.1,
                    'maxLux' => 688.9,
                    'uniformity' => 0.615,
                    'g2' => 0.482,
                    'uniformityTarget' => 0.4,
                    'ugr' => 18.2,
                    'ugrLimit' => 22,
                    'usefulPlaneHeight' => 0.8,
                    'marginalZone' => 0.2,
                    'calculationIndex' => 'WP1',
                    'fixtureCount' => 1,
                    'totalPowerWatts' => 40,
                    'lumensRequired' => 2072.9,
                    'fixtureLumens' => 4000,
                    'exactQuantity' => 0.52,
                    'roundedQuantity' => 1,
                    'coverage' => 'Optimal',
                    'complianceLabel' => 'Cumple',
                    'planAssetId' => null,
                    'isoluxAssetId' => null,
                    'luminaires' => [],
                    'fixturePositions' => [],
                ],
            ],
            [
                'id' => 'page-room-ambient-list-room-1',
                'kind' => 'room-ambient-list',
                'sectionId' => 'room-ambient-list:room-1',
                'pageNumber' => 4,
                'title' => 'Lista de locales / Escena de luz 1',
                'subtitle' => null,
                'assets' => [
                    [
                        'id' => 'viewer-capture-3d',
                        'title' => 'Captura 3D',
                        'purpose' => 'formal-cover',
                        'kind' => 'bitmap',
                        'mimeType' => 'image/png',
                        'dataUrl' => 'data:image/png;base64,iVBORw0KGgo=',
                        'width' => 100,
                        'height' => 80,
                    ],
                ],
                'notes' => [],
                'roomId' => 'room-1',
                'ambientDetail' => null,
            ],
            [
                'id' => 'page-room-calculation-object-room-1',
                'kind' => 'room-calculation-object',
                'sectionId' => 'room-calculation-object:room-1',
                'pageNumber' => 5,
                'title' => 'Objetos de cálculo / Escena de luz 1',
                'subtitle' => null,
                'assets' => [],
                'notes' => [],
                'roomId' => 'room-1',
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('GUARDIANIA');
    $view->assertSee('Potencia espec&iacute;fica de conexi&oacute;n', false);
    $view->assertSee('Planos &uacute;tiles', false);
    $view->assertSee('Resultados');
    $view->assertSee('Verificaci&oacute;n', false);
    $view->assertSee('540 lx');
    $view->assertSee('540 lx', false);
    $view->assertSee('332.1 lx');
    $view->assertSee('689 lx');
    $view->assertSee('0.48');
    $view->assertSee('WP1');
    $view->assertSee('80.0 W');
    $view->assertSee('100.0 lm/W');
    $view->assertSee('asset-align', false);
    $view->assertSee('page-landscape', false);
    $view->assertSee('terrain-plan-wrap', false);
    // $renderAsset replaces explicit px/numeric dimensions with 100% so the SVG fills its container.
    $view->assertSee('<svg xmlns="http://www.w3.org/2000/svg"', false);
    $view->assertSee('width="100%"', false);
    $view->assertSee('height="100%"', false);

    preg_match(
        '/<td rowspan="4"><strong>Plano &uacute;til<\/strong><\/td>.*?<\/tr>\s*<tr>(.*?)<\/tr>\s*<tr>(.*?)<\/tr>\s*<tr>(.*?)<\/tr>/s',
        (string) $view,
        $planeRows,
    );

    expect($planeRows)->not->toBeEmpty()
        ->and(substr_count($planeRows[1], '<td'))->toBe(5)
        ->and(substr_count($planeRows[2], '<td'))->toBe(5)
        ->and(substr_count($planeRows[3], '<td'))->toBe(5);
});

test('formal dialux blade renders product sheet report data and polar asset', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-1',
                    'name' => 'Downlight Opal',
                    'model' => 'recessed',
                    'brand' => 'Regiolux',
                    'articleNumber' => 'DALL-21W',
                    'lumens' => 2014,
                    'powerWatts' => 21,
                    'efficiency' => 95.9,
                    'quantity' => 1,
                    'reportData' => [
                        'technical_table' => [
                            ['label' => 'Producto', 'value' => 'Downlight Opal'],
                            ['label' => 'Rendimiento', 'value' => '95.9 lm/W'],
                        ],
                    ],
                    'polarDiagramAssetId' => 'prod-1-polar',
                ],
            ],
        ],
        'pages' => [
            [
                'id' => 'page-product-sheet-fixture-1',
                'kind' => 'product-sheet',
                'sectionId' => 'product-sheet:fixture-1',
                'pageNumber' => 1,
                'title' => 'Ficha de producto: Downlight Opal',
                'subtitle' => 'recessed',
                'assetIds' => ['prod-1-polar'],
                'assets' => [
                    [
                        'id' => 'prod-1-polar',
                        'title' => 'Diagrama polar',
                        'purpose' => 'ambient-catalog',
                        'kind' => 'vector',
                        'mimeType' => 'image/svg+xml',
                        'svg' => '<svg xmlns="http://www.w3.org/2000/svg"><text>CDL polar</text></svg>',
                    ],
                ],
                'notes' => [],
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('Ficha de producto');
    $view->assertSee('Downlight Opal');
    $view->assertSee('95.9 lm/W');
    $view->assertSee('CDL polar');
});
