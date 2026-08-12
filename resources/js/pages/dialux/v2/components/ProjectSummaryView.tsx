import { Link } from '@inertiajs/react';
import {
    Activity,
    Boxes,
    CircleAlert,
    CircleCheck,
    FileDown,
    FileStack,
    Lightbulb,
    PlugZap,
    Zap,
} from 'lucide-react';
import { exportMethod as exportProjectSummary } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectSummaryController';
import type { DialuxV2Project, DialuxV2ProjectSummary } from '../types';

interface Props {
    project: DialuxV2Project;
    summary: DialuxV2ProjectSummary;
}

export function ProjectSummaryView({ project, summary }: Props) {
    const metrics = [
        ['Módulos', summary.totals.modules, Boxes],
        ['Ambientes', summary.totals.rooms, Activity],
        ['Planos', summary.totals.plans, FileStack],
        ['Luminarias', summary.totals.luminaires, Lightbulb],
        ['Tomacorrientes', summary.totals.outlets, PlugZap],
        [
            'Potencia instalada',
            `${summary.totals.installed_power_w.toLocaleString('es-PE')} W`,
            Zap,
        ],
        ['Ambientes conformes', summary.totals.compliant_rooms, CircleCheck],
        [
            'Ambientes no conformes',
            summary.totals.non_compliant_rooms,
            CircleAlert,
        ],
    ] as const;

    return (
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-semibold tracking-wider text-amber-600 uppercase">
                        Consolidado multi-módulo
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {project.name}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        Métricas técnicas y cumplimiento de todos los módulos.
                    </p>
                </div>
                <a
                    href={exportProjectSummary.url(project.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                    <FileDown className="h-4 w-4" /> Exportar PDF
                </a>
            </header>

            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map(([label, value, Icon]) => (
                    <article
                        key={label}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#101218]"
                    >
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                            <Icon className="h-4 w-4 text-amber-600" /> {label}
                        </div>
                        <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                            {value}
                        </p>
                    </article>
                ))}
            </section>

            <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101218]">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        Resultados por módulo
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase dark:bg-white/5 dark:text-zinc-400">
                            <tr>
                                <th className="px-4 py-3">Módulo</th>
                                <th className="px-3 py-3">Ambientes</th>
                                <th className="px-3 py-3">Luminarias</th>
                                <th className="px-3 py-3">Tomas</th>
                                <th className="px-3 py-3">Potencia</th>
                                <th className="px-3 py-3">Cumplen</th>
                                <th className="px-3 py-3">No cumplen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                            {summary.modules.map((module) => (
                                <tr
                                    key={module.id}
                                    className="text-slate-700 dark:text-zinc-300"
                                >
                                    <td className="px-4 py-3 font-medium">
                                        <Link
                                            href={`/dialux-v2/projects/${project.id}/modules/${module.id}`}
                                            className="hover:text-amber-600"
                                        >
                                            {module.name}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-3">
                                        {module.rooms_count}
                                    </td>
                                    <td className="px-3 py-3">
                                        {module.luminaires_count}
                                    </td>
                                    <td className="px-3 py-3">
                                        {module.outlets_count}
                                    </td>
                                    <td className="px-3 py-3">
                                        {module.installed_power_w.toLocaleString(
                                            'es-PE',
                                        )}{' '}
                                        W
                                    </td>
                                    <td className="px-3 py-3 text-emerald-600">
                                        {module.compliant_rooms}
                                    </td>
                                    <td className="px-3 py-3 text-rose-600">
                                        {module.non_compliant_rooms}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
