<?php

namespace Database\Seeders;

use Illuminate\Database\Connection;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DiccionarioSeeder extends Seeder
{
    /**
     * Compara descripciones ignorando mayúsculas/tildes/espacios repetidos —
     * "Cemento", "cemento" y "cémento" se tratan como el mismo término al
     * decidir si actualizar una fila existente o insertar una nueva. El texto
     * guardado conserva su capitalización/tildes originales; esto solo afecta
     * la comparación.
     */
    public static function normalizeKey(string $descripcion): string
    {
        $key = mb_strtolower(trim($descripcion));
        $key = strtr($key, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u']);

        return preg_replace('/\s+/', ' ', $key);
    }

    /**
     * Carga el catálogo fusionado 2026 (Diccionario + Índices INEI, con Índices
     * ganando los conflictos de código entre ambas fuentes) desde el JSON
     * pregenerado, en vez de mantener duplicado un array de ~2000 líneas aquí.
     *
     * @return array<int, array{codigo: string, descripcion: string}>
     */
    public static function loadData(): array
    {
        $path = database_path('data/diccionarioDeplhin/diccionario_fusionado_2026.json');

        return json_decode(file_get_contents($path), true);
    }

    /**
     * Aplica el catálogo fusionado 2026 sobre la conexión tenant dada.
     * Reutilizado por run() (db:seed) y por el comando
     * costos:actualizar-diccionario (backfill masivo a proyectos existentes).
     *
     * @return array{insertados: int, actualizados: int, sin_cambios: int}
     */
    public static function apply(Connection $connection, bool $dryRun = false): array
    {
        $now = now();
        $data = self::loadData();
        $existing = $connection->table('diccionario')->get(['id', 'descripcion', 'codigo']);
        $existingByKey = [];
        foreach ($existing as $row) {
            $existingByKey[self::normalizeKey($row->descripcion)] = $row;
        }

        $stats = ['insertados' => 0, 'actualizados' => 0, 'sin_cambios' => 0];

        foreach ($data as $item) {
            $key = self::normalizeKey($item['descripcion']);
            $current = $existingByKey[$key] ?? null;

            if ($current === null) {
                $stats['insertados']++;
                if (! $dryRun) {
                    $connection->table('diccionario')->insert([
                        'codigo' => $item['codigo'],
                        'descripcion' => $item['descripcion'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                continue;
            }

            if ($current->codigo === $item['codigo'] && $current->descripcion === $item['descripcion']) {
                $stats['sin_cambios']++;

                continue;
            }

            $stats['actualizados']++;
            if (! $dryRun) {
                // Actualiza el código (y la descripción, por si el 2026 trae mejor
                // capitalización/redacción) SIN tocar el id — cualquier
                // insumo_productos.diccionario_id que ya apunte aquí sigue intacto.
                $connection->table('diccionario')
                    ->where('id', $current->id)
                    ->update([
                        'codigo' => $item['codigo'],
                        'descripcion' => $item['descripcion'],
                        'updated_at' => $now,
                    ]);
            }
        }

        return $stats;
    }

    public function run(): void
    {
        self::apply(DB::connection('costos_tenant')); // ← igual que InsumoClaseSeeder
    }
}
