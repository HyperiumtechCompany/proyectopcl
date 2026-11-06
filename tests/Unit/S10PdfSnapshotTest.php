<?php

use App\Http\Controllers\PresupuestoController;
use App\Http\Requests\CalculateAcuRequest;
use App\Http\Requests\PreviewS10PdfRequest;
use App\Models\CostoProject;
use App\Models\User;
use App\Services\CostoDatabaseService;
use App\Services\S10PdfReader;
use App\Services\S10PdfSnapshot;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

uses(TestCase::class);

function s10OfficeSnapshot(): array
{
    $acu = ['partida' => '01.01.01.01.01', 'descripcion' => 'CONSTRUCCION PROVISIONAL DE OFICINAS', 'unidad' => 'm2', 'rendimiento' => 25, 'update_project_prices' => false];
    $rows = [
        'mano_de_obra' => [['470010847', 'OPERARIO', 'hh', .64, 29.4, 18.82, 2], ['470010848', 'OFICIAL', 'hh', .64, 23.11, 14.79, 2]],
        'materiales' => [['440011235', 'TRIPLAY', 'pln', .071, 94.13, 6.68, 0], ['450010001', 'MADERA', 'p2', 1.7, 6.7, 11.39, 0], ['540011288', 'PINTURA', 'gln', .0711, 53.53, 3.81, 0], ['590011322', 'CALAMINA', 'pza', .2058, 23.81, 4.9, 0], ['800011501', 'CLAVOS', 'kg', .015, 6.5, .1, 0]],
        'equipos' => [['370010001', 'HERRAMIENTAS MANUALES', '%mo', 3, 33.61, 1.01, 0]],
        'subcontratos' => [], 'subpartidas' => [['CU0010012', 'CONCRETO', 'm2', 1, 39.58, 39.58, 0]],
    ];
    foreach ($rows as $section => $items) {
        $acu[$section] = [];
        foreach ($items as [$code, $description, $unit, $quantity, $price, $partial, $resources]) {
            $acu[$section][] = [
                'cod_insumo' => $code, 'descripcion' => $description, 'unidad' => $unit, 'cantidad' => $quantity, 'recursos' => $resources,
                $section === 'equipos' ? 'precio_hora' : 'precio_unitario' => $price,
                'source_pdf' => ['format' => 's10_pdf', 'quantity' => $quantity, 'price' => $price, 'partial' => $partial, 'unit' => $unit, 'original_unit' => $unit, 'description' => $description, 'code' => $code, 'resources' => $resources, 'factor' => 1, 'rendimiento' => 25, 'original_rendimiento' => 25, 'declared_cost' => 101.08, 'page' => 1],
            ];
        }
    }

    return $acu;
}

it('conserva recursos y costo 101.08 del PDF en vez del recalculo 101.071403', function () {
    $result = S10PdfSnapshot::calculate(s10OfficeSnapshot());
    expect($result['costo_unitario_total'])->toBe(101.08)->and($result['costo_mano_obra'])->toBe(33.61)
        ->and($result['costo_materiales'])->toBe(26.88)->and($result['equipos'][0]['precio_hora'])->toBe(33.61)
        ->and($result['mano_de_obra'])->toHaveCount(2)->and($result['materiales'])->toHaveCount(5);
});

it('vuelve al calculo normal cuando se edita un recurso o rendimiento', function (string $field) {
    $acu = s10OfficeSnapshot();
    if ($field === 'rendimiento') {
        $acu['rendimiento'] = 30;
    } else {
        $acu['mano_de_obra'][0][$field] = $field === 'descripcion' ? 'OTRO' : 9;
    }
    expect(S10PdfSnapshot::calculate($acu))->toBeNull();
})->with(['cantidad', 'precio_unitario', 'descripcion', 'rendimiento']);

it('no afecta ACU existentes y rechaza totales inconsistentes', function () {
    $acu = s10OfficeSnapshot();
    unset($acu['mano_de_obra'][0]['source_pdf']);
    expect(S10PdfSnapshot::calculate($acu))->toBeNull();
    $acu = s10OfficeSnapshot();
    $acu['mano_de_obra'][0]['source_pdf']['partial'] = 999;
    expect(S10PdfSnapshot::calculate($acu))->toBeNull();
});

it('valida la procedencia opcional sin romper payloads existentes', function () {
    $payload = s10OfficeSnapshot();
    $validator = Validator::make($payload, (new CalculateAcuRequest)->rules());
    expect($validator->errors()->all())->toBe([]);
    expect($validator->validated()['mano_de_obra'][0]['source_pdf']['partial'])->toBe(18.82);
    foreach (S10PdfSnapshot::SECTIONS as $section) {
        foreach ($payload[$section] as &$component) {
            unset($component['source_pdf']);
        }
        unset($component);
    }
    expect(Validator::make($payload, (new CalculateAcuRequest)->rules())->passes())->toBeTrue();
});

