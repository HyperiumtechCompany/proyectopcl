<?php

namespace App\Http\Controllers\Dialux;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dialux\StoreOutletProductRequest;
use App\Http\Requests\Dialux\UpdateOutletProductRequest;
use App\Models\OutletProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class OutletProductController extends Controller
{
    /**
     * Lista tomacorrientes disponibles para el usuario autenticado.
     * Devuelve: catálogo global + productos propios del usuario.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $products = OutletProduct::query()
            ->availableFor($userId)
            ->orderBy('is_global', 'desc')
            ->orderBy('manufacturer')
            ->orderBy('name')
            ->get()
            ->map(fn (OutletProduct $p) => $this->formatProduct($p, userId: $userId));

        return response()->json([
            'products' => $products,
            'total' => $products->count(),
        ]);
    }

    /**
     * Crea un tomacorriente propio del usuario.
     */
    public function store(StoreOutletProductRequest $request): JsonResponse
    {
        $userId = $request->user()?->id;

        $product = OutletProduct::query()->create(array_merge($request->validated(), [
            'user_id' => $userId,
            'is_global' => $request->boolean('is_global'),
            'product_image_path' => $this->storeProductMedia($request->file('product_image'), $userId),
        ]));

        return response()->json([
            'product' => $this->formatProduct($product, userId: $userId),
            'message' => 'Tomacorriente creado correctamente.',
        ], 201);
    }

    /**
     * Edita un tomacorriente propio del usuario.
     */
    public function update(UpdateOutletProductRequest $request, int $productId): JsonResponse
    {
        $userId = $request->user()?->id;
        $product = OutletProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        $data = $request->validated();
        if ($request->hasFile('product_image')) {
            $data['product_image_path'] = $this->storeProductMedia($request->file('product_image'), $userId);
        }

        $product->update($data);

        return response()->json([
            'product' => $this->formatProduct($product, userId: $userId),
            'message' => 'Tomacorriente actualizado.',
        ]);
    }

    /**
     * Elimina un tomacorriente propio del usuario (soft delete).
     */
    public function destroy(Request $request, int $productId): JsonResponse
    {
        $product = OutletProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        $product->delete();

        return response()->json(['message' => 'Tomacorriente eliminado.']);
    }

    /**
     * Comparte o deja de compartir un tomacorriente propio con el resto de usuarios.
     * Solo el dueño del producto puede cambiar su visibilidad.
     */
    public function share(Request $request, int $productId): JsonResponse
    {
        $request->validate([
            'is_global' => ['required', 'boolean'],
        ]);

        $product = OutletProduct::query()
            ->forUser($request->user()->id)
            ->findOrFail($productId);

        $product->update(['is_global' => $request->boolean('is_global')]);

        return response()->json([
            'product' => $this->formatProduct($product, userId: $request->user()->id),
            'message' => $product->is_global
                ? 'Tomacorriente compartido con todos los usuarios.'
                : 'Tomacorriente dejó de compartirse.',
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function formatProduct(OutletProduct $product, ?int $userId = null): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'manufacturer' => $product->manufacturer,
            'catalog_number' => $product->catalog_number,
            'device_type' => $product->device_type,
            'rated_power_w' => $product->rated_power_w,
            'ip_rating' => $product->ip_rating,
            'product_image_path' => $product->product_image_path,
            'product_image_url' => $product->product_image_path ? asset('storage/'.$product->product_image_path) : null,
            'is_global' => $product->is_global,
            'is_owner' => $userId !== null && $product->user_id === $userId,
            'created_at' => $product->created_at,
        ];
    }

    private function storeProductMedia(?UploadedFile $file, ?int $userId): ?string
    {
        if (! $file) {
            return null;
        }

        $ownerDirectory = $userId ? "user_{$userId}" : 'global';

        return $file->store("dialux/outlet-catalog/{$ownerDirectory}/images", 'public');
    }
}
