import type { PhotometricWeb } from './catalogApi';

function formatNumber(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return value.toLocaleString('es-PE', { maximumFractionDigits: digits });
}

/**
 * Tabla cruda de intensidad luminosa por ángulo (C-plano × gamma), en cd
 * absolutos — `web.candela` ya viene escalado al flujo real por el parser
 * (Rust `dialux-photometry` o el respaldo PHP), el mismo dato que consume
 * `candela()` (`hooks/photometricInterpolation.ts`) para el cálculo real.
 * Es el mismo formato que la pestaña "Luminous intensities" del LDT Editor
 * de DIALux (que también muestra cd absolutos, no cd/1000lm) — antes esta
 * tabla dividía el valor de vuelta a cd/1000lm y lo etiquetaba como si
 * coincidiera con ese editor, lo que hacía parecer una discrepancia de
 * fotometría donde no la había (verificado contra una exportación real del
 * LDT Editor: 635.47 aquí vs 1639.51 ahí para la misma luminaria, γ=0° —
 * la relación exacta era el flujo real ÷ 1000, no un error de lectura).
 *
 * Extraída de `PhotometricPreviewModal.tsx` (que ya excedía el presupuesto
 * de tamaño de `fileSizeBudget.test.ts` antes de este cambio) para no
 * seguir sumando a esa deuda.
 *
 * Sin esta tabla, la única forma de verificar si la curva importada
 * coincide con la ficha del fabricante o con DIALux evo era consultar la
 * base de datos directamente — el usuario no tenía manera de comparar
 * visualmente los valores reales guardados.
 */
export function IntensityTable({ web }: { web: PhotometricWeb | null }) {
    if (!web) {
        return <p className="text-xs text-muted-foreground">Sin matriz fotométrica válida.</p>;
    }

    return (
        <div className="max-w-2xl space-y-2">
            <p className="text-[11px] text-muted-foreground">
                Intensidad luminosa por ángulo, en cd absolutos (ya escalados al flujo real de la luminaria) — mismo
                formato que la pestaña "Luminous intensities" del LDT Editor de DIALux, para comparar directamente
                contra la ficha del fabricante o una exportación de DIALux evo.
            </p>
            <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                        <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="px-2 py-1 font-medium">γ</th>
                            {web.c_angles.map((c) => (
                                <th key={c} className="px-2 py-1 text-right font-medium">
                                    C{formatNumber(c, 0)}°
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {web.gamma_angles.map((gamma, gammaIndex) => (
                            <tr key={gamma} className="border-b border-border/50">
                                <td className="px-2 py-1 text-muted-foreground">{formatNumber(gamma, 1)}°</td>
                                {web.c_angles.map((c, cIndex) => {
                                    const raw = web.candela[cIndex]?.[gammaIndex] ?? null;
                                    return (
                                        <td key={c} className="px-2 py-1 text-right font-mono">
                                            {formatNumber(raw, 2)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
                Dimension unit: cd · flujo de referencia {formatNumber(web.reference_lumens, 0)} lm · procedencia:{' '}
                {web.provenance ?? 'desconocida'}.
            </p>
        </div>
    );
}
