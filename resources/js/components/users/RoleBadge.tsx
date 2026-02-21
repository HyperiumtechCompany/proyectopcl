import { ShieldCheck } from 'lucide-react';
import { type Role } from '@/types/user';

type RoleBadgeProps = {
    role: string | Role;
    className?: string;
};

const roleConfig: Record<string, string> = {
    root: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
    gerencia: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
    administracion: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    asistentes: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900',
    clientes: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
};

const roleLabels: Record<string, string> = {
    root: 'Root',
    gerencia: 'Gerencia',
    administracion: 'Administración',
    asistentes: 'Asistente',
    clientes: 'Cliente',
};

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
    const name = typeof role === 'string' ? role : role.name;
    const colorClass = roleConfig[name] ?? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    const label = roleLabels[name] ?? name;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass} ${className}`}
        >
            <ShieldCheck className="h-3 w-3" />
            {label}
        </span>
    );
}

