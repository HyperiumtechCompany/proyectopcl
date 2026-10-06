import { router } from '@inertiajs/react';
import axios, { isAxiosError } from 'axios';
import { CloudDownload, FileArchive, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { pdfs } from '@/routes/costos/cuaderno';
import { oficial } from '@/routes/costos/cuaderno/asientos';

/** [id, numero, has official PDF, has official detail], in number order. */
export type IndexEntry = [number, number, boolean, boolean];

type Scope = 'todos' | 'rango' | 'seleccion';

interface Progress {
    done: number;
    total: number;
    failed: number;
    current: number;
}

function reason(error: unknown): string {
    if (isAxiosError(error)) {
        const errors = error.response?.data?.errors as
            Record<string, string[]> | undefined;
        const first = errors && Object.values(errors)[0]?.[0];
        if (first) return first;
    }
    return 'No se pudo comunicar con el conector.';
}

/**
 * Downloads by number order: all, a number range or the selected rows.
 * "Traer de OECE" stores the official PDF (and optionally the full detail) in Costos;
 * "ZIP" hands the stored PDFs to the computer, named "0007 - Título.pdf".
 */
export default function DownloadCenter({
    projectId,
    indice,
    selected,
    canFetch,
}: {
    projectId: number;
    indice: IndexEntry[];
    selected: number[];
    canFetch: boolean;
}) {
    const first = indice[0]?.[1] ?? 1;
    const last = indice.at(-1)?.[1] ?? 1;
    const [scope, setScope] = useState<Scope>(
        selected.length ? 'seleccion' : 'todos',
    );
    const [desde, setDesde] = useState(String(first));
    const [hasta, setHasta] = useState(String(Math.min(last, first + 49)));
    const [onlyMissing, setOnlyMissing] = useState(true);
    const [withDetail, setWithDetail] = useState(false);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const stopRequested = useRef(false);

    const from = Number(desde) || first;
    const to = Number(hasta) || last;
    const chosen = new Set(selected);
    const inScope = indice.filter(([id, numero]) =>
        scope === 'todos'
            ? true
            : scope === 'rango'
              ? numero >= Math.min(from, to) && numero <= Math.max(from, to)
              : chosen.has(id),
    );
    const toFetch = inScope.filter(
        ([, , pdf, detail]) => !onlyMissing || !pdf || (withDetail && !detail),
    );
    const zipCount = inScope.filter(([, , pdf]) => pdf).length;
    const withPdf = indice.filter(([, , pdf]) => pdf).length;
    const withFullDetail = indice.filter(([, , , detail]) => detail).length;

    const zipUrl = pdfs.url(projectId, {
        query:
            scope === 'todos'
                ? {}
                : scope === 'rango'
                  ? { desde: Math.min(from, to), hasta: Math.max(from, to) }
                  : { ids: selected },
    });

    async function fetchAll() {
        stopRequested.current = false;
        setSummary(null);
        const queue = [...toFetch];
        let failed = 0;
        let consecutive = 0;
        let stoppedBy: string | null = null;
        for (let index = 0; index < queue.length; index++) {
            const [id, numero] = queue[index];
            setProgress({
                done: index,
                total: queue.length,
                failed,
                current: numero,
            });
            if (stopRequested.current) {
                stoppedBy = `Detenido en el N.º ${numero}.`;
                break;
            }
            try {
                await axios.post(
                    oficial.url({ costoProject: projectId, asiento: id }),
                    { detalle: withDetail },
                    { headers: { Accept: 'application/json' } },
                );
                consecutive = 0;
            } catch (error) {
                failed++;
                consecutive++;
                const message = reason(error);
                // Session problems affect every entry: stop and ask to reconnect.
                if (
                    /expir|Conecta|sesión terminó|no responde/i.test(message) ||
                    consecutive >= 3
                ) {
                    stoppedBy = `Detenido en el N.º ${numero}: ${message}`;
                    break;
                }
            }
        }
        setProgress(null);
        setSummary(
            stoppedBy ??
                (failed
                    ? `Terminado con ${failed} asiento(s) sin descargar; vuelve a intentarlo con "solo los que faltan".`
                    : `${queue.length} asiento(s) descargados en orden.`),
        );
        router.reload({ showProgress: false });
    }

    const pill = (value: Scope, label: string, disabled = false) => (
        <button
            type="button"
            disabled={disabled || Boolean(progress)}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                scope === value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'hover:bg-muted'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Descargas</p>
                <p className="text-xs text-muted-foreground">
                    PDF oficiales en Costos: {withPdf} de {indice.length} · con
                    descripción completa: {withFullDetail}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {pill('todos', `Todos (${indice.length})`)}
                {pill('rango', 'Rango por número')}
                {pill(
                    'seleccion',
                    `Seleccionados (${selected.length})`,
                    !selected.length,
                )}
                {scope === 'rango' && (
                    <span className="flex items-center gap-2 text-sm">
                        del N.º
                        <Input
                            type="number"
                            min={first}
                            max={last}
                            value={desde}
                            onChange={(event) => setDesde(event.target.value)}
                            className="h-8 w-24"
                            aria-label="Desde el número"
                        />
                        al
                        <Input
                            type="number"
                            min={first}
                            max={last}
                            value={hasta}
                            onChange={(event) => setHasta(event.target.value)}
                            className="h-8 w-24"
                            aria-label="Hasta el número"
                        />
                    </span>
                )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                    <p className="text-sm font-medium">
                        1. Traer de OECE a Costos
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={onlyMissing}
                            onChange={(event) =>
                                setOnlyMissing(event.target.checked)
                            }
                        />
                        Solo los que faltan
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={withDetail}
                            onChange={(event) =>
                                setWithDetail(event.target.checked)
                            }
                        />
                        Incluir descripción completa (más lento)
                    </label>
                    {progress ? (
                        <div className="space-y-2" aria-live="polite">
                            <div className="flex items-center gap-2 text-sm">
                                <Spinner /> N.º {progress.current} ·{' '}
                                {progress.done} de {progress.total}
                                {progress.failed
                                    ? ` · ${progress.failed} con error`
                                    : ''}
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-blue-600 transition-all"
                                    style={{
                                        width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
                                    }}
                                />
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => (stopRequested.current = true)}
                            >
                                <Square /> Detener
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            disabled={!canFetch || !toFetch.length}
                            onClick={fetchAll}
                        >
                            <CloudDownload /> Traer {toFetch.length} asiento(s)
                            en orden
                        </Button>
                    )}
                    {!canFetch && (
                        <p className="text-xs text-muted-foreground">
                            Conecta la cuenta para traer documentos de OECE.
                        </p>
                    )}
                </div>

                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                    <p className="text-sm font-medium">
                        2. Bajar a mi computadora
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Un ZIP con los PDF oficiales ya traídos, ordenados por
                        número ("0007 - Título.pdf"). No necesita conexión con
                        OECE.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!zipCount}
                        asChild={zipCount > 0}
                    >
                        {zipCount > 0 ? (
                            <a href={zipUrl}>
                                <FileArchive /> Descargar ZIP ({zipCount} PDF)
                            </a>
                        ) : (
                            <span>
                                <FileArchive /> Sin PDF en esta selección
                            </span>
                        )}
                    </Button>
                </div>
            </div>
            {summary && (
                <p className="text-sm text-muted-foreground">{summary}</p>
            )}
        </div>
    );
}
