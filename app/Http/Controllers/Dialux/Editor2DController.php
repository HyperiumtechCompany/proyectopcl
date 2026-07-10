<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\FormalExportRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class Editor2DController extends Controller
{
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
        $document = $request->validated('document');
        $assets = collect($document['assets'] ?? []);
        $assetsById = $assets->keyBy('id');
        $ambientDetailsById = collect($document['ambientDetails'] ?? [])->keyBy('ambientId');
        $pages = collect($document['pages'] ?? [])
            ->sortBy('pageNumber')
            ->map(function (array $page) use ($assetsById, $ambientDetailsById): array {
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
            'tocChunks' => collect($document['toc'] ?? [])->chunk(14)->values()->all(),
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

        return $pdf->download(($document['fileBaseName'] ?? 'dialux-reporte-formal').'.pdf');
    }
}
