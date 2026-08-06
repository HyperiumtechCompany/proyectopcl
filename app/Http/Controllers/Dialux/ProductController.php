<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\ImportProductRequest;
use App\Http\Requests\Dialux\StoreManualProductRequest;
use App\Http\Requests\Dialux\UpdateProductRequest;
use App\Models\LuminaireProduct;
use App\Services\ProductImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function __construct(private readonly ProductImportService $importService) {}

    /**
     * Lista productos disponibles para el usuario autenticado.
     * Devuelve: catálogo global + productos propios del usuario.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $products = LuminaireProduct::query()
            ->availableFor($userId)
            ->orderBy('is_global', 'desc')
            ->orderBy('manufacturer')
            ->orderBy('name')
            ->get()
            ->map(fn (LuminaireProduct $p) => $this->formatProduct($p, userId: $userId));

        return response()->json([
            'products' => $products,
            'total' => $products->count(),
        ]);
    }

    /**
     * Importa un archivo fotométrico (.ies, .ldt, .gldf) y crea el producto.
     */
    public function import(ImportProductRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $result = $this->importService->import(
            file: $request->file('file'),
            userId: $userId,
            overrides: array_filter([
                'name' => $request->input('name'),
                'manufacturer' => $request->input('manufacturer'),
                'product_image_path' => $this->storeProductMedia($request->file('product_image'), $userId, 'images'),
                'brand_logo_path' => $this->storeProductMedia($request->file('brand_logo'), $userId, 'logos'),
                'normative_standard' => $request->input('normative_standard'),
                'fixture_type' => $request->input('fixture_type'),
                'fixture_shape' => $request->input('fixture_shape'),
            ]),
        );

        $product = $result['product'];
        $warnings = $result['warnings'];

        return response()->json([
            'product' => $this->formatProduct($product, userId: $userId),
            'warnings' => $warnings,
            'message' => 'Producto importado correctamente.',
        ], 201);
    }

    /**
     * Crea una luminaria propia a partir de datos ingresados manualmente
     * (sin archivo IES/LDT), sintetizando su distribución fotométrica.
     */
    public function storeManual(StoreManualProductRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $product = $this->importService->createManual(
            data: array_merge($request->validated(), [
                'product_image_path' => $this->storeProductMedia($request->file('product_image'), $userId, 'images'),
                'brand_logo_path' => $this->storeProductMedia($request->file('brand_logo'), $userId, 'logos'),
            ]),
            userId: $userId,
        );

        return response()->json([
            'product' => $this->formatProduct($product, userId: $userId),
            'message' => 'Luminaria creada correctamente.',
        ], 201);
    }

    /**
     * Devuelve los detalles completos de un producto, incluida la web fotométrica.
     */
    public function show(Request $request, int $productId): JsonResponse
    {
        $userId = $request->user()?->id;
        $product = LuminaireProduct::query()
            ->availableFor($userId)
            ->findOrFail($productId);

        return response()->json([
            'product' => $this->formatProduct($product, withWeb: true, userId: $userId),
        ]);
    }

    /**
     * Actualiza los datos editables de una luminaria propia.
     */
    public function update(UpdateProductRequest $request, int $productId): JsonResponse
    {
        $product = LuminaireProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        // El archivo fotométrico original NO se vuelve a subir en este
        // endpoint (solo edita metadatos) — si el nombre nuevo diverge del
        // nombre que el propio archivo declara internamente (guardado en
        // `metadata.source_internal_name` al importar/reparar), el producto
        // queda mostrando una etiqueta que ya no corresponde a los datos de
        // flujo/potencia realmente almacenados. Avisar aquí es el único
        // punto que puede detectar ese desfase en el momento del renombre.
        $internalName = is_string($product->metadata['source_internal_name'] ?? null)
            ? trim($product->metadata['source_internal_name'])
            : null;
        $newName = trim((string) $request->validated('name'));
        $warnings = [];
        if ($internalName !== null && $internalName !== '' && $newName !== ''
            && strcasecmp($internalName, $newName) !== 0
            && strcasecmp($internalName, trim((string) $product->name)) === 0) {
            $warnings[] = "El nuevo nombre (\"{$newName}\") ya no coincide con el nombre interno del archivo fotométrico almacenado (\"{$internalName}\"). El archivo no se reemplaza al renombrar — si el producto real es otra variante, vuelve a importarlo con el archivo correcto en vez de solo renombrarlo.";
        }

        $product->update($request->validated());

        return response()->json([
            'product' => $this->formatProduct($product->refresh(), userId: $request->user()->id),
            'warnings' => $warnings,
            'message' => 'Luminaria actualizada correctamente.',
        ]);
    }

    /**
     * Elimina un producto propio del usuario (soft delete).
     */
    public function destroy(Request $request, int $productId): JsonResponse
    {
        $product = LuminaireProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        $product->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    /**
     * Comparte o deja de compartir una luminaria propia con el resto de usuarios.
     * Solo el dueño del producto puede cambiar su visibilidad.
     */
    public function share(Request $request, int $productId): JsonResponse
    {
        $request->validate([
            'is_global' => ['required', 'boolean'],
        ]);

        $product = LuminaireProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        $product->update(['is_global' => $request->boolean('is_global')]);

        return response()->json([
            'product' => $this->formatProduct($product, userId: $request->user()->id),
            'message' => $product->is_global
                ? 'Luminaria compartida con todos los usuarios.'
                : 'Luminaria dejó de compartirse.',
        ]);
    }

    /**
     * Asigna un producto a un proyecto DIAlux (registra en project_products).
     */
    public function assign(Request $request, int $productId): JsonResponse
    {
        $request->validate([
            'project_id' => ['required', 'string', 'max:64'],
            'quantity_used' => ['nullable', 'integer', 'min:0'],
            'placement_config' => ['nullable', 'array'],
        ]);

        $userId = $request->user()?->id;
        $product = LuminaireProduct::query()
            ->availableFor($userId)
            ->findOrFail($productId);

        DB::table('project_products')->updateOrInsert(
            ['project_id' => $request->project_id, 'product_id' => $product->id],
            [
                'quantity_used' => $request->integer('quantity_used', 0),
                'placement_config' => json_encode($request->input('placement_config', [])),
                'product_snapshot' => json_encode($this->formatProduct($product, withWeb: true)),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );

        return response()->json([
            'message' => 'Producto asignado al proyecto.',
            'product_id' => $product->id,
            'project_id' => $request->project_id,
        ]);
    }

    /**
     * Descarga el archivo fotométrico original del producto.
     */
    public function downloadSource(Request $request, int $productId): mixed
    {
        $userId = $request->user()?->id;
        $product = LuminaireProduct::query()
            ->availableFor($userId)
            ->findOrFail($productId);

        if (! $product->source_file_path || ! Storage::exists($product->source_file_path)) {
            return response()->json(['error' => 'Archivo fuente no disponible.'], 404);
        }

        return Storage::download($product->source_file_path, $product->source_file_name);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function formatProduct(LuminaireProduct $product, bool $withWeb = false, ?int $userId = null): array
    {
        $data = [
            'id' => $product->id,
            'name' => $product->name,
            'manufacturer' => $product->manufacturer,
            'catalog_number' => $product->catalog_number,
            'article_number' => $product->article_number,
            'source_format' => $product->source_format,
            'source_file_name' => $product->source_file_name,
            'product_image_path' => $product->product_image_path,
            'product_image_url' => $product->product_image_path ? asset('storage/'.$product->product_image_path) : null,
            'brand_logo_path' => $product->brand_logo_path,
            'brand_logo_url' => $product->brand_logo_path ? asset('storage/'.$product->brand_logo_path) : null,
            'total_lumens' => $product->total_lumens,
            'power_watts' => $product->power_watts,
            'cct' => $product->cct,
            'cri_ra' => $product->cri_ra,
            'beam_angle_50' => $product->beam_angle_50,
            'beam_angle_10' => $product->beam_angle_10,
            'max_candela' => $product->max_candela,
            'fixture_type' => $product->fixture_type,
            'fixture_shape' => $product->fixture_shape,
            'normative_standard' => $product->normative_standard,
            'is_global' => $product->is_global,
            'is_owner' => $userId !== null && $product->user_id === $userId,
            'efficiency' => $product->efficiency,
            'distribution_type' => $product->distribution_type,
            'photometric_summary' => $product->photometric_summary,
            'dimensions' => $product->dimensions,
            'luminous_opening' => $product->luminous_opening,
            'report_data' => $product->report_data,
            'report_assets' => $product->report_assets,
            'created_at' => $product->created_at,
        ];

        if ($withWeb) {
            $data['photometric_web'] = $product->photometric_web;
        }

        return $data;
    }

    private function storeProductMedia(?UploadedFile $file, ?int $userId, string $type): ?string
    {
        if (! $file) {
            return null;
        }

        $ownerDirectory = $userId ? "user_{$userId}" : 'global';

        return $file->store("dialux/product-catalog/{$ownerDirectory}/{$type}", 'public');
    }
}
