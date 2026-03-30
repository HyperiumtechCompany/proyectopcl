import { router, usePage } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface PageProps { moduleTypes: string[]; [key: string]: unknown; }
interface UbigeoItem { id: string; nombre: string; }

const MODULE_LABELS: Record<string, string> = {
    metrado_arquitectura: 'Arquitectura',
    metrado_estructura: 'Estructura',
    metrado_sanitarias: 'Sanitarias',
    metrado_electricas: 'Eléctricas',
    metrado_comunicaciones: 'Comunicaciones',
    metrado_gas: 'Gas',
    crono_general: 'Cronograma General',
    crono_valorizado: 'Cronograma Valorizado',
    crono_materiales: 'Cronograma Materiales',
    presupuesto: 'Presupuesto',
    presupuesto_gg: 'Gastos Generales',
    presupuesto_insumos: 'Insumos',
    presupuesto_remuneraciones: 'Remuneraciones',
    presupuesto_acus: 'ACUs',
    presupuesto_indice: 'Índice',
    etts: 'ETTs',
};

const MODULE_ICONS: Record<string, string> = {
    metrado_arquitectura: '🏛️', metrado_estructura: '🏗️',
    metrado_sanitarias: '🔧', metrado_electricas: '⚡',
    metrado_comunicaciones: '📡', metrado_gas: '🔥',
    crono_general: '📅', crono_valorizado: '💰',
    crono_materiales: '📦', presupuesto: '🧾',
    presupuesto_gg: '📋', presupuesto_insumos: '🔩',
    presupuesto_remuneraciones: '👷', presupuesto_acus: '📊',
    presupuesto_indice: '📈', etts: '📝',
};

const MODULE_GROUPS = [
    { label: 'Metrados', prefix: 'metrado_', exact: false, color: 'blue' },
    { label: 'Cronogramas', prefix: 'crono_', exact: false, color: 'violet' },
    { label: 'Presupuesto', prefix: 'presupuesto', exact: true, color: 'emerald' },
    { label: 'ETTs', prefix: 'etts', exact: true, color: 'orange' },
];

