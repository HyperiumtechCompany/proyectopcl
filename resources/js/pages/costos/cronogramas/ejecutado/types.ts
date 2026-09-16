import type { Periodo, ModoCalculo } from '../valorizado/types';
import type { CronogramaEstado } from '../components/CronogramaNavTabs';

export type { Periodo, ModoCalculo };

export interface EjecucionPeriodo {
    metrado: number;
    monto:   number;
}

export interface ItemEjecutado {
    id:                string;
    item:              string;
    descripcion:       string;
    und:               string;
    metradoContratado: number;
    precio:            number;
    ejecucion:         Record<string, EjecucionPeriodo>;
}

export interface EjecutadoProps {
    project:               string;
    projectName:           string;
    items:                 ItemEjecutado[];
    periodos:              Periodo[];
    totalPresupuesto:      number;
    jerarquiaPresupuesto?: Record<string, string>;
    modoCalculo:           ModoCalculo;
    sinGantt?:             boolean;
    estaGuardado?:         boolean;
    projectData?:          any;
    estado?:               CronogramaEstado;
}
