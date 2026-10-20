<?php

use App\Http\Controllers\PresupuestoController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class);

// Delphin renumera códigos al mover una rama; el guardado envía partida_renames para que los ACU
// sigan a su partida antes de que la limpieza de huérfanos los borre.
beforeEach(function () {
    config()->set('database.connections.costos_tenant', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
    DB::purge('costos_tenant');
    Schema::connection('costos_tenant')->create('presupuesto_acus', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida', 50);
        $table->text('descripcion')->nullable();
    });
    Schema::connection('costos_tenant')->create('presupuesto_general', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id');
        $table->string('partida', 50);
        $table->text('descripcion');
    });
    DB::connection('costos_tenant')->table('presupuesto_acus')->insert([
        ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01.01.01'],
        ['id' => 2, 'presupuesto_id' => 1, 'partida' => '1.1.2'],   // mismo código sin ceros
        ['id' => 3, 'presupuesto_id' => 1, 'partida' => '02.01'],
        ['id' => 4, 'presupuesto_id' => 1, 'partida' => '02.02'],
        ['id' => 5, 'presupuesto_id' => 2, 'partida' => '01.01.01'], // otro presupuesto: no se toca
    ]);
});

afterEach(function () {
    Schema::connection('costos_tenant')->dropAllTables();
});

function renameAcus(mixed $renames): array
{
    $method = new ReflectionMethod(PresupuestoController::class, 'applyAcuPartidaRenames');
    $method->invoke(app(PresupuestoController::class), DB::connection('costos_tenant'), 1, $renames);

    return DB::connection('costos_tenant')->table('presupuesto_acus')->orderBy('id')->pluck('partida', 'id')->all();
}

it('moves ACUs to the renamed codes, matching codes with or without zero padding', function () {
    expect(renameAcus([
        ['from' => '01.01.01', 'to' => '01.01.01.01'],
        ['from' => '01.01.02', 'to' => '01.01.01.02'],
    ]))->toBe([1 => '01.01.01.01', 2 => '01.01.01.02', 3 => '02.01', 4 => '02.02', 5 => '01.01.01']);
});

it('applies a swap without one rename overwriting the other', function () {
    expect(renameAcus([
        ['from' => '02.01', 'to' => '02.02'],
        ['from' => '02.02', 'to' => '02.01'],
    ]))->toMatchArray([3 => '02.02', 4 => '02.01']);
});

it('ignores empty or malformed renames and leaves everything as it was', function () {
    $before = [1 => '01.01.01', 2 => '1.1.2', 3 => '02.01', 4 => '02.02', 5 => '01.01.01'];

    expect(renameAcus([]))->toBe($before)
        ->and(renameAcus(null))->toBe($before)
        ->and(renameAcus([['from' => '02.01'], 'basura', ['from' => '', 'to' => '9'], ['from' => '02.01', 'to' => '02.01']]))->toBe($before);
});

function reconcile(array $partidas): array
{
    DB::connection('costos_tenant')->table('presupuesto_general')->delete();
    foreach ($partidas as [$partida, $descripcion]) {
        DB::connection('costos_tenant')->table('presupuesto_general')->insert(['presupuesto_id' => 1, 'partida' => $partida, 'descripcion' => $descripcion]);
    }

    $method = new ReflectionMethod(PresupuestoController::class, 'reconcileOrphanAcus');
    $method->invoke(app(PresupuestoController::class), DB::connection('costos_tenant'), 1);

    return DB::connection('costos_tenant')->table('presupuesto_acus')->where('presupuesto_id', 1)->orderBy('id')->pluck('partida', 'descripcion')->all();
}

