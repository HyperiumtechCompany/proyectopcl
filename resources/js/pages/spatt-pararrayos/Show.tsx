import { router, usePage } from '@inertiajs/react';
import { Download, Calculator, UploadCloud, FileSpreadsheet, Settings,
    Save, ArrowLeft, Users, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import * as spattPararrayosRoutes from '@/routes/spatt-pararrayos';
import type { BreadcrumbItem } from '@/types';
import type { SpattPararrayoSpreadsheet } from '@/types/spatt-pararrayos';
import { exportToExcel } from '@/lib/pararrayos_export';
import pozoBaseImagenUrl from './img/pozo_limpio.png'; // <-- imagen real

interface PageProps {
    auth: { user: { name: string; email: string; plan: string } };
    spreadsheet: SpattPararrayoSpreadsheet;
    [key: string]: unknown;
}

const opcionesVarilla = [
    { nombre: '3/8″ (0.0095 m)',     valor: 0.0095    },
    { nombre: '1/2″ (0.0127 m)',     valor: 0.0127    },
    { nombre: '5/8″ (0.015875 m)',   valor: 0.015875  },
    { nombre: '3/4″ (0.0190 m)',     valor: 0.0190    },
    { nombre: '1″ (0.0254 m)',       valor: 0.0254    },
    { nombre: 'Otro',                valor: 0         },
];

const terrainDescs: Record<string, string> = {
    GW: 'Grava de buen grado, mezcla de grava y arena',
    GP: 'Grava de bajo grado, mezcla de grava y arena',
    GC: 'Grava con arcilla, mezcla de grava y arcilla',
    SM: 'Arena con limo, mezcla de bajo grado de arena con limo',
    SC: 'Arena con arcilla, mezcla de bajo grado de arena con arcilla',
    ML: 'Arena fina con arcilla de ligera plasticidad',
    MH: 'Arena fina o terreno con limo, terrenos elásticos',
    CL: 'Arcilla pobre con grava, arena, limo',
    CH: 'Arcilla inorgánica de alta plasticidad',
};

const resistividades: Record<string, number> = {
    GW: 800, GP: 1750, GC: 300, SM: 300, SC: 125,
    ML: 55,  MH: 190,  CL: 42.5, CH: 32.5,
};

// Estilos reutilizables
const inputCls = 'w-full px-3 py-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-gray-900 font-semibold text-sm focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-colors';
const inputDisabledCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm cursor-not-allowed';
const selectCls = 'w-full px-3 py-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-gray-900 font-semibold text-sm focus:outline-none focus:border-yellow-500 transition-colors';
const labelCls = 'block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1';

export default function Show() {
    const { spreadsheet, auth } = usePage<PageProps>().props;
    const canEdit = spreadsheet.can_edit;
    const isOwner = spreadsheet.is_owner;
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'pozo' | 'pararrayo'>('pozo');
    const [showHeaderEditor, setShowHeaderEditor] = useState(false);

    const [header, setHeader] = useState({
        proyecto:        spreadsheet.project_name || 'MEJORAMIENTO DE LOS SERVICIOS DE EDUCACIÓN...',
        cui:             'CUI: ',
        codigoModular:   'CÓDIGO MODULAR: ',
        codigoLocal:     'CÓDIGO LOCAL: ',
        unidadEjecutora: 'UNIDAD EJECUTORA: ',
        distrito:        'DISTRITO: ',
        provincia:       'PROVINCIA: ',
        departamento:    'DEPARTAMENTO: ',
    });

    const [logo1, setLogo1] = useState<File | null>(null);
    const [logo2, setLogo2] = useState<File | null>(null);
    const [logo1Preview, setLogo1Preview] = useState<string>('');
    const [logo2Preview, setLogo2Preview] = useState<string>('');

    const [pozo, setPozo] = useState(spreadsheet.pozo_data || {
        L: 2.4, a: 0.015875, resistividad: 32.5, tipoTerreno: 'CH', isCustomA: false,
        dosisReduccion: [
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '1ra dosis' },
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '2da dosis' },
            { rInicial: 0, reduccion: 0, rFinal: 0, descripcion: '3ra dosis' },
        ],
        resultados: null as any,
    });

    const [pararrayo, setPararrayo] = useState(spreadsheet.pararrayo_data || {
        td: 80, L: 103.08, W: 46.92, H: 13.94, h: 10,
        c1: 0.5, c2: 1, c3: 1, c4: 1, c5: 1,
        resultados: null as any,
    });

    const [showModal, setShowModal] = useState(false);
    const [exportOption, setExportOption] = useState<'both' | 'pozo' | 'pararrayo'>('both');

    // Estado para los valores numéricos sobre la imagen real
    const [pozoImagenNumeros, setPozoImagenNumeros] = useState({
        cotaSuperiorTotal: '0.60',
        cotaSuperiorSmall: '0.075',
        cotaSuperiorMid: '0.45',
        cotaVerticalTop: '0.30',
        cotaVerticalMid: '0.10',
        profundidadTotal: '2.5',
    });

    const handleImagenChange = (campo: string, valor: string) => {
        setPozoImagenNumeros(prev => ({ ...prev, [campo]: valor }));
    };

    // Actualizar resistividad al cambiar tipo de terreno
    useEffect(() => {
        if (resistividades[pozo.tipoTerreno] !== undefined) {
            setPozo(p => ({ ...p, resistividad: resistividades[p.tipoTerreno] }));
        }
    }, [pozo.tipoTerreno]);

    // Preview logos
    const handleLogo = (file: File | null, setFile: any, setPreview: any) => {
        setFile(file);
        if (file) {
            const url = URL.createObjectURL(file);
            setPreview(url);
        } else {
            setPreview('');
        }
    };

    // Calcular Pozo a Tierra
    const calcularPozoTierra = () => {
        const { L, a, resistividad } = pozo;
        if (!L || !a || !resistividad || a <= 0) {
            alert('Por favor, completa todos los campos requeridos y que sean mayores a 0.');
            return;
        }
        const factor1 = resistividad / (2 * Math.PI * L);
        const factor2 = Math.log((4 * L) / a) - 1;
        const resistencia = Math.round((factor1 * factor2) * 100) / 100;

        let prevR = resistencia;
        const nuevasDosis = pozo.dosisReduccion.map(dosis => {
            const dec = dosis.reduccion / 100;
            const rFinal = Math.round(prevR * (1 - dec) * 100) / 100;
            const nueva = { ...dosis, rInicial: prevR, rFinal };
            prevR = rFinal;
            return nueva;
        });

        setPozo(p => ({ ...p, dosisReduccion: nuevasDosis,
            resultados: { calculado: true, resistencia } }));
    };

    // Calcular Pararrayo
    const calcularPararrayo = () => {
        const { td, L, W, H, c1, c2, c3, c4, c5 } = pararrayo;
        if (!td || !L || !W || !H) { alert('Por favor, complete todos los campos requeridos'); return; }
        const nkng = parseFloat((Math.pow(td, 1.25) * 0.04).toFixed(3));
        const aeData = (L * W) + (6 * H * (L + W)) + (Math.PI * 9 * H * H);
        const areaEquivalente = Math.round(aeData * 100) / 100;
        const NdExacto = nkng * areaEquivalente * c1 * 1e-6;
        const Nd = Math.round(NdExacto * 1e6) / 1e6;
        const ncExacto = (1.5 * Math.pow(10, -3)) / (c2 * c3 * c4 * c5);
        const nc = Math.round(ncExacto * 1e6) / 1e6;
        const requiereProteccion = Nd > nc;
        let eficienciaRequerida = 0, nivelProteccion = 1;
        if (requiereProteccion) {
            eficienciaRequerida = Math.round((1 - (nc / Nd)) * 1000) / 1000;
            if (eficienciaRequerida >= 0.98) nivelProteccion = 1;
            else if (eficienciaRequerida >= 0.95) nivelProteccion = 2;
            else if (eficienciaRequerida >= 0.80) nivelProteccion = 3;
            else nivelProteccion = 4;
        }
        setPararrayo(p => ({ ...p, resultados: { calculado: true, nkng, areaEquivalente, Nd, nc,
            requiereProteccion, eficienciaRequerida, nivelProteccion } }));
    };

    const handleSave = () => {
        setIsSaving(true);
        router.patch(spattPararrayosRoutes.update.url(spreadsheet.id), {
            pozo_data: pozo,
            pararrayo_data: pararrayo,
            pozo_imagen_numeros: pozoImagenNumeros, // guardamos los valores de la imagen
        }, {
            preserveScroll: true,
            onFinish: () => setIsSaving(false),
            onSuccess: () => alert('Hoja guardada exitosamente.'),
        });
    };

    const handleEnableCollab = () => {
        if (confirm('¿Habilitar colaboración para esta hoja?')) {
            router.post(`/spatt-pararrayos/${spreadsheet.id}/enable-collab`, {}, { preserveScroll: true });
        }
    };

    const copyCollabCode = () => {
        if (spreadsheet.collab_code) {
            navigator.clipboard.writeText(spreadsheet.collab_code);
            alert('Código copiado al portapapeles.');
        }
    };

    const handleExport = async () => {
        if (!logo1 || !logo2) { setShowModal(true); return; }
        if ((exportOption === 'both' || exportOption === 'pozo') && !pozo.resultados?.calculado) {
            alert('Calcula el Pozo a Tierra antes de exportar.'); return;
        }
        if ((exportOption === 'both' || exportOption === 'pararrayo') && !pararrayo.resultados?.calculado) {
            alert('Calcula el Pararrayo antes de exportar.'); return;
        }
        await exportToExcel({
            logo1, logo2, exportOption, header, pozo, pararrayo,
            spreadsheetName: spreadsheet.name,
            pozoImagenNumeros,          // valores editables de la imagen
            pozoImagenUrl: pozoBaseImagenUrl, // URL de la imagen real
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'SPAT y Pararrayos', href: spattPararrayosRoutes.index.url() },
        { title: spreadsheet.name,    href: spattPararrayosRoutes.show.url(spreadsheet.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full p-4 md:p-6 bg-slate-50 dark:bg-gray-950 min-h-screen font-sans">

                {/* ── CABECERA ──────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-gray-800 gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => router.get(spattPararrayosRoutes.index.url())}
                                className="text-slate-400 hover:text-blue-600 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <Calculator className="w-7 h-7 text-blue-600" />
                                {spreadsheet.name}
                            </h1>
                        </div>
                        <p className="text-slate-500 dark:text-gray-400 text-sm pl-8">
                            {spreadsheet.project_name || 'Sin proyecto asignado'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-white dark:bg-gray-900 shadow-sm p-1 rounded-xl border border-slate-200 dark:border-gray-800">
                        {(['pozo','pararrayo'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                                    activeTab===tab
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800'
                                }`}>
                                {tab==='pozo' ? 'Pozo a Tierra' : 'Pararrayos'}
                            </button>
                        ))}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 flex-wrap">
                        {isOwner && !spreadsheet.is_collaborative &&
                            ['mensual','anual','lifetime'].includes(auth.user.plan) && (
                            <button onClick={handleEnableCollab}
                                className="flex font-semibold items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                                <Users className="w-4 h-4" /> Colaboración
                            </button>
                        )}
                        {spreadsheet.is_collaborative && (
                            <button onClick={copyCollabCode}
                                className="flex font-semibold items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm">
                                <Users className="w-4 h-4" /> {spreadsheet.collab_code}
                            </button>
                        )}
                        {canEdit && (
                            <button onClick={handleSave} disabled={isSaving}
                                className="flex font-semibold items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm">
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── EDITOR DE ENCABEZADO (colapsable) ───────────────────────── */}
                <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowHeaderEditor(!showHeaderEditor)}
                        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-slate-700 dark:text-gray-200 text-sm">
                                Datos del Encabezado del Documento
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                                (Nombre del proyecto, CUI, códigos, etc.)
                            </span>
                        </div>
                        {showHeaderEditor
                            ? <ChevronUp className="w-4 h-4 text-slate-400"/>
                            : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                    </button>

                    {showHeaderEditor && (
                        <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-gray-800">
                            <p className="text-xs text-slate-500 mb-4">
                                Estos datos aparecerán en el encabezado del Excel exportado.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Nombre del Proyecto</label>
                                    <textarea
                                        rows={2}
                                        value={header.proyecto}
                                        onChange={e => setHeader({...header, proyecto: e.target.value})}
                                        className={`${inputCls} resize-none`}
                                        placeholder="Ej: MEJORAMIENTO DE LOS SERVICIOS..."
                                    />
                                </div>
                                {[
                                    {key:'cui',           label:'CUI'},
                                    {key:'codigoModular', label:'Código Modular'},
                                    {key:'codigoLocal',   label:'Código Local'},
                                    {key:'unidadEjecutora',label:'Unidad Ejecutora'},
                                    {key:'distrito',      label:'Distrito'},
                                    {key:'provincia',     label:'Provincia'},
                                    {key:'departamento',  label:'Departamento'},
                                ].map(({key,label}) => (
                                    <div key={key}>
                                        <label className={labelCls}>{label}</label>
                                        <input
                                            type="text"
                                            value={(header as any)[key]}
                                            onChange={e => setHeader({...header, [key]: e.target.value})}
                                            className={inputCls}
                                            placeholder={label}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* ── PANEL IZQUIERDO — Export & Logos ─────────────────────── */}
                    <div className="lg:col-span-1 space-y-5">
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 p-5">
                            <h3 className="font-bold text-slate-700 dark:text-gray-200 mb-4 flex items-center gap-2 text-sm">
                                <Settings className="w-4 h-4 text-slate-500" /> Exportar Excel
                            </h3>

                            {/* Opción de exportación */}
                            <div className="mb-4">
                                <label className={labelCls}>Qué exportar</label>
                                <select
                                    value={exportOption}
                                    onChange={e => setExportOption(e.target.value as any)}
                                    className={selectCls}>
                                    <option value="both">Pozo + Pararrayo</option>
                                    <option value="pozo">Solo Pozo a Tierra</option>
                                    <option value="pararrayo">Solo Pararrayo</option>
                                </select>
                            </div>

                            <div className="space-y-4">
                                {/* Logo 1 */}
                                <div>
                                    <label className={labelCls}>Logo Izquierdo</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-blue-300 transition-colors">
                                        {logo1Preview
                                            ? <img src={logo1Preview} alt="Logo 1"
                                                className="h-14 mx-auto object-contain mb-2"/>
                                            : <div className="h-14 flex items-center justify-center text-slate-400 text-xs">Sin logo</div>
                                        }
                                        <input type="file" accept="image/*" id="logo1"
                                            className="hidden"
                                            onChange={e => handleLogo(e.target.files?.[0]||null, setLogo1, setLogo1Preview)}/>
                                        <label htmlFor="logo1"
                                            className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700">
                                            {logo1 ? 'Cambiar logo' : 'Seleccionar logo'}
                                        </label>
                                    </div>
                                </div>

                                {/* Logo 2 */}
                                <div>
                                    <label className={labelCls}>Logo Derecho</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-blue-300 transition-colors">
                                        {logo2Preview
                                            ? <img src={logo2Preview} alt="Logo 2"
                                                className="h-14 mx-auto object-contain mb-2"/>
                                            : <div className="h-14 flex items-center justify-center text-slate-400 text-xs">Sin logo</div>
                                        }
                                        <input type="file" accept="image/*" id="logo2"
                                            className="hidden"
                                            onChange={e => handleLogo(e.target.files?.[0]||null, setLogo2, setLogo2Preview)}/>
                                        <label htmlFor="logo2"
                                            className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700">
                                            {logo2 ? 'Cambiar logo' : 'Seleccionar logo'}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Indicadores */}
                            <div className="mt-4 space-y-1">
                                {[
                                    {label:'Logos',   ok: !!logo1 && !!logo2},
                                    {label:'Pozo calc.',  ok: !!pozo.resultados?.calculado},
                                    {label:'Pararrayo calc.', ok: !!pararrayo.resultados?.calculado},
                                ].map(({label,ok}) => (
                                    <div key={label} className="flex items-center gap-2 text-xs">
                                        <span className={`w-2 h-2 rounded-full ${ok?'bg-green-500':'bg-gray-300'}`}/>
                                        <span className={ok?'text-green-700':'text-gray-400'}>{label}</span>
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleExport}
                                className="mt-5 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-sm hover:shadow text-sm">
                                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* ── PANEL DERECHO — Calculadoras ─────────────────────────── */}
                    <div className="lg:col-span-3">

                        {/* ════ TAB POZO A TIERRA ════ */}
                        {activeTab === 'pozo' && (
                            <div className="space-y-5">

                                {/* IMAGEN REAL CON INPUTS NUMÉRICOS (texto negro visible) */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                                            Diagrama del Pozo a Tierra
                                        </h2>
                                    </div>
                                    <div className="p-5 flex justify-center">
                                        <div className="relative w-full max-w-[900px] overflow-hidden rounded-lg shadow-md border border-gray-200 dark:border-gray-700" style={{ aspectRatio: '980/760' }}>
                                            <img
                                                src={pozoBaseImagenUrl}
                                                alt="Diagrama técnico del pozo a tierra"
                                                className="absolute inset-0 w-full h-full object-contain"
                                            />
                                            <div className="absolute inset-0">
                                                {/* Cota superior total (0.60) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.cotaSuperiorTotal}
                                                    onChange={(e) => handleImagenChange('cotaSuperiorTotal', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[11px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '60.6%', top: '21.1%', width: '7%', transform: 'translateX(-50%)' }}
                                                />
                                                {/* Cota superior small (0.075) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.cotaSuperiorSmall}
                                                    onChange={(e) => handleImagenChange('cotaSuperiorSmall', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[10px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '48.6%', top: '25.4%', width: '8%' }}
                                                />
                                                {/* Cota superior mid (0.45) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.cotaSuperiorMid}
                                                    onChange={(e) => handleImagenChange('cotaSuperiorMid', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[10px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '64.1%', top: '25.4%', width: '7%' }}
                                                />
                                                {/* Cota vertical top (0.30) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.cotaVerticalTop}
                                                    onChange={(e) => handleImagenChange('cotaVerticalTop', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[10px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '81.4%', top: '29.2%', width: '6%' }}
                                                />
                                                {/* Cota vertical mid (0.10) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.cotaVerticalMid}
                                                    onChange={(e) => handleImagenChange('cotaVerticalMid', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[10px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '81.4%', top: '33.8%', width: '6%' }}
                                                />
                                                {/* Profundidad total (2.5) */}
                                                <input
                                                    type="text"
                                                    value={pozoImagenNumeros.profundidadTotal}
                                                    onChange={(e) => handleImagenChange('profundidadTotal', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="absolute bg-white border-2 border-blue-500 rounded text-center text-[11px] font-bold text-gray-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                                                    style={{ left: '87.8%', top: '63.2%', width: '6%', transform: 'translateX(-50%)' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sección: Características del terreno */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                                            CÁLCULO DE LA RESISTENCIA DE PUESTA A TIERRA
                                        </h2>
                                        <p className="text-blue-200 text-xs mt-0.5 font-mono">
                                            R = ρ/(2πL) × [ Ln(4L/a) − 1 ]
                                        </p>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                                            <span className="w-3 h-3 bg-[#002060] rounded-sm inline-block"/>
                                            Características del Terreno
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelCls}>Tipo de Terreno</label>
                                                <select
                                                    value={pozo.tipoTerreno}
                                                    onChange={e => setPozo({...pozo, tipoTerreno: e.target.value})}
                                                    disabled={!canEdit}
                                                    className={canEdit ? selectCls : inputDisabledCls}>
                                                    {Object.keys(terrainDescs).map(k => (
                                                        <option key={k} value={k}>{k}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Resistividad ρ (Ω·m)</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={pozo.resistividad}
                                                    onChange={e => setPozo({...pozo, resistividad: +e.target.value})}
                                                    disabled={!canEdit}
                                                    className={canEdit ? inputCls : inputDisabledCls}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Descripción</label>
                                                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 min-h-[40px] flex items-center">
                                                    {terrainDescs[pozo.tipoTerreno]}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Parámetros de diseño */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">Parámetros de Diseño</h2>
                                    </div>
                                    <div className="p-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Longitud de Varilla L (m)</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={pozo.L}
                                                    onChange={e => setPozo({...pozo, L: +e.target.value})}
                                                    disabled={!canEdit}
                                                    className={canEdit ? inputCls : inputDisabledCls}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Diámetro de Varilla a (m)</label>
                                                <select
                                                    value={pozo.isCustomA ? 0 : pozo.a}
                                                    disabled={!canEdit}
                                                    onChange={e => {
                                                        const val = +e.target.value;
                                                        setPozo({...pozo, a: val, isCustomA: val === 0});
                                                    }}
                                                    className={canEdit ? selectCls : inputDisabledCls}>
                                                    {opcionesVarilla.map(o => (
                                                        <option key={o.nombre} value={o.valor}>{o.nombre}</option>
                                                    ))}
                                                </select>
                                                {pozo.isCustomA && canEdit && (
                                                    <input
                                                        type="number" step="0.001"
                                                        value={pozo.a}
                                                        onChange={e => setPozo({...pozo, a: +e.target.value})}
                                                        className={`${inputCls} mt-2`}
                                                        placeholder="Ingrese valor en metros"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Fórmula visual */}
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <p className="text-center text-sm font-mono font-bold text-blue-900 dark:text-blue-200">
                                                R = {pozo.resistividad} / (2π × {pozo.L}) × [ ln(4×{pozo.L} / {pozo.a.toFixed(4)}) − 1 ]
                                            </p>
                                        </div>

                                        {canEdit && (
                                            <button onClick={calcularPozoTierra}
                                                className="mt-4 w-full bg-[#002060] hover:bg-blue-900 text-white font-bold py-3 rounded-xl transition-colors shadow text-sm">
                                                Calcular Resistencia de Puesta a Tierra
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Resultados */}
                                {pozo.resultados?.calculado && (
                                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                        <div className="bg-[#002060] px-5 py-3">
                                            <h2 className="font-bold text-white text-sm uppercase tracking-wide">Resultados de Cálculo</h2>
                                        </div>
                                        <div className="p-5">
                                            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 mb-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Resistencia calculada</p>
                                                    <p className="text-3xl font-black text-[#002060] dark:text-blue-300 mt-1">
                                                        {pozo.resultados.resistencia} <span className="text-lg font-bold">Ω</span>
                                                    </p>
                                                </div>
                                                <div className="text-right text-sm text-gray-500">
                                                    <p>Terreno: <strong>{pozo.tipoTerreno}</strong></p>
                                                    <p>ρ = {pozo.resistividad} Ω·m</p>
                                                    <p>L = {pozo.L} m</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Reducción (input mejorado con texto negro visible) */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                                            Reducción de la Resistencia de Puesta a Tierra
                                        </h2>
                                    </div>
                                    <div className="p-5 overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 dark:bg-gray-800">
                                                    {['R Inicial (Ω)','% Reducción','R Final (Ω)','Descripción'].map(h => (
                                                        <th key={h} className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs uppercase">
                                                            {h}
                                                        </th>
                                                    ))}
                                                  </tr>
                                            </thead>
                                            <tbody>
                                                {pozo.dosisReduccion.map((dosis, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                        <td className="px-4 py-3 text-center font-mono text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800">
                                                            {dosis.rInicial > 0 ? dosis.rInicial : '—'}
                                                        </td>
                                                        <td className="px-3 py-2 border border-gray-100 dark:border-gray-800">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="number" min="0" max="100" step="1"
                                                                    value={dosis.reduccion}
                                                                    disabled={!canEdit}
                                                                    onChange={e => {
                                                                        const n = [...pozo.dosisReduccion];
                                                                        n[idx].reduccion = +e.target.value;
                                                                        setPozo({...pozo, dosisReduccion: n});
                                                                    }}
                                                                    onBlur={calcularPozoTierra}
                                                                    className="w-full px-2 py-1.5 bg-white border-2 border-blue-400 rounded text-center font-semibold text-sm text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                                                                />
                                                                <span className="text-gray-500 text-xs font-bold">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-green-700 dark:text-green-400 border border-gray-100 dark:border-gray-800">
                                                            {dosis.rFinal > 0 ? dosis.rFinal : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300 text-xs border border-gray-100 dark:border-gray-800">
                                                            {dosis.descripcion}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ════ TAB PARARRAYO (completamente intacto) ════ */}
                        {activeTab === 'pararrayo' && (
                            <div className="space-y-5">

                                {/* Frecuencia + Dimensiones */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                                            1. Frecuencia Anual de Caída de Rayos y Dimensiones
                                        </h2>
                                    </div>
                                    <div className="p-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                {label:'Td (Isoceraúnico)', key:'td', step:1},
                                                {label:'Longitud (L) m',    key:'L',  step:0.01},
                                                {label:'Ancho (W) m',       key:'W',  step:0.01},
                                                {label:'Altura Estruct. (H) m', key:'H', step:0.01},
                                            ].map(({label,key,step}) => (
                                                <div key={key}>
                                                    <label className={labelCls}>{label}</label>
                                                    <input
                                                        type="number" step={step}
                                                        value={(pararrayo as any)[key]}
                                                        onChange={e => setPararrayo({...pararrayo, [key]: +e.target.value})}
                                                        disabled={!canEdit}
                                                        className={canEdit ? inputCls : inputDisabledCls}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        {pararrayo.resultados?.calculado && (
                                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 text-sm">
                                                <span className="font-bold text-blue-800 dark:text-blue-300">
                                                    Nk = Ng = {pararrayo.resultados.nkng} rayos/km²·año
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Área Equivalente */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">2. Cálculo de Área Equivalente (Ae)</h2>
                                    </div>
                                    <div className="p-5">
                                        <p className="text-xs text-gray-500 italic mb-3 font-mono">
                                            Ae = L×W + 6H(L+W) + π×9H²
                                        </p>
                                        {pararrayo.resultados?.calculado
                                            ? <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 text-center">
                                                <p className="text-xs text-gray-500 mb-1">Área Equivalente</p>
                                                <p className="text-3xl font-black text-[#002060] dark:text-blue-300">
                                                    {pararrayo.resultados.areaEquivalente} <span className="text-base font-bold">m²</span>
                                                </p>
                                              </div>
                                            : <p className="text-sm text-gray-400 italic text-center py-4">Calcule para ver el resultado</p>
                                        }
                                    </div>
                                </div>

                                {/* Coeficientes */}
                                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                    <div className="bg-[#002060] px-5 py-3">
                                        <h2 className="font-bold text-white text-sm uppercase tracking-wide">Coeficientes de Riesgo</h2>
                                    </div>
                                    <div className="p-5">
                                        <div className="grid grid-cols-5 gap-3">
                                            {['c1','c2','c3','c4','c5'].map(c => (
                                                <div key={c}>
                                                    <label className={labelCls + ' text-center block'}>{c.toUpperCase()}</label>
                                                    <input
                                                        type="number" step="0.1"
                                                        value={(pararrayo as any)[c]}
                                                        onChange={e => setPararrayo({...pararrayo, [c]: +e.target.value})}
                                                        disabled={!canEdit}
                                                        className={canEdit ? `${inputCls} text-center` : `${inputDisabledCls} text-center`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {canEdit && (
                                    <button onClick={calcularPararrayo}
                                        className="w-full bg-[#002060] hover:bg-blue-900 text-white font-bold py-3 rounded-xl transition-colors shadow text-sm">
                                        Calcular Evaluación del Pararrayo
                                    </button>
                                )}

                                {/* Evaluación */}
                                {pararrayo.resultados?.calculado && (
                                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 overflow-hidden">
                                        <div className="bg-[#002060] px-5 py-3">
                                            <h2 className="font-bold text-white text-sm uppercase tracking-wide">
                                                5. Evaluación y Comparación de Riesgos
                                            </h2>
                                        </div>
                                        <div className="p-5 overflow-x-auto">
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                                        {['ÁREA (Ae) m²','Nd','Nc','REQUIERE PROTECCIÓN'].map(h => (
                                                            <th key={h} className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs uppercase">
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="px-4 py-4 text-center font-semibold border border-gray-100 dark:border-gray-800">
                                                            {pararrayo.resultados.areaEquivalente}
                                                        </td>
                                                        <td className="px-4 py-4 text-center font-bold text-red-600 dark:text-red-400 border border-gray-100 dark:border-gray-800">
                                                            {pararrayo.resultados.Nd}
                                                        </td>
                                                        <td className="px-4 py-4 text-center font-bold text-green-600 dark:text-green-400 border border-gray-100 dark:border-gray-800">
                                                            {pararrayo.resultados.nc}
                                                        </td>
                                                        <td className={`px-4 py-4 text-center font-extrabold text-lg border border-gray-100 dark:border-gray-800 ${
                                                            pararrayo.resultados.requiereProteccion
                                                                ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                                                        }`}>
                                                            {pararrayo.resultados.requiereProteccion ? 'SI' : 'NO'}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            {pararrayo.resultados.requiereProteccion && (
                                                <div className="mt-4 grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 text-center">
                                                        <p className="text-xs text-gray-500 mb-1">Eficiencia Requerida</p>
                                                        <p className="text-xl font-black text-yellow-700 dark:text-yellow-300">
                                                            {pararrayo.resultados.eficienciaRequerida}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 text-center">
                                                        <p className="text-xs text-gray-500 mb-1">Nivel de Protección</p>
                                                        <p className="text-xl font-black text-orange-700 dark:text-orange-300">
                                                            Nivel {pararrayo.resultados.nivelProteccion}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── MODAL: logos requeridos ───────────────────────────────── */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                            <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-3"/>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Logos Requeridos</h3>
                            <p className="text-sm text-slate-500 dark:text-gray-400 mb-5">
                                Debes seleccionar ambos logos antes de exportar el Excel.
                            </p>
                            <button onClick={() => setShowModal(false)}
                                className="w-full bg-slate-800 text-white font-semibold py-2.5 rounded-xl hover:bg-slate-700 transition-colors">
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}