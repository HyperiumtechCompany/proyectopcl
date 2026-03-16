import { router, usePage } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface PageProps { moduleTypes: string[];[key: string]: unknown; }
interface UbigeoItem { id: string; nombre: string; }

const MODULE_LABELS: Record<string, string> = {
    metrado_arquitectura: 'Arquitectura', metrado_estructura: 'Estructura',
    metrado_sanitarias: 'Sanitarias', metrado_electricas: 'Eléctricas',
    metrado_comunicaciones: 'Comunicaciones', metrado_gas: 'Gas',
    crono_general: 'Cronograma General', crono_valorizado: 'Cronograma Valorizado',
    crono_materiales: 'Cronograma Materiales',
    presupuesto: 'Presupuesto',
    // Legacy modules (hidden from UI but kept for compatibility)
    presupuesto_gg: 'Gastos Generales', presupuesto_insumos: 'Insumos',
    presupuesto_remuneraciones: 'Remuneraciones', presupuesto_acus: 'ACUs',
    presupuesto_indice: 'Índice', 
    etts: 'ETTs',
};

const MODULE_GROUPS = [
    { label: 'Metrados', prefix: 'metrado_', exact: false },
    { label: 'Cronogramas', prefix: 'crono_', exact: false },
    { label: 'Presupuesto', prefix: 'presupuesto', exact: true },
    { label: 'ETTs', prefix: 'etts', exact: true },
];

