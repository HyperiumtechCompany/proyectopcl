<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * ETTP Partida — Registro maestro por partida de especificación técnica.
 * Vive en la BD del tenant (costos_tenant).
 * Se importa desde los resúmenes de metrados por especialidad.
 */
class EttpPartida extends Model
{
    protected $connection = 'costos_tenant';
    protected $table = 'ettp_partidas';

    protected $fillable = [
        'presupuesto_id',
        'especialidad',
        'item',
        'partida',
        'descripcion',
        'unidad',
        'resumen_source_id',
        'resumen_source_table',
        'parent_id',
        'nivel',
        'item_order',
        'estado',
        'huerfano',
    ];

    protected $casts = [
        'huerfano' => 'boolean',
        'nivel'    => 'integer',
        'item_order' => 'integer',
    ];

    // ── Relaciones ──

    /**
     * Obtiene los datos del presupuesto asociado desde la BD tenant.
     */
    public function getPresupuestoAttribute()
    {
        if (!$this->presupuesto_id) return null;
        return DB::connection('costos_tenant')
            ->table('presupuestos')
            ->where('id', $this->presupuesto_id)
            ->first();
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('item_order');
    }

    public function secciones(): HasMany
    {
        return $this->hasMany(EttpSeccion::class, 'ettp_partida_id')->orderBy('orden');
    }

    // ── Scopes ──

    public function scopeEspecialidad($query, string $especialidad)
    {
        return $query->where('especialidad', $especialidad);
    }

    public function scopeHuerfanas($query)
    {
        return $query->where('huerfano', true);
    }

    public function scopeActivas($query)
    {
        return $query->where('huerfano', false);
    }

    public function scopeRaices($query)
    {
        return $query->whereNull('parent_id');
    }

    /**
     * Compara códigos de item jerárquicos como 01, 01.02, 08.10.03.
     */
    public static function compareItemCodes(?string $left, ?string $right): int
    {
        $leftParts = self::splitItemCode($left);
        $rightParts = self::splitItemCode($right);
        $maxParts = max(count($leftParts), count($rightParts));

        for ($index = 0; $index < $maxParts; $index++) {
            $leftPart = $leftParts[$index] ?? null;
            $rightPart = $rightParts[$index] ?? null;

            if ($leftPart === $rightPart) {
                continue;
            }

            if ($leftPart === null) {
                return -1;
            }

            if ($rightPart === null) {
                return 1;
            }

            $leftIsNumeric = ctype_digit($leftPart);
            $rightIsNumeric = ctype_digit($rightPart);

            if ($leftIsNumeric && $rightIsNumeric) {
                $comparison = (int) $leftPart <=> (int) $rightPart;
                if ($comparison !== 0) {
                    return $comparison;
                }

                continue;
            }

            $comparison = strnatcasecmp($leftPart, $rightPart);
            if ($comparison !== 0) {
                return $comparison;
            }
        }

        return strnatcasecmp((string) $left, (string) $right);
    }

    /**
     * Divide un código jerárquico respetando cada nivel.
     *
     * @return array<int, string>
     */
    private static function splitItemCode(?string $item): array
    {
        $item = trim((string) $item);

        if ($item === '') {
            return [];
        }

        return array_values(array_filter(
            preg_split('/\s*\.\s*/', $item) ?: [],
            static fn ($part) => $part !== null && $part !== ''
        ));
    }
}
