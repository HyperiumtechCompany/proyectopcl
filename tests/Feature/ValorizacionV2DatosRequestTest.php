<?php

use App\Http\Requests\ValorizacionV2\CrearValorizacionV2Request;
use App\Http\Requests\ValorizacionV2\GuardarValorizacionV2Request;
use Illuminate\Support\Facades\Validator;

/** Documento con TODAS las secciones de ValorizacionInput (types/valorizacion.ts). */
function documentoCompletoValorizacionV2(): array
{
    return [
        'periodo' => ['numero' => 2, 'mes' => '2026-07-01'],
        'fichaTecnica' => ['datosGenerales' => ['obra' => 'Obra X'], 'plazos' => ['fechaInicioObra' => '2026-06-20', 'plazoEjecucionDias' => 60]],
        'parametros' => ['gastosGenerales' => '0.10', 'utilidad' => '0.07', 'igv' => '0.18'],
        'presupuesto' => ['fuente' => 'excel', 'partidas' => [['id' => 'p-01', 'parentId' => null, 'codigo' => '01', 'descripcion' => 'OBRA']]],
        'calendarios' => ['programado' => ['montos' => ['p-01' => ['2026-06' => '1600.00', '2026-07' => '1600.00']]]],
        'metrados' => ['ejecutado' => ['p-01' => ['2026-06' => '1', '2026-07' => '0.48']]],
        'control' => ['devengados' => ['2026-06' => true]],
        'pagos' => ['rfc' => ['porcentaje' => '0.10', 'modo' => 'primer-pago'], 'porcentajeDetraccion' => '0.04', 'porMes' => ['2026-07' => ['facturaNro' => 'F001-1']], 'adicionales' => []],
        'personal' => ['personas' => [['id' => 'r1', 'nombre' => 'Residente']], 'faltas' => ['r1' => ['2026-07-05']]],
    ];
}

it('guardar conserva el documento completo (calendarios, metrados, pagos, personal…)', function () {
    $datos = documentoCompletoValorizacionV2();
    $validador = Validator::make(['revision' => 3, 'schema_version' => 1, 'datos' => $datos], (new GuardarValorizacionV2Request)->rules());

    expect($validador->passes())->toBeTrue()
        ->and($validador->validated()['datos'])->toEqual($datos);
});

it('crear conserva el documento completo', function () {
    $datos = documentoCompletoValorizacionV2();
    $validador = Validator::make(['nombre' => 'Val 02', 'schema_version' => 1, 'datos' => $datos], (new CrearValorizacionV2Request)->rules());

    expect($validador->passes())->toBeTrue()
        ->and($validador->validated()['datos'])->toEqual($datos);
});

it('sin periodo o presupuesto el documento se rechaza', function () {
    $datos = documentoCompletoValorizacionV2();
    unset($datos['periodo']);

    expect(Validator::make(['revision' => 1, 'schema_version' => 1, 'datos' => $datos], (new GuardarValorizacionV2Request)->rules())->fails())->toBeTrue();
});