export default function Create() {
    const { moduleTypes } = usePage<PageProps>().props;
    const [step, setStep] = useState(1);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

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
    const [sanitariasModulos, setSanitariasModulos] = useState(1);

    // Load departamentos on mount
    useEffect(() => {
        fetch('/api/ubigeo/departamentos').then(r => r.json()).then(setDepartamentos).catch(() => { });
    }, []);

    // Load provincias when dep changes
    useEffect(() => {
        setProvincias([]); setDistritos([]); setProvId(''); setDistId('');
        if (depId) fetch(`/api/ubigeo/provincias/${depId}`).then(r => r.json()).then(setProvincias).catch(() => { });
    }, [depId]);

    // Load distritos when prov changes
    useEffect(() => {
        setDistritos([]); setDistId('');
        if (provId) fetch(`/api/ubigeo/distritos/${provId}`).then(r => r.json()).then(setDistritos).catch(() => { });
    }, [provId]);

    const toggleModule = (m: string) => {
        setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleSubmit = () => {
        if (selectedModules.length === 0) { setErrors({ modules: 'Selecciona al menos un módulo' }); return; }
        setProcessing(true);

        const codigos_modulares: Record<string, string> = {};
        if (cmInicial && cmInicialVal) codigos_modulares.inicial = cmInicialVal;
        if (cmPrimaria && cmPrimariaVal) codigos_modulares.primaria = cmPrimariaVal;
        if (cmSecundaria && cmSecundariaVal) codigos_modulares.secundaria = cmSecundariaVal;

        router.post('/costos', {
            nombre, uei, unidad_ejecutora: unidadEjecutora, codigo_snip: codigoSnip,
            codigo_cui: codigoCui, codigo_local: codigoLocal,
            fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null,
            codigos_modulares: Object.keys(codigos_modulares).length > 0 ? codigos_modulares : null,
            departamento_id: depId || null, provincia_id: provId || null,
            distrito_id: distId || null, centro_poblado: centroPoblado || null,
            modules: selectedModules,
            sanitarias_cantidad_modulos: selectedModules.includes('metrado_sanitarias') ? sanitariasModulos : null,
        }, {
            onFinish: () => setProcessing(false),
            onError: (e) => setErrors(e as Record<string, string>),
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: 'Nuevo Proyecto', href: '/costos/create' },
    ];

    const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500";
    const labelCls = "mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300";

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full max-w-4xl rounded-lg bg-white px-8 py-6 shadow dark:bg-gray-900">
                {/* Stepper */}
                <div className="mb-6 flex items-center gap-4">
                    {[1, 2].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{s}</div>
                            <span className={`text-sm font-medium ${step >= s ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{s === 1 ? 'Información General' : 'Módulos'}</span>
                            {s === 1 && <div className="ml-2 h-px w-12 bg-gray-300 dark:bg-gray-600" />}
                        </div>
                    ))}
                </div>

                {/* Step 1 */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Información del Proyecto</h2>

                        <div><label className={labelCls}>Nombre del Proyecto *</label><input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: I.E. Nº 12345" className={inputCls} /></div>

                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>UEI</label><input type="text" value={uei} onChange={e => setUei(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Unidad Ejecutora</label><input type="text" value={unidadEjecutora} onChange={e => setUnidadEjecutora(e.target.value)} className={inputCls} /></div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div><label className={labelCls}>Código SNIP</label><input type="text" value={codigoSnip} onChange={e => setCodigoSnip(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Código CUI</label><input type="text" value={codigoCui} onChange={e => setCodigoCui(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Código Local</label><input type="text" value={codigoLocal} onChange={e => setCodigoLocal(e.target.value)} className={inputCls} /></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Fecha Inicio</label><input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Fecha Fin</label><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputCls} /></div>
                        </div>

                        {/* Códigos Modulares */}
                        <div>
                            <label className={labelCls}>Códigos Modulares</label>
                            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                {([['Inicial', cmInicial, setCmInicial, cmInicialVal, setCmInicialVal],
                                ['Primaria', cmPrimaria, setCmPrimaria, cmPrimariaVal, setCmPrimariaVal],
                                ['Secundaria', cmSecundaria, setCmSecundaria, cmSecundariaVal, setCmSecundariaVal]] as const).map(([label, checked, setChecked, val, setVal]) => (
                                    <div key={label} className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 w-28">
                                            <input type="checkbox" checked={checked as boolean} onChange={e => (setChecked as (v: boolean) => void)(e.target.checked)} className="rounded border-gray-300" />
                                            {label}
                                        </label>
                                        {checked && <input type="text" value={val as string} onChange={e => (setVal as (v: string) => void)(e.target.value)} placeholder="Código modular" className={inputCls + ' flex-1'} />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Ubicación */}
                        <div>
                            <label className={labelCls}>Ubicación</label>
                            <div className="grid grid-cols-3 gap-3">
                                <select value={depId} onChange={e => setDepId(e.target.value)} className={inputCls}>
                                    <option value="">Departamento</option>
                                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                </select>
                                <select value={provId} onChange={e => setProvId(e.target.value)} className={inputCls} disabled={!depId}>
                                    <option value="">Provincia</option>
                                    {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                                <select value={distId} onChange={e => setDistId(e.target.value)} className={inputCls} disabled={!provId}>
                                    <option value="">Distrito</option>
                                    {distritos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                                </select>
                            </div>
                            <div className="mt-2"><input type="text" value={centroPoblado} onChange={e => setCentroPoblado(e.target.value)} placeholder="Centro Poblado" className={inputCls} /></div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button onClick={() => { if (!nombre) { setErrors({ nombre: 'Requerido' }); return; } setStep(2); }} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm hover:bg-blue-700">
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Seleccionar Módulos</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Elige los módulos que utilizará este proyecto.</p>

                        {MODULE_GROUPS.map(g => {
                            // Filter modules based on prefix and exact match flag
                            let items: string[];
                            
                            if (g.exact) {
                                // Exact match: only show if module name equals prefix exactly
                                items = moduleTypes.filter(m => m === g.prefix);
                            } else {
                                // Prefix match: show all modules that start with prefix
                                items = moduleTypes.filter(m => m.startsWith(g.prefix));
                            }
                            
                            // Skip if no items
                            if (items.length === 0) return null;
                            
                            return (
                                <div key={g.label} className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                                    <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{g.label}</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {items.map(m => (
                                            <label key={m} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${selectedModules.includes(m) ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                                                <input type="checkbox" checked={selectedModules.includes(m)} onChange={() => toggleModule(m)} className="rounded border-gray-300" />
                                                {MODULE_LABELS[m] || m}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Sanitarias module count input */}
                        {selectedModules.includes('metrado_sanitarias') && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                                <h3 className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">⚙️ Configuración de Sanitarias</h3>
                                <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">Define la cantidad de módulos (hojas) que tendrá el metrado sanitarias. Puedes cambiarlo después.</p>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-blue-700 dark:text-blue-300">Cantidad de Módulos:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={sanitariasModulos}
                                        onChange={e => setSanitariasModulos(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                        className="w-20 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-blue-600 dark:bg-gray-800 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                        )}

                        {errors.modules && <p className="text-sm text-red-500">{errors.modules}</p>}

                        <div className="flex justify-between pt-2">
                            <button onClick={() => setStep(1)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">← Atrás</button>
                            <button onClick={handleSubmit} disabled={processing} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-60">
                                {processing ? 'Creando proyecto…' : 'Crear Proyecto'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
