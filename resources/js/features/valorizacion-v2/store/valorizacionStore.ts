import { createStore } from 'zustand/vanilla';
import { setCell } from '../lib/cellMap';
import type { CellMap } from '../lib/cellMap';
import { emptyHistory, record, redo, undo } from '../lib/history';
import type { History } from '../lib/history';
import type { AdicionalPago, AjustesPago, CalendarioInput, ConfigRfc, FichaTecnica, MesKey, ParametrosPresupuesto, PartidaInput, PersonaClave, PresupuestoInput, ValorizacionInput } from '../types';

/**
 * Store de Valorización v2. Reglas:
 *  1. Solo guarda ENTRADAS (ValorizacionInput, JSON puro). Lo calculado se deriva
 *     con funciones puras en sheets/<hoja>/compute*.ts → la propagación entre
 *     hojas es automática y no hace falta un motor de "hojas sucias".
 *  2. Se crea UNA instancia por página (ver ValorizacionStoreProvider). Un store
 *     global de módulo sobreviviría a la navegación de Inertia y mostraría los
 *     datos del proyecto anterior al abrir otro.
 *  3. Todo cambio pasa por `commit`, que lo registra en el historial
 *     (deshacer/rehacer). Las acciones reciben funciones puras de lib/.
 */
export interface ValorizacionState {
    input: ValorizacionInput;
    history: History<ValorizacionInput>;
    /** Reemplaza todo (documento cargado del servidor o elegido al empezar); reinicia el historial. */
    loadInput: (input: ValorizacionInput) => void;
    /** Cambia la valorización activa (N° y mes): todas las hojas se recalculan a ese corte. */
    setPeriodo: (numero: number, mes: string) => void;
    /** Edita una sección de la Ficha Técnica. */
    updateFicha: <S extends keyof FichaTecnica>(seccion: S, patch: Partial<FichaTecnica[S]>) => void;
    /** Edita %GG, %Utilidad o %IGV. */
    setParametros: (patch: Partial<ParametrosPresupuesto>) => void;
    /** Adicionales (CONTROL DE PAGOS). */
    addAdicional: (adicional: AdicionalPago) => void;
    updateAdicional: (id: string, patch: Partial<Omit<AdicionalPago, 'id'>>) => void;
    removeAdicional: (id: string) => void;
    /** Reemplaza el presupuesto completo (importación). Las tasas solo si llegan. */
    replacePresupuesto: (presupuesto: PresupuestoInput, parametros?: ParametrosPresupuesto) => void;
    /** Edita la lista de partidas con una operación inmutable. */
    updatePartidas: (update: (partidas: PartidaInput[]) => PartidaInput[], label: string) => void;
    /** Fija (o borra con null) el monto programado de una partida en un mes. */
    setMontoProgramado: (partidaId: string, mes: MesKey, monto: string | null) => void;
    /** Reemplaza el calendario programado (importación). */
    replaceCalendarioProgramado: (calendario: CalendarioInput) => void;
    /** Fija (o borra con null) el metrado ejecutado de una partida en un mes. */
    setMetrado: (partidaId: string, mes: MesKey, metrado: string | null) => void;
    /** Reemplaza los metrados ejecutados (importación). */
    replaceMetrados: (ejecutado: CellMap) => void;
    /** Marca / desmarca una valorización como devengada (CONTROL FINANCIERO). */
    setDevengado: (mes: MesKey, devengado: boolean) => void;
    /** Ajuste manual de pago de un mes (reajuste, amortización, penalidad, comprobantes). */
    setAjustePago: <K extends keyof AjustesPago>(mes: MesKey, campo: K, valor: AjustesPago[K] | null) => void;
    /** Configuración de garantía de fiel cumplimiento y detracción. */
    setConfigPagos: (patch: { rfc?: Partial<ConfigRfc>; porcentajeDetraccion?: string }) => void;
    /** Personal clave (RH-EM). */
    addPersona: (persona: PersonaClave) => void;
    updatePersona: (id: string, patch: Partial<Omit<PersonaClave, 'id'>>) => void;
    removePersona: (id: string) => void;
    /** Marca o quita una falta (día no asistido). */
    toggleFalta: (personaId: string, fecha: string) => void;
    undo: () => string | null;
    redo: () => string | null;
}

export type ValorizacionStore = ReturnType<typeof createValorizacionStore>;

