<?php

namespace App\Services;

use App\Models\LuminaireProduct;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Servicio de importación de productos luminotécnicos.
 *
 * Soporta formatos: IES (IESNA:LM-63), LDT (EULUMDAT), GLDF (XML extraído).
 * Estrategia dual: parser PHP nativo → si falla, devuelve datos parciales.
 * El WASM en el frontend puede complementar el parsing en tiempo real.
 */
class ProductImportService
{
    /**
     * Reprocesa el archivo original de un producto sin alterar sus campos
     * editables. Se usa para migrar fotometrías legacy ya colocadas.
     *
     * @return array{product: LuminaireProduct, warnings: string[]}
     */
    public function repairStoredProduct(LuminaireProduct $product, bool $persist = true): array
    {
        $storagePath = $product->source_file_path;
        $extension = strtolower((string) $product->source_format);
        if (! is_string($storagePath) || $storagePath === '' || ! Storage::exists($storagePath)) {
            throw new \RuntimeException("No existe el archivo fotométrico original de {$product->name}.");
        }

        $warnings = [];
        $content = file_get_contents(Storage::path($storagePath));
        $parsed = $this->parseWithRust($storagePath, $extension, $warnings) ?? match ($extension) {
            'ies' => $this->parseIes($content, $warnings),
            'ldt' => $this->parseLdt($content, $warnings),
            'gldf' => $this->parseGldf($content, $warnings),
            default => throw new \RuntimeException("Formato {$extension} no reparable."),
        };

        $web = $parsed['photometric_web'] ?? null;
        if (! is_array($web) || empty($web['candela'])) {
            throw new \RuntimeException("El archivo original de {$product->name} no produjo una matriz fotométrica válida.");
        }

        $referenceLumens = (float) ($parsed['photometric_summary']['total_lumens'] ?? $parsed['total_lumens'] ?? 0);
        if ($referenceLumens > 0) {
            $web['reference_lumens'] = $referenceLumens;
        }
        $web['schema_version'] = 2;

        $currentLumens = (float) ($product->total_lumens ?? 0);
        $candelaScale = $referenceLumens > 0 && $currentLumens > 0
            ? $currentLumens / $referenceLumens
            : 1.0;

        // El nombre que el propio archivo declara (línea 9 EULUMDAT / LUMCAT
        // IES) puede haber divergido del nombre visible del producto si éste
        // se renombró en algún momento sin volver a subir el archivo — la
        // reparación reprocesa la fotometría pero NUNCA toca `name` (está en
        // la lista `only()` de arriba), así que es el punto exacto donde
        // detectar ese desfase sin haberlo detectado antes.
        $parsedName = is_string($parsed['name'] ?? null) ? trim($parsed['name']) : null;
        $currentName = trim((string) $product->name);
        if ($parsedName !== null && $parsedName !== '' && $currentName !== ''
            && strcasecmp($parsedName, $currentName) !== 0) {
            $warnings[] = "El nombre del producto (\"{$currentName}\") no coincide con el nombre interno del archivo fotométrico almacenado (\"{$parsedName}\"). El producto pudo renombrarse después de importar un archivo de otra variante — verifica flujo/potencia contra la ficha del fabricante.";
        }

        $data = array_merge($product->only([
            'name', 'manufacturer', 'catalog_number', 'article_number', 'description',
            'total_lumens', 'power_watts', 'cct', 'cri_ra', 'fixture_type',
            'fixture_shape', 'normative_standard', 'product_image_path', 'brand_logo_path',
        ]), [
            'beam_angle_50' => $parsed['beam_angle_50'] ?? $product->beam_angle_50,
            'beam_angle_10' => $parsed['beam_angle_10'] ?? $product->beam_angle_10,
            'max_candela' => isset($parsed['max_candela'])
                ? (float) $parsed['max_candela'] * $candelaScale
                : $product->max_candela,
            'photometric_summary' => $parsed['photometric_summary'] ?? $product->photometric_summary,
            'photometric_web' => $web,
            'dimensions' => $parsed['dimensions'] ?? $product->dimensions,
            'luminous_opening' => $parsed['luminous_opening'] ?? $product->luminous_opening,
            'metadata' => array_merge($product->metadata ?? [], $parsed['metadata'] ?? [], [
                'photometry_repaired_at' => now()->toIso8601String(),
                'source_internal_name' => $parsedName,
            ]),
            // Se regeneran desde la matriz nueva; conservarlos dejaría el CDL
            // y la tabla técnica apuntando a la fotometría antigua.
            'report_data' => null,
            'report_assets' => null,
        ]);
        $data = $this->withReportPayload($data, $warnings);

        if ($persist) {
            $product->update($data);
            $product->refresh();
        } else {
            $product->forceFill($data);
        }

        return ['product' => $product, 'warnings' => $warnings];
    }

