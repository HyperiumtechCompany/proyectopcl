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
     * Importa un archivo fotométrico y persiste el producto.
     *
     * @return array{product: LuminaireProduct, warnings: string[]}
     */
    public function import(
        UploadedFile $file,
        ?int $userId,
        array $overrides = [],
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

        // Aplicar overrides del usuario
        $data = array_merge($parsed, array_filter($overrides, fn ($v) => $v !== null));

        // Asegurar campos obligatorios
        $data['source_format'] = $sourceFormat;
        $data['source_file_path'] = $storagePath;
        $data['source_file_name'] = $originalName;
        $data['user_id'] = $userId;
        $data['name'] = $data['name'] ?? pathinfo($originalName, PATHINFO_FILENAME);
        $data = $this->withReportPayload($data, $warnings);

        // Crear producto
        $product = LuminaireProduct::query()->create($data);

        return ['product' => $product, 'warnings' => $warnings];
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
        if (! in_array($extension, ['ies', 'ldt', 'gldf'], true)) {
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
                'photometric_web' => $payload['photometric_web'] ?? null,
                'dimensions' => $payload['dimensions'] ?? null,
                'luminous_opening' => $payload['luminous_opening'] ?? null,
                'metadata' => $payload['metadata'] ?? null,
                'report_data' => $payload['report_data'] ?? null,
                'report_assets' => $payload['report_assets'] ?? null,
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

        // Saltar TILT
        $tiltLine = $lines[$idx] ?? 'TILT=NONE';
        $tiltType = strtoupper(trim(explode('=', $tiltLine)[1] ?? 'NONE'));
        $idx++;

        if ($tiltType === 'INCLUDE') {
            // Saltar 3 líneas: lamp-to-lum geometry, N, angles+multipliers
            $nPairs = (int) trim($lines[$idx] ?? '0');
            $idx += 1 + $nPairs;
        }

        // Recolectar todos los números restantes
        $numbers = [];
        for ($i = $idx; $i < count($lines); $i++) {
            foreach (preg_split('/[\s,]+/', trim($lines[$i])) as $token) {
                $token = str_replace(',', '.', $token);
                if (is_numeric($token)) {
                    $numbers[] = (float) $token;
                }
            }
        }

        if (count($numbers) < 10) {
            $warnings[] = 'IES: datos de configuración insuficientes';

            return $this->keywordsToProductData($keywords, $formatVersion);
        }

        // 10 campos de configuración
        [$numLamps, $lumensPerLamp, $multiplier, $numV, $numH,
            $photometricType, $unitsType, $lumWidth, $lumLength, $lumHeight] = $numbers;

        $numV = max(1, (int) $numV);
        $numH = max(1, (int) $numH);
        $ni = 10;

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

        // Calcular métricas derivadas
        $totalLumens = ($lumensPerLamp > 0)
            ? $lumensPerLamp * $numLamps
            : $this->estimateLumens($candela, $vAngles, $hAngles);

        $maxCandela = max(0.0, ...array_merge(...$candela));
        [$beam50, $beam10] = $this->computeBeamAngles($candela[0] ?? [], $vAngles, $maxCandela);

        $watts = (float) ($keywords['WATTS'] ?? $keywords['WATTAGE'] ?? 0);
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

        // Almacenar la web fotométrica completa si es pequeña (< 500 KB)
        $webData = ['c_angles' => $hAngles, 'gamma_angles' => $vAngles, 'candela' => $candela];
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
        // Normalizar separadores decimales europeos
        $content = str_replace(',', '.', $content);
        $lines = explode("\n", str_replace("\r", '', $content));

        if (count($lines) < 28) {
            $warnings[] = 'LDT: archivo demasiado corto para ser EULUMDAT válido';
        }

        $get = fn (int $i) => trim($lines[$i] ?? '');

        $companyName = $get(0);
        $symmetry = (int) $get(2);
        $numC = max(1, (int) $get(3));
        $dc = (float) $get(4);
        $numG = max(1, (int) $get(5));
        $dg = (float) $get(6);
        $luminaireName = $get(8);
        $luminaireNumber = $get(9);

        [$lumL, $lumW, $lumH] = $this->parseTriplet($get(12));
        $downwardFlux = (float) $get(14);

        $cursor = 27;
        if (is_numeric($get($cursor))) {
            $numLamps = max(1, (int) $get($cursor++));
            $lampType = $get($cursor++);
        } else {
            $numLamps = 1;
            $lampType = $get($cursor++);
        }

        $lumens = $this->normalizeLdtLumens((float) $get($cursor++), $numLamps);
        $cctStr = $get($cursor++);
        $criRa = (float) $get($cursor++);
        $watts = (float) $get($cursor++);

        $cctK = is_numeric($cctStr) ? (float) $cctStr : null;
        $criRa = $criRa > 0 ? $criRa : null;

        $tokens = $this->collectNumericTokens($lines, $cursor);
        [$cAngles, $gAngles, $remaining] = $this->extractLdtAnglesAndCandelaTokens($tokens, $numC, $dc, $numG, $dg);

        // Matriz de candelas [c][g] en cd/klm
        $candela = [];
        $ni = 0;
        $scale = ($lumens > 0) ? $lumens / 1000.0 : 1.0; // cd/klm → cd
        $planeCount = max(1, min($numC, intdiv(count($remaining), $numG) ?: $numC));
        for ($c = 0; $c < $planeCount; $c++) {
            $plane = array_slice($remaining, $ni, $numG);
            while (count($plane) < $numG) {
                $plane[] = 0.0;
            }
            $candela[] = array_map(fn ($v) => $v * $scale, $plane);
            $ni += $numG;
        }

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

        $webData = ['c_angles' => $cAngles, 'gamma_angles' => $gAngles, 'candela' => $candela];
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
            'photometric_summary' => $photometricSummary,
            'photometric_web' => (strlen($webJson) < 512_000) ? $webData : null,
            'metadata' => ['lamp_type' => $lampType, 'downward_flux_fraction' => $downwardFlux],
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

        return max(0.0, $total);
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

        $technicalRows = [
            ['label' => 'Fabricante', 'value' => $data['manufacturer'] ?? 'Importado'],
            ['label' => 'Producto', 'value' => $data['name'] ?? 'Producto'],
            ['label' => 'Codigo', 'value' => $data['catalog_number'] ?? $data['article_number'] ?? '-'],
            ['label' => 'P', 'value' => $this->formatReportValue($data['power_watts'] ?? null, ' W', 1)],
            ['label' => 'Flujo luminoso', 'value' => $this->formatReportValue($data['total_lumens'] ?? null, ' lm', 0)],
            ['label' => 'Rendimiento', 'value' => $this->formatReportValue($summary['efficiency_lm_w'] ?? $this->computeEfficiency($data), ' lm/W', 1)],
            ['label' => 'CCT', 'value' => $data['cct'] ?? '-'],
            ['label' => 'CRI', 'value' => $this->formatReportValue($data['cri_ra'] ?? null, '', 0)],
            ['label' => 'Imax', 'value' => $this->formatReportValue($data['max_candela'] ?? null, ' cd', 0)],
            ['label' => 'Haz 50%', 'value' => $this->formatReportValue($data['beam_angle_50'] ?? null, '°', 1)],
        ];

        $polarSvg = is_string($data['report_assets']['polar_svg'] ?? null)
            ? $data['report_assets']['polar_svg']
            : $this->buildPolarSvg($web, $data['name'] ?? 'Producto');

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

        $lumens = $rawLumens < 100.0 ? $rawLumens * 1000.0 : $rawLumens;

        return $lumens * max(1, $numLamps);
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

        if ($dc <= 0.0 && count($tokens) >= $numC) {
            $cAngles = array_slice($tokens, 0, $numC);
            $tokens = array_slice($tokens, $numC);
        }

        if ($dg <= 0.0 && count($tokens) >= $numG) {
            $gAngles = array_slice($tokens, 0, $numG);
            $tokens = array_slice($tokens, $numG);
        }

        if ($dc > 0.0 && $dg > 0.0) {
            $limit = max(0, min(32, count($tokens) - $numC - $numG));
            for ($offset = 0; $offset <= $limit; $offset++) {
                $candidateC = array_slice($tokens, $offset, $numC);
                $candidateG = array_slice($tokens, $offset + $numC, $numG);
                if ($this->isExpectedAngleList($candidateC, $numC, $dc) && $this->isExpectedAngleList($candidateG, $numG, $dg)) {
                    return [$candidateC, $candidateG, array_slice($tokens, $offset + $numC + $numG)];
                }
            }
        }

        return [$cAngles, $gAngles, $tokens];
    }

    /**
     * @param  float[]  $values
     */
    private function isExpectedAngleList(array $values, int $count, float $step): bool
    {
        if (count($values) !== $count || $step <= 0.0) {
            return false;
        }

        foreach ($values as $index => $value) {
            if (abs($value - ($index * $step)) > 0.01) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $web
     */
    private function buildPolarSvg(array $web, string $title): ?string
    {
        $gammaAngles = $web['gamma_angles'] ?? null;
        $candela = $web['candela'] ?? null;
        if (! is_array($gammaAngles) || ! is_array($candela) || empty($candela[0]) || ! is_array($candela[0])) {
            return null;
        }

        $plane = array_map('floatval', $candela[0]);
        $angles = array_map('floatval', $gammaAngles);
        $maxCandela = max(0.0, ...$plane);
        if ($maxCandela <= 0.0) {
            return null;
        }

        $points = [];
        foreach ($plane as $index => $candelaValue) {
            $angle = deg2rad($angles[$index] ?? $index);
            $radius = 120.0 * ($candelaValue / $maxCandela);
            $x = 160.0 + sin($angle) * $radius;
            $y = 160.0 + cos($angle) * $radius;
            $points[] = round($x, 2).','.round($y, 2);
        }

        $mirrored = [];
        for ($index = count($plane) - 1; $index >= 0; $index--) {
            $angle = deg2rad(-($angles[$index] ?? $index));
            $radius = 120.0 * ($plane[$index] / $maxCandela);
            $x = 160.0 + sin($angle) * $radius;
            $y = 160.0 + cos($angle) * $radius;
            $mirrored[] = round($x, 2).','.round($y, 2);
        }

        $polyline = implode(' ', array_merge($points, $mirrored));
        $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeMax = number_format($maxCandela, 0, '.', ',');

        return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 320 260">
    <rect width="320" height="260" fill="#ffffff"/>
    <g transform="translate(0 -30)" stroke="#d7dde6" stroke-width="0.7" fill="none">
        <circle cx="160" cy="160" r="40"/>
        <circle cx="160" cy="160" r="80"/>
        <circle cx="160" cy="160" r="120"/>
        <line x1="40" y1="160" x2="280" y2="160"/>
        <line x1="160" y1="40" x2="160" y2="280"/>
        <line x1="75" y1="75" x2="245" y2="245"/>
        <line x1="245" y1="75" x2="75" y2="245"/>
        <polyline points="{$polyline}" stroke="#2563eb" stroke-width="2.2"/>
    </g>
    <text x="18" y="22" font-family="Arial, sans-serif" font-size="11" fill="#0f172a" font-weight="700">CDL polar</text>
    <text x="18" y="38" font-family="Arial, sans-serif" font-size="8" fill="#64748b">{$safeTitle}</text>
    <text x="18" y="246" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Imax {$safeMax} cd</text>
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
