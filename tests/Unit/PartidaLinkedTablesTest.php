<?php

use App\Http\Controllers\PresupuestoController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class);

// Todo lo guardado por CÓDIGO de partida debe seguir a su partida cuando Delphin renumera
// (botón Renumerar, rama indentada bajo un padre nuevo, raíz renombrada).
beforeEach(function () {
    config()->set('database.connections.costos_tenant', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
    DB::purge('costos_tenant');
    $schema = Schema::connection('costos_tenant');

    foreach (['presupuesto_general', 'presupuesto_acus', 'cronograma_valorizado', 'cronograma_ejecutado'] as $table) {
        $schema->create($table, function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('presupuesto_id');
            $t->string('partida', 50)->nullable();
            $t->text('descripcion')->nullable();
            $t->json('distribucion_mensual')->nullable();
        });
    }
    foreach ([
        '2026_09_10_000020_create_mantenimiento_editor_tables.php',
        '2026_10_19_000100_create_gastfin_tables.php',
    ] as $migration) {
        (require database_path('migrations/costos_tenant/'.$migration))->up();
    }

    $db = DB::connection('costos_tenant');
    // Estado ANTES del guardado: ESTRUCTURAS como raíz "01".
    foreach ([['01.01', 'OFICINA'], ['01.02', 'ALMACÉN']] as [$code, $desc]) {
        $db->table('cronograma_valorizado')->insert(['presupuesto_id' => 1, 'partida' => $code, 'descripcion' => $desc, 'distribucion_mensual' => json_encode(['2026-01' => 50])]);
        $db->table('cronograma_ejecutado')->insert(['presupuesto_id' => 1, 'partida' => $code, 'descripcion' => $desc]);
        $db->table('presupuesto_acus')->insert(['presupuesto_id' => 1, 'partida' => $code, 'descripcion' => $desc]);
    }
});

afterEach(function () {
    Schema::connection('costos_tenant')->dropAllTables();
});

function savePresupuesto(array $partidas, array $renames = []): void
{
    $db = DB::connection('costos_tenant');
    $db->table('presupuesto_general')->delete();
    foreach ($partidas as [$code, $desc]) {
        $db->table('presupuesto_general')->insert(['presupuesto_id' => 1, 'partida' => $code, 'descripcion' => $desc]);
    }
    $method = new ReflectionMethod(PresupuestoController::class, 'syncPartidaLinkedTables');
    $method->invoke(app(PresupuestoController::class), $db, 1, $renames);
}

it('moves cronograma valorizado/ejecutado rows with their partidas when Modulo II is placed above (no renames sent)', function () {
    savePresupuesto([['01', 'MODULO II'], ['01.01', 'ESTRUCTURAS'], ['01.01.01', 'OFICINA'], ['01.01.02', 'ALMACÉN']]);

    foreach (['cronograma_valorizado', 'cronograma_ejecutado', 'presupuesto_acus'] as $table) {
        expect(DB::connection('costos_tenant')->table($table)->orderBy('id')->pluck('partida')->all())
            ->toBe(['01.01.01', '01.01.02'], $table);
    }
    expect(json_decode(DB::connection('costos_tenant')->table('cronograma_valorizado')->value('distribucion_mensual'), true))
        ->toBe(['2026-01' => 50]); // los meses valorizados se conservan
});

it('applies the precise renames from Delphin to every linked table (Renumerar closing gaps)', function () {
    savePresupuesto(
        [['01', 'ESTRUCTURAS'], ['01.01', 'ALMACÉN'], ['01.02', 'OFICINA']],
        [['from' => '01.01', 'to' => '01.02'], ['from' => '01.02', 'to' => '01.01']],
    );

    foreach (['cronograma_valorizado', 'cronograma_ejecutado', 'presupuesto_acus'] as $table) {
        expect(DB::connection('costos_tenant')->table($table)->orderBy('id')->pluck('partida', 'descripcion')->all())
            ->toBe(['OFICINA' => '01.02', 'ALMACÉN' => '01.01'], $table);
    }
});

it('never sets aside cronograma rows without a match (only ACU get the "~" mark)', function () {
    savePresupuesto([['05', 'OTRA COSA']]);

    expect(DB::connection('costos_tenant')->table('cronograma_valorizado')->pluck('partida')->all())->toBe(['01.01', '01.02'])
        ->and(DB::connection('costos_tenant')->table('presupuesto_acus')->pluck('partida')->all())->toBe(['~01.01', '~01.02']);
});

it('moves Gast. Fin. levels with a renamed root, including a 01 <-> 02 swap', function () {
    $db = DB::connection('costos_tenant');
    $docId = $db->table('mantenimiento_documentos')->insertGetId(['public_id' => str_repeat('A', 26), 'nombre' => 'GF', 'origen' => 'delphin', 'presupuesto_id' => 1, 'created_at' => now(), 'updated_at' => now()]);
    $db->table('gastfin_grupos')->insert([
        ['documento_id' => $docId, 'grupo_ref' => '01', 'tipo' => 'modulo'],
        ['documento_id' => $docId, 'grupo_ref' => '02', 'tipo' => 'piso'],
    ]);
    $pagoId = $db->table('gastfin_mo_pagos')->insertGetId(['public_id' => str_repeat('B', 26), 'documento_id' => $docId, 'nombre' => 'VAL 01']);
    $db->table('gastfin_mo_pago_valores')->insert(['pago_id' => $pagoId, 'grupo_ref' => '01', 'franja' => 'valorizacion', 'monto_minor' => 100000]);

    savePresupuesto([['01', 'B'], ['02', 'A']], [['from' => '01', 'to' => '02'], ['from' => '02', 'to' => '01']]);

    expect($db->table('gastfin_grupos')->orderBy('id')->pluck('grupo_ref', 'tipo')->all())->toBe(['modulo' => '02', 'piso' => '01'])
        ->and($db->table('gastfin_mo_pago_valores')->value('grupo_ref'))->toBe('02');
});
