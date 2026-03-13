import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Crown, Zap, Star, Clock, MessageCircle, Check, Eye, EyeOff, LogIn } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { dashboard } from '@/routes';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

const plans = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: '5 días',
        description: 'Prueba gratuita para explorar la plataforma.',
        icon: Clock,
        color: 'from-slate-500 to-slate-600',
        badge: null,
        features: [
            'Acceso por 5 días',
            'Visualización de cálculos básicos',
            'Soporte por correo',
        ],
        cta: 'Comenzar gratis',
        ctaStyle: 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
    },
    {
        id: 'mensual',
        name: 'Mensual',
        price: '$10',
        period: '/mes',
        description: 'Acceso mensual a todas las funciones esenciales.',
        icon: Zap,
        color: 'from-blue-500 to-indigo-600',
        badge: null,
        features: [
            'Acceso por 30 días',
            'CRUD de hojas de cálculo',
            'Reportes y exportaciones',
            'Soporte prioritario',
        ],
        cta: 'Elegir mensual',
        ctaStyle: 'border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40',
    },
    {
        id: 'anual',
        name: 'Anual',
        price: '$100',
        period: '/año',
        description: 'El mejor valor para equipos en proyectos largos.',
        icon: Star,
        color: 'from-emerald-500 to-teal-600',
        badge: 'Más popular',
        features: [
            'Acceso por 365 días',
            'Todo lo de Mensual',
            'Múltiples hojas de cálculo',
            'Colaboración de equipo',
            'Soporte prioritario 24/7',
        ],
        cta: 'Elegir anual',
        ctaStyle: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-emerald-950',
    },
    {
        id: 'lifetime',
        name: 'Lifetime',
        price: 'Contactar',
        period: '',
        description: 'Acceso de por vida. Precio especial por WhatsApp.',
        icon: Crown,
        color: 'from-amber-500 to-orange-600',
        badge: '♾️ De por vida',
        features: [
            'Acceso ilimitado para siempre',
            'Todo lo de Anual',
            'Módulos exclusivos',
            'Soporte VIP dedicado',
            'Actualizaciones incluidas',
        ],
        cta: 'Contactar por WhatsApp',
        ctaStyle: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-amber-950',
        ctaHref: 'https://wa.me/51999000000?text=Hola,%20quiero%20información%20sobre%20el%20plan%20Lifetime',
    },
];

