import { router } from '@inertiajs/react';
import axios, { isAxiosError } from 'axios';
import {
    CornerDownLeft,
    Eye,
    ListChecks,
    MousePointerClick,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { interact, screen as screenRoute } from '@/routes/costos/cuaderno';

interface ScreenField {
    ref: number;
    kind: 'text' | 'password' | 'checkbox' | 'radio' | 'select' | 'button';
    label: string;
    inputType: string | null;
    maxLength: number | null;
    required: boolean;
    checked: boolean | null;
    options: { value: string; label: string }[] | null;
}

interface ScreenData {
    path: string | null;
    text: string;
    fields: ScreenField[];
    viewport: { width: number; height: number } | null;
    shot: string | null;
}

interface RemoteResponse {
    conexion_estado: string;
    screen: ScreenData;
}

const PRIMARY_ACTION =
    /ingresar|enviar|validar|verificar|aceptar|continuar|siguiente|confirmar|registrar/i;

function errorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const errors = error.response?.data?.errors as
            Record<string, string[]> | undefined;
        const first = errors && Object.values(errors)[0]?.[0];
        if (first) return first;
    }
    return 'No se pudo comunicar con el conector.';
}

/**
 * Shows the official screen of the invisible browser inside Costos: its fields as a
 * native form, or a live picture that forwards clicks and keys when a screen is unusual.
 */
