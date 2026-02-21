import { router, usePage } from '@inertiajs/react';
import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import * as caidaTensionRoutes from '@/routes/caida-tension';
import type { BreadcrumbItem } from '@/types';
import type { CaidaTensionSpreadsheetSummary } from '@/types/caida-tension';

interface PageProps {
    spreadsheets: CaidaTensionSpreadsheetSummary[];
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
        router.post(caidaTensionRoutes.store.url(), { name, project_name: projectName }, {
            onFinish: () => { setProcessing(false); setShowCreate(false); setName(''); setProjectName(''); },
        });
    };

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(caidaTensionRoutes.join.url(), { code: code.toUpperCase() }, {
            onFinish: () => { setProcessing(false); setShowJoin(false); setCode(''); },
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Caída de Tensión', href: caidaTensionRoutes.index.url() },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="w-full rounded-lg bg-white px-12 py-6 shadow dark:bg-gray-900">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Hojas de Caída de Tensión</h1>
                        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                            Plan: <span className="font-semibold capitalize text-blue-600">{auth.user.plan}</span>
                            {canCollab && (
                                <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">· Colaboración habilitada ✓</span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {canCollab && (
                            <button onClick={() => setShowJoin(true)} className="rounded-md border border-indigo-300 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50 dark:border-indigo-500/60 dark:text-blue-300 dark:hover:bg-blue-900/30">
                                Unirse con código
                            </button>
                        )}
                        <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-md transition-colors">
                            + Nueva Hoja
                        </button>
                    </div>
                </div>

                {/* Lista de hojas */}
                {spreadsheets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">No tienes hojas de cálculo todavía.</p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                            Crear primera hoja →
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {spreadsheets.map((sheet) => (
                            <div key={sheet.id} className="group cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800" onClick={() => router.get(caidaTensionRoutes.show.url(sheet.id))}>
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="break-normal text-sm font-semibold text-gray-800 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                {sheet.name}
                                            </h3>
                                            {sheet.project_name && (
                                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sheet.project_name}</p>
                                            )}
                                        </div>
                                        {sheet.is_collaborative && (
                                            <span className="ml-2 shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                                Collab
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>{sheet.is_owner ? 'Mi hoja' : `De: ${sheet.owner.name}`}</span>
                                        <span>{sheet.updated_at}</span>
                                    </div>

                                    {sheet.is_owner && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('¿Eliminar esta hoja?')) {
                                                    router.delete(caidaTensionRoutes.destroy.url(sheet.id));
                                                }
                                            }} className="mt-2 text-xs text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300">
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}     
                    </div>
                )}

                {/* Modal: Crear hoja */}
                {showCreate && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
                            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-gray-100">Nueva Hoja de Cálculo</h2>
                            <form onSubmit={handleCreate} className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Nombre *</label>
                                    <input
                                        type="text" required value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Caída de tensión - Piso 2"
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Proyecto</label>
                                    <input
                                        type="text" value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        placeholder="Ej: Edificio Multifamiliar Lima"
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowCreate(false)}
                                        className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={processing}
                                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-60">
                                        {processing ? 'Creando…' : 'Crear'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Unirse con código */}
                {showJoin && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
                            <h2 className="mb-4 text-base font-bold text-gray-800 dark:text-gray-100">Unirse a Hoja Colaborativa</h2>
                            <form onSubmit={handleJoin} className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Código de invitación</label>
                                    <input
                                        type="text" required value={code} maxLength={8}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="Ej: AB12CD34"
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-center font-mono text-sm tracking-widest text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowJoin(false)}
                                        className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={processing}
                                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
                                        {processing ? 'Uniéndose…' : 'Unirse'}
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