it('guarda y recarga en SQLite aislado sin cambiar el precio Excel', function () {
    config()->set('database.connections.costos_tenant', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
    DB::purge('costos_tenant');
    Schema::connection('costos_tenant')->create('presupuestos', fn (Blueprint $table) => $table->id());
    Schema::connection('costos_tenant')->create('insumo_productos', fn (Blueprint $table) => $table->id());
    (require database_path('migrations/costos_tenant/2026_03_16_000040_create_tenant_acus_tables.php'))->up();
    Schema::connection('costos_tenant')->create('presupuesto_general', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('presupuesto_id')->default(1);
        $table->string('partida');
        $table->decimal('precio_unitario', 20, 10);
        $table->decimal('metrado', 20, 4)->default(.015);
        $table->decimal('parcial', 20, 10)->default(1.52);
        $table->timestamps();
    });
    DB::connection('costos_tenant')->table('presupuestos')->insert(['id' => 1]);
    DB::connection('costos_tenant')->table('presupuesto_general')->insert(['id' => 1, 'partida' => '01.01.01.01.01', 'precio_unitario' => 101.08]);
    $service = Mockery::mock(CostoDatabaseService::class)->makePartial();
    $service->shouldReceive('getDefaultPresupuestoId')->andReturn(1);
    $service->shouldReceive('widenAcuPrecisionColumns')->andReturnNull();
    $service->shouldNotReceive('syncCostoDirecto');
    app()->instance(CostoDatabaseService::class, $service);
    $project = Mockery::mock(CostoProject::class)->makePartial();
    $project->forceFill(['id' => 1, 'user_id' => 7, 'database_name' => 'pdf_test']);
    $project->shouldReceive('hasUnifiedPresupuesto')->andReturn(true);
    Auth::setUser((new User)->forceFill(['id' => 7]));
    $request = Mockery::mock(CalculateAcuRequest::class);
    $request->shouldReceive('validated')->andReturn(s10OfficeSnapshot());
    $response = app(PresupuestoController::class)->calculateACU($project, $request);
    expect($response->getStatusCode())->toBe(200);
    $stored = DB::connection('costos_tenant')->table('presupuesto_acus')->first();
    expect((float) $stored->costo_unitario_total)->toEqualWithDelta(101.08, 0.0000000001)->and(json_decode($stored->mano_de_obra, true))->toHaveCount(2)
        ->and(DB::connection('costos_tenant')->table('acu_materiales')->count())->toBe(5);
    (new ReflectionMethod(CostoDatabaseService::class, 'recalculateAcuFromJson'))->invoke($service, DB::connection('costos_tenant'), $stored, 1, ['01.01.01.01.01' => 1]);
    expect((float) DB::connection('costos_tenant')->table('presupuesto_general')->value('precio_unitario'))->toBe(101.08);
    DB::connection('costos_tenant')->table('presupuesto_general')->insert(['id' => 2, 'partida' => '02', 'precio_unitario' => 101.08]);
    $service->recalculateParciales(DB::connection('costos_tenant'), 1);
    expect((float) DB::connection('costos_tenant')->table('presupuesto_general')->where('id', 1)->value('parcial'))->toBe(1.52)
        ->and((float) DB::connection('costos_tenant')->table('presupuesto_general')->where('id', 2)->value('parcial'))->toEqualWithDelta(1.5162, .0000000001);
});

it('lee por stdin sin Vite también en producción', function () {
    Process::fake(['*' => Process::result(output: json_encode(['analyses' => [['kind' => 'main']]]))]);
    expect(app(S10PdfReader::class)->read('%PDF-1.7')['analyses'])->toHaveCount(1);
    Process::assertRan(fn ($process) => $process->input === '%PDF-1.7' && in_array('--stdin', $process->command, true));
    app()->instance('env', 'local');
    expect((new PreviewS10PdfRequest)->authorize())->toBeTrue();
    app()->instance('env', 'production');
    expect((new PreviewS10PdfRequest)->authorize())->toBeTrue();
});

it('mantiene el acceso al proyecto y al modulo en produccion', function (int $ownerId, bool $moduleEnabled, bool $allowed) {
    app()->instance('env', 'production');
    Auth::setUser((new User)->forceFill(['id' => 7]));
    $project = Mockery::mock(CostoProject::class)->makePartial();
    $project->forceFill(['id' => 1, 'user_id' => $ownerId]);
    $project->shouldReceive('hasUnifiedPresupuesto')->andReturn($moduleEnabled);
    $request = Mockery::mock(PreviewS10PdfRequest::class);
    $reader = Mockery::mock(S10PdfReader::class);
    if ($allowed) {
        $request->shouldReceive('validated')->once()->with('pdf_bytes')->andReturn('%PDF-1.7');
        $reader->shouldReceive('read')->once()->with('%PDF-1.7')->andReturn(['analyses' => [['kind' => 'main']]]);
        $response = app(PresupuestoController::class)->previewPdf($project, $request, $reader);
        expect($response->getStatusCode())->toBe(200);
    } else {
        $reader->shouldNotReceive('read');
        try {
            app(PresupuestoController::class)->previewPdf($project, $request, $reader);
            $this->fail('El lector debe rechazar el acceso.');
        } catch (HttpException $exception) {
            expect($exception->getStatusCode())->toBe(403);
        }
    }
})->with([
    'propietario con presupuesto' => [7, true, true],
    'proyecto de otro usuario' => [8, true, false],
    'presupuesto deshabilitado' => [7, false, false],
]);

it('informa errores del lector y rechaza archivos vacios o falsos', function () {
    Process::fake(['*' => Process::result(errorOutput: 'invalid PDF', exitCode: 1)]);
    expect(fn () => app(S10PdfReader::class)->read('%PDF-'))->toThrow(ValidationException::class);
    expect(Validator::make(['pdf_bytes' => ''], (new PreviewS10PdfRequest)->rules())->fails())->toBeTrue();
    expect(Validator::make(['pdf_bytes' => 'no es pdf'], (new PreviewS10PdfRequest)->rules())->fails())->toBeTrue();
});
