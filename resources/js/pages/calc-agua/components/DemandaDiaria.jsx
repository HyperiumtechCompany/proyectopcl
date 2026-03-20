import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const USO_OPTIONS = ['DEPOSITO', 'ALMACEN', 'OFICINA', 'CONSULTORIO', 'LABORATORIO', 'COMEDOR'];

const DOTACION_OPTIONS = [
    { label: '0.50 Lt x m2 / dia', value: 0.5 },
    { label: '2.00 Lt x m2 / dia', value: 2 },
    { label: '6.00 Lt x m2 / dia', value: 6 },
    { label: '40.00 Lt x m2 / dia', value: 40 },
    { label: '50.00 Lt x per / dia', value: 50 },
    { label: '200.00 Lt x per / dia', value: 200 },
    { label: '500.00 Lt /dia', value: 500 },
];

const DOTACION_MAP = Object.fromEntries(DOTACION_OPTIONS.map((d) => [d.label, d.value]));
const USO_LIST = Object.fromEntries(USO_OPTIONS.map((u) => [u, u]));
const DOT_LIST = Object.fromEntries(DOTACION_OPTIONS.map((d) => [d.label, d.label]));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = (v) => parseFloat((isFinite(v) ? v : 0).toFixed(2));
const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const dotacionValue = (dotacion) => {
    if (typeof dotacion === 'number') return dotacion;
    const s = String(dotacion ?? '');
    if (s in DOTACION_MAP) return DOTACION_MAP[s];
    const m = s.match(/(\d+(?:\.\d+)?)/);
    return m ? toNum(m[1]) : 0;
};

const calcCaudal = ({ cantidad, dotacion }) => {
    const dv = dotacionValue(dotacion);
    const str = String(dotacion ?? '');
    return round2(str.includes('Lt /dia') ? dv : toNum(cantidad) * dv);
};

const mkRow = (raw, fallbackDotacion, prefix = 'row') => {
    const base = {
        id: raw?.id ?? uid(prefix),
        ambiente: raw?.ambiente ?? 'Nuevo Ambiente',
        uso: raw?.uso ?? 'Nuevo Uso',
        cantidad: toNum(raw?.cantidad),
        dotacion: raw?.dotacion ?? fallbackDotacion,
    };
    return { ...base, caudal: calcCaudal(base) };
};

