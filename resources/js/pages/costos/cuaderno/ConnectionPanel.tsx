import { router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    MoreHorizontal,
    RefreshCw,
    ShieldCheck,
    Smartphone,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    capture,
    confirm,
    connect,
    disconnect,
    inspect,
    preview,
    select as selectNotebook,
    switchMethod,
    sync,
} from '@/routes/costos/cuaderno';
import RemoteScreen from './RemoteScreen';
import { focusPortalTab } from './useCuadernoExtension';

export interface Connection {
    id: number;
    estado: string;
    entidad: string | null;
    obra: string | null;
    codigo_cui: string | null;
    rol: string | null;
    tiene_sesion: boolean;
    conexion_estado: string;
    conexion_mensaje: string | null;
    cuadernos_disponibles: { key: string; label: string }[] | null;
    sync_completa: boolean;
    total_oficial: number | null;
    last_synced_at: string | null;
}

export interface DetectedNotebook {
    entidad: string;
    obra: string;
    codigo_cui: string | null;
}

export interface SyncProgress {
    page: number;
    rows: number;
    total: number | null;
}

type Step =
    | 'login'
    | 'waiting'
    | 'select'
    | 'detecting'
    | 'confirm'
    | 'ready'
    | 'syncing';

const STEPS = ['Conectar cuenta', 'Elegir cuaderno', 'Bandeja al día'];
const STEP_INDEX: Record<Step, number> = {
    login: 0,
    waiting: 0,
    select: 1,
    detecting: 1,
    confirm: 1,
    ready: 2,
    syncing: 2,
};
const SAVED_USER_KEY = 'cuaderno.oece.usuario';

const normalize = (value: string | null) =>
    (value ?? '')
        .normalize('NFD')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();

function isOtherNotebook(vinculo: Connection, detected: DetectedNotebook) {
    return (
        normalize(vinculo.entidad) !== normalize(detected.entidad) ||
        normalize(vinculo.obra) !== normalize(detected.obra)
    );
}

function currentStep(
    vinculo: Connection | null,
    detected: DetectedNotebook | null,
): Step {
    if (
        !vinculo?.tiene_sesion ||
        ['desconectada', 'requiere_ingreso'].includes(vinculo.conexion_estado)
    ) {
        return 'login';
    }
    switch (vinculo.conexion_estado) {
        case 'requiere_intervencion':
            return 'waiting';
        case 'seleccionar_cuaderno':
            return 'select';
        case 'sincronizando':
            return 'syncing';
        case 'conectada':
            if (vinculo.estado === 'verificada')
                return detected && isOtherNotebook(vinculo, detected)
                    ? 'confirm'
                    : 'ready';
            return detected ? 'confirm' : 'detecting';
        default:
            return vinculo.estado === 'verificada' ? 'ready' : 'login';
    }
}

function readSavedUser(): string {
    try {
        return localStorage.getItem(SAVED_USER_KEY) ?? '';
    } catch {
        return '';
    }
}

function saveUser(usuario: string) {
    try {
        localStorage.setItem(SAVED_USER_KEY, usuario);
    } catch {
        // Remembering the user name is only a convenience.
    }
}

const formatDate = (value: string) =>
    new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' });

