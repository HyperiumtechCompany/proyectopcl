<?php

use App\Http\Controllers\AcCalculationController;
use App\Http\Controllers\AguaCalculationController;
use App\Http\Controllers\CaidaTensionController;
use App\Http\Controllers\CostoModuleController;
use App\Http\Controllers\CostoProjectController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesagueCalculationController;
use App\Http\Controllers\MetradoArquitecturaController;
use App\Http\Controllers\MetradoComunicacionesController;
use App\Http\Controllers\MetradoEstructurasController;
use App\Http\Controllers\MetradoGasController;
use App\Http\Controllers\MetradoSanitariasController;
use App\Http\Controllers\MetradoElectricasController;
use App\Http\Controllers\MetradosController;
use App\Http\Controllers\InsumoProductoController;
use App\Http\Controllers\PresupuestoController;
use App\Http\Controllers\SpattPararrayoSpreadsheetController;
use App\Http\Controllers\UbigeoController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\MetradoComunicacionSpreadsheetController;
use App\Http\Controllers\MetradoElectricasSpreadsheetController;
use App\Http\Middleware\SetCostosDatabase;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// ─── Gestión de Personal / Usuarios ───────────────────────────────────────────
Route::middleware(['auth', 'verified', 'role:root|gerencia|administracion'])->group(function () {
    Route::resource('users', UserController::class);
});

// ─── Caída de Tensión ──────────────────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('caida-tension')->name('caida-tension.')->group(function () {
    Route::get('/', [CaidaTensionController::class, 'index'])->name('index');
    Route::post('/', [CaidaTensionController::class, 'store'])->name('store');
    Route::get('/join', fn() => redirect()->route('caida-tension.index'))->name('join.form');
    Route::post('/join', [CaidaTensionController::class, 'join'])->name('join');
    Route::get('/{caidaTension}', [CaidaTensionController::class, 'show'])->name('show');
    Route::patch('/{caidaTension}', [CaidaTensionController::class, 'update'])->name('update');
    Route::delete('/{caidaTension}', [CaidaTensionController::class, 'destroy'])->name('destroy');
    Route::post('/{caidaTension}/enable-collab', [CaidaTensionController::class, 'enableCollaboration'])->name('enable-collab');
});

// ─── Cálculo de Aire Acondicionado ─────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('ac-calculation')->name('ac-calculation.')->group(function () {
    Route::get('/', [AcCalculationController::class, 'index'])->name('index');
    Route::post('/', [AcCalculationController::class, 'store'])->name('store');
    Route::get('/join', fn() => redirect()->route('ac-calculation.index'))->name('join.form');
    Route::post('/join', [AcCalculationController::class, 'join'])->name('join');
    Route::get('/{acCalculation}', [AcCalculationController::class, 'show'])->name('show');
    Route::patch('/{acCalculation}', [AcCalculationController::class, 'update'])->name('update');
    Route::delete('/{acCalculation}', [AcCalculationController::class, 'destroy'])->name('destroy');
    Route::post('/{acCalculation}/enable-collab', [AcCalculationController::class, 'enableCollaboration'])->name('enable-collab');
});

