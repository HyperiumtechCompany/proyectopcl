import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
    TrampaAparato, TrampaCaracteristica, TrampaParametro, TrampaMedida,
    TrampaState, TabDesagueProps,
} from '@/types/desague';

// ─── Constants ────────────────────────────────────────────────────────────────

const uid = (): string => crypto.randomUUID();

const INITIAL_APARATOS: TrampaAparato[] = [
    { id: uid(), aparato: 'LAVADERO DE COCINA', cantidad: 2, tipo: 'MULTIPLE HOTEL RESTAURANTE', ug: 3, totalUG: 6 },
    { id: uid(), aparato: 'LAVADERO DE REPOSTERIA', cantidad: 0, tipo: 'MULTIPLE HOTEL RESTAURANTE', ug: 3, totalUG: 0 },
    { id: uid(), aparato: 'LAVADERO DE ROPA', cantidad: 2, tipo: '', ug: 3, totalUG: 6 },
];

const INITIAL_CARACTERISTICAS: TrampaCaracteristica[] = [
    { id: uid(), caracteristica: 'CAUDAL DE CALCULO', valor: 'Caudal máximo' },
    { id: uid(), caracteristica: 'Tiempo de Retención Hidráulica (TRH)', valor: 'VER TABLA A LA DERECHA' },
    { id: uid(), caracteristica: 'Relación Largo:Ancho', valor: '1:2' },
    { id: uid(), caracteristica: 'Dispositivos de ingreso y salida', valor: 'Codo y Tee de 90° y mínimo de ¼ pulgadas' },
    { id: uid(), caracteristica: 'Sumergencia del tubo de entrada', valor: 'Mínimo 0.15 m respecto del nivel de salida' },
];

// Params that the user can directly type in (not auto-computed)
const EDITABLE_PARAMS = new Set([
    'TIEMPO DE RETENCION = 3 MIN RECOMENDADO',
    'PROFUNDIDAD INTERNA (SIN BORDE LIBRE)',
    'RELACION LARGO:ANCHO',
    'ANCHO INTERNO',
    'LARGO INTERNO',
    'BORDE LIBRE',
]);

const INITIAL_PARAMS: TrampaParametro[] = [
    { id: uid(), parametro: 'UG', calculos: 0, unidad: '', editable: false },
    { id: uid(), parametro: 'CAUDAL DE DISEÑO = 0.3*RAIZ(UG)', calculos: 0, unidad: 'lps', editable: false },
    { id: uid(), parametro: 'TIEMPO DE RETENCION = 3 MIN RECOMENDADO', calculos: 180, unidad: 'seg', editable: true },
    { id: uid(), parametro: 'VOLUMEN REQUERIDO', calculos: 0, unidad: 'm³', editable: false },
    { id: uid(), parametro: 'PROFUNDIDAD INTERNA (SIN BORDE LIBRE)', calculos: 0.4, unidad: 'm', editable: true },
    { id: uid(), parametro: 'RELACION LARGO:ANCHO', calculos: 0.5, unidad: '', editable: true },
    { id: uid(), parametro: 'ANCHO INTERNO', calculos: 0.5, unidad: 'm', editable: true },
    { id: uid(), parametro: 'LARGO INTERNO', calculos: 0.8, unidad: 'm', editable: true },
    { id: uid(), parametro: 'VOLUMEN UTIL CALCULADO (m³)', calculos: 0, unidad: 'm³', editable: false },
    { id: uid(), parametro: 'VOLUMEN UTIL CALCULADO (lts)', calculos: 0, unidad: 'lts', editable: false },
    { id: uid(), parametro: 'BORDE LIBRE', calculos: 0.1, unidad: 'm', editable: true },
    { id: uid(), parametro: 'PROFUNDIDAD (CON BORDE LIBRE)', calculos: 0.5, unidad: 'm', editable: false },
];

const INITIAL_MEDIDAS: TrampaMedida[] = [
    { id: uid(), medida: 'ANCHO A', valor: 0.5, unidad: 'm' },
    { id: uid(), medida: 'LARGO L', valor: 0.8, unidad: 'm' },
    { id: uid(), medida: 'ALTO H', valor: 0.5, unidad: 'm' },
];

