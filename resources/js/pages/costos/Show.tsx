import { Link, router, usePage } from '@inertiajs/react';
import React, { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import {
    ArrowLeft, Building2, Calendar, Code2, Hash, Layers,
    MapPin, AlertTriangle, Trash2, ChevronRight, Ruler,
    ClipboardList, DollarSign, FileText, Zap, Wifi,
    Flame, BarChart3, TrendingUp, Package, BookOpen,
    CheckCircle2, Clock, Shield, Map, Home, Droplets,
} from 'lucide-react';

interface ProjectDetail {
    id: number; nombre: string; uei: string | null; unidad_ejecutora: string | null;
    codigo_snip: string | null; codigo_cui: string | null; codigo_local: string | null;
    fecha_inicio: string | null; fecha_fin: string | null;
    codigos_modulares: Record<string, string> | null;
    departamento_id: string | null; provincia_id: string | null; distrito_id: string | null;
    departamento_nombre?: string | null; provincia_nombre?: string | null; distrito_nombre?: string | null;
    centro_poblado: string | null; status: string; modules: string[]; created_at: string;
}

interface PageProps { project: ProjectDetail; [key: string]: unknown; }

// ─── Module metadata ───────────────────────────────────────────────────────────
type ModuleGroup = 'metrado' | 'presupuesto' | 'crono' | 'etts';

interface ModuleMeta {
    label: string;
    group: ModuleGroup;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    order?: number;
}

const MODULE_MAP: Record<string, ModuleMeta> = {
    metrado_arquitectura:       { label: '2: Arquitectura',       group: 'metrado',     icon: Ruler,    order: 2 },
    metrado_estructura:         { label: '3: Estructuras',        group: 'metrado',     icon: Layers,   order: 3 },
    metrado_sanitarias:         { label: '4: Sanitarias',         group: 'metrado',     icon: Droplets, order: 4 },
    metrado_electricas:         { label: '5: Eléctricas',         group: 'metrado',     icon: Zap,      order: 5 },
    metrado_comunicaciones:     { label: '6: Comunicaciones',     group: 'metrado',     icon: Wifi,     order: 6 },
    metrado_gas:                { label: '7: Gas',                group: 'metrado',     icon: Flame,    order: 7 },
    presupuesto:                { label: 'Presupuesto',           group: 'presupuesto', icon: DollarSign },
    presupuesto_gg:             { label: 'Gastos Generales',      group: 'presupuesto', icon: BarChart3 },
    presupuesto_insumos:        { label: 'Insumos',               group: 'presupuesto', icon: Package },
    presupuesto_remuneraciones: { label: 'Remuneraciones',        group: 'presupuesto', icon: DollarSign },
    presupuesto_acus:           { label: 'ACUs',                  group: 'presupuesto', icon: FileText },
    presupuesto_indice:         { label: 'Índice',                group: 'presupuesto', icon: BookOpen },
    crono_general:              { label: 'Cronograma General',    group: 'crono',       icon: Calendar },
    crono_valorizado:           { label: 'Cronograma Valorizado', group: 'crono',       icon: TrendingUp },
    crono_materiales:           { label: 'Cron. Materiales',      group: 'crono',       icon: Package },
    etts:                       { label: 'ETTs',                  group: 'etts',        icon: ClipboardList },
};

// Orden fijo de grupos
const GROUP_ORDER: ModuleGroup[] = ['metrado', 'presupuesto', 'crono', 'etts'];

const GROUP_CONFIG: Record<ModuleGroup, { label: string }> = {
    metrado:     { label: 'Metrados' },
    presupuesto: { label: 'Presupuesto' },
    crono:       { label: 'Cronogramas' },
    etts:        { label: 'ETTs' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function moduleHref(project_id: number, m: string): string {
    if (m === 'presupuesto')        return `/costos/proyectos/${project_id}/presupuesto`;
    if (m === 'metrado_sanitarias') return `/costos/${project_id}/metrado-sanitarias`;
    if (m === 'metrado_estructura') return `/costos/${project_id}/metrado-estructuras`;
    return `/costos/${project_id}/module/${m}`;
}

function groupModules(modules: string[]): Partial<Record<ModuleGroup, string[]>> {
    const grouped: Partial<Record<ModuleGroup, string[]>> = {};
    for (const m of modules) {
        const group = MODULE_MAP[m]?.group ?? 'etts';
        (grouped[group] ??= []).push(m);
    }

    // Ordenar módulos dentro de cada grupo según su propiedad order
    Object.keys(grouped).forEach((group) => {
        grouped[group as ModuleGroup]?.sort((a, b) => {
            const orderA = MODULE_MAP[a]?.order ?? 999;
            const orderB = MODULE_MAP[b]?.order ?? 999;
            return orderA - orderB;
        });
    });

    return grouped;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function InfoField({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
    return (
        <div className="space-y-0.5">
            <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {Icon && <Icon size={10} />}
                {label}
            </dt>
            <dd className="text-sm font-medium text-gray-800 dark:text-gray-100">{value}</dd>
        </div>
    );
}

function SectionTitle({
    icon: Icon,
    children,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            <Icon size={12} />
            {children}
        </h2>
    );
}

function ModuleCard({ module, projectId }: { module: string; projectId: number }) {
    const meta = MODULE_MAP[module];
    const Icon = meta?.icon ?? FileText;
    const label = meta?.label ?? module;

    return (
        <Link
            href={moduleHref(projectId, module)}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition-all duration-150 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                <Icon size={15} />
            </span>
            <span className="flex-1 font-medium leading-tight">{label}</span>
            <ChevronRight
                size={13}
                className="shrink-0 text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500"
            />
        </Link>
    );
}

function StatusBadge({ status }: { status: string }) {
    const isActive = status === 'active' || status === 'activo';
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                isActive
                    ? 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800'
                    : 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-600'
            }`}
        >
            {isActive ? <CheckCircle2 size={11} /> : <Clock size={11} />}
            {isActive ? 'Activo' : status}
        </span>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Show() {
    const { project } = usePage<PageProps>().props;
    const [confirmDelete, setConfirmDelete] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project.nombre, href: `/costos/${project.id}` },
    ];

    const identificationFields = [
        { label: 'UEI',              value: project.uei,              icon: Building2 },
        { label: 'Unidad Ejecutora', value: project.unidad_ejecutora, icon: Shield },
        { label: 'Código SNIP',      value: project.codigo_snip,      icon: Hash },
        { label: 'Código CUI',       value: project.codigo_cui,       icon: Code2 },
        { label: 'Código Local',     value: project.codigo_local,     icon: Hash },
        { label: 'Fecha Inicio',     value: project.fecha_inicio,     icon: Calendar },
        { label: 'Fecha Fin',        value: project.fecha_fin,        icon: Calendar },
    ].filter((i): i is typeof i & { value: string } => Boolean(i.value));

    const locationFields = [
        { label: 'Departamento',   value: project.departamento_nombre || project.departamento_id, icon: Map },
        { label: 'Provincia',      value: project.provincia_nombre || project.provincia_id,    icon: Map },
        { label: 'Distrito',       value: project.distrito_nombre || project.distrito_id,     icon: MapPin },
        { label: 'Centro Poblado', value: project.centro_poblado,  icon: Home },
    ].filter((i): i is typeof i & { value: string } => Boolean(i.value));

    const groupedModules = groupModules(project.modules);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full max-w-8xl space-y-2 px-4 py-8">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div>
                    <Link
                        href="/costos"
                        className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                        <ArrowLeft size={13} /> Volver a Proyectos
                    </Link>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <h1 className="max-w-2xl text-xl font-semibold leading-snug tracking-tight text-gray-900 dark:text-gray-50">
                            {project.nombre}
                        </h1>
                        <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock size={11} /> Creado: {project.created_at}
                        </span>
                        <span className="text-gray-200 dark:text-gray-700">·</span>
                        <span className="flex items-center gap-1">
                            <Layers size={11} /> {project.modules.length} módulos habilitados
                        </span>
                    </p>
                </div>
                <div className="flex flex-row gap-3 items-center justify-center">
                    {/* ── Información General ─────────────────────────────────── */}
                    {(identificationFields.length > 0 || locationFields.length > 0) && (
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
                            <SectionTitle icon={Building2}>Información General</SectionTitle>

                            {identificationFields.length > 0 && (
                                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                                    {identificationFields.map(i => (
                                        <InfoField key={i.label} label={i.label} value={i.value} icon={i.icon} />
                                    ))}
                                </dl>
                            )}

                            {/* Ubicación */}
                            {locationFields.length > 0 && (
                                <div className={identificationFields.length > 0 ? 'mt-5 border-t border-gray-100 pt-5 dark:border-gray-700' : ''}>
                                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        <MapPin size={10} /> Ubicación
                                    </p>
                                    <dl className="grid grid-rows-2 gap-x-8 gap-y-4 sm:grid-rows-4">
                                        {locationFields.map(i => (
                                            <InfoField key={i.label} label={i.label} value={i.value} icon={i.icon} />
                                        ))}
                                    </dl>
                                </div>
                            )}

                            {/* Códigos Modulares */}
                            {project.codigos_modulares && Object.keys(project.codigos_modulares).length > 0 && (
                                <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
                                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        <Code2 size={10} /> Códigos Modulares
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(project.codigos_modulares).map(([k, v]) => (
                                            <span
                                                key={k}
                                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                            >
                                                <span className="text-gray-400 dark:text-gray-500">{k}:</span>
                                                <strong className="font-semibold">{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* ── Módulos ─────────────────────────────────────────────── */}
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
                        <SectionTitle icon={Layers}>Módulos Habilitados</SectionTitle>

                        <div className="space-y-6">
                            {GROUP_ORDER.map(group => {
                                const mods = groupedModules[group];
                                if (!mods?.length) return null;
                                return (
                                    <div key={group}>
                                        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            {GROUP_CONFIG[group].label}
                                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                                                {mods.length}
                                            </span>
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {mods.map(m => (
                                                <ModuleCard key={m} module={m} projectId={project.id} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="mt-5 text-xs text-gray-400 dark:text-gray-500">
                            Los módulos se activarán conforme se implementen en fases posteriores.
                        </p>
                    </section>
                </div>

                {/* ── Zona de Peligro ─────────────────────────────────────── */}
                <section className="rounded-xl border border-red-100 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/20">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400">
                            <AlertTriangle size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Zona de Peligro</h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-red-500/90 dark:text-red-400/60">
                                Eliminar este proyecto borrará permanentemente su base de datos aislada y todos los datos asociados. Esta acción no puede revertirse.
                            </p>
                            <div className="mt-3">
                                {!confirmDelete ? (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/30"
                                    >
                                        <Trash2 size={12} /> Eliminar Proyecto
                                    </button>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                            ¿Confirmar eliminación?
                                        </span>
                                        <button
                                            onClick={() => router.delete(`/costos/${project.id}`)}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                                        >
                                            <Trash2 size={12} /> Sí, eliminar
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(false)}
                                            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </AppLayout>
    );
}