<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * costos:reconcile-insumos {project}
 *
 * Recorre las 5 tablas acu_* del proyecto y, para cada fila con insumo_id = null,
 * intenta vincularla con un insumo existente en insumo_productos (por descripcion +
 * tipo). Si no existe, lo crea. En ambos casos actualiza insumo_id y codigo_producto
 * en la fila correspondiente.
 *
 * SEGURIDAD: Este comando nunca elimina ni modifica descripciones, cantidades,
 * precios ni parciales de las filas existentes. Solo rellena insumo_id y
 * codigo_producto que estaban vacios. Es idempotente: puede ejecutarse multiples
 * veces sin efectos adversos.
 */
class ReconcileInsumosCommand extends Command
{
    protected $signature = 'costos:reconcile-insumos {project? : ID del CostoProject (opcional, si no se pasa reconcilia TODOS)} {--force : Ejecutar sin confirmación}';

    protected $description = 'Vincula insumos huérfanos en las tablas acu_* al catálogo insumo_productos de uno o todos los proyectos.';

    private const TABLES = [
        'acu_mano_de_obra' => ['tipo' => 'mano_de_obra',  'price_field' => 'precio_unitario'],
        'acu_materiales' => ['tipo' => 'materiales',    'price_field' => 'precio_unitario'],
        'acu_equipos' => ['tipo' => 'equipos',       'price_field' => 'precio_hora'],
        'acu_subcontratos' => ['tipo' => 'subcontratos',  'price_field' => 'precio_unitario'],
        'acu_subpartidas' => ['tipo' => 'subpartidas',   'price_field' => 'precio_unitario'],
    ];

    public function handle(CostoDatabaseService $dbService): int
    {
        $projectId = $this->argument('project');

        if ($projectId) {
            $projects = CostoProject::where('id', $projectId)->get();
            if ($projects->isEmpty()) {
                $this->error("Proyecto con ID {$projectId} no encontrado.");

                return self::FAILURE;
            }
        } else {
            $projects = CostoProject::all();
            if (! $this->option('force') && $this->confirm("¿Estás seguro de que deseas reconciliar los insumos de TODOS los proyectos ({$projects->count()})?", true) === false) {
                return self::SUCCESS;
            }
        }

        $globalLinked = 0;
        $globalCreated = 0;
        $globalSkipped = 0;

        foreach ($projects as $project) {
            $this->info("Procesando Proyecto: {$project->nombre} (ID: {$project->id}, DB: {$project->database_name})");
            $dbService->setTenantConnection($project->database_name);
            $connection = DB::connection('costos_tenant');

            $totalLinked = 0;
            $totalCreated = 0;
            $totalSkipped = 0;

            foreach (self::TABLES as $table => $config) {
                $tipo = $config['tipo'];
                $priceField = $config['price_field'];

                $orphans = $connection->table($table)
                    ->whereNull('insumo_id')
                    ->get(['id', 'descripcion', 'unidad', $priceField, 'cod_insumo']);

                if ($orphans->isEmpty()) {
                    continue;
                }

                $this->line("  {$table} -- {$orphans->count()} fila(s) sin insumo_id...");

                foreach ($orphans as $orphan) {
                    $descripcion = trim($orphan->descripcion ?? '');
                    if ($descripcion === '') {
                        $totalSkipped++;

                        continue;
                    }

                    // 1. Buscar insumo existente por descripcion + tipo
                    $existing = $connection->table('insumo_productos')
                        ->whereRaw('UPPER(TRIM(descripcion)) = ?', [strtoupper($descripcion)])
                        ->where('tipo', $tipo)
                        ->first();

                    if ($existing) {
                        $connection->table($table)
                            ->where('id', $orphan->id)
                            ->update([
                                'insumo_id' => $existing->id,
                                'codigo_producto' => $existing->codigo_producto,
                                'updated_at' => now(),
                            ]);
                        $totalLinked++;

                        continue;
                    }

                    // 2. Crear nuevo insumo en catalogo
                    $diccionarioId = null;
                    $diccionarioCodigo = '';
                    $codInsumo = trim($orphan->cod_insumo ?? '');
                    if ($codInsumo !== '') {
                        $dic = $connection->table('diccionario')
                            ->where('codigo', $codInsumo)
                            ->first();
                        if ($dic) {
                            $diccionarioId = $dic->id;
                            $diccionarioCodigo = $dic->codigo;
                        }
                    }

                    $unidadId = null;
                    $unidadAbrev = trim($orphan->unidad ?? '');
                    if ($unidadAbrev !== '') {
                        $unidad = $connection->table('unidad')
                            ->where('abreviatura_unidad', $unidadAbrev)
                            ->orWhere('descripcion_singular', $unidadAbrev)
                            ->orWhere('descripcion', $unidadAbrev)
                            ->first();
                        if ($unidad) {
                            $unidadId = $unidad->id;
                        }
                    }

                    $tipoProv = '001';
                    $prefix = $diccionarioCodigo.$tipoProv;
                    $lastM = $connection->table('insumo_productos')
                        ->where('codigo_producto', 'like', $prefix.'%')
                        ->orderBy('codigo_producto', 'desc')
                        ->first();
                    $nextSeq = 1;
                    if ($lastM) {
                        $lastSeq = substr((string) $lastM->codigo_producto, strlen($prefix));
                        if (is_numeric($lastSeq)) {
                            $nextSeq = intval($lastSeq) + 1;
                        }
                    }
                    $codigoProducto = $prefix.str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
                    $precio = (float) ($orphan->$priceField ?? 0);
                    $now = now();

                    $newId = $connection->table('insumo_productos')->insertGetId([
                        'descripcion' => $descripcion,
                        'tipo' => $tipo,
                        'codigo_producto' => $codigoProducto,
                        'diccionario_id' => $diccionarioId,
                        'unidad_id' => $unidadId,
                        'tipo_proveedor' => $tipoProv,
                        'costo_unitario' => $precio,
                        'costo_unitario_lista' => $precio,
                        'costo_flete' => 0,
                        'especificaciones' => null,
                        'fecha_lista' => null,
                        'estado' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    $connection->table($table)
                        ->where('id', $orphan->id)
                        ->update([
                            'insumo_id' => $newId,
                            'codigo_producto' => $codigoProducto,
                            'updated_at' => now(),
                        ]);

                    $totalCreated++;
                }
            }

            $globalLinked += $totalLinked;
            $globalCreated += $totalCreated;
            $globalSkipped += $totalSkipped;

            if ($totalLinked > 0 || $totalCreated > 0) {
                $this->line("    > Vinculados: {$totalLinked} | Creados: {$totalCreated}");
            } else {
                $this->line('    > Todo en orden, sin huerfanos.');
            }
            $this->newLine();
        }

        $this->info('Reconciliacion GLOBAL completada:');
        $this->line("   Total Vinculados a existentes : {$globalLinked}");
        $this->line("   Total Creados en catalogo     : {$globalCreated}");
        $this->line("   Total Omitidos (sin desc.)    : {$globalSkipped}");

        return self::SUCCESS;
    }
}
