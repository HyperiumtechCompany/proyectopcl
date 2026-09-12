import { Head, Link, router } from '@inertiajs/react';
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { store } from '@/actions/App/Http/Controllers/Mantenimiento/MaintenanceDocumentController';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Props {
    project: { id: number; nombre: string };
    documents: Array<{ public_id: string; nombre: string; moneda: string; estado: string; revision: number; updated_at: string }>;
}

export default function Index({ project, documents }: Props) {
    const [name, setName] = useState('Plan de mantenimiento');
    const [processing, setProcessing] = useState(false);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
        { title: 'Mantenimiento', href: `/costos/${project.id}/mantenimiento` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Mantenimiento · ${project.nombre}`} />
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <header>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Ecosistema autónomo por proyecto</p>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Documentos de mantenimiento</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{project.nombre}</p>
                    </header>

                    <form onSubmit={(event) => { event.preventDefault(); setProcessing(true); router.post(store(project.id).url, { nombre: name, moneda: 'PEN' }, { onFinish: () => setProcessing(false) }); }} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
                        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Nombre del documento" />
                        <button disabled={processing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={16} /> {processing ? 'Creando…' : 'Nuevo documento'}</button>
                    </form>

                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {documents.map((document) => (
                            <div key={document.public_id} className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500">
                                <Link href={`/costos/${project.id}/mantenimiento/${document.public_id}`} className="block">
                                    <FileSpreadsheet className="mb-4 text-blue-600 dark:text-blue-400" />
                                    <h2 className="font-semibold text-slate-900 dark:text-white">{document.nombre}</h2>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{document.moneda} · revisión {document.revision}</p>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`¿Eliminar "${document.nombre}"?`)) {
                                            router.delete(`/costos/${project.id}/mantenimiento/${document.public_id}`);
                                        }
                                    }}
                                    className="absolute right-3 top-3 rounded-md p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40"
                                    aria-label="Eliminar documento"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                        {documents.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay documentos.</p>}
                    </section>
                </div>
            </main>
        </AppLayout>
    );
}