/** Repeats a silent POST while the connection stays in the same state. */
function usePolling(
    url: string | null,
    vinculoId: number | undefined,
    interval: number,
    maxMs: number,
) {
    useEffect(() => {
        if (!url || vinculoId === undefined) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const deadline = Date.now() + maxMs;
        const tick = () =>
            router.post(
                url,
                { vinculo_id: vinculoId },
                {
                    preserveScroll: true,
                    preserveState: true,
                    showProgress: false,
                    onFinish: () => {
                        if (!cancelled && Date.now() < deadline) {
                            timer = setTimeout(tick, interval);
                        }
                    },
                },
            );
        timer = setTimeout(tick, interval);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [url, vinculoId, interval, maxMs]);
}

export default function ConnectionPanel({
    projectId,
    projectCui,
    vinculo,
    detected,
    progress,
    connectorOnline,
    viaExtension = false,
}: {
    projectId: number;
    projectCui: string | null;
    vinculo: Connection | null;
    detected: DetectedNotebook | null;
    progress: SyncProgress | null;
    connectorOnline: boolean | undefined;
    /** The holder signs in on their own OECE tab through the browser extension. */
    viaExtension?: boolean;
}) {
    const step = currentStep(vinculo, detected);
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const login = useForm({
        vinculo_id: vinculo?.id ?? null,
        usuario: readSavedUser(),
        password: '',
    });
    const operation = useForm({ vinculo_id: vinculo?.id ?? 0 });
    const busy = login.processing || operation.processing;
    const offline = connectorOnline === false;
    const [remoteOpen, setRemoteOpen] = useState(false);

    // With the extension, the holder signs in on the real OECE tab: Costos checks every few seconds.
    usePolling(
        step === 'waiting' && viaExtension ? inspect.url(projectId) : null,
        vinculo?.id,
        3000,
        10 * 60 * 1000,
    );
    usePolling(
        step === 'syncing' ? sync.url(projectId) : null,
        vinculo?.id,
        2000,
        20 * 60 * 1000,
    );

    // Once connected, read the open notebook without asking for another click.
    const detectedFor = useRef<number | null>(null);
    useEffect(() => {
        if (
            step !== 'detecting' ||
            !vinculo ||
            detectedFor.current === vinculo.id
        )
            return;
        detectedFor.current = vinculo.id;
        router.post(
            preview.url(projectId),
            { vinculo_id: vinculo.id },
            { preserveScroll: true, preserveState: true },
        );
    }, [step, vinculo, projectId]);

    function run(url: string, data: Record<string, unknown> = {}) {
        operation.transform(() => ({ vinculo_id: vinculo?.id, ...data }));
        operation.post(url, { preserveScroll: true });
    }

    function submitLogin(event: FormEvent) {
        event.preventDefault();
        saveUser(login.data.usuario);
        login.post(connect.url(projectId), {
            preserveScroll: true,
            onFinish: () => login.setData('password', ''),
        });
    }

    function confirmAndSync(replace = false) {
        operation.transform(() => ({
            vinculo_id: vinculo?.id,
            confirmacion: true,
            reemplazar: replace,
        }));
        operation.post(confirm.url(projectId), {
            preserveScroll: true,
            onSuccess: (page) => {
                // Replacing creates a new link; import into the one now active.
                const active = (
                    page.props as { vinculo?: { id: number } | null }
                ).vinculo;
                if (active)
                    router.post(
                        sync.url(projectId),
                        { vinculo_id: active.id },
                        { preserveScroll: true },
                    );
            },
        });
    }

    const error = errors.conexion;
    const percent =
        progress?.total && progress.total > 0
            ? Math.min(100, Math.round((progress.rows / progress.total) * 100))
            : null;

    return (
        <section className="space-y-5 rounded-xl border bg-card p-5">
            <ol className="flex flex-wrap items-center gap-2 text-xs">
                {STEPS.map((label, index) => {
                    const done = index < STEP_INDEX[step];
                    const active = index === STEP_INDEX[step];
                    return (
                        <li key={label} className="flex items-center gap-2">
                            <span
                                className={`flex size-6 items-center justify-center rounded-full border font-semibold ${
                                    done
                                        ? 'border-green-600 bg-green-600 text-white'
                                        : active
                                          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                          : 'text-muted-foreground'
                                }`}
                            >
                                {done ? <Check size={14} /> : index + 1}
                            </span>
                            <span
                                className={
                                    active
                                        ? 'font-medium'
                                        : 'text-muted-foreground'
                                }
                            >
                                {label}
                            </span>
                            {index < STEPS.length - 1 && (
                                <span className="mx-1 h-px w-6 bg-border" />
                            )}
                        </li>
                    );
                })}
            </ol>

            {error && (
                <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                    {error}
                </p>
            )}

            {step === 'login' && viaExtension && (
                <div className="space-y-4">
                    <div>
                        <h2 className="font-semibold">
                            {vinculo?.estado === 'verificada'
                                ? 'Reconectar con OECE'
                                : 'Conecta tu Cuaderno de OECE'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Costos usa tu propia sesión de OECE en este
                            navegador. Si aún no entraste, se abrirá la pestaña
                            oficial para que ingreses como siempre. Tu
                            contraseña no pasa por Costos.
                        </p>
                    </div>
                    {vinculo?.conexion_mensaje &&
                        vinculo.conexion_estado === 'requiere_ingreso' && (
                            <p
                                role="alert"
                                className="text-sm text-amber-700 dark:text-amber-400"
                            >
                                {vinculo.conexion_mensaje}
                            </p>
                        )}
                    <Button
                        disabled={busy || offline}
                        onClick={() => run(connect.url(projectId))}
                    >
                        {operation.processing && <Spinner />}
                        {operation.processing ? 'Abriendo OECE…' : 'Conectar'}
                    </Button>
                </div>
            )}

            {step === 'login' && !viaExtension && (
                <div className="space-y-4">
                    <form onSubmit={submitLogin} className="space-y-4">
                        <div>
                            <h2 className="font-semibold">
                                {vinculo?.estado === 'verificada'
                                    ? 'Reconectar con OECE'
                                    : 'Ingresa con tu cuenta del Cuaderno de Obra (OECE)'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {vinculo?.estado === 'verificada'
                                    ? 'Solo hace falta para traer novedades, PDF o detalles de OECE. Mientras tanto puedes buscar, ver los PDF ya descargados, enlazar y anotar con la copia local de abajo.'
                                    : 'Costos ingresa al portal oficial en segundo plano, sin abrir ventanas, y detecta el cuaderno. La contraseña no se guarda.'}
                            </p>
                        </div>
                        {vinculo?.conexion_estado === 'requiere_ingreso' &&
                            vinculo.conexion_mensaje && (
                                <p
                                    role="alert"
                                    className="text-sm text-amber-700 dark:text-amber-400"
                                >
                                    {vinculo.conexion_mensaje}
                                </p>
                            )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="oece-user">Usuario OECE</Label>
                                <Input
                                    id="oece-user"
                                    value={login.data.usuario}
                                    onChange={(event) =>
                                        login.setData(
                                            'usuario',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="username"
                                    required
                                    maxLength={100}
                                    disabled={busy}
                                />
                                {login.errors.usuario && (
                                    <p
                                        role="alert"
                                        className="text-sm text-red-600"
                                    >
                                        {login.errors.usuario}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="oece-password">
                                    Contraseña
                                </Label>
                                <Input
                                    id="oece-password"
                                    type="password"
                                    value={login.data.password}
                                    onChange={(event) =>
                                        login.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="current-password"
                                    required
                                    maxLength={255}
                                    disabled={busy}
                                />
                                {login.errors.password && (
                                    <p
                                        role="alert"
                                        className="text-sm text-red-600"
                                    >
                                        {login.errors.password}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={busy || offline}>
                                {login.processing && <Spinner />}
                                {login.processing
                                    ? 'Ingresando a OECE…'
                                    : 'Conectar'}
                            </Button>
                            {login.processing && (
                                <span className="text-sm text-muted-foreground">
                                    Puede tardar unos segundos mientras abre el
                                    portal.
                                </span>
                            )}
                            {offline && (
                                <span className="text-sm text-muted-foreground">
                                    Inicia el conector para continuar.
                                </span>
                            )}
                        </div>
                    </form>
                    {vinculo?.tiene_sesion &&
                        vinculo.conexion_estado === 'requiere_ingreso' && (
                            <details className="rounded-lg border p-3">
                                <summary className="cursor-pointer text-sm font-medium">
                                    Ver qué muestra OECE
                                </summary>
                                <div className="mt-3">
                                    <RemoteScreen
                                        projectId={projectId}
                                        vinculoId={vinculo.id}
                                        estado={vinculo.conexion_estado}
                                    />
                                </div>
                            </details>
                        )}
                </div>
            )}

            {step === 'waiting' && vinculo && viaExtension && (
                <div className="flex gap-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                    <Smartphone
                        className="mt-1 shrink-0 text-blue-600 dark:text-blue-400"
                        size={24}
                    />
                    <div className="space-y-3">
                        <h2 className="font-semibold">
                            Ingresa a OECE en su pestaña
                        </h2>
                        <p className="text-sm">
                            {vinculo.conexion_mensaje ??
                                'Inicia sesión en la pestaña de OECE con tu usuario y tu verificación de siempre.'}{' '}
                            Costos continúa solo cuando termines.
                        </p>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Esperando a OECE…
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={focusPortalTab}
                        >
                            Ir a la pestaña de OECE
                        </Button>
                    </div>
                </div>
            )}

            {step === 'waiting' && vinculo && !viaExtension && (
                <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                    <div className="flex gap-3">
                        <Smartphone
                            className="mt-1 shrink-0 text-blue-600 dark:text-blue-400"
                            size={24}
                        />
                        <div>
                            <h2 className="font-semibold">
                                OECE pide una verificación
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Completa aquí mismo el código, el reconocimiento
                                del dispositivo o los términos. Costos los envía
                                al portal y continúa solo.
                            </p>
                        </div>
                    </div>
                    <RemoteScreen
                        projectId={projectId}
                        vinculoId={vinculo.id}
                        estado={vinculo.conexion_estado}
                    />
                </div>
            )}

            {step === 'select' && (
                <div className="space-y-3">
                    <div>
                        <h2 className="font-semibold">
                            ¿Cuál cuaderno corresponde a este proyecto?
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Tu cuenta tiene acceso a varios cuadernos. Elige
                            uno; se abrirá en OECE y se detectarán sus datos.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        {vinculo?.cuadernos_disponibles?.map((choice) => {
                            const matches =
                                !!projectCui &&
                                choice.label.includes(projectCui);
                            return (
                                <button
                                    key={choice.key}
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                        run(selectNotebook.url(projectId), {
                                            choice: choice.key,
                                        })
                                    }
                                    className={`rounded-lg border p-3 text-left text-sm whitespace-pre-line transition hover:border-blue-500 hover:bg-blue-50 disabled:opacity-60 dark:hover:bg-blue-950/40 ${
                                        matches
                                            ? 'border-green-500 ring-1 ring-green-500'
                                            : ''
                                    }`}
                                >
                                    {matches && (
                                        <Badge className="mb-2 bg-green-600">
                                            Coincide con el CUI del proyecto
                                        </Badge>
                                    )}
                                    <span className="block">
                                        {choice.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {operation.processing && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Abriendo el cuaderno elegido…
                        </p>
                    )}
                </div>
            )}

            {step === 'detecting' && (
                <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm">
                        <Spinner /> Leyendo los datos del cuaderno abierto en
                        OECE…
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(preview.url(projectId))}
                    >
                        Volver a detectar
                    </Button>
                </div>
            )}

            {step === 'confirm' && detected && (
                <div className="space-y-4">
                    <h2 className="font-semibold">
                        {vinculo?.estado === 'verificada'
                            ? '¿Cambiar el cuaderno de este proyecto?'
                            : '¿Es este el cuaderno del proyecto?'}
                    </h2>
                    {vinculo?.estado === 'verificada' && (
                        <p className="text-sm text-muted-foreground">
                            Ahora está vinculado a: {vinculo.obra}. Si lo
                            cambias, el anterior queda en el historial con sus
                            asientos, PDF y notas; no se mezclan.
                        </p>
                    )}
                    <dl className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-[8rem_1fr]">
                        <dt className="text-muted-foreground">Entidad</dt>
                        <dd>{detected.entidad}</dd>
                        <dt className="text-muted-foreground">Obra</dt>
                        <dd>{detected.obra}</dd>
                        <dt className="text-muted-foreground">CUI</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                            {detected.codigo_cui ?? 'No identificado'}
                            {projectCui &&
                                detected.codigo_cui === projectCui && (
                                    <Badge className="bg-green-600">
                                        Coincide con el proyecto
                                    </Badge>
                                )}
                        </dd>
                    </dl>
                    {projectCui &&
                        detected.codigo_cui &&
                        projectCui !== detected.codigo_cui && (
                            <p
                                role="alert"
                                className="text-sm text-amber-700 dark:text-amber-400"
                            >
                                Atención: el proyecto de Costos tiene CUI{' '}
                                {projectCui} y este cuaderno tiene CUI{' '}
                                {detected.codigo_cui}.
                            </p>
                        )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            disabled={busy}
                            onClick={() =>
                                confirmAndSync(vinculo?.estado === 'verificada')
                            }
                        >
                            {operation.processing && <Spinner />}
                            {vinculo?.estado === 'verificada'
                                ? 'Sí, cambiar e importar sus asientos'
                                : 'Sí, vincular e importar asientos'}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => run(disconnect.url(projectId))}
                        >
                            No, desconectar
                        </Button>
                    </div>
                </div>
            )}

            {vinculo && (
                <Dialog open={remoteOpen} onOpenChange={setRemoteOpen}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Pantalla de OECE</DialogTitle>
                            <DialogDescription>
                                El portal abierto por el conector en segundo
                                plano.
                            </DialogDescription>
                        </DialogHeader>
                        {remoteOpen && (
                            <RemoteScreen
                                projectId={projectId}
                                vinculoId={vinculo.id}
                                estado={vinculo.conexion_estado}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            )}

            {(step === 'ready' || step === 'syncing') && vinculo && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <h2 className="flex items-center gap-2 font-semibold">
                                <ShieldCheck
                                    size={18}
                                    className="text-green-600 dark:text-green-400"
                                />
                                {vinculo.entidad}
                            </h2>
                            <p className="text-sm">{vinculo.obra}</p>
                            <p className="text-xs text-muted-foreground">
                                {[
                                    vinculo.codigo_cui &&
                                        `CUI ${vinculo.codigo_cui}`,
                                    vinculo.rol,
                                    vinculo.conexion_estado === 'error'
                                        ? 'Conexión con error'
                                        : 'Sesión activa',
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {step === 'ready' &&
                                vinculo.conexion_estado !== 'error' && (
                                    <Button
                                        disabled={busy || offline}
                                        onClick={() => run(sync.url(projectId))}
                                    >
                                        <RefreshCw
                                            className={
                                                operation.processing
                                                    ? 'animate-spin'
                                                    : ''
                                            }
                                        />
                                        Sincronizar ahora
                                    </Button>
                                )}
                            {step === 'ready' &&
                                vinculo.conexion_estado === 'error' && (
                                    <Button
                                        disabled={busy || offline}
                                        onClick={() =>
                                            run(inspect.url(projectId))
                                        }
                                    >
                                        Reintentar conexión
                                    </Button>
                                )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Más acciones"
                                        disabled={busy}
                                    >
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        disabled={step === 'syncing'}
                                        onSelect={() => setRemoteOpen(true)}
                                    >
                                        Ver pantalla de OECE
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={step === 'syncing'}
                                        onSelect={() =>
                                            run(capture.url(projectId), {
                                                target: 'nuevo',
                                            })
                                        }
                                    >
                                        Capturar formulario "Nuevo asiento" (sin
                                        enviar)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={step === 'syncing'}
                                        onSelect={() =>
                                            run(capture.url(projectId), {
                                                target: 'adjuntos',
                                            })
                                        }
                                    >
                                        Capturar ventana de adjuntos
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={step === 'syncing'}
                                        onSelect={() =>
                                            run(capture.url(projectId))
                                        }
                                    >
                                        Capturar estructura de la página abierta
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={step === 'syncing'}
                                        onSelect={() =>
                                            run(switchMethod.url(projectId))
                                        }
                                    >
                                        Cambiar de obra
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() =>
                                            run(disconnect.url(projectId))
                                        }
                                    >
                                        Desconectar cuenta
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {step === 'syncing' ? (
                        <div className="space-y-2" aria-live="polite">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <Spinner /> Importando la bandeja oficial…
                                </span>
                                <span className="text-muted-foreground">
                                    {progress
                                        ? `Página ${progress.page} · ${progress.rows}${progress.total !== null ? ` de ${progress.total}` : ''} asientos`
                                        : 'Preparando…'}
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className={`h-full rounded-full bg-blue-600 transition-all ${percent === null ? 'w-1/3 animate-pulse' : ''}`}
                                    style={
                                        percent === null
                                            ? undefined
                                            : { width: `${percent}%` }
                                    }
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Puedes seguir usando Costos; no cierres la
                                ventana del conector.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {vinculo.total_oficial === null
                                ? 'Aún no se ha importado la bandeja.'
                                : vinculo.sync_completa
                                  ? `Bandeja completa: ${vinculo.total_oficial} asientos oficiales.`
                                  : `Importación parcial de ${vinculo.total_oficial} asientos oficiales; sincroniza de nuevo para completarla.`}
                            {vinculo.last_synced_at &&
                                ` Última sincronización completa: ${formatDate(vinculo.last_synced_at)}.`}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