// ─── Pure calculation ─────────────────────────────────────────────────────────

interface Computed {
    totalUG: number;
    caudal: number;
    tiempoRet: number;
    volRequerido: number;
    profInterna: number;
    anchoInterno: number;
    largoInterno: number;
    bordeLibre: number;
    volUtilM3: number;
    volUtilLts: number;
    profTotal: number;
}

function computeAll(aparatos: TrampaAparato[], params: TrampaParametro[]): Computed {
    const get = (keyword: string, def: number): number => {
        const row = params.find(p => p.parametro.includes(keyword));
        return row ? Number(row.calculos) || def : def;
    };
    const totalUG = aparatos.reduce((s, r) => s + r.cantidad * r.ug, 0);
    const caudal = 0.3 * Math.sqrt(Math.max(totalUG, 0));
    const tiempoRet = get('TIEMPO DE RETENCION', 180);
    const volRequerido = (caudal * tiempoRet) / 1000;
    const profInterna = get('PROFUNDIDAD INTERNA', 0.4);
    const anchoInterno = get('ANCHO INTERNO', 0.5);
    const largoInterno = get('LARGO INTERNO', 0.8);
    const bordeLibre = get('BORDE LIBRE', 0.1);
    const volUtilM3 = profInterna * anchoInterno * largoInterno;
    const volUtilLts = volUtilM3 * 1000;
    const profTotal = profInterna + bordeLibre;
    return { totalUG, caudal, tiempoRet, volRequerido, profInterna, anchoInterno, largoInterno, bordeLibre, volUtilM3, volUtilLts, profTotal };
}

function applyComputed(params: TrampaParametro[], c: Computed): TrampaParametro[] {
    return params.map(p => {
        if (p.editable) return p; // never overwrite user-editable rows
        const pat = p.parametro;
        if (pat === 'UG') return { ...p, calculos: c.totalUG };
        if (pat.includes('CAUDAL DE DISEÑO')) return { ...p, calculos: Number(c.caudal.toFixed(3)) };
        if (pat.includes('VOLUMEN REQUERIDO')) return { ...p, calculos: Number(c.volRequerido.toFixed(4)) };
        if (pat.includes('VOLUMEN UTIL CALCULADO (m³)')) return { ...p, calculos: Number(c.volUtilM3.toFixed(3)) };
        if (pat.includes('VOLUMEN UTIL CALCULADO (lts)')) return { ...p, calculos: Number(c.volUtilLts.toFixed(0)) };
        if (pat.includes('PROFUNDIDAD (CON BORDE LIBRE)')) return { ...p, calculos: Number(c.profTotal.toFixed(2)) };
        return p;
    });
}

// ─── Inline input ─────────────────────────────────────────────────────────────

interface InlineCellProps {
    value: string | number;
    disabled?: boolean;
    type?: string;
    onChange: (v: string) => void;
    className?: string;
}