export function createValorizacionStore(initial: ValorizacionInput) {
    return createStore<ValorizacionState>()((set, get) => {
        const commit = (label: string, next: ValorizacionInput) => {
            const { input, history } = get();
            if (next !== input) {
                set({ input: next, history: record(history, input, label) });
            }
        };

        return {
            input: initial,
            history: emptyHistory(),

            loadInput: (input) => set({ input, history: emptyHistory() }),

            setPeriodo: (numero, mes) => {
                const { input } = get();
                if (input.periodo.numero !== numero || input.periodo.mes !== mes) {
                    commit(`Ir a la valorización N°${String(numero).padStart(2, '0')}`, { ...input, periodo: { numero, mes } });
                }
            },

            updateFicha: (seccion, patch) => {
                const { input } = get();
                commit('Editar ficha técnica', { ...input, fichaTecnica: { ...input.fichaTecnica, [seccion]: { ...input.fichaTecnica[seccion], ...patch } } });
            },

            setParametros: (patch) => {
                const { input } = get();
                commit('Editar parámetros del presupuesto', { ...input, parametros: { ...input.parametros, ...patch } });
            },

            addAdicional: (adicional) => {
                const { input } = get();
                commit('Agregar adicional', { ...input, pagos: { ...input.pagos, adicionales: [...input.pagos.adicionales, adicional] } });
            },

            updateAdicional: (id, patch) => {
                const { input } = get();
                const adicionales = input.pagos.adicionales.map((item) => (item.id === id ? { ...item, ...patch } : item));
                commit('Editar adicional', { ...input, pagos: { ...input.pagos, adicionales } });
            },

            removeAdicional: (id) => {
                const { input } = get();
                commit('Quitar adicional', { ...input, pagos: { ...input.pagos, adicionales: input.pagos.adicionales.filter((item) => item.id !== id) } });
            },

            replacePresupuesto: (presupuesto, parametros) => {
                const { input } = get();
                commit('Importar presupuesto', { ...input, presupuesto, parametros: parametros ?? input.parametros });
            },

            updatePartidas: (update, label) => {
                const { input } = get();
                const partidas = update(input.presupuesto.partidas);
                if (partidas !== input.presupuesto.partidas) {
                    commit(label, { ...input, presupuesto: { ...input.presupuesto, partidas } });
                }
            },

            setMontoProgramado: (partidaId, mes, monto) => {
                const { input } = get();
                const montos = setCell(input.calendarios.programado.montos, partidaId, mes, monto);
                if (montos !== input.calendarios.programado.montos) {
                    commit('Editar calendario programado', { ...input, calendarios: { ...input.calendarios, programado: { montos } } });
                }
            },

            replaceCalendarioProgramado: (calendario) => {
                const { input } = get();
                commit('Importar calendario programado', { ...input, calendarios: { ...input.calendarios, programado: calendario } });
            },

            setMetrado: (partidaId, mes, metrado) => {
                const { input } = get();
                const ejecutado = setCell(input.metrados.ejecutado, partidaId, mes, metrado);
                if (ejecutado !== input.metrados.ejecutado) {
                    commit('Editar metrado ejecutado', { ...input, metrados: { ejecutado } });
                }
            },

            replaceMetrados: (ejecutado) => {
                const { input } = get();
                commit('Importar metrados', { ...input, metrados: { ejecutado } });
            },

            setDevengado: (mes, devengado) => {
                const { input } = get();
                if (Boolean(input.control.devengados[mes]) !== devengado) {
                    commit(`${devengado ? 'Marcar' : 'Desmarcar'} devengado ${mes}`, { ...input, control: { devengados: { ...input.control.devengados, [mes]: devengado } } });
                }
            },

            setAjustePago: (mes, campo, valor) => {
                const { input } = get();
                const actual = input.pagos.porMes[mes] ?? {};
                if ((actual[campo] ?? null) === valor) {
                    return;
                }
                const siguiente = { ...actual };
                if (valor === null || valor === '') {
                    delete siguiente[campo];
                } else {
                    siguiente[campo] = valor;
                }
                commit(`Editar ajuste de pago ${mes}`, { ...input, pagos: { ...input.pagos, porMes: { ...input.pagos.porMes, [mes]: siguiente } } });
            },

            setConfigPagos: (patch) => {
                const { input } = get();
                commit('Editar configuración de pagos', {
                    ...input,
                    pagos: {
                        ...input.pagos,
                        rfc: { ...input.pagos.rfc, ...patch.rfc },
                        porcentajeDetraccion: patch.porcentajeDetraccion ?? input.pagos.porcentajeDetraccion,
                    },
                });
            },

            addPersona: (persona) => {
                const { input } = get();
                commit('Agregar personal clave', { ...input, personal: { ...input.personal, personas: [...input.personal.personas, persona] } });
            },

            updatePersona: (id, patch) => {
                const { input } = get();
                const personas = input.personal.personas.map((persona) => (persona.id === id ? { ...persona, ...patch } : persona));
                commit('Editar personal clave', { ...input, personal: { ...input.personal, personas } });
            },

            removePersona: (id) => {
                const { input } = get();
                const faltas = { ...input.personal.faltas };
                delete faltas[id];
                commit('Quitar personal clave', { ...input, personal: { personas: input.personal.personas.filter((persona) => persona.id !== id), faltas } });
            },

            toggleFalta: (personaId, fecha) => {
                const { input } = get();
                const actuales = input.personal.faltas[personaId] ?? [];
                const faltas = actuales.includes(fecha) ? actuales.filter((f) => f !== fecha) : [...actuales, fecha].sort();
                commit(`${actuales.includes(fecha) ? 'Quitar' : 'Marcar'} falta ${fecha}`, { ...input, personal: { ...input.personal, faltas: { ...input.personal.faltas, [personaId]: faltas } } });
            },

            undo: () => {
                const { history, input } = get();
                const result = undo(history, input);
                if (!result) {
                    return null;
                }
                set({ input: result.state, history: result.history });

                return result.label;
            },

            redo: () => {
                const { history, input } = get();
                const result = redo(history, input);
                if (!result) {
                    return null;
                }
                set({ input: result.state, history: result.history });

                return result.label;
            },
        };
    });
}
