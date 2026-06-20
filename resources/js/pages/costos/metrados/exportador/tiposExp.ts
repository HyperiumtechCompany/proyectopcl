export type Especialidad = 'estructuras' | 'arquitectura' | 'comunicaciones' | 'electricas' | 'sanitarias' | 'gas';

export interface Periodo {
  key: string;
  label: string;
  labelCal?: string;
  dias?: number;
}

export interface Proyecto {
  id?: number;
  nombre?: string;
  codigo_cui?: string;
  codigo_local?: string;
}

export interface TotalPeriodo {
  monto: number;
  porcentaje: number;
  acumuladoMonto: number;
}

export interface ItemMetrado {
  id: string | number;
  item: string;
  descripcion: string;
  und: string;
  metrado: number;
  precio: number;
  parcial: number;
  distribucion?: Record<string, { monto: number }>;
  largo?: number;
  ancho?: number;
  alto?: number;
  nVeces?: number;
  diametro?: number;
  longitud?: number;
}