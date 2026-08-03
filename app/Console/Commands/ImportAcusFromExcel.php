<?php

namespace App\Console\Commands;

use App\Models\CostoProject;
use App\Services\CostoDatabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportAcusFromExcel extends Command
{
    protected $signature = 'import:acus-excel
                            {project : ID del proyecto CostoProject}
                            {--file= : Ruta a un archivo Excel específico}
                            {--dir= : Directorio con archivos Excel de ACUs}';

    protected $description = 'Importa ACUs desde archivos Excel a la base de datos tenant del proyecto';

    private const SECTION_HEADERS = ['MANO DE OBRA', 'MATERIALES', 'EQUIPO', 'SUBCONTRATOS', 'SUBPARTIDAS'];

    private CostoDatabaseService $dbService;

    public function __construct(CostoDatabaseService $dbService)
    {
        parent::__construct();
        $this->dbService = $dbService;
    }

    public function handle(): int
    {
        $projectId = $this->argument('project');
        $project = CostoProject::find($projectId);

        if (! $project) {
            $this->error("Proyecto con ID {$projectId} no encontrado.");
            return self::FAILURE;
        }

        $this->dbService->setTenantConnection($project->database_name);
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        if (! $tenantPresupuestoId) {
            $this->error('No se encontró un presupuesto en la base de datos del proyecto.');
            return self::FAILURE;
        }

        $files = $this->resolveExcelFiles();
        if (empty($files)) {
            $this->error('No se encontraron archivos Excel de ACUs.');
            return self::FAILURE;
        }

        $totalCreated = 0;
        $totalUpdated = 0;
        $totalSkipped = 0;

        foreach ($files as $filePath) {
            $this->info("Procesando: " . basename($filePath));

            try {
                [$created, $updated, $skipped] = $this->importFile($filePath, $tenantPresupuestoId);
                $totalCreated += $created;
                $totalUpdated += $updated;
                $totalSkipped += $skipped;

                $this->info("  Creados: {$created}, Actualizados: {$updated}, Omitidos: {$skipped}");
            } catch (\Exception $e) {
                $this->error("  Error al procesar {$filePath}: {$e->getMessage()}");
                Log::error('ImportAcusFromExcel error', [
                    'file' => $filePath,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        // Los componentes se insertan con la cantidad/parcial tal cual vienen del Excel
        // (columnas Q/S), que pueden traer más decimales de los debidos o un parcial que
        // no corresponde exactamente a cantidad × precio. recalculateACUCategories() es la
        // misma rutina que usa el resto del sistema para sanear ACUs: redondea cantidad a
        // 4 decimales, recalcula parcial = cantidad × precio (con manejo especial de
        // Herramientas Manuales) y recompone costo_mano_obra/materiales/equipos/
        // subcontratos/subpartidas como suma de esos parciales corregidos.
        $this->dbService->recalculateACUCategories(DB::connection('costos_tenant'), $tenantPresupuestoId);

        $this->syncAllPrecioUnitario($tenantPresupuestoId);
        $this->syncCostoDirecto($project);

        $this->newLine();
        $this->info("Importación completada:");
        $this->info("  ACUs creados: {$totalCreated}");
        $this->info("  ACUs actualizados: {$totalUpdated}");
        $this->info("  Partidas sin match: {$totalSkipped}");

        return self::SUCCESS;
    }

    private function resolveExcelFiles(): array
    {
        $specificFile = $this->option('file');
        $dir = $this->option('dir');

        if ($specificFile) {
            return [realpath($specificFile) ?: $specificFile];
        }

        $searchDir = $dir ?: base_path();
        $pattern = $searchDir . DIRECTORY_SEPARATOR . 'ACU*.xls*';

        $files = glob($pattern);
        if (empty($files)) {
            $pattern = $searchDir . DIRECTORY_SEPARATOR . 'ACU *.xls*';
            $files = glob($pattern);
        }

        return $files ?: [];
    }

    private function importFile(string $filePath, int $presupuestoId): array
    {
        $reader = IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($filePath);
        $sheet = $spreadsheet->getActiveSheet();
        $maxRow = $sheet->getHighestRow();
        $maxCol = $sheet->getHighestColumn();

        $acus = $this->parseAcus($sheet, $maxRow);
        $this->info("  Encontrados " . count($acus) . " ACUs en el archivo");

        $created = 0;
        $updated = 0;
        $skipped = 0;

        foreach ($acus as $acuIndex => $acu) {
            $partida = $acu['partida'];

            $existingPartida = DB::connection('costos_tenant')
                ->table('presupuesto_general')
                ->where('partida', $partida)
                ->first();

            if (! $existingPartida) {
                $skipped++;
                continue;
            }

            $unidad = $this->extractUnidadFromRendimiento($acu['rendimiento_text'] ?? '');

            DB::connection('costos_tenant')->beginTransaction();

            try {
                $existingAcu = DB::connection('costos_tenant')
                    ->table('presupuesto_acus')
                    ->where('presupuesto_id', $presupuestoId)
                    ->where('partida', $partida)
                    ->first();

                $acuData = [
                    'presupuesto_id' => $presupuestoId,
                    'partida' => $partida,
                    'descripcion' => $acu['descripcion'],
                    'unidad' => $unidad ?: $existingPartida->unidad,
                    'rendimiento' => $acu['rendimiento'] ?? 1,
                    'mano_de_obra' => ! empty($acu['mano_de_obra']) ? json_encode($acu['mano_de_obra']) : null,
                    'costo_mano_obra' => $acu['costo_mano_obra'] ?? 0,
                    'materiales' => ! empty($acu['materiales']) ? json_encode($acu['materiales']) : null,
                    'costo_materiales' => $acu['costo_materiales'] ?? 0,
                    'equipos' => ! empty($acu['equipos']) ? json_encode($acu['equipos']) : null,
                    'costo_equipos' => $acu['costo_equipos'] ?? 0,
                    'subcontratos' => ! empty($acu['subcontratos']) ? json_encode($acu['subcontratos']) : null,
                    'costo_subcontratos' => $acu['costo_subcontratos'] ?? 0,
                    'subpartidas' => ! empty($acu['subpartidas']) ? json_encode($acu['subpartidas']) : null,
                    'costo_subpartidas' => $acu['costo_subpartidas'] ?? 0,
                    'item_order' => $acuIndex,
                    'updated_at' => now(),
                ];

                if ($existingAcu) {
                    DB::connection('costos_tenant')
                        ->table('presupuesto_acus')
                        ->where('id', $existingAcu->id)
                        ->update($acuData);
                    $acuId = $existingAcu->id;
                    $updated++;
                } else {
                    $acuData['created_at'] = now();
                    $acuId = DB::connection('costos_tenant')
                        ->table('presupuesto_acus')
                        ->insertGetId($acuData);
                    $created++;
                }

                $this->syncAcuComponentsFromImport($acuId, $acu);

                DB::connection('costos_tenant')->commit();
            } catch (\Exception $e) {
                DB::connection('costos_tenant')->rollBack();
                throw $e;
            }
        }

        return [$created, $updated, $skipped];
    }

    private function parseAcus($sheet, int $maxRow): array
    {
        $acus = [];
        $currentAcu = null;
        $currentSection = null;

        for ($row = 1; $row <= $maxRow; $row++) {
            $colA = trim((string) $sheet->getCell('A' . $row)->getCalculatedValue());

            // Detect new ACU (Partida header)
            if ($colA === 'Partida:') {
                if ($currentAcu !== null) {
                    $acus[] = $currentAcu;
                }

                $partidaCode = $this->normalizePartidaCode(trim((string) $sheet->getCell('D' . $row)->getCalculatedValue()));
                $descripcion = trim((string) $sheet->getCell('F' . $row)->getCalculatedValue());

                // Also check column G for descripcion if F is empty (OBRAS PROVISIONALES format)
                if (empty($descripcion)) {
                    $descripcion = trim((string) $sheet->getCell('G' . $row)->getCalculatedValue());
                }

                $rendimientoText = trim((string) $sheet->getCell('P' . $row)->getCalculatedValue());
                $rendimiento = $this->parseRendimiento($rendimientoText);

                $currentAcu = [
                    'partida' => $partidaCode,
                    'descripcion' => $descripcion,
                    'rendimiento' => $rendimiento,
                    'rendimiento_text' => $rendimientoText,
                    'mano_de_obra' => [],
                    'materiales' => [],
                    'equipos' => [],
                    'subcontratos' => [],
                    'subpartidas' => [],
                    'costo_mano_obra' => 0,
                    'costo_materiales' => 0,
                    'costo_equipos' => 0,
                    'costo_subcontratos' => 0,
                    'costo_subpartidas' => 0,
                ];
                $currentSection = null;
                continue;
            }

            // Detect section headers (normalize hyphens: SUB-CONTRATOS → SUBCONTRATOS)
            $colAUpper = strtoupper($colA);
            $resolvedSection = $this->resolveSectionKey($colAUpper);
            if ($resolvedSection !== null) {
                $currentSection = $resolvedSection;
                // Section subtotal is in column S
                $subtotal = (float) ($sheet->getCell('S' . $row)->getCalculatedValue() ?? 0);
                $costKey = $this->sectionCostKey($resolvedSection);
                if ($currentAcu !== null) {
                    $currentAcu[$costKey] = $subtotal;
                }
                continue;
            }

            // Skip header rows and empty rows
            if ($colA === 'Ind.' || $colA === '' || $currentAcu === null || $currentSection === null) {
                if ($colA !== '' && $colA !== 'Ind.' && $currentAcu !== null) {
                    // Might be a data row with numeric code
                } else {
                    continue;
                }
            }

            // Check if row starts with "Costo unitario por" - skip
            $colP = trim((string) $sheet->getCell('P' . $row)->getCalculatedValue());
            if (stripos($colP, 'Costo unitario') !== false) {
                continue;
            }

            // Parse component row
            $component = $this->parseComponentRow($sheet, $row, $currentSection);
            if ($component !== null) {
                $sectionKey = $this->sectionDataKey($currentSection);
                $currentAcu[$sectionKey][] = $component;
            }
        }

        // Don't forget the last ACU
        if ($currentAcu !== null) {
            $acus[] = $currentAcu;
        }

        return $acus;
    }

    private function parseComponentRow($sheet, int $row, string $section): ?array
    {
        $colA = trim((string) $sheet->getCell('A' . $row)->getCalculatedValue());
        $colE = trim((string) $sheet->getCell('E' . $row)->getCalculatedValue());
        $colM = trim((string) $sheet->getCell('M' . $row)->getCalculatedValue());
        $colQ = (float) ($sheet->getCell('Q' . $row)->getCalculatedValue() ?? 0);
        $colR = (float) ($sheet->getCell('R' . $row)->getCalculatedValue() ?? 0);
        $colS = (float) ($sheet->getCell('S' . $row)->getCalculatedValue() ?? 0);
        $colN = trim((string) $sheet->getCell('N' . $row)->getCalculatedValue());

        // Must have description
        if (empty($colE)) {
            return null;
        }

        // Skip if it looks like a section header repeating
        if ($this->resolveSectionKey(strtoupper($colE)) !== null) {
            return null;
        }

        $isHerramientas = stripos($colE, 'HERRAMIENTA') !== false;
        $unidad = $colM ?: 'und';
        $recursos = $this->parseRecursos($colN);

        $component = [
            'descripcion' => $colE,
            'unidad' => $unidad,
            'cantidad' => $colQ,
            'parcial' => $colS,
        ];

        switch ($section) {
            case 'MANO DE OBRA':
                $component['precio_unitario'] = $colR;
                $component['recursos'] = $recursos;
                break;

            case 'MATERIALES':
                $component['precio_unitario'] = $colR;
                $component['factor_desperdicio'] = 1.0;
                break;

            case 'EQUIPO':
                if ($isHerramientas) {
                    $component['precio_hora'] = $colR;
                    $component['recursos'] = 0;
                } else {
                    $component['precio_hora'] = $colR;
                    $component['recursos'] = $recursos;
                }
                break;

            case 'SUBCONTRATOS':
            case 'SUBPARTIDAS':
                $component['precio_unitario'] = $colR;
                break;
        }

        return $component;
    }

    private function normalizePartidaCode(string $code): string
    {
        $str = trim($code);
        if ($str === '') {
            return $str;
        }
        $parts = explode('.', $str);
        return implode('.', array_map(fn ($p) => str_pad(preg_replace('/[a-zA-Z]+$/', '', trim($p)), 2, '0', STR_PAD_LEFT), $parts));
    }

    private function parseRendimiento(string $text): float
    {
        if (preg_match('/(\d+[\.,]?\d*)/', $text, $matches)) {
            return (float) str_replace(',', '.', $matches[1]);
        }
        return 1.0;
    }

    private function parseRecursos($val): float
    {
        if ($val === '-' || $val === '' || $val === null) {
            return 0;
        }
        return (float) $val;
    }

    private function extractUnidadFromRendimiento(string $text): string
    {
        // Extract unit from "Rendimiento:120 m³/Día" → "m³"
        if (preg_match('/(\d+[\.,]?\d*)\s*([^\s\/]+)/u', $text, $matches)) {
            return $matches[2];
        }
        return '';
    }

    /**
     * Normaliza el header de sección del Excel a la forma canónica.
     * Maneja variantes con guión: SUB-CONTRATOS → SUBCONTRATOS, SUB-PARTIDAS → SUBPARTIDAS.
     */
    private function resolveSectionKey(string $header): ?string
    {
        $normalized = str_replace('-', '', $header); // SUB-CONTRATOS → SUBCONTRATOS
        if (in_array($normalized, self::SECTION_HEADERS)) {
            return $normalized;
        }
        if (in_array($header, self::SECTION_HEADERS)) {
            return $header;
        }
        return null;
    }

    private function sectionCostKey(string $section): string
    {
        return match ($section) {
            'MANO DE OBRA' => 'costo_mano_obra',
            'MATERIALES' => 'costo_materiales',
            'EQUIPO' => 'costo_equipos',
            'SUBCONTRATOS' => 'costo_subcontratos',
            'SUBPARTIDAS' => 'costo_subpartidas',
            default => 'costo_' . strtolower($section),
        };
    }

    private function sectionDataKey(string $section): string
    {
        return match ($section) {
            'MANO DE OBRA' => 'mano_de_obra',
            'MATERIALES' => 'materiales',
            'EQUIPO' => 'equipos',
            'SUBCONTRATOS' => 'subcontratos',
            'SUBPARTIDAS' => 'subpartidas',
            default => strtolower($section),
        };
    }

    private function syncAcuComponentsFromImport(int $acuId, array $acu): void
    {
        DB::connection('costos_tenant')->table('acu_mano_de_obra')->where('acu_id', $acuId)->delete();
        DB::connection('costos_tenant')->table('acu_materiales')->where('acu_id', $acuId)->delete();
        DB::connection('costos_tenant')->table('acu_equipos')->where('acu_id', $acuId)->delete();
        DB::connection('costos_tenant')->table('acu_subcontratos')->where('acu_id', $acuId)->delete();
        DB::connection('costos_tenant')->table('acu_subpartidas')->where('acu_id', $acuId)->delete();

        $costoManoObra = $acu['costo_mano_obra'] ?? 0;

        foreach ($acu['mano_de_obra'] as $index => $row) {
            DB::connection('costos_tenant')->table('acu_mano_de_obra')->insert([
                'acu_id' => $acuId,
                'insumo_id' => null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? 'hh',
                'cantidad' => $row['cantidad'] ?? 0,
                'recursos' => $row['recursos'] ?? 0,
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'parcial' => $row['parcial'] ?? 0,
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($acu['materiales'] as $index => $row) {
            DB::connection('costos_tenant')->table('acu_materiales')->insert([
                'acu_id' => $acuId,
                'insumo_id' => null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? 'und',
                'cantidad' => $row['cantidad'] ?? 0,
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'factor_desperdicio' => $row['factor_desperdicio'] ?? 1.0,
                'parcial' => $row['parcial'] ?? 0,
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($acu['equipos'] as $index => $row) {
            $isHerramientas = stripos($row['descripcion'] ?? '', 'HERRAMIENTA') !== false;

            if ($isHerramientas) {
                $precioHora = $costoManoObra;
            } else {
                $precioHora = $row['precio_hora'] ?? $row['precio_unitario'] ?? 0;
            }

            DB::connection('costos_tenant')->table('acu_equipos')->insert([
                'acu_id' => $acuId,
                'insumo_id' => null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? 'hm',
                'cantidad' => $row['cantidad'] ?? 0,
                'recursos' => $row['recursos'] ?? 0,
                'precio_hora' => $precioHora,
                'parcial' => $row['parcial'] ?? 0,
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($acu['subcontratos'] ?? [] as $index => $row) {
            DB::connection('costos_tenant')->table('acu_subcontratos')->insert([
                'acu_id' => $acuId,
                'insumo_id' => null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? 'glb',
                'cantidad' => $row['cantidad'] ?? 0,
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'parcial' => $row['parcial'] ?? 0,
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($acu['subpartidas'] ?? [] as $index => $row) {
            DB::connection('costos_tenant')->table('acu_subpartidas')->insert([
                'acu_id' => $acuId,
                'insumo_id' => null,
                'descripcion' => $row['descripcion'] ?? '',
                'unidad' => $row['unidad'] ?? 'und',
                'cantidad' => $row['cantidad'] ?? 0,
                'precio_unitario' => $row['precio_unitario'] ?? 0,
                'parcial' => $row['parcial'] ?? 0,
                'item_order' => $index,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function syncAllPrecioUnitario(int $presupuestoId): void
    {
        $acus = DB::connection('costos_tenant')
            ->table('presupuesto_acus')
            ->where('presupuesto_id', $presupuestoId)
            ->get();

        foreach ($acus as $acu) {
            $costoUnitario = (float) ($acu->costo_unitario_total ?? 0);

            DB::connection('costos_tenant')
                ->table('presupuesto_general')
                ->where('presupuesto_id', $presupuestoId)
                ->where('partida', $acu->partida)
                ->update([
                    'precio_unitario' => $costoUnitario,
                    'updated_at' => now(),
                ]);
        }
    }

    private function syncCostoDirecto(CostoProject $project): void
    {
        $tenantPresupuestoId = $this->dbService->getDefaultPresupuestoId($project->database_name);

        $connection = DB::connection('costos_tenant');
        $total = $connection
            ->table('presupuesto_general')
            ->where('presupuesto_id', $tenantPresupuestoId)
            ->whereNotNull('partida')
            ->where('partida', '!=', '')
            ->sum('parcial');

        $connection
            ->table('presupuestos')
            ->where('id', $tenantPresupuestoId)
            ->update([
                'costo_directo' => $total,
                'updated_at' => now(),
            ]);
    }
}