const InlineCell = React.memo(({ value, disabled, type = 'text', onChange, className = '' }: InlineCellProps) => {
    const [draft, setDraft] = useState(String(value ?? ''));
    const focused = useRef(false);
    const prev = useRef(value);

    useEffect(() => {
        if (!focused.current && String(value ?? '') !== String(prev.current ?? '')) setDraft(String(value ?? ''));
        prev.current = value;
    }, [value]);

    if (disabled) {
        return <span className={`block px-2 py-1 text-sm text-gray-900 dark:text-gray-100 font-medium ${className}`}>{value}</span>;
    }
    return (
        <input
            type={type}
            step={type === 'number' ? 'any' : undefined}
            value={draft}
            className={`w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-gray-100 ${className}`}
            onFocus={() => { focused.current = true; }}
            onBlur={() => { focused.current = false; }}
            onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
        />
    );
});
InlineCell.displayName = 'InlineCell';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, color, action, children }: {
    title: string;
    color: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className={`px-5 py-3 flex items-center justify-between ${color}`}>
                <h2 className="text-sm font-bold text-white">{title}</h2>
                {action}
            </div>
            {children}
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TrampaGrasaDesague({ editMode, canEdit, initialData, onChange }: TabDesagueProps) {
    const isEdit = !!(editMode && canEdit);

    const [aparatos, setAparatos] = useState<TrampaAparato[]>(() => initialData?.aparatos ?? INITIAL_APARATOS);
    const [caracteristicas, setCaracteristicas] = useState<TrampaCaracteristica[]>(() => initialData?.caracteristicas ?? INITIAL_CARACTERISTICAS);
    const [params, setParams] = useState<TrampaParametro[]>(() => initialData?.parametrosFinal ?? INITIAL_PARAMS);
    const [medidas, setMedidas] = useState<TrampaMedida[]>(() => initialData?.medidas ?? INITIAL_MEDIDAS);
    const [comentario, setComentario] = useState<string>(() => initialData?.comentario ?? '');

    // ── Derived (no state ― avoids infinite loops) ────────────────────────────
    const computed = useMemo(() => computeAll(aparatos, params), [aparatos, params]);

    // Apply computed values to params (derived, synchronised every render cycle)
     
    const derivedParams = useMemo(() => applyComputed(params, computed), [params, computed]);

    // Sync medidas from computed
    useEffect(() => {
        setMedidas(prev => prev.map(m => {
            if (m.medida === 'ANCHO A') return { ...m, valor: computed.anchoInterno };
            if (m.medida === 'LARGO L') return { ...m, valor: computed.largoInterno };
            if (m.medida === 'ALTO H') return { ...m, valor: parseFloat(computed.profTotal.toFixed(2)) };
            return m;
        }));
    }, [computed.anchoInterno, computed.largoInterno, computed.profTotal]);

    // Debounced parent notify
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveOut = useRef(onChange);
    saveOut.current = onChange;
    useEffect(() => {
        clearTimeout(saveTimer.current!);
        saveTimer.current = setTimeout(() => {
            saveOut.current?.({ aparatos, caracteristicas, parametrosFinal: derivedParams, medidas, comentario });
        }, 400);
        return () => clearTimeout(saveTimer.current!);
    }, [aparatos, caracteristicas, derivedParams, medidas, comentario]);

    // ── Aparatos handlers ─────────────────────────────────────────────────────
    const addAparato = () =>
        setAparatos(prev => [...prev, { id: uid(), aparato: '', cantidad: 0, tipo: '', ug: 0, totalUG: 0 }]);

    const removeAparato = (id: string) =>
        setAparatos(prev => prev.filter(r => r.id !== id));

    const updateAparato = useCallback((id: string, field: keyof TrampaAparato, raw: string) => {
        setAparatos(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: field === 'aparato' || field === 'tipo' ? raw : Number(raw) || 0 };
            updated.totalUG = updated.cantidad * updated.ug;
            return updated;
        }));
    }, []);

    // ── Caracteristicas handlers ──────────────────────────────────────────────
    const updateCaract = useCallback((id: string, field: keyof TrampaCaracteristica, val: string) =>
        setCaracteristicas(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
        , []);

    // ── Params handlers (only editable rows) ──────────────────────────────────
    const updateParam = useCallback((id: string, val: string) =>
        setParams(prev => prev.map(p => p.id === id ? { ...p, calculos: val } : p))
        , []);

    // ── Medidas table ─────────────────────────────────────────────────────────
    const volUtilM3 = computed.volUtilM3;
    const volRequerido = computed.volRequerido;
    const cumple = volUtilM3 >= volRequerido;

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white">
                <h1 className="text-xl md:text-2xl font-black mb-1">ANEXO 10. Cálculo de la Trampa de Grasa</h1>
                <p className="text-blue-100 text-sm opacity-90">
                    Fórmula: Q = 0.3 × √UG · V_util = Prof × Ancho × Largo
                </p>
            </div>

            {/* 1 – Aparatos */}
            <Section
                title="1. Unidades de Gasto de Aparatos Sanitarios"
                color="bg-gradient-to-r from-orange-500 to-amber-500"
                action={isEdit && (
                    <button onClick={addAparato}
                        className="bg-white text-orange-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-orange-50 shadow-sm">
                        + Aparato
                    </button>
                )}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-orange-50 dark:bg-orange-900/20">
                            <tr>
                                {['Aparato', 'Cantidad', 'Tipo', 'UG', 'Total UG'].map((h, i) => (
                                    <th key={i} className="px-4 py-2.5 text-left text-xs font-bold text-black dark:text-orange-300 uppercase whitespace-nowrap">{h}</th>
                                ))}
                                {isEdit && <th className="px-2 py-2.5 w-12" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {aparatos.map(row => (
                                <tr key={row.id} className="hover:bg-orange-50/20 transition-colors">
                                    <td className="px-3 py-1">
                                        <InlineCell value={row.aparato} disabled={!isEdit}
                                            onChange={v => updateAparato(row.id, 'aparato', v)} />
                                    </td>
                                    <td className="px-3 py-1">
                                        <InlineCell value={row.cantidad} disabled={!isEdit} type="number"
                                            onChange={v => updateAparato(row.id, 'cantidad', v)} className="w-20" />
                                    </td>
                                    <td className="px-3 py-1">
                                        <InlineCell value={row.tipo} disabled={!isEdit}
                                            onChange={v => updateAparato(row.id, 'tipo', v)} />
                                    </td>
                                    <td className="px-3 py-1">
                                        <InlineCell value={row.ug} disabled={!isEdit} type="number"
                                            onChange={v => updateAparato(row.id, 'ug', v)} className="w-16" />
                                    </td>
                                    <td className="px-3 py-1 text-center font-bold text-orange-700 dark:text-orange-300">
                                        {row.totalUG.toFixed(2)}
                                    </td>
                                    {isEdit && (
                                        <td className="px-2 py-1 text-center">
                                            <button onClick={() => removeAparato(row.id)}
                                                className="text-red-400 hover:text-red-600 font-bold text-lg">×</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-700">
                            <tr>
                                <td colSpan={3} className="px-4 py-2.5 text-right font-black text-orange-800 dark:text-orange-300 text-xs uppercase tracking-wide">
                                    Total UG =
                                </td>
                                <td className="px-4 py-2.5" />
                                <td className="px-4 py-2.5 text-center font-black text-orange-700 dark:text-orange-200 text-xl tabular-nums">
                                    {computed.totalUG.toFixed(2)}
                                </td>
                                {isEdit && <td />}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Section>

            {/* 2 – Características */}
            <Section
                title="2. Características de la Trampa de Grasa"
                color="bg-gradient-to-r from-teal-600 to-cyan-600"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-teal-50 dark:bg-teal-900/20">
                            <tr>
                                <th className="px-5 py-2.5 text-left text-xs font-bold text-black dark:text-teal-300 uppercase w-1/2">Característica</th>
                                <th className="px-5 py-2.5 text-left text-xs font-bold text-black dark:text-teal-300 uppercase">Valor / Descripción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {caracteristicas.map((row, idx) => (
                                <tr key={row.id} className={idx % 2 === 0 ? '' : 'bg-teal-50/20 dark:bg-teal-900/10'}>
                                    <td className="px-4 py-1.5">
                                        <InlineCell value={row.caracteristica} disabled={!isEdit}
                                            onChange={v => updateCaract(row.id, 'caracteristica', v)}
                                            className="font-semibold text-gray-800 dark:text-gray-200" />
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <InlineCell value={row.valor} disabled={!isEdit}
                                            onChange={v => updateCaract(row.id, 'valor', v)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* 3 – Cálculo Final */}
            <Section
                title="3. Cálculo Final — Parámetros de Diseño"
                color="bg-gradient-to-r from-indigo-600 to-blue-600"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-indigo-50 dark:bg-indigo-900/20">
                            <tr>
                                <th className="px-5 py-2.5 text-left text-xs font-bold text-black dark:text-indigo-300 uppercase w-1/2">Parámetro</th>
                                <th className="px-5 py-2.5 text-center text-xs font-bold text-black dark:text-indigo-300 uppercase w-36">Valor</th>
                                <th className="px-5 py-2.5 text-center text-xs font-bold text-black dark:text-indigo-300 uppercase w-20">Unidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {derivedParams.map((p, idx) => (
                                <tr key={p.id}
                                    className={[
                                        idx % 2 === 0 ? '' : 'bg-indigo-50/20 dark:bg-indigo-900/5',
                                        p.editable ? 'ring-1 ring-inset ring-blue-200 dark:ring-blue-800' : '',
                                    ].join(' ')}>
                                    <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-200 text-xs">
                                        {p.editable && isEdit && (
                                            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5 align-middle" title="Editable" />
                                        )}
                                        {p.parametro}
                                    </td>
                                    <td className="px-4 py-1 text-center">
                                        {p.editable && isEdit ? (
                                            <InlineCell value={p.calculos} disabled={false} type="number"
                                                onChange={v => updateParam(p.id, v)}
                                                className="text-center font-bold text-blue-700" />
                                        ) : (
                                            <span className={`font-bold tabular-nums ${p.editable ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                                                {typeof p.calculos === 'number' ? p.calculos.toFixed(3) : p.calculos}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-1.5 text-center text-xs text-gray-500 dark:text-gray-400">{p.unidad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* 4 – Medidas finales */}
            <Section
                title="4. Medidas Finales y Verificación"
                color="bg-gradient-to-r from-green-600 to-emerald-600"
            >
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Medidas table */}
                    <div>
                        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <thead className="bg-green-50 dark:bg-green-900/20">
                                <tr>
                                    {['Medida', 'Valor', 'Unidad'].map((h, i) => (
                                        <th key={i} className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-bold text-black dark:text-green-300 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800">
                                {medidas.map(m => (
                                    <tr key={m.id} className="hover:bg-green-50/20 transition-colors">
                                        <td className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 font-semibold text-gray-800 dark:text-gray-200">{m.medida}</td>
                                        <td className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-center font-bold tabular-nums text-green-700 dark:text-green-300">
                                            {m.valor.toFixed(2)}
                                        </td>
                                        <td className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-center text-xs text-gray-500">{m.unidad}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Verification panel */}
                    <div className="flex flex-col gap-4">
                        <div className={`rounded-2xl p-5 shadow-lg text-center border-2 ${cumple
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-400'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-400'}`}>
                            <div className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-500">Verificación de Volumen</div>
                            <div className="text-sm mb-1">
                                <span className="font-semibold">V útil</span> = <span className="font-black tabular-nums">{volUtilM3.toFixed(3)}</span> m³
                            </div>
                            <div className="text-sm mb-3">
                                <span className="font-semibold">V requerido</span> = <span className="font-black tabular-nums">{volRequerido.toFixed(4)}</span> m³
                            </div>
                            <div className={`text-xl font-black ${cumple ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                {cumple ? '✔ CUMPLE' : '✘ NO CUMPLE'}
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                            <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">Resumen</div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">UG Total</span>
                                    <span className="font-bold tabular-nums">{computed.totalUG}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Caudal diseño Q</span>
                                    <span className="font-bold tabular-nums">{computed.caudal.toFixed(3)} lps</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">V útil calculado</span>
                                    <span className="font-bold tabular-nums">{(computed.volUtilLts).toFixed(0)} lts</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Profundidad total</span>
                                    <span className="font-bold tabular-nums">{computed.profTotal.toFixed(2)} m</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
                                Comentario del cálculo
                            </label>
                            <textarea
                                value={comentario}
                                onChange={(e) => setComentario(e.target.value)}
                                disabled={!isEdit}
                                className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 dark:text-gray-100 disabled:opacity-75 disabled:bg-gray-50 resize-y"
                                placeholder={isEdit ? "Ingrese un comentario u observación acerca de este cálculo..." : "Sin comentarios."}
                            />
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}