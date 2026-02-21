<?php

use App\Http\Controllers\AcCalculationController;
use App\Http\Controllers\AguaCalculationController;
use App\Http\Controllers\CaidaTensionController;
use App\Http\Controllers\SpattPararrayoSpreadsheetController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// ─── Gestión de Personal / Usuarios ───────────────────────────────────────────
Route::middleware(['auth', 'verified'])->group(function () {
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

require __DIR__ . '/settings.php';
