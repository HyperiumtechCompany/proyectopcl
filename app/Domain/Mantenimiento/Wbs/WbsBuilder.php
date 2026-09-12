<?php

namespace App\Domain\Mantenimiento\Wbs;

class WbsBuilder
{
    public function __construct(private readonly PartidaClassifier $classifier) {}

    /**
     * Construye el esqueleto WBS desde un snapshot de PresupuestoSource.
     *
     * @param  array  $snapshot  salida de PresupuestoSource::snapshot()
     * @return array{instituciones: list<array>, partidas: list<array>}
     */
    public function build(array $snapshot): array
    {
        $partidas = $snapshot['partidas'] ?? [];
        $acuByPartida = $this->acuCostIndex($snapshot['acus'] ?? []);

        $normSet = [];
        foreach ($partidas as $partida) {
            $normSet[$this->normalize($partida['partida'])] = true;
        }
        $normList = array_keys($normSet);

        $instituciones = [];
        $nodes = [];
        $currentIeRef = null;
        $order = 0;

        foreach ($partidas as $partida) {
            $order += 1024;
            $item = (string) $partida['partida'];
            $norm = $this->normalize($item);
            $segments = $this->segments($item);
            $nivel = count($segments);
            $hasChildren = $this->hasChildren($norm, $normList);
            $tipo = $this->classifier->classify($partida, $hasChildren);

            if ($tipo === 'ie') {
                $currentIeRef = $norm;
                $instituciones[] = [
                    'ref' => $norm,
                    'nombre' => $this->clean($partida['descripcion']),
                    'sort_order' => $order,
                    'source_hash' => hash('sha256', $norm.'|'.$this->clean($partida['descripcion'])),
                ];
            }

            $nodes[] = [
                'ref' => $norm,
                'parent_ref' => $this->resolveParentRef($segments, $normSet),
                'institucion_ref' => $tipo === 'ie' ? null : $currentIeRef,
                'tipo' => $tipo,
                'item' => $item,
                'item_entero' => $nivel === 1,
                'nivel' => $nivel,
                'descripcion' => $this->clean($partida['descripcion']),
                'unidad' => $partida['unidad'] ?? null,
                'metrado' => $this->decimal($partida['metrado'] ?? null),
                'precio_unitario' => $this->decimal($partida['precio_unitario'] ?? null),
                'parcial' => $this->decimal($partida['parcial'] ?? null),
                'costos_acu' => $tipo === 'partida' ? ($acuByPartida[$norm] ?? null) : null,
                'sort_order' => $order,
                'source_id' => $partida['id'] ?? null,
                'source_hash' => hash('sha256', json_encode($partida, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            ];
        }

        return ['instituciones' => $instituciones, 'partidas' => $nodes];
    }

    /**
     * @return array<string, array<string, string|null>>
     */
    private function acuCostIndex(array $acus): array
    {
        $index = [];
        foreach ($acus as $acu) {
            $norm = $this->normalize($acu['partida'] ?? '');
            if ($norm === '' || isset($index[$norm])) {
                continue;
            }
            $index[$norm] = [
                'mano_obra' => $this->decimal($acu['costo_mano_obra'] ?? null),
                'materiales' => $this->decimal($acu['costo_materiales'] ?? null),
                'equipos' => $this->decimal($acu['costo_equipos'] ?? null),
                'subcontratos' => $this->decimal($acu['costo_subcontratos'] ?? null),
                'subpartidas' => $this->decimal($acu['costo_subpartidas'] ?? null),
                'total' => $this->decimal($acu['costo_unitario_total'] ?? null),
            ];
        }

        return $index;
    }

    private function hasChildren(string $norm, array $normList): bool
    {
        $prefix = $norm.'.';
        foreach ($normList as $candidate) {
            if ($candidate !== $norm && str_starts_with($candidate, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, bool>  $normSet
     */
    private function resolveParentRef(array $segments, array $normSet): ?string
    {
        for ($count = count($segments) - 1; $count >= 1; $count--) {
            $candidate = $this->normalize(implode('.', array_slice($segments, 0, $count)));
            if (isset($normSet[$candidate])) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function segments(string $item): array
    {
        return array_values(array_filter(explode('.', trim($item)), static fn (string $part) => $part !== ''));
    }

    private function normalize(string $item): string
    {
        return collect($this->segments($item))
            ->map(static fn (string $segment) => ctype_digit($segment) ? (string) ((int) $segment) : $segment)
            ->implode('.');
    }

    private function clean(?string $value): string
    {
        return trim(preg_replace('/\s+/u', ' ', (string) $value));
    }

    private function decimal(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }
}
