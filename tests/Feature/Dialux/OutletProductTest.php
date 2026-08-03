<?php

use App\Models\OutletProduct;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

test('authenticated users can create an outlet product', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->post(route('dialux.outlet-products.store'), [
            'name' => 'Tomacorriente Bticino Doble',
            'manufacturer' => 'Bticino',
            'catalog_number' => 'BT-500W',
            'device_type' => 'outlet_high_180',
            'rated_power_w' => 500,
            'ip_rating' => 'IP65',
        ]);

    $response->assertCreated()
        ->assertJsonPath('product.name', 'Tomacorriente Bticino Doble')
        ->assertJsonPath('product.manufacturer', 'Bticino')
        ->assertJsonPath('product.device_type', 'outlet_high_180')
        ->assertJsonPath('product.rated_power_w', 500)
        ->assertJsonPath('product.is_global', false)
        ->assertJsonPath('product.is_owner', true);

    expect(OutletProduct::query()->where('user_id', $user->id)->count())->toBe(1);
});

test('index returns global products plus the user own products, not other users products', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    OutletProduct::query()->create([
        'user_id' => null,
        'name' => 'Genérico global',
        'device_type' => 'outlet_floor',
        'rated_power_w' => 180,
        'is_global' => true,
    ]);
    OutletProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Propio del dueño',
        'device_type' => 'outlet_rack',
        'rated_power_w' => 300,
        'is_global' => false,
    ]);
    OutletProduct::query()->create([
        'user_id' => $other->id,
        'name' => 'Propio de otro usuario',
        'device_type' => 'outlet_rack',
        'rated_power_w' => 300,
        'is_global' => false,
    ]);

    $response = $this->actingAs($owner)->get(route('dialux.outlet-products.index'));

    $response->assertOk();
    $names = collect($response->json('products'))->pluck('name');
    expect($names)->toContain('Genérico global')
        ->toContain('Propio del dueño')
        ->not->toContain('Propio de otro usuario');
});

test('owners can delete their own outlet product but not another users product', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    $ownProduct = OutletProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Propio',
        'device_type' => 'outlet_floor',
        'rated_power_w' => 180,
    ]);

    $this->actingAs($other)
        ->delete(route('dialux.outlet-products.destroy', $ownProduct->id))
        ->assertNotFound();

    $this->actingAs($owner)
        ->delete(route('dialux.outlet-products.destroy', $ownProduct->id))
        ->assertOk();

    expect(OutletProduct::query()->find($ownProduct->id))->toBeNull();
});

test('owners can toggle sharing (is_global) on their own outlet product', function () {
    $owner = User::factory()->create();

    $product = OutletProduct::query()->create([
        'user_id' => $owner->id,
        'name' => 'Propio',
        'device_type' => 'outlet_floor',
        'rated_power_w' => 180,
        'is_global' => false,
    ]);

    $response = $this
        ->actingAs($owner)
        ->patch(route('dialux.outlet-products.share', $product->id), ['is_global' => true]);

    $response->assertOk()->assertJsonPath('product.is_global', true);
    expect($product->fresh()->is_global)->toBeTrue();
});