export default function RemoteScreen({
    projectId,
    vinculoId,
    estado,
}: {
    projectId: number;
    vinculoId: number;
    estado: string;
}) {
    const [screen, setScreen] = useState<ScreenData | null>(null);
    const [mode, setMode] = useState<'form' | 'view'>('form');
    const [values, setValues] = useState<Record<number, string | boolean>>({});
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = Object.keys(values).length > 0;

    const handle = useCallback(
        (data: RemoteResponse) => {
            setScreen(data.screen);
            // The official step was completed: let the wizard move on.
            if (data.conexion_estado !== estado) {
                router.reload({ showProgress: false });
            }
        },
        [estado],
    );

    const load = useCallback(
        async (withShot: boolean) => {
            try {
                const response = await axios.post<RemoteResponse>(
                    screenRoute.url(projectId),
                    { vinculo_id: vinculoId, shot: withShot },
                );
                setError(null);
                handle(response.data);
            } catch (caught) {
                setError(errorMessage(caught));
            }
        },
        [projectId, vinculoId, handle],
    );

    // Refresh while waiting; pause while the holder is typing in the form.
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const started = useRef(false);
    useEffect(() => {
        if (busy || (mode === 'form' && dirty)) return;
        let cancelled = false;
        const tick = async () => {
            await load(mode === 'view');
            if (!cancelled) {
                timer.current = setTimeout(tick, mode === 'view' ? 2000 : 4000);
            }
        };
        const interval = mode === 'view' ? 2000 : 4000;
        timer.current = setTimeout(tick, started.current ? interval : 0);
        started.current = true;
        return () => {
            cancelled = true;
            if (timer.current) clearTimeout(timer.current);
        };
    }, [mode, dirty, busy, load]);

    async function send(payload: Record<string, unknown>) {
        setBusy(true);
        try {
            const response = await axios.post<RemoteResponse>(
                interact.url(projectId),
                { vinculo_id: vinculoId, shot: mode === 'view', ...payload },
            );
            setError(null);
            setValues({});
            handle(response.data);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    function submitForm(submit: number | null) {
        const fields = (screen?.fields ?? [])
            .filter((field) => field.kind !== 'button' && field.ref in values)
            .map((field) =>
                field.kind === 'checkbox' || field.kind === 'radio'
                    ? { ref: field.ref, checked: Boolean(values[field.ref]) }
                    : {
                          ref: field.ref,
                          value: String(values[field.ref] ?? ''),
                      },
            );
        void send({ kind: 'form', fields, submit });
    }

    function onFormSubmit(event: FormEvent) {
        event.preventDefault();
        const primary = screen?.fields.find(
            (field) =>
                field.kind === 'button' && PRIMARY_ACTION.test(field.label),
        );
        submitForm(primary?.ref ?? null);
    }

    function clickPicture(event: React.MouseEvent<HTMLImageElement>) {
        if (!screen?.viewport || busy) return;
        const box = event.currentTarget.getBoundingClientRect();
        void send({
            kind: 'click',
            x: Math.round(
                ((event.clientX - box.left) / box.width) *
                    screen.viewport.width,
            ),
            y: Math.round(
                ((event.clientY - box.top) / box.height) *
                    screen.viewport.height,
            ),
        });
    }

    const inputs =
        screen?.fields.filter((field) => field.kind !== 'button') ?? [];
    const buttons =
        screen?.fields.filter((field) => field.kind === 'button') ?? [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Pantalla actual de OECE</p>
                <div className="flex gap-1 rounded-lg border p-1">
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'form' ? 'secondary' : 'ghost'}
                        onClick={() => setMode('form')}
                    >
                        <ListChecks /> Formulario
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'view' ? 'secondary' : 'ghost'}
                        onClick={() => setMode('view')}
                    >
                        <Eye /> Ver pantalla
                    </Button>
                </div>
            </div>

            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}

            {!screen ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner /> Leyendo la pantalla de OECE…
                </p>
            ) : mode === 'form' ? (
                <form onSubmit={onFormSubmit} className="space-y-4">
                    {screen.text && (
                        <p className="max-h-40 overflow-y-auto rounded-md bg-muted/60 p-3 text-sm whitespace-pre-line">
                            {screen.text}
                        </p>
                    )}
                    {inputs.map((field) => {
                        const id = `remote-${field.ref}`;
                        if (
                            field.kind === 'checkbox' ||
                            field.kind === 'radio'
                        ) {
                            const checked =
                                field.ref in values
                                    ? Boolean(values[field.ref])
                                    : Boolean(field.checked);
                            return (
                                <label
                                    key={field.ref}
                                    className="flex items-start gap-3 text-sm"
                                >
                                    <input
                                        id={id}
                                        type={field.kind}
                                        checked={checked}
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                [field.ref]:
                                                    event.target.checked,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                    {field.label || 'Marcar'}
                                </label>
                            );
                        }
                        return (
                            <div key={field.ref} className="space-y-2">
                                <Label htmlFor={id}>
                                    {field.label || 'Campo'}
                                </Label>
                                {field.kind === 'select' ? (
                                    <select
                                        id={id}
                                        value={String(values[field.ref] ?? '')}
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                [field.ref]: event.target.value,
                                            }))
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">Selecciona…</option>
                                        {field.options?.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <Input
                                        id={id}
                                        type={
                                            field.kind === 'password'
                                                ? 'password'
                                                : 'text'
                                        }
                                        inputMode={
                                            field.inputType === 'number' ||
                                            field.inputType === 'tel'
                                                ? 'numeric'
                                                : undefined
                                        }
                                        autoComplete={
                                            field.kind === 'password'
                                                ? 'current-password'
                                                : 'one-time-code'
                                        }
                                        maxLength={field.maxLength ?? undefined}
                                        value={String(values[field.ref] ?? '')}
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                [field.ref]: event.target.value,
                                            }))
                                        }
                                    />
                                )}
                            </div>
                        );
                    })}
                    {buttons.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {buttons.map((field) => (
                                <Button
                                    key={field.ref}
                                    type="button"
                                    disabled={busy}
                                    variant={
                                        PRIMARY_ACTION.test(field.label)
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => submitForm(field.ref)}
                                >
                                    {busy &&
                                        PRIMARY_ACTION.test(field.label) && (
                                            <Spinner />
                                        )}
                                    {field.label}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        !inputs.length && (
                            <p className="text-sm text-muted-foreground">
                                Esta pantalla no tiene campos reconocibles. Usa{' '}
                                <button
                                    type="button"
                                    className="underline"
                                    onClick={() => setMode('view')}
                                >
                                    Ver pantalla
                                </button>{' '}
                                para verla y hacer clic.
                            </p>
                        )
                    )}
                    {dirty && (
                        <p className="text-xs text-muted-foreground">
                            La actualización automática se pausa mientras
                            completas los campos.
                        </p>
                    )}
                </form>
            ) : (
                <div className="space-y-3">
                    {screen.shot ? (
                        <img
                            src={`data:image/jpeg;base64,${screen.shot}`}
                            alt="Pantalla actual del portal OECE"
                            onClick={clickPicture}
                            className={`w-full rounded-md border ${busy ? 'opacity-60' : 'cursor-pointer'}`}
                        />
                    ) : (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Cargando imagen…
                        </p>
                    )}
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MousePointerClick size={14} /> Haz clic en la imagen
                        para pulsar en esa posición del portal.
                    </p>
                    <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!typed) return;
                            void send({ kind: 'type', text: typed });
                            setTyped('');
                        }}
                    >
                        <Input
                            aria-label="Texto para escribir en el campo seleccionado"
                            placeholder="Escribe aquí y pulsa Escribir (va al campo seleccionado)"
                            value={typed}
                            maxLength={2000}
                            onChange={(event) => setTyped(event.target.value)}
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={busy || !typed}
                        >
                            Escribir
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            aria-label="Pulsar Enter"
                            onClick={() =>
                                void send({ kind: 'key', key: 'Enter' })
                            }
                        >
                            <CornerDownLeft />
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
