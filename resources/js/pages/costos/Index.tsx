import { Link, router, usePage } from '@inertiajs/react';
import {
    FolderOpen, Plus, Pencil, Trash2, ChevronRight,
    LayoutGrid, List, Search, Building2, Hash,
    Layers, Clock, CheckCircle2, Archive,
    FileX, SlidersHorizontal, TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Project {
    id: number;
    nombre: string;
    uei: string | null;
    unidad_ejecutora: string | null;
    codigo_cui: string | null;
    status: 'active' | 'archived';
    modules_count: number;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    projects: Project[];
    [key: string]: unknown;
}

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'active' | 'archived';

function timeAgo(dateStr: string): string {
    // Si ya es un texto como "hace X min/horas/días", devolverlo directamente
    if (dateStr.startsWith('hace')) {
        return dateStr;
    }
    
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} días`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Index() {
    const { projects } = usePage<PageProps>().props;
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    const filtered = projects.filter(p => {
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        const q = search.toLowerCase();
        const matchSearch = !q ||
            p.nombre.toLowerCase().includes(q) ||
            (p.codigo_cui ?? '').toLowerCase().includes(q) ||
            (p.unidad_ejecutora ?? '').toLowerCase().includes(q) ||
            (p.uei ?? '').toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    const activeCount = projects.filter(p => p.status === 'active').length;
    const archivedCount = projects.filter(p => p.status === 'archived').length;
    const totalModules = projects.reduce((a, p) => a + p.modules_count, 0);

    const confirmEdit = async (project: Project) => {
        const result = await Swal.fire({
            title: 'Editar proyecto',
            text: `Vas a editar "${project.nombre}" y sus módulos asociados.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, editar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
        });
        if (result.isConfirmed) router.get(`/costos/${project.id}/edit`);
    };

    const confirmDelete = async (project: Project) => {
        const result = await Swal.fire({
            title: '¿Eliminar proyecto?',
            html: `<p class="text-sm text-gray-500">Se eliminará <strong>${project.nombre}</strong> y toda su base de datos asociada.<br/>Esta acción no se puede deshacer.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
        });
        if (result.isConfirmed) router.delete(`/costos/${project.id}`);
    };

    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Costos', href: '/costos' }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
                <div className="mx-auto w-full max-w-8xl px-6 py-8">

                    {/* ── PAGE HEADER ─────────────────────────────────────── */}
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-200 dark:shadow-blue-900/40">
                                <FolderOpen className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Proyectos de Costos
                                </h1>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    Gestión de expedientes técnicos y bases de datos aisladas
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/costos/create"
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.97] dark:shadow-blue-900/30">
                            <Plus className="h-4 w-4" />
                            Nuevo Proyecto
                        </Link>
                    </div>

                    {/* ── STATS ROW ───────────────────────────────────────── */}
                    {projects.length > 0 && (
                        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            {[
                                { label: 'Total proyectos', value: projects.length, icon: FolderOpen, color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-900/50' },
                                { label: 'Activos', value: activeCount, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900/50' },
                                { label: 'Archivados', value: archivedCount, icon: Archive, color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
                                { label: 'Total módulos', value: totalModules, icon: Layers, color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-900/50' },
                            ].map(({ label, value, icon: Icon, color, border }) => (
                                <div key={label} className={`flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900 ${border}`}>
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── TOOLBAR ─────────────────────────────────────────── */}
                    {projects.length > 0 && (
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* Search */}
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar por nombre, CUI, entidad…"
                                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Status filter */}
                                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                                    <SlidersHorizontal className="ml-1.5 h-3.5 w-3.5 text-gray-400" />
                                    {(['all', 'active', 'archived'] as FilterStatus[]).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setFilterStatus(s)}
                                            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all
                                                ${filterStatus === s
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                                            {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Archivados'}
                                        </button>
                                    ))}
                                </div>

                                {/* View toggle */}
                                <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`rounded-md p-1.5 transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`rounded-md p-1.5 transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                        <List className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── EMPTY STATE ─────────────────────────────────────── */}
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center dark:border-gray-800 dark:bg-gray-900">
                            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                                <FolderOpen className="h-10 w-10 text-gray-400" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Sin proyectos aún</h3>
                            <p className="mb-6 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                                Crea tu primer proyecto de costos para gestionar expedientes técnicos.
                            </p>
                            <Link
                                href="/costos/create"
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 dark:shadow-blue-900/30">
                                <Plus className="h-4 w-4" />
                                Crear primer proyecto
                            </Link>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
                            <FileX className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Sin resultados</p>
                            <p className="mt-1 text-xs text-gray-400">Intenta con otro término o filtro</p>
                            <button onClick={() => { setSearch(''); setFilterStatus('all'); }} className="mt-4 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Limpiar filtros</button>
                        </div>

                    ) : viewMode === 'grid' ? (

                        /* ── GRID VIEW ────────────────────────────────────── */
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {filtered.map(p => (
                                console.log(p),
                                <div
                                    key={p.id}
                                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800"
                                    onClick={() => router.get(`/costos/${p.id}`)}>
                                    {/* Top accent bar */}
                                    <div className={`h-1 w-full ${p.status === 'active' ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gray-300 dark:bg-gray-700'}`} />

                                    <div className="flex flex-1 flex-col p-5">
                                        {/* Header */}
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.status === 'active' ? 'bg-blue-100 dark:bg-blue-950/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                    <FolderOpen className={`h-4 w-4 ${p.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                                                        {p.nombre}
                                                    </h3>
                                                </div>
                                            </div>
                                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                                                ${p.status === 'active'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {p.status === 'active'
                                                    ? <><CheckCircle2 className="h-3 w-3" />Activo</>
                                                    : <><Archive className="h-3 w-3" />Archivado</>}
                                            </span>
                                        </div>

                                        {/* Meta info */}
                                        <div className="mb-4 space-y-2">
                                            {p.codigo_cui && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <Hash className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">CUI: {p.codigo_cui}</span>
                                                </div>
                                            )}
                                            {p.unidad_ejecutora && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                                    <span className="truncate">{p.unidad_ejecutora}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer stats */}
                                        <div className="mt-auto border-t border-gray-100 pt-4 dark:border-gray-800">
                                            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Layers className="h-3.5 w-3.5" />
                                                    <span className="font-semibold text-gray-600 dark:text-gray-300">{p.modules_count}</span>
                                                    <span>módulos *(Plugins de costos)</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{timeAgo(p.updated_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action bar */}
                                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                                        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                            <TrendingUp className="h-3.5 w-3.5" />
                                            <span>Ver expediente</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={async (e) => { e.stopPropagation(); await confirmEdit(p); }}
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                                title="Editar proyecto">
                                                <Pencil className="h-3.5 w-3.5" />
                                                Editar
                                            </button>
                                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                                            <button
                                                onClick={async (e) => { e.stopPropagation(); await confirmDelete(p); }}
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                title="Eliminar proyecto">
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    ) : (

                        /* ── LIST VIEW ────────────────────────────────────── */
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            {/* Table header */}
                            <div className="grid grid-cols-12 border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-800 dark:bg-gray-800/60">
                                <div className="col-span-5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Proyecto</div>
                                <div className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estado</div>
                                <div className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Módulos</div>
                                <div className="col-span-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Actualización</div>
                                <div className="col-span-1" />
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filtered.map(p => (
                                    <div
                                        key={p.id}
                                        className="group grid grid-cols-12 cursor-pointer items-center px-6 py-4 transition hover:bg-blue-50/50 dark:hover:bg-blue-950/10"
                                        onClick={() => router.get(`/costos/${p.id}`)}>
                                        {/* Name + meta */}
                                        <div className="col-span-5 flex items-center gap-3 pr-4">
                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.status === 'active' ? 'bg-blue-100 dark:bg-blue-950/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                <FolderOpen className={`h-4 w-4 ${p.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">{p.nombre}</p>
                                                <div className="mt-0.5 flex items-center gap-3">
                                                    {p.codigo_cui && (
                                                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                            <Hash className="h-3 w-3" />CUI: <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">{p.codigo_cui}</span>
                                                        </span>
                                                    )}
                                                    {p.unidad_ejecutora && (
                                                        <span className="flex items-center gap-1 truncate text-[11px] text-gray-400">
                                                            <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{p.unidad_ejecutora}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-2">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide
                                                ${p.status === 'active'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {p.status === 'active'
                                                    ? <CheckCircle2 className="h-3 w-3" />
                                                    : <Archive className="h-3 w-3" />}
                                                {p.status === 'active' ? 'Activo' : 'Archivado'}
                                            </span>
                                        </div>

                                        {/* Modules */}
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <Layers className="h-4 w-4 text-violet-400" />
                                                <span className="font-bold text-gray-800 dark:text-gray-200">{p.modules_count}</span>
                                                <span className="text-xs text-gray-400">módulos</span>
                                            </div>
                                        </div>

                                        {/* Updated at */}
                                        <div className="col-span-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                            {timeAgo(p.updated_at)}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex items-center justify-end gap-1">
                                            <button
                                                onClick={async (e) => { e.stopPropagation(); await confirmEdit(p); }}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                                                title="Editar">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={async (e) => { e.stopPropagation(); await confirmDelete(p); }}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                title="Eliminar">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <ChevronRight className="ml-1 h-4 w-4 text-gray-300 dark:text-gray-600" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Table footer */}
                            <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 dark:border-gray-800 dark:bg-gray-800/40">
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Mostrando <span className="font-bold text-gray-600 dark:text-gray-300">{filtered.length}</span> de <span className="font-bold text-gray-600 dark:text-gray-300">{projects.length}</span> proyectos
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}