<?php

use App\Models\Dialux\DialuxModule;
use App\Models\Dialux\DialuxProject;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('formal export v2 is authorized and scoped to its module', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();
    $module = DialuxModule::factory()->for($project, 'project')->create();

    $this->actingAs($user)
        ->postJson(
            route('dialux-v2.modules.formal-export', [$project, $module]),
            minimalValidFormalDocumentPayload($project->id),
        )
        ->assertSuccessful()
        ->assertHeader('content-type', 'application/pdf');

    $otherProject = DialuxProject::factory()->for($user)->create();

    $this->actingAs($user)
        ->postJson(
            route('dialux-v2.modules.formal-export', [$otherProject, $module]),
            minimalValidFormalDocumentPayload($otherProject->id),
        )
        ->assertNotFound();
});

/**
 * Payload minimo valido, usado como base para los tests de validacion de
 * schemaVersion y de limite de tamano de assets. `dialux_project_id` debe
 * apuntar a un DialuxProject real (FormalExportRequest lo valida con
 * exists:dialux_projects,id, y el controller verifica que sea del usuario
 * autenticado).
 */
function minimalValidFormalDocumentPayload(int|string $dialuxProjectId): array
{
    return [
        'dialux_project_id' => $dialuxProjectId,
        'document' => [
            'schemaVersion' => 1,
            'title' => 'Proyecto Demo · Reporte',
            'subtitle' => 'Planta Baja',
            'fileBaseName' => 'proyecto-demo-reporte-formal',
            'generatedAt' => now()->toIso8601String(),
            'header' => [
                'title' => 'Proyecto Demo',
                'subtitle' => 'Planta Baja',
            ],
            'footer' => [
                'left' => 'PCL',
                'right' => now()->format('Y-m-d'),
            ],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
            ],
            'pages' => [
                [
                    'id' => 'page-cover',
                    'kind' => 'cover',
                    'sectionId' => 'cover',
                    'pageNumber' => 1,
                    'title' => 'Portada',
                    'subtitle' => 'Planta Baja',
                    'assetIds' => [],
                    'notes' => [],
                ],
                [
                    'id' => 'page-content-1',
                    'kind' => 'toc',
                    'sectionId' => 'content',
                    'pageNumber' => 2,
                    'title' => 'Contenido',
                    'subtitle' => 'Indice del documento',
                    'assetIds' => [],
                    'notes' => [],
                ],
                [
                    'id' => 'page-luminaires',
                    'kind' => 'luminaire-list',
                    'sectionId' => 'luminaire-list',
                    'pageNumber' => 3,
                    'title' => 'Lista de luminarias',
                    'subtitle' => '0 items',
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
                    'sectionId' => 'content',
                    'title' => 'Contenido',
                    'subtitle' => null,
                    'level' => 0,
                    'pageNumber' => 2,
                ],
            ],
            'luminaires' => [],
            'levels' => [],
            'glossary' => [],
            'ambientDetails' => [],
            'assets' => [
                [
                    'id' => 'formal-cover-svg',
                    'title' => 'Portada formal 3D',
                    'purpose' => 'formal-cover',
                    'kind' => 'vector',
                    'mimeType' => 'image/svg+xml',
                    'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"></svg>',
                ],
            ],
        ],
    ];
}

test('authenticated users can export a formal dialux pdf', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = [
        'dialux_project_id' => $project->id,
        'document' => [
            'schemaVersion' => 1,
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
            'levels' => [],
            'glossary' => [],
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

test('rejects a payload missing document.schemaVersion', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    unset($payload['document']['schemaVersion']);

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['document.schemaVersion']);
});

test('rejects a payload with an unsupported document.schemaVersion', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['schemaVersion'] = 999;

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['document.schemaVersion']);
    expect($response->json()['errors']['document.schemaVersion'][0])
        ->toContain('no es compatible');
});

test('accepts the current document.schemaVersion', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});

test('rejects an asset dataUrl exceeding the configured size limit', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['assets'] = [
        [
            'id' => 'oversized-bitmap',
            'title' => 'Plano de nivel',
            'purpose' => 'ambient-plan',
            'kind' => 'bitmap',
            'mimeType' => 'image/jpeg',
            'dataUrl' => 'data:image/jpeg;base64,'.str_repeat('A', 20_000_001),
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['document.assets.0.dataUrl']);
});

test('rejects a payload missing dialux_project_id', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    unset($payload['dialux_project_id']);

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['dialux_project_id']);
});

test('rejects a payload referencing a project that does not exist', function () {
    $user = User::factory()->create();

    $payload = minimalValidFormalDocumentPayload(999_999_999);

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['dialux_project_id']);
});

test('rejects a payload referencing a project that belongs to another user', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $otherUsersProject = DialuxProject::factory()->for($otherUser)->create();

    $payload = minimalValidFormalDocumentPayload($otherUsersProject->id);

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(403);
});

test('rejects an unauthenticated request', function () {
    $project = DialuxProject::factory()->create();

    $payload = minimalValidFormalDocumentPayload($project->id);

    $response = $this->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(401);
});

test('rejects an asset with a malformed dataUrl that is not valid base64 image data', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['assets'] = [
        [
            'id' => 'broken-bitmap',
            'title' => 'Plano de nivel',
            'purpose' => 'ambient-plan',
            'kind' => 'bitmap',
            'mimeType' => 'image/png',
            'dataUrl' => 'data:image/png;base64,***not-valid-base64***',
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['document.assets.0.dataUrl']);
});