// ─── Metrados (módulos de metrados varios) ────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('metrados')->name('metrados.')->group(function () {
    // ruta raíz del grupo, muestra listado de módulos de metrado
    Route::get('/', [MetradosController::class, 'index'])->name('index');

    // cada disciplina se define en un sub‑grupo; aquí va Comunicaciones
    Route::group(['prefix' => 'comunicaciones', 'as' => 'comunicaciones.'], function () {
        Route::get('/', [MetradoComunicacionSpreadsheetController::class, 'index'])->name('index');
        Route::post('/', [MetradoComunicacionSpreadsheetController::class, 'store'])->name('store');
        Route::get('/join', fn() => redirect()->route('metrados.comunicaciones.index'))->name('join.form');
        Route::post('/join', [MetradoComunicacionSpreadsheetController::class, 'join'])->name('join');
        Route::get('/{metradosComunicacion}', [MetradoComunicacionSpreadsheetController::class, 'show'])->name('show');
        Route::patch('/{metradosComunicacion}', [MetradoComunicacionSpreadsheetController::class, 'update'])->name('update');
        Route::patch('/{metradosComunicacion}/metrado', [MetradoComunicacionSpreadsheetController::class, 'updateMetrado'])->name('metrado.update');
        Route::patch('/{metradosComunicacion}/resumen', [MetradoComunicacionSpreadsheetController::class, 'updateResumen'])->name('resumen.update');
        Route::delete('/{metradosComunicacion}', [MetradoComunicacionSpreadsheetController::class, 'destroy'])->name('destroy');
        Route::post('/{metradosComunicacion}/enable-collab', [MetradoComunicacionSpreadsheetController::class, 'enableCollaboration'])->name('enable-collab');
    });

    // metrado electricas
    Route::group(['prefix' => 'electricas', 'as' => 'electricas.'], function () {
        Route::get('/', [MetradoElectricasSpreadsheetController::class, 'index'])->name('index');
        Route::post('/', [MetradoElectricasSpreadsheetController::class, 'store'])->name('store');
        Route::get('/join', fn() => redirect()->route('metrados.electricas.index'))->name('join.form');
        Route::post('/join', [MetradoElectricasSpreadsheetController::class, 'join'])->name('join');
        Route::get('/{metradosElectrica}', [MetradoElectricasSpreadsheetController::class, 'show'])->name('show');
        Route::patch('/{metradosElectrica}', [MetradoElectricasSpreadsheetController::class, 'update'])->name('update');
        Route::patch('/{metradosElectrica}/metrado', [MetradoElectricasSpreadsheetController::class, 'updateMetrado'])->name('metrado.update');
        Route::patch('/{metradosElectrica}/resumen', [MetradoElectricasSpreadsheetController::class, 'updateResumen'])->name('resumen.update');
        Route::delete('/{metradosElectrica}', [MetradoElectricasSpreadsheetController::class, 'destroy'])->name('destroy');
        Route::post('/{metradosElectrica}/enable-collab', [MetradoElectricasSpreadsheetController::class, 'enableCollaboration'])->name('enable-collab');
    });

    // próximamente: arquitectura, estructuras, sanitarias, gas...
});

// ─── Cálculo de Agua ────────────────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('agua-calculation')->name('agua-calculation.')->group(function () {
    Route::get('/', [AguaCalculationController::class, 'index'])->name('index');
    Route::post('/', [AguaCalculationController::class, 'store'])->name('store');
    Route::get('/join', fn() => redirect()->route('agua-calculation.index'))->name('join.form');
    Route::post('/join', [AguaCalculationController::class, 'join'])->name('join');
    Route::get('/{aguaCalculation}', [AguaCalculationController::class, 'show'])->name('show');
    Route::patch('/{aguaCalculation}', [AguaCalculationController::class, 'update'])->name('update');
    Route::delete('/{aguaCalculation}', [AguaCalculationController::class, 'destroy'])->name('destroy');
    Route::post('/{aguaCalculation}/enable-collab', [AguaCalculationController::class, 'enableCollaboration'])->name('enable-collab');
});

// ─── Cálculo de Desagüe ────────────────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('desague-calculation')->name('desague-calculation.')->group(function () {
    Route::get('/', [DesagueCalculationController::class, 'index'])->name('index');
    Route::post('/', [DesagueCalculationController::class, 'store'])->name('store');
    Route::get('/join', fn() => redirect()->route('desague-calculation.index'))->name('join.form');
    Route::post('/join', [DesagueCalculationController::class, 'join'])->name('join');
    Route::get('/{desagueCalculation}', [DesagueCalculationController::class, 'show'])->name('show');
    Route::patch('/{desagueCalculation}', [DesagueCalculationController::class, 'update'])->name('update');
    Route::delete('/{desagueCalculation}', [DesagueCalculationController::class, 'destroy'])->name('destroy');
    Route::post('/{desagueCalculation}/enable-collab', [DesagueCalculationController::class, 'enableCollaboration'])->name('enable-collab');
});

