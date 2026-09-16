<?php

use App\Http\Requests\GuardarRhEmRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

uses(TestCase::class);

function validarRhEm(array $data): bool
{
    $request = new GuardarRhEmRequest;
    $request->replace($data);
    $validator = Validator::make($data, $request->rules());
    foreach ($request->after() as $callback) {
        $validator->after($callback);
    }

    return $validator->passes();
}

it('permite una hoja vacía y el último día de un febrero bisiesto', function () {
    expect(validarRhEm(['project_id' => 1, 'mes' => '2026-07', 'personal' => []]))->toBeTrue();
    expect(validarRhEm([
        'project_id' => 1,
        'mes' => '2028-02',
        'personal' => [['id' => 'r1', 'cargo' => 'Residente', 'nombre' => 'Ana', 'dias' => [29]]],
    ]))->toBeTrue();
});

it('rechaza días fuera del mes e identificadores duplicados', function () {
    $persona = ['id' => 'r1', 'cargo' => 'Residente', 'nombre' => 'Ana', 'dias' => [1]];

    expect(validarRhEm([
        'project_id' => 1,
        'mes' => '2026-02',
        'personal' => [[...$persona, 'dias' => [29]]],
    ]))->toBeFalse();
    expect(validarRhEm([
        'project_id' => 1,
        'mes' => '2026-07',
        'personal' => [$persona, $persona],
    ]))->toBeFalse();
    expect(validarRhEm([
        'project_id' => 1,
        'mes' => '2026-07',
        'personal' => [[...$persona, 'dias' => [1, 1]]],
    ]))->toBeFalse();
});