export default function Welcome() {
    const { auth } = usePage<{ auth: { user: { name: string } | null } }>().props;
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });

    const handleLogin: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    };

    return (
        <>
            <Head title="PCL — Plataforma de Cálculos">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900 font-[Inter,sans-serif] text-white">

                {/* ── Navbar ── */}
                <nav className="border-b border-white/10 backdrop-blur-md">
                    <div className="mx-auto flex max-w-full items-center justify-between px-12 py-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-22 items-center justify-center rounded-xl bg-blue-50 shadow-lg shadow-blue-500/30">
                                <AppLogoIcon className="size-15 fill-current text-white dark:text-black" />
                            </div>
                        </div>

                        {/* Nav links */}
                        <div className="hidden items-center gap-6 text-sm text-white/70 sm:flex">
                            <a href="#planes" className="transition-colors hover:text-white">Planes</a>
                            <a href="#contacto" className="transition-colors hover:text-white">Contacto</a>
                        </div>

                        {/* Auth */}
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-colors hover:bg-blue-500">
                                <LogIn className="h-4 w-4" />
                                Ir al Inicio
                            </Link>
                        ) : (
                            <a
                                href="#login"
                                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10">
                                Iniciar sesión
                            </a>
                        )}
                    </div>
                </nav>

                {/* ── Hero + Login ── */}
                <section className="mx-auto grid max-full grid-cols-1 gap-12 px-12 py-5 lg:grid-cols-2 lg:items-center">

                    {/* Left: Hero copy */}
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                            Plataforma de Cálculos Estructurales
                        </div>

                        <h1 className="text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
                            Cálculos estructurales{' '}
                            <span className="bg-linear-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">
                                inteligentes
                            </span>{' '}
                            para tu equipo
                        </h1>

                        <p className="max-w-lg text-lg text-white/60">
                            Gestiona, comparte y colabora en hojas de cálculo estructurales con
                            control de acceso por roles. Desde análisis sísmico hasta memorias de cálculo.
                        </p>

                        <div className="flex flex-wrap gap-4 text-sm text-white/50">
                            {['Análisis sísmico', 'Memorias de cálculo', 'Control de roles', 'Reportes PDF'].map((f) => (
                                <span key={f} className="flex items-center gap-1.5">
                                    <Check className="h-4 w-4 text-emerald-400" />
                                    {f}
                                </span>
                            ))}
                        </div>

                        <a href="#planes" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-500/30 transition-colors hover:bg-blue-500">
                            Ver planes
                        </a>
                    </div>

                    {/* Right: Login form */}
                    <div id="login" className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white">Iniciar sesión</h2>
                            <p className="mt-1 text-sm text-white/50">
                                Accede a tu cuenta de PCL
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-white/80">
                                    Correo electrónico
                                </label>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="usuario@pcl.com"
                                    autoComplete="email"
                                    className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 backdrop-blur-sm transition focus:outline-none focus:ring-2 ${errors.email
                                        ? 'border-red-400/60 focus:ring-red-400/30'
                                        : 'border-white/10 focus:border-blue-400/60 focus:ring-blue-400/20'
                                        }`}
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-white/80">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-white/30 backdrop-blur-sm transition focus:outline-none focus:ring-2 ${errors.password
                                            ? 'border-red-400/60 focus:ring-red-400/30'
                                            : 'border-white/10 focus:border-blue-400/60 focus:ring-blue-400/20'
                                            }`}
                                    />
                                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/80">
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                            </div>

                            {/* Remember */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="h-4 w-4 rounded border-white/20 accent-blue-500"
                                />
                                <label htmlFor="remember" className="text-sm text-white/60">
                                    Recordarme
                                </label>
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={processing} className="flex w-full items-center justify-ce  nter gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500 disabled:opacity-60">
                                {processing ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <LogIn className="h-4 w-4" />
                                )}
                                {processing ? 'Ingresando…' : 'Ingresar'}
                            </button>
                        </form>

                        {/* Info note */}
                        <p className="mt-5 text-center text-xs text-white/30">
                            ¿Sin cuenta? Contacta al administrador de la plataforma.
                        </p>
                    </div>
                </section>

                {/* ── Plans ── */}
                <section id="planes" className="border-t border-white/10 py-5">
                    <div className="mx-auto max-w-full px-12">
                        <div className="mb-12 text-center">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Planes y precios
                            </h2>
                            <p className="mt-3 text-white/50">
                                Elige el plan que mejor se adapte a tu equipo y proyecto.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {plans.map((plan) => {
                                const Icon = plan.icon;
                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:border-white/20 ${plan.badge === 'Más popular' ? 'ring-2 ring-emerald-500/50' : ''}`}>
                                        {/* Badge */}
                                        {plan.badge && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/30">
                                                {plan.badge}
                                            </div>
                                        )}

                                        {/* Icon */}
                                        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${plan.color} shadow-lg`}>
                                            <Icon className="h-5 w-5 text-white" />
                                        </div>

                                        {/* Name & Price */}
                                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                        <div className="mt-1 flex items-baseline gap-1">
                                            <span className="text-2xl font-extrabold text-white">
                                                {plan.price}
                                            </span>
                                            <span className="text-sm text-white/40">{plan.period}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-white/50">{plan.description}</p>

                                        {/* Features */}
                                        <ul className="mt-5 flex-1 space-y-2">
                                            {plan.features.map((f) => (
                                                <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA */}
                                        <div className="mt-6">
                                            {plan.ctaHref ? (
                                                <a href={plan.ctaHref} target="_blank" rel="noopener noreferrer" className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${plan.ctaStyle}`}>
                                                    <MessageCircle className="h-4 w-4" />
                                                    {plan.cta}
                                                </a>
                                            ) : (
                                                <a href="#login" className={`block w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${plan.ctaStyle}`}>
                                                    {plan.cta}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── Footer ── */}
                <footer id="contacto" className="border-t border-white/10 py-10">
                    <div className="mx-auto max-w-7xl px-6 text-center">
                        <p className="text-sm text-white/30">
                            © {new Date().getFullYear()} PCL — Plataforma de Cálculos Estructurales.
                            Para más información,{' '}
                            <a href="https://wa.me/51999000000" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
                                contáctanos por WhatsApp
                            </a>
                            .
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}