// ─── Cálculo SPAT y Pararrayos ───────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('spatt-pararrayos')->name('spatt-pararrayos.')->group(function () {
    Route::get('/', [SpattPararrayoSpreadsheetController::class, 'index'])->name('index');
    Route::post('/', [SpattPararrayoSpreadsheetController::class, 'store'])->name('store');
    Route::get('/join', fn() => redirect()->route('spatt-pararrayos.index'))->name('join.form');
    Route::post('/join', [SpattPararrayoSpreadsheetController::class, 'join'])->name('join');
    Route::get('/{spattPararrayo}', [SpattPararrayoSpreadsheetController::class, 'show'])->name('show');
    Route::patch('/{spattPararrayo}', [SpattPararrayoSpreadsheetController::class, 'update'])->name('update');
    Route::delete('/{spattPararrayo}', [SpattPararrayoSpreadsheetController::class, 'destroy'])->name('destroy');
    Route::post('/{spattPararrayo}/enable-collab', [SpattPararrayoSpreadsheetController::class, 'enableCollaboration'])->name('enable-collab');
});

// ─── Proyectos de Costos ─────────────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('costos')->name('costos.')->group(function () {
    Route::get('/', [CostoProjectController::class, 'index'])->name('index');
    Route::get('/create', [CostoProjectController::class, 'create'])->name('create');
    Route::get('/{costoProject}/edit', [CostoProjectController::class, 'edit'])->name('edit');
    Route::post('/', [CostoProjectController::class, 'store'])->name('store');
    Route::get('/{costoProject}', [CostoProjectController::class, 'show'])->name('show');
    Route::delete('/{costoProject}', [CostoProjectController::class, 'destroy'])->name('destroy');

    // ─── Módulos dentro de un proyecto (con middleware de BD dinámica) ────
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/{costoProject}/module')
        ->name('module.')
        ->group(function () {
            Route::get('/{moduleType}', [CostoModuleController::class, 'show'])->name('show');
            Route::patch('/{moduleType}', [CostoModuleController::class, 'update'])->name('update');
        });

    // ─── Presupuesto Unificado (con middleware de BD dinámica) ────
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/proyectos/{project}')
        ->group(function () {
            Route::post('/presupuesto/import-metrado', [PresupuestoController::class, 'importFromMetrado'])->name('proyectos.presupuesto.import-metrado');
            Route::post('/presupuesto/import-batch-metrados', [PresupuestoController::class, 'importBatchFromMetrados'])->name('proyectos.presupuesto.import-batch-metrados');
            Route::post('/presupuesto/acus/calculate', [PresupuestoController::class, 'calculateACU'])->name('proyectos.presupuesto.acus.calculate');
            Route::get('/presupuesto/gastos-fijos/{ggFijoId}/desagregado', [PresupuestoController::class, 'getGGFijoDesagregado'])->name('proyectos.presupuesto.gastos-fijos.desagregado.show');
            Route::post('/presupuesto/gastos-fijos/{ggFijoId}/desagregado', [PresupuestoController::class, 'saveGGFijoDesagregado'])->name('proyectos.presupuesto.gastos-fijos.desagregado.save');
            Route::get('/presupuesto/gastos-fijos-global/totals', [PresupuestoController::class, 'getGGFijosTotals'])->name('proyectos.presupuesto.gastos-fijos-global.totals');
            Route::get('/presupuesto/gastos-fijos-global/desagregado', [PresupuestoController::class, 'getGGFijoDesagregadoGlobal'])->name('proyectos.presupuesto.gastos-fijos-global.desagregado.show');
            Route::post('/presupuesto/gastos-fijos-global/desagregado', [PresupuestoController::class, 'saveGGFijoDesagregadoGlobal'])->name('proyectos.presupuesto.gastos-fijos-global.desagregado.save');
            Route::get('/presupuesto/ggfijos-monto-cg', [PresupuestoController::class, 'getGGFijosMontoCG'])->name('proyectos.presupuesto.ggfijos-monto-cg.show');
            Route::post('/presupuesto/ggfijos-monto-cg', [PresupuestoController::class, 'saveGGFijosMontoCG'])->name('proyectos.presupuesto.ggfijos-monto-cg.save');
            Route::get('/presupuesto/supervision-gg-detalle', [PresupuestoController::class, 'getSupervisionGGDetalle'])->name('proyectos.presupuesto.supervision-gg-detalle.show');
            Route::patch('/presupuesto/supervision-gg-detalle', [PresupuestoController::class, 'saveSupervisionGGDetalle'])->name('proyectos.presupuesto.supervision-gg-detalle.save');
            Route::get('/presupuesto/export', [PresupuestoController::class, 'export'])->name('proyectos.presupuesto.export');
            Route::get('/presupuesto/export/excel', [PresupuestoController::class, 'exportExcel'])->name('proyectos.presupuesto.export.excel');
            Route::get('/presupuesto/export/pdf', [PresupuestoController::class, 'exportPdf'])->name('proyectos.presupuesto.export.pdf');

            // ─── Consolidado Snapshot (cache de totales) ───
            Route::get('/presupuesto/consolidado/snapshot', [PresupuestoController::class, 'getConsolidadoSnapshot'])->name('proyectos.presupuesto.consolidado.snapshot.show');
            Route::patch('/presupuesto/consolidado/snapshot', [PresupuestoController::class, 'saveConsolidadoSnapshot'])->name('proyectos.presupuesto.consolidado.snapshot.save');

            // ─── Parámetros Globales del Proyecto (centralizados en tenant) ────
            Route::get('/presupuesto/params', [PresupuestoController::class, 'getProjectParams'])->name('proyectos.presupuesto.params.show');
            Route::patch('/presupuesto/params', [PresupuestoController::class, 'updateProjectParams'])->name('proyectos.presupuesto.params.update');

            // ─── Insumos Catálogo (por proyecto, en tenant DB) ────
            Route::get('/presupuesto/insumos/search', [InsumoProductoController::class, 'search'])->name('proyectos.presupuesto.insumos.search');
            Route::get('/presupuesto/insumos/diccionarios', [InsumoProductoController::class, 'diccionarios'])->name('proyectos.presupuesto.insumos.diccionarios');
            Route::get('/presupuesto/insumos/unidades', [InsumoProductoController::class, 'unidades'])->name('proyectos.presupuesto.insumos.unidades');
            Route::post('/presupuesto/insumos', [InsumoProductoController::class, 'store'])->name('proyectos.presupuesto.insumos.store');
            Route::post('/presupuesto/insumos/replace-project-insumo', [InsumoProductoController::class, 'replaceProjectInsumo'])->name('proyectos.presupuesto.insumos.replace');
            Route::post('/presupuesto/insumos/seed', [InsumoProductoController::class, 'seedCatalog'])->name('proyectos.presupuesto.insumos.seed');
            Route::put('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'update'])->name('proyectos.presupuesto.insumos.update');
            Route::delete('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'destroy'])->name('proyectos.presupuesto.insumos.destroy');

            // ─── Componentes de ACU (CRUD Granular) ───
            Route::get('/presupuesto/acus/{acuId}/componentes/{tipo}', [PresupuestoController::class, 'getAcuComponentes'])->name('proyectos.presupuesto.acus.componentes.index');
            Route::post('/presupuesto/acus/{acuId}/componentes/{tipo}', [PresupuestoController::class, 'storeAcuComponente'])->name('proyectos.presupuesto.acus.componentes.store');
            Route::put('/presupuesto/acus/{acuId}/componentes/{tipo}/{id}', [PresupuestoController::class, 'updateAcuComponente'])->name('proyectos.presupuesto.acus.componentes.update');
            Route::delete('/presupuesto/acus/{acuId}/componentes/{tipo}/{id}', [PresupuestoController::class, 'destroyAcuComponente'])->name('proyectos.presupuesto.acus.componentes.destroy');
            Route::post('/presupuesto/copy', [PresupuestoController::class, 'copy'])->name('proyectos.presupuesto.copy');

            // ─── Rutas Comodín (Wildcards) - DEBEN IR AL FINAL ────
            Route::get('/presupuesto/{subsection?}', [PresupuestoController::class, 'index'])->name('proyectos.presupuesto.index');
            Route::get('/presupuesto/{subsection}/data', [PresupuestoController::class, 'show'])->name('proyectos.presupuesto.show');
            Route::patch('/presupuesto/{subsection}', [PresupuestoController::class, 'update'])->name('proyectos.presupuesto.update');
            Route::delete('/presupuesto/{subsection}/delete-row', [PresupuestoController::class, 'deleteRow'])->name('proyectos.presupuesto.delete-row');
        });

    // ─── Metrado Sanitarias Modular (con middleware de BD dinámica) ────
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/{costoProject}/metrado-sanitarias')
        ->name('metrado-sanitarias.')
        ->group(function () {
            Route::get('/', [MetradoSanitariasController::class, 'index'])->name('index');
            Route::get('/config', [MetradoSanitariasController::class, 'getConfig'])->name('config.show');
            Route::patch('/config', [MetradoSanitariasController::class, 'updateConfig'])->name('config.update');
            Route::get('/modulo/{moduloNumero}', [MetradoSanitariasController::class, 'getModulo'])->name('modulo.show');
            Route::patch('/modulo/{moduloNumero}', [MetradoSanitariasController::class, 'updateModulo'])->name('modulo.update');
            Route::get('/exterior', [MetradoSanitariasController::class, 'getExterior'])->name('exterior.show');
            Route::patch('/exterior', [MetradoSanitariasController::class, 'updateExterior'])->name('exterior.update');
            Route::get('/cisterna', [MetradoSanitariasController::class, 'getCisterna'])->name('cisterna.show');
            Route::patch('/cisterna', [MetradoSanitariasController::class, 'updateCisterna'])->name('cisterna.update');
            Route::get('/resumen', [MetradoSanitariasController::class, 'getResumen'])->name('resumen.show');
            Route::patch('/resumen', [MetradoSanitariasController::class, 'updateResumen'])->name('resumen.update');
        });

    // ─── Metrado Estructuras (con middleware de BD dinámica) ────
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/{costoProject}/metrado-estructuras')
        ->name('metrado-estructuras.')
        ->group(function () {
            Route::get('/', [MetradoEstructurasController::class, 'index'])->name('index');
            Route::get('/config', [MetradoEstructurasController::class, 'getConfig'])->name('config.show');
            Route::patch('/config', [MetradoEstructurasController::class, 'updateConfig'])->name('config.update');
            Route::get('/modulo/{moduloNumero}', [MetradoEstructurasController::class, 'getModulo'])->name('modulo.show');
            Route::patch('/modulo/{moduloNumero}', [MetradoEstructurasController::class, 'updateModulo'])->name('modulo.update');
            Route::get('/resumen', [MetradoEstructurasController::class, 'getResumen'])->name('resumen.show');
            Route::patch('/resumen', [MetradoEstructurasController::class, 'updateResumen'])->name('resumen.update');
            Route::get('/exterior', [MetradoEstructurasController::class, 'getExterior'])->name('exterior.show');
            Route::patch('/exterior', [MetradoEstructurasController::class, 'updateExterior'])->name('exterior.update');
            Route::get('/cisterna', [MetradoEstructurasController::class, 'getCisterna'])->name('cisterna.show');
            Route::patch('/cisterna', [MetradoEstructurasController::class, 'updateCisterna'])->name('cisterna.update');
            Route::post('/resumen/sync', [MetradoEstructurasController::class, 'syncResumen'])->name('resumen.sync');
        });

    // metrado electricas
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/{costoProject}/metrado-electricas')
        ->name('metrado-electricas.')
        ->group(function () {
            
            Route::get('/', [MetradoElectricasController::class, 'index'])
                ->name('index');
            
            Route::patch('/metrado', [MetradoElectricasController::class, 'updateMetrado'])
                ->name('metrado.update');
            
            Route::patch('/resumen', [MetradoElectricasController::class, 'updateResumen'])
                ->name('resumen.update');
            
            Route::post('/resumen/sync', [MetradoElectricasController::class, 'syncResumen'])
                ->name('resumen.sync');
        });

    //metrado comunicaciones
    Route::middleware([SetCostosDatabase::class])
    ->prefix('/{costoProject}/metrado-comunicaciones')
    ->name('metrado-comunicaciones.')
    ->group(function () {

        Route::get('/', [MetradoComunicacionesController::class, 'index'])
            ->name('index');

        Route::patch('/metrado', [MetradoComunicacionesController::class, 'updateMetrado'])
            ->name('metrado.update');

        Route::patch('/resumen', [MetradoComunicacionesController::class, 'updateResumen'])
            ->name('resumen.update');

        Route::post('/resumen/sync', [MetradoComunicacionesController::class, 'syncResumen'])
            ->name('resumen.sync');
        });

    //metrado arquitectura
    Route::middleware([SetCostosDatabase::class])
    ->prefix('/{costoProject}/metrado-arquitectura')
    ->name('metrado-arquitectura.')
    ->group(function () {
        Route::get('/', [MetradoArquitecturaController::class, 'index'])
            ->name('index');

        Route::get('/config', [MetradoArquitecturaController::class, 'getConfig'])
            ->name('config.show');

        Route::patch('/config', [MetradoArquitecturaController::class, 'updateConfig'])
            ->name('config.update');

        Route::get('/modulo/{moduloNumero}', [MetradoArquitecturaController::class, 'getModulo'])
            ->name('modulo.show');

        Route::patch('/modulo/{moduloNumero}', [MetradoArquitecturaController::class, 'updateModulo'])
            ->name('modulo.update');

        Route::get('/resumen', [MetradoArquitecturaController::class, 'getResumen'])
            ->name('resumen.show');

        Route::patch('/resumen', [MetradoArquitecturaController::class, 'updateResumen'])
            ->name('resumen.update');

        Route::get('/exterior', [MetradoArquitecturaController::class, 'getExterior'])
            ->name('exterior.show');

        Route::patch('/exterior', [MetradoArquitecturaController::class, 'updateExterior'])
            ->name('exterior.update');

        Route::get('/cisterna', [MetradoArquitecturaController::class, 'getCisterna'])
            ->name('cisterna.show');

        Route::patch('/cisterna', [MetradoArquitecturaController::class, 'updateCisterna'])
            ->name('cisterna.update');

        Route::post('/resumen/sync', [MetradoArquitecturaController::class, 'syncResumen'])
            ->name('resumen.sync');

        });

    //metrado gas
    Route::middleware([SetCostosDatabase::class])
    ->prefix('/{costoProject}/metrado-gas')
    ->name('metrado-gas.')
    ->group(function () {
        Route::get('/', [MetradoGasController::class, 'index'])
            ->name('index');

        Route::patch('/metrado', [MetradoGasController::class, 'updateMetrado'])
            ->name('metrado.update');

        Route::patch('/resumen', [MetradoGasController::class, 'updateResumen'])
            ->name('resumen.update');

        Route::post('/resumen/sync', [MetradoGasController::class, 'syncResumen'])
            ->name('resumen.sync');

        });
});

// ─── API Ubigeo (cascada departamento → provincia → distrito) ────────────────
Route::middleware(['auth'])->prefix('api/ubigeo')->name('ubigeo.')->group(function () {
    Route::get('/departamentos', [UbigeoController::class, 'departamentos'])->name('departamentos');
    Route::get('/provincias/{departamento}', [UbigeoController::class, 'provincias'])->name('provincias');
    Route::get('/distritos/{provincia}', [UbigeoController::class, 'distritos'])->name('distritos');
});

require __DIR__ . '/settings.php';