const GROUP_STYLES: Record<string, { header: string; badge: string; check: string; card: string }> = {
    blue:    { header: 'bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-800/50', badge: 'bg-blue-600', check: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-700', card: 'border-blue-400 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/30' },
    violet:  { header: 'bg-violet-50 border-violet-100 dark:bg-violet-950/30 dark:border-violet-800/50', badge: 'bg-violet-600', check: 'text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/40 dark:border-violet-700', card: 'border-violet-400 bg-violet-50/80 dark:border-violet-500 dark:bg-violet-950/30' },
    emerald: { header: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800/50', badge: 'bg-emerald-600', check: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700', card: 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/30' },
    orange:  { header: 'bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-800/50', badge: 'bg-orange-600', check: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-700', card: 'border-orange-400 bg-orange-50/80 dark:border-orange-500 dark:bg-orange-950/30' },
};

const STEPS = [
    { n: 1, label: 'Información General', desc: 'Datos del proyecto' },
    { n: 2, label: 'Módulos', desc: 'Selección de hojas' },
    { n: 3, label: 'Exportación', desc: 'Logos y Firma' },
    { n: 4, label: 'Resumen', desc: 'Revisión y creación' },
];

// ── Pre-carga de datos de ejemplo ──────────────────────────────────────────
const DEMO = {
    nombre: 'I.E. Nº 32004 "San Pedro" – Huánuco',
    uei: 'UEI - GRHCO',
    unidadEjecutora: 'Gobierno Regional de Huánuco',
    codigoSnip: '456123',
    codigoCui: '2458710',
    codigoLocal: 'HCO-001',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
};

export default function Create() {
    const { moduleTypes } = usePage<PageProps>().props;
    const [step, setStep] = useState(1);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isDemoLoaded, setIsDemoLoaded] = useState(false);

    // Step 1 fields
    const [nombre, setNombre] = useState('');
    const [uei, setUei] = useState('');
    const [unidadEjecutora, setUnidadEjecutora] = useState('');
    const [codigoSnip, setCodigoSnip] = useState('');
    const [codigoCui, setCodigoCui] = useState('');
    const [codigoLocal, setCodigoLocal] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    // Códigos modulares
    const [cmInicial, setCmInicial] = useState(false);
    const [cmPrimaria, setCmPrimaria] = useState(false);
    const [cmSecundaria, setCmSecundaria] = useState(false);
    const [cmInicialVal, setCmInicialVal] = useState('');
    const [cmPrimariaVal, setCmPrimariaVal] = useState('');
    const [cmSecundariaVal, setCmSecundariaVal] = useState('');

    // Ubicación
    const [departamentos, setDepartamentos] = useState<UbigeoItem[]>([]);
    const [provincias, setProvincias] = useState<UbigeoItem[]>([]);
    const [distritos, setDistritos] = useState<UbigeoItem[]>([]);
    const [depId, setDepId] = useState('');
    const [provId, setProvId] = useState('');
    const [distId, setDistId] = useState('');
    const [centroPoblado, setCentroPoblado] = useState('');

    // Step 2 fields
    const [selectedModules, setSelectedModules] = useState<string[]>([]);
    const [sanitariasModulos, setSanitariasModulos] = useState(3);

    // Step 3 fields (Exportación)
    const [plantillaLogoIzq, setPlantillaLogoIzq] = useState<File | null>(null);
    const [plantillaLogoDer, setPlantillaLogoDer] = useState<File | null>(null);
    const [plantillaPortada, setPlantillaPortada] = useState<File | null>(null);
    const [plantillaFirma, setPlantillaFirma] = useState<File | null>(null);

    useEffect(() => {
        fetch('/api/ubigeo/departamentos').then(r => r.json()).then(setDepartamentos).catch(() => { });
    }, []);

    useEffect(() => {
        setProvincias([]); setDistritos([]); setProvId(''); setDistId('');
        if (depId) fetch(`/api/ubigeo/provincias/${depId}`).then(r => r.json()).then(setProvincias).catch(() => { });
    }, [depId]);

    useEffect(() => {
        setDistritos([]); setDistId('');
        if (provId) fetch(`/api/ubigeo/distritos/${provId}`).then(r => r.json()).then(setDistritos).catch(() => { });
    }, [provId]);

    const loadDemo = () => {
        setNombre(DEMO.nombre);
        setUei(DEMO.uei);
        setUnidadEjecutora(DEMO.unidadEjecutora);
        setCodigoSnip(DEMO.codigoSnip);
        setCodigoCui(DEMO.codigoCui);
        setCodigoLocal(DEMO.codigoLocal);
        setFechaInicio(DEMO.fechaInicio);
        setFechaFin(DEMO.fechaFin);
        setCmPrimaria(true); setCmPrimariaVal('0547832');
        setCmSecundaria(true); setCmSecundariaVal('0548901');
        setIsDemoLoaded(true);
    };

    const toggleModule = (m: string) =>
        setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

    const toggleGroup = (items: string[]) => {
        const allSelected = items.every(m => selectedModules.includes(m));
        if (allSelected) setSelectedModules(prev => prev.filter(m => !items.includes(m)));
        else setSelectedModules(prev => [...new Set([...prev, ...items])]);
    };

    const goStep2 = () => {
        if (!nombre.trim()) { setErrors({ nombre: 'El nombre del proyecto es requerido' }); return; }
        setErrors({});
        setStep(2);
    };

    const goStep3 = () => {
        if (selectedModules.length === 0) { setErrors({ modules: 'Selecciona al menos un módulo' }); return; }
        setErrors({});
        setStep(3);
    };

    const goStep4 = () => {
        setErrors({});
        setStep(4);
    };

    const handleSubmit = () => {
        setProcessing(true);
        const codigos_modulares: Record<string, string> = {};
        if (cmInicial && cmInicialVal) codigos_modulares.inicial = cmInicialVal;
        if (cmPrimaria && cmPrimariaVal) codigos_modulares.primaria = cmPrimariaVal;
        if (cmSecundaria && cmSecundariaVal) codigos_modulares.secundaria = cmSecundariaVal;

        const needsModulosConfig =
            selectedModules.includes('metrado_arquitectura') ||
            selectedModules.includes('metrado_estructura') ||
            selectedModules.includes('metrado_sanitarias');

        router.post('/costos', {
            nombre, uei, unidad_ejecutora: unidadEjecutora,
            codigo_snip: codigoSnip, codigo_cui: codigoCui, codigo_local: codigoLocal,
            fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null,
            codigos_modulares: Object.keys(codigos_modulares).length > 0 ? codigos_modulares : null,
            departamento_id: depId || null, provincia_id: provId || null,
            distrito_id: distId || null, centro_poblado: centroPoblado || null,
            modules: selectedModules,
            sanitarias_cantidad_modulos: needsModulosConfig ? sanitariasModulos : null,
            plantilla_logo_izq: plantillaLogoIzq,
            plantilla_logo_der: plantillaLogoDer,
            portada_logo_center: plantillaPortada,
            plantilla_firma: plantillaFirma,
        }, {
            onFinish: () => setProcessing(false),
            onError: (e) => { setErrors(e as Record<string, string>); setStep(1); },
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: 'Nuevo Proyecto', href: '/costos/create' },
    ];

    const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400";
    const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
    const selectCls = `${inputCls} cursor-pointer`;

    const needsModulosConfig =
        selectedModules.includes('metrado_arquitectura') ||
        selectedModules.includes('metrado_estructura') ||
        selectedModules.includes('metrado_sanitarias');

    // Summary grouped data
    const modulesByGroup = MODULE_GROUPS.map(g => ({
        ...g,
        items: (g.exact
            ? moduleTypes.filter(m => m === g.prefix)
            : moduleTypes.filter(m => m.startsWith(g.prefix))
        ).filter(m => selectedModules.includes(m)),
    })).filter(g => g.items.length > 0);

    const codigos: { label: string; value: string }[] = [
        ...(codigoSnip ? [{ label: 'SNIP', value: codigoSnip }] : []),
        ...(codigoCui ? [{ label: 'CUI', value: codigoCui }] : []),
        ...(codigoLocal ? [{ label: 'Local', value: codigoLocal }] : []),
    ];

    const codigosModulares = [
        ...(cmInicial && cmInicialVal ? [{ nivel: 'Inicial', code: cmInicialVal }] : []),
        ...(cmPrimaria && cmPrimariaVal ? [{ nivel: 'Primaria', code: cmPrimariaVal }] : []),
        ...(cmSecundaria && cmSecundariaVal ? [{ nivel: 'Secundaria', code: cmSecundariaVal }] : []),
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
                <div className="mx-auto w-full max-w-8xl px-6 py-8">

                    {/* ── PAGE HEADER ─────────────────────────────────────── */}
                    <div className="mb-8 flex items-start justify-between">
                        <div>
                            <div className="mb-1 flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">Nuevo Proyecto</span>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registro de Proyecto de Costos</h1>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Complete los datos del expediente técnico para continuar.</p>
                        </div>

                        {/* Demo data button */}
                        {step === 1 && (
                            <button
                                onClick={loadDemo}
                                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition
                                    ${isDemoLoaded
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                            >
                                {isDemoLoaded ? (
                                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Datos cargados</>
                                ) : (
                                    <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Cargar datos de ejemplo</>
                                )}
                            </button>
                        )}
                    </div>

                    {/* ── STEPPER ─────────────────────────────────────────── */}
                    <div className="mb-8">
                        <div className="relative flex items-center justify-between">
                            {/* Progress line background */}
                            <div className="absolute left-0 top-5 h-0.5 w-full bg-gray-200 dark:bg-gray-700" />
                            {/* Progress line active */}
                            <div
                                className="absolute left-0 top-5 h-0.5 bg-blue-600 transition-all duration-500 dark:bg-blue-500"
                                style={{ width: step === 1 ? '0%' : step === 2 ? '33.33%' : step === 3 ? '66.66%' : '100%' }}
                            />
                            {STEPS.map(s => (
                                <div key={s.n} className="relative z-10 flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => { if (s.n < step) setStep(s.n); }}
                                        disabled={s.n >= step}
                                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300
                                            ${step > s.n
                                                ? 'cursor-pointer border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                                                : step === s.n
                                                    ? 'border-blue-600 bg-white text-blue-600 shadow-lg shadow-blue-100 dark:bg-gray-900 dark:shadow-blue-900/30'
                                                    : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'}`}
                                    >
                                        {step > s.n
                                            ? <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                            : s.n}
                                    </button>
                                    <div className="text-center">
                                        <p className={`text-xs font-bold ${step >= s.n ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{s.label}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-600">{s.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── STEP 1: INFORMACIÓN GENERAL ─────────────────────── */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                            {/* LEFT COLUMN */}
                            <div className="lg:col-span-2 space-y-5">

                                {/* Card: Nombre */}
                                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Identificación del Proyecto</h3>
                                            <p className="text-xs text-gray-500">Datos principales del expediente</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelCls}>Nombre del Proyecto <span className="normal-case text-red-500">*</span></label>
                                            <input
                                                type="text" value={nombre} onChange={e => { setNombre(e.target.value); setErrors(p => ({ ...p, nombre: '' })); }}
                                                placeholder="Ej: I.E. Nº 32004 – San Pedro, Huánuco"
                                                className={`${inputCls} ${errors.nombre ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
                                            />
                                            {errors.nombre && (
                                                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                                                    <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                    {errors.nombre}
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>UEI</label>
                                                <input type="text" value={uei} onChange={e => setUei(e.target.value)} placeholder="Unidad Ejecutora de Inversiones" className={inputCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Unidad Ejecutora</label>
                                                <input type="text" value={unidadEjecutora} onChange={e => setUnidadEjecutora(e.target.value)} placeholder="Entidad ejecutora" className={inputCls} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Código SNIP', value: codigoSnip, set: setCodigoSnip, ph: '000000' },
                                                { label: 'Código CUI',  value: codigoCui,  set: setCodigoCui,  ph: '0000000' },
                                                { label: 'Código Local',value: codigoLocal,set: setCodigoLocal, ph: 'HCO-000' },
                                            ].map(({ label, value, set, ph }) => (
                                                <div key={label}>
                                                    <label className={labelCls}>{label}</label>
                                                    <input type="text" value={value} onChange={e => set(e.target.value)} placeholder={ph} className={inputCls} />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Fecha de Inicio</label>
                                                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Fecha de Fin</label>
                                                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputCls} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card: Ubicación */}
                                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Ubicación Geográfica</h3>
                                            <p className="text-xs text-gray-500">Ubigeo y localización del proyecto</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={labelCls}>Departamento</label>
                                            <select value={depId} onChange={e => setDepId(e.target.value)} className={selectCls}>
                                                <option value="">Seleccionar…</option>
                                                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Provincia</label>
                                            <select value={provId} onChange={e => setProvId(e.target.value)} className={selectCls} disabled={!depId}>
                                                <option value="">Seleccionar…</option>
                                                {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Distrito</label>
                                            <select value={distId} onChange={e => setDistId(e.target.value)} className={selectCls} disabled={!provId}>
                                                <option value="">Seleccionar…</option>
                                                {distritos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className={labelCls}>Centro Poblado</label>
                                        <input type="text" value={centroPoblado} onChange={e => setCentroPoblado(e.target.value)} placeholder="Nombre del centro poblado" className={inputCls} />
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN */}
                            <div className="space-y-5">

                                {/* Card: Códigos Modulares */}
                                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                                            <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Códigos Modulares</h3>
                                            <p className="text-xs text-gray-500">Por nivel educativo</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {([
                                            ['Inicial',    cmInicial,    setCmInicial,    cmInicialVal,    setCmInicialVal],
                                            ['Primaria',   cmPrimaria,   setCmPrimaria,   cmPrimariaVal,   setCmPrimariaVal],
                                            ['Secundaria', cmSecundaria, setCmSecundaria, cmSecundariaVal, setCmSecundariaVal],
                                        ] as const).map(([label, checked, setChecked, val, setVal]) => (
                                            <div key={label} className={`rounded-lg border p-3 transition-all duration-200 ${checked ? 'border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${checked ? 'border-violet-600 bg-violet-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                            {checked && <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <input type="checkbox" checked={checked as boolean} onChange={e => (setChecked as (v: boolean) => void)(e.target.checked)} className="sr-only" />
                                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                                                    </div>
                                                    {checked && <span className="text-xs text-violet-500 dark:text-violet-400">activo</span>}
                                                </label>
                                                {checked && (
                                                    <div className="mt-2.5">
                                                        <input
                                                            type="text" value={val as string}
                                                            onChange={e => (setVal as (v: string) => void)(e.target.value)}
                                                            placeholder="Código modular…"
                                                            className={`${inputCls} text-xs`}
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Card: Tips */}
                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/20">
                                    <div className="flex gap-3">
                                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <div>
                                            <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Campos opcionales</p>
                                            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">Los campos de códigos y ubicación son referenciales. Solo el nombre del proyecto es obligatorio para continuar.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={goStep2}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] dark:shadow-blue-900/30"
                                    >
                                        Continuar a Módulos
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: MÓDULOS ─────────────────────────────────── */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                            {/* LEFT: Module selection */}
                            <div className="lg:col-span-2 space-y-4">

                                {/* Config panel */}
                                {needsModulosConfig && (
                                    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl dark:bg-amber-900/50">⚙️</div>
                                            <div className="flex-1">
                                                <div className="mb-0.5 flex items-center gap-2">
                                                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">Configuración de Módulos Estructurales</h3>
                                                </div>
                                                <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">Cantidad de hojas para: Arquitectura, Estructura y Sanitarias</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center rounded-lg border border-amber-300 bg-white overflow-hidden dark:border-amber-700 dark:bg-gray-800">
                                                        <button type="button" onClick={() => setSanitariasModulos(v => Math.max(1, v - 1))} className="flex h-9 w-9 items-center justify-center text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30 transition font-bold text-lg">−</button>
                                                        <input
                                                            type="number" min={1} max={50} value={sanitariasModulos}
                                                            onChange={e => setSanitariasModulos(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                                            className="w-14 border-x border-amber-200 bg-white py-2 text-center text-sm font-bold text-gray-800 focus:outline-none dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100"
                                                        />
                                                        <button type="button" onClick={() => setSanitariasModulos(v => Math.min(50, v + 1))} className="flex h-9 w-9 items-center justify-center text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30 transition font-bold text-lg">+</button>
                                                    </div>
                                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">módulos / máx. 50</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Module groups */}
                                {MODULE_GROUPS.map(g => {
                                    const items = g.exact
                                        ? moduleTypes.filter(m => m === g.prefix)
                                        : moduleTypes.filter(m => m.startsWith(g.prefix));
                                    if (items.length === 0) return null;

                                    const selectedInGroup = items.filter(m => selectedModules.includes(m));
                                    const allSelected = selectedInGroup.length === items.length;
                                    const st = GROUP_STYLES[g.color];

                                    return (
                                        <div key={g.label} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${st.header}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-white text-xs font-bold ${st.badge}`}>{selectedInGroup.length}</span>
                                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{g.label}</span>
                                                    <span className="text-xs text-gray-400">— {items.length} disponibles</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(items)}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition"
                                                >
                                                    {allSelected ? 'Quitar todos' : 'Marcar todos'}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
                                                {items.map(m => {
                                                    const active = selectedModules.includes(m);
                                                    return (
                                                        <label
                                                            key={m}
                                                            className={`group flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium transition-all duration-150
                                                                ${active ? st.card : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                                                        >
                                                            <span className="text-base leading-none">{MODULE_ICONS[m] || '📄'}</span>
                                                            <span className="leading-tight">{MODULE_LABELS[m] || m}</span>
                                                            <input type="checkbox" checked={active} onChange={() => toggleModule(m)} className="sr-only" />
                                                            {active && (
                                                                <svg className="ml-auto h-4 w-4 shrink-0 text-current" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {errors.modules && (
                                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        {errors.modules}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT: Live summary sidebar */}
                            <div className="space-y-4">
                                <div className="sticky top-6 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Módulos seleccionados</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">Vista previa en tiempo real</p>
                                    </div>

                                    <div className="p-5">
                                        {selectedModules.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                                                </div>
                                                <p className="text-xs font-medium text-gray-500">Sin módulos seleccionados</p>
                                                <p className="text-xs text-gray-400 mt-1">Selecciona al menos uno</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {MODULE_GROUPS.map(g => {
                                                    const sel = (g.exact
                                                        ? moduleTypes.filter(m => m === g.prefix)
                                                        : moduleTypes.filter(m => m.startsWith(g.prefix))
                                                    ).filter(m => selectedModules.includes(m));
                                                    if (sel.length === 0) return null;
                                                    const st = GROUP_STYLES[g.color];
                                                    return (
                                                        <div key={g.label}>
                                                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{g.label}</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {sel.map(m => (
                                                                    <span key={m} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${st.check}`}>
                                                                        <span className="text-[10px]">{MODULE_ICONS[m] || '📄'}</span>
                                                                        {MODULE_LABELS[m] || m}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-500">Total de módulos</span>
                                                        <span className="font-bold text-gray-900 dark:text-white">{selectedModules.length}</span>
                                                    </div>
                                                    {needsModulosConfig && (
                                                        <div className="mt-1.5 flex items-center justify-between text-xs">
                                                            <span className="text-gray-500">Hojas estructurales</span>
                                                            <span className="font-bold text-amber-600 dark:text-amber-400">{sanitariasModulos} / módulo</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Navigation */}
                                <div className="space-y-2">
                                    <button
                                        onClick={goStep3}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60 dark:shadow-blue-900/30"
                                    >
                                        Continuar a Exportación
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setStep(1)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        Volver
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: EXPORTACIÓN ─────────────────────────────────── */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-2 space-y-5">
                                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                                            <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Plantillas de Exportación</h3>
                                            <p className="text-xs text-gray-500">Logos y firmas para Word, Excel y PDF</p>
                                        </div>
                                    </div>
                                    
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 mb-5 dark:border-blue-900/50 dark:bg-blue-950/20">
                                        <div className="flex gap-3">
                                            <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <div>
                                                <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Configura una vez, úsalo siempre</p>
                                                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">Estas imágenes se aplicarán de forma automática a todos los módulos de Excel, Word (ETTP), y PDF exportados del proyecto. Si no cuentas con ellas ahora, puedes configurarlas más tarde.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            { label: 'Logo Izquierdo (Cabecera)', state: plantillaLogoIzq, setState: setPlantillaLogoIzq, id: 'logo_izq', desc: 'Aparece en la parte superior izquierda de los reportes.' },
                                            { label: 'Logo Derecho / Escudo (Cabecera)', state: plantillaLogoDer, setState: setPlantillaLogoDer, id: 'logo_der', desc: 'Aparece en la parte superior derecha (opcional).' },
                                            { label: 'Portada (Imagen Principal)', state: plantillaPortada, setState: setPlantillaPortada, id: 'portada', desc: 'Imagen central para la portada del proyecto.' },
                                            { label: 'Firma (Pie de página)', state: plantillaFirma, setState: setPlantillaFirma, id: 'firma', desc: 'Firma digital para el pie de página de los documentos.' },
                                        ].map((item) => (
                                            <div key={item.id} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className={labelCls}>{item.label}</label>
                                                    <span className="text-[10px] text-gray-400 italic">{item.desc}</span>
                                                </div>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={e => item.setState(e.target.files?.[0] || null)}
                                                            className={`${inputCls} py-2!`}
                                                            id={item.id}
                                                        />
                                                        {item.state && (
                                                            <button
                                                                onClick={() => item.setState(null)}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {item.state && (
                                                        <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20">
                                                            <img
                                                                src={URL.createObjectURL(item.state)}
                                                                alt="Preview"
                                                                className="h-full w-full object-contain p-1"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumen Imágenes</h3>
                                    <div className="space-y-3 text-sm">
                                        {[
                                            { label: 'Logo Izquierdo', state: plantillaLogoIzq },
                                            { label: 'Logo Derecho/Escudo', state: plantillaLogoDer },
                                            { label: 'Portada', state: plantillaPortada },
                                            { label: 'Firma Pie pág.', state: plantillaFirma },
                                        ].map((img) => (
                                            <div key={img.label} className="flex items-center justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">{img.label}</span>
                                                <span className={`font-bold ${img.state ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                    {img.state ? 'Adjunto' : 'Pendiente'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Navigation */}
                                <div className="space-y-2">
                                    <button
                                        onClick={goStep4}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60 dark:shadow-blue-900/30"
                                    >
                                        Ver Resumen General
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setStep(2)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        Volver a Módulos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: RESUMEN ─────────────────────────────────── */}
                    {step === 4 && (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                            {/* Summary */}
                            <div className="lg:col-span-2 space-y-5">

                                {/* Project info summary */}
                                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Información del Proyecto</h3>
                                        </div>
                                        <button onClick={() => setStep(1)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">Editar</button>
                                    </div>

                                    <div className="p-6">
                                        <div className="mb-5">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Nombre del proyecto</p>
                                            <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">{nombre || '—'}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                                            {[
                                                { label: 'UEI', value: uei },
                                                { label: 'Unidad Ejecutora', value: unidadEjecutora },
                                                { label: 'Fecha Inicio', value: fechaInicio },
                                                { label: 'Fecha Fin', value: fechaFin },
                                            ].map(({ label, value }) => value ? (
                                                <div key={label}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                                                    <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                                                </div>
                                            ) : null)}
                                        </div>

                                        {codigos.length > 0 && (
                                            <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                                                {codigos.map(c => (
                                                    <span key={c.label} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs dark:border-gray-700 dark:bg-gray-800">
                                                        <span className="font-bold text-gray-500 dark:text-gray-400">{c.label}</span>
                                                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{c.value}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {codigosModulares.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {codigosModulares.map(c => (
                                                    <span key={c.nivel} className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1 text-xs dark:border-violet-800/50 dark:bg-violet-950/20">
                                                        <span className="font-bold text-violet-600 dark:text-violet-400">{c.nivel}</span>
                                                        <span className="font-mono text-violet-800 dark:text-violet-300">{c.code}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Modules summary */}
                                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                                <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Módulos del Proyecto</h3>
                                                <p className="text-xs text-gray-500">{selectedModules.length} módulos seleccionados</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setStep(2)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">Editar</button>
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {modulesByGroup.map(g => {
                                            const st = GROUP_STYLES[g.color];
                                            return (
                                                <div key={g.label} className="px-6 py-4">
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-white text-[10px] font-bold ${st.badge}`}>{g.items.length}</span>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">{g.label}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                        {g.items.map(m => (
                                                            <div key={m} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${st.check}`}>
                                                                <span className="text-sm">{MODULE_ICONS[m] || '📄'}</span>
                                                                <span className="truncate">{MODULE_LABELS[m] || m}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {needsModulosConfig && (
                                        <div className="border-t border-amber-100 bg-amber-50 px-6 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                                                <span>⚙️</span>
                                                <span><strong>{sanitariasModulos}</strong> hojas por módulo estructural (Arquitectura / Estructura / Sanitarias)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Images summary */}
                                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                                                <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Imágenes de Exportación</h3>
                                        </div>
                                        <button onClick={() => setStep(3)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">Editar</button>
                                    </div>

                                    <div className="p-6">
                                        {!(plantillaLogoIzq || plantillaLogoDer || plantillaPortada || plantillaFirma) ? (
                                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                                <p className="text-xs text-gray-500 italic">No se han seleccionado imágenes opcionales.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                                {[
                                                    { label: 'Logo Izquierdo', state: plantillaLogoIzq },
                                                    { label: 'Logo Derecho', state: plantillaLogoDer },
                                                    { label: 'Portada', state: plantillaPortada },
                                                    { label: 'Firma', state: plantillaFirma },
                                                ].map((img, i) => img.state && (
                                                    <div key={i} className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-center">{img.label}</p>
                                                        <div className="relative h-24 w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
                                                            <img
                                                                src={URL.createObjectURL(img.state)}
                                                                alt={img.label}
                                                                className="h-full w-full object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Action panel */}
                            <div className="space-y-4">
                                <div className="sticky top-6 space-y-4">

                                    {/* Stats card */}
                                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumen</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Total módulos</span>
                                                <span className="text-xl font-black text-gray-900 dark:text-white">{selectedModules.length}</span>
                                            </div>
                                            <div className="h-px bg-gray-100 dark:bg-gray-800" />
                                            {MODULE_GROUPS.map(g => {
                                                const count = (g.exact
                                                    ? moduleTypes.filter(m => m === g.prefix)
                                                    : moduleTypes.filter(m => m.startsWith(g.prefix))
                                                ).filter(m => selectedModules.includes(m)).length;
                                                if (count === 0) return null;
                                                const st = GROUP_STYLES[g.color];
                                                return (
                                                    <div key={g.label} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-block h-2 w-2 rounded-full ${st.badge}`} />
                                                            <span className="text-gray-600 dark:text-gray-400">{g.label}</span>
                                                        </div>
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Confirmation notice */}
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                                        <div className="flex gap-2.5">
                                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">Todo listo. Al crear el proyecto se generarán las hojas de cálculo correspondientes a los módulos seleccionados.</p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={processing}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-emerald-900/30"
                                        >
                                            {processing ? (
                                                <>
                                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                    </svg>
                                                    Creando proyecto…
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    Crear Proyecto
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                            Volver a Exportación
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}