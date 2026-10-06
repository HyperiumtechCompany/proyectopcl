import { router } from '@inertiajs/react';
import axios from 'axios';
import { Download, Laptop, Puzzle, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    code as agentCode,
    extension as extensionZip,
    revoke,
} from '@/routes/costos/cuaderno/agent';
import { pairExtension, useCuadernoExtension } from './useCuadernoExtension';

export interface Agente {
    id: number;
    nombre: string;
    tipo: 'pc' | 'extension';
    plataforma: string | null;
    version: string | null;
    last_seen_at: string | null;
    en_linea: boolean;
}

interface Installation {
    codigo: string;
    instalador: string;
    expira: string;
}

const lastSeen = (value: string | null) =>
    value
        ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' })
        : 'nunca';

/**
 * Production mode: OECE only accepts the holder's own browser and network. The preferred
 * way is the "Asistente del Cuaderno" extension (one click, uses their own OECE session);
 * the desktop connector stays as an alternative.
 */
export default function AgentConnector({
    projectId,
    online,
    agentes,
    actual,
    extensionUrl,
}: {
    projectId: number;
    online: boolean;
    agentes: Agente[];
    actual: number | null;
    extensionUrl: string | null;
}) {
    const extension = useCuadernoExtension();
    const [installation, setInstallation] = useState<Installation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [managing, setManaging] = useState(false);
    const active = agentes.find((agente) => agente.en_linea);

    // Installed but not linked yet: link it once, without any code to type.
    const pairing = useRef(false);
    const { installed, paired } = extension;
    useEffect(() => {
        if (!installed || paired !== false || pairing.current) return;
        pairing.current = true;
        axios
            .post<Installation>(agentCode.url(projectId))
            .then((response) => pairExtension(response.data.codigo))
            .catch(() => {
                pairing.current = false;
                setError('No se pudo activar el asistente. Recarga la página.');
            });
    }, [installed, paired, projectId]);

    async function installDesktop() {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post<Installation>(
                agentCode.url(projectId),
            );
            setInstallation(response.data);
        } catch {
            setError('No se pudo generar el código. Vuelve a intentar.');
        } finally {
            setLoading(false);
        }
    }

    function remove(agente: Agente) {
        router.delete(
            revoke.url({ costoProject: projectId, agente: agente.id }),
            {
                preserveScroll: true,
            },
        );
    }

    const list = agentes.length > 0 && (
        <ul className="divide-y rounded-lg border">
            {agentes.map((agente) => (
                <li
                    key={agente.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                    <span className="flex flex-wrap items-center gap-2">
                        <span
                            className={`size-2 rounded-full ${agente.en_linea ? 'bg-green-600' : 'bg-muted-foreground/40'}`}
                        />
                        <strong>{agente.nombre}</strong>
                        <span className="text-xs text-muted-foreground">
                            {agente.tipo === 'extension'
                                ? 'Asistente del navegador'
                                : 'Programa de PC'}
                            {agente.id === actual ? ' · conexión actual' : ''} ·{' '}
                            {agente.en_linea
                                ? 'en línea'
                                : `visto ${lastSeen(agente.last_seen_at)}`}
                        </span>
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(agente)}
                    >
                        <X /> Desvincular
                    </Button>
                </li>
            ))}
        </ul>
    );

    const desktop = (
        <details className="rounded-lg border bg-background/60 p-3 text-sm">
            <summary className="cursor-pointer font-medium">
                ¿No puedes usar extensiones? Instala el programa conector
            </summary>
            <div className="mt-3 space-y-3">
                {installation ? (
                    <ol className="space-y-2">
                        <li className="flex flex-wrap items-center gap-2">
                            <Button size="sm" asChild>
                                <a href={installation.instalador}>
                                    <Download /> Descargar instalador
                                </a>
                            </Button>
                            <span className="text-muted-foreground">
                                Código {installation.codigo} · vale 15 minutos
                            </span>
                        </li>
                        <li>
                            Abre <code>instalar-conector-costos.cmd</code>; si
                            Windows avisa, «Más información» → «Ejecutar de
                            todas formas». Requiere Windows 10/11 de 64 bits.
                        </li>
                    </ol>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={installDesktop}
                    >
                        {loading ? <Spinner /> : <Laptop />} Generar instalador
                        para esta PC
                    </Button>
                )}
            </div>
        </details>
    );

    if (online && active) {
        const here = active.tipo === 'extension' && extension.installed;
        return (
            <div className="flex flex-col items-end gap-2">
                <button
                    type="button"
                    onClick={() => setManaging((value) => !value)}
                    className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                >
                    <span className="size-2 rounded-full bg-green-600" />
                    {here
                        ? 'Asistente del Cuaderno activo en este navegador'
                        : `Conector activo en «${active.nombre}»`}
                </button>
                {managing && (
                    <div className="w-full max-w-xl space-y-3 rounded-xl border bg-card p-4">
                        {list}
                    </div>
                )}
            </div>
        );
    }

    if (extension.installed) {
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
                {error || extension.error ? (
                    <>
                        <p role="alert" className="text-red-600">
                            {error ?? extension.error}
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw /> Reintentar
                        </Button>
                    </>
                ) : (
                    <p className="flex items-center gap-2 text-muted-foreground">
                        <Spinner /> Activando el Asistente del Cuaderno en este
                        navegador…
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-3">
                <Puzzle
                    className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                    size={22}
                />
                <div className="space-y-1 text-sm">
                    <p className="font-medium">
                        Agrega el Asistente del Cuaderno a tu navegador (una
                        sola vez)
                    </p>
                    <p className="text-muted-foreground">
                        OECE solo acepta tu propio navegador. Con el asistente
                        entras a OECE como siempre, con tu usuario y tu
                        verificación, y Costos trae los asientos y los PDF por
                        ti. Tu contraseña nunca pasa por Costos y funciona en tu
                        laptop o PC, en la oficina o en casa.
                    </p>
                </div>
            </div>
            {extensionUrl ? (
                <div className="flex flex-wrap gap-2">
                    <Button asChild>
                        <a href={extensionUrl} target="_blank" rel="noreferrer">
                            <Puzzle /> Agregar a Chrome o Edge
                        </a>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw /> Ya lo agregué
                    </Button>
                </div>
            ) : (
                <div className="space-y-2 text-sm">
                    <Button asChild>
                        <a href={extensionZip.url(projectId)}>
                            <Download /> Descargar asistente (versión de prueba)
                        </a>
                    </Button>
                    <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                        <li>
                            Descomprime el archivo descargado en una carpeta.
                        </li>
                        <li>
                            Abre <code>chrome://extensions</code> (o{' '}
                            <code>edge://extensions</code>) y activa «Modo de
                            desarrollador».
                        </li>
                        <li>
                            Pulsa «Cargar descomprimida» y elige esa carpeta.
                        </li>
                        <li>
                            Vuelve aquí y{' '}
                            <button
                                type="button"
                                className="underline"
                                onClick={() => window.location.reload()}
                            >
                                recarga la página
                            </button>
                            .
                        </li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                        Cuando esté publicada en la tienda de Chrome y Edge será
                        un solo clic.
                    </p>
                </div>
            )}
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            {desktop}
            {list}
        </div>
    );
}
