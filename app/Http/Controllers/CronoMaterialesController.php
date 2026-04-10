<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class CronoMaterialesController extends Controller
{
    public function index(Request $request)
    {
        $projectId = (int) $request->query('project');

        $fechas = DB::table('cronograma_general')
            ->where('presupuesto_id', $projectId)
            ->select(DB::raw('MIN(fecha_inicio) as start'), DB::raw('MAX(fecha_fin) as end'))
            ->first();

        $inicio = $fechas->start ? Carbon::parse($fechas->start) : now()->startOfMonth();
        $fin = $fechas->end ? Carbon::parse($fechas->end) : $inicio->copy()->addMonths(4);

        $periodos = [];
        $periodoRange = CarbonPeriod::create($inicio->startOfMonth(), '1 month', $fin->endOfMonth());
        foreach ($periodoRange as $date) {
            $periodos[] = [
                'label' => ucfirst($date->translatedFormat('M Y')),
                'key' => $date->format('Y-m') // Formato: "2026-04"
            ];
        }

        $materialesRaw = DB::table('presupuesto_general as pg')
            ->join('presupuesto_acus as pa', function($join) {
                $join->on('pa.presupuesto_id', '=', 'pg.presupuesto_id')
                     ->whereRaw('TRIM(pa.partida) = TRIM(pg.partida)');
            })
            ->join('acu_materiales as am', 'am.acu_id', '=', 'pa.id')
            ->leftJoin('cronograma_general as cg', function($join) {
                $join->on('cg.presupuesto_id', '=', 'pg.presupuesto_id')
                     ->whereRaw('TRIM(cg.partida) = TRIM(pg.partida)');
            })
            ->where('pg.presupuesto_id', $projectId)
            ->select(
                'am.descripcion',
                'am.unidad',
                'am.precio_unitario as precio',
                'am.cantidad as aporte',
                'pg.metrado as metrado_partida',
                'cg.fecha_inicio',
                'cg.fecha_fin',
                DB::raw('(am.cantidad * pg.metrado) as total_insumo')
            )
            ->get();

        
        $materialesFinales = $materialesRaw->groupBy('descripcion')->map(function ($items, $nombre) use ($periodos) {
            $primerItem = $items->first();
            $mensual = [];

            // Inicializamos todos los meses en 0 para evitar errores de undefined en React
            foreach ($periodos as $p) {
                $mensual[$p['key']] = 0;
            }

            foreach ($items as $item) {
                $totalInsumoPartida = (float)$item->total_insumo;

                // Si no hay fechas, lo cargamos al primer mes disponible
                if (!$item->fecha_inicio || !$item->fecha_fin) {
                    $mensual[$periodos[0]['key']] += $totalInsumoPartida;
                    continue;
                }

                $start = Carbon::parse($item->fecha_inicio)->startOfMonth();
                $end = Carbon::parse($item->fecha_fin)->endOfMonth();
                
                // Distribuir el total entre los meses que dura la partida
                $mesesDePartida = [];
                foreach ($periodos as $p) {
                    $fechaMes = Carbon::parse($p['key']);
                    if ($fechaMes->between($start, $end)) {
                        $mesesDePartida[] = $p['key'];
                    }
                }

                $conteoMeses = count($mesesDePartida);
                if ($conteoMeses > 0) {
                    $montoPorMes = $totalInsumoPartida / $conteoMeses;
                    foreach ($mesesDePartida as $mesKey) {
                        $mensual[$mesKey] += $montoPorMes;
                    }
                }
            }

            return [
                'descripcion' => $nombre,
                'unidad' => $primerItem->unidad,
                'precio' => (float)$primerItem->precio,
                'cantidad_total' => (float)$items->sum('total_insumo'),
                'mensual' => $mensual // Objeto: {"2026-04": 150.50, "2026-05": 0, ...}
            ];
        })->values();

        return Inertia::render('costos/cronogramas/materiales/CronogramaMateriales', [
            'project' => (string)$projectId,
            'materiales' => $materialesFinales,
            'periodos' => $periodos
        ]);
    }
}