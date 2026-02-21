import { CheckCircle, XCircle, ShieldOff } from 'lucide-react';
import { type UserStatus } from '@/types/user';

type StatusBadgeProps = {
    status: UserStatus;
    className?: string;
};

const statusConfig: Record<
    UserStatus,
    { label: string; className: string; Icon: React.ElementType }
> = {
    active: {
        label: 'Activo',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
        Icon: CheckCircle,
    },
    inactive: {
        label: 'Inactivo',
        className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
        Icon: XCircle,
    },
    blocked: {
        label: 'Bloqueado',
        className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
        Icon: ShieldOff,
    },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const config = statusConfig[status] ?? statusConfig.inactive;
    const { Icon } = config;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className} ${className}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </span>
    );
}

