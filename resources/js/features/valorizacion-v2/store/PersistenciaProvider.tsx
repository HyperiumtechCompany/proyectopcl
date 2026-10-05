import { router } from '@inertiajs/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConflictoGuardado, valorizacionApi } from '../data/api/valorizacionApi';
import type { CorteResumen } from '../data/api/valorizacionApi';
import { normalizarInput, SCHEMA_VERSION } from '../data/schema';
import type { ProyectoBase } from '../data/schema';
import type { ValorizacionInput } from '../types';
import { useValorizacionStoreApi } from './ValorizacionStoreProvider';

export type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error' | 'conflicto';

interface Persistencia {
    estado: EstadoGuardado;
    guardadoEn: string | null;
    error: string | null;
    cortes: CorteResumen[];
    /** Guarda ya (sin esperar el autoguardado). Devuelve la revisión guardada. */
    guardarAhora: () => Promise<number | null>;
    /** Resuelve un conflicto: cargar lo del servidor o sobrescribirlo con lo local. */
    resolverConflicto: (opcion: 'usar-servidor' | 'conservar-mios') => void;
    aprobar: (payload: { numero: number; mes: string; resumen: CorteResumen['resumen'] }) => Promise<void>;
    reabrir: (numero: number) => Promise<void>;
}

const PersistenciaContext = createContext<Persistencia | null>(null);

const AUTOSAVE_MS = 1500;

interface Props {
    projectId: number;
    documentoId: string;
    proyecto: ProyectoBase;
    revisionInicial: number;
    guardadoInicial: string | null;
    cortesIniciales: CorteResumen[];
    children: ReactNode;
}

/**
 * Autoguardado de la valorización: 1.5 s después del último cambio envía todo
 * el estado de entrada (JSON) con la revisión conocida. Si otro guardó antes,
 * el servidor responde 409 y se pide al usuario elegir qué versión conservar.
 */
export function PersistenciaProvider({ projectId, documentoId, proyecto, revisionInicial, guardadoInicial, cortesIniciales, children }: Props) {
    const store = useValorizacionStoreApi();
    const [estado, setEstado] = useState<EstadoGuardado>('guardado');
    const [guardadoEn, setGuardadoEn] = useState<string | null>(guardadoInicial);
    const [error, setError] = useState<string | null>(null);
    const [cortes, setCortes] = useState<CorteResumen[]>(cortesIniciales);
    const revision = useRef<number>(revisionInicial);
    const ultimoGuardado = useRef<ValorizacionInput | null>(store.getState().input);
    const conflicto = useRef<ConflictoGuardado | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const enCurso = useRef<Promise<number | null> | null>(null);

    const guardar = async (): Promise<number | null> => {
        if (conflicto.current) {
            return null;
        }
        if (enCurso.current) {
            await enCurso.current;
        }
        const input = store.getState().input;
        if (input === ultimoGuardado.current) {
            setEstado('guardado');

            return revision.current;
        }
        setEstado('guardando');
        const promesa = valorizacionApi
            .guardar(projectId, documentoId, { revision: revision.current, schema_version: SCHEMA_VERSION, datos: input })
            .then((respuesta) => {
                revision.current = respuesta.revision;
                ultimoGuardado.current = input;
                setGuardadoEn(respuesta.updated_at);
                setError(null);
                setEstado(store.getState().input === input ? 'guardado' : 'pendiente');

                return respuesta.revision;
            })
            .catch((err: unknown) => {
                if (err instanceof ConflictoGuardado) {
                    conflicto.current = err;
                    setEstado('conflicto');
                } else {
                    setError(err instanceof Error ? err.message : String(err));
                    setEstado('error');
                }

                return null;
            })
            .finally(() => {
                enCurso.current = null;
            });
        enCurso.current = promesa;

        return promesa;
    };

    // Programa el autoguardado en cada cambio del estado de entrada.
    useEffect(() => {
        const programar = () => {
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => void guardar(), AUTOSAVE_MS);
        };
        const unsubscribe = store.subscribe((state, previo) => {
            if (state.input !== previo.input && !conflicto.current) {
                setEstado('pendiente');
                programar();
            }
        });

        return () => {
            unsubscribe();
            window.clearTimeout(timer.current);
        };
        // guardar lee todo por refs: suscribirse una sola vez.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store]);

    // Al cambiar de página dentro de la app (otro proyecto, volver…): guarda primero.
    const estadoRef = useRef(estado);
    useEffect(() => {
        estadoRef.current = estado;
    }, [estado]);
    useEffect(
        () =>
            router.on('before', (event) => {
                const actual = estadoRef.current;
                if (actual === 'guardado') {
                    return;
                }
                if (actual === 'error' || actual === 'conflicto') {
                    if (!window.confirm('Hay cambios que no se pudieron guardar. ¿Salir de todos modos?')) {
                        event.preventDefault();
                    }

                    return;
                }
                event.preventDefault();
                const destino = event.detail.visit.url;
                window.clearTimeout(timer.current);
                void guardar().then((revisionGuardada) => {
                    if (revisionGuardada !== null) {
                        router.visit(destino);
                    }
                });
            }),
        // guardar lee todo por refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // Avisa al cerrar la pestaña con cambios sin guardar.
    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (estado === 'pendiente' || estado === 'guardando' || estado === 'conflicto') {
                event.preventDefault();
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);

        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [estado]);

    const value: Persistencia = {
        estado,
        guardadoEn,
        error,
        cortes,
        guardarAhora: () => {
            window.clearTimeout(timer.current);

            return guardar();
        },
        resolverConflicto: (opcion) => {
            const actual = conflicto.current;
            if (!actual) {
                return;
            }
            conflicto.current = null;
            revision.current = actual.revision;
            if (opcion === 'usar-servidor') {
                const datos = normalizarInput(actual.datos, proyecto);
                store.getState().loadInput(datos);
                ultimoGuardado.current = store.getState().input;
                setGuardadoEn(actual.updatedAt);
                setEstado('guardado');
            } else {
                ultimoGuardado.current = null;
                void guardar();
            }
        },
        aprobar: async (payload) => {
            window.clearTimeout(timer.current);
            const rev = await guardar();
            if (rev === null) {
                throw new Error('No se pudo guardar antes de aprobar.');
            }
            const corte = await valorizacionApi.aprobar(projectId, documentoId, { ...payload, revision: rev });
            setCortes((actuales) => [...actuales.filter((c) => c.numero !== corte.numero), corte].sort((a, b) => a.numero - b.numero));
        },
        reabrir: async (numero) => {
            await valorizacionApi.reabrir(projectId, documentoId, numero);
            setCortes((actuales) => actuales.filter((c) => c.numero !== numero));
        },
    };

    return <PersistenciaContext.Provider value={value}>{children}</PersistenciaContext.Provider>;
}

export function usePersistencia(): Persistencia {
    const value = useContext(PersistenciaContext);
    if (!value) {
        throw new Error('usePersistencia debe usarse dentro de <PersistenciaProvider>.');
    }

    return value;
}
