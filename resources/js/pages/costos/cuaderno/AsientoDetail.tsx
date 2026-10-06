import { router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Copy,
    Download,
    ExternalLink,
    FileDown,
    X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    link,
    oficial,
    pdf,
    unlink,
    update,
} from '@/routes/costos/cuaderno/asientos';

interface AsientoRef {
    id: number;
    numero: number;
    titulo: string;
}

export interface Asiento {
    id: number;
    numero: number;
    titulo: string;
    tipo: string;
    fecha_oficial: string;
    usuario: string;
    rol: string;
    estado: string;
    nota_local: string | null;
    referencias: { id: number; destino: AsientoRef }[];
    referenciado_por: { id: number; origen: AsientoRef }[];
    external_id: string | null;
    descripcion: string | null;
    referencia: string | null;
    latitud: string | null;
    longitud: string | null;
    detalle_at: string | null;
    tiene_pdf: boolean;
    pdf_bytes: number | null;
}

export default function AsientoDetail({
    projectId,
    asiento,
    canFetch,
}: {
    projectId: number;
    asiento: Asiento;
    canFetch: boolean;
}) {
    const route = { costoProject: projectId, asiento: asiento.id };
    const fetching = useForm({});

    function fetchOfficial() {
        fetching.post(oficial.url(route), {
            preserveScroll: true,
            preserveState: true,
        });
    }
    const note = useForm({ nota_local: asiento.nota_local ?? '' });
    const linkForm = useForm({ numero: '' });
    const [copied, setCopied] = useState(false);

    function saveNote(event: FormEvent) {
        event.preventDefault();
        note.patch(update.url(route), {
            preserveScroll: true,
            preserveState: true,
        });
    }

    function addLink(event: FormEvent) {
        event.preventDefault();
        linkForm.post(link.url(route), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => linkForm.reset(),
        });
    }

    function removeLink(referencia: number) {
        router.delete(unlink.url({ ...route, referencia }), {
            preserveScroll: true,
            preserveState: true,
        });
    }

    // Ready-to-paste citation for reports, letters and valuation supports.
    async function copyCitation() {
        const text = `Asiento N.º ${asiento.numero} (${asiento.tipo}) del ${asiento.fecha_oficial}, ${asiento.usuario} – ${asiento.rol}: ${asiento.titulo}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                        Documento oficial (OECE)
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {asiento.tiene_pdf && (
                            <>
                                <Button size="sm" variant="outline" asChild>
                                    <a
                                        href={pdf.url(route)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink /> Ver PDF
                                    </a>
                                </Button>
                                <Button size="sm" variant="outline" asChild>
                                    <a
                                        href={pdf.url(route, {
                                            query: { descargar: 1 },
                                        })}
                                    >
                                        <Download /> Descargar PDF
                                    </a>
                                </Button>
                            </>
                        )}
                        <Button
                            size="sm"
                            variant={asiento.detalle_at ? 'ghost' : 'default'}
                            disabled={!canFetch || fetching.processing}
                            onClick={fetchOfficial}
                        >
                            {fetching.processing ? <Spinner /> : <FileDown />}
                            {asiento.detalle_at
                                ? 'Actualizar desde OECE'
                                : 'Traer detalle y PDF'}
                        </Button>
                    </div>
                </div>
                {asiento.detalle_at ? (
                    <div className="space-y-2 rounded-md border bg-background p-3 text-sm">
                        <p className="whitespace-pre-line">
                            {asiento.descripcion || 'Sin descripción.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {[
                                asiento.referencia &&
                                    `Asiento de referencia: ${asiento.referencia}`,
                                asiento.latitud &&
                                    asiento.latitud !== '(*)' &&
                                    `Ubicación: ${asiento.latitud}, ${asiento.longitud}`,
                                asiento.pdf_bytes &&
                                    `PDF ${Math.max(1, Math.round(asiento.pdf_bytes / 1024))} KB`,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {canFetch
                            ? 'Trae la descripción completa y el PDF oficial de este asiento.'
                            : 'Conecta la cuenta para traer la descripción completa y el PDF oficial.'}
                    </p>
                )}
            </section>
            <form onSubmit={saveNote} className="space-y-2">
                <Label htmlFor={`nota-${asiento.id}`}>Nota interna</Label>
                <textarea
                    id={`nota-${asiento.id}`}
                    rows={4}
                    maxLength={5000}
                    value={note.data.nota_local}
                    onChange={(event) =>
                        note.setData('nota_local', event.target.value)
                    }
                    placeholder="Solo visible en Costos: pendientes, sustento, a quién responde…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {note.errors.nota_local && (
                    <p role="alert" className="text-sm text-red-600">
                        {note.errors.nota_local}
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="submit"
                        size="sm"
                        disabled={note.processing || !note.isDirty}
                    >
                        {note.recentlySuccessful ? 'Guardada' : 'Guardar nota'}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={copyCitation}
                    >
                        <Copy /> {copied ? 'Copiado' : 'Copiar cita'}
                    </Button>
                </div>
            </form>

            <div className="space-y-3">
                <p className="text-sm font-medium">Asientos enlazados</p>
                {!asiento.referencias.length &&
                    !asiento.referenciado_por.length && (
                        <p className="text-sm text-muted-foreground">
                            Enlaza consultas con sus absoluciones, o un asiento
                            con el que lo responde.
                        </p>
                    )}
                <ul className="space-y-1 text-sm">
                    {asiento.referencias.map((item) => (
                        <li key={item.id} className="flex items-start gap-2">
                            <ArrowRight size={14} className="mt-1 shrink-0" />
                            <span className="flex-1">
                                <strong>N.º {item.destino.numero}</strong>{' '}
                                {item.destino.titulo}
                            </span>
                            <button
                                type="button"
                                aria-label={`Quitar enlace con ${item.destino.numero}`}
                                onClick={() => removeLink(item.id)}
                                className="text-muted-foreground hover:text-red-600"
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                    {asiento.referenciado_por.map((item) => (
                        <li key={item.id} className="flex items-start gap-2">
                            <ArrowLeft size={14} className="mt-1 shrink-0" />
                            <span className="flex-1">
                                <strong>N.º {item.origen.numero}</strong>{' '}
                                {item.origen.titulo}
                            </span>
                            <button
                                type="button"
                                aria-label={`Quitar enlace con ${item.origen.numero}`}
                                onClick={() => removeLink(item.id)}
                                className="text-muted-foreground hover:text-red-600"
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
                <form onSubmit={addLink} className="flex items-start gap-2">
                    <div className="flex-1">
                        <Input
                            type="number"
                            min={1}
                            aria-label="Número de asiento a enlazar"
                            placeholder="N.º de asiento"
                            value={linkForm.data.numero}
                            onChange={(event) =>
                                linkForm.setData('numero', event.target.value)
                            }
                        />
                        {linkForm.errors.numero && (
                            <p
                                role="alert"
                                className="mt-1 text-sm text-red-600"
                            >
                                {linkForm.errors.numero}
                            </p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={linkForm.processing || !linkForm.data.numero}
                    >
                        Enlazar
                    </Button>
                </form>
            </div>
        </div>
    );
}
