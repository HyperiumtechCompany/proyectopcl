<?php

namespace App\Services\Mantenimiento;

use App\Domain\Mantenimiento\Import\PresupuestoSource;
use App\Domain\Mantenimiento\Wbs\WbsBuilder;
use App\Models\CostoProject;
use App\Models\Mantenimiento\MaintenanceDocument;
use App\Models\Mantenimiento\MaintenanceInstitution;
use App\Models\Mantenimiento\MaintenanceMatMaterial;
use App\Models\Mantenimiento\MaintenancePartida;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MaintenanceWbsImportService
{
    public function __construct(
        private readonly PresupuestoSource $source,
        private readonly WbsBuilder $builder,
        private readonly MaintenanceSnapshotService $snapshots,
        private readonly MaintenanceScenarioService $scenarios,
    ) {}

    public function preview(CostoProject $project, MaintenanceDocument $document): array
    {
        $snapshot = $this->source->snapshot($project);
        $wbs = $this->builder->build($snapshot);

        $partidas = collect($wbs['partidas']);
        $alreadyImported = DB::connection('costos_tenant')->table('mantenimiento_importaciones')
            ->where('documento_id', $document->id)
            ->where('source_hash', $snapshot['hash'])
            ->exists();

        return [
            'source_hash' => $snapshot['hash'],
            'presupuesto' => [
                'id' => $snapshot['presupuesto']['id'] ?? null,
                'nombre' => $snapshot['presupuesto']['nombre'] ?? null,
                'moneda' => $snapshot['presupuesto']['moneda'] ?? 'PEN',
            ],
            'stats' => [
                'instituciones' => count($wbs['instituciones']),
                'bloques' => $partidas->where('tipo', 'bloque')->count(),
                'partidas' => $partidas->where('tipo', 'partida')->count(),
                'con_acu' => $partidas->where('tipo', 'partida')->filter(static fn ($p) => $p['costos_acu'] !== null)->count(),
                'acus' => $snapshot['stats']['acus'] ?? 0,
                'mo_incluidos' => $snapshot['stats']['resources']['mano_de_obra']['included'] ?? 0,
                'mat_incluidos' => $snapshot['stats']['resources']['materiales']['included'] ?? 0,
            ],
            'already_imported' => $alreadyImported,
        ];
    }

    public function import(CostoProject $project, MaintenanceDocument $document, string $sourceHash, string $idempotencyKey, ?int $userId): array
    {
        return DB::connection('costos_tenant')->transaction(function () use ($project, $document, $sourceHash, $idempotencyKey, $userId) {
            $locked = MaintenanceDocument::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();

            // Idempotencia real: solo el mismo request repetido (misma idempotency_key).
            $existing = DB::connection('costos_tenant')->table('mantenimiento_importaciones')
                ->where('documento_id', $locked->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return ['import_id' => $existing->public_id, 'revision' => (int) $locked->revision, 'idempotent' => true, 'summary' => json_decode($existing->summary, true)];
            }

            $snapshot = $this->source->snapshot($project);
            if (! hash_equals($snapshot['hash'], $sourceHash)) {
                throw ValidationException::withMessages(['source_hash' => 'El presupuesto cambió. Genera una nueva previsualización antes de importar.']);
            }

            $this->snapshots->create($locked, 'before_wbs_import', $userId);

            $wbs = $this->builder->build($snapshot);
            [$summary, $refToPublicId] = $this->applyWbs($locked, $wbs);
            $summary['materiales'] = $this->applyMateriales($locked, $snapshot, $refToPublicId);
            $this->scenarios->ensureDefault($locked, 'mo', 'MO');
            $this->scenarios->ensureDefault($locked, 'mat', 'MAT');

            // Un registro de importación por source_hash: si ya existe (re-sync del mismo presupuesto), se actualiza.
            $importsTable = DB::connection('costos_tenant')->table('mantenimiento_importaciones');
            $prior = $importsTable->where('documento_id', $locked->id)->where('source_hash', $sourceHash)->first();
            $publicId = $prior->public_id ?? (string) Str::ulid();
            $attrs = [
                'presupuesto_id' => $snapshot['presupuesto']['id'] ?? 0,
                'idempotency_key' => $idempotencyKey,
                'status' => 'completed',
                'summary' => json_encode($summary, JSON_UNESCAPED_UNICODE),
                'payload' => json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'user_id' => $userId,
                'created_at' => now(),
            ];
            if ($prior) {
                $importsTable->where('id', $prior->id)->update($attrs);
            } else {
                $importsTable->insert($attrs + ['public_id' => $publicId, 'documento_id' => $locked->id, 'source_hash' => $sourceHash]);
            }

            $locked->increment('revision');
            $this->snapshots->create($locked->refresh(), 'after_wbs_import', $userId);

            return ['import_id' => $publicId, 'revision' => (int) $locked->revision, 'idempotent' => false, 'summary' => $summary];
        }, attempts: 3);
    }

    /**
     * @param  array{instituciones: list<array>, partidas: list<array>}  $wbs
     * @return array{0: array<string, int>, 1: array<string, string>}
     */
    private function applyWbs(MaintenanceDocument $document, array $wbs): array
    {
        $summary = ['instituciones' => 0, 'insertadas' => 0, 'actualizadas' => 0, 'retiradas' => 0];

        $ieByRef = [];
        foreach ($wbs['instituciones'] as $ie) {
            $model = MaintenanceInstitution::query()->firstOrNew([
                'documento_id' => $document->id,
                'nombre' => $ie['nombre'],
            ]);
            $model->sort_order = $ie['sort_order'];
            $model->source_hash = $ie['source_hash'];
            $wasNew = ! $model->exists;
            $model->save();
            $ieByRef[$ie['ref']] = $model->id;
            $summary['instituciones'] += $wasNew ? 1 : 0;
        }

        $existing = MaintenancePartida::query()->where('documento_id', $document->id)->get();
        $bySourceId = $existing->where('origen', 'import')->whereNotNull('source_id')->keyBy('source_id');
        $refToPublicId = [];
        $seenSourceIds = [];

        foreach ($wbs['partidas'] as $node) {
            $seenSourceIds[$node['source_id']] = true;
            $model = $node['source_id'] !== null ? $bySourceId->get($node['source_id']) : null;
            $wasNew = $model === null;
            $model ??= new MaintenancePartida(['public_id' => (string) Str::ulid(), 'documento_id' => $document->id, 'origen' => 'import']);

            $model->fill([
                'parent_public_id' => $node['parent_ref'] !== null ? ($refToPublicId[$node['parent_ref']] ?? null) : null,
                'institucion_id' => $node['institucion_ref'] !== null ? ($ieByRef[$node['institucion_ref']] ?? null) : null,
                'tipo' => $node['tipo'],
                'item' => $node['item'],
                'item_entero' => $node['item_entero'],
                'nivel' => $node['nivel'],
                'descripcion' => $node['descripcion'],
                'unidad' => $node['unidad'],
                'metrado' => $node['metrado'] ?? 0,
                'precio_unitario' => $node['precio_unitario'] ?? 0,
                'parcial' => $node['parcial'] ?? 0,
                'costos_acu' => $node['costos_acu'],
                'sort_order' => $node['sort_order'],
                'source_id' => $node['source_id'],
                'source_hash' => $node['source_hash'],
                'source_updated_at' => now(),
            ]);
            $model->save();
            $refToPublicId[$node['ref']] = $model->public_id;
            $summary[$wasNew ? 'insertadas' : 'actualizadas']++;
        }

        $retired = $existing->where('origen', 'import')
            ->filter(static fn (MaintenancePartida $p) => $p->source_id !== null && ! isset($seenSourceIds[$p->source_id]));
        foreach ($retired as $partida) {
            $partida->delete();
            $summary['retiradas']++;
        }

        return [$summary, $refToPublicId];
    }

    /**
     * @param  array<string, string>  $refToPublicId  código de partida normalizado => public_id
     */
    private function applyMateriales(MaintenanceDocument $document, array $snapshot, array $refToPublicId): int
    {
        $acuPartidaById = [];
        foreach ($snapshot['acus'] ?? [] as $acu) {
            $acuPartidaById[$acu['id']] = $this->normalizePartida($acu['partida'] ?? '');
        }

        $existing = MaintenanceMatMaterial::query()->where('documento_id', $document->id)->get();
        $bySourceId = $existing->where('origen', 'import')->whereNotNull('source_id')->keyBy('source_id');
        $seen = [];
        $count = 0;
        $order = 0;

        foreach ($snapshot['resources']['materiales'] ?? [] as $item) {
            $norm = $acuPartidaById[$item['acu_id'] ?? null] ?? null;
            $partidaPublicId = $norm !== null ? ($refToPublicId[$norm] ?? null) : null;
            if ($partidaPublicId === null) {
                continue;
            }

            $order += 1024;
            $seen[$item['id']] = true;
            $model = $bySourceId->get($item['id'])
                ?? new MaintenanceMatMaterial(['public_id' => (string) Str::ulid(), 'documento_id' => $document->id, 'origen' => 'import']);

            $model->fill([
                'partida_public_id' => $partidaPublicId,
                'descripcion' => trim((string) $item['descripcion']),
                'unidad' => $item['unidad'] ?? null,
                'cantidad' => $item['cantidad'] ?? 0,
                'precio_unitario' => $item['precio'] ?? 0,
                'sort_order' => $order,
                'source_id' => $item['id'],
                'source_hash' => hash('sha256', json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            ]);
            $model->save();
            $count++;
        }

        foreach ($existing->where('origen', 'import') as $material) {
            if ($material->source_id !== null && ! isset($seen[$material->source_id])) {
                $material->delete();
            }
        }

        return $count;
    }

    private function normalizePartida(string $item): string
    {
        return collect(array_filter(explode('.', trim($item)), static fn (string $s) => $s !== ''))
            ->map(static fn (string $s) => ctype_digit($s) ? (string) ((int) $s) : $s)
            ->implode('.');
    }
}
