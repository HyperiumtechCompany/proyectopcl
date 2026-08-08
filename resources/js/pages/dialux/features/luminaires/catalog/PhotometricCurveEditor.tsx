/**
 * Editor de curva fotométrica manual (gamma/candela), extraído de
 * `components/CatalogPanel.tsx` (Fase 2) sin cambiar comportamiento — mismo
 * JSX, mismas clases, mismas reglas (mínimo 3 puntos).
 */

export interface PhotometricCurvePoint {
    gamma: string;
    candela: string;
}

export const MIN_PHOTOMETRIC_CURVE_POINTS = 3;

export const DEFAULT_PHOTOMETRIC_CURVE_POINTS: PhotometricCurvePoint[] = [
    { gamma: '0', candela: '' },
    { gamma: '30', candela: '' },
    { gamma: '60', candela: '' },
    { gamma: '90', candela: '' },
];

interface PhotometricCurveEditorProps {
    points: PhotometricCurvePoint[];
    onChange: (points: PhotometricCurvePoint[]) => void;
}

export function PhotometricCurveEditor({ points, onChange }: PhotometricCurveEditorProps) {
    const updatePoint = (index: number, field: keyof PhotometricCurvePoint, value: string) => {
        onChange(points.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    };

    return (
        <div className="rounded border border-amber-800/40 bg-gray-300 dark:bg-gray-950/30 p-1.5">
            <p className="mb-1 text-[8px] leading-tight text-gray-500 dark:text-gray-500">
                Curva de candelas por ángulo gamma (0°=nadir, hacia abajo). Se asume simetría rotacional (un solo
                plano C). El ángulo de haz se calcula solo — no lo declares arriba.
            </p>
            <div className="flex flex-col gap-1">
                {points.map((point, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                        <input
                            type="number"
                            min="0"
                            max="180"
                            value={point.gamma}
                            onChange={(event) => updatePoint(index, 'gamma', event.target.value)}
                            placeholder="Gamma (°)"
                            className="rounded border border-gray-300 dark:border-gray-700/70 bg-gray-200 dark:bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-800 dark:text-gray-800 dark:text-gray-200 placeholder:text-gray-600 dark:text-gray-600 focus:border-amber-600 focus:outline-none"
                        />
                        <input
                            type="number"
                            min="0"
                            value={point.candela}
                            onChange={(event) => updatePoint(index, 'candela', event.target.value)}
                            placeholder="Candela (cd)"
                            className="rounded border border-gray-300 dark:border-gray-700/70 bg-gray-200 dark:bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-800 dark:text-gray-800 dark:text-gray-200 placeholder:text-gray-600 dark:text-gray-600 focus:border-amber-600 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => onChange(points.filter((_, i) => i !== index))}
                            disabled={points.length <= MIN_PHOTOMETRIC_CURVE_POINTS}
                            title="Quitar punto"
                            className="rounded border border-gray-300 dark:border-gray-700/70 px-1.5 text-[9px] text-gray-600 dark:text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={() => onChange([...points, { gamma: '', candela: '' }])}
                className="mt-1 w-full rounded border border-dashed border-gray-300 dark:border-gray-700/70 py-0.5 text-[8px] text-gray-600 dark:text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:bg-gray-800"
            >
                + Agregar punto
            </button>
        </div>
    );
}
