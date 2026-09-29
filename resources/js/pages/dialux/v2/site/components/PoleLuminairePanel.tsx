import { ImagePlus, Replace, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    DEFAULT_LUMINAIRE,
    lumensForTargetLux,
    type LuminaireSource,
} from '../domain/exteriorLighting';
import type { PoleArmStyle, PoleConfig, PoleHeadStyle } from '../domain/types';
import {
    useLuminaireCatalog,
    useLuminairePhotometry,
} from '../hooks/useLuminaireCatalog';
import { importLuminaireFile, type LuminaireCatalogItem } from '../lib/luminaireCatalog';

/** Tipos de poste habituales (fotos de referencia: báculo, doble brazo, acodado…). */
const POLE_PRESETS: Array<{
    id: string;
    label: string;
    patch: Partial<PoleConfig>;
}> = [
    { id: 'straight', label: 'Brazo recto', patch: { armStyle: 'straight', headStyle: 'street', fixtures: 1 } },
    { id: 'curved', label: 'Báculo curvo', patch: { armStyle: 'curved', headStyle: 'street', fixtures: 1 } },
    { id: 'double', label: 'Doble brazo (T)', patch: { armStyle: 'straight', headStyle: 'street', fixtures: 2 } },
    { id: 'double-curved', label: 'Doble báculo', patch: { armStyle: 'curved', headStyle: 'street', fixtures: 2 } },
    { id: 'bracket', label: 'Acodado con tirante', patch: { armStyle: 'bracket', headStyle: 'street', fixtures: 1 } },
    { id: 'globe', label: 'Farol (esfera)', patch: { armLengthM: 0, headStyle: 'globe', fixtures: 1 } },
    { id: 'flood', label: 'Proyector', patch: { headStyle: 'flood' } },
    { id: 'bollard', label: 'Bolardo (1 m)', patch: { mount: 'bollard', heightM: 1, armLengthM: 0, fixtures: 1 } },
    { id: 'inground', label: 'Empotrada en piso', patch: { mount: 'inground', heightM: 0, armLengthM: 0, fixtures: 1 } },
];

const ARM_LABEL: Record<PoleArmStyle, string> = {
    straight: 'Recto',
    curved: 'Curvo (báculo)',
    bracket: 'Acodado con tirante',
};
const HEAD_LABEL: Record<PoleHeadStyle, string> = {
    street: 'Alumbrado público LED',
    globe: 'Farol esférico',
    flood: 'Proyector',
};

/** Medidas del cuerpo de la luminaria (m) tomadas de su ficha LDT/IES. */
function headSizeOf(item: LuminaireCatalogItem | undefined): PoleConfig['headSizeM'] {
    const d = item?.dimensions;
    return d ? { length: d.length, width: d.width || d.length * 0.4, height: d.height } : undefined;
}

/** Ficha del producto: foto y datos de su archivo LDT/IES. */
function ProductCard({ item }: { item: LuminaireCatalogItem }) {
    const rows: Array<[string, string | null]> = [
        ['Fabricante', item.manufacturer],
        ['N.º artículo', item.articleNumber],
        ['Flujo', item.totalLumens ? `${Math.round(item.totalLumens).toLocaleString('es-PE')} lm` : null],
        ['Potencia', item.powerWatts ? `${item.powerWatts} W` : null],
        ['Eficacia', item.efficacyLmW ? `${Math.round(item.efficacyLmW)} lm/W` : null],
        ['CCT', item.cct ? `${item.cct} K` : null],
        ['IRC (Ra)', item.criRa ? String(item.criRa) : null],
        ['Haz (50 %)', item.beamAngle50 ? `${Math.round(item.beamAngle50)}°` : null],
        ['Distribución', item.distributionType],
        [
            'Medidas',
            item.dimensions
                ? `${Math.round(item.dimensions.length * 1000)} × ${Math.round(item.dimensions.width * 1000)} × ${Math.round(item.dimensions.height * 1000)} mm`
                : null,
        ],
        ['Archivo', item.sourceFormat ? item.sourceFormat.toUpperCase() : null],
    ];
    return (
        <div className="flex gap-2 rounded-md border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-950/40">
            {item.imageUrl ? (
                <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded object-contain bg-slate-50 dark:bg-white/5"
                />
            ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-slate-100 text-center text-[9px] text-slate-400 dark:bg-white/5">
                    Sin foto
                </div>
            )}
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-2 text-[10px] leading-tight">
                {rows
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="text-slate-400">{label}</dt>
                            <dd className="truncate text-slate-700 dark:text-slate-200">{value}</dd>
                        </div>
                    ))}
            </dl>
        </div>
    );
}

