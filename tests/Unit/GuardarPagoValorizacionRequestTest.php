<?php

use App\Http\Requests\GuardarPagoValorizacionRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

uses(TestCase::class);

it('distingue importes no informados de ceros confirmados', function () {
    $rules = (new GuardarPagoValorizacionRequest)->rules();
    $base = ['project_id' => 1, 'periodo_key' => '2026-07'];

    expect(Validator::make($base, $rules)->passes())->toBeTrue();
    expect(Validator::make($base + [
        'reajuste' => 0,
        'penalidades' => 0,
        'monto_pagado' => 0,
    ], $rules)->passes())->toBeTrue();
});

it('rechaza penalidades negativas y fecha de pago sin importe', function () {
    $rules = (new GuardarPagoValorizacionRequest)->rules();
    $base = ['project_id' => 1, 'periodo_key' => '2026-07'];

    expect(Validator::make($base + ['penalidades' => -1], $rules)->fails())->toBeTrue();
    expect(Validator::make($base + ['fecha_pago' => '2026-07-31'], $rules)->fails())->toBeTrue();
});