describe('reconcileOrphanAcus (ACU nunca se borran al guardar el presupuesto)', function () {
    beforeEach(function () {
        DB::connection('costos_tenant')->table('presupuesto_acus')->delete();
        DB::connection('costos_tenant')->table('presupuesto_acus')->insert([
            ['id' => 1, 'presupuesto_id' => 1, 'partida' => '01.01.01', 'descripcion' => 'CONSTRUCCIÓN OFICINA TÉCNICA'],
            ['id' => 2, 'presupuesto_id' => 1, 'partida' => '01.01.02', 'descripcion' => 'CONSTRUCCIÓN ALMACÉN'],
            ['id' => 3, 'presupuesto_id' => 1, 'partida' => '01.02.01', 'descripcion' => 'CONCRETO F\'C=210'],
            ['id' => 4, 'presupuesto_id' => 1, 'partida' => '01.03.01', 'descripcion' => 'CONCRETO F\'C=210'],
        ]);
    });

    it('follows the partidas when a whole branch is renumbered without partida_renames (incidente 2026-10-20)', function () {
        $result = reconcile([
            ['02', 'ESTRUCTURAS'], ['02.01', 'OBRAS PROVISIONALES'],
            ['02.01.01', 'Construcción oficina técnica'],   // mayúsculas/tildes distintas
            ['02.01.02', 'CONSTRUCCIÓN ALMACÉN'],
            ['02.02.01', 'CONCRETO F\'C=210'], ['02.03.01', 'CONCRETO F\'C=210'],
        ]);

        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->pluck('partida', 'id')->all())
            ->toBe([1 => '02.01.01', 2 => '02.01.02', 3 => '02.02.01', 4 => '02.03.01']);
        expect($result)->toHaveCount(3); // 4 ACU, 2 con la misma descripción
    });

    it('sets aside (never deletes) the ACU of a removed partida and relinks it when the partida comes back', function () {
        reconcile([['01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA'], ['01.02.01', 'CONCRETO F\'C=210'], ['01.03.01', 'CONCRETO F\'C=210']]);
        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->where('id', 2)->value('partida'))->toBe('~01.01.02')
            ->and(DB::connection('costos_tenant')->table('presupuesto_acus')->count())->toBe(4);

        // Una partida nueva que reusa el código NO hereda el ACU apartado de otra descripción…
        reconcile([['01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA'], ['01.01.02', 'OTRA COSA'], ['01.02.01', 'CONCRETO F\'C=210'], ['01.03.01', 'CONCRETO F\'C=210']]);
        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->where('id', 2)->value('partida'))->toBe('~01.01.02');

        // …pero si la partida vuelve, se revincula sola.
        reconcile([['01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA'], ['01.01.05', 'CONSTRUCCIÓN ALMACÉN'], ['01.02.01', 'CONCRETO F\'C=210'], ['01.03.01', 'CONCRETO F\'C=210']]);
        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->where('id', 2)->value('partida'))->toBe('01.01.05');
    });

    it('moves an ACU off a title that inherited its old code after indenting the branch (Modulo II)', function () {
        // Antes: OFICINA = 01.01.01 (ACU 1), ALMACÉN = 01.01.02 (ACU 2). Tras meter la rama bajo un
        // padre nuevo, 01.01.01 es ahora un TÍTULO y OFICINA pasó a 01.01.01.01.
        reconcile([
            ['01', 'MODULO II'], ['01.01', 'ESTRUCTURAS'], ['01.01.01', 'CONSTRUCCIONES PROVISIONALES'],
            ['01.01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA'], ['01.01.01.02', 'CONSTRUCCIÓN ALMACÉN'],
            ['01.01.02.01', "CONCRETO F'C=210"], ['01.01.03.01', "CONCRETO F'C=210"],
        ]);

        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->orderBy('id')->pluck('partida', 'id')->all())
            ->toBe([1 => '01.01.01.01', 2 => '01.01.01.02', 3 => '01.01.02.01', 4 => '01.01.03.01']);
    });

    it('keeps an ACU whose partida description was edited on purpose (no other partida with the old text)', function () {
        reconcile([
            ['01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA Y CAMPAMENTO'], ['01.01.02', 'CONSTRUCCIÓN ALMACÉN'],
            ['01.02.01', "CONCRETO F'C=210"], ['01.03.01', "CONCRETO F'C=210"],
        ]);
        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->where('id', 1)->value('partida'))->toBe('01.01.01');
    });

    it('does not guess between identical descriptions when the code tail does not decide', function () {
        reconcile([
            ['01.01.01', 'CONSTRUCCIÓN OFICINA TÉCNICA'], ['01.01.02', 'CONSTRUCCIÓN ALMACÉN'],
            ['05.07', 'CONCRETO F\'C=210'], ['05.08', 'CONCRETO F\'C=210'],
        ]);
        expect(DB::connection('costos_tenant')->table('presupuesto_acus')->whereIn('id', [3, 4])->pluck('partida')->all())
            ->toBe(['~01.02.01', '~01.03.01']);
    });
});
