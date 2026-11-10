import axios from 'axios';
import { Copy, Eye, Pencil, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    remove as removeCollaborator,
    share as shareProject,
    show as showSharing,
    updateRole as updateCollaboratorRole,
} from '@/actions/App/Http/Controllers/CostoProjectShareController';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ShareRole = 'editor' | 'viewer';

interface Collaborator {
    id: number;
    name: string;
    email: string;
    role: ShareRole;
}

interface SharePayload {
    can_share: boolean;
    codes: Record<ShareRole, string | null>;
    collaborators: Collaborator[];
    message?: string;
}

const ROLE_LABEL: Record<ShareRole, string> = { editor: 'Editor', viewer: 'Lector' };
const ROLE_HINT: Record<ShareRole, string> = {
    editor: 'Te ayuda: puede ver y modificar el proyecto.',
    viewer: 'Solo puede ver y exportar; no puede cambiar nada.',
};

function firstError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        const fieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;

        return fieldError ?? data?.message ?? 'No se pudo completar la acción.';
    }

    return 'No se pudo completar la acción.';
}

/**
 * Compartir un proyecto de Costos (solo dueño): código del sistema por permiso
 * e invitación directa por correo; lista de colaboradores con su permiso.
 */
export function CostoShareModal({
    projectId,
    projectName,
    open,
    onOpenChange,
}: {
    projectId: number;
    projectName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [data, setData] = useState<SharePayload | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<ShareRole>('editor');

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;
        axios
            .get<SharePayload>(showSharing.url(projectId))
            .then((response) => {
                if (!cancelled) {
                    setData(response.data);
                }
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setError(firstError(e));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, projectId]);

    const run = async (request: () => Promise<{ data: SharePayload }>) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await request();
            setData(response.data);
            if (response.data.message) {
                setNotice(response.data.message);
            }
        } catch (e) {
            setError(firstError(e));
        } finally {
            setBusy(false);
        }
    };

    const generateCode = (role: ShareRole, regenerate = false) =>
        run(() => axios.post<SharePayload>(shareProject.url(projectId), { role, regenerate }));

    const invite = async () => {
        await run(() => axios.post<SharePayload>(shareProject.url(projectId), { role: inviteRole, email: email.trim() }));
        setEmail('');
    };

    const changeRole = (userId: number, role: ShareRole) =>
        run(() => axios.patch<SharePayload>(updateCollaboratorRole.url({ costoProject: projectId, user: userId }), { role }));

    const removeUser = (userId: number) =>
        run(() => axios.delete<SharePayload>(removeCollaborator.url({ costoProject: projectId, user: userId })));

    const copy = (code: string) => {
        void navigator.clipboard?.writeText(code);
        setNotice(`Código ${code} copiado.`);
    };

    const inputCls =
        'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setError(null);
                    setNotice(null);
                }
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Compartir proyecto</DialogTitle>
                    <DialogDescription className="truncate">{projectName}</DialogDescription>
                </DialogHeader>

                {data === null && !error && <p className="text-sm text-gray-500">Cargando…</p>}

                {error && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                        {error}
                    </p>
                )}
                {notice && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {notice}
                    </p>
                )}

                {data && !data.can_share && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">Compartir proyectos requiere un plan de pago. Sube de plan para invitar colaboradores.</p>
                )}

                {data?.can_share && (
                    <div className="space-y-5">
                        {/* Códigos del sistema */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Código para compartir</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Cualquier usuario de Proyecta PCL puede unirse con el código desde Costos → «Unirse con código».
                            </p>
                            {(['editor', 'viewer'] as ShareRole[]).map((role) => {
                                const code = data.codes[role];

                                return (
                                    <div key={role} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                        {role === 'editor' ? <Pencil className="h-4 w-4 shrink-0 text-amber-500" /> : <Eye className="h-4 w-4 shrink-0 text-sky-500" />}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ROLE_LABEL[role]}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{ROLE_HINT[role]}</p>
                                        </div>
                                        {code ? (
                                            <div className="flex items-center gap-1">
                                                <span className="rounded bg-gray-100 px-2 py-1 font-mono text-sm font-bold tracking-widest text-gray-800 dark:bg-gray-800 dark:text-gray-100">{code}</span>
                                                <button type="button" title="Copiar" disabled={busy} onClick={() => copy(code)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                                                    <Copy className="h-4 w-4" />
                                                </button>
                                                <button type="button" title="Cambiar código (el anterior deja de funcionar)" disabled={busy} onClick={() => generateCode(role, true)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                                                    <RefreshCw className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" disabled={busy} onClick={() => generateCode(role)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                                Generar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </section>

                        {/* Invitar por correo */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Invitar por correo</h3>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" className={inputCls} />
                                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ShareRole)} className={`${inputCls} sm:w-32`}>
                                    <option value="editor">Editor</option>
                                    <option value="viewer">Lector</option>
                                </select>
                                <button type="button" disabled={busy || email.trim() === ''} onClick={invite} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                    <UserPlus className="h-4 w-4" />
                                    Invitar
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">La persona debe tener su propia cuenta en el sistema.</p>
                        </section>

                        {/* Colaboradores */}
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Con acceso ({data.collaborators.length})
                            </h3>
                            {data.collaborators.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no lo compartes con nadie.</p>
                            ) : (
                                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
                                    {data.collaborators.map((c) => (
                                        <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
                                            </div>
                                            <select value={c.role} disabled={busy} onChange={(e) => changeRole(c.id, e.target.value as ShareRole)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                                                <option value="editor">Editor</option>
                                                <option value="viewer">Lector</option>
                                            </select>
                                            <button type="button" title="Quitar acceso" disabled={busy} onClick={() => removeUser(c.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
