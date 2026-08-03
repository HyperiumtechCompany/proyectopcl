<?php

namespace App\Http\Controllers\Dialux;

use App\Concerns\AuthorizesDialuxProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\FormalExportRequest;
use App\Models\Dialux\DialuxProject;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use setasign\Fpdi\Fpdi;
use Symfony\Component\HttpFoundation\HeaderUtils;

class Editor2DController extends Controller
{
    use AuthorizesDialuxProject;

    private const LANDSCAPE_PAGE_KINDS = ['ambient-list', 'room-ambient-list', 'calculation-object-list'];

    private const ASPECT_RATIO_PAGE_KINDS = ['terrain-cad', 'terrain-architectural'];

    // Mismas cajas (mm) que reciben $renderAsset en formal-pdf.blade.php para
    // estos dos page kinds — se usan aquí solo para decidir qué orientación
    // de página aprovecha mejor el plano (ver isLandscapePage()).
    private const PORTRAIT_PLAN_BOX = [188.0, 226.0];

    private const LANDSCAPE_PLAN_BOX = [255.0, 140.0];

    // Debe coincidir con TOC_ROWS_PER_PAGE en buildDialuxFormalDocument.ts:
    // ese valor decide cuántas páginas de TOC genera el documento, este decide
    // cuántas entradas se muestran por página al renderizar — si difieren, el
    // índice queda mal cortado (páginas de más/de menos o entradas repetidas).
    private const TOC_ROWS_PER_PAGE = 24;

    /**
     * Importa un archivo DWG y lo procesa.
     * TODO: integrar conversor DWG→SVG o DWG→JSON.
     */
    public function importDWG(Request $request)
    {
        $request->validate([
            'dwg_file' => 'required|file|max:10240',
        ]);

        $file = $request->file('dwg_file');
        $filename = time().'_'.$file->getClientOriginalName();
        $path = $file->storeAs('dialux/dwg_imports', $filename, 'public');

        return response()->json([
            'message' => 'Archivo DWG recibido correctamente.',
            'path' => $path,
            'svg' => '<svg width="400" height="300"><rect width="400" height="300" fill="#0d0f14"/><text x="50%" y="50%" fill="#6b7280" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif">DWG — Conversión pendiente</text></svg>',
        ]);
    }

    /**
     * Exporta un PDF formal A4 del documento DIAlux.
     */
    public function formalExport(FormalExportRequest $request): Response
    {
        $this->authorizeProyecto(
            DialuxProject::findOrFail($request->validated('dialux_project_id'))
        );

        // Un informe de cientos de paginas con muchos assets embebidos puede
        // tardar; se acota para no dejar un worker colgado indefinidamente
        // (el php.ini de este entorno trae max_execution_time=0/ilimitado).
        // set_time_limit() reinicia el contador del PROCESO ENTERO, no solo
        // de esta request: en PHP-FPM cada request es un proceso nuevo asi
        // que no importa, pero bajo Pest (muchos tests en un mismo proceso)
        // un test posterior sin relacion podia fallar por "tiempo excedido"
        // si no se restaura el limite original al terminar.
        $originalTimeLimit = (int) ini_get('max_execution_time');
        set_time_limit(120);

        try {
            return $this->buildFormalExportResponse($request);
        } finally {
            set_time_limit($originalTimeLimit);
        }
    }

