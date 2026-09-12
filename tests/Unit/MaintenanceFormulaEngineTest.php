<?php

use App\Domain\Mantenimiento\Formula\DecimalMath;
use App\Domain\Mantenimiento\Formula\FormulaContext;
use App\Domain\Mantenimiento\Formula\FormulaEvaluator;
use App\Domain\Mantenimiento\Formula\FormulaException;
use App\Domain\Mantenimiento\Formula\FormulaParser;

$cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/Mantenimiento/formula_conformance.json'), true, flags: JSON_THROW_ON_ERROR);

it('keeps the backend formula contract', function (array $case) {
    $context = new FormulaContext(
        rowValue: fn (string $key) => $case['row'][$key] ?? '0',
        cellValue: fn (string $id) => $case['cells'][$id] ?? '0',
        childrenSum: fn (string $key) => $case['children'][$key] ?? '0',
        columnSum: fn (string $sheet, string $key) => $case['columns'][$sheet.':'.$key] ?? '0',
    );

    try {
        $ast = (new FormulaParser)->parse($case['formula']);
        $result = (new DecimalMath)->round((new FormulaEvaluator(new DecimalMath))->evaluate($ast, $context)['value'], 2);
        expect($case)->not->toHaveKey('error')->and(number_format((float) $result, 2, '.', ''))->toBe($case['expected']);
    } catch (FormulaException $exception) {
        expect($exception->errorCode)->toBe($case['error'] ?? null);
    }
})->with(array_map(fn (array $case) => [$case], $cases));
