<?php

use App\Http\Controllers\Cuaderno\CuadernoAgenteApiController;
use App\Http\Middleware\AuthenticateCuadernoAgente;
use App\Http\Middleware\EnsureCuadernoEnabled;
use Illuminate\Support\Facades\Route;

// Connector installed on the holder's computer (Cuaderno de incidencias). No session or
// CSRF: pairing uses a one-time code and every other call a per-computer token.
Route::middleware(EnsureCuadernoEnabled::class)->prefix('cuaderno-agente')->name('cuaderno-agente.')->group(function (): void {
    Route::middleware('throttle:20,1')->group(function (): void {
        Route::post('/emparejar', [CuadernoAgenteApiController::class, 'pair'])->name('pair');
        Route::get('/instalador/{codigo}', [CuadernoAgenteApiController::class, 'installer'])->name('installer');
        Route::get('/instalador/{codigo}/script', [CuadernoAgenteApiController::class, 'installerScript'])->name('installer-script');
    });
    Route::get('/paquete', [CuadernoAgenteApiController::class, 'package'])->name('package');

    Route::middleware(AuthenticateCuadernoAgente::class)->group(function (): void {
        Route::get('/tareas', [CuadernoAgenteApiController::class, 'next'])->name('next');
        Route::post('/tareas/{tarea}/archivo', [CuadernoAgenteApiController::class, 'upload'])->name('upload');
        Route::post('/tareas/{tarea}/resultado', [CuadernoAgenteApiController::class, 'finish'])->name('finish');
    });
});
