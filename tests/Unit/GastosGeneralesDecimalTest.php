<?php

use App\Support\GastosGeneralesDecimal as DecimalAmount;

it('calcula montos sin errores binarios de coma flotante', function () {
    expect(DecimalAmount::storage(DecimalAmount::add('0.1', '0.2')))
        ->toBe('0.3000')
        ->and(DecimalAmount::of('0.3')->toFloat())->toBe(0.3);
});

it('calcula porcentajes con redondeo decimal estable', function () {
    $controlConcurrente = DecimalAmount::percent('1475849.29', '0.6');

    expect(DecimalAmount::storage($controlConcurrente))
        ->toBe('8855.0957');
});

it('evita divisiones por cero en indicadores', function () {
    expect(DecimalAmount::storage(DecimalAmount::percentageOf('120', '0')))
        ->toBe('0.0000');
});
