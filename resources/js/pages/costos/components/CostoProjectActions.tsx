import { router, usePage } from '@inertiajs/react';
import { ArrowRightLeft, LogOut, Pencil, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import Swal from 'sweetalert2';
import { remove as removeCollaborator, transfer as transferProject } from '@/actions/App/Http/Controllers/CostoProjectShareController';
import { CostoShareModal } from './CostoShareModal';

export type CostoAccess = 'owner' | 'editor' | 'viewer';

export interface CostoProjectAccessInfo {
    id: number;
    nombre: string;
    access: CostoAccess;
    owner_name: string | null;
}

const ACCESS_LABEL: Record<Exclude<CostoAccess, 'owner'>, string> = { editor: 'Editor', viewer: 'Lector' };

/** Etiqueta "Compartido contigo · Editor · de Fulano" para proyectos ajenos. */
export function CostoSharedBadge({ project }: { project: CostoProjectAccessInfo }) {
    if (project.access === 'owner') {
        return null;
    }

    return (
        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            Compartido · {ACCESS_LABEL[project.access]}
            {project.owner_name ? ` · de ${project.owner_name}` : ''}
        </span>
    );
}

/**
 * Acciones de una tarjeta/fila de proyecto según el acceso del usuario:
 * dueño → compartir, (gerencia) transferir, editar, eliminar; colaborador → salir.
 */
export function CostoProjectActions({
    project,
    canTransfer,
    onEdit,
    onDelete,
    compact = false,
}: {
    project: CostoProjectAccessInfo;
    canTransfer: boolean;
    onEdit: () => void;
    onDelete: () => void;
    compact?: boolean;
}) {
    const { auth } = usePage<{ auth: { user: { id: number } } }>().props;
    const [shareOpen, setShareOpen] = useState(false);
    const isOwner = project.access === 'owner';

    const transfer = async () => {
        const result = await Swal.fire({
            title: 'Transferir proyecto',
            html: `<p class="text-sm text-gray-500">«${project.nombre}» pasará a la cuenta del cliente. Tú y los colaboradores actuales perderán el acceso, y el Cuaderno quedará desconectado.</p>`,
            input: 'email',
            inputLabel: 'Correo de la cuenta del cliente',
            inputPlaceholder: 'cliente@empresa.com',
            showCancelButton: true,
            confirmButtonText: 'Transferir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#7c3aed',
        });

        if (!result.isConfirmed || !result.value) {
            return;
        }

        router.post(
            transferProject.url(project.id),
            { email: String(result.value) },
            {
                preserveScroll: true,
                onSuccess: () => void Swal.fire({ icon: 'success', title: 'Proyecto transferido', timer: 1800, showConfirmButton: false }),
                onError: (errors) => void Swal.fire({ icon: 'error', title: 'No se pudo transferir', text: Object.values(errors)[0] ?? '' }),
            },
        );
    };

    const leave = async () => {
        const result = await Swal.fire({
            title: '¿Salir del proyecto compartido?',
            text: `Dejarás de ver «${project.nombre}». El dueño puede volver a invitarte.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Salir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
        });

        if (result.isConfirmed) {
            router.delete(removeCollaborator.url({ costoProject: project.id, user: auth.user.id }));
        }
    };

    const btn = compact
        ? 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition'
        : 'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition';

    const stop = (fn: () => void) => (e: MouseEvent) => {
        e.stopPropagation();
        fn();
    };

    if (!isOwner) {
        return (
            <button type="button" onClick={stop(leave)} title="Salir del proyecto" className={`${btn} text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800`}>
                <LogOut className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                {!compact && 'Salir'}
            </button>
        );
    }

    return (
        <>
            <button type="button" onClick={stop(() => setShareOpen(true))} title="Compartir" className={`${btn} text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20`}>
                <Share2 className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                {!compact && 'Compartir'}
            </button>
            {canTransfer && (
                <button type="button" onClick={stop(() => void transfer())} title="Transferir a otra cuenta" className={`${btn} text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20`}>
                    <ArrowRightLeft className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                    {!compact && 'Transferir'}
                </button>
            )}
            <button type="button" onClick={stop(onEdit)} title="Editar proyecto" className={`${btn} text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20`}>
                <Pencil className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                {!compact && 'Editar'}
            </button>
            <button type="button" onClick={stop(onDelete)} title="Eliminar proyecto" className={`${btn} text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20`}>
                <Trash2 className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                {!compact && 'Eliminar'}
            </button>
            {/* Los eventos de React cruzan el portal del Dialog: sin esto, un clic dentro abriría la tarjeta. */}
            <span className="contents" onClick={(e) => e.stopPropagation()}>
                <CostoShareModal projectId={project.id} projectName={project.nombre} open={shareOpen} onOpenChange={setShareOpen} />
            </span>
        </>
    );
}
