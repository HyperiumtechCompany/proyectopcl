import { useForm } from '@inertiajs/react';
import { CheckCircle2, Upload, X } from 'lucide-react';
import { useState } from 'react';

type SolicitarPlanModalProps = {
    plan: 'free' | 'mensual' | 'anual' | 'negocios' | 'empresarial';
    planLabel: string;
    onClose: () => void;
};

type SolicitarPlanFormData = {
    nombre: string;
    email: string;
    plan: string;
    empresa: string;
    comprobante: File | null;
    [key: string]: string | File | null;
};

export function SolicitarPlanModal({ plan, planLabel, onClose }: SolicitarPlanModalProps) {
    const [sent, setSent] = useState(false);
    const { data, setData, post, processing, errors } = useForm<SolicitarPlanFormData>({
        nombre: '',
        email: '',
        plan,
        empresa: '',
        comprobante: null,
    });

    const isBusiness = plan === 'negocios' || plan === 'empresarial';
    const requiresComprobante = plan === 'mensual' || plan === 'anual';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/solicitudes', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setSent(true),
        });
    };

    const inputClass = (field: string) =>
        `w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 backdrop-blur-sm transition focus:outline-none focus:ring-2 ${errors[field]
            ? 'border-red-400/60 focus:ring-red-400/30'
            : 'border-white/10 focus:border-blue-400/60 focus:ring-blue-400/20'
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-xl">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                    <X className="h-5 w-5" />
                </button>

                {sent ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                        <h3 className="text-lg font-bold">¡Solicitud enviada!</h3>
                        <p className="text-sm text-white/60">
                            {isBusiness
                                ? 'Nos pondremos en contacto contigo para coordinar el plan de tu empresa.'
                                : 'Revisaremos tu solicitud y te enviaremos tu usuario y contraseña al correo que dejaste, en cuanto sea aprobada.'}
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-lg font-bold">Solicitar plan {planLabel}</h3>
                        <p className="mt-1 text-sm text-white/50">
                            {isBusiness
                                ? 'Cuéntanos sobre tu empresa y te contactamos para coordinar precio y condiciones.'
                                : requiresComprobante
                                    ? 'Completa tus datos y adjunta el comprobante de pago. Te enviaremos tu cuenta por correo una vez aprobada.'
                                    : 'Completa tus datos para activar tu prueba gratuita de 5 días.'}
                        </p>

                        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-white/80">
                                    Nombre completo
                                </label>
                                <input
                                    type="text"
                                    value={data.nombre}
                                    onChange={(e) => setData('nombre', e.target.value)}
                                    className={inputClass('nombre')}
                                    placeholder="Juan Pérez"
                                />
                                {errors.nombre && (
                                    <p className="mt-1 text-xs text-red-400">{errors.nombre}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-white/80">
                                    Correo electrónico
                                </label>
                                <input
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={inputClass('email')}
                                    placeholder="tucorreo@ejemplo.com"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                                )}
                            </div>

                            {isBusiness && (
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-white/80">
                                        Nombre de la empresa
                                    </label>
                                    <input
                                        type="text"
                                        value={data.empresa}
                                        onChange={(e) => setData('empresa', e.target.value)}
                                        className={inputClass('empresa')}
                                        placeholder="Constructora ACME S.A.C."
                                    />
                                    {errors.empresa && (
                                        <p className="mt-1 text-xs text-red-400">{errors.empresa}</p>
                                    )}
                                </div>
                            )}

                            {requiresComprobante && (
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-white/80">
                                        Comprobante de pago
                                    </label>
                                    <label
                                        className={`flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition ${errors.comprobante
                                            ? 'border-red-400/60 text-red-300'
                                            : 'border-white/20 text-white/60 hover:border-blue-400/50 hover:bg-white/5'
                                        }`}
                                    >
                                        <Upload className="h-4 w-4 shrink-0" />
                                        {data.comprobante ? data.comprobante.name : 'Subir imagen o PDF (máx. 5MB)'}
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,application/pdf"
                                            className="hidden"
                                            onChange={(e) => setData('comprobante', e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                    {errors.comprobante && (
                                        <p className="mt-1 text-xs text-red-400">{errors.comprobante}</p>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={processing}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500 disabled:opacity-60"
                            >
                                {processing && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                )}
                                {processing ? 'Enviando…' : 'Enviar solicitud'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
