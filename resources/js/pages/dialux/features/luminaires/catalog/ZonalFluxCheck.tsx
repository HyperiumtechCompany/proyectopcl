import { computeZonalFlux } from '@/pages/dialux/export/derived/data/computeZonalFlux';
import type { PhotometricMetadata, PhotometricWeb } from './catalogApi';

function formatNumber(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return value.toLocaleString('es-PE', { maximumFractionDigits: digits });
}

/**
 * Verificación de flujo zonal (Fase 1 acotada de
 * `planes/plan_correcion_luminarias_ldt.md`, a pedido explícito del
 * usuario: "solo lo que verifica precisión"). Integra la matriz de candela
 * REAL guardada (`computeZonalFlux.ts`, misma interpolación que usa el
 * motor de cálculo) y compara el resultado contra lo que el propio archivo
 * declaró (DFF/LOR, cuando el formato los trae) — una divergencia grande
 * aquí es la señal más directa de que la fotometría importada no coincide
 * con la ficha del fabricante, sin depender de comparar capturas a mano.
 */
function DeltaBadge({ computed, declared }: { computed: number | null; declared: number | null }) {
    if (computed === null || declared === null) {
        return <span className="text-muted-foreground">— (el archivo no declara este valor)</span>;
    }
    const delta = Math.abs(computed - declared);
    const tone = delta > 2 ? 'text-red-600 dark:text-red-400' : delta > 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    return (
        <span className={tone}>
            Δ {formatNumber(delta, 2)} pp {delta > 2 ? '(revisar — diverge de la ficha del fabricante)' : ''}
        </span>
    );
}

export function ZonalFluxCheck({ web, metadata }: { web: PhotometricWeb | null; metadata: PhotometricMetadata | null | undefined }) {
    if (!web) {
        return null;
    }

    const result = computeZonalFlux(web, metadata ?? null);
    if (!result) {
        return (
            <p className="text-[10px] text-muted-foreground">
                Verificación de flujo zonal no disponible — solo aplica a fotometría real de fabricante.
            </p>
        );
    }

    return (
        <div className="space-y-1.5 rounded-md border border-border p-2">
            <p className="text-[11px] font-medium">Verificación de flujo zonal (integrado de la matriz real)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div>
                    Flujo total integrado: <span className="font-mono">{formatNumber(result.totalFluxLm, 1)} lm</span>
                </div>
                <div>
                    LOR calculado: <span className="font-mono">{formatNumber(result.lightOutputRatioPct, 2)}%</span>{' '}
                    <DeltaBadge computed={result.lightOutputRatioPct} declared={result.declaredLightOutputRatioPct} />
                </div>
                <div>
                    DFF calculado: <span className="font-mono">{formatNumber(result.downwardFluxFractionPct, 2)}%</span>{' '}
                    <DeltaBadge computed={result.downwardFluxFractionPct} declared={result.declaredDownwardFluxFractionPct} />
                </div>
                <div>
                    UFF calculado: <span className="font-mono">{formatNumber(result.upwardFluxFractionPct, 2)}%</span>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
                LOR/DFF calculados integran <code>I(γ,φ)·sinγ</code> sobre la matriz guardada (CIE 121:1996 §6.3) y se
                comparan contra lo que el propio archivo declaró (LDT líneas 22-23 / metadata IES) — un LOR lejos de 100%
                indica que el flujo de referencia guardado no coincide con lo que la matriz de candela realmente integra.
            </p>
        </div>
    );
}
