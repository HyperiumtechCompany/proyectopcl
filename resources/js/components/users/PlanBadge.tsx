import { Crown, Star, Zap, Gift, ShieldOff, Clock } from 'lucide-react';
import { type UserPlan, type UserStatus } from '@/types/user';

type PlanBadgeProps = {
    plan: UserPlan;
    expiresAt?: string | null;
    className?: string;
};

const planConfig: Record<
    UserPlan,
    { label: string; className: string; Icon: React.ElementType }
> = {
    free: {
        label: 'Free',
        className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
        Icon: Clock,
    },
    mensual: {
        label: 'Mensual',
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
        Icon: Zap,
    },
    anual: {
        label: 'Anual',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
        Icon: Star,
    },
    lifetime: {
        label: 'Lifetime',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
        Icon: Crown,
    },
};

export function PlanBadge({ plan, className = '' }: PlanBadgeProps) {
    const config = planConfig[plan] ?? planConfig.free;
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

