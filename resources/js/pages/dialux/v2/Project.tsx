import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    Boxes,
    Lightbulb,
    ShieldCheck,
    Zap,
} from 'lucide-react';
import { show as showProjectSummary } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectSummaryController';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { ModuleCard } from './components/ModuleCard';
import { ModuleSidebar } from './components/ModuleSidebar';
import { useModuleActions } from './hooks/useModuleActions';
import type { DialuxV2Module, DialuxV2Project } from './types';

interface Props {
    project: DialuxV2Project;
    modules: DialuxV2Module[];
}

export default function DialuxV2Project({ project, modules }: Props) {
    const actions = useModuleActions({ projectId: project.id, modules });
    const designModules = modules.filter((module) => module.kind !== 'general');
    const totals = designModules.reduce(
        (summary, module) => ({
            rooms: summary.rooms + (module.rooms_count ?? 0),
            luminaires: summary.luminaires + (module.luminaires_count ?? 0),
            power: summary.power + Number(module.installed_power_w ?? 0),
        }),
        { rooms: 0, luminaires: 0, power: 0 },
    );

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'DIALux v2', href: '/dialux-v2' },
        { title: project.name, href: `/dialux-v2/projects/${project.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${project.name} — DIALux v2`} />
            <div className="flex h-[calc(100vh-4rem)] min-h-0 bg-slate-100 dark:bg-slate-950">
                <ModuleSidebar
                    projectId={project.id}
                    modules={modules}
                    actions={actions}
                />

                <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="mx-auto max-w-7xl">
                        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-600 uppercase">
                                    <Boxes className="h-4 w-4" /> Proyecto
                                    modular
                                </div>
                                <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                                    {project.name}
                                </h1>
                                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                                    {project.description ??
                                        'Administra módulos independientes y revisa el avance consolidado.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    href={showProjectSummary(project.id)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                                >
                                    <BarChart3 className="h-4 w-4" /> Ver
                                    consolidado
                                </Link>
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                    {designModules.length} / 25 módulos
                                </span>
                            </div>
                        </header>

                        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard
                                icon={Boxes}
                                label="Módulos"
                                value={designModules.length.toString()}
                            />
                            <SummaryCard
                                icon={Activity}
                                label="Ambientes"
                                value={totals.rooms.toString()}
                            />
                            <SummaryCard
                                icon={Lightbulb}
                                label="Luminarias"
                                value={totals.luminaires.toString()}
                            />
                            <SummaryCard
                                icon={Zap}
                                label="Potencia instalada"
                                value={`${totals.power.toLocaleString('es-PE')} W`}
                            />
                        </section>

                        <div className="mt-8 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold text-slate-900 dark:text-white">
                                    Resumen por módulo
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Selecciona una tarjeta para abrir su editor
                                    independiente.
                                </p>
                            </div>
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                        </div>

                        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {modules.map((module, index) => (
                                <ModuleCard
                                    key={module.id}
                                    projectId={project.id}
                                    module={module}
                                    disabled={actions.busy}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < modules.length - 1}
                                    onRename={actions.rename}
                                    onDuplicate={actions.duplicate}
                                    onDelete={actions.remove}
                                    onMove={actions.move}
                                />
                            ))}
                        </section>
                    </div>
                </main>
            </div>
        </AppLayout>
    );
}

function SummaryCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Boxes;
    label: string;
    value: string;
}) {
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#101218]">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <Icon className="h-4 w-4 text-amber-600" />
                <span className="text-xs">{label}</span>
            </div>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {value}
            </p>
        </article>
    );
}
