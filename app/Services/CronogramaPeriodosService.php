<?php

namespace App\Services;

use App\Models\CostoProject;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Genera los mismos periodos (calendario / 30 días) para cualquier módulo
 * que necesite comparar contra el Cronograma Valorizado — hoy Valorizado
 * (programado) y Ejecutado (avance real de campo). Ambos DEBEN usar
 * exactamente los mismos límites de periodo (mismas keys, mismos 'end'),
 * porque los reportes de comparación (PROG VS. EJEC, CONTROL GEN. AVAN.
 * OBRA.) hacen JOIN celda a celda entre programado y ejecutado.
 */
class CronogramaPeriodosService
{
    public const MODO_CALENDARIO = 'calendario';

    public const MODO_30_DIAS = '30dias';

    private const MAX_PERIODOS = 30;

    /**
     * 'cronogramas' (config_json/calendar_settings) vive en la BD central,
     * no en la tenant del proyecto.
     */
    public function fetchCalendarSettings(int $projectId): ?array
    {
        $json = DB::table('cronogramas')->where('project_id', (string) $projectId)->value('config_json');
        $config = $json ? json_decode($json, true) : null;

        return is_array($config['calendar_settings'] ?? null) ? $config['calendar_settings'] : null;
    }

    /**
     * Mismo criterio que ya usaba Valorizado: calendar_settings.projectStart/
     * projectEnd > fechas programadas por partida (Cronograma General) >
     * fechas "marco" del proyecto.
     */
    public function resolveRango(CostoProject $costoProject, ?array $calendarSettings, Collection $fechasProgramadas): array
    {
        if (! empty($calendarSettings['projectStart']) && ! empty($calendarSettings['projectEnd'])) {
            $rangoInicio = Carbon::parse($calendarSettings['projectStart'])->startOfDay();
            $rangoFin = Carbon::parse($calendarSettings['projectEnd'])->startOfDay();
        } elseif ($fechasProgramadas->isNotEmpty()) {
            $rangoInicio = Carbon::parse($fechasProgramadas->min('fecha_inicio'))->startOfDay();
            $rangoFin = Carbon::parse($fechasProgramadas->max('fecha_fin'))->startOfDay();
        } else {
            $rangoInicio = $costoProject->fecha_inicio
                ? Carbon::parse($costoProject->fecha_inicio)->startOfDay()
                : now()->startOfDay();
            $rangoFin = $costoProject->fecha_fin
                ? Carbon::parse($costoProject->fecha_fin)->startOfDay()
                : $rangoInicio->copy()->addMonths(5);
        }

        return [$rangoInicio, $rangoFin];
    }

    public function generarPeriodos(
        string $modoCalculo,
        Carbon $rangoInicio,
        Carbon $rangoFin,
        ?array $calendarSettings
    ): array {
        if ($modoCalculo === self::MODO_30_DIAS) {
            $totalDias = $rangoInicio->diffInDays($rangoFin) + 1;
            $fechaInicioCampo = ! empty($calendarSettings['fechaInicioRealCampo'])
                ? Carbon::parse($calendarSettings['fechaInicioRealCampo'])->startOfDay()
                : $rangoInicio->copy();
            $periodos = $this->generarPeriodos30Dias($fechaInicioCampo->toDateString(), $totalDias);
        } else {
            $inicio = $rangoInicio->copy()->startOfMonth();
            $fin = $rangoFin->copy()->endOfMonth();
            $periodos = $this->generarPeriodosCalendario($inicio, $fin);
        }

        $this->validarLimitePeriodos($periodos);

        return $periodos;
    }

    /**
     * REGLA DE EJECUCIÓN: Cortes al último día de cada mes calendario.
     */
    private function generarPeriodosCalendario(Carbon $inicio, Carbon $fin): array
    {
        $periodos = [];
        $mesNum = 1;
        $cursor = $inicio->copy()->startOfMonth();

        while ($cursor->lte($fin)) {
            $periodos[] = [
                'label' => "MES {$mesNum}",
                'labelCal' => ucfirst($cursor->translatedFormat('M Y')),
                'key' => $cursor->format('Y-m'),
            ];
            $cursor->addMonth();
            $mesNum++;
        }

        return $periodos;
    }

    /**
     * REGLA DE CAMPO (ejecución real): el primer periodo es un tramo corto
     * desde la fecha real de inicio hasta el fin de ese mes calendario (la
     * obra casi nunca arranca el día 1); los periodos siguientes van del día
     * 01 al día 30 de cada mes siguiente (mes comercial de 30 días). Se
     * detiene al completar $totalDias — el mismo plazo contractual que usa
     * el modo calendario, solo que anclado a cuándo realmente empezó la obra
     * en campo en vez del día 1 del mes.
     */
    private function generarPeriodos30Dias(string $startDate, int $totalDias): array
    {
        if ($totalDias <= 0) {
            return [];
        }

        $periodos = [];
        $mesNum = 1;
        $inicioReal = Carbon::parse($startDate);
        $diasRestantes = $totalDias;

        // Aritmética de día-de-mes (no diffInDays contra endOfMonth(): su
        // timestamp 23:59:59 infla el diff por una fracción que redondea a un
        // día de más, haciendo que el periodo 1 termine el 01 del mes
        // siguiente — el mismo día en que arranca el periodo 2).
        $diasHastaFinDeMes = $inicioReal->daysInMonth - $inicioReal->day + 1;
        $diasPrimerPeriodo = min($diasHastaFinDeMes, $diasRestantes);
        $finPeriodo = $inicioReal->copy()->addDays($diasPrimerPeriodo - 1);

        $periodos[] = [
            'label' => "PER {$mesNum}",
            'labelCal' => $inicioReal->format('d/m').'–'.$finPeriodo->format('d/m/Y'),
            'key' => $inicioReal->format('Y-m-d'),
            'end' => $finPeriodo->format('Y-m-d'),
        ];
        $diasRestantes -= $diasPrimerPeriodo;
        $mesNum++;

        // Periodos siguientes: día 01 al 30 de cada mes calendario.
        $cursor = $inicioReal->copy()->addMonthNoOverflow()->startOfMonth();

        while ($diasRestantes > 0) {
            // También topado a los días reales del mes (ej. febrero, 28) — si
            // no, un bloque "de 30" se corre 2 días hacia marzo mientras el
            // siguiente periodo ya arrancó el 01 de marzo, duplicando esos días.
            $diasEstePeriodo = min(30, $cursor->daysInMonth, $diasRestantes);
            $finPeriodo = $cursor->copy()->addDays($diasEstePeriodo - 1);

            $periodos[] = [
                'label' => "PER {$mesNum}",
                'labelCal' => $cursor->format('d/m').'–'.$finPeriodo->format('d/m/Y'),
                'key' => $cursor->format('Y-m-d'),
                'end' => $finPeriodo->format('Y-m-d'),
            ];

            $diasRestantes -= $diasEstePeriodo;
            $cursor = $cursor->copy()->addMonthNoOverflow()->startOfMonth();
            $mesNum++;
        }

        return $periodos;
    }

    private function validarLimitePeriodos(array $periodos): void
    {
        if (count($periodos) > self::MAX_PERIODOS) {
            abort(422, 'El cronograma admite como máximo '.self::MAX_PERIODOS.' periodos.');
        }
    }
}