test('rejects a payload exceeding the maximum allowed number of pages', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['pages'] = collect(range(1, 801))->map(fn (int $i) => [
        'id' => "page-{$i}",
        'kind' => 'placeholder',
        'sectionId' => "section-{$i}",
        'pageNumber' => $i,
        'title' => "Pagina {$i}",
        'subtitle' => null,
        'assetIds' => [],
        'notes' => [],
    ])->all();

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['document.pages']);
});

test('sanitizes a fileBaseName with path separators instead of crashing', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['fileBaseName'] = '../../etc/passwd\\reporte"raro';

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    $disposition = (string) $response->headers->get('content-disposition');
    expect($disposition)->not->toContain('/')
        ->and($disposition)->not->toContain('\\')
        ->and($disposition)->toContain('.pdf');
});

test('escapes html and script tags injected into luminaire names instead of rendering them raw', function () {
    $malicious = '<script>alert(1)</script>';

    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-07-22T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'PCL', 'right' => '2026-07-22'],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-xss',
                    'name' => $malicious,
                    'brand' => $malicious,
                    'articleNumber' => 'ART-1',
                    'lumens' => 1000,
                    'powerWatts' => 10,
                    'efficiency' => 100,
                    'quantity' => 1,
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
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    // El texto aparece escapado (Blade e()), no como una etiqueta ejecutable.
    $view->assertSee($malicious);
    $view->assertDontSee($malicious, false);
});

test('generates a 242-page report within a reasonable time budget', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $extraPages = collect(range(4, 242))->map(fn (int $i) => [
        'id' => "page-{$i}",
        'kind' => 'placeholder',
        'sectionId' => "section-{$i}",
        'pageNumber' => $i,
        'title' => "Pagina {$i}",
        'subtitle' => null,
        'assetIds' => [],
        'notes' => [],
    ])->all();
    $payload['document']['pages'] = array_merge($payload['document']['pages'], $extraPages);

    expect(count($payload['document']['pages']))->toBe(242);

    $start = microtime(true);
    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);
    $elapsedSeconds = microtime(true) - $start;

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
    // Medicion real pedida por el plan maestro antes de decidir si hace
    // falta una cola para informes grandes (Fase 9): con placeholders
    // (sin assets pesados) debe resolverse comodamente en la request sincrona.
    expect($elapsedSeconds)->toBeLessThan(60.0);
});

