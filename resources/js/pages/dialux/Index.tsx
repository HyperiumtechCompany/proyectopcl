import { Head, router } from '@inertiajs/react';
import { Lightbulb, Pencil, Plus, Search, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface DialuxProyecto {
    id: number;
    name: string;
    is_demo: boolean;
    demo_expires_at: string | null;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    proyectos: DialuxProyecto[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'DIAlux', href: '/dialux' }];

const dialuxProjectUrl = (id?: number) => (id === undefined ? '/dialux' : `/dialux/${id}`);

const swalDark = {
    background: '#101218',
    color: '#e4e4e7',
};

async function promptNombre(initial?: string): Promise<string | undefined> {
    const { value } = await Swal.fire({
        title: initial ? 'Renombrar proyecto' : 'Nuevo proyecto DIAlux',
        input: 'text',
        inputValue: initial ?? '',
        inputPlaceholder: 'Ej. Edificio Comercial Los Pinos',
        showCancelButton: true,
        confirmButtonText: initial ? 'Guardar' : 'Crear',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        ...swalDark,
        inputValidator: (value) => (value.trim() ? undefined : 'El nombre es obligatorio'),
    });

    return value ? (value as string).trim() : undefined;
}

export default function DialuxIndex({ proyectos }: PageProps) {
    const [search, setSearch] = useState('');

    const filtered = proyectos.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
        const name = await promptNombre();
        if (!name) {
            return;
        }

        router.post(dialuxProjectUrl(), { name });
    };

    const handleRename = async (proyecto: DialuxProyecto) => {
        const name = await promptNombre(proyecto.name);
        if (!name) {
            return;
        }

        router.patch(dialuxProjectUrl(proyecto.id), { name });
    };

    const handleDelete = async (proyecto: DialuxProyecto) => {
        const result = await Swal.fire({
            title: '¿Eliminar proyecto?',
            html: `<p class="text-sm text-zinc-400">Se eliminará <strong>${proyecto.name}</strong> y todo su dibujo.<br/>Esta acción no se puede deshacer.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            ...swalDark,
        });

        if (result.isConfirmed) {
            router.delete(dialuxProjectUrl(proyecto.id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="DIAlux" />

            <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-950 px-4 py-6 text-slate-100 sm:px-6">
                <div className="mx-auto w-full max-w-8xl">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 shadow-lg shadow-amber-950/40">
                                <Lightbulb className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">DIAlux</h1>
                                <p className="text-sm text-zinc-400">Editor lumínico 2D/3D — tus proyectos</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/30 transition hover:bg-amber-500 active:scale-[0.97]">
                            <Plus className="h-4 w-4" />
                            Nuevo proyecto
                        </button>
                    </div>

                    {proyectos.length > 0 && (
                        <div className="relative mb-5 max-w-sm">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar proyecto..."
                                className="w-full rounded-lg border border-white/10 bg-[#101218] py-2.5 pr-4 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                            />
                        </div>
                    )}

                    {proyectos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#101218] py-16 text-center">
                            <Lightbulb className="mb-3 h-10 w-10 text-zinc-600" />
                            <p className="text-sm font-medium text-zinc-300">Aún no tienes proyectos DIAlux</p>
                            <p className="mt-1 text-xs text-zinc-500">Crea tu primer proyecto para empezar a dibujar y calcular.</p>
                            <button onClick={handleCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500">
                                <Plus className="h-4 w-4" />
                                Crear proyecto
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                            {filtered.map((proyecto) => (
                                <div
                                    key={proyecto.id}
                                    onClick={() => router.get(dialuxProjectUrl(proyecto.id))}
                                    className="group relative cursor-pointer rounded-xl border border-white/10 bg-[#101218] p-4 shadow-sm transition-colors hover:border-white/25">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <h3 className="truncate text-sm font-semibold text-zinc-100">{proyecto.name}</h3>
                                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.get(`/dialux/${proyecto.id}/electrico`);
                                                }}
                                                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-amber-400"
                                                aria-label="Módulo eléctrico"
                                                title="Módulo eléctrico (luminarias, tomacorrientes, tableros)">
                                                <Zap size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleRename(proyecto);
                                                }}
                                                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                                                aria-label="Renombrar proyecto">
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleDelete(proyecto);
                                                }}
                                                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-rose-400"
                                                aria-label="Eliminar proyecto">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {proyecto.is_demo && (
                                        <span className="mb-2 inline-block rounded border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-400">
                                            Demo
                                        </span>
                                    )}

                                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                                        <span className="shrink-0 whitespace-nowrap">Creado {proyecto.created_at}</span>
                                        <span className="truncate whitespace-nowrap">Actualizado {proyecto.updated_at}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
