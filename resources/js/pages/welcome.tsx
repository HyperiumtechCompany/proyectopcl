import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { FormEventHandler } from 'react';
import {
    ArrowRight,
    Building2,
    Calculator,
    CheckCircle2,
    ChevronRight,
    CloudLightning,
    Droplets,
    ExternalLink,
    Globe,
    Layers,
    Mail,
    MapPin,
    Phone,
    Shield,
    Sun,
    TrendingUp,
    Users,
    Zap,
    Clock,
    Crown,
    Users2,
    EyeOff,
    LogIn,
    Eye,
    MessageCircle,
    Star,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { SolicitarPlanModal } from '@/components/welcome/SolicitarPlanModal';
import { dashboard } from '@/routes';
import type { LucideIcon } from 'lucide-react';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

type PlanCard = {
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    icon: LucideIcon;
    color: string;
    badge: string | null;
    features: string[];
    cta: string;
    ctaStyle: string;
    ctaHref?: string;
};

const individualPlans: PlanCard[] = [
    {
        id: 'free',
        name: 'Prueba técnica',
        price: 'S/ 10',
        period: '/10 días',
        description:
            'Acceso inicial para conocer el flujo completo de la plataforma.',
        icon: Clock,
        color: 'from-slate-500 to-slate-600',
        badge: null,
        features: [
            'Acceso por 10 días',
            'Acceso a todos los módulos',
            'Creación de un proyecto',
            'Soporte por correo',
        ],
        cta: 'Iniciar prueba',
        ctaStyle:
            'rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10',
    },
    {
        id: 'mensual',
        name: 'Mensual',
        price: 'S/ 39',
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
        ctaStyle:
            'rounded-lg border border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20',
    },
    {
        id: 'anual',
        name: 'Anual',
        price: 'S/ 390',
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
        ctaStyle:
            'rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400',
    },
    {
        id: 'lifetime',
        name: 'Lifetime',
        price: 'S/ 990',
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
        ctaStyle:
            'rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400',
        ctaHref:
            'https://wa.me/51999000000?text=Hola,%20quiero%20información%20sobre%20el%20plan%20Lifetime',
    },
];

const businessPlans: PlanCard[] = [
    {
        id: 'negocios',
        name: 'Negocios',
        price: 'S/ 299',
        period: '/mes',
        description:
            'Cuenta de equipo con cupo de proyectos compartido entre tus colaboradores.',
        icon: Users2,
        color: 'from-blue-500 to-indigo-600',
        badge: null,
        features: [
            '5 proyectos de costos',
            '5 proyectos de dialux',
            '5 proyectos de gestor de proyectos',
            'Resto de módulos sin límite',
            'Cupo compartido entre todo el equipo',
        ],
        cta: 'Solicitar plan Negocios',
        ctaStyle:
            'rounded-lg border border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20',
    },
    {
        id: 'empresarial',
        name: 'Empresarial',
        price: 'S/ 599',
        period: '/mes',
        description:
            'Para equipos más grandes que necesitan más cupo compartido.',
        icon: Building2,
        color: 'from-violet-500 to-indigo-600',
        badge: 'Más cupo',
        features: [
            '10 proyectos de costos',
            '10 proyectos de dialux',
            '10 proyectos de gestor de proyectos',
            'Resto de módulos sin límite',
            'Cupo compartido entre todo el equipo',
            'Soporte prioritario 24/7',
        ],
        cta: 'Solicitar plan Empresarial',
        ctaStyle:
            'rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/20 hover:from-violet-400 hover:to-indigo-400',
    },
];

const modules = [
    {
        label: 'Costos',
        icon: Calculator,
        tag: 'PRESUPUESTOS',
        tone: 'blue',
        stat: '+3,200 proyectos',
        description:
            'Presupuestos, metrados y análisis de costos unitarios para proyectos de construcción.',
    },
    {
        label: 'HyperLux',
        icon: Sun,
        tag: 'ILUMINACIÓN',
        tone: 'amber',
        stat: 'IEC 60364',
        description:
            'Diseño y cálculo de sistemas de iluminación interior y exterior.',
    },
    {
        label: 'Cálculo Agua',
        icon: Droplets,
        tag: 'HIDRÁULICA',
        tone: 'cyan',
        stat: 'IS.010 / OS.050',
        description:
            'Redes de agua potable, dimensionamiento de tuberías y almacenamiento.',
    },
    {
        label: 'Desagüe',
        icon: Layers,
        tag: 'SANEAMIENTO',
        tone: 'teal',
        stat: 'IS.020 / RNE',
        description:
            'Sistemas de evacuación sanitaria, caudales, pendientes y colectores.',
    },
    {
        label: 'Caída Tensión',
        icon: Zap,
        tag: 'ELÉCTRICAS',
        tone: 'yellow',
        stat: 'EM.010 / CNE',
        description:
            'Caída de tensión, dimensionamiento de conductores y protecciones.',
    },
    {
        label: 'Pozo a Tierra',
        icon: Shield,
        tag: 'PUESTA TIERRA',
        tone: 'emerald',
        stat: 'IEC 62305',
        description:
            'Resistividad del suelo, electrodos y sistemas de puesta a tierra.',
    },
    {
        label: 'Pararrayos',
        icon: CloudLightning,
        tag: 'PROTECCIÓN',
        tone: 'violet',
        stat: 'NTP IEC 62305',
        description:
            'Radio de protección LPS y ubicación de terminales aéreas.',
    },
    {
        label: 'Estructural',
        icon: TrendingUp,
        tag: 'ESTRUCTURAS',
        tone: 'rose',
        stat: 'E.030 / ACI 318',
        description:
            'Verificación de elementos estructurales con normativa vigente.',
    },
] as const;

const stats = [
    { value: '12,000+', label: 'Ingenieros activos' },
    { value: '98,000+', label: 'Proyectos calculados' },
    { value: '99.9%', label: 'Disponibilidad SLA' },
    { value: '8', label: 'Módulos especializados' },
];

const demoRows = [
    {
        code: '02.01.01',
        item: 'Excavación manual',
        unit: 'm³',
        total: '1,636.25',
    },
    {
        code: '03.01.02',
        item: "Concreto f'c=210",
        unit: 'm³',
        total: '7,644.00',
    },
    { code: '04.02.01', item: 'Acero fy=4200', unit: 'kg', total: '6,448.00' },
    {
        code: '05.01.03',
        item: 'Encofrado de losa',
        unit: 'm²',
        total: '4,128.00',
    },
];

const particles = [
    [8, 18, 0],
    [16, 72, 1.4],
    [24, 42, 2.1],
    [34, 85, 0.7],
    [41, 12, 2.8],
    [49, 61, 1.1],
    [57, 29, 2.5],
    [65, 77, 0.3],
    [73, 48, 1.8],
    [82, 15, 3.1],
    [89, 68, 0.9],
    [94, 36, 2.3],
    [12, 91, 3.4],
    [30, 24, 1.6],
    [54, 92, 2.9],
];

const toneClasses: Record<
    string,
    { border: string; icon: string; background: string }
> = {
    blue: {
        border: 'border-blue-500/30',
        icon: 'text-blue-400',
        background: 'from-blue-600/20',
    },
    amber: {
        border: 'border-amber-500/30',
        icon: 'text-amber-400',
        background: 'from-amber-600/20',
    },
    cyan: {
        border: 'border-cyan-500/30',
        icon: 'text-cyan-400',
        background: 'from-cyan-600/20',
    },
    teal: {
        border: 'border-teal-500/30',
        icon: 'text-teal-400',
        background: 'from-teal-600/20',
    },
    yellow: {
        border: 'border-yellow-500/30',
        icon: 'text-yellow-400',
        background: 'from-yellow-600/20',
    },
    emerald: {
        border: 'border-emerald-500/30',
        icon: 'text-emerald-400',
        background: 'from-emerald-600/20',
    },
    violet: {
        border: 'border-violet-500/30',
        icon: 'text-violet-400',
        background: 'from-violet-600/20',
    },
    rose: {
        border: 'border-rose-500/30',
        icon: 'text-rose-400',
        background: 'from-rose-600/20',
    },
};

export default function Welcome() {
    const { auth, showLogin } = usePage<{
        auth: { user: { name: string } | null };
        showLogin?: boolean;
    }>().props;
    const [showPassword, setShowPassword] = useState(false);
    const [loginOpen, setLoginOpen] = useState(Boolean(showLogin));
    const [contactSent, setContactSent] = useState(false);
    const [planTab, setPlanTab] = useState<'individual' | 'empresa'>(
        'individual',
    );
    const [solicitarPlan, setSolicitarPlan] = useState<{
        id: 'free' | 'mensual' | 'anual' | 'negocios' | 'empresarial';
        name: string;
    } | null>(null);

    const { data, setData, post, processing, errors, reset } =
        useForm<LoginForm>({
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

    useEffect(() => {
        if (!showLogin) {
            return;
        }

        setLoginOpen(true);
    }, [showLogin]);

    return (
        <>
            <Head title="PCL — Plataforma de Cálculos">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=barlow-condensed:600,700,800|inter:400,500,600,700|jetbrains-mono:400,500"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-[#080c14] font-['Inter'] text-slate-100 antialiased">
                <style>{`
                    html { scroll-behavior: smooth; }
                    .font-display { font-family: 'Barlow Condensed', sans-serif; }
                    .font-technical { font-family: 'JetBrains Mono', monospace; }
                    h1, h2, h3 { font-family: 'Barlow Condensed', sans-serif; }
                    @keyframes particle-float { 0%,100% { transform: translate3d(0,0,0); opacity:.18 } 50% { transform: translate3d(18px,-28px,0); opacity:.7 } }
                    @keyframes panel-float { 0%,100% { transform: translateY(0) rotateX(0); } 50% { transform: translateY(-9px) rotateX(1deg); } }
                    @keyframes row-enter { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
                    @keyframes scan { 0% { transform:translateY(-100%); opacity:0; } 20%,80% { opacity:.45; } 100% { transform:translateY(500%); opacity:0; } }
                    @media (prefers-reduced-motion: reduce) { .landing-motion { animation: none !important; transition-duration: 0.01ms !important; } }
                `}</style>
                <div className="relative isolate overflow-hidden">
                    {/* Animated grid background */}
                    <div
                        className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 20% 50%, rgba(34, 211, 238, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
                        }}
                    />
                    <div className="absolute inset-0 bg-linear-to-br from-slate-950/98 via-slate-900/95 to-slate-950/98" />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 overflow-hidden"
                    >
                        {particles.map(([left, top, delay], index) => (
                            <span
                                key={index}
                                className="landing-motion absolute size-1 rounded-full bg-blue-400 shadow-[0_0_12px_#60a5fa] motion-safe:animate-[particle-float_7s_ease-in-out_infinite]"
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    animationDelay: `${delay}s`,
                                }}
                            />
                        ))}
                    </div>

                    {/* Navbar */}
                    <nav className="relative z-10 border-b border-white/10 bg-[#080c14]/90 backdrop-blur-xl">
                        <div className="max-w-8xl mx-auto flex items-center justify-between px-6 py-4 lg:px-8">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/80 shadow-lg shadow-blue-500/40">
                                    <AppLogoIcon className="size-6 fill-current text-white" />
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-base font-bold tracking-tight text-white">
                                        PCL
                                    </p>
                                    <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                                        Plataforma
                                    </p>
                                </div>
                            </div>

                            <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
                                <a
                                    href="#modulos"
                                    className="font-medium transition hover:text-white"
                                >
                                    Módulos
                                </a>
                                <a
                                    href="#planes"
                                    className="font-medium transition hover:text-white"
                                >
                                    Planes
                                </a>
                                <a
                                    href="#nosotros"
                                    className="font-medium transition hover:text-white"
                                >
                                    Nosotros
                                </a>
                                <a
                                    href="#contacto"
                                    className="font-medium transition hover:text-white"
                                >
                                    Contacto
                                </a>
                            </div>

                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Ir al Inicio
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setLoginOpen(true)}
                                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                                >
                                    Iniciar sesión
                                </button>
                            )}
                        </div>
                    </nav>

                    {/* Hero Section */}
                    <section
                        id="hero"
                        className="max-w-8xl relative z-10 mx-auto px-6 py-20 lg:px-8 lg:py-32"
                    >
                        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                            {/* Hero content */}
                            <div className="landing-motion motion-safe:animate-[row-enter_.7s_ease-out_both]">
                                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                                    PLATAFORMA DE INGENIERÍA CIVIL — V3.0
                                </div>

                                <h1
                                    className="font-display leading-[.92] font-extrabold tracking-tight text-white"
                                    style={{
                                        fontSize: 'clamp(3rem, 7vw, 5.8rem)',
                                    }}
                                >
                                    CÁLCULOS
                                    <br />
                                    DE INGENIERÍA
                                    <br />
                                    <span className="bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                        CIVIL
                                    </span>
                                </h1>

                                <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-300">
                                    Plataforma profesional para proyectistas e
                                    ingenieros. Costos, hidráulica,
                                    instalaciones eléctricas, saneamiento y
                                    protecciones — todo integrado, normado y
                                    exportable.
                                </p>

                                <div className="mt-8 flex flex-wrap gap-3">
                                    <a
                                        href="#planes"
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:bg-blue-500"
                                    >
                                        Prueba técnica S/ 10
                                        <ArrowRight className="h-4 w-4" />
                                    </a>
                                    <a
                                        href="#modulos"
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                    >
                                        Ver módulos
                                    </a>
                                </div>

                                <div className="mt-10 flex flex-wrap gap-3">
                                    {[
                                        'RNE 2024',
                                        'CNE Vigente',
                                        'IEC 62305',
                                        'ISO 9001',
                                    ].map((badge) => (
                                        <span
                                            key={badge}
                                            className="inline-flex items-center gap-1.5 text-sm text-slate-400"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                            {badge}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Login modal */}
                            {loginOpen && (
                                <div
                                    className="fixed inset-0 z-60 flex items-center justify-center bg-[#050810]/85 p-4 backdrop-blur-md"
                                    onMouseDown={() => setLoginOpen(false)}
                                >
                                    <div
                                        id="login"
                                        role="dialog"
                                        aria-modal="true"
                                        aria-label="Iniciar sesión"
                                        onMouseDown={(event) =>
                                            event.stopPropagation()
                                        }
                                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#101827] p-7 shadow-2xl shadow-black/60 sm:p-8"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setLoginOpen(false)}
                                            className="absolute top-4 right-4 text-slate-500 transition hover:text-white"
                                            aria-label="Cerrar inicio de sesión"
                                        >
                                            ×
                                        </button>
                                        <div className="mb-6">
                                            <p className="text-xs font-bold tracking-widest text-cyan-300 uppercase">
                                                Accede a tu cuenta
                                            </p>
                                            <h2 className="mt-3 text-2xl font-bold text-white">
                                                Iniciar sesión
                                            </h2>
                                            <p className="mt-2 text-sm text-slate-400">
                                                Ingresa tus credenciales para
                                                continuar.
                                            </p>
                                        </div>

                                        <form
                                            onSubmit={handleLogin}
                                            className="space-y-4"
                                        >
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-200">
                                                    Correo electrónico
                                                </label>
                                                <input
                                                    type="email"
                                                    value={data.email}
                                                    onChange={(e) =>
                                                        setData(
                                                            'email',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="usuario@pcl.com"
                                                    autoComplete="email"
                                                    className={`w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:outline-none ${
                                                        errors.email
                                                            ? 'border-red-400/50 focus:ring-red-400/30'
                                                            : 'border-white/10 focus:border-blue-400/50 focus:ring-blue-400/20'
                                                    }`}
                                                />
                                                {errors.email && (
                                                    <p className="mt-1 text-xs text-red-400">
                                                        {errors.email}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-200">
                                                    Contraseña
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={
                                                            showPassword
                                                                ? 'text'
                                                                : 'password'
                                                        }
                                                        value={data.password}
                                                        onChange={(e) =>
                                                            setData(
                                                                'password',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="••••••••"
                                                        autoComplete="current-password"
                                                        className={`w-full rounded-lg border bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:outline-none ${
                                                            errors.password
                                                                ? 'border-red-400/50 focus:ring-red-400/30'
                                                                : 'border-white/10 focus:border-blue-400/50 focus:ring-blue-400/20'
                                                        }`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setShowPassword(
                                                                (v) => !v,
                                                            )
                                                        }
                                                        className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-100"
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                                {errors.password && (
                                                    <p className="mt-1 text-xs text-red-400">
                                                        {errors.password}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 pt-2">
                                                <input
                                                    type="checkbox"
                                                    id="remember"
                                                    checked={data.remember}
                                                    onChange={(e) =>
                                                        setData(
                                                            'remember',
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded border-white/20 bg-slate-800 accent-blue-500"
                                                />
                                                <label
                                                    htmlFor="remember"
                                                    className="text-sm text-slate-400"
                                                >
                                                    Recordarme
                                                </label>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={processing}
                                                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500 disabled:opacity-60"
                                            >
                                                {processing ? (
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                ) : (
                                                    <LogIn className="h-4 w-4" />
                                                )}
                                                {processing
                                                    ? 'Ingresando…'
                                                    : 'Ingresar'}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            <div className="landing-motion relative mx-auto w-full max-w-xl motion-safe:animate-[panel-float_6s_ease-in-out_infinite]">
                                <div className="absolute -inset-8 rounded-full bg-blue-600/15 blur-3xl" />
                                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1422]/95 shadow-2xl shadow-black/60 backdrop-blur">
                                    <div className="flex items-center justify-between border-b border-white/10 bg-[#111a2b] px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="size-2.5 rounded-full bg-red-400/70" />
                                            <span className="size-2.5 rounded-full bg-amber-400/70" />
                                            <span className="size-2.5 rounded-full bg-emerald-400/70" />
                                        </div>
                                        <span className="font-technical text-[10px] tracking-[.18em] text-slate-500">
                                            PCL / COSTOS 3.0
                                        </span>
                                    </div>
                                    <div className="relative p-5 sm:p-6">
                                        <div className="landing-motion pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-blue-400/10 to-transparent motion-safe:animate-[scan_5s_linear_infinite]" />
                                        <div className="mb-5 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-technical text-[10px] text-blue-400">
                                                    PRESUPUESTO EN PROCESO
                                                </p>
                                                <h2 className="mt-1 text-sm font-semibold text-white sm:text-base">
                                                    Edificio multifamiliar —
                                                    Lima
                                                </h2>
                                            </div>
                                            <span className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-300">
                                                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                                                CALCULANDO
                                            </span>
                                        </div>
                                        <div className="overflow-hidden rounded-lg border border-white/8">
                                            <div className="font-technical grid grid-cols-[.8fr_1.6fr_.4fr_.7fr] gap-2 bg-white/5 px-3 py-2 text-[9px] text-slate-500">
                                                <span>CÓDIGO</span>
                                                <span>PARTIDA</span>
                                                <span>UND.</span>
                                                <span className="text-right">
                                                    PARCIAL S/
                                                </span>
                                            </div>
                                            {demoRows.map((row, index) => (
                                                <div
                                                    key={row.code}
                                                    className="landing-motion grid grid-cols-[.8fr_1.6fr_.4fr_.7fr] gap-2 border-t border-white/6 px-3 py-3 text-[10px] text-slate-300 motion-safe:animate-[row-enter_.5s_ease-out_both] sm:text-xs"
                                                    style={{
                                                        animationDelay: `${index * 180 + 400}ms`,
                                                    }}
                                                >
                                                    <span className="font-technical text-blue-400">
                                                        {row.code}
                                                    </span>
                                                    <span className="truncate">
                                                        {row.item}
                                                    </span>
                                                    <span className="text-slate-500">
                                                        {row.unit}
                                                    </span>
                                                    <span className="text-right font-medium text-white">
                                                        {row.total}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
                                            <div>
                                                <p className="font-technical text-[9px] text-slate-500">
                                                    AVANCE DEL ANÁLISIS
                                                </p>
                                                <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-white/8">
                                                    <div className="h-full w-[86%] rounded-full bg-linear-to-r from-blue-600 to-cyan-400" />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-technical text-[9px] text-slate-500">
                                                    COSTO DIRECTO
                                                </p>
                                                <p className="font-display text-3xl font-bold text-white">
                                                    S/ 19,856.25
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -right-3 -bottom-4 rounded-lg border border-blue-400/20 bg-[#111a2b] px-4 py-3 shadow-xl sm:-right-6">
                                    <p className="font-technical text-[9px] text-slate-500">
                                        TIEMPO AHORRADO
                                    </p>
                                    <p className="font-display text-xl font-bold text-blue-300">
                                        -72% por proyecto
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                    <div className="relative z-10 border-t border-white/8 bg-[#060a10]/80">
                        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-6 py-6 md:grid-cols-4">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-2xl font-bold text-white md:text-3xl">
                                        {stat.value}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {stat.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <section
                    id="modulos"
                    className="border-t border-white/5 bg-[#080c14] py-24"
                >
                    <div className="max-w-8xl mx-auto px-6">
                        <div className="mb-14 max-w-2xl">
                            <p className="font-mono text-xs tracking-widest text-blue-400">
                                // 01 MÓDULOS DEL SISTEMA
                            </p>
                            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                                8 SISTEMAS ESPECIALIZADOS
                                <br />
                                <span className="text-slate-500">
                                    PARA INGENIERÍA PROFESIONAL
                                </span>
                            </h2>
                            <p className="mt-4 text-sm leading-relaxed text-slate-400">
                                Cada módulo combina normativa actualizada,
                                fórmulas verificadas y flujos diseñados para
                                profesionales que no pueden permitirse errores.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {modules.map((module) => {
                                const Icon = module.icon;
                                const tone = toneClasses[module.tone];

                                return (
                                    <article
                                        key={module.label}
                                        className={`group relative overflow-hidden rounded-lg border bg-[#0d1422] p-5 transition duration-300 hover:-translate-y-1 ${tone.border}`}
                                    >
                                        <div
                                            className={`absolute inset-0 bg-linear-to-br ${tone.background} to-transparent opacity-0 transition group-hover:opacity-100`}
                                        />
                                        <div className="relative">
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <span
                                                    className={`rounded-md bg-white/5 p-2 ${tone.icon}`}
                                                >
                                                    <Icon size={19} />
                                                </span>
                                                <span
                                                    className={`rounded-full border bg-white/5 px-2 py-0.5 font-mono text-[9px] tracking-widest ${tone.border} ${tone.icon}`}
                                                >
                                                    {module.tag}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-white">
                                                {module.label}
                                            </h3>
                                            <p className="mt-2 min-h-16 text-xs leading-relaxed text-slate-400">
                                                {module.description}
                                            </p>
                                            <div className="mt-4 flex items-center justify-between">
                                                <span
                                                    className={`font-mono text-[11px] ${tone.icon}`}
                                                >
                                                    {module.stat}
                                                </span>
                                                <ChevronRight
                                                    size={13}
                                                    className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-white"
                                                />
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section
                    id="nosotros"
                    className="relative overflow-hidden border-t border-white/5 bg-[#0a0f1c] py-24"
                >
                    <div
                        className="absolute inset-y-0 right-0 w-1/2 opacity-[0.025]"
                        style={{
                            backgroundImage:
                                'linear-gradient(135deg,#3b82f6 1px,transparent 1px)',
                            backgroundSize: '32px 32px',
                        }}
                    />
                    <div className="max-w-8xl relative mx-auto grid items-center gap-16 px-6 lg:grid-cols-2">
                        <div className="relative">
                            <div className="aspect-4/3 overflow-hidden rounded-xl">
                                <img
                                    src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&h=675&fit=crop&auto=format"
                                    alt="Ingenieros trabajando con software de cálculo"
                                    className="h-full w-full object-cover transition duration-700 hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-linear-to-tr from-[#0a0f1c]/70 to-transparent" />
                            </div>
                            <div className="absolute -right-3 -bottom-5 max-w-48 rounded-xl border border-white/10 bg-[#101827] p-4 shadow-2xl sm:-right-5">
                                <p className="text-3xl font-bold text-white">
                                    98%
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Satisfacción entre ingenieros certificados
                                </p>
                                <div className="mt-2 flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={11}
                                            className="fill-amber-400 text-amber-400"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <p className="font-mono text-xs tracking-widest text-blue-400">
                                // 02 ¿POR QUÉ PCL?
                            </p>
                            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                                DISEÑADO POR INGENIEROS,
                                <br />
                                <span className="text-blue-400">
                                    PARA INGENIEROS
                                </span>
                            </h2>
                            <p className="mt-5 text-sm leading-relaxed text-slate-400">
                                Cada fórmula, tabla y flujo ha sido pensado para
                                proyectos reales, con normativa peruana
                                actualizada y resultados listos para presentar.
                            </p>
                            <div className="mt-8 space-y-5">
                                {[
                                    [
                                        CheckCircle2,
                                        'Normativa siempre vigente',
                                        'RNE, CNE, NTP e IEC disponibles en un mismo entorno.',
                                    ],
                                    [
                                        Globe,
                                        '100% en la nube',
                                        'Accede desde cualquier dispositivo, sin instalaciones.',
                                    ],
                                    [
                                        Users,
                                        'Trabajo colaborativo',
                                        'Organiza proyectos y comparte cálculos con tu equipo.',
                                    ],
                                    [
                                        ExternalLink,
                                        'Exportación profesional',
                                        'Genera documentación clara para revisión y entrega.',
                                    ],
                                ].map(([FeatureIcon, title, description]) => {
                                    const Icon = FeatureIcon as LucideIcon;
                                    return (
                                        <div
                                            key={title as string}
                                            className="flex gap-4"
                                        >
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-500/30 bg-blue-600/15">
                                                <Icon
                                                    size={14}
                                                    className="text-blue-400"
                                                />
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-medium text-white">
                                                    {title as string}
                                                </h3>
                                                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                                    {description as string}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-white/5 bg-[#0a0f1c] py-20">
                    <div className="max-w-8xl mx-auto px-6">
                        <p className="mb-10 text-center font-mono text-xs tracking-widest text-blue-400">
                            // 03 LO QUE DICEN NUESTROS INGENIEROS
                        </p>
                        <div className="grid gap-5 md:grid-cols-3">
                            {[
                                [
                                    'CM',
                                    'Ing. Carlos Mendoza',
                                    'Proyectista independiente, Lima',
                                    'Antes tardaba dos días en armar una memoria eléctrica. Ahora termino el trabajo en horas y con la normativa organizada.',
                                ],
                                [
                                    'PL',
                                    'Ing. Patricia Llave',
                                    'Directora técnica, Constructora Andina',
                                    'El módulo de costos centralizó el trabajo del equipo y elevó la calidad de nuestros entregables.',
                                ],
                                [
                                    'RS',
                                    'Ing. Roberto Salinas',
                                    'Consultor hidráulico, Arequipa',
                                    'Los cálculos de agua e iluminación son completos, claros y generan una memoria técnica muy útil.',
                                ],
                            ].map(([initials, name, role, quote]) => (
                                <article
                                    key={name}
                                    className="rounded-xl border border-white/10 bg-[#101827] p-6 transition hover:-translate-y-1 hover:border-white/20"
                                >
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                size={11}
                                                className="fill-amber-400 text-amber-400"
                                            />
                                        ))}
                                    </div>
                                    <p className="my-5 text-sm leading-relaxed text-[#9aaccc]">
                                        “{quote}”
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-9 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-sm font-bold text-blue-300">
                                            {initials}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                {name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {role}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section
                    id="planes"
                    className="border-t border-white/5 bg-[#080c14] py-24"
                >
                    <div className="max-w-8xl mx-auto px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="text-xs font-bold tracking-widest text-blue-400 uppercase">
                                Planes y precios
                            </p>
                            <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                                Elige el plan que se adapte a tu ritmo.
                            </h2>
                            <p className="mt-4 text-base text-slate-400">
                                Todos nuestros planes incluyen acceso a módulos
                                especializados en cálculos de ingeniería civil.
                            </p>
                        </div>

                        <div className="mt-12 flex justify-center">
                            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                                <button
                                    type="button"
                                    onClick={() => setPlanTab('individual')}
                                    className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                                        planTab === 'individual'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Individual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPlanTab('empresa')}
                                    className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                                        planTab === 'empresa'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Empresa
                                </button>
                            </div>
                        </div>

                        <div
                            className={`mx-auto mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 ${planTab === 'individual' ? 'xl:grid-cols-4' : 'lg:max-w-4xl lg:grid-cols-2'}`}
                        >
                            {(planTab === 'individual'
                                ? individualPlans
                                : businessPlans
                            ).map((plan) => {
                                const Icon = plan.icon;
                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative flex flex-col rounded-xl border border-white/10 bg-white/4 p-6 shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-1 hover:border-blue-400/30 ${plan.badge ? 'ring-2 ring-blue-400/30' : ''}`}
                                    >
                                        {plan.badge && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-[11px] font-bold tracking-wider whitespace-nowrap text-white uppercase shadow-lg shadow-blue-500/20">
                                                {plan.badge}
                                            </div>
                                        )}

                                        <div
                                            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-linear-to-br ${plan.color} shadow-lg`}
                                        >
                                            <Icon className="h-5 w-5 text-white" />
                                        </div>

                                        <h3 className="text-lg font-bold text-white">
                                            {plan.name}
                                        </h3>
                                        <div className="mt-2 flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white">
                                                {plan.price}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                                {plan.period}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-slate-400">
                                            {plan.description}
                                        </p>

                                        <ul className="mt-6 flex-1 space-y-3">
                                            {plan.features.map((feature) => (
                                                <li
                                                    key={feature}
                                                    className="flex items-start gap-2.5 text-sm text-slate-300"
                                                >
                                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="mt-6">
                                            {plan.ctaHref ? (
                                                <a
                                                    href={plan.ctaHref}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${plan.ctaStyle}`}
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    {plan.cta}
                                                </a>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSolicitarPlan({
                                                            id: plan.id as
                                                                | 'free'
                                                                | 'mensual'
                                                                | 'anual'
                                                                | 'negocios'
                                                                | 'empresarial',
                                                            name: plan.name,
                                                        })
                                                    }
                                                    className={`block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${plan.ctaStyle}`}
                                                >
                                                    {plan.cta}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section
                    id="contacto"
                    className="border-t border-white/5 bg-[#080c14] py-24"
                >
                    <div className="max-w-8xl mx-auto grid gap-16 px-6 lg:grid-cols-2">
                        <div>
                            <p className="font-mono text-xs tracking-widest text-blue-400">
                                // 05 CONTACTO
                            </p>
                            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                                HABLEMOS DE TU
                                <br />
                                <span className="text-blue-400">
                                    PRÓXIMO PROYECTO
                                </span>
                            </h2>
                            <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400">
                                Para planes empresariales, integraciones
                                personalizadas o demostraciones privadas,
                                contáctanos directamente.
                            </p>
                            <div className="mt-8 space-y-4">
                                {[
                                    [Mail, 'ventas@pcl.pe'],
                                    [Phone, '+51 999 000 000'],
                                    [MapPin, 'Lima, Perú'],
                                ].map(([ContactIcon, label]) => {
                                    const Icon = ContactIcon as LucideIcon;
                                    return (
                                        <div
                                            key={label as string}
                                            className="flex items-center gap-3"
                                        >
                                            <span className="flex size-8 items-center justify-center rounded-md border border-blue-500/20 bg-blue-600/15">
                                                <Icon
                                                    size={14}
                                                    className="text-blue-400"
                                                />
                                            </span>
                                            <span className="text-sm text-[#9aaccc]">
                                                {label as string}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#101827] p-7">
                            {contactSent ? (
                                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                                    <CheckCircle2
                                        size={38}
                                        className="mb-4 text-blue-400"
                                    />
                                    <h3 className="text-2xl font-bold text-white">
                                        Mensaje enviado
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-400">
                                        Te contactaremos en menos de 24 horas
                                        hábiles.
                                    </p>
                                </div>
                            ) : (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        setContactSent(true);
                                    }}
                                    className="space-y-4"
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="text-xs text-slate-400">
                                            Nombre
                                            <input
                                                required
                                                placeholder="Ing. Juan Quispe"
                                                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#131c2e] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                                            />
                                        </label>
                                        <label className="text-xs text-slate-400">
                                            Empresa
                                            <input
                                                placeholder="Constructora XYZ"
                                                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#131c2e] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                                            />
                                        </label>
                                    </div>
                                    <label className="block text-xs text-slate-400">
                                        Correo electrónico
                                        <input
                                            required
                                            type="email"
                                            placeholder="juan@constructora.pe"
                                            className="mt-1.5 w-full rounded-md border border-white/10 bg-[#131c2e] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                                        />
                                    </label>
                                    <label className="block text-xs text-slate-400">
                                        Mensaje
                                        <textarea
                                            rows={4}
                                            placeholder="Cuéntanos sobre tu proyecto o equipo..."
                                            className="mt-1.5 w-full resize-none rounded-md border border-white/10 bg-[#131c2e] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                                        />
                                    </label>
                                    <button
                                        type="submit"
                                        className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-500"
                                    >
                                        Enviar mensaje <ArrowRight size={13} />
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </section>

                <footer className="border-t border-white/10 bg-[#060a10] py-12">
                    <div className="max-w-8xl mx-auto px-6 text-center lg:px-8">
                        <p className="text-sm text-slate-400">
                            © {new Date().getFullYear()} PCL — Plataforma de
                            Cálculos Estructurales. Para más información,{' '}
                            <a
                                href="https://wa.me/51999000000"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                            >
                                contáctanos por WhatsApp
                            </a>
                            .
                        </p>
                    </div>
                </footer>
            </div>

            {solicitarPlan && (
                <SolicitarPlanModal
                    plan={solicitarPlan.id}
                    planLabel={solicitarPlan.name}
                    onClose={() => setSolicitarPlan(null)}
                />
            )}
        </>
    );
}