test('authenticated users can export a formal dialux pdf with the frontend payload shape', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = [
        'dialux_project_id' => $project->id,
        'document' => [
            'schemaVersion' => 1,
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
            'levels' => [],
            'glossary' => [],
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
    $project = DialuxProject::factory()->for($user)->create();

    $payload = [
        'dialux_project_id' => $project->id,
        'document' => [
            'schemaVersion' => 1,
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
            'levels' => [],
            'glossary' => [],
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

test('formal dialux blade renders the level luminaire list with its own totals, not the project totals', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'MODULO I · Reporte',
            'subtitle' => '1° Nivel',
            'generatedAt' => '2026-07-21T10:00:00Z',
            'header' => ['title' => 'MODULO I', 'subtitle' => '1° Nivel'],
            'footer' => ['left' => 'PCL', 'right' => '2026-07-21'],
            'metadata' => [],
            'luminaires' => [],
            // Totales del PROYECTO COMPLETO (deben ser distintos a los del nivel,
            // para verificar que la página de nivel no muestra el total global).
            'luminaireTotals' => [
                'totalLumens' => 999999,
                'totalPowerWatts' => 999999,
                'overallEfficiency' => 1,
            ],
        ],
        'pages' => [
            [
                'id' => 'page-level-luminaires-l0-scene',
                'kind' => 'level-luminaire-list',
                'sectionId' => 'level-luminaire-list:l0-scene',
                'pageNumber' => 1,
                'title' => 'Lista de luminarias del nivel',
                'subtitle' => '1° Nivel',
                'sceneId' => 'l0-scene',
                'sceneName' => '1° Nivel',
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
                'levelSummary' => [
                    'sceneId' => 'l0-scene',
                    'sceneName' => '1° Nivel',
                    'floorIndex' => 0,
                    'luminaires' => [
                        [
                            'id' => 'fixture-1',
                            'name' => 'Panel LED 60x60',
                            'brand' => 'PCL Iluminacion',
                            'articleNumber' => 'PANEL-40W',
                            'quantity' => 8,
                            'powerWatts' => 40,
                            'lumens' => 4000,
                            'efficiency' => 100,
                        ],
                    ],
                    'luminaireTotals' => [
                        'totalLumens' => 32000,
                        'totalPowerWatts' => 320,
                        'overallEfficiency' => 100,
                    ],
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('Lista de luminarias', false);
    $view->assertSee('1° Nivel');
    $view->assertSee('Panel LED 60x60');
    // El total mostrado debe ser el del NIVEL (32000 lm / 320 W), no el del proyecto (999999).
    $view->assertSee('32,000 lm', false);
    $view->assertSee('320.0 W', false);
    $view->assertDontSee('999,999');
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
    $view->assertSee('project-luminaire-table', false);
    $view->assertSee('ambient-list-table', false);
    $view->assertSee('calculation-table', false);
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

test('formal dialux blade Consumo uses siteSettings.dailyOperatingHours when the ambient declares it', function () {
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
            'luminaires' => [],
            'luminaireTotals' => ['totalLumens' => 0, 'totalPowerWatts' => 0, 'overallEfficiency' => 0],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-results-room-1::ambient-1',
                'kind' => 'ambient-results',
                'sectionId' => 'ambient-results:room-1::ambient-1',
                'pageNumber' => 1,
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
                    'dailyOperatingHours' => 4,
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
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    // Consumo = 40 W * 4 h/dia * 365 / 1000 = 58.4 kWh/a (NO el resultado con el default de 8h, que sería 116.8).
    $view->assertSee('58 kWh/a', false);
    $view->assertSee('jornada referencial de 4 h', false);
    $view->assertDontSee('117 kWh/a');
    // Ronda 21h: sin una fuente normativa real de límite de consumo anual,
    // el renglón es informativo — nunca "Conforme"/"No conforme" (antes
    // copiaba el lux exigido, 500, y lo mostraba como "máx. 500 kWh/a").
    // Se busca el badge renderizado exacto, no la palabra suelta: el CSS
    // exportado inline trae un comentario que también dice "Conforme".
    $view->assertDontSee('m&aacute;x. 500 kWh/a', false);
    $view->assertDontSee('status-pass">Conforme', false);
});

test('formal dialux blade Consumo defaults to 8h/dia when the ambient does not declare dailyOperatingHours', function () {
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
            'luminaires' => [],
            'luminaireTotals' => ['totalLumens' => 0, 'totalPowerWatts' => 0, 'overallEfficiency' => 0],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-results-room-1::ambient-1',
                'kind' => 'ambient-results',
                'sectionId' => 'ambient-results:room-1::ambient-1',
                'pageNumber' => 1,
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
                    // Sin 'dailyOperatingHours' — debe caer al default de 8h.
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
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    // Consumo = 40 W * 8 h/dia * 365 / 1000 = 116.8 kWh/a.
    $view->assertSee('117 kWh/a', false);
    $view->assertSee('jornada referencial de 8 h', false);
});

test('formal dialux blade renders the LENI row when the ambient has a leni result, without any "conforme" language', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => ['totalLumens' => 0, 'totalPowerWatts' => 0, 'overallEfficiency' => 0],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-results-room-1::ambient-1',
                'kind' => 'ambient-results',
                'sectionId' => 'ambient-results:room-1::ambient-1',
                'pageNumber' => 1,
                'title' => 'Resultados',
                'subtitle' => 'OFICINA',
                'assets' => [],
                'notes' => [],
                'roomId' => 'room-1',
                'ambientDetail' => [
                    'ambientId' => 'room-1::ambient-1',
                    'roomId' => 'room-1',
                    'roomName' => 'Modulo XIV',
                    'ambientName' => 'OFICINA',
                    'activity' => null,
                    'area' => 25,
                    'targetLux' => 500,
                    'avgLux' => 510,
                    'minLux' => 400,
                    'maxLux' => 600,
                    'uniformity' => 0.7,
                    'g2' => 0.5,
                    'uniformityTarget' => 0.4,
                    'ugr' => 18,
                    'ugrLimit' => 22,
                    'usefulPlaneHeight' => 0.8,
                    'marginalZone' => 0.2,
                    'calculationIndex' => 'WP1',
                    'fixtureCount' => 6,
                    'totalPowerWatts' => 500,
                    'dailyOperatingHours' => 8,
                    'lumensRequired' => 15625,
                    'fixtureLumens' => 4000,
                    'exactQuantity' => 3.91,
                    'roundedQuantity' => 6,
                    'coverage' => 'Optimal',
                    'complianceLabel' => 'Cumple',
                    'planAssetId' => null,
                    'isoluxAssetId' => null,
                    'luminaires' => [],
                    'fixturePositions' => [],
                    // Mismo resultado que produciría calculateLeni() para
                    // P_n=500W, A=25m², buildingType='office', sin overrides:
                    // W_L=(500×1×[(2250×1×1)+(250×1)])/1000=1250 kWh/año,
                    // LENI=1250/25=50 kWh/(m²·año).
                    'leni' => [
                        'lightingEnergyKwhYear' => 1250,
                        'parasiticEnergyKwhYear' => 0,
                        'parasiticEnergyModeled' => false,
                        'leniKwhPerM2Year' => 50,
                        'buildingTypeLabel' => 'Oficina',
                        'occupancyControlType' => 'manual',
                        'daylightControlType' => 'none',
                        'constantIlluminanceControl' => false,
                        'annualHoursDay' => 2250,
                        'annualHoursNight' => 250,
                        'factorOccupancy' => 1,
                        'factorDaylight' => 1,
                        'factorConstantIlluminance' => 1,
                    ],
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('LENI (Oficina)', false);
    $view->assertSee('50.0 kWh/(m&sup2;&middot;a)', false);
    $view->assertSee('pendientes de verificaci&oacute;n normativa', false);
    // Nunca debe leerse como una declaración de conformidad normativa: la
    // fila LENI usa el badge "Calculado (3)", nunca "Conforme"/"Cumple".
    $view->assertDontSee('status-pass">Conforme', false);
});

test('formal dialux blade omits the LENI row when the ambient has no leni result (no buildingType configured)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => ['totalLumens' => 0, 'totalPowerWatts' => 0, 'overallEfficiency' => 0],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-results-room-1::ambient-1',
                'kind' => 'ambient-results',
                'sectionId' => 'ambient-results:room-1::ambient-1',
                'pageNumber' => 1,
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
                    'dailyOperatingHours' => 8,
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
                    'leni' => null,
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertDontSee('LENI (', false);
    $view->assertDontSee('pendientes de verificaci&oacute;n normativa', false);
});

test('formal dialux blade renders engine version, calculation date and warnings for an ambient (Fase 13)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => [],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-summary-room-1::ambient-1',
                'kind' => 'ambient-summary',
                'sectionId' => 'ambient-summary:room-1::ambient-1',
                'pageNumber' => 1,
                'title' => 'Resumen',
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
                    'provenance' => [
                        'engine' => 'direct-preview',
                        'engineVersion' => 'direct-preview-v1',
                        'calculatedAt' => '2026-04-21T09:55:00.000Z',
                        'status' => 'calculated',
                    ],
                    'warnings' => [
                        ['code' => 'object-without-luminaires', 'message' => 'Mensaje de advertencia de prueba', 'objectId' => 'room-1::ambient-1'],
                    ],
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('Motor de c&aacute;lculo', false);
    $view->assertSee('direct-preview-v1');
    $view->assertSee('2026-04-21T09:55:00.000Z');
    $view->assertSee('Advertencias del c&aacute;lculo', false);
    $view->assertSee('Mensaje de advertencia de prueba');
});

test('formal dialux blade renders no provenance/warnings block when the ambient has none (Fase 13, default no disruptivo)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => [],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-ambient-summary-room-1::ambient-1',
                'kind' => 'ambient-summary',
                'sectionId' => 'ambient-summary:room-1::ambient-1',
                'pageNumber' => 1,
                'title' => 'Resumen',
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
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertDontSee('Motor de c&aacute;lculo', false);
    $view->assertDontSee('Advertencias del c&aacute;lculo', false);
});

test('accepts ambientDetails.provenance.snapshotHash/configSummary and ambientDetails.warnings (Fase 13, gap de la Fase 11)', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['ambientDetails'] = [
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
            'uniformityTarget' => 0.4,
            'ugr' => 18.2,
            'ugrLimit' => 22,
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
            'provenance' => [
                'engine' => 'direct-preview',
                'engineVersion' => 'direct-preview-v1',
                'calculatedAt' => now()->toIso8601String(),
                'status' => 'calculated',
                'snapshotHash' => str_repeat('a', 64),
                'configSummary' => 'oclusión: no · interreflexión: none · UGR: legacy',
            ],
            'warnings' => [
                ['code' => 'object-without-luminaires', 'message' => 'Mensaje de advertencia de prueba', 'objectId' => 'room-1::ambient-1'],
            ],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});

test('formal dialux blade renders the lighting scene comparison annex (Fase 13, dormido hoy)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-04-21T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-04-21'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => [],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-lighting-scene-comparison-nivel-1::modo-nocturno',
                'kind' => 'lighting-scene-comparison',
                'sectionId' => 'technical-appendix',
                'pageNumber' => 1,
                'title' => 'Comparación de escenas lumínicas',
                'subtitle' => 'Piso 1: Todo encendido vs. Modo nocturno',
                'assets' => [],
                'notes' => [],
                'sceneComparison' => [
                    'id' => 'nivel-1::modo-nocturno',
                    'levelId' => 'nivel-1',
                    'levelName' => 'Piso 1',
                    'baselineSceneName' => 'Todo encendido',
                    'comparisonSceneName' => 'Modo nocturno',
                    'entries' => [
                        [
                            'objectId' => 'room-1::ambient-1',
                            'objectName' => 'Oficina',
                            'levelId' => 'nivel-1',
                            'avgLuxDelta' => -120.5,
                            'minLuxDelta' => -80.0,
                            'maxLuxDelta' => -150.0,
                            'uniformityDelta' => -0.05,
                            'ugrDelta' => -2.1,
                        ],
                    ],
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('Todo encendido vs.', false);
    $view->assertSee('Modo nocturno');
    $view->assertSee('Oficina');
    $view->assertSee('-120.5');
    $view->assertSee('-2.1');
});

test('accepts a lighting-scene-comparison page with a full sceneComparison payload (Fase 13, anexo dormido)', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['pages'][] = [
        'id' => 'page-lighting-scene-comparison-nivel-1::modo-nocturno',
        'kind' => 'lighting-scene-comparison',
        'sectionId' => 'technical-appendix',
        'pageNumber' => 4,
        'title' => 'Comparación de escenas lumínicas',
        'subtitle' => 'Piso 1: Todo encendido vs. Modo nocturno',
        'assetIds' => [],
        'notes' => [],
        'sceneComparison' => [
            'id' => 'nivel-1::modo-nocturno',
            'levelId' => 'nivel-1',
            'levelName' => 'Piso 1',
            'baselineSceneName' => 'Todo encendido',
            'comparisonSceneName' => 'Modo nocturno',
            'entries' => [
                [
                    'objectId' => 'room-1::ambient-1',
                    'objectName' => 'Oficina',
                    'levelId' => 'nivel-1',
                    'avgLuxDelta' => -120.5,
                    'minLuxDelta' => -80.0,
                    'maxLuxDelta' => -150.0,
                    'uniformityDelta' => -0.05,
                    'ugrDelta' => -2.1,
                ],
            ],
        ],
    ];
    $payload['document']['toc'][] = [
        'sectionId' => 'technical-appendix',
        'title' => 'Comparación de escenas lumínicas',
        'subtitle' => null,
        'level' => 0,
        'pageNumber' => 4,
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});

test('formal dialux blade renders the emergency lighting cover and compliance table separately from the normal report (Fase 14)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Informe de Alumbrado de Emergencia',
            'subtitle' => 'RNE A.130 / EN 1838',
            'generatedAt' => '2026-08-04T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo — ALUMBRADO DE EMERGENCIA', 'subtitle' => 'RNE A.130 / EN 1838'],
            'footer' => ['left' => 'PCL — Informe de emergencia', 'right' => '2026-08-04'],
            'metadata' => [],
            'luminaires' => [],
            'luminaireTotals' => [],
            'ambientDetails' => [],
        ],
        'pages' => [
            [
                'id' => 'page-emergency-cover',
                'kind' => 'emergency-cover',
                'sectionId' => 'emergency-cover',
                'pageNumber' => 1,
                'title' => 'INFORME DE ALUMBRADO DE EMERGENCIA',
                'subtitle' => 'Proyecto Demo',
                'assets' => [],
                'notes' => ['Se evaluó 1 ambiente de emergencia contra RNE A.130 y EN 1838, nunca fusionadas.'],
            ],
            [
                'id' => 'page-emergency-compliance-table',
                'kind' => 'emergency-compliance-table',
                'sectionId' => 'emergency-compliance-table',
                'pageNumber' => 2,
                'title' => 'Cumplimiento normativo — alumbrado de emergencia',
                'subtitle' => null,
                'assets' => [],
                'notes' => [],
                'emergencyRooms' => [
                    [
                        'roomId' => 'route-1',
                        'roomName' => 'Pasillo principal',
                        'roomType' => 'evacuation-route',
                        'levelId' => 'scene-1',
                        'levelName' => 'Piso 1',
                        'minLux' => 5.0,
                        'criticalPoint' => ['x' => 2.5, 'y' => 1.0],
                        'evaluations' => [
                            [
                                'standard' => 'rne_a130',
                                'source' => 'RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 40',
                                'mandatory' => true,
                                'metric' => 'illuminance',
                                'requiredLux' => 10,
                                'calculatedLux' => 5.0,
                                'status' => 'fail',
                            ],
                            [
                                'standard' => 'en_1838',
                                'source' => 'EN 1838:2013 (referencia internacional, sin adopción legal en Perú)',
                                'mandatory' => false,
                                'metric' => 'illuminance',
                                'requiredLux' => 1,
                                'calculatedLux' => 5.0,
                                'status' => 'pass',
                            ],
                        ],
                    ],
                ],
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('INFORME DE ALUMBRADO DE EMERGENCIA');
    $view->assertSee('Pasillo principal');
    $view->assertSee('RNE A.130');
    $view->assertSee('(obligatoria)');
    $view->assertSee('EN 1838:2013');
    $view->assertSee('(referencia)');
    $view->assertSee('No conforme');
    $view->assertSee('Conforme');
    // Nunca fusiona ambas normas en un solo veredicto: ambos estados distintos coexisten.
    $view->assertDontSee('Reporte DIAlux');
});

test('accepts emergency-cover and emergency-compliance-table pages with a full emergencyRooms payload (Fase 14)', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['pages'][] = [
        'id' => 'page-emergency-cover',
        'kind' => 'emergency-cover',
        'sectionId' => 'emergency-cover',
        'pageNumber' => 4,
        'title' => 'INFORME DE ALUMBRADO DE EMERGENCIA',
        'subtitle' => 'Proyecto Demo',
        'assetIds' => [],
        'notes' => ['Se evaluó 1 ambiente de emergencia contra RNE A.130 y EN 1838, nunca fusionadas.'],
    ];
    $payload['document']['pages'][] = [
        'id' => 'page-emergency-compliance-table',
        'kind' => 'emergency-compliance-table',
        'sectionId' => 'emergency-compliance-table',
        'pageNumber' => 5,
        'title' => 'Cumplimiento normativo — alumbrado de emergencia',
        'subtitle' => null,
        'assetIds' => [],
        'notes' => [],
        'emergencyRooms' => [
            [
                'roomId' => 'route-1',
                'roomName' => 'Pasillo principal',
                'roomType' => 'evacuation-route',
                'levelId' => 'scene-1',
                'levelName' => 'Piso 1',
                'minLux' => 5.0,
                'criticalPoint' => ['x' => 2.5, 'y' => 1.0],
                'evaluations' => [
                    [
                        'standard' => 'rne_a130',
                        'source' => 'RNE A.130 (D.S. N°017-2012-VIVIENDA), Art. 40',
                        'mandatory' => true,
                        'metric' => 'illuminance',
                        'requiredLux' => 10,
                        'calculatedLux' => 5.0,
                        'status' => 'fail',
                    ],
                    [
                        'standard' => 'en_1838',
                        'source' => 'EN 1838:2013 (referencia internacional, sin adopción legal en Perú)',
                        'mandatory' => false,
                        'metric' => 'illuminance',
                        'requiredLux' => 1,
                        'calculatedLux' => 5.0,
                        'status' => 'pass',
                    ],
                ],
            ],
        ],
    ];
    $payload['document']['toc'][] = [
        'sectionId' => 'emergency-cover',
        'title' => 'INFORME DE ALUMBRADO DE EMERGENCIA',
        'subtitle' => null,
        'level' => 0,
        'pageNumber' => 4,
    ];
    $payload['document']['toc'][] = [
        'sectionId' => 'emergency-compliance-table',
        'title' => 'Cumplimiento normativo — alumbrado de emergencia',
        'subtitle' => null,
        'level' => 0,
        'pageNumber' => 5,
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});

test('accepts the REAL minimal emergency-only document shape from buildDialuxEmergencyDocument.ts (Fase 16 regression)', function () {
    // A diferencia del test anterior, que agrega páginas de emergencia
    // SOBRE un documento normal ya válido (con 3+ páginas y assets no
    // vacíos), este test envía exactamente la forma que produce
    // `buildDialuxEmergencyDocument.ts` en el frontend: SOLO 2 páginas
    // (portada + tabla de cumplimiento) y `assets: []` — sin ningún CDL,
    // plano, ni ficha de producto. Un usuario real lo hizo fallar con
    // 422 (validation.min_array en `document.pages`, validation.required
    // en `document.assets`, que Laravel trata un array vacío como
    // "vacío" bajo 'required') porque el fixture de arriba nunca ejercitó
    // esta forma mínima real.
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = [
        'dialux_project_id' => $project->id,
        'document' => [
            'schemaVersion' => 1,
            'title' => 'Proyecto Demo · Informe de Alumbrado de Emergencia',
            'subtitle' => 'RNE A.130 / EN 1838',
            'fileBaseName' => 'proyecto-demo-informe-emergencia',
            'generatedAt' => now()->toIso8601String(),
            'header' => ['title' => 'Proyecto Demo — ALUMBRADO DE EMERGENCIA', 'subtitle' => 'RNE A.130 / EN 1838'],
            'footer' => ['left' => 'PCL — Informe de emergencia', 'right' => now()->format('Y-m-d')],
            'metadata' => [
                ['label' => 'Proyecto', 'value' => 'Proyecto Demo'],
                ['label' => 'Tipo de informe', 'value' => 'Alumbrado de emergencia'],
            ],
            'pages' => [
                [
                    'id' => 'page-emergency-cover',
                    'kind' => 'emergency-cover',
                    'sectionId' => 'emergency-cover',
                    'pageNumber' => 1,
                    'title' => 'INFORME DE ALUMBRADO DE EMERGENCIA',
                    'subtitle' => 'Proyecto Demo',
                    'assetIds' => [],
                    'notes' => ['Este proyecto no tiene ambientes marcados como ruta de evacuación o área antipánico — no hay nada que evaluar todavía.'],
                ],
                [
                    'id' => 'page-emergency-compliance-table',
                    'kind' => 'emergency-compliance-table',
                    'sectionId' => 'emergency-compliance-table',
                    'pageNumber' => 2,
                    'title' => 'Cumplimiento normativo — alumbrado de emergencia',
                    'subtitle' => 'RNE A.130 (obligatoria) y EN 1838 (referencia), evaluadas por separado',
                    'assetIds' => [],
                    'notes' => [],
                    'emergencyRooms' => [],
                ],
            ],
            'toc' => [
                ['sectionId' => 'emergency-cover', 'title' => 'INFORME DE ALUMBRADO DE EMERGENCIA', 'subtitle' => 'Proyecto Demo', 'level' => 0, 'pageNumber' => 1],
                ['sectionId' => 'emergency-compliance-table', 'title' => 'Cumplimiento normativo — alumbrado de emergencia', 'subtitle' => 'RNE A.130 (obligatoria) y EN 1838 (referencia), evaluadas por separado', 'level' => 0, 'pageNumber' => 2],
            ],
            'luminaires' => [],
            'luminaireTotals' => ['totalLumens' => 0, 'totalPowerWatts' => 0, 'overallEfficiency' => 0],
            'levels' => [],
            'ambientDetails' => [],
            'assets' => [],
            'glossary' => [],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});

test('formal dialux pdf tables use scoped column width rules', function () {
    $css = file_get_contents(resource_path('css/style-exportado-dialux.css'));

    expect($css)->not->toContain('.luminaire-table th:nth-child');
    expect($css)
        ->toContain('.project-luminaire-table th:nth-child(1)')
        ->toContain('.ambient-local-table th:nth-child(1)')
        ->toContain('.ambient-list-table th:nth-child(1)')
        ->toContain('.fixture-position-table th:nth-child(1)')
        ->toContain('overflow-wrap: anywhere');
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

test('formal dialux blade shows a fallback instead of hiding the container when a product has no logo or photo', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-07-22T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'PCL', 'right' => '2026-07-22'],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-2',
                    'name' => 'Panel generico',
                    'model' => 'panel',
                    'brand' => null,
                    'articleNumber' => null,
                    'lumens' => 3000,
                    'powerWatts' => 30,
                    'efficiency' => null,
                    'cct' => null,
                    'cri' => null,
                    'quantity' => 1,
                    // Sin brandLogoAssetId / productPhotoAssetId / lineDrawingAssetId / polarDiagramAssetId.
                ],
            ],
        ],
        'pages' => [
            [
                'id' => 'page-product-sheet-fixture-2',
                'kind' => 'product-sheet',
                'sectionId' => 'product-sheet:fixture-2',
                'pageNumber' => 1,
                'title' => 'Ficha de producto: Panel generico',
                'subtitle' => 'panel',
                'assetIds' => [],
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('Panel generico');
    // Antes: el contenedor de logo/foto desaparecía en silencio. Ahora debe
    // mostrar el mismo fallback que ya usa el diagrama polar.
    $view->assertSeeInOrder(['Grafico no disponible.', 'Grafico no disponible.', 'Grafico no disponible.']);
});

test('formal dialux blade only shows luminaire list totals on the first page of a continuation', function () {
    $luminaires = collect(range(1, 6))->map(fn (int $i) => [
        'id' => "fixture-{$i}",
        'name' => "Producto {$i}",
        'brand' => 'Fabricante',
        'articleNumber' => "ART-{$i}",
        'lumens' => 1000 * $i,
        'powerWatts' => 10 * $i,
        'efficiency' => 100,
        'quantity' => 1,
    ])->all();

    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-07-22T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'PCL', 'right' => '2026-07-22'],
            'metadata' => [],
            'luminaires' => $luminaires,
            'luminaireTotals' => ['totalLumens' => 21000, 'totalPowerWatts' => 210, 'overallEfficiency' => 100],
        ],
        'pages' => [
            [
                'id' => 'page-terrain-luminaires-p2',
                'kind' => 'luminaire-list',
                'sectionId' => 'cad-overview-luminaires',
                'pageNumber' => 1,
                'title' => 'Lista de luminarias',
                'subtitle' => 'Continuación',
                'assetIds' => [],
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
                'rowRangeStart' => 3,
                'rowRangeEnd' => 6,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    // Esta página de continuación muestra las filas 4-6, no las 1-3.
    $view->assertDontSee('Producto 1');
    $view->assertSee('Producto 4');
    $view->assertSee('Producto 6');
    // Y no repite el total del proyecto completo (21000 lm).
    $view->assertDontSee('21,000 lm');
});

test('formal dialux blade renders the glossary grouped by letter and sliced by row range', function () {
    $glossary = [
        ['letter' => 'A', 'term' => 'Ambiente', 'definition' => 'Definicion de ambiente.', 'abbreviation' => null],
        ['letter' => 'P', 'term' => 'Potencia', 'definition' => 'Definicion de potencia.', 'abbreviation' => 'W'],
        ['letter' => 'U', 'term' => 'UGR', 'definition' => 'Definicion de UGR.', 'abbreviation' => null],
        ['letter' => 'Z', 'term' => 'Zona marginal', 'definition' => 'Definicion de zona marginal.', 'abbreviation' => null],
    ];

    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-07-22T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'PCL', 'right' => '2026-07-22'],
            'metadata' => [],
            'luminaires' => [],
            'glossary' => $glossary,
        ],
        'pages' => [
            [
                'id' => 'page-glossary',
                'kind' => 'glossary',
                'sectionId' => 'glossary',
                'pageNumber' => 1,
                'title' => 'Glosario',
                'subtitle' => '',
                'assetIds' => [],
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
                'rowRangeStart' => 1,
                'rowRangeEnd' => 3,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    // Página de continuación: solo filas 2-3 (Potencia, UGR), no Ambiente ni Zona marginal.
    $view->assertDontSee('Definicion de ambiente.');
    $view->assertDontSee('Definicion de zona marginal.');
    $view->assertSee('Definicion de potencia.');
    $view->assertSee('Definicion de UGR.');
    // Encabezados de letra de agrupación.
    $view->assertSeeInOrder(['P', 'Potencia', 'U', 'UGR']);
});

test('formal dialux blade renders the engine-calculated UGR reference table with its disclaimer (Fase 15, Parte B)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-08-04T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-08-04'],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-3',
                    'name' => 'Downlight con fotometria real',
                    'model' => 'recessed',
                    'brand' => 'Regiolux',
                    'articleNumber' => 'DALL-21W',
                    'lumens' => 2014,
                    'powerWatts' => 21,
                    'efficiency' => 95.9,
                    'quantity' => 1,
                    'reportData' => [
                        'ugrTableComputed' => [
                            'provenance' => 'engine-calculated',
                            'method' => 'Motor propio (evaluateUGR, Fase 9) sobre salas de referencia normalizadas',
                            'disclaimer' => 'Cálculo propio con el motor de esta plataforma — NO es una reproducción certificada de la tabla CIE 117 publicada por el fabricante.',
                            'shr' => 0.25,
                            'reflectances' => ['ceiling' => 70, 'wall' => 50, 'floor' => 20],
                            'entries' => [
                                ['roomLabel' => '4×4 m (2H×2H)', 'ugrCrosswise' => 19.4, 'ugrEndwise' => 18.1],
                                ['roomLabel' => '24×16 m (12H×8H)', 'ugrCrosswise' => 21.7, 'ugrEndwise' => 20.9],
                            ],
                        ],
                    ],
                ],
            ],
        ],
        'pages' => [
            [
                'id' => 'page-product-sheet-fixture-3',
                'kind' => 'product-sheet',
                'sectionId' => 'product-sheet:fixture-3',
                'pageNumber' => 1,
                'title' => 'Ficha de producto: Downlight con fotometria real',
                'subtitle' => 'recessed',
                'assetIds' => [],
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('4×4 m (2H×2H)');
    $view->assertSee('24×16 m (12H×8H)');
    $view->assertSee('NO es una reproducción certificada');
    $view->assertDontSee('Información UGR no disponible');
});

test('formal dialux blade renders the full 5-reflectance UGR grid in a full-width section, not the narrow single-combo table (Ronda 21c)', function () {
    $view = $this->view('dialux.export.formal-pdf', [
        'document' => [
            'title' => 'Proyecto Demo · Reporte DIAlux',
            'subtitle' => 'Planta Baja',
            'generatedAt' => '2026-08-17T10:00:00Z',
            'header' => ['title' => 'Proyecto Demo', 'subtitle' => 'Planta Baja'],
            'footer' => ['left' => 'DIAlux Web', 'right' => '2026-08-17'],
            'metadata' => [],
            'luminaires' => [
                [
                    'id' => 'fixture-3',
                    'name' => 'Downlight con fotometria real',
                    'model' => 'recessed',
                    'brand' => 'Regiolux',
                    'articleNumber' => 'DALL-21W',
                    'lumens' => 2014,
                    'powerWatts' => 21,
                    'efficiency' => 95.9,
                    'quantity' => 1,
                    'reportData' => [
                        'ugrTablesComputed' => array_map(
                            fn (array $reflectances) => [
                                'provenance' => 'engine-calculated',
                                'method' => 'Motor propio (evaluateUGR, Fase 9) sobre salas de referencia normalizadas',
                                'disclaimer' => 'Cálculo propio con el motor de esta plataforma — NO es una reproducción certificada de la tabla CIE 117 publicada por el fabricante.',
                                'shr' => 0.25,
                                'reflectances' => $reflectances,
                                'entries' => [
                                    ['roomLabel' => '4×4 m (2H×2H)', 'ugrCrosswise' => 19.4, 'ugrEndwise' => 18.1],
                                ],
                            ],
                            [
                                ['ceiling' => 70, 'wall' => 50, 'floor' => 20],
                                ['ceiling' => 70, 'wall' => 30, 'floor' => 20],
                                ['ceiling' => 50, 'wall' => 50, 'floor' => 20],
                                ['ceiling' => 50, 'wall' => 30, 'floor' => 20],
                                ['ceiling' => 30, 'wall' => 30, 'floor' => 20],
                            ],
                        ),
                    ],
                ],
            ],
        ],
        'pages' => [
            [
                'id' => 'page-product-sheet-fixture-3',
                'kind' => 'product-sheet',
                'sectionId' => 'product-sheet:fixture-3',
                'pageNumber' => 1,
                'title' => 'Ficha de producto: Downlight con fotometria real',
                'subtitle' => 'recessed',
                'assetIds' => [],
                'assets' => [],
                'notes' => [],
                'ambientDetail' => null,
            ],
        ],
        'coverAsset' => null,
        'tocPages' => [],
        'contentPages' => [],
        'tocChunks' => [],
    ]);

    $view->assertSee('4×4 m (2H×2H)');
    // Las 5 combinaciones de reflectancia deben aparecer como encabezados de columna.
    $view->assertSee('70/50/20');
    $view->assertSee('70/30/20');
    $view->assertSee('50/50/20');
    $view->assertSee('50/30/20');
    $view->assertSee('30/30/20');
    $view->assertSee('NO es una reproducción certificada');
    $view->assertDontSee('Información UGR no disponible');
});

test('accepts document.luminaires.*.reportData.ugrTableComputed (Fase 15, Parte B)', function () {
    $user = User::factory()->create();
    $project = DialuxProject::factory()->for($user)->create();

    $payload = minimalValidFormalDocumentPayload($project->id);
    $payload['document']['luminaires'] = [
        [
            'id' => 'fixture-3',
            'name' => 'Downlight con fotometria real',
            'model' => 'recessed',
            'brand' => 'Regiolux',
            'articleNumber' => 'DALL-21W',
            'fixtureShape' => null,
            'shape' => null,
            'lumens' => 2014,
            'powerWatts' => 21,
            'efficiency' => 95.9,
            'roomName' => null,
            'ambientName' => null,
            'quantity' => 1,
            'reportData' => [
                'ugrTableComputed' => [
                    'provenance' => 'engine-calculated',
                    'method' => 'Motor propio (evaluateUGR, Fase 9) sobre salas de referencia normalizadas',
                    'disclaimer' => 'Cálculo propio — no es una reproducción certificada de la tabla CIE 117.',
                    'shr' => 0.25,
                    'reflectances' => ['ceiling' => 70, 'wall' => 50, 'floor' => 20],
                    'entries' => [
                        ['roomLabel' => '4×4 m (2H×2H)', 'ugrCrosswise' => 19.4, 'ugrEndwise' => 18.1],
                    ],
                ],
            ],
        ],
    ];

    $response = $this->actingAs($user)->postJson(route('dialux.formal-export'), $payload);

    $response->assertOk();
    $response->assertHeader('content-type', 'application/pdf');
});
