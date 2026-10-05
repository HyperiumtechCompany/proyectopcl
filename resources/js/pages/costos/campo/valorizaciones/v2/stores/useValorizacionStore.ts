import { create } from 'zustand';
import { FichaTecnica, Partida, PartidaPeriodo } from '../types';
import Decimal from 'decimal.js';

export interface ValorizacionState {
    // ---- DATOS FUENTE ----
    fichaTecnica: FichaTecnica | null;
    partidas: Partida[];

    // ---- DATOS POR PERIODO (CALENDARIOS) ----
    calendarioProgramado: Map<string, PartidaPeriodo[]>;
    calendarioValorizado: Map<string, PartidaPeriodo[]>;
    
    // ---- METRADOS ----
    // metradosMensuales: Map<string, MetradoMes[]>; // TODO en Fase 4

    // ---- ACCIONES ----
    setFichaTecnica: (ft: FichaTecnica) => void;
    setPartidas: (partidas: Partida[]) => void;
}

export const useValorizacionStore = create<ValorizacionState>((set) => ({
    fichaTecnica: null,
    partidas: [],
    
    calendarioProgramado: new Map(),
    calendarioValorizado: new Map(),

    setFichaTecnica: (ft) => set({ fichaTecnica: ft }),
    setPartidas: (partidas) => set({ partidas }),
}));
