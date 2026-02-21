import { useForm } from '@inertiajs/react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useInitials } from '@/hooks/use-initials';
import { resolveAvatarUrl } from '@/lib/avatar';
import { type Role, type UserExtended, type UserPlan, type UserStatus } from '@/types/user';

type UserFormProps = {
    user?: UserExtended;
    roles: Role[];
    isEdit?: boolean;
};

type UserFormData = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone: string;
    dni: string;
    position: string;
    plan: UserPlan;
    status: UserStatus;
    role_id: string;
    avatar: File | null;
    _method?: 'put' | '';
    [key: string]: string | File | null | undefined;
};

const planOptions: { value: UserPlan; label: string; description: string }[] = [
    { value: 'free', label: 'Free', description: '5 días de prueba' },
    { value: 'mensual', label: 'Mensual', description: '$10/mes' },
    { value: 'anual', label: 'Anual', description: '$100/año' },
    { value: 'lifetime', label: 'Lifetime', description: 'Contactar por WhatsApp' },
];

const statusOptions: { value: UserStatus; label: string }[] = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'blocked', label: 'Bloqueado' },
];

export function UserForm({ user, roles, isEdit = false }: UserFormProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const getInitials = useInitials();
    const [avatarPreview, setAvatarPreview] = useState<string | null>(
        resolveAvatarUrl(user?.avatar) ?? null,
    );
    const fileRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, transform, processing, errors } = useForm<UserFormData>({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        phone: user?.phone ?? '',
        dni: user?.dni ?? '',
        position: user?.position ?? '',
        plan: user?.plan ?? 'free',
        status: user?.status ?? 'active',
        role_id: user?.roles?.[0]?.id?.toString() ?? '',
        avatar: null,
        _method: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit && user) {
            transform((formData: UserFormData) => ({
                ...formData,
                _method: 'put',
            }));
            (post as (url: string, opts?: object) => void)(`/users/${user.id}`, {
                forceFormData: true,
                onFinish: () => transform((formData: UserFormData) => formData),
            });
        } else {
            transform((formData: UserFormData) => {
                const { _method, ...rest } = formData;
                return rest;
            });
            (post as (url: string, opts?: object) => void)('/users', {
                forceFormData: true,
                onFinish: () => transform((formData: UserFormData) => formData),
            });
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('avatar', file);
            const reader = new FileReader();
            reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
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
            {/* Avatar */}
            <div className="flex items-center gap-5">
                <div
                    className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted transition-colors hover:border-indigo-400 hover:bg-indigo-500/10"
                    onClick={() => fileRef.current?.click()}
                >
                    {avatarPreview ? (
                        <img
                            src={avatarPreview}
                            alt="Avatar"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground/80">
                            {getInitials(data.name || user?.name || 'Usuario')}
                        </span>
                    )}
                </div>
                <div>
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                        <Upload className="h-4 w-4" />
                        {avatarPreview ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP. Máx 2MB</p>
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                />
            </div>

            {/* Name & Email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClass}>Nombre completo *</label>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className={inputClass('name')}
                        placeholder="Juan Pérez"
                    />
                    {errors.name && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name}</p>
                    )}
                </div>
                <div>
                    <label className={labelClass}>Correo electrónico *</label>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className={inputClass('email')}
                        placeholder="juan@ejemplo.com"
                    />
                    {errors.email && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email}</p>
                    )}
                </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClass}>
                        Contraseña {isEdit ? '(dejar vacío para no cambiar)' : '*'}
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className={inputClass('password') + ' pr-10'}
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password}</p>
                    )}
                </div>
                <div>
                    <label className={labelClass}>Confirmar contraseña</label>
                    <div className="relative">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={data.password_confirmation}
                            onChange={(e) =>
                                setData('password_confirmation', e.target.value)
                            }
                            className={inputClass('password_confirmation') + ' pr-10'}
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showConfirm ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Phone, DNI, Position */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label className={labelClass}>Teléfono</label>
                    <input
                        type="text"
                        value={data.phone}
                        onChange={(e) => setData('phone', e.target.value)}
                        className={inputClass('phone')}
                        placeholder="+51 999 000 000"
                    />
                </div>
                <div>
                    <label className={labelClass}>DNI</label>
                    <input
                        type="text"
                        value={data.dni}
                        onChange={(e) => setData('dni', e.target.value)}
                        className={inputClass('dni')}
                        placeholder="12345678"
                        maxLength={12}
                    />
                </div>
                <div>
                    <label className={labelClass}>Cargo / Puesto</label>
                    <input
                        type="text"
                        value={data.position}
                        onChange={(e) => setData('position', e.target.value)}
                        className={inputClass('position')}
                        placeholder="Ingeniero Civil"
                    />
                </div>
            </div>

            {/* Role & Plan */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClass}>Rol</label>
                    <select
                        value={data.role_id}
                        onChange={(e) => setData('role_id', e.target.value)}
                        className={inputClass('role_id')}
                    >
                        <option value="">Sin rol asignado</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Plan *</label>
                    <select
                        value={data.plan}
                        onChange={(e) => setData('plan', e.target.value as UserPlan)}
                        className={inputClass('plan')}
                    >
                        {planOptions.map((p) => (
                            <option key={p.value} value={p.value}>
                                {p.label} — {p.description}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Status */}
            <div>
                <label className={labelClass}>Estado *</label>
                <div className="flex gap-3">
                    {statusOptions.map((s) => (
                        <label
                            key={s.value}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${data.status === s.value
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            <input
                                type="radio"
                                name="status"
                                value={s.value}
                                checked={data.status === s.value}
                                onChange={() => setData('status', s.value)}
                                className="hidden"
                            />
                            {s.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* Submit */}
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
                    {isEdit ? 'Guardar cambios' : 'Crear usuario'}
                </button>
            </div>
        </form>
    );
}

