import { router, usePage } from '@inertiajs/react';
import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import type { MetradoComunicacionesSpreadsheetSummary } from '@/types/metrados-comunicaciones'; 
import * as comunicacionesRoutes from '@/routes/metrados/comunicaciones';
import metradoRoutes from '@/routes/metrados';

interface PageProps {
    spreadsheets: MetradoComunicacionesSpreadsheetSummary[];
    auth: { user: { plan: string; name: string } };
    [key: string]: unknown;
}

const PLAN_CAN_COLLAB = ['mensual', 'anual', 'lifetime'];

export default function Index() {
    const { spreadsheets, auth } = usePage<PageProps>().props;
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [name, setName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [code, setCode] = useState('');
    const [processing, setProcessing] = useState(false);

    const canCollab = PLAN_CAN_COLLAB.includes(auth.user.plan);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        // Ruta actualizada a comunicaciones
        router.post(comunicacionesRoutes.store.url(), { name, project_name: projectName }, {
            onFinish: () => { setProcessing(false); setShowCreate(false); setName(''); setProjectName(''); },
        });
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        // Ruta actualizada a comunicaciones
        router.post(comunicacionesRoutes.join.url(), { code: code.toUpperCase() }, {
            onFinish: () => { setProcessing(false); setShowJoin(false); setCode(''); },
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Metrados', href: metradoRoutes.index.url() },
        // Título actualizado en breadcrumb
        { title: 'Comunicaciones', href: comunicacionesRoutes.index.url() },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="w-full rounded-lg bg-white px-6 py-8 shadow dark:bg-gray-900 sm:px-12">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Hojas de Metrado: Comunicaciones</h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Gestiona tus metrados de voz, datos, CCTV y sistemas electrónicos.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                            <span className="font-semibold capitalize text-blue-600 dark:text-blue-400">{auth.user.plan}</span>
                            {canCollab && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Colaboración habilitada
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {canCollab && (
                            <button 
                                onClick={() => setShowJoin(true)} 
                                className="rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            >
                                Unirse con código
                            </button>
                        )}
                        <button 
                            onClick={() => setShowCreate(true)} 
                            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                        >
                            + Nueva Hoja
                        </button>
                    </div>
                </div>

                {/* Lista de hojas */}
                {!spreadsheets || spreadsheets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="mb-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                            <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No hay hojas de comunicaciones</h3>
                        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            Comienza creando una nueva hoja para calcular metrados de cableado estructurado, fibra óptica o dispositivos.
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
                        >
                            Crear primera hoja &rarr;
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {spreadsheets.map((sheet) => (
                            <div 
                                key={sheet.id} 
                                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800" 
                                onClick={() => router.get(comunicacionesRoutes.show.url(sheet.id))}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-base font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                {sheet.name}
                                            </h3>
                                            {sheet.project_name ? (
                                                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" title={sheet.project_name}>
                                                    {sheet.project_name}
                                                </p>
                                            ) : (
                                                <p className="mt-1 text-xs italic text-gray-400 dark:text-gray-500">Sin proyecto asignado</p>
                                            )}
                                        </div>
                                        {sheet.is_collaborative && (
                                            <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                Collab
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`h-2 w-2 rounded-full ${sheet.is_owner ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                            <span className="truncate max-w-[100px]" title={sheet.is_owner ? 'Propietario' : `Dueño: ${sheet.owner.name}`}>
                                                {sheet.is_owner ? 'Tu hoja' : sheet.owner.name.split(' ')[0]}
                                            </span>
                                        </div>
                                        <span className="shrink-0">{sheet.updated_at}</span>
                                    </div>
                                </div>
                                
                                {sheet.is_owner && (
                                    <div className="bg-gray-50 px-5 py-2 dark:bg-gray-800/50">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('¿Estás seguro de eliminar esta hoja de metrado? Esta acción no se puede deshacer.')) {
                                                    router.delete(comunicacionesRoutes.destroy.url(sheet.id));
                                                }
                                            }} 
                                            className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-red-600 transition-colors hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Eliminar hoja
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal: Crear hoja */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nueva Hoja de Comunicaciones</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Configura los parámetros iniciales del metrado</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Nombre de la Hoja *</label>
                                    <input
                                        type="text" 
                                        required 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Metrado Voz y Datos - Piso 3"
                                        autoFocus
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Proyecto (Opcional)</label>
                                    <input
                                        type="text" 
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Ej: Edificio Corporativo Norte"
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCreate(false)}
                                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={processing || !name.trim()}
                                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-gray-900"
                                    >
                                        {processing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                                Creando...
                                            </span>
                                        ) : 'Crear Hoja'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Unirse con código */}
                {showJoin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                                    <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Unirse a Proyecto</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Ingresa el código compartido por el propietario</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleJoin} className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Código de Invitación</label>
                                    <input
                                        type="text" 
                                        required 
                                        value={code} 
                                        maxLength={8}
                                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                        placeholder="AB12CD34"
                                        autoFocus
                                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 text-center font-mono text-lg font-bold tracking-[0.2em] text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-600"
                                    />
                                    <p className="mt-2 text-center text-[10px] text-gray-500">Solo letras y números</p>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowJoin(false)}
                                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={processing || code.length < 4}
                                        className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-gray-900"
                                    >
                                        {processing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                                Uniéndose...
                                            </span>
                                        ) : 'Unirse'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}