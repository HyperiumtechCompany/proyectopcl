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
use App\Http\Controllers\CronogramaController;
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

// ─── GESTIÓN DE PERSONAL / USUARIOS ───────────────────────────────────────────
Route::middleware(['auth', 'verified', 'role:root|gerencia|administracion'])->group(function () {
    Route::resource('users', UserController::class);
});

// ─── CAÍDA DE TENSIÓN ──────────────────────────────────────────────────────────
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

// ─── CÁLCULO DE AIRE ACONDICIONADO ─────────────────────────────────────────────
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

// ─── METRADOS (Módulos Base) ──────────────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('metrados')->name('metrados.')->group(function () {
    Route::get('/', [MetradosController::class, 'index'])->name('index');

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

    Route::prefix('estructura')->name('estructura.')->group(function () {
        Route::get('/', [App\Http\Controllers\MetradoEstructuraController::class, 'index'])->name('index');
        Route::post('/', [App\Http\Controllers\MetradoEstructuraController::class, 'store'])->name('store');
        Route::post('/join', [App\Http\Controllers\MetradoEstructuraController::class, 'join'])->name('join');
        Route::get('/{metradosEstructura}', [App\Http\Controllers\MetradoEstructuraController::class, 'show'])->name('show');
        Route::patch('/{metradosEstructura}', [App\Http\Controllers\MetradoEstructuraController::class, 'update'])->name('update');
        Route::delete('/{metradosEstructura}', [App\Http\Controllers\MetradoEstructuraController::class, 'destroy'])->name('destroy');
    });

    Route::prefix('gas')->name('gas.')->group(function () {
        Route::get('/', [App\Http\Controllers\MetradoGasController::class, 'gasIndex'])->name('index');
        Route::post('/', [App\Http\Controllers\MetradoGasController::class, 'store'])->name('store');
        Route::get('/{metradosGas}', [App\Http\Controllers\MetradoGasController::class, 'gasIndex'])->name('show');
        Route::patch('/{metradosGas}', [App\Http\Controllers\MetradoGasController::class, 'update'])->name('update');
        Route::delete('/{metradosGas}', [App\Http\Controllers\MetradoGasController::class, 'destroy'])->name('destroy');
    });
});

// ─── CÁLCULOS SANITARIOS Y ELÉCTRICOS ──────────────────────────────────────────
Route::middleware(['auth', 'verified'])->group(function () {
    // Agua
    Route::prefix('agua-calculation')->name('agua-calculation.')->group(function () {
        Route::get('/', [AguaCalculationController::class, 'index'])->name('index');
        Route::post('/', [AguaCalculationController::class, 'store'])->name('store');
        Route::get('/{aguaCalculation}', [AguaCalculationController::class, 'show'])->name('show');
        Route::patch('/{aguaCalculation}', [AguaCalculationController::class, 'update'])->name('update');
        Route::delete('/{aguaCalculation}', [AguaCalculationController::class, 'destroy'])->name('destroy');
    });

    // Desagüe
    Route::prefix('desague-calculation')->name('desague-calculation.')->group(function () {
        Route::get('/', [DesagueCalculationController::class, 'index'])->name('index');
        Route::post('/', [DesagueCalculationController::class, 'store'])->name('store');
        Route::get('/{desagueCalculation}', [DesagueCalculationController::class, 'show'])->name('show');
        Route::patch('/{desagueCalculation}', [DesagueCalculationController::class, 'update'])->name('update');
    });

    // SPAT y Pararrayos
    Route::prefix('spatt-pararrayos')->name('spatt-pararrayos.')->group(function () {
        Route::get('/', [SpattPararrayoSpreadsheetController::class, 'index'])->name('index');
        Route::post('/', [SpattPararrayoSpreadsheetController::class, 'store'])->name('store');
        Route::get('/{spattPararrayo}', [SpattPararrayoSpreadsheetController::class, 'show'])->name('show');
        Route::patch('/{spattPararrayo}', [SpattPararrayoSpreadsheetController::class, 'update'])->name('update');
    });
});