const input =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const field = 'text-[11px] text-slate-500';

function NumField({
    label,
    value,
    step = 1,
    min,
    onChange,
}: {
    label: string;
    value: number;
    step?: number;
    min?: number;
    onChange: (n: number) => void;
}) {
    return (
        <label className={field}>
            {label}
            <input
                type="number"
                step={step}
                min={min}
                className={input}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}

interface Props {
    /** Valores actuales (si hay varios postes seleccionados, los del primero). */
    config: PoleConfig;
    /** Aplica un cambio a este poste — o a todos los seleccionados. */
    onPatch: (patch: Partial<PoleConfig>) => void;
    /** Cuántos postes afecta (para el texto). */
    count?: number;
}

/**
 * Luminaria de un poste: elegir del catálogo COMPARTIDO con v1 (con su
 * fotometría IES/LDT real) o usar el modelo genérico, importar un LDT/IES
 * nuevo al mismo catálogo, y dimensionar el flujo para un espacio concreto
 * (iluminancia objetivo a cierta distancia del poste).
 */
export function PoleLuminairePanel({ config, onPatch, count = 1 }: Props) {
    const catalog = useLuminaireCatalog();
    const [query, setQuery] = useState('');
    const [radiusM, setRadiusM] = useState(5);
    const [targetLux, setTargetLux] = useState(10);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [pendingImage, setPendingImage] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLInputElement>(null);
    const siteElements = useEditorStore((state) => state.project?.site?.elements);
    const updateSiteElement = useEditorStore((state) => state.updateSiteElement);

    const product = catalog.items.find((item) => item.id === config.productId);
    const photometry = useLuminairePhotometry(
        config.productId ? [config.productId] : [],
    ).get(config.productId ?? -1);
    const lumens =
        config.lumens ?? product?.totalLumens ?? DEFAULT_LUMINAIRE.lumens;
    const watts =
        config.wattage ?? product?.powerWatts ?? DEFAULT_LUMINAIRE.watts;
    const fixtures = Math.max(1, config.fixtures);

    // Flujo necesario por luminaria para `targetLux` a `radiusM` del poste (promedio de 8 direcciones).
    const source: LuminaireSource = {
        x: 0,
        y: Math.max(1, config.heightM - 0.1),
        z: 0,
        lumens,
        beamDeg: config.beamAngleDeg ?? DEFAULT_LUMINAIRE.beamDeg,
        maintenance: config.maintenanceFactor ?? DEFAULT_LUMINAIRE.maintenance,
        photometry: photometry?.web
            ? {
                  web: photometry.web,
                  scale:
                      (photometry.web.reference_lumens ?? 0) > 0
                          ? lumens / (photometry.web.reference_lumens as number)
                          : 1,
                  orientationRad: 0,
              }
            : undefined,
    };
    const neededTotal = lumensForTargetLux(source, radiusM, targetLux);
    const needed = neededTotal === null ? null : neededTotal / fixtures;

    const q = query.trim().toLowerCase();
    const visible = catalog.items
        .filter(
            (item) =>
                !q ||
                item.name.toLowerCase().includes(q) ||
                (item.manufacturer ?? '').toLowerCase().includes(q),
        )
        .slice(0, 40);
    const suggested =
        needed === null
            ? []
            : catalog.items
                  .filter((item) => (item.totalLumens ?? 0) > 0)
                  .sort(
                      (a, b) =>
                          Math.abs((a.totalLumens as number) - needed) -
                          Math.abs((b.totalLumens as number) - needed),
                  )
                  .slice(0, 3);

    const pick = (id: number) => {
        // Con producto, el flujo por defecto es el de su ficha (se puede sobrescribir).
        const item = catalog.items.find((candidate) => candidate.id === id);
        onPatch({
            productId: id,
            lumens: undefined,
            wattage: undefined,
            resolvedWatts: item?.powerWatts ?? undefined,
            headSizeM: headSizeOf(item),
        });
        setMessage(null);
    };

    // Reemplazar la luminaria actual en TODOS los postes de la planta que la
    // usan (mismo producto, o la genérica), en un solo paso de deshacer.
    const sameLuminaire = (siteElements ?? []).filter(
        (element) =>
            element.type === 'pole' &&
            element.config?.kind === 'pole' &&
            element.config.productId === config.productId,
    );
    const [replaceWith, setReplaceWith] = useState<number | ''>('');
    const replaceAll = () => {
        if (replaceWith === '') return;
        const item = catalog.items.find((candidate) => candidate.id === replaceWith);
        const history = useEditorStore.getState();
        history.beginHistoryGesture();
        for (const element of sameLuminaire) {
            if (element.config?.kind !== 'pole') continue;
            updateSiteElement(element.id, {
                config: {
                    ...element.config,
                    productId: replaceWith,
                    lumens: undefined,
                    wattage: undefined,
                    resolvedWatts: item?.powerWatts ?? undefined,
                    headSizeM: headSizeOf(item),
                },
            });
        }
        history.endHistoryGesture();
        setMessage(`Reemplazada en ${sameLuminaire.length} poste(s) por "${item?.name ?? ''}".`);
        setReplaceWith('');
    };

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setMessage(null);
        try {
            const { item, warnings } = await importLuminaireFile(file, pendingImage ?? undefined);
            catalog.reload();
            setPendingImage(null);
            onPatch({
                productId: item.id,
                lumens: undefined,
                wattage: undefined,
                resolvedWatts: item.powerWatts ?? undefined,
                headSizeM: headSizeOf(item),
            });
            setMessage(
                `Importada "${item.name}" al catálogo compartido (también disponible en el editor de interiores).${
                    warnings.length ? ` ${warnings.length} advertencia(s) del lector.` : ''
                }`,
            );
        } catch (error) {
            setMessage(
                `No se pudo importar: ${error instanceof Error ? error.message : 'error'}`,
            );
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Tipo de poste{count > 1 ? ` · ${count} postes` : ''}
            </p>
            <div className="flex flex-wrap gap-1">
                {POLE_PRESETS.map((preset) => (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                            onPatch({
                                ...(preset.patch.mount ? {} : { mount: 'pole' as const, heightM: Math.max(3, config.heightM) }),
                                ...preset.patch,
                                // Con brazo: al menos 1,5 m si no tenía.
                                ...(preset.patch.armLengthM === undefined &&
                                preset.id !== 'flood' &&
                                (config.armLengthM ?? 0) <= 0
                                    ? { armLengthM: 1.5 }
                                    : {}),
                            })
                        }
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300"
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
                <label className={field}>
                    Brazo
                    <select
                        className={input}
                        value={config.armStyle ?? 'straight'}
                        onChange={(e) => onPatch({ armStyle: e.target.value as PoleArmStyle })}
                    >
                        {Object.entries(ARM_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={field}>
                    Cuerpo de la luminaria
                    <select
                        className={input}
                        value={config.headStyle ?? ((config.armLengthM ?? 0) > 0 ? 'street' : 'globe')}
                        onChange={(e) => onPatch({ headStyle: e.target.value as PoleHeadStyle })}
                    >
                        {Object.entries(HEAD_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <NumField
                    label="Luminarias por poste"
                    value={fixtures}
                    step={1}
                    min={1}
                    onChange={(value) => onPatch({ fixtures: Math.max(1, Math.min(4, Math.round(value))) })}
                />
                <NumField
                    label="Largo del brazo (m)"
                    value={config.armLengthM ?? 0}
                    step={0.25}
                    min={0}
                    onChange={(value) => onPatch({ armLengthM: Math.max(0, value) })}
                />
            </div>

            <p className="mt-1 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Luminaria
            </p>

            {product && <ProductCard item={product} />}
            <div className="text-[11px]">
                {product ? (
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200">
                            <strong>{product.name}</strong>
                            {product.manufacturer
                                ? ` · ${product.manufacturer}`
                                : ''}
                            <span className="block text-[10px] text-slate-400">
                                {photometry?.web
                                    ? 'Fotometría real (IES/LDT) en el cálculo'
                                    : 'Sin matriz fotométrica: se usa el modelo genérico'}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => onPatch({ productId: undefined })}
                            className="shrink-0 text-[10px] text-rose-500 hover:underline"
                        >
                            Quitar
                        </button>
                    </div>
                ) : (
                    <span className="text-slate-500">
                        Modelo genérico (lm + ángulo de haz). Elige una
                        luminaria del catálogo para usar su fotometría real.
                    </span>
                )}
            </div>

            <input
                className={input}
                placeholder="Buscar en el catálogo (nombre o fabricante)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
                {catalog.loading && (
                    <p className="p-2 text-[10px] text-slate-400">
                        Cargando catálogo…
                    </p>
                )}
                {catalog.error && (
                    <p className="p-2 text-[10px] text-rose-500">
                        No se pudo cargar el catálogo ({catalog.error}).
                    </p>
                )}
                {!catalog.loading && !catalog.error && visible.length === 0 && (
                    <p className="p-2 text-[10px] text-slate-400">
                        Sin resultados. Importa un archivo LDT/IES abajo.
                    </p>
                )}
                {visible.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => pick(item.id)}
                        className={`block w-full border-b border-slate-100 px-2 py-1 text-left text-[10px] last:border-b-0 hover:bg-amber-50 dark:border-white/5 dark:hover:bg-white/5 ${
                            item.id === config.productId
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                                : 'text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <span className="flex items-center gap-1.5">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
                            ) : (
                                <span className="h-6 w-6 shrink-0 rounded bg-slate-100 dark:bg-white/5" />
                            )}
                            <span className="font-semibold">{item.name}</span>
                        </span>
                        <span className="block text-slate-400">
                            {[
                                item.manufacturer,
                                item.totalLumens
                                    ? `${Math.round(item.totalLumens)} lm`
                                    : null,
                                item.powerWatts ? `${item.powerWatts} W` : null,
                                item.beamAngle50
                                    ? `haz ${Math.round(item.beamAngle50)}°`
                                    : null,
                                item.isGlobal ? 'global' : 'propia',
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    <Upload className="h-3 w-3" />
                    {busy ? 'Importando…' : 'Importar LDT / IES'}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".ldt,.ies,.gldf,.txt,.xml"
                    className="hidden"
                    onChange={(e) => void onFile(e.target.files?.[0])}
                />
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => imageRef.current?.click()}
                    title="Foto del producto que se guarda junto con el LDT/IES al importarlo"
                    className="flex min-w-0 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-white/5"
                >
                    <ImagePlus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{pendingImage ? pendingImage.name : 'Foto (opcional)'}</span>
                </button>
                <input
                    ref={imageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)}
                />
            </div>
            {sameLuminaire.length > 1 && (
                <div className="flex items-end gap-1">
                    <label className={`${field} min-w-0 flex-1`}>
                        Reemplazar en los {sameLuminaire.length} postes con{' '}
                        {product ? `"${product.name}"` : 'la genérica'}
                        <select
                            className={input}
                            value={replaceWith}
                            onChange={(e) => setReplaceWith(e.target.value ? Number(e.target.value) : '')}
                        >
                            <option value="">Elegir luminaria…</option>
                            {catalog.items
                                .filter((item) => item.id !== config.productId)
                                .map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                        {item.totalLumens ? ` · ${Math.round(item.totalLumens)} lm` : ''}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        disabled={replaceWith === ''}
                        onClick={replaceAll}
                        className="flex h-8 items-center gap-1 rounded-md bg-cyan-600 px-2 text-[10px] font-semibold text-white hover:bg-cyan-700 disabled:opacity-40"
                    >
                        <Replace className="h-3 w-3" />
                        Reemplazar
                    </button>
                </div>
            )}
            {message && (
                <p className="text-[10px] text-slate-500">{message}</p>
            )}

            <div className="grid grid-cols-2 gap-1">
                <NumField
                    label="Flujo por luminaria (lm)"
                    value={Math.round(lumens)}
                    step={250}
                    min={0}
                    onChange={(value) => onPatch({ lumens: value })}
                />
                <NumField
                    label="Potencia por luminaria (W)"
                    value={watts}
                    step={5}
                    min={0}
                    onChange={(value) => onPatch({ wattage: value })}
                />
                {!photometry?.web && (
                    <NumField
                        label="Ángulo de haz (°, 50 %)"
                        value={config.beamAngleDeg ?? DEFAULT_LUMINAIRE.beamDeg}
                        step={5}
                        min={10}
                        onChange={(value) =>
                            onPatch({
                                beamAngleDeg: Math.min(85, Math.max(10, value)),
                            })
                        }
                    />
                )}
                <NumField
                    label="Factor de mantenimiento"
                    value={
                        config.maintenanceFactor ?? DEFAULT_LUMINAIRE.maintenance
                    }
                    step={0.05}
                    min={0.1}
                    onChange={(value) =>
                        onPatch({
                            maintenanceFactor: Math.min(1, Math.max(0.1, value)),
                        })
                    }
                />
            </div>
            <p className="text-[10px] text-slate-400">
                Total del poste: {Math.round(lumens * fixtures).toLocaleString('es-PE')} lm ·{' '}
                {(lumens / Math.max(1, watts)).toFixed(0)} lm/W.
            </p>

            <div className="grid gap-1 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
                <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                    Luminaria necesaria para el espacio
                </p>
                <div className="grid grid-cols-2 gap-1">
                    <NumField
                        label="Iluminar hasta (m del poste)"
                        value={radiusM}
                        step={0.5}
                        min={0}
                        onChange={setRadiusM}
                    />
                    <NumField
                        label="Objetivo (lx)"
                        value={targetLux}
                        step={1}
                        min={0.5}
                        onChange={setTargetLux}
                    />
                </div>
                <div className="flex flex-wrap gap-1">
                    {[5, 10, 20, 30].map((lux) => (
                        <button
                            key={lux}
                            type="button"
                            onClick={() => setTargetLux(lux)}
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                targetLux === lux
                                    ? 'border-cyan-500 text-cyan-700 dark:text-cyan-300'
                                    : 'border-slate-300 text-slate-500 dark:border-slate-700'
                            }`}
                        >
                            {lux} lx
                        </button>
                    ))}
                </div>
                {needed === null ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        A esa distancia esta luminaria no da luz (fuera de su
                        haz): acerca el radio o elige otra.
                    </p>
                ) : (
                    <>
                        <p className="text-[11px] text-slate-700 dark:text-slate-200">
                            Para {targetLux} lx a {radiusM} m hacen falta ≈{' '}
                            <strong>
                                {Math.round(needed).toLocaleString('es-PE')} lm
                            </strong>{' '}
                            por luminaria (ahora{' '}
                            {Math.round(lumens).toLocaleString('es-PE')} lm,{' '}
                            {needed > lumens * 1.05
                                ? 'queda corta'
                                : needed < lumens * 0.95
                                  ? 'sobra'
                                  : 'está bien'}
                            ).
                        </p>
                        <button
                            type="button"
                            onClick={() =>
                                onPatch({ lumens: Math.round(needed) })
                            }
                            className="rounded-md border border-cyan-500 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                            Aplicar {Math.round(needed).toLocaleString('es-PE')} lm
                        </button>
                        {suggested.length > 0 && (
                            <div className="grid gap-0.5">
                                <span className="text-[10px] text-slate-400">
                                    Del catálogo, la de flujo más cercano:
                                </span>
                                {suggested.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => pick(item.id)}
                                        className="truncate rounded border border-slate-200 px-1.5 py-0.5 text-left text-[10px] text-slate-600 hover:bg-amber-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                                    >
                                        {item.name} ·{' '}
                                        {Math.round(item.totalLumens as number)} lm
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
                <p className="text-[9px] text-slate-400">
                    No hay norma de iluminancia exterior cargada: el objetivo lo
                    defines tú (5-30 lx son valores típicos de criterio de
                    proyecto, no una exigencia normativa). Cálculo simplificado:
                    sin inclinación ni obstáculos.
                </p>
            </div>
        </div>
    );
}
