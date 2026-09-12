<?php

namespace App\Infrastructure\Mantenimiento\Import;

use App\Domain\Mantenimiento\Import\PresupuestoSource;
use App\Models\CostoProject;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class TenantPresupuestoSource implements PresupuestoSource
{
    private const RESOURCE_TABLES = [
        'mano_de_obra' => ['table' => 'acu_mano_de_obra', 'price' => 'precio_unitario'],
        'materiales' => ['table' => 'acu_materiales', 'price' => 'precio_unitario'],
        'equipos' => ['table' => 'acu_equipos', 'price' => 'precio_hora'],
        'subcontratos' => ['table' => 'acu_subcontratos', 'price' => 'precio_unitario'],
        'subpartidas' => ['table' => 'acu_subpartidas', 'price' => 'precio_unitario'],
    ];

    public function snapshot(CostoProject $project): array
    {
        $presupuestoId = DB::connection('costos_tenant')->table('presupuestos')->whereNull('deleted_at')->orderBy('id')->value('id');
        if (! $presupuestoId) {
            throw ValidationException::withMessages(['presupuesto' => 'El proyecto no tiene un presupuesto disponible.']);
        }

        $connection = DB::connection('costos_tenant');
        $budget = $connection->table('presupuestos')->where('id', $presupuestoId)->whereNull('deleted_at')->first();
        if (! $budget) {
            throw ValidationException::withMessages(['presupuesto' => 'No se encontró la cabecera del presupuesto.']);
        }

        $partidas = $connection->table('presupuesto_general')
            ->where('presupuesto_id', $presupuestoId)
            ->whereNull('deleted_at')
            ->orderBy('item_order')->orderBy('id')
            ->get(['id', 'partida', 'descripcion', 'unidad', 'metrado', 'precio_unitario', 'parcial', 'item_order'])
            ->map(fn ($row) => $this->strings($row, ['metrado', 'precio_unitario', 'parcial']))->all();

        $acus = $connection->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->orderBy('item_order')->orderBy('id')
            ->get(['id', 'partida', 'descripcion', 'unidad', 'rendimiento', 'costo_mano_obra', 'costo_materiales', 'costo_equipos', 'costo_subcontratos', 'costo_subpartidas', 'costo_unitario_total', 'item_order'])
            ->map(fn ($row) => $this->strings($row, ['rendimiento', 'costo_mano_obra', 'costo_materiales', 'costo_equipos', 'costo_subcontratos', 'costo_subpartidas', 'costo_unitario_total']))->all();

        $acuIds = array_column($acus, 'id');
        $resources = [];
        $stats = [];
        foreach (self::RESOURCE_TABLES as $type => $config) {
            [$resources[$type], $stats[$type]] = $this->resources($connection, $acuIds, $type, $config);
        }

        $normalizedPartidas = collect($partidas)->groupBy(fn (array $row) => $this->normalizePartida($row['partida']));
        $missing = 0;
        $ambiguous = 0;
        foreach ($acus as $acu) {
            $matches = $normalizedPartidas->get($this->normalizePartida($acu['partida']), collect());
            $missing += $matches->isEmpty() ? 1 : 0;
            $ambiguous += $matches->count() > 1 ? 1 : 0;
        }

        $payload = [
            'version' => 1,
            'presupuesto' => $this->strings($budget, ['costo_directo', 'gastos_generales', 'utilidad', 'igv_porcentaje', 'total_presupuesto']),
            'partidas' => $partidas,
            'acus' => $acus,
            'resources' => $resources,
        ];

        return $payload + [
            'hash' => hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
            'stats' => [
                'partidas' => count($partidas),
                'acus' => count($acus),
                'resources' => $stats,
                'included' => array_sum(array_column($stats, 'included')),
                'excluded' => array_sum(array_column($stats, 'excluded')),
                'missing' => $missing,
                'ambiguous' => $ambiguous,
            ],
        ];
    }

    private function resources(Connection $connection, array $acuIds, string $type, array $config): array
    {
        if ($acuIds === []) {
            return [[], ['included' => 0, 'excluded' => 0]];
        }
        $schema = Schema::connection('costos_tenant');
        $optional = collect(['cod_insumo', 'codigo_producto', 'proveedor', 'recursos', 'factor_desperdicio'])
            ->filter(fn (string $column) => $schema->hasColumn($config['table'], $column))->all();
        $columns = array_merge(['id', 'acu_id', 'insumo_id', 'descripcion', 'unidad', 'cantidad', $config['price'], 'parcial', 'item_order'], $optional);
        $base = $connection->table($config['table'])->whereIn('acu_id', $acuIds);
        $total = (clone $base)->count();
        $rows = $base->whereNotNull('parcial')->where('parcial', '>', 0)
            ->orderBy('acu_id')->orderBy('item_order')->orderBy('id')->get($columns)
            ->map(function ($row) use ($type, $config) {
                $data = $this->strings($row, ['cantidad', 'parcial', 'recursos', 'factor_desperdicio', $config['price']]);
                $data['resource_type'] = $type;
                $data['precio'] = $data[$config['price']];

                return $data;
            })->all();

        return [$rows, ['included' => count($rows), 'excluded' => $total - count($rows)]];
    }

    private function strings(object $row, array $decimalFields): array
    {
        $data = (array) $row;
        foreach ($decimalFields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $data[$field] = $this->decimalString((string) $data[$field]);
            }
        }

        return $data;
    }

    private function decimalString(string $value): string
    {
        if (! preg_match('/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/', $value, $parts)) {
            return $value;
        }
        $digits = ltrim($parts[2].($parts[3] ?? ''), '0') ?: '0';
        $decimalPosition = strlen($parts[2]) + (int) $parts[4];
        if ($decimalPosition <= 0) {
            $number = '0.'.str_repeat('0', -$decimalPosition).$digits;
        } elseif ($decimalPosition >= strlen($digits)) {
            $number = $digits.str_repeat('0', $decimalPosition - strlen($digits));
        } else {
            $number = substr($digits, 0, $decimalPosition).'.'.substr($digits, $decimalPosition);
        }

        return ($parts[1] === '-' ? '-' : '').$number;
    }

    private function normalizePartida(?string $partida): string
    {
        return collect(explode('.', trim((string) $partida)))
            ->map(fn (string $segment) => (string) ((int) $segment))
            ->implode('.');
    }
}
