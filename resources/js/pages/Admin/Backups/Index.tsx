import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { DatabaseBackup, Download, Trash2, Clock, HardDrive, Play, Info } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';

interface BackupFile {
    name: string;
    path: string;
    size: string;
    date: string;
    timestamp: number;
}

interface Props {
    backups: BackupFile[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Copias de Seguridad', href: '/backups' },
];

export default function BackupsIndex({ backups }: Props) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        Swal.fire({
            title: '¿Generar copia de seguridad?',
            html: 'Esto realizará un respaldo de la base de datos principal y de todos los proyectos individuales de Costos.<br/><br/><span class="text-xs text-orange-500">Nota: El proceso puede tomar unos minutos dependiendo de la cantidad de proyectos.</span>',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Sí, generar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                setIsGenerating(true);
                router.post('/backups', {}, {
                    onSuccess: () => {
                        setIsGenerating(false);
                        Swal.fire('¡Éxito!', 'La copia de seguridad se ha generado correctamente.', 'success');
                    },
                    onError: (errors) => {
                        setIsGenerating(false);
                        Swal.fire('Error', 'Hubo un problema generando el backup.', 'error');
                    }
                });
            }
        });
    };

    const handleDelete = (name: string) => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        Swal.fire({
            title: '¿Eliminar backup?',
            text: `¿Estás seguro de que deseas eliminar ${name}? Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(`/backups/${name}`, {
                    onSuccess: () => {
                        Swal.fire('Eliminado', 'El archivo ha sido eliminado.', 'success');
                    }
                });
            }
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Copias de Seguridad" />

            <div className="flex flex-col gap-6 p-6 h-full w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                            <DatabaseBackup className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                Copias de Seguridad (Backups)
                            </h1>
                            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                                Gestión y restauración de la base de datos principal y tenants de Costos.
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
                            isGenerating ? 'bg-zinc-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isGenerating ? (
                            <>
                                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                                Generando...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-white" />
                                Crear Backup Ahora
                            </>
                        )}
                    </button>
                </div>

                {/* Instructions Box */}
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl p-5 flex gap-4">
                    <Info className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300">¿Cómo restaurar un backup en caso de emergencia?</h3>
                        <ol className="list-decimal list-inside text-sm text-blue-800/80 dark:text-blue-400/80 mt-2 space-y-1">
                            <li>Descarga el archivo <code>.zip</code> desde la tabla inferior haciendo clic en el botón azul.</li>
                            <li>Sube o envía el archivo <code>.zip</code> al servidor (mediante SFTP o consola).</li>
                            <li>Descomprime el archivo. Encontrarás la carpeta <code>db-dumps</code> con los archivos <code>.sql</code>.</li>
                            <li>Restaura usando la consola de MySQL: <code>mysql -u usuario -p base_de_datos &lt; archivo.sql</code></li>
                        </ol>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Nombre del Archivo</th>
                                    <th className="px-6 py-4 font-semibold">Peso</th>
                                    <th className="px-6 py-4 font-semibold">Fecha de Creación</th>
                                    <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {backups.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-zinc-500">
                                            No hay copias de seguridad generadas.
                                        </td>
                                    </tr>
                                ) : (
                                    backups.map((backup) => (
                                        <tr key={backup.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                <DatabaseBackup className="w-4 h-4 text-zinc-400" />
                                                {backup.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 w-fit">
                                                    <HardDrive className="w-3.5 h-3.5" />
                                                    {backup.size}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {backup.date}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <a
                                                        href={`/backups/${backup.name}`}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Descargar ZIP"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(backup.name)}
                                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
