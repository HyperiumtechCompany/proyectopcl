import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    DatabaseBackup,
    Download,
    Trash2,
    Clock,
    HardDrive,
    Play,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
    Server,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

interface DatabaseFile {
    database: string;
    label: string;
    is_central: boolean;
    size: string;
    size_bytes: number;
}
interface Backup {
    date: string;
    time: string;
    databases: DatabaseFile[];
    count: number;
    total_size: string;
    total_bytes: number;
}
interface Props {
    backups: Backup[];
    status: {
        last_ok: string | null;
        last_failed: string | null;
        disk_free: string;
        disk_total: string;
    };
    canRestore: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Copias de Seguridad', href: '/backups' },
];

const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-PE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

export default function BackupsIndex({ backups, status, canRestore }: Props) {
    const flash = (usePage().props as { flash?: { success?: string; error?: string } }).flash;
    useEffect(() => {
        if (flash?.success) Swal.fire({ icon: 'success', title: 'Listo', text: flash.success, timer: 4000, showConfirmButton: false });
        else if (flash?.error) Swal.fire({ icon: 'error', title: 'Error', text: flash.error });
    }, [flash?.success, flash?.error]);

    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState<string | null>(backups[0]?.date ?? null);
    const [restoreTarget, setRestoreTarget] = useState<{ date: string; db: DatabaseFile } | null>(null);
    const [confirmText, setConfirmText] = useState('');

    const runBackup = () => {
        Swal.fire({
            title: '¿Crear una copia de seguridad ahora?',
            text: 'Respalda la base central y todos los proyectos de Costos. Toma unos segundos.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, crear',
            cancelButtonText: 'Cancelar',
        }).then((r) => {
            if (!r.isConfirmed) return;
            setBusy(true);
            router.post('/backups', {}, {
                preserveScroll: true,
                onFinish: () => setBusy(false),
            });
        });
    };

    const del = (date: string) => {
        Swal.fire({
            title: `¿Eliminar el backup del ${date}?`,
            text: 'Se borran todos los .sql.gz de esa fecha. No se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
        }).then((r) => {
            if (r.isConfirmed) router.delete(`/backups/${date}`, { preserveScroll: true });
        });
    };

    const doRestore = () => {
        if (!restoreTarget || confirmText !== restoreTarget.db.database) return;
        setBusy(true);
        router.post('/backups/restore', {
            date: restoreTarget.date,
            database: restoreTarget.db.database,
            confirm: confirmText,
        }, {
            preserveScroll: true,
            onFinish: () => {
                setBusy(false);
                setRestoreTarget(null);
                setConfirmText('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Copias de Seguridad" />

            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 p-6">
                {/* Header */}
                <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/30">
                            <DatabaseBackup className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Copias de Seguridad</h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Base central + proyectos de Costos · respaldo diario 02:15 · retención 14 días
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runBackup}
                        disabled={busy}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
                            busy ? 'cursor-not-allowed bg-zinc-400' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {busy ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Play className="h-4 w-4 fill-white" />
                        )}
                        Crear backup ahora
                    </button>
                </div>

                {/* Status */}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        {status.last_failed ? (
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                        )}
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Última corrida</p>
                            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {status.last_failed
                                    ? `FALLÓ ${status.last_failed}`
                                    : status.last_ok || 'sin registro'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <HardDrive className="h-5 w-5 shrink-0 text-zinc-400" />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Disco libre</p>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {status.disk_free} <span className="text-zinc-400">/ {status.disk_total}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <Server className="h-5 w-5 shrink-0 text-zinc-400" />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Copias guardadas</p>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{backups.length}</p>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    {backups.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-zinc-500">
                            No hay copias de seguridad todavía. Usá «Crear backup ahora».
                        </div>
                    ) : (
                        backups.map((b) => {
                            const isOpen = open === b.date;
                            return (
                                <div key={b.date} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <button
                                            onClick={() => setOpen(isOpen ? null : b.date)}
                                            className="flex flex-1 items-center gap-3 text-left"
                                        >
                                            {isOpen ? (
                                                <ChevronDown className="h-4 w-4 text-zinc-400" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                                            )}
                                            <div>
                                                <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                                                    {fmtDate(b.date)}
                                                </p>
                                                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                    <Clock className="h-3 w-3" /> {b.time} · {b.count} BD · {b.total_size}
                                                </p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => del(b.date)}
                                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Eliminar esta fecha"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {isOpen && (
                                        <div className="bg-zinc-50/60 px-4 pb-3 dark:bg-zinc-800/20">
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                    {b.databases.map((d) => (
                                                        <tr key={d.database}>
                                                            <td className="py-2 pr-3">
                                                                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                                                    {d.label}
                                                                    {d.is_central && (
                                                                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                                            CENTRAL
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="font-mono text-[11px] text-zinc-400">{d.database}</p>
                                                            </td>
                                                            <td className="py-2 pr-3 whitespace-nowrap text-xs text-zinc-500">{d.size}</td>
                                                            <td className="py-2 text-right whitespace-nowrap">
                                                                <a
                                                                    href={`/backups/${b.date}/${d.database}`}
                                                                    className="mr-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" /> Descargar
                                                                </a>
                                                                {canRestore && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setRestoreTarget({ date: b.date, db: d });
                                                                            setConfirmText('');
                                                                        }}
                                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                                                    >
                                                                        <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {!canRestore && (
                    <p className="text-xs text-zinc-400">
                        La restauración solo está disponible para el rol <b>root</b>.
                    </p>
                )}
            </div>

            {/* Restore modal */}
            {restoreTarget && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                        <div className="flex items-start justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Restaurar base de datos</h2>
                            </div>
                            <button onClick={() => setRestoreTarget(null)} className="text-zinc-400 hover:text-zinc-600">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 p-4 text-sm">
                            <p className="text-zinc-600 dark:text-zinc-300">
                                Vas a reemplazar <b>{restoreTarget.db.label}</b> con la copia del{' '}
                                <b>{restoreTarget.date}</b>. Los datos actuales de esa BD se{' '}
                                <b className="text-red-600">sobrescriben</b> — pero antes se guarda una copia
                                automática (podés volver atrás desde esta misma pantalla).
                            </p>
                            <div>
                                <label className="text-xs font-medium text-zinc-500">
                                    Escribí <span className="font-mono text-zinc-700 dark:text-zinc-300">{restoreTarget.db.database}</span> para confirmar
                                </label>
                                <input
                                    autoFocus
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950"
                                    placeholder={restoreTarget.db.database}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-zinc-100 p-4 dark:border-zinc-800">
                            <button
                                onClick={() => setRestoreTarget(null)}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={doRestore}
                                disabled={busy || confirmText !== restoreTarget.db.database}
                                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                                Restaurar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