// ─── PROYECTOS DE COSTOS Y PRESUPUESTO ─────────────────────────────────────────
Route::middleware(['auth', 'verified'])->prefix('costos')->name('costos.')->group(function () {
    Route::get('/', [CostoProjectController::class, 'index'])->name('index');
    Route::get('/create', [CostoProjectController::class, 'create'])->name('create');
    Route::post('/', [CostoProjectController::class, 'store'])->name('store');
    Route::get('/{costoProject}', [CostoProjectController::class, 'show'])->name('show');
    Route::delete('/{costoProject}', [CostoProjectController::class, 'destroy'])->name('destroy');

    // Módulos (Luckysheet)
    Route::middleware([SetCostosDatabase::class])
        ->prefix('/{costoProject}/module')
        ->name('module.')
        ->group(function () {
            Route::get('/{moduleType}', [CostoModuleController::class, 'show'])->name('show');
            Route::patch('/{moduleType}', [CostoModuleController::class, 'update'])->name('update');
        });

    // Presupuesto Unificado (Tenant DB)
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

            // Insumos
            Route::get('/presupuesto/insumos/search', [InsumoProductoController::class, 'search'])->name('proyectos.presupuesto.insumos.search');
            Route::get('/presupuesto/insumos/diccionarios', [InsumoProductoController::class, 'diccionarios'])->name('proyectos.presupuesto.insumos.diccionarios');
            Route::get('/presupuesto/insumos/unidades', [InsumoProductoController::class, 'unidades'])->name('proyectos.presupuesto.insumos.unidades');
            Route::post('/presupuesto/insumos', [InsumoProductoController::class, 'store'])->name('proyectos.presupuesto.insumos.store');

            Route::put('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'update'])->name('proyectos.presupuesto.insumos.update');
            Route::delete('/presupuesto/insumos/{insumoId}', [InsumoProductoController::class, 'destroy'])->name('proyectos.presupuesto.insumos.destroy');

            // Rutas Comodín

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
        }); // Cierre de proyectos/{project}
}); // Cierre de costos

// ─── CRONOGRAMA GANTT (Independiente) ─────────────────────────────────────────
    Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/module/crono_general', [CronogramaController::class, 'index'])->name('proyectos.cronograma.index');
    Route::post('/cronograma/save/{project}', [CronogramaController::class, 'store'])->name('proyectos.cronograma.save');

    // ETTS
    Route::get('/module/etts', [\App\Http\Controllers\EttpController::class, 'show'])->name('module.etts');
    Route::post('/obtener-especificaciones-tecnicas', [\App\Http\Controllers\EttpController::class, 'obtenerEspecificaciones']);
    Route::post('/obtener-metrados-ettp', [\App\Http\Controllers\EttpController::class, 'obtenerMetrados']);
    Route::post('/guardar-especificaciones-tecnicas/{proyectoId}', [\App\Http\Controllers\EttpController::class, 'guardarEspecificaciones']);
});

// ─── METRADOS MODULARES (Sanitarias y Estructuras) ─────────────────────────────
Route::middleware(['auth', 'verified', SetCostosDatabase::class])->group(function () {
    Route::prefix('/{costoProject}/metrado-sanitarias')->name('metrado-sanitarias.')->group(function () {
        Route::get('/', [MetradoSanitariasController::class, 'index'])->name('index');
        Route::get('/modulo/{moduloNumero}', [MetradoSanitariasController::class, 'getModulo'])->name('modulo.show');
        Route::patch('/modulo/{moduloNumero}', [MetradoSanitariasController::class, 'updateModulo'])->name('modulo.update');
        Route::get('/resumen', [MetradoSanitariasController::class, 'getResumen'])->name('resumen.show');
    });

    Route::prefix('/{costoProject}/metrado-estructuras')->name('metrado-estructuras.')->group(function () {
        Route::get('/', [MetradoEstructurasController::class, 'index'])->name('index');
        Route::get('/metrado', [MetradoEstructurasController::class, 'getMetrado'])->name('metrado.show');
        Route::patch('/metrado', [MetradoEstructurasController::class, 'updateMetrado'])->name('metrado.update');
    });
});

// ─── API UBIGEO ───────────────────────────────────────────────────────────────
Route::middleware(['auth'])->prefix('api/ubigeo')->name('ubigeo.')->group(function () {
    Route::get('/departamentos', [UbigeoController::class, 'departamentos'])->name('departamentos');
    Route::get('/provincias/{departamento}', [UbigeoController::class, 'provincias'])->name('provincias');
    Route::get('/distritos/{provincia}', [UbigeoController::class, 'distritos'])->name('distritos');
});

require __DIR__ . '/settings.php';