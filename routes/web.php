<?php

use App\Http\Controllers\AcCalculationController;
use App\Http\Controllers\AguaCalculationController;
use App\Http\Controllers\CaidaTensionController;
use App\Http\Controllers\CostoModuleController;
use App\Http\Controllers\CostoProjectController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesagueCalculationController;
use App\Http\Controllers\MetradoComunicacionController;
use App\Http\Controllers\MetradoEstructurasController;
use App\Http\Controllers\MetradoSanitariasController;
use App\Http\Controllers\MetradosController;
use App\Http\Controllers\InsumoProductoController;
use App\Http\Controllers\PresupuestoController;
use App\Http\Controllers\SpattPararrayoSpreadsheetController;
use App\Http\Controllers\UbigeoController;
use App\Http\Controllers\UserController;
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
    Route::prefix('comunicacion')->name('comunicacion.')->group(function () {
        Route::get('/', [MetradoComunicacionController::class, 'index'])->name('index');
        Route::post('/', [MetradoComunicacionController::class, 'store'])->name('store');
        Route::get('/join', fn() => redirect()->route('metrados.comunicacion.index'))->name('join.form');
        Route::post('/join', [MetradoComunicacionController::class, 'join'])->name('join');
        Route::get('/{metradosComunicacion}', [MetradoComunicacionController::class, 'show'])->name('show');
        Route::patch('/{metradosComunicacion}', [MetradoComunicacionController::class, 'update'])->name('update');
        Route::delete('/{metradosComunicacion}', [MetradoComunicacionController::class, 'destroy'])->name('destroy');
        Route::post('/{metradosComunicacion}/enable-collab', [MetradoComunicacionController::class, 'enableCollaboration'])->name('enable-collab');
    });

    // próximamente: arquitectura, estructuras, sanitarias, eléctricas, gas...
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
            Route::post('/presupuesto/acus/calculate', [PresupuestoController::class, 'calculateACU'])->name('proyectos.presupuesto.acus.calculate');
            Route::get('/presupuesto/gastos-fijos/{ggFijoId}/desagregado', [PresupuestoController::class, 'getGGFijoDesagregado'])->name('proyectos.presupuesto.gastos-fijos.desagregado.show');
            Route::post('/presupuesto/gastos-fijos/{ggFijoId}/desagregado', [PresupuestoController::class, 'saveGGFijoDesagregado'])->name('proyectos.presupuesto.gastos-fijos.desagregado.save');
            Route::get('/presupuesto/gastos-fijos-global/totals', [PresupuestoController::class, 'getGGFijosTotals'])->name('proyectos.presupuesto.gastos-fijos-global.totals');
            Route::get('/presupuesto/gastos-fijos-global/desagregado', [PresupuestoController::class, 'getGGFijoDesagregadoGlobal'])->name('proyectos.presupuesto.gastos-fijos-global.desagregado.show');
            Route::post('/presupuesto/gastos-fijos-global/desagregado', [PresupuestoController::class, 'saveGGFijoDesagregadoGlobal'])->name('proyectos.presupuesto.gastos-fijos-global.desagregado.save');
            Route::get('/presupuesto/supervision-gg-detalle', [PresupuestoController::class, 'getSupervisionGGDetalle'])->name('proyectos.presupuesto.supervision-gg-detalle.show');
            Route::patch('/presupuesto/supervision-gg-detalle', [PresupuestoController::class, 'saveSupervisionGGDetalle'])->name('proyectos.presupuesto.supervision-gg-detalle.save');
            Route::get('/presupuesto/export', [PresupuestoController::class, 'export'])->name('proyectos.presupuesto.export');

            // ─── Parámetros Globales del Proyecto (centralizados en tenant) ────
            Route::get('/presupuesto/params', [PresupuestoController::class, 'getProjectParams'])->name('proyectos.presupuesto.params.show');
            Route::patch('/presupuesto/params', [PresupuestoController::class, 'updateProjectParams'])->name('proyectos.presupuesto.params.update');

            // ─── Insumos Catálogo (por proyecto, en tenant DB) ────
            Route::get('/presupuesto/insumos/search', [InsumoProductoController::class, 'search'])->name('proyectos.presupuesto.insumos.search');
            Route::get('/presupuesto/insumos/clases', [InsumoProductoController::class, 'clases'])->name('proyectos.presupuesto.insumos.clases');
            Route::post('/presupuesto/insumos', [InsumoProductoController::class, 'store'])->name('proyectos.presupuesto.insumos.store');
            Route::post('/presupuesto/insumos/seed', [InsumoProductoController::class, 'seedCatalog'])->name('proyectos.presupuesto.insumos.seed');
            Route::put('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'update'])->name('proyectos.presupuesto.insumos.update');
            Route::delete('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'destroy'])->name('proyectos.presupuesto.insumos.destroy');

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
            Route::get('/metrado', [MetradoEstructurasController::class, 'getMetrado'])->name('metrado.show');
            Route::patch('/metrado', [MetradoEstructurasController::class, 'updateMetrado'])->name('metrado.update');
            Route::get('/resumen', [MetradoEstructurasController::class, 'getResumen'])->name('resumen.show');
            Route::patch('/resumen', [MetradoEstructurasController::class, 'updateResumen'])->name('resumen.update');
        });
});

// ─── API Ubigeo (cascada departamento → provincia → distrito) ────────────────
Route::middleware(['auth'])->prefix('api/ubigeo')->name('ubigeo.')->group(function () {
    Route::get('/departamentos', [UbigeoController::class, 'departamentos'])->name('departamentos');
    Route::get('/provincias/{departamento}', [UbigeoController::class, 'provincias'])->name('provincias');
    Route::get('/distritos/{provincia}', [UbigeoController::class, 'distritos'])->name('distritos');
});

require __DIR__ . '/settings.php';
