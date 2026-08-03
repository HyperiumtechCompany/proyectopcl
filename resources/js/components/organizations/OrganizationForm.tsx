import { useForm } from '@inertiajs/react';
import { type Organization, type OrganizationPlan } from '@/types/user';

type OrganizationFormProps = {
    organization?: Organization;
    isEdit?: boolean;
};

type OrganizationFormData = {
    nombre: string;
    plan: OrganizationPlan;
    [key: string]: string;
};

const planOptions: { value: OrganizationPlan; label: string; description: string }[] = [
    { value: 'negocios', label: 'Negocios', description: '5 costos / 5 dialux / 5 gestor-proyectos, resto ilimitado' },
    { value: 'empresarial', label: 'Empresarial', description: '10 costos / 10 dialux / 10 gestor-proyectos, resto ilimitado' },
];

export function OrganizationForm({ organization, isEdit = false }: OrganizationFormProps) {
    const { data, setData, post, put, processing, errors } = useForm<OrganizationFormData>({
        nombre: organization?.nombre ?? '',
        plan: organization?.plan ?? 'negocios',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit && organization) {
            put(`/organizations/${organization.id}`);
        } else {
            post('/organizations');
        }
    };

    const inputClass = (field: string) =>
        `w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${errors[field]
            ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200'
            : 'border-border bg-background text-foreground focus:border-indigo-400'
        }`;

    const labelClass = 'mb-1 block text-sm font-medium text-foreground';

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className={labelClass}>Nombre de la organización *</label>
                <input
                    type="text"
                    value={data.nombre}
                    onChange={(e) => setData('nombre', e.target.value)}
                    className={inputClass('nombre')}
                    placeholder="Constructora ACME S.A.C."
                />
                {errors.nombre && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.nombre}</p>
                )}
            </div>

            <div>
                <label className={labelClass}>Plan *</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {planOptions.map((p) => (
                        <label
                            key={p.value}
                            className={`cursor-pointer rounded-xl border p-4 transition-colors ${data.plan === p.value
                                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-900'
                                : 'border-border bg-background hover:bg-muted'
                            }`}
                        >
                            <input
                                type="radio"
                                name="plan"
                                value={p.value}
                                checked={data.plan === p.value}
                                onChange={() => setData('plan', p.value)}
                                className="hidden"
                            />
                            <p className="text-sm font-semibold text-foreground">{p.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        </label>
                    ))}
                </div>
                {errors.plan && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.plan}</p>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                    {processing && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {isEdit ? 'Guardar cambios' : 'Crear organización'}
                </button>
            </div>
        </form>
    );
}