const mkPiso = (raw, pisoIndex) => ({
    id: raw?.id ?? uid('piso'),
    modulos: (Array.isArray(raw?.modulos) ? raw.modulos : []).map((m, mi) =>
        mkRow(m, '0.50 Lt x m2 / dia', `p${pisoIndex}m${mi}`),
    ),
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_T1 = [
    { ambiente: '(DOCENTES) NIVEL INICIAL', uso: 'DOCENTES', cantidad: 3, dotacion: '50.00 Lt x per / dia' },
    { ambiente: '(DOCENTES) NIVEL PRIMARIA', uso: 'DOCENTES', cantidad: 15, dotacion: '50.00 Lt x per / dia' },
    { ambiente: '(ALUMNOS) NIVEL INICIAL', uso: 'ALUMNOS/2 aulas 31 c/u', cantidad: 62, dotacion: '50.00 Lt x per / dia' },
    { ambiente: '(ALUMNOS) NIVEL PRIMARIA', uso: 'ALUM./10 aulas 25 c/u +16', cantidad: 266, dotacion: '50.00 Lt x per / dia' },
    { ambiente: 'DIRECTOR', uso: 'DIRECTOR', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { ambiente: 'GUARDIAN', uso: 'GUARDIAN', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { ambiente: 'PER.SERVICIO', uso: 'PER.SERVICIO', cantidad: 2, dotacion: '50.00 Lt x per / dia' },
    { ambiente: 'BIBLIOTECARIA', uso: 'BIBLIOTECARIA', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
    { ambiente: 'SECRETARIA', uso: 'SECRETARIA', cantidad: 1, dotacion: '50.00 Lt x per / dia' },
];

const DEFAULT_T2 = [
    {
        modulos: [
            { ambiente: 'ALMACEN GENERAL', uso: 'ALMACEN', cantidad: 28.91, dotacion: '0.50 Lt x m2 / dia' },
            { ambiente: 'DEPOSITO SUM', uso: 'DEPOSITO', cantidad: 30.08, dotacion: '0.50 Lt x m2 / dia' },
            { ambiente: 'DEPOSITO DE MATERIALES DEPORT.', uso: 'DEPOSITO', cantidad: 16.01, dotacion: '0.50 Lt x m2 / dia' },
            { ambiente: 'COMEDOR', uso: 'COMEDOR', cantidad: 118.06, dotacion: '40.00 Lt x m2 / dia' },
            { ambiente: 'BIBLIOTECA /AREA DE LIBROS', uso: 'OFICINA', cantidad: 93.8, dotacion: '6.00 Lt x m2 / dia' },
        ]
    },
    {
        modulos: [
            { ambiente: 'MODULO DE CONECTIVIDAD', uso: 'OFICINA', cantidad: 24.53, dotacion: '6.00 Lt x m2 / dia' },
        ]
    },
];

const DEFAULT_T3 = [
    { ambiente: 'JARDINES', uso: 'AREAS VERDES', cantidad: 533.06, dotacion: '2.00 Lt x m2 / dia' },
    { ambiente: 'DEPOSITO', uso: 'DEPOSITOS', cantidad: 137.36, dotacion: '0.50 Lt x m2 / dia' },
];

// ─────────────────────────────────────────────────────────────────────────────

const buildColumns = (isEdit, onDelete) => {
    const cols = [
        {
            title: 'AMBIENTE', field: 'ambiente',
            editor: isEdit ? 'input' : false,
            headerSort: false, widthGrow: 3,
            hozAlign: 'left',
        },
        {
            title: 'USO', field: 'uso',
            editor: isEdit ? 'list' : false,
            editorParams: isEdit ? { values: USO_LIST, autocomplete: true, listOnEmpty: true, freetext: true } : {},
            headerSort: false, widthGrow: 2, hozAlign: 'center',
        },
        {
            title: 'CANTIDAD', field: 'cantidad',
            editor: isEdit ? 'number' : false,
            editorParams: { min: 0, step: 0.1 },
            headerSort: false, widthGrow: 1, hozAlign: 'center',
            formatter: (cell) => {
                const value = toNum(cell.getValue()).toFixed(2);
                const dotacion = cell.getRow().getData().dotacion;
                if (String(dotacion).includes('m2')) return `${value} m2`;
                if (String(dotacion).includes('per')) return `${value} per`;
                return value; // For 'Lt /dia' dotation, quantity is just a number
            },
        },
        {
            title: 'DOTACION', field: 'dotacion',
            editor: isEdit ? 'list' : false,
            editorParams: isEdit ? { values: DOT_LIST, autocomplete: true, listOnEmpty: true } : {},
            headerSort: false, widthGrow: 2, hozAlign: 'center',
        },
        {
            title: 'CAUDAL', field: 'caudal',
            headerSort: false, widthGrow: 1.5, hozAlign: 'center',
            cssClass: 'font-semibold text-blue-600',
            formatter: (cell) => `${toNum(cell.getValue()).toFixed(2)} Lt/dia`,
            editable: false,
        },
    ];

    if (isEdit) {
        cols.push({
            title: '', field: '_del', headerSort: false, width: 40, hozAlign: 'center',
            formatter: () => '<span class="text-red-500 cursor-pointer text-lg">×</span>',
            cellClick: (_e, cell) => {
                if (confirm('¿Eliminar esta fila?')) {
                    onDelete(cell.getData()?.id);
                }
            },
            editable: false,
        });
    }
    return cols;
};

const DemandaDiaria = ({ initialData, canEdit, editMode, onChange }) => {
    const isEdit = !!(canEdit && editMode);

    // ── Internal State ──
    const [tabla1, setTabla1] = useState([]);
    const [tabla2, setTabla2] = useState([]);
    const [tabla3, setTabla3] = useState([]);

    // ── Refs ──
    const tabulatorsRef = useRef({}); // { t1, t3, p0, p1, ... }
    const tabla1Ref = useRef([]);
    const tabla2Ref = useRef([]);
    const tabla3Ref = useRef([]);
    const isEditRef = useRef(isEdit);
    const onChangeRef = useRef(onChange);
    const notifyTimer = useRef(null);

    // Sync refs for event handlers
    useEffect(() => { tabla1Ref.current = tabla1; }, [tabla1]);
    useEffect(() => { tabla2Ref.current = tabla2; }, [tabla2]);
    useEffect(() => { tabla3Ref.current = tabla3; }, [tabla3]);
    useEffect(() => { isEditRef.current = isEdit; }, [isEdit]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // ── Initialization & Remote Sync ──
    const loadData = useCallback((data) => {
        const t1 = (Array.isArray(data?.tabla1) ? data.tabla1 : DEFAULT_T1).map((r, i) => mkRow(r, '50.00 Lt x per / dia', `t1_${i}`));
        const t2 = (Array.isArray(data?.tabla2) ? data.tabla2 : DEFAULT_T2).map((p, i) => mkPiso(p, i));
        const t3 = (Array.isArray(data?.tabla3) ? data.tabla3 : DEFAULT_T3).map((r, i) => mkRow(r, '2.00 Lt x m2 / dia', `t3_${i}`));

        setTabla1(t1);
        setTabla2(t2);
        setTabla3(t3);

        // Update existing tabulators if they exist
        if (tabulatorsRef.current['t1']) tabulatorsRef.current['t1'].setData(t1);
        if (tabulatorsRef.current['t3']) tabulatorsRef.current['t3'].setData(t3);
        t2.forEach((piso, i) => {
            if (tabulatorsRef.current[`p${i}`]) tabulatorsRef.current[`p${i}`].setData(piso.modulos);
        });
    }, []);

    useEffect(() => {
        if (!initialData) {
            loadData({});
            return;
        }

        // Only sync from props if not in edit mode (to avoid conflicts)
        if (!isEdit) {
            loadData(initialData);
        }
    }, [initialData, isEdit, loadData]);

    const totalCaudal = useMemo(() => {
        const s1 = tabla1.reduce((s, r) => s + toNum(r.caudal), 0);
        const s2 = tabla2.reduce((s, p) => s + (p.modulos?.reduce((sm, m) => sm + toNum(m.caudal), 0) || 0), 0);
        const s3 = tabla3.reduce((s, r) => s + toNum(r.caudal), 0);
        return round2(s1 + s2 + s3);
    }, [tabla1, tabla2, tabla3]);

    const getLatestTotalCaudal = useCallback(() => {
        const t1 = tabulatorsRef.current['t1'] ? tabulatorsRef.current['t1'].getData() : tabla1Ref.current;
        const t2 = tabla2Ref.current; // Modulos are pulled during reduction below
        const t3 = tabulatorsRef.current['t3'] ? tabulatorsRef.current['t3'].getData() : tabla3Ref.current;

        const s1 = t1.reduce((s, r) => s + toNum(r.caudal), 0);
        const s2 = t2.reduce((s, p, i) => {
            const modulos = tabulatorsRef.current[`p_${p.id}`] ? tabulatorsRef.current[`p_${p.id}`].getData() : p.modulos;
            return s + (modulos?.reduce((sm, m) => sm + toNum(m.caudal), 0) || 0);
        }, 0);
        const s3 = t3.reduce((s, r) => s + toNum(r.caudal), 0);
        return round2(s1 + s2 + s3);
    }, []);

    // ── Notify Parent ──
    const notifyChange = useCallback(() => {
        if (!onChangeRef.current) return;

        const currentTotal = getLatestTotalCaudal();

        // Collect current data from tabulators if possible, else state
        const payload = {
            tabla1: tabulatorsRef.current['t1'] ? tabulatorsRef.current['t1'].getData() : tabla1Ref.current,
            tabla2: tabla2Ref.current.map((piso, i) => ({
                ...piso,
                modulos: tabulatorsRef.current[`p_${piso.id}`] ? tabulatorsRef.current[`p_${piso.id}`].getData() : piso.modulos
            })),
            tabla3: tabulatorsRef.current['t3'] ? tabulatorsRef.current['t3'].getData() : tabla3Ref.current,
            totalCaudal: currentTotal
        };

        // Dispatch global event for other components (Cisterna, Tanque)
        document.dispatchEvent(new CustomEvent('demanda-diaria-updated', { detail: payload }));

        onChangeRef.current(payload);
    }, [getLatestTotalCaudal]);

    const scheduleNotify = useCallback(() => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        notifyTimer.current = setTimeout(notifyChange, 500);
    }, [notifyChange]);

    // Initial notification after load
    useEffect(() => {
        if (tabla1.length || tabla2.length || tabla3.length) {
            const t = setTimeout(notifyChange, 1000);
            return () => clearTimeout(t);
        }
    }, [tabla1.length, tabla2.length, tabla3.length, notifyChange]);

    // ── Tabulator Lifecycle ──
    const initTable = useCallback((key, elementId, data, onDelete) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        if (tabulatorsRef.current[key]) {
            try { tabulatorsRef.current[key].destroy(); } catch (_) { }
        }

        const table = new Tabulator(el, {
            data: data,
            index: 'id',
            layout: 'fitColumns',
            headerSort: false,
            columns: buildColumns(isEditRef.current, onDelete),
        });

        table.on('cellEdited', (cell) => {
            const row = cell.getRow();
            const updated = { ...row.getData() };
            updated.caudal = calcCaudal(updated);
            row.update({ caudal: updated.caudal });

            // Sync state based on key
            if (key === 't1') setTabla1(table.getData());
            else if (key === 't3') setTabla3(table.getData());
            else if (key.startsWith('p')) {
                const pIdx = parseInt(key.substring(1));
                setTabla2(prev => prev.map((p, i) => i === pIdx ? { ...p, modulos: table.getData() } : p));
            }

            scheduleNotify();
        });

        tabulatorsRef.current[key] = table;
    }, [scheduleNotify]);

    // Initialize/Update T1 & T3
    useEffect(() => {
        if (tabla1.length && !tabulatorsRef.current['t1']) initTable('t1', 'tbl-t1', tabla1, (id) => removeRow('t1', id));
        if (tabla3.length && !tabulatorsRef.current['t3']) initTable('t3', 'tbl-t3', tabla3, (id) => removeRow('t3', id));
    }, [tabla1.length, tabla3.length, initTable]);

    // Initialize floor tables
    useEffect(() => {
        tabla2.forEach((piso) => {
            const key = `p_${piso.id}`;
            const elId = `tbl-p-${piso.id}`;
            if (!tabulatorsRef.current[key]) {
                initTable(key, elId, piso.modulos, (id) => removeRow(key, id));
            }
        });
    }, [tabla2, initTable]);

    // Handle isEdit toggle without destroying
    useEffect(() => {
        Object.keys(tabulatorsRef.current).forEach(key => {
            const tab = tabulatorsRef.current[key];
            if (!tab) return;
            const onDelete = (id) => removeRow(key, id);
            tab.setColumns(buildColumns(isEdit, onDelete));
        });
    }, [isEdit]);

    // ── Mutators ──
    const addRow = (type) => {
        if (type === 't1') {
            const nr = mkRow({}, '50.00 Lt x per / dia', 't1');
            setTabla1(p => [...p, nr]);
            if (tabulatorsRef.current['t1']) tabulatorsRef.current['t1'].addRow(nr);
        } else if (type === 't3') {
            const nr = mkRow({}, '2.00 Lt x m2 / dia', 't3');
            setTabla3(p => [...p, nr]);
            if (tabulatorsRef.current['t3']) tabulatorsRef.current['t3'].addRow(nr);
        }
        scheduleNotify();
    };

    const removeRow = (key, id) => {
        if (key === 't1') {
            setTabla1(p => p.filter(r => r.id !== id));
            if (tabulatorsRef.current['t1']) tabulatorsRef.current['t1'].deleteRow(id);
        } else if (key === 't3') {
            setTabla3(p => p.filter(r => r.id !== id));
            if (tabulatorsRef.current['t3']) tabulatorsRef.current['t3'].deleteRow(id);
        } else if (key.startsWith('p_')) {
            const pisoId = key.substring(2);
            setTabla2(prev => prev.map((p) => p.id === pisoId ? { ...p, modulos: p.modulos.filter(m => m.id !== id) } : p));
            if (tabulatorsRef.current[key]) tabulatorsRef.current[key].deleteRow(id);
        }
        scheduleNotify();
    };

    const addPiso = () => {
        const np = mkPiso({ modulos: [] }, tabla2.length);
        setTabla2(p => [...p, np]);
        scheduleNotify();
    };

    const removePiso = (pisoId) => {
        if (confirm('¿Eliminar todo este piso?')) {
            const key = `p_${pisoId}`;
            if (tabulatorsRef.current[key]) {
                tabulatorsRef.current[key].destroy();
                delete tabulatorsRef.current[key];
            }
            setTabla2(p => p.filter((piso) => piso.id !== pisoId));
            scheduleNotify();
        }
    };

    const addModulo = (pisoId) => {
        const nr = mkRow({}, '0.50 Lt x m2 / dia', `p${pisoId}m`);
        setTabla2(prev => prev.map((p) => p.id === pisoId ? { ...p, modulos: [...p.modulos, nr] } : p));
        const key = `p_${pisoId}`;
        if (tabulatorsRef.current[key]) tabulatorsRef.current[key].addRow(nr);
        scheduleNotify();
    };


    // Cleanup
    useEffect(() => () => {
        if (notifyTimer.current) clearTimeout(notifyTimer.current);
        Object.values(tabulatorsRef.current).forEach(t => { try { t.destroy(); } catch (_) { } });
        tabulatorsRef.current = {};
    }, []);

    // ── Render ──
    return (
        <div className="w-full p-4 max-w-7xl mx-auto space-y-6">
            <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden sticky top-1 z-50">
                <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white dark:from-slate-800/50 dark:to-slate-900">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
                            <i className="fas fa-water text-white text-xl"></i>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">1. CÁLCULO DE LA DEMANDA DIARIA</h1>
                            <p className="text-xs text-slate-500 font-medium">Consumo proyectado de agua según RNE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isEdit ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                            <span className={`w-2 h-2 rounded-full ${isEdit ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isEdit ? 'Modo Edición' : 'Vista de Lectura'}
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {/* Section 1 */}
                <Section title="PERSONAL Y ALUMNADO" icon="fas fa-users" color="blue">
                    <div id="tbl-t1" className="tabulator-custom border-0" />
                    {isEdit && <AddBtn onClick={() => addRow('t1')} label="Agregar Personal" color="blue" />}
                </Section>

                {/* Section 2 */}
                <Section title="MÓDULOS DE ARQUITECTURA (PISOS)" icon="fas fa-building" color="green">
                    <div className="space-y-6">
                        {tabla2.map((piso, i) => (
                            <div key={piso.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 transition-all hover:shadow-md">
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                                            {i + 1}
                                        </div>
                                        NIVEL / PISO {i + 1}
                                    </h3>
                                    {isEdit && (
                                        <button onClick={() => removePiso(piso.id)} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                                            <i className="fas fa-trash-alt"></i> Eliminar Piso
                                        </button>
                                    )}
                                </div>
                                <div id={`tbl-p-${piso.id}`} className="tabulator-custom border-0 mb-4" />
                                {isEdit && <AddBtn onClick={() => addModulo(piso.id)} label="Agregar Ambiente" color="blue" />}
                            </div>
                        ))}

                        {isEdit && (
                            <button onClick={addPiso} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 font-semibold">
                                <i className="fas fa-plus-circle text-lg"></i> Añadir Nuevo Nivel o Piso
                            </button>
                        )}
                    </div>
                </Section>

                {/* Section 3 */}
                <Section title="PLANTAS GENERALES Y JARDINES" icon="fas fa-leaf" color="purple">
                    <div id="tbl-t3" className="tabulator-custom border-0" />
                    {isEdit && <AddBtn onClick={() => addRow('t3')} label="Agregar Planta" color="purple" />}
                </Section>
            </div>

            {/* Resume Card */}
            <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 transition-all group-hover:bg-blue-500/20" />
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center md:text-left">
                        <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.2em]">Resultado Final</p>
                        <h2 className="text-2xl font-light">Volumen de Demanda <span className="font-bold text-white">Diaria Total</span></h2>
                    </div>
                    <div className="flex flex-col items-center md:items-end">
                        <div className="text-5xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                            {totalCaudal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Litros / Día</div>
                    </div>
                </div>
            </div>

            <style>{`
                .tabulator-custom { font-family: inherit !important; border-radius: 12px !important; overflow: hidden !important; border: 1px solid #e2e8f0 !important; }
                .tabulator-custom .tabulator-header { background-color: #f8fafc !important; color: #475569 !important; font-weight: 700 !important; border-bottom: 1px solid #e2e8f0 !important; }
                .tabulator-custom .tabulator-cell { padding: 12px 8px !important; border-right: 1px solid #f1f5f9 !important; }
                .tabulator-custom .tabulator-row { background: white !important; transition: background 0.2s; }
                .tabulator-custom .tabulator-row:hover { background-color: #f1f5f9 !important; }
                .tabulator-custom .tabulator-row-even { background-color: #fafafa !important; }
            `}</style>
        </div>
    );
};

// ─── Sub-components ───

const Section = ({ title, icon, color, children }) => {
    const colorClasses = {
        blue: 'from-blue-600 to-blue-700',
        green: 'from-emerald-600 to-teal-700',
        purple: 'from-indigo-600 to-purple-700'
    };

    return (
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className={`bg-gradient-to-r ${colorClasses[color]} px-6 py-4`}>
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <i className={`${icon} opacity-80`}></i>
                    {title}
                </h2>
            </div>
            <div className="p-6">{children}</div>
        </section>
    );
};

const AddBtn = ({ onClick, label, color }) => {
    const colorClasses = {
        blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
        green: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
        purple: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
    };

    return (
        <button onClick={onClick} className={`${colorClasses[color]} text-white px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-lg hover:-translate-y-0.5 mt-4`}>
            <i className="fas fa-plus-circle"></i> {label}
        </button>
    );
};

 export default DemandaDiaria;