    private function buildFormalExportResponse(FormalExportRequest $request): Response
    {
        $document = $request->validated('document');
        $assets = collect($document['assets'] ?? []);
        $assetsById = $assets->keyBy('id');
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
                $page['isLandscape'] = $this->isLandscapePage($page);

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

        $viewData = [
            'document' => $document,
            'coverAsset' => $coverAsset,
            'tocPages' => $tocPages,
            'contentPages' => $contentPages,
            'tocChunks' => collect($document['toc'] ?? [])->chunk(self::TOC_ROWS_PER_PAGE)->values()->all(),
        ];

        // Dompdf renderiza un unico tamaño/orientacion de pagina por documento
        // (no soporta el binding CSS "page: landscape" por pagina individual,
        // pese a que el CSS lo declara). Para lograr paginas realmente
        // apaisadas (plano general, tablas de ambientes/objetos de calculo)
        // se generan 2 documentos por separado -uno portrait, uno landscape-
        // y se fusionan en el orden original con FPDI.
        $portraitPages = array_values(array_filter($pages, fn (array $p): bool => ! $p['isLandscape']));
        $landscapePages = array_values(array_filter($pages, fn (array $p): bool => $p['isLandscape']));

        $mergedPdf = $this->renderMergedPdf($viewData, $pages, $portraitPages, $landscapePages);

        $fileName = $this->safeDownloadFileName($document['fileBaseName'] ?? null).'.pdf';

        return response($mergedPdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition(
                HeaderUtils::DISPOSITION_ATTACHMENT,
                $fileName,
                str_replace('%', '', Str::ascii($fileName))
            ),
            'Content-Length' => (string) strlen($mergedPdf),
        ]);
    }

    /**
     * Misma regla que antes vivía embebida en el Blade (@php de la sección
     * ~668-679 de formal-pdf.blade.php): tablas de ambientes/objetos de
     * cálculo siempre van apaisadas; los planos de terreno solo si su asset
     * principal es más ancho que alto.
     */
    private function isLandscapePage(array $page): bool
    {
        if (in_array($page['kind'] ?? '', self::LANDSCAPE_PAGE_KINDS, true)) {
            return true;
        }

        if (in_array($page['kind'] ?? '', self::ASPECT_RATIO_PAGE_KINDS, true)) {
            $mainAsset = $page['assets'][0] ?? null;
            if (is_array($mainAsset) && isset($mainAsset['width'], $mainAsset['height'])) {
                $assetWidth = (float) $mainAsset['width'];
                $assetHeight = (float) $mainAsset['height'];

                // No alcanza con "es más ancho que alto": un edificio angosto
                // y muy alto también puede verse más grande en una página
                // apaisada si se gira 90° (ver $renderAsset/autoRotate en el
                // Blade). Se elige la orientación de página que realmente
                // deja más grande el plano, no solo la que "coincide" con su
                // forma.
                $portraitArea = $this->bestFitArea(self::PORTRAIT_PLAN_BOX[0], self::PORTRAIT_PLAN_BOX[1], $assetWidth, $assetHeight);
                $landscapeArea = $this->bestFitArea(self::LANDSCAPE_PLAN_BOX[0], self::LANDSCAPE_PLAN_BOX[1], $assetWidth, $assetHeight);

                return $landscapeArea > $portraitArea;
            }
        }

        return false;
    }

    /**
     * Área máxima que ocupa un asset dentro de una caja (mm), probando con y
     * sin girarlo 90° — mismo criterio que usa $renderAsset con autoRotate.
     */
    private function bestFitArea(float $boxWidthMm, float $boxHeightMm, float $assetWidth, float $assetHeight): float
    {
        $normalScale = min($boxWidthMm / $assetWidth, $boxHeightMm / $assetHeight);
        $rotatedScale = min($boxWidthMm / $assetHeight, $boxHeightMm / $assetWidth);
        $scale = max($normalScale, $rotatedScale);

        return ($assetWidth * $scale) * ($assetHeight * $scale);
    }

    /**
     * Renderiza portrait/landscape por separado (cada uno con su propio
     * setPaper) y los fusiona en el orden original de $orderedPages. Si un
     * grupo está vacío se evita el render/merge innecesario.
     *
     * @param  array<int, array>  $orderedPages  Todas las páginas, orden final.
     * @param  array<int, array>  $portraitPages  Subconjunto portrait, mismo orden relativo.
     * @param  array<int, array>  $landscapePages  Subconjunto landscape, mismo orden relativo.
     */
    private function renderMergedPdf(array $viewData, array $orderedPages, array $portraitPages, array $landscapePages): string
    {
        $portraitPath = null;
        $landscapePath = null;

        try {
            if ($portraitPages !== []) {
                $portraitPath = $this->renderPagesToTempPdf($viewData, $portraitPages, 'portrait');
            }
            if ($landscapePages !== []) {
                $landscapePath = $this->renderPagesToTempPdf($viewData, $landscapePages, 'landscape');
            }

            if ($portraitPath !== null && $landscapePath === null) {
                return file_get_contents($portraitPath);
            }
            if ($landscapePath !== null && $portraitPath === null) {
                return file_get_contents($landscapePath);
            }

            $fpdi = new Fpdi;
            $portraitIndex = 0;
            $landscapeIndex = 0;

            foreach ($orderedPages as $page) {
                $sourcePath = $page['isLandscape'] ? $landscapePath : $portraitPath;
                if ($sourcePath === null) {
                    continue;
                }

                $fpdi->setSourceFile($sourcePath);
                $pageNumberInSource = $page['isLandscape'] ? ++$landscapeIndex : ++$portraitIndex;
                $templateId = $fpdi->importPage($pageNumberInSource);
                $size = $fpdi->getTemplateSize($templateId);
                $fpdi->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $fpdi->useTemplate($templateId);
            }

            return $fpdi->Output('S');
        } finally {
            foreach ([$portraitPath, $landscapePath] as $tempPath) {
                if ($tempPath !== null && file_exists($tempPath)) {
                    unlink($tempPath);
                }
            }
        }
    }

    private function renderPagesToTempPdf(array $viewData, array $pages, string $orientation): string
    {
        $pdf = Pdf::loadView('dialux.export.formal-pdf', [...$viewData, 'pages' => $pages])
            ->setPaper('a4', $orientation)
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isCssFloatEnabled' => true,
                'isRemoteEnabled' => false,
                'defaultFont' => 'DejaVu Sans',
                'dpi' => 96,
                'debugKeepTemp' => false,
            ]);

        $path = tempnam(sys_get_temp_dir(), 'dialux_export_');
        file_put_contents($path, $pdf->output());

        return $path;
    }

    /**
     * Neutraliza separadores de ruta y caracteres de control: un
     * fileBaseName con "/" o "\" hace que Symfony's HeaderUtils::makeDisposition
     * lance una excepcion no controlada (500) en vez de degradar con gracia.
     */
    private function safeDownloadFileName(?string $fileBaseName): string
    {
        $sanitized = preg_replace('/[^\pL\pN _.-]+/u', '_', $fileBaseName ?? '') ?? '';
        $sanitized = trim($sanitized, " ._\t\n\r\0\x0B");

        return $sanitized !== '' ? $sanitized : 'dialux-reporte-formal';
    }
}
