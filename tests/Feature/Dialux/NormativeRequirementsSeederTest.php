<?php

use App\Models\Dialux\DialuxNormativeRequirement;
use Illuminate\Support\Facades\Artisan;

/**
 * Fase 14 (plan maestro §11, "Emergencia"): RNE A.130 es la fuente
 * OBLIGATORIA real de alumbrado de emergencia en Perú — verificada contra
 * el texto completo del documento oficial por el agente
 * chief-electrical-engineer-reviewer (RNE EM.010, sembrada como 'rne_peru',
 * no contiene ningún artículo de emergencia).
 */
test('seeding RNE A.130 loads the mandatory 10 lx evacuation and 50 lx signage requirements', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxNormativeRequirementsSeeder']);

    $rows = DialuxNormativeRequirement::query()->where('standard', 'rne_a130')->get();

    expect($rows)->toHaveCount(2);

    $evacuation = $rows->firstWhere('category', 'MEDIOS DE EVACUACIÓN (RNE A.130, ART. 40)');
    expect($evacuation)->not->toBeNull();
    expect((float) $evacuation->em_lux)->toBe(10.0);
    expect($evacuation->requirements)->toContain('Autonomía mínima 1½ hora ante un corte del fluido eléctrico');

    $signage = $rows->firstWhere('category', 'SEÑALIZACIÓN DE EVACUACIÓN (RNE A.130, ARTS. 39 Y 41)');
    expect($signage)->not->toBeNull();
    expect((float) $signage->em_lux)->toBe(50.0);
});

test('RNE A.130 does not overwrite or duplicate EN 1838 / RNE EM.010 rows', function () {
    Artisan::call('db:seed', ['--class' => 'DialuxNormativeRequirementsSeeder']);
    $firstEn1838Count = DialuxNormativeRequirement::query()->where('standard', 'en_1838')->count();
    $firstRnePeruCount = DialuxNormativeRequirement::query()->where('standard', 'rne_peru')->count();

    // Re-sembrar debe ser idempotente por standard (borra+reinserta SOLO sus propias filas).
    Artisan::call('db:seed', ['--class' => 'DialuxNormativeRequirementsSeeder']);

    expect(DialuxNormativeRequirement::query()->where('standard', 'en_1838')->count())->toBe($firstEn1838Count);
    expect(DialuxNormativeRequirement::query()->where('standard', 'rne_peru')->count())->toBe($firstRnePeruCount);
    expect(DialuxNormativeRequirement::query()->where('standard', 'rne_a130')->count())->toBe(2);

    // RNE EM.010 (rne_peru) no debe tener ningún requisito de emergencia —
    // hallazgo verificado del audit: confirma que citar rne_peru para
    // alumbrado de emergencia sería una referencia normativa falsa.
    $emergencyLike = DialuxNormativeRequirement::query()
        ->where('standard', 'rne_peru')
        ->where(function ($query) {
            $query->where('category', 'like', '%emergencia%')
                ->orWhere('category', 'like', '%evacuaci%');
        })
        ->count();
    expect($emergencyLike)->toBe(0);
});