    /**
     * Reemplaza el archivo fotométrico de un producto YA EXISTENTE — Ronda
     * 21e: hallazgo real del usuario ("hay algunas luminarias que no tienen
     * el .ldt correcto... eso es lo que hace fallar el cálculo para mis
     * clientes"). Distinto de `repairStoredProduct()` (que re-parsea el
     * MISMO archivo ya guardado, para recuperar campos que un parser viejo
     * no extraía) — este método recibe un archivo NUEVO y reemplaza tanto el
     * archivo en storage como toda la fotometría derivada de él.
     *
     * @param  array<string, mixed>  $overrides
     * @return array{product: LuminaireProduct, warnings: string[]}
     */
    public function replacePhotometricFile(LuminaireProduct $product, UploadedFile $file, ?int $userId, array $overrides = []): array
    {
        $warnings = [];
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, ['ies', 'ldt', 'gldf'], true)) {
            throw new \RuntimeException("Formato \".{$extension}\" no soportado para reemplazar la fotometría — usa .ies, .ldt o .gldf.");
        }

        $storagePath = $this->storeFile($file, $userId);
        $content = file_get_contents($file->getRealPath());
        $parsed = $this->parseWithRust($storagePath, $extension, $warnings) ?? match ($extension) {
            'ies' => $this->parseIes($content, $warnings),
            'ldt' => $this->parseLdt($content, $warnings),
            'gldf' => $this->parseGldf($content, $warnings),
        };

        $web = $parsed['photometric_web'] ?? null;
        if (! is_array($web) || empty($web['candela'])) {
            throw new \RuntimeException('El archivo nuevo no produjo una matriz fotométrica válida — no se reemplazó la fotometría existente.');
        }
        $web['schema_version'] = 2;

        $parsedName = is_string($parsed['name'] ?? null) ? trim($parsed['name']) : null;

        // Mismo caso especial que `import()`: `lamp_type` vive en `metadata`,
        // no puede pasar por el `array_merge` genérico de overrides sin
        // pisar el resto de `metadata` que el parser nuevo acaba de armar.
        $lampTypeOverride = is_string($overrides['lamp_type'] ?? null) ? trim($overrides['lamp_type']) : null;
        unset($overrides['lamp_type']);

        $data = array_merge($parsed, array_filter($overrides, fn ($v) => $v !== null));
        $data['source_format'] = $extension;
        $data['source_file_path'] = $storagePath;
        $data['source_file_name'] = $file->getClientOriginalName();
        $data['metadata'] = array_merge(
            is_array($data['metadata'] ?? null) ? $data['metadata'] : [],
            $parsedName !== null && $parsedName !== '' ? ['source_internal_name' => $parsedName] : [],
            $lampTypeOverride !== null && $lampTypeOverride !== '' ? ['lamp_type' => $lampTypeOverride] : [],
        );
        // Se regeneran desde la matriz nueva — conservar los del archivo
        // anterior dejaría el CDL polar y la tabla técnica del PDF apuntando
        // a la fotometría que se está reemplazando.
        $data['report_data'] = null;
        $data['report_assets'] = null;
        $data = $this->withReportPayload($data, $warnings);

        $product->update($data);
        $product->refresh();

        return ['product' => $product, 'warnings' => $warnings];
    }

    /**
     * Importa un archivo fotométrico. Con `$persist = true` (default) guarda
     * el producto en el catálogo, igual que siempre. Con `$persist = false`
     * (modal de previsualización antes de guardar) corre exactamente el
     * mismo parseo/validación/armado de reporte y devuelve un modelo SIN
     * persistir — mismo patrón ya usado por `repairStoredProduct()`. El
     * archivo original SÍ se guarda en storage en ambos casos (Rust necesita
     * una ruta real para parsear) — si el usuario cancela el modal, ese
     * archivo queda huérfano, aceptable frente a la alternativa de manejar
     * un archivo temporal con limpieza propia para un flujo que de todas
     * formas reintenta con el archivo real al confirmar.
     *
     * @return array{product: LuminaireProduct, warnings: string[]}
     */
    public function import(
        UploadedFile $file,
        ?int $userId,
        array $overrides = [],
        bool $persist = true,
    ): array {
        $warnings = [];
        $extension = strtolower($file->getClientOriginalExtension());
        $sourceFormat = in_array($extension, ['ies', 'ldt', 'gldf'], true)
            ? $extension
            : 'manual';
        $originalName = $file->getClientOriginalName();

        // Guardar archivo original en storage
        $storagePath = $this->storeFile($file, $userId);

        // Leer contenido del archivo
        $content = file_get_contents($file->getRealPath());

        // Parsear según formato
        $parsed = $this->parseWithRust($storagePath, $extension, $warnings) ?? match ($extension) {
            'ies' => $this->parseIes($content, $warnings),
            'ldt' => $this->parseLdt($content, $warnings),
            'gldf' => $this->parseGldf($content, $warnings),
            default => [
                'name' => pathinfo($originalName, PATHINFO_FILENAME),
                'source_format' => 'manual',
            ],
        };

        // El nombre override (elegido por el usuario en el diálogo de
        // importación) puede divergir del nombre que el propio archivo
        // fotométrico declara internamente (línea 9 EULUMDAT / palabra clave
        // LUMCAT IES) — p.ej. el usuario etiqueta el producto como variante
        // "...400.24" pero el .ldt subido es en realidad el de la variante
        // "...400.05" (mismo fabricante, óptica distinta, flujo distinto).
        // Sin este aviso, un archivo fotométrico equivocado queda importado
        // en silencio bajo un nombre de producto que no le corresponde.
        $overrideName = is_string($overrides['name'] ?? null) ? trim($overrides['name']) : null;
        $parsedName = is_string($parsed['name'] ?? null) ? trim($parsed['name']) : null;
        if ($overrideName !== null && $parsedName !== null && $overrideName !== '' && $parsedName !== ''
            && strcasecmp($overrideName, $parsedName) !== 0) {
            $warnings[] = "El nombre indicado (\"{$overrideName}\") no coincide con el nombre interno del archivo fotométrico (\"{$parsedName}\"). Verifica que se subió el archivo correcto para este producto — podría tratarse de otra variante con distinto flujo/potencia.";
        }

        // Aplicar overrides del usuario. `lamp_type` es un caso especial: no
        // es una columna propia, vive dentro de `metadata` — si se deja que
        // `array_merge` lo trate como cualquier otro override, pisaría TODO
        // `metadata` ya armado por el parser (parser/format_version/
        // luminaire_type/DFF%/etc.) en vez de solo corregir ese campo.
        $lampTypeOverride = is_string($overrides['lamp_type'] ?? null) ? trim($overrides['lamp_type']) : null;
        unset($overrides['lamp_type']);
        $data = array_merge($parsed, array_filter($overrides, fn ($v) => $v !== null));
        if ($lampTypeOverride !== null && $lampTypeOverride !== '') {
            $data['metadata'] = array_merge(is_array($data['metadata'] ?? null) ? $data['metadata'] : [], ['lamp_type' => $lampTypeOverride]);
        }

        // Duplicado de catálogo: si ya existe un producto con el mismo
        // `catalog_number`, importar este segundo no es un error (puede ser
        // una revisión legítima del fabricante, o una recalibración
        // deliberada del flujo declarado — ver LuminaireProduct id=9 vs
        // id=10 de TEG18046, `planes/plan_cierre_brecha_paridad_dialux_evo.md`
        // Ronda 19), pero dejarlo pasar en silencio es lo que después
        // confunde: dos fixtures colocados con el "mismo" código de catálogo
        // terminan con flujo/potencia distintos sin que quede rastro de por
        // qué. Solo advierte — nunca bloquea el import.
        $catalogNumber = is_string($data['catalog_number'] ?? null) ? trim($data['catalog_number']) : null;
        if ($catalogNumber !== null && $catalogNumber !== '') {
            $existing = LuminaireProduct::query()
                ->where('catalog_number', $catalogNumber)
                ->get(['id', 'name', 'total_lumens', 'power_watts']);
            if ($existing->isNotEmpty()) {
                $conflicts = $existing
                    ->map(fn ($p) => "#{$p->id} \"{$p->name}\" ({$p->total_lumens} lm / {$p->power_watts} W)")
                    ->implode('; ');
                $warnings[] = "Ya existe(n) {$existing->count()} producto(s) con el código de catálogo \"{$catalogNumber}\": {$conflicts}. Si es el mismo modelo físico, verifica que los valores de flujo/potencia coincidan o que la diferencia esté documentada — dos entradas con el mismo código y datos distintos generan resultados que no se pueden comparar entre sí.";
            }
        }

        // Asegurar campos obligatorios
        $data['source_format'] = $sourceFormat;
        $data['source_file_path'] = $storagePath;
        $data['source_file_name'] = $originalName;
        $data['user_id'] = $userId;
        $data['name'] = $data['name'] ?? pathinfo($originalName, PATHINFO_FILENAME);
        // Se conserva el nombre TAL COMO lo declara el archivo (independiente
        // de un override posterior) para poder avisar más adelante si el
        // producto se renombra (`update()`) de forma que ya no corresponda
        // al archivo fotométrico realmente almacenado — ver aviso análogo
        // arriba para el caso de override en el momento de la importación.
        if ($parsedName !== null && $parsedName !== '') {
            $data['metadata'] = array_merge(is_array($data['metadata'] ?? null) ? $data['metadata'] : [], [
                'source_internal_name' => $parsedName,
            ]);
        }
        $data = $this->withReportPayload($data, $warnings);

        $product = $persist
            ? LuminaireProduct::query()->create($data)
            : LuminaireProduct::make($data);

        return ['product' => $product, 'warnings' => $warnings];
    }

    /**
     * Crea una luminaria a partir de datos ingresados manualmente (sin archivo IES/LDT).
     * Sintetiza una distribución fotométrica simétrica (modelo coseno^n) a partir del
     * ángulo de apertura (beam angle 50%) publicado en la ficha técnica del fabricante,
     * para habilitar el cálculo punto-por-punto real en vez del Lambertiano genérico.
     *
     * @param  array<string, mixed>  $data
     */
    public function createManual(array $data, ?int $userId): LuminaireProduct
    {
        $totalLumens = (float) $data['total_lumens'];
        $customTable = $data['photometric_table'] ?? null;
        $hasCustomCurve = is_array($customTable) && count($customTable) >= 3;

        if ($hasCustomCurve) {
            $photometric = $this->buildManualPhotometricWebFromTable($customTable);
            $beamAngle50 = $photometric['beam_angle_50'];
            $beamAngle10 = $photometric['beam_angle_10'];
        } else {
            $beamAngle50 = (float) $data['beam_angle_50'];
            $photometric = $this->buildManualPhotometricWeb($totalLumens, $beamAngle50);
            $beamAngle10 = null;
        }

        $record = array_filter([
            'user_id' => $userId,
            'name' => $data['name'],
            'manufacturer' => $data['manufacturer'] ?? null,
            'catalog_number' => $data['catalog_number'] ?? null,
            'source_format' => 'manual',
            'total_lumens' => $totalLumens,
            'power_watts' => $data['power_watts'] ?? null,
            'cct' => $data['cct'] ?? null,
            'cri_ra' => $data['cri_ra'] ?? null,
            'beam_angle_50' => $beamAngle50,
            'beam_angle_10' => $beamAngle10,
            'max_candela' => $photometric['max_candela'],
            'fixture_type' => $data['fixture_type'] ?? null,
            'fixture_shape' => $data['fixture_shape'] ?? null,
            'dimensions' => $data['dimensions'] ?? null,
            'product_image_path' => $data['product_image_path'] ?? null,
            'brand_logo_path' => $data['brand_logo_path'] ?? null,
        ], fn ($value): bool => $value !== null);

        $record['photometric_summary'] = $hasCustomCurve
            ? [
                'format_version' => 'manual-custom-curve',
                'total_lumens' => $totalLumens,
                'beam_angle_50' => $beamAngle50,
                'points' => count($customTable),
            ]
            : [
                'format_version' => 'manual-cosine-model',
                'total_lumens' => $totalLumens,
                'beam_angle_50' => $beamAngle50,
            ];
        // `provenance` distingue una curva realmente medida/ingresada por el
        // usuario ('manual-curve') de una aproximación puramente matemática
        // ('synthetic') — ninguna de las dos es dato de fabricante, pero no
        // son la misma confiabilidad, y el informe debe poder decir cuál es.
        $record['photometric_web'] = [
            'c_angles' => $photometric['c_angles'],
            'gamma_angles' => $photometric['gamma_angles'],
            'candela' => $photometric['candela'],
            'provenance' => $hasCustomCurve ? 'manual-curve' : 'synthetic',
        ];

        $record = $this->withReportPayload($record, [
            $hasCustomCurve
                ? 'Distribución fotométrica ingresada manualmente por el usuario (curva propia punto a punto, simetría rotacional asumida); no proviene de un archivo IES/LDT del fabricante.'
                : 'Distribución fotométrica sintética (modelo coseno^n) derivada del ángulo de apertura declarado; no proviene de un archivo IES/LDT del fabricante.',
        ]);

        return LuminaireProduct::query()->create($record);
    }

    /**
     * Construye la matriz fotométrica a partir de una curva (gamma, candela) ingresada
     * a mano por el usuario, asumiendo simetría rotacional (un solo plano C=0).
     * El ángulo de haz (50%/10%) se calcula de la curva real en vez de declararse.
     *
     * @param  array<int, array{gamma: numeric, candela: numeric}>  $table
     * @return array{c_angles: float[], gamma_angles: float[], candela: float[][], max_candela: float, beam_angle_50: float, beam_angle_10: float}
     */
    private function buildManualPhotometricWebFromTable(array $table): array
    {
        usort($table, fn (array $a, array $b): int => $a['gamma'] <=> $b['gamma']);

        $gammaAngles = array_map(fn (array $row): float => (float) $row['gamma'], $table);
        $candelaRow = array_map(fn (array $row): float => (float) $row['candela'], $table);
        $maxCandela = $candelaRow === [] ? 0.0 : max($candelaRow);

        [$beam50, $beam10] = $this->computeBeamAngles($candelaRow, $gammaAngles, $maxCandela);

        return [
            'c_angles' => [0.0],
            'gamma_angles' => $gammaAngles,
            'candela' => [$candelaRow],
            'max_candela' => round($maxCandela, 1),
            'beam_angle_50' => $beam50,
            'beam_angle_10' => $beam10,
        ];
    }

    /**
     * Sintetiza una curva de candelas axialmente simétrica I(gamma) = I0 * cos(gamma)^n,
     * resuelta para que I(beamAngle50) = I0/2, con I0 escalado para que el flujo total
     * integrado sobre el hemisferio coincida con `totalLumens`.
     *
     * @return array{c_angles: float[], gamma_angles: float[], candela: float[][], max_candela: float}
     */
    private function buildManualPhotometricWeb(float $totalLumens, float $beamAngle50Deg): array
    {
        $clampedBeamAngle = min(max($beamAngle50Deg, 1.0), 89.9);
        $cosBeam = cos(deg2rad($clampedBeamAngle));
        $n = $cosBeam > 0.0 ? log(0.5) / log($cosBeam) : 1.0;
        $n = max($n, 0.1);

        // Flujo hemisférico: Φ = 2π·I0/(n+1)  ⇒  I0 = Φ·(n+1)/(2π)
        $peakCandela = $totalLumens * ($n + 1) / (2 * M_PI);

        $gammaAngles = [];
        $candelaRow = [];
        for ($deg = 0; $deg <= 90; $deg += 5) {
            $gammaAngles[] = (float) $deg;
            $candelaRow[] = round($peakCandela * (cos(deg2rad($deg)) ** $n), 2);
        }

        return [
            'c_angles' => [0.0],
            'gamma_angles' => $gammaAngles,
            'candela' => [$candelaRow],
            'max_candela' => round($peakCandela, 1),
        ];
    }

    // ─── Almacenamiento ───────────────────────────────────────────────────────

    private function storeFile(UploadedFile $file, ?int $userId): string
    {
        $dir = $userId
            ? "dialux/products/user_{$userId}"
            : 'dialux/products/global';

        return $file->storeAs($dir, Str::uuid().'.'.$file->getClientOriginalExtension());
    }

    /**
     * @param  string[]  $warnings
     * @return array<string, mixed>|null
     */
    private function parseWithRust(string $storagePath, string $extension, array &$warnings): ?array
    {
        // GLDF queda fuera a propósito: Rust no extrae matriz fotométrica
        // para este formato (igual que `parseGldf` en PHP), así que no
        // aporta nada sobre delegarlo directamente al parser PHP — que
        // además es el único que deja registrada la advertencia explícita
        // de "matriz no implementada" que el resto del sistema espera leer.
        if (! in_array($extension, ['ies', 'ldt'], true)) {
            return null;
        }

        $binary = $this->resolveRustBinary();
        if (! $binary) {
            return null;
        }

        try {
            $process = new Process([$binary, Storage::path($storagePath)]);
            $process->setTimeout(20);
            $process->run();

            if (! $process->isSuccessful()) {
                $warnings[] = 'Rust: parser no disponible o devolvio error; se uso fallback PHP.';

                return null;
            }

            $payload = json_decode($process->getOutput(), true);
            if (! is_array($payload)) {
                $warnings[] = 'Rust: salida JSON invalida; se uso fallback PHP.';

                return null;
            }

            foreach (($payload['warnings'] ?? []) as $warning) {
                if (is_string($warning) && $warning !== '') {
                    $warnings[] = $warning;
                }
            }

            // El binario Rust parsea el mismo archivo de fabricante que la
            // ruta PHP — la matriz que produce es tan "manufacturer" como la
            // de `parseIes`/`parseLdt`, solo que el binario hoy no anota
            // `provenance` en su salida.
            $rustPhotometricWeb = $payload['photometric_web'] ?? null;

            // Un plano sin ningún punto de candela (p.ej. GLDF, que Rust no
            // sabe extraer todavía y devuelve como matriz vacía) no es una
            // fotometría válida — tratarlo como "sin matriz" en vez de un
            // objeto con arrays vacíos evita que se reporte `provenance:
            // manufacturer`/`reference_lumens` sobre datos que no existen.
            if (is_array($rustPhotometricWeb) && $this->candelaPointCount($rustPhotometricWeb['candela'] ?? []) === 0) {
                $rustPhotometricWeb = null;
            }

            if (is_array($rustPhotometricWeb) && ! isset($rustPhotometricWeb['provenance'])) {
                $rustPhotometricWeb['provenance'] = 'manufacturer';
            }
            if (is_array($rustPhotometricWeb) && ! isset($rustPhotometricWeb['reference_lumens'])) {
                $rustPhotometricWeb['reference_lumens'] = $payload['photometric_summary']['total_lumens']
                    ?? $payload['total_lumens']
                    ?? null;
            }

            // Rust no replica las validaciones de integridad del parser PHP
            // (ángulos monotónicos, forma de la matriz de candela, flujo
            // declarado vs. integrado) — se corren aquí, sobre la misma
            // matriz ya extraída, para que un archivo mal formado avise igual
            // sin importar qué parser lo procesó primero.
            if (is_array($rustPhotometricWeb)) {
                $cAngles = is_array($rustPhotometricWeb['c_angles'] ?? null) ? $rustPhotometricWeb['c_angles'] : [];
                $gAngles = is_array($rustPhotometricWeb['gamma_angles'] ?? null) ? $rustPhotometricWeb['gamma_angles'] : [];
                $candela = is_array($rustPhotometricWeb['candela'] ?? null) ? $rustPhotometricWeb['candela'] : [];
                $label = strtoupper($extension);
                $this->checkAngleMonotonic($cAngles, "C ({$label})", $warnings);
                $this->checkAngleMonotonic($gAngles, "gamma ({$label})", $warnings);
                if ($extension === 'ies') {
                    $this->checkMatrixDimensions($candela, count($cAngles), count($gAngles), $label, $warnings);
                }
                $this->checkFluxConsistency((float) ($payload['total_lumens'] ?? 0), $candela, $gAngles, $cAngles, $label, $warnings);
            }

            return array_filter([
                'name' => $payload['name'] ?? null,
                'manufacturer' => $payload['manufacturer'] ?? null,
                'catalog_number' => $payload['catalog_number'] ?? null,
                'article_number' => $payload['article_number'] ?? null,
                'description' => $payload['description'] ?? null,
                'total_lumens' => $payload['total_lumens'] ?? null,
                'power_watts' => $payload['power_watts'] ?? null,
                'cct' => $payload['cct'] ?? null,
                'cri_ra' => $payload['cri_ra'] ?? null,
                'beam_angle_50' => $payload['beam_angle_50'] ?? null,
                'beam_angle_10' => $payload['beam_angle_10'] ?? null,
                'max_candela' => $payload['max_candela'] ?? null,
                'photometric_summary' => $payload['photometric_summary'] ?? null,
                'photometric_web' => $rustPhotometricWeb,
                'dimensions' => $payload['dimensions'] ?? null,
                'luminous_opening' => $payload['luminous_opening'] ?? null,
                'metadata' => $payload['metadata'] ?? null,
                // `report_data`/`report_assets` NO se reenvían: Rust ya
                // incluye su propia copia de `warnings` ahí dentro, y
                // `withReportPayload()` (llamado siempre después de esto)
                // hace `array_replace_recursive` dejando ganar lo que ya
                // venga en `$data['report_data']` — con la copia de Rust
                // presente, las validaciones agregadas arriba nunca
                // llegarían al informe. `withReportPayload` reconstruye
                // igual de bien esta sección a partir de los campos planos.
            ], fn ($value): bool => $value !== null);
        } catch (Throwable) {
            $warnings[] = 'Rust: no se pudo ejecutar el parser; se uso fallback PHP.';

            return null;
        }
    }

    private function resolveRustBinary(): ?string
    {
        $configured = config('services.dialux_photometry.binary');
        if (is_string($configured) && $configured !== '' && is_file($configured)) {
            return $configured;
        }

        $binaryName = PHP_OS_FAMILY === 'Windows'
            ? 'dialux-photometry.exe'
            : 'dialux-photometry';

        foreach ([
            base_path("dialux-photometry/target/release/{$binaryName}"),
            base_path("dialux-photometry/target/debug/{$binaryName}"),
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    // ─── Parser IES (IESNA:LM-63) ────────────────────────────────────────────

    /**
     * Parsea el contenido de un archivo .IES y retorna array de campos para el modelo.
     *
     * @param  string[]  $warnings
     * @return array<string, mixed>
     */
    private function parseIes(string $content, array &$warnings): array
    {
        $lines = explode("\n", str_replace("\r", '', $content));
        $keywords = [];
        $idx = 0;

        // Versión del formato
        $formatVersion = 'IESNA:LM-63-1991';
        if (isset($lines[0]) && str_starts_with(trim($lines[0]), 'IESNA')) {
            $formatVersion = trim($lines[0]);
            $idx = 1;
        }

        // Parsear keywords [KEY] value
        while ($idx < count($lines)) {
            $line = trim($lines[$idx]);
            if (str_starts_with($line, 'TILT')) {
                break;
            }
            if (str_starts_with($line, '[')) {
                preg_match('/\[([^\]]+)\]\s*(.*)/s', $line, $m);
                if (isset($m[1])) {
                    $keywords[strtoupper($m[1])] = trim($m[2]);
                }
            }
            $idx++;
        }

        // Línea TILT (NONE / INCLUDE / nombre de archivo externo — LM-63 permite las 3 formas)
        $tiltLine = $lines[$idx] ?? 'TILT=NONE';
        $tiltType = strtoupper(trim(explode('=', $tiltLine)[1] ?? 'NONE'));
        $idx++;

        // Recolectar TODOS los números restantes en un único flujo (config +
        // ángulos + candela, y si TILT=INCLUDE, precedidos por la tabla de
        // tilt). Tokenizar de una sola vez evita el bug anterior: LM-63
        // permite que la tabla de tilt (N ángulos + N multiplicadores) y la
        // matriz de candela se envuelvan en cualquier cantidad de líneas
        // físicas — contar líneas en vez de tokens numéricos desalineaba
        // todo lo que viene después cuando TILT=INCLUDE.
        $numbers = [];
        for ($i = $idx; $i < count($lines); $i++) {
            foreach (preg_split('/[\s,]+/', trim($lines[$i])) as $token) {
                $token = str_replace(',', '.', $token);
                if (is_numeric($token)) {
                    $numbers[] = (float) $token;
                }
            }
        }

        $tiltTable = null;
        if ($tiltType === 'INCLUDE') {
            // Formato: geometría lámpara-luminaria (1 valor) → N (1 valor) →
            // N ángulos → N multiplicadores → recién ahí el bloque de 10
            // campos de configuración.
            if (count($numbers) < 2) {
                $warnings[] = 'IES: TILT=INCLUDE declarado pero faltan los datos de geometría/tabla de tilt.';
            } else {
                $lampToLuminaireGeometry = (int) array_shift($numbers);
                $tiltPairCount = (int) array_shift($numbers);
                if ($tiltPairCount > 0 && count($numbers) >= $tiltPairCount * 2) {
                    $tiltAngles = array_splice($numbers, 0, $tiltPairCount);
                    $tiltMultipliers = array_splice($numbers, 0, $tiltPairCount);
                    $tiltTable = [
                        'lamp_to_luminaire_geometry' => $lampToLuminaireGeometry,
                        'angles' => $tiltAngles,
                        'multipliers' => $tiltMultipliers,
                    ];
                    // La tabla se registra para trazabilidad. El multiplicador
                    // por-ángulo (`photometricInterpolation.ts::tiltMultiplier`)
                    // solo se aplica cuando geometría=3 (lámpara orientable) Y el
                    // usuario declaró el ángulo real de instalación en el editor
                    // (`Fixture.installationTiltDeg`) — el archivo IES nunca
                    // declara esa orientación física, así que sin ese dato del
                    // usuario el multiplicador se mantiene en 1 (sin corrección),
                    // igual que en TILT=NONE. Para geometría 1/2 (lámpara fija) no
                    // hay causa física verificable para elegir un ángulo, así que
                    // nunca se aplica.
                    $warnings[] = 'IES: TILT=INCLUDE detectado — tabla de tilt registrada en metadata. Para geometría 3 (orientable), declare el ángulo de instalación en el editor para que se aplique al cálculo; para geometría 1/2 (fija) el archivo no declara la orientación física y no se aplica.';
                } else {
                    $warnings[] = 'IES: TILT=INCLUDE declarado pero la tabla de ángulos/multiplicadores está incompleta o inconsistente con N.';
                }
            }
        } elseif ($tiltType !== 'NONE') {
            $warnings[] = "IES: TILT={$tiltType} (archivo externo) no soportado; se ignora y se asume TILT=NONE.";
        }

        if (count($numbers) < 13) {
            $warnings[] = 'IES: datos de configuración insuficientes';

            return $this->keywordsToProductData($keywords, $formatVersion);
        }

        // 10 campos de configuración
        [$numLamps, $lumensPerLamp, $multiplier, $numV, $numH,
            $photometricType, $unitsType, $lumWidth, $lumLength, $lumHeight] = $numbers;

        $numV = max(1, (int) $numV);
        $numH = max(1, (int) $numH);

        // LM-63 exige una línea adicional de 3 campos justo después de la
        // línea de 10 campos, ANTES de los ángulos verticales: <ballast
        // factor> <ballast-lamp photometric factor> <input watts> — nunca se
        // saltaba, así que los ángulos verticales/horizontales y la matriz de
        // candela quedaban desplazados 3 posiciones en TODO archivo IES real
        // (los 3 fixtures de test que validaban este parser la omitían, por
        // eso no se detectó hasta importar un archivo real de fabricante —
        // ver planes/plan_cierre_brecha_paridad_dialux_evo.md). `inputWatts`
        // se usa como respaldo de potencia cuando el archivo no declara
        // `[WATTS]`/`[WATTAGE]` (muchos archivos reales solo la declaran acá,
        // como texto libre en `[_ELECTRICALS]`, no como keyword aparte).
        $ballastFactor = $numbers[10];
        $ballastLampPhotometricFactor = $numbers[11];
        $inputWatts = $numbers[12];
        $ni = 13;

        // Ángulos verticales
        $vAngles = array_slice($numbers, $ni, $numV);
        $ni += $numV;

        // Ángulos horizontales
        $hAngles = array_slice($numbers, $ni, $numH);
        $ni += $numH;

        // Matriz de candelas [h][v]
        $candela = [];
        for ($h = 0; $h < $numH; $h++) {
            $plane = array_slice($numbers, $ni, $numV);
            foreach ($plane as &$c) {
                $c *= $multiplier;
            }
            $candela[] = $plane;
            $ni += $numV;
        }

        // Validaciones de integridad de la matriz (Fase 3 del plan maestro:
        // "garantizar que el dato de fabricante llega correctamente al
        // solver") — no bloquean el import (igual que el resto del parser),
        // pero dejan advertencia explícita si algo no cuadra.
        $this->checkAngleMonotonic($vAngles, 'verticales (gamma)', $warnings);
        $this->checkAngleMonotonic($hAngles, 'horizontales (C)', $warnings);
        $this->checkMatrixDimensions($candela, $numH, $numV, 'IES', $warnings);

        // Calcular métricas derivadas
        $totalLumens = ($lumensPerLamp > 0)
            ? $lumensPerLamp * $numLamps
            : $this->estimateLumens($candela, $vAngles, $hAngles);

        $this->checkFluxConsistency($totalLumens, $candela, $vAngles, $hAngles, 'IES', $warnings);

        $maxCandela = max(0.0, ...array_merge(...$candela));
        [$beam50, $beam10] = $this->computeBeamAngles($candela[0] ?? [], $vAngles, $maxCandela);

        // El campo numérico `inputWatts` (línea de ballast, LM-63) es la
        // fuente estándar de potencia — `[WATTS]`/`[WATTAGE]` son keywords no
        // estándar que algunas herramientas agregan además, y tienen
        // prioridad cuando están (más explícitos), pero muchos archivos
        // reales de fabricante solo declaran la potencia en texto libre
        // (ej. `[_ELECTRICALS] 120VAC, 1.70A, 163W`) y nunca como keyword.
        $watts = (float) ($keywords['WATTS'] ?? $keywords['WATTAGE'] ?? $inputWatts ?? 0);
        $efficiencyLmW = ($watts > 0) ? round($totalLumens / $watts, 1) : 0.0;

        $photometricSummary = [
            'format_version' => $formatVersion,
            'total_lumens' => round($totalLumens, 1),
            'max_candela' => round($maxCandela, 1),
            'beam_angle_50' => round($beam50, 1),
            'beam_angle_10' => round($beam10, 1),
            'efficiency_lm_w' => $efficiencyLmW,
            'distribution_type' => $this->classifyDistribution($beam50),
            'num_v_angles' => $numV,
            'num_h_angles' => $numH,
            'photometric_type' => (int) $photometricType,
        ];

        // Almacenar la web fotométrica completa si es pequeña (< 500 KB).
        // `provenance: 'manufacturer'` — viene de un archivo IES real, nunca
        // debe confundirse en el informe con una curva manual/sintética.
        $webData = [
            'c_angles' => $hAngles,
            'gamma_angles' => $vAngles,
            'candela' => $candela,
            'provenance' => 'manufacturer',
            'tilt' => $tiltTable,
            // Flujo contra el que la tabla de candelas está normalizada —
            // sin esto, `candela()` (photometricInterpolation.ts) no puede
            // reescalar la curva si el flujo del producto se edita después
            // del import (mismo campo que `parseLdt()` ya escribe abajo).
            'reference_lumens' => round($totalLumens, 1),
        ];
        $webJson = json_encode($webData);
        $photometricWeb = (strlen($webJson) < 512_000) ? $webData : null;

        return array_merge($this->keywordsToProductData($keywords, $formatVersion), [
            'total_lumens' => round($totalLumens, 1),
            'power_watts' => $watts ?: null,
            'cri_ra' => isset($keywords['CRI']) ? (float) $keywords['CRI'] : null,
            'beam_angle_50' => round($beam50, 1),
            'beam_angle_10' => round($beam10, 1),
            'max_candela' => round($maxCandela, 1),
            'luminous_opening' => ['width' => $lumWidth, 'length' => $lumLength, 'height' => $lumHeight],
            'photometric_summary' => $photometricSummary,
            'photometric_web' => $photometricWeb,
        ]);
    }

    /**
     * @param  string[]  $warnings
     * @return array<string, mixed>
     */
    private function parseLdt(string $content, array &$warnings): array
    {
        // Algunos archivos LDT reales (ej. exportados por herramientas que
        // guardan UTF-8 "con BOM") empiezan con el marcador de orden de
        // bytes EF BB BF — `trim()` no lo quita (no es un carácter de espacio
        // para PHP), así que sin esto quedaba pegado al inicio de
        // `company_name` (ej. "\u{FEFF}EMOS" en vez de "EMOS").
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            $content = substr($content, 3);
        }

        // Normalizar separadores decimales europeos
        $content = str_replace(',', '.', $content);
        $lines = explode("\n", str_replace("\r", '', $content));

        if (count($lines) < 28) {
            $warnings[] = 'LDT: archivo demasiado corto para ser EULUMDAT válido';
        }

        $get = fn (int $i) => trim($lines[$i] ?? '');

        $companyName = $get(0);
        // Ityp (línea 2 / índice 1) — 1=punto rotacionalmente simétrico,
        // 2=lineal, 3=no puntual no rotacionalmente simétrico. Es la "forma"
        // de la luminaria (no confundir con `$symmetry`/Isym, la simetría
        // angular de la web fotométrica).
        $luminaireType = (int) $get(1);
        $symmetry = (int) $get(2);
        $numC = max(1, (int) $get(3));
        $dc = (float) $get(4);
        $numG = max(1, (int) $get(5));
        $dg = (float) $get(6);
        $luminaireName = $get(8);
        $luminaireNumber = $get(9);

        // Líneas 13-25 (índices 12-24), especificación EULUMDAT oficial
        // verificada contra DIALux (evo.support-en.dial.de) y AGI32
        // (docs.agi32.com), y contra archivos reales de EMOS/LEDVANCE/
        // Thorlux: CADA valor va en su PROPIA línea — nunca 3 valores en una
        // sola línea separados por espacio (ese formato es de IES, no de
        // EULUMDAT; `parseTriplet()` es para IES, no para esto).
        // EULUMDAT declara estas 9 dimensiones en MILÍMETROS — el motor de
        // cálculo (`luminousArea()`, `hooks/directIlluminance.ts`) espera
        // METROS (multiplica `length * width` directo para el área en m²,
        // sin ninguna conversión propia). Sin dividir entre 1000 aquí,
        // cualquier producto importado vía este parser de respaldo (sin un
        // override manual de `dimensions`, que hoy siempre gana) habría
        // guardado un área luminosa ~1 000 000 veces más grande de lo real,
        // rompiendo en silencio cualquier cálculo de UGR que dependiera de
        // ella para un import futuro sin override.
        $lumL = (float) $get(12) / 1000;
        $lumW = (float) $get(13) / 1000;
        $lumH = (float) $get(14) / 1000;
        $areaL = (float) $get(15) / 1000;
        $areaW = (float) $get(16) / 1000;
        $areaHeightC0 = (float) $get(17) / 1000;
        $areaHeightC90 = (float) $get(18) / 1000;
        $areaHeightC180 = (float) $get(19) / 1000;
        $areaHeightC270 = (float) $get(20) / 1000;
        // DFF% (fracción de flujo hacia abajo) vive en la línea 22 EULUMDAT
        // (índice 21) — la línea 15 (índice 14) que leía antes es en
        // realidad la altura de la luminaria (ya capturada arriba en
        // `$lumH`), no el DFF%.
        $downwardFlux = (float) $get(21);
        $lightOutputRatio = (float) $get(22);
        $conversionFactor = (float) $get(23);
        $tiltDeg = (float) $get(24);

        // Línea 26 (índice 25): número de SETS de lámparas declarados —
        // casi siempre 1. Este parser solo usa los datos del primer set
        // (mismo alcance que el binario Rust); para archivos con más de un
        // set sí se avanza el cursor lo suficiente para no corromper la
        // búsqueda de ángulos/candela que viene después, aunque no se sume
        // el flujo de los sets adicionales.
        $numLampSets = max(1, (int) $get(25));

        // EULUMDAT: número de lámparas del primer set vive en la línea 27
        // (1-indexada), no en la 28 (esa es el tipo de lámpara, un texto).
        // El signo importa: positivo = el flujo declarado es POR lámpara
        // (multiplicar); negativo = el flujo ya es el TOTAL del conjunto (no
        // multiplicar — el valor absoluto es solo informativo). Verificado
        // contra 8 archivos LDT reales subidos por usuarios; uno declara
        // "-2" y multiplicar ahí habría duplicado el flujo importado.
        $cursor = 26;
        $rawLampField = $get($cursor);
        if (is_numeric($rawLampField)) {
            $rawLampCount = (float) $rawLampField;
            $numLamps = $rawLampCount > 0 ? (int) $rawLampCount : 1;
            $cursor++;
            $lampType = $get($cursor++);
        } else {
            $numLamps = 1;
            $lampType = $get($cursor++);
        }

        $lumens = $this->normalizeLdtLumens((float) $get($cursor++), $numLamps);
        $cctStr = $get($cursor++);
        $criRa = (float) $get($cursor++);
        $watts = (float) $get($cursor++);
        // Sets adicionales (raro): cada uno son 6 líneas más (num_lamps,
        // tipo, lumens, cct, cri, watts) que no se leen individualmente pero
        // sí hay que saltar para que el cursor llegue al lugar correcto para
        // DR1-10 y los ángulos.
        $cursor += ($numLampSets - 1) * 6;

        $cctK = is_numeric($cctStr) ? (float) $cctStr : null;
        $criRa = $criRa > 0 ? $criRa : null;

        $tokens = $this->collectNumericTokens($lines, $cursor);
        [$cAngles, $gAngles, $remaining, $directRatios] = $this->extractLdtAnglesAndCandelaTokens($tokens, $numC, $dc, $numG, $dg);

        // Matriz de candelas [c][g] en cd/klm
        $candela = [];
        $ni = 0;
        $scale = ($lumens > 0) ? $lumens / 1000.0 : 1.0; // cd/klm → cd
        $planeCount = max(1, min($numC, intdiv(count($remaining), $numG) ?: $numC));
        if ($planeCount < $numC) {
            // `symmetry` (código EULUMDAT: 0=asimétrica, 1=rotacional,
            // 2/3=mitad, 4=cuarto) explica por qué el archivo trae MENOS
            // planos de los declarados en `numC` sin ser un archivo
            // incompleto: una luminaria simétrica solo necesita publicar el
            // cuarto/mitad de la solución angular, y el consumidor (motor de
            // cálculo, `foldAzimuthToCRange()`) refleja el resto. Con
            // symmetry=0 (asimétrica) sí sería una señal real de datos
            // faltantes — no hay reflejo posible que la justifique.
            $warnings[] = $symmetry > 0
                ? "LDT: el archivo declara {$numC} planos C pero solo trae {$planeCount} — esperable para una luminaria simétrica (symmetry={$symmetry}), el resto se completa por reflejo."
                : "LDT: se declararon {$numC} planos C pero solo se pudieron parsear {$planeCount} (symmetry=0, asimétrica — sí indica datos insuficientes en el archivo).";
        }
        $incompletePlaneWarned = false;
        for ($c = 0; $c < $planeCount; $c++) {
            $plane = array_slice($remaining, $ni, $numG);
            if (count($plane) < $numG && ! $incompletePlaneWarned) {
                $warnings[] = "LDT: el plano C índice {$c} tiene menos de {$numG} valores de gamma declarados — se completó con 0 cd, revisar el archivo.";
                $incompletePlaneWarned = true;
            }
            while (count($plane) < $numG) {
                $plane[] = 0.0;
            }
            $candela[] = array_map(fn ($v) => $v * $scale, $plane);
            $ni += $numG;
        }

        // `$cAngles` venía de la grilla angular COMPLETA que el archivo
        // declara (`numC` planos), pero `$candela` solo tiene `$planeCount`
        // filas reales (ver warning arriba) — sin truncar aquí, `c_angles`
        // y `candela` quedaban con longitudes distintas en `photometric_web`,
        // y el consumidor (`candelaFromPhotometricWeb()`, que asume
        // `c_angles[i]` ↔ `candela[i]` 1 a 1) leía `candela[i]` indefinido
        // para cualquier plano más allá de `$planeCount` — silenciosamente
        // mal interpolado (fallback a `candela[0]`), no un error visible.
        $cAngles = array_slice($cAngles, 0, $planeCount);

        $this->checkAngleMonotonic($cAngles, 'C (LDT)', $warnings);
        $this->checkAngleMonotonic($gAngles, 'gamma (LDT)', $warnings);
        $this->checkFluxConsistency($lumens, $candela, $gAngles, $cAngles, 'LDT', $warnings);

        $maxCandela = max(0.0, ...array_merge(...$candela));
        [$beam50, $beam10] = $this->computeBeamAngles($candela[0] ?? [], $gAngles, $maxCandela);
        $effLmW = ($watts > 0) ? round($lumens / $watts, 1) : 0.0;

        // Inferir nombre del producto
        $name = $luminaireName ?: pathinfo($luminaireNumber ?: 'Producto', PATHINFO_FILENAME);

        $photometricSummary = [
            'format_version' => 'EULUMDAT',
            'total_lumens' => round($lumens, 1),
            'max_candela' => round($maxCandela, 1),
            'beam_angle_50' => round($beam50, 1),
            'beam_angle_10' => round($beam10, 1),
            'efficiency_lm_w' => $effLmW,
            'distribution_type' => $this->classifyDistribution($beam50),
            'num_c_planes' => $numC,
            'parsed_c_planes' => $planeCount,
            'num_gamma_angles' => $numG,
            'symmetry' => $symmetry,
        ];

        // `provenance: 'manufacturer'` — viene de un archivo LDT/EULUMDAT real.
        // `symmetry` (código EULUMDAT 0-4) se conserva tal cual el archivo lo
        // declara; NO se expande la matriz a los cuadrantes simétricos aquí
        // (fuera de alcance de esta fase) — el consumidor debe interpretar
        // el código de simetría si necesita cobertura completa de azimut.
        $webData = [
            'c_angles' => $cAngles,
            'gamma_angles' => $gAngles,
            'candela' => $candela,
            'reference_lumens' => $lumens,
            'provenance' => 'manufacturer',
            'symmetry' => $symmetry,
        ];
        $webJson = json_encode($webData);

        return [
            'name' => $name,
            'manufacturer' => $companyName,
            'catalog_number' => $luminaireNumber,
            'total_lumens' => round($lumens, 1),
            'power_watts' => $watts ?: null,
            'cct' => $cctK ? "{$cctK}K" : null,
            'cri_ra' => $criRa,
            'beam_angle_50' => round($beam50, 1),
            'beam_angle_10' => round($beam10, 1),
            'max_candela' => round($maxCandela, 1),
            'dimensions' => ['length' => $lumL, 'width' => $lumW, 'height' => $lumH],
            'luminous_opening' => [
                'length' => $areaL,
                'width' => $areaW,
                'height_c0' => $areaHeightC0,
                'height_c90' => $areaHeightC90,
                'height_c180' => $areaHeightC180,
                'height_c270' => $areaHeightC270,
            ],
            'photometric_summary' => $photometricSummary,
            'photometric_web' => (strlen($webJson) < 512_000) ? $webData : null,
            'metadata' => [
                'num_lamps' => $numLamps,
                'lamp_type' => $lampType,
                'luminaire_type' => $luminaireType,
                'downward_flux_fraction_pct' => $downwardFlux,
                'light_output_ratio_pct' => $lightOutputRatio,
                'conversion_factor' => $conversionFactor,
                'tilt_deg' => $tiltDeg,
                'direct_ratios' => $directRatios,
            ],
        ];
    }

    /**
     * @param  string[]  $warnings
     * @return array<string, mixed>
     */
    private function parseGldf(string $content, array &$warnings): array
    {
        // Detectar si el contenido es un ZIP (bytes mágicos PK)
        if (str_starts_with($content, "\x50\x4B")) {
            $warnings[] = 'GLDF: archivo ZIP recibido. Extrayendo product.xml...';
            $xml = $this->extractGldfXml($content);

            if ($xml === null) {
                $warnings[] = 'GLDF: no se pudo extraer product.xml del ZIP';

                return ['name' => 'Producto GLDF', 'source_format' => 'gldf'];
            }
            $content = $xml;
        }

        // Parsear XML del product.xml
        return $this->parseGldfXml($content, $warnings);
    }

    private function extractGldfXml(string $zipContent): ?string
    {
        $tempZip = tempnam(sys_get_temp_dir(), 'gldf_').'.gldf';
        file_put_contents($tempZip, $zipContent);

        $zip = new \ZipArchive;
        if ($zip->open($tempZip) !== true) {
            @unlink($tempZip);

            return null;
        }

        $xml = $zip->getFromName('product.xml')
            ?? $zip->getFromName('Product.xml')
            ?? null;

        $zip->close();
        @unlink($tempZip);

        return $xml;
    }

    /**
     * @param  string[]  $warnings
     * @return array<string, mixed>
     */
    private function parseGldfXml(string $xml, array &$warnings): array
    {
        if (! str_contains($xml, 'GeneralDefinitions') && ! str_contains($xml, 'Product')) {
            $warnings[] = 'GLDF: XML no parece ser un product.xml válido';
        }

        $name = $this->xmlFirstText($xml, 'Name') ?? 'Producto GLDF';
        $manufacturer = $this->xmlAttribute($xml, 'Manufacturer', 'name')
            ?? $this->xmlFirstText($xml, 'Manufacturer')
            ?? '';
        $articleNumber = $this->xmlFirstText($xml, 'ArticleNumber') ?? '';
        $description = $this->xmlFirstText($xml, 'Description') ?? '';

        $totalLumens = (float) ($this->xmlFirstText($xml, 'Flux')
            ?? $this->xmlFirstText($xml, 'TotalFlux')
            ?? '0');
        $watts = (float) ($this->xmlFirstText($xml, 'Wattage')
            ?? $this->xmlFirstText($xml, 'Power')
            ?? '0');
        $cctStr = $this->xmlFirstText($xml, 'ColorTemperature')
            ?? $this->xmlFirstText($xml, 'CCT');
        $criRa = (float) ($this->xmlFirstText($xml, 'CRI')
            ?? $this->xmlFirstText($xml, 'Ra')
            ?? '0');

        $effLmW = ($watts > 0) ? round($totalLumens / $watts, 1) : 0.0;

        // GLDF típicamente referencia un archivo LDT/IES o LES embebido para
        // la matriz fotométrica real; extraerlo es una brecha conocida y
        // más grande que el resto de esta fase (fuera de alcance aquí — ver
        // planes/fase3_progreso_dialux.md). Advertirlo explícitamente evita
        // que el cálculo use el fallback Lambertiano en silencio sin que
        // quede registro de por qué falta la matriz.
        $warnings[] = 'GLDF: no se extrae la matriz fotométrica de este formato todavía; el cálculo usará el modelo Lambertiano aproximado hasta que se importe esta luminaria en IES/LDT o se implemente el parseo GLDF.';

        return [
            'name' => $name,
            'manufacturer' => $manufacturer,
            'article_number' => $articleNumber,
            'description' => $description,
            'total_lumens' => $totalLumens > 0 ? $totalLumens : null,
            'power_watts' => $watts > 0 ? $watts : null,
            'cct' => $cctStr,
            'cri_ra' => $criRa > 0 ? $criRa : null,
            'photometric_summary' => [
                'format_version' => 'GLDF',
                'total_lumens' => $totalLumens,
                'efficiency_lm_w' => $effLmW,
            ],
        ];
    }

    // ─── Helpers matemáticos ──────────────────────────────────────────────────

    /**
     * Verifica que una lista de ángulos sea monotónicamente creciente (no
     * decreciente). Un archivo IES/LDT con ángulos fuera de orden casi
     * siempre indica un desalineamiento de parseo (offset equivocado) más
     * que una fotometría real así declarada — LM-63/EULUMDAT exigen orden
     * creciente. Solo se reporta el primer punto fuera de orden: no
     * floodear `warnings` con N-1 mensajes por un mismo desalineamiento.
     *
     * @param  float[]  $angles
     * @param  string[]  $warnings
     */
    private function checkAngleMonotonic(array $angles, string $label, array &$warnings): void
    {
        for ($i = 1; $i < count($angles); $i++) {
            if ($angles[$i] < $angles[$i - 1] - 1e-6) {
                $warnings[] = sprintf(
                    'Fotometría: los ángulos %s no son monotónicamente crecientes (posición %d: %.2f < %.2f) — la matriz podría estar mal parseada.',
                    $label,
                    $i,
                    $angles[$i],
                    $angles[$i - 1],
                );

                return;
            }
        }
    }

    /** @param  array<mixed>  $candela */
    private function candelaPointCount(array $candela): int
    {
        $count = 0;
        foreach ($candela as $plane) {
            $count += is_array($plane) ? count($plane) : 0;
        }

        return $count;
    }

    /**
     * Verifica que la matriz de candela tenga la forma declarada
     * (planos × valores-por-plano). Una matriz recortada o inflada respecto
     * a lo declarado por el archivo es indistinguible de datos corruptos —
     * mejor advertir que dejar que el solver interpole silenciosamente
     * sobre huecos que en el archivo original no existían.
     *
     * @param  float[][]  $candela
     * @param  string[]  $warnings
     */
    private function checkMatrixDimensions(array $candela, int $expectedPlanes, int $expectedPerPlane, string $label, array &$warnings): void
    {
        if (count($candela) !== $expectedPlanes) {
            $warnings[] = sprintf(
                'Fotometría (%s): se esperaban %d planos de candela, se obtuvieron %d.',
                $label,
                $expectedPlanes,
                count($candela),
            );
        }

        foreach ($candela as $index => $plane) {
            if (count($plane) !== $expectedPerPlane) {
                $warnings[] = sprintf(
                    'Fotometría (%s): el plano %d tiene %d valores, se esperaban %d.',
                    $label,
                    $index,
                    count($plane),
                    $expectedPerPlane,
                );
                break;
            }
        }
    }

    /**
     * Compara el flujo luminoso declarado por el fabricante contra el flujo
     * que resulta de integrar la propia matriz de candela. Una discrepancia
     * grande (fuera de ±25%/+33%, tolerancia amplia deliberada: el muestreo
     * angular real de un archivo de fabricante es coarse y ya introduce
     * error de integración normal) señala casi siempre un error de unidades
     * o de parseo, no ruido numérico — advertir en vez de fallar en
     * silencio, igual que el resto de este parser.
     *
     * @param  float[][]  $candela
     * @param  float[]  $vAngles
     * @param  float[]  $hAngles
     * @param  string[]  $warnings
     */
    private function checkFluxConsistency(float $declaredLumens, array $candela, array $vAngles, array $hAngles, string $label, array &$warnings): void
    {
        if ($declaredLumens <= 0.0) {
            return;
        }

        $estimated = $this->estimateLumens($candela, $vAngles, $hAngles);
        if ($estimated <= 0.0) {
            return;
        }

        $ratio = $estimated / $declaredLumens;
        if ($ratio < 0.75 || $ratio > 1.33) {
            $warnings[] = sprintf(
                'Fotometría (%s): el flujo declarado (%.0f lm) difiere del flujo integrado de la curva (%.0f lm, %.0f%%) más de lo esperable — revisar el archivo.',
                $label,
                $declaredLumens,
                $estimated,
                $ratio * 100,
            );
        }
    }

    /**
     * Los fabricantes publican solo un cuarto o una mitad de la solución
     * fotométrica cuando la luminaria es simétrica (mismo criterio que
     * `foldAzimuthToCRange()` en `photometricInterpolation.ts` — MISMOS
     * umbrales, para que el parser y el motor de cálculo interpreten la
     * simetría de la misma forma). Sin este factor, `estimateLumens()`
     * integraba solo el cuarto/mitad de esfera realmente presente en el
     * archivo y lo reportaba como si fuera el total — infravalorando el
     * flujo real hasta ~4x y disparando falsos positivos de "flujo
     * inconsistente" para CUALQUIER luminaria simétrica de múltiples planos
     * C (paneles cuadrados, luminarias lineales — un caso extremadamente
     * común, a diferencia de las dos luminarias de un solo plano ya
     * validadas en este catálogo). Confirmado con dos archivos reales de
     * fabricante (LEDVANCE, Zumtobel): sin este factor, ambos reportaban
     * ~27% del flujo declarado; con él, ~108%, dentro de tolerancia normal.
     */
    private function azimuthCoverageMultiplier(array $hAngles): float
    {
        if (count($hAngles) <= 1) {
            return 1.0; // ya se asume barrido completo de 360° más abajo (`dPhi = 360.0`).
        }
        $maxH = max($hAngles);
        if ($maxH <= 90.01) {
            return 4.0;
        }
        if ($maxH <= 180.01) {
            return 2.0;
        }

        return 1.0;
    }

    /** Estima lúmenes totales integrando la esfera de candelas. */
    private function estimateLumens(array $candela, array $vAngles, array $hAngles): float
    {
        $total = 0.0;
        $numH = count($hAngles);
        $numV = count($vAngles);

        for ($hi = 0; $hi < $numH; $hi++) {
            $dPhi = ($numH > 1)
                ? abs((($hAngles[$hi + 1] ?? $hAngles[$hi]) - ($hAngles[$hi - 1] ?? $hAngles[$hi])) / 2.0)
                : 360.0;

            for ($vi = 0; $vi < $numV; $vi++) {
                $theta = deg2rad($vAngles[$vi]);
                $dTheta = ($numV > 1)
                    ? abs((($vAngles[$vi + 1] ?? $vAngles[$vi]) - ($vAngles[$vi - 1] ?? $vAngles[$vi])) / 2.0)
                    : 90.0;
                $solidAngle = sin($theta) * deg2rad($dTheta) * deg2rad($dPhi);
                $total += ($candela[$hi][$vi] ?? 0.0) * $solidAngle;
            }
        }

        return max(0.0, $total) * $this->azimuthCoverageMultiplier($hAngles);
    }

    /** Calcula ángulos de haz al 50% y 10% del Imax en el plano C0. */
    private function computeBeamAngles(array $c0Plane, array $vAngles, float $maxCandela): array
    {
        if ($maxCandela <= 0.0) {
            return [0.0, 0.0];
        }
        $beam50 = 0.0;
        $beam10 = 0.0;

        foreach ($vAngles as $i => $angle) {
            $ratio = ($c0Plane[$i] ?? 0.0) / $maxCandela;
            if ($ratio >= 0.5) {
                $beam50 = max($beam50, $angle);
            }
            if ($ratio >= 0.1) {
                $beam10 = max($beam10, $angle);
            }
        }

        return [$beam50, $beam10];
    }

    private function classifyDistribution(float $beam50): string
    {
        return match (true) {
            $beam50 <= 20 => 'very-narrow',
            $beam50 <= 40 => 'narrow',
            $beam50 <= 70 => 'medium',
            $beam50 <= 100 => 'wide',
            default => 'very-wide',
        };
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  string[]  $warnings
     * @return array<string, mixed>
     */
    private function withReportPayload(array $data, array $warnings): array
    {
        $summary = is_array($data['photometric_summary'] ?? null)
            ? $data['photometric_summary']
            : [];
        $web = is_array($data['photometric_web'] ?? null)
            ? $data['photometric_web']
            : [];

        $referenceLumens = (float) ($web['reference_lumens'] ?? 0);
        $currentLumens = (float) ($data['total_lumens'] ?? 0);
        $candelaScale = $referenceLumens > 0 && $currentLumens > 0
            ? $currentLumens / $referenceLumens
            : 1.0;
        $webForReport = $this->scalePhotometricWeb($web, $candelaScale);
        $reportedMaxCandela = $this->maxCandelaFromWeb($webForReport)
            ?? ($data['max_candela'] ?? null);

        $technicalRows = [
            ['label' => 'Fabricante', 'value' => $data['manufacturer'] ?? 'Importado'],
            ['label' => 'Producto', 'value' => $data['name'] ?? 'Producto'],
            ['label' => 'Codigo', 'value' => $data['catalog_number'] ?? $data['article_number'] ?? '-'],
            ['label' => 'P', 'value' => $this->formatReportValue($data['power_watts'] ?? null, ' W', 1)],
            ['label' => 'Flujo luminoso', 'value' => $this->formatReportValue($data['total_lumens'] ?? null, ' lm', 0)],
            ['label' => 'Rendimiento', 'value' => $this->formatReportValue($summary['efficiency_lm_w'] ?? $this->computeEfficiency($data), ' lm/W', 1)],
            ['label' => 'CCT', 'value' => $data['cct'] ?? '-'],
            ['label' => 'CRI', 'value' => $this->formatReportValue($data['cri_ra'] ?? null, '', 0)],
            ['label' => 'Imax', 'value' => $this->formatReportValue($reportedMaxCandela, ' cd', 0)],
            ['label' => 'Haz 50%', 'value' => $this->formatReportValue($data['beam_angle_50'] ?? null, '°', 1)],
            // Al final para no correr los índices de las filas de arriba —
            // Fase 3 del plan maestro: la puerta de salida exige que ninguna
            // fotometría sintética/manual se reporte como si fuera del
            // fabricante. Esta fila lo hace explícito en el propio informe
            // técnico, no solo en un warning que puede pasar desapercibido.
            ['label' => 'Origen fotometría', 'value' => $this->describePhotometricProvenance($web)],
        ];

        $polarSvg = is_string($data['report_assets']['polar_svg'] ?? null)
            ? $data['report_assets']['polar_svg']
            : $this->buildPolarSvg($webForReport, $data['name'] ?? 'Producto');

        $data['report_data'] = array_replace_recursive([
            'version' => '1.0',
            'technical_table' => $technicalRows,
            'warnings' => array_values(array_unique($warnings)),
            'polar' => [
                'source' => 'photometric_web',
                'c_plane' => 0,
            ],
        ], is_array($data['report_data'] ?? null) ? $data['report_data'] : []);

        $data['report_assets'] = array_replace_recursive([
            'polar_svg' => $polarSvg,
        ], is_array($data['report_assets'] ?? null) ? $data['report_assets'] : []);

        if ($polarSvg && is_array($data['photometric_web'] ?? null)) {
            $data['photometric_web']['polar_diagram'] = $data['photometric_web']['polar_diagram'] ?? null;
        }

        return $data;
    }

    /** @param array<string, mixed> $web */
    private function scalePhotometricWeb(array $web, float $scale): array
    {
        if (abs($scale - 1.0) < 0.000001 || ! is_array($web['candela'] ?? null)) {
            return $web;
        }

        $web['candela'] = array_map(
            fn (mixed $plane): mixed => is_array($plane)
                ? array_map(fn (mixed $value): float => (float) $value * $scale, $plane)
                : $plane,
            $web['candela'],
        );

        return $web;
    }

    /** @param array<string, mixed> $web */
    private function maxCandelaFromWeb(array $web): ?float
    {
        $values = [];
        foreach ($web['candela'] ?? [] as $plane) {
            if (is_array($plane)) {
                array_push($values, ...array_map('floatval', $plane));
            }
        }

        return $values === [] ? null : max($values);
    }

    /**
     * Traduce `photometric_web.provenance` a un texto explícito para el
     * informe técnico. Nunca debe poder confundirse una aproximación con un
     * dato de fabricante con solo mirar la ficha del producto.
     *
     * @param  array<string, mixed>  $web
     */
    private function describePhotometricProvenance(array $web): string
    {
        return match ($web['provenance'] ?? null) {
            'manufacturer' => 'Archivo de fabricante (IES/LDT)',
            'manual-curve' => 'Curva ingresada manualmente (no es dato de fabricante)',
            'synthetic' => 'Modelo sintético aproximado (no es dato de fabricante)',
            default => $web === [] ? 'Sin matriz fotométrica (aprox. Lambertiana en el cálculo)' : 'Sin clasificar',
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function computeEfficiency(array $data): ?float
    {
        $lumens = (float) ($data['total_lumens'] ?? 0);
        $watts = (float) ($data['power_watts'] ?? 0);

        return $watts > 0.0 ? round($lumens / $watts, 1) : null;
    }

    private function formatReportValue(mixed $value, string $suffix, int $decimals): string
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return '-';
        }

        return number_format((float) $value, $decimals, '.', '').$suffix;
    }

    private function normalizeLdtLumens(float $rawLumens, int $numLamps): float
    {
        if ($rawLumens <= 0.0) {
            return 0.0;
        }

        // EULUMDAT declara este campo en lumen, también cuando el flujo es
        // menor de 100 lm (común en señales y luminarias de emergencia).
        // Interpretarlo como klm convertía, por ejemplo, 20 lm en 20 000 lm.
        return $rawLumens * max(1, $numLamps);
    }

    /**
     * @param  string[]  $lines
     * @return float[]
     */
    private function collectNumericTokens(array $lines, int $cursor): array
    {
        $tokens = [];
        for ($i = $cursor; $i < count($lines); $i++) {
            foreach (preg_split('/\s+/', trim($lines[$i])) as $token) {
                if (is_numeric($token)) {
                    $tokens[] = (float) $token;
                }
            }
        }

        return $tokens;
    }

    /**
     * @param  float[]  $tokens
     * @return array{0: float[], 1: float[], 2: float[]}
     */
    private function extractLdtAnglesAndCandelaTokens(array $tokens, int $numC, float $dc, int $numG, float $dg): array
    {
        $cAngles = $dc > 0.0 ? array_map(fn ($i) => $i * $dc, range(0, $numC - 1)) : [];
        $gAngles = $dg > 0.0 ? array_map(fn ($i) => $i * $dg, range(0, $numG - 1)) : [];

        // Entre la cabecera de lámpara y los ángulos EULUMDAT existen diez
        // factores de reducción (DR1-DR10). Hay que localizar ambas listas
        // aunque dC sea cero (caso habitual de una luminaria rotacional con
        // un solo plano C). Antes se tomaba el primer factor como ángulo C y
        // toda la matriz de intensidades quedaba desplazada. Todo lo que
        // quede ANTES del offset encontrado son los DR1-10 (o menos, si el
        // archivo los omite) — se devuelven en vez de descartarse en silencio.
        $limit = max(0, min(32, count($tokens) - $numC - $numG));
        for ($offset = 0; $offset <= $limit; $offset++) {
            $candidateC = array_slice($tokens, $offset, $numC);
            $candidateG = array_slice($tokens, $offset + $numC, $numG);
            if ($this->isExpectedAngleList($candidateC, $numC, $dc) && $this->isExpectedAngleList($candidateG, $numG, $dg)) {
                return [$candidateC, $candidateG, array_slice($tokens, $offset + $numC + $numG), array_slice($tokens, 0, $offset)];
            }
        }

        return [$cAngles, $gAngles, $tokens, []];
    }

    /**
     * @param  float[]  $values
     */
    private function isExpectedAngleList(array $values, int $count, float $step): bool
    {
        if (count($values) !== $count || ($step <= 0.0 && $count > 1)) {
            return false;
        }

        foreach ($values as $index => $value) {
            if (abs($value - ($index * max(0.0, $step))) > 0.01) {
                return false;
            }
        }

        return true;
    }

    /**
     * Encuentra, entre los planos C realmente almacenados, el más cercano a
     * `$targetDeg` o a su opuesto (`$targetDeg + 180`) — un solo plano
     * mirado y reflejado ya dibuja el corte completo "C/C+180" (misma
     * convención que DIALux: un archivo con simetría rotacional (Isym=1, un
     * solo plano C) produce curvas C0/C180 y C90/C270 idénticas superpuestas).
     *
     * @param  float[]  $cAngles
     * @param  int[]  $exclude
     */
    private function findClosestCPlane(array $cAngles, float $targetDeg, array $exclude, float $maxDeltaDeg = INF): ?int
    {
        $bestIndex = null;
        $bestDelta = INF;
        foreach ($cAngles as $index => $c) {
            if (in_array($index, $exclude, true)) {
                continue;
            }
            $normalized = fmod(fmod($c, 360.0) + 360.0, 360.0);
            $deltaToTarget = min(abs($normalized - $targetDeg), 360.0 - abs($normalized - $targetDeg));
            $opposite = fmod($targetDeg + 180.0, 360.0);
            $deltaToOpposite = min(abs($normalized - $opposite), 360.0 - abs($normalized - $opposite));
            $delta = min($deltaToTarget, $deltaToOpposite);
            if ($delta < $bestDelta) {
                $bestDelta = $delta;
                $bestIndex = $index;
            }
        }

        // Sin tolerancia, un archivo con solo C0/C180 (sin C90) elegiría el
        // plano C180 "de sobra" como si fuera C90/C270 — mal etiquetado,
        // porque en realidad pertenece al mismo eje que el plano primario.
        // Se exige que el candidato esté razonablemente cerca de 90°/270°
        // antes de aceptarlo.
        return $bestDelta <= $maxDeltaDeg ? $bestIndex : null;
    }

    /**
     * @param  float[]  $angles
     * @param  float[]  $values
     */
    private function buildPolarCurvePath(array $angles, array $values, float $maxCandela): string
    {
        $points = [];
        foreach ($values as $index => $candelaValue) {
            $angle = deg2rad($angles[$index] ?? $index);
            $radius = 120.0 * ($candelaValue / $maxCandela);
            $x = 160.0 + sin($angle) * $radius;
            $y = 160.0 + cos($angle) * $radius;
            $points[] = round($x, 2).','.round($y, 2);
        }

        $mirrored = [];
        for ($index = count($values) - 1; $index >= 0; $index--) {
            $angle = deg2rad(-($angles[$index] ?? $index));
            $radius = 120.0 * ($values[$index] / $maxCandela);
            $x = 160.0 + sin($angle) * $radius;
            $y = 160.0 + cos($angle) * $radius;
            $mirrored[] = round($x, 2).','.round($y, 2);
        }

        return 'M '.implode(' L ', array_merge($points, $mirrored));
    }

    /**
     * @param  array<string, mixed>  $web
     */
    private function buildPolarSvg(array $web, string $title): ?string
    {
        $gammaAngles = $web['gamma_angles'] ?? null;
        $candela = $web['candela'] ?? null;
        $cAngles = array_map('floatval', is_array($web['c_angles'] ?? null) ? $web['c_angles'] : []);
        $primaryIndex = $this->findClosestCPlane($cAngles, 0.0, []) ?? 0;

        if (! is_array($gammaAngles) || ! is_array($candela) || empty($candela[$primaryIndex]) || ! is_array($candela[$primaryIndex])) {
            return null;
        }

        $angles = array_map('floatval', $gammaAngles);
        $plane = array_map('floatval', $candela[$primaryIndex]);

        $secondaryIndex = $this->findClosestCPlane($cAngles, 90.0, [$primaryIndex], 30.0);
        $secondaryPlane = $secondaryIndex !== null && is_array($candela[$secondaryIndex] ?? null)
            ? array_map('floatval', $candela[$secondaryIndex])
            : null;
        $hasSecondPlane = ! empty($secondaryPlane);

        $maxCandela = max(0.0, ...$plane, ...($hasSecondPlane ? $secondaryPlane : []));
        if ($maxCandela <= 0.0) {
            return null;
        }

        // C0/C180 se dibuja primero (rojo, como en el lector LDT de DIALux) y
        // C90/C270 encima (azul) — en una luminaria rotacionalmente simétrica
        // ambas curvas coinciden exactamente y solo se ve la azul, igual que
        // en DIALux, en vez de mostrar solo un plano y descartar el resto en
        // silencio. Con un solo plano disponible, la curva sigue siendo azul
        // (sin cambio de color respecto al comportamiento previo).
        $primaryCurvePath = $this->buildPolarCurvePath($angles, $plane, $maxCandela);
        $secondaryCurvePath = $hasSecondPlane ? $this->buildPolarCurvePath($angles, $secondaryPlane, $maxCandela) : null;
        $primaryColor = $secondaryCurvePath ? '#dc2626' : '#2563eb';

        $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMax = number_format($maxCandela, 0, '.', ',');
        $referenceLumens = (float) ($web['reference_lumens'] ?? 0);
        $fluxSuffix = $referenceLumens > 0
            ? ' · Φ '.number_format($referenceLumens, 0, '.', ',').' lm'
            : '';

        // Todo el dibujo son `<path>` — nunca `<circle>`/`<line>`/`<polyline>`.
        // dompdf (motor que rasteriza este SVG a PDF) solo tiene probado
        // soporte de SVG para paths/curvas/arcos (el resto de diagramas de
        // este export, que sí funcionan, solo usan `<path>`/`<rect>`);
        // `<circle>` y `<line>` nunca se habían usado en ningún otro SVG de
        // la app — con ellos, TODO el dibujo (incluida la curva) salía
        // invisible en el PDF aunque el SVG se viera perfecto en un
        // navegador, y aunque cada figura ya declarara su propio stroke/fill
        // (fix previo de herencia de estilo por `<g>`, insuficiente por sí
        // solo) — verificado contra un export real y contra el SVG
        // persistido en la base de datos.
        $circlePath = static function (int $r): string {
            return 'M '.(160 + $r)." 160 A {$r} {$r} 0 1 0 ".(160 - $r)." 160 A {$r} {$r} 0 1 0 ".(160 + $r).' 160';
        };
        $circle40 = $circlePath(40);
        $circle80 = $circlePath(80);
        $circle120 = $circlePath(120);
        $gridAttrs = 'stroke="#d7dde6" stroke-width="0.7" fill="none"';

        $ringLabels = '';
        foreach ([40, 80, 120] as $r) {
            $value = number_format(round($maxCandela * ($r / 120)), 0, '.', ',');
            $y = 160 + $r + 3;
            $ringLabels .= "<text x=\"156\" y=\"{$y}\" font-family=\"Arial, sans-serif\" font-size=\"7\" fill=\"#94a3b8\" text-anchor=\"end\">{$value}</text>\n        ";
        }

        $angleLabels = '';
        foreach ([0, 30, 60, 90] as $deg) {
            $rad = deg2rad($deg);
            $labelRadius = 131;
            $x = round(160 + sin($rad) * $labelRadius, 2);
            $y = round(160 + cos($rad) * $labelRadius, 2);
            if ($deg === 0) {
                $yText = $y + 5;
                $angleLabels .= "<text x=\"{$x}\" y=\"{$yText}\" font-family=\"Arial, sans-serif\" font-size=\"7\" fill=\"#94a3b8\" text-anchor=\"middle\">0°</text>\n        ";

                continue;
            }
            $mirroredX = round(160 - sin($rad) * $labelRadius, 2);
            $yText = $y + 2;
            $angleLabels .= "<text x=\"{$x}\" y=\"{$yText}\" font-family=\"Arial, sans-serif\" font-size=\"7\" fill=\"#94a3b8\" text-anchor=\"middle\">{$deg}°</text>\n        ";
            $angleLabels .= "<text x=\"{$mirroredX}\" y=\"{$yText}\" font-family=\"Arial, sans-serif\" font-size=\"7\" fill=\"#94a3b8\" text-anchor=\"middle\">{$deg}°</text>\n        ";
        }

        $legend = $secondaryCurvePath !== null
            ? '<path d="M 220 12 L 232 12" stroke="#dc2626" stroke-width="2"/>'
                .'<text x="235" y="14" font-family="Arial, sans-serif" font-size="7" fill="#64748b">C0/C180</text>'
                .'<path d="M 275 12 L 287 12" stroke="#2563eb" stroke-width="2"/>'
                .'<text x="290" y="14" font-family="Arial, sans-serif" font-size="7" fill="#64748b">C90/C270</text>'
            : '';
        $secondaryPathEl = $secondaryCurvePath !== null
            ? "<path d=\"{$secondaryCurvePath}\" stroke=\"#2563eb\" stroke-width=\"2.2\" fill=\"none\"/>"
            : '';

        return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 320 260">
    <rect width="320" height="260" fill="#ffffff"/>
    {$legend}
    <g transform="translate(0 -30)">
        <path d="{$circle40}" {$gridAttrs}/>
        <path d="{$circle80}" {$gridAttrs}/>
        <path d="{$circle120}" {$gridAttrs}/>
        <path d="M 40 160 L 280 160" {$gridAttrs}/>
        <path d="M 160 40 L 160 280" {$gridAttrs}/>
        <path d="M 75 75 L 245 245" {$gridAttrs}/>
        <path d="M 245 75 L 75 245" {$gridAttrs}/>
        <path d="{$primaryCurvePath}" stroke="{$primaryColor}" stroke-width="2.2" fill="none"/>
        {$secondaryPathEl}
        {$ringLabels}
        {$angleLabels}
    </g>
    <text x="18" y="22" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">CDL polar</text>
    <text x="18" y="38" font-family="Arial, sans-serif" font-size="8" fill="#64748b">{$safeTitle}</text>
    <text x="18" y="246" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Imax {$safeMax} cd{$fluxSuffix}</text>
</svg>
SVG;
    }

    /**
     * @return array{0: float, 1: float, 2: float}
     */
    private function parseTriplet(string $line): array
    {
        $parts = array_values(array_filter(
            array_map('floatval', preg_split('/\s+/', trim($line))),
        ));

        return [$parts[0] ?? 0.0, $parts[1] ?? 0.0, $parts[2] ?? 0.0];
    }

    /**
     * @param  string[]  $lines
     * @return float[]
     */
    private function parseAngleList(array $lines, int &$cursor, int $count): array
    {
        $result = [];
        while (count($result) < $count && $cursor < count($lines)) {
            foreach (preg_split('/\s+/', trim($lines[$cursor])) as $token) {
                if (is_numeric($token)) {
                    $result[] = (float) $token;
                }
                if (count($result) >= $count) {
                    break;
                }
            }
            $cursor++;
        }

        return $result;
    }

    /** @return array<string, mixed> */
    private function keywordsToProductData(array $keywords, string $formatVersion): array
    {
        $cct = $keywords['CCT'] ?? null;

        return [
            'name' => $keywords['LUMINAIRE'] ?? $keywords['LUMCAT'] ?? 'Producto IES',
            'manufacturer' => $keywords['MANUFAC'] ?? null,
            'catalog_number' => $keywords['LUMCAT'] ?? null,
            'cct' => $cct,
            'metadata' => array_merge(['format_version' => $formatVersion], $keywords),
        ];
    }

    // ─── Helpers XML simples ──────────────────────────────────────────────────

    private function xmlFirstText(string $xml, string $tag): ?string
    {
        $pattern = "/<{$tag}[^>]*>([^<]*)<\\/{$tag}>/i";
        if (preg_match($pattern, $xml, $m)) {
            $text = trim($m[1]);

            return $text !== '' ? $text : null;
        }

        return null;
    }

    private function xmlAttribute(string $xml, string $tag, string $attr): ?string
    {
        $pattern = "/<{$tag}[^>]*{$attr}=['\"]([^'\"]+)['\"]/i";
        if (preg_match($pattern, $xml, $m)) {
            return $m[1] !== '' ? $m[1] : null;
        }

        return null;
    }
}
