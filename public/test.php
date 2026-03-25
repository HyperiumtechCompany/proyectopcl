<?php
try {
    require __DIR__.'/../vendor/autoload.php';
    $app = require_once __DIR__.'/../bootstrap/app.php';
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();

    $ds = app(\App\Services\CostoDatabaseService::class);
    $p = \App\Models\CostoProject::orderBy('id', 'desc')->first();
    $ds->setTenantConnection($p->database_name);
    $tenantPresupuestoId = $ds->getDefaultPresupuestoId($p->database_name);

    $conn = \Illuminate\Support\Facades\DB::connection('costos_tenant');

    $moCount = $conn->table('acu_mano_de_obra')->count();
    
    // Sample ACU
    $acu = $conn->table('presupuesto_acus')->first();
    $gen = $conn->table('presupuesto_general')->first();

    $moItems = $conn->table('acu_mano_de_obra')->limit(2)->get();

    $joinT = $conn->table('acu_mano_de_obra as t')
        ->join('presupuesto_acus as a', 't.acu_id', '=', 'a.id')
        ->select('t.*', 'a.partida as acu_partida', 'a.presupuesto_id as acu_presup_id')
        ->limit(2)->get();

    $fullJoin = $conn->table('acu_mano_de_obra as t')
        ->join('presupuesto_acus as a', 't.acu_id', '=', 'a.id')
        ->join('presupuesto_general as g', function($join) use ($tenantPresupuestoId) {
            $join->on('a.partida', '=', 'g.partida')
                 ->where('g.presupuesto_id', '=', $tenantPresupuestoId);
        })
        ->select('t.*', 'a.partida as acu_partida', 'g.partida as gen_partida', 'g.metrado')
        ->count();

    file_put_contents(__DIR__ . '/test_out.txt', json_encode([
        'project' => $p->database_name,
        'mo_count' => $moCount,
        'mo_items' => $moItems,
        'sample_acu' => $acu,
        'sample_gen' => $gen,
        'join_t' => $joinT,
        'full_join_count' => $fullJoin,
        'tenant_ps_id' => $tenantPresupuestoId
    ], JSON_PRETTY_PRINT));
} catch (\Throwable $e) {
    file_put_contents(__DIR__ . '/test_out.txt', "ERROR:\n" . $e->getMessage() . "\n" . $e->getTraceAsString());
}
