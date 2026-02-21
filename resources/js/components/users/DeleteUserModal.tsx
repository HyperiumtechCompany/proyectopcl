import { router } from '@inertiajs/react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useInitials } from '@/hooks/use-initials';
import { resolveAvatarUrl } from '@/lib/avatar';
import { type UserExtended } from '@/types/user';

type DeleteUserModalProps = {
    user: UserExtended;
    onClose: () => void;
};

export function DeleteUserModal({ user, onClose }: DeleteUserModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const getInitials = useInitials();

    const handleDelete = () => {
        setIsDeleting(true);
        router.delete(`/users/${user.id}`, {
            onFinish: () => {
                setIsDeleting(false);
                onClose();
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md rounded-2xl bg-card shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                            Eliminar Usuario
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p className="text-sm text-muted-foreground">
                        ¿Estás seguro de que deseas eliminar al usuario{' '}
                        <span className="font-semibold text-foreground">
                            {user.name}
                        </span>
                        ? Esta acción no se puede deshacer.
                    </p>

                    <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-red-200 dark:bg-red-900/60">
                                {resolveAvatarUrl(user.avatar) ? (
                                    <img
                                        src={resolveAvatarUrl(user.avatar)}
                                        alt={user.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-red-700">
                                        {getInitials(user.name)}
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">
                                    {user.name}
                                </p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/300 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Eliminando...
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                Eliminar Usuario
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

