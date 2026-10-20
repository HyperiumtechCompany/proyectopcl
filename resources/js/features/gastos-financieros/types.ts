import type { ResumenPayload } from '../mantenimiento/resumen/types';

export type GrupoTipo = 'modulo' | 'institucion' | 'piso';
export type Franja = 'valorizacion' | 'adelanto';

/**
 * MoNumberCell confirma también al perder el foco sin cambios; comparar antes de enviar evita, por
 * ejemplo, que el Cotizado que arranca igual al E.T. quede marcado como "manual" con solo un clic.
 */
export function sameDecimal(current: string | null | undefined, next: string | null): boolean {
    const empty = (v: string | null | undefined) => v === null || v === undefined || v.trim() === '';
    if (empty(current) || empty(next)) return empty(current) && empty(next);
    return Number(current) === Number(next);
}

/**
 * Padre de nivel 1 del presupuesto (PRIMER NIVEL, AZOTEA…). ref = código raíz normalizado ("04");
 * "_" = SIN NIVEL. No es presupuesto_general.id: ese id cambia cada vez que se guarda el presupuesto.
 */
export interface GastFinGrupo {
    ref: string;
    partida: string;
    descripcion: string;
    tipo: GrupoTipo | null;
    materiales: number;
    /** Partidas del nivel con ACU pero metrado 0 en el presupuesto (su consumo E.T. es 0). */
    sin_metrado: number;
}

export interface GastFinShowResponse {
    document: { id: string; revision: number };
    grupos: GastFinGrupo[];
}

// ── MO ──────────────────────────────────────────────────────────────────────
export interface MoPago {
    id: string;
    nombre: string;
    fecha: string | null;
}

export interface MoInsumoRow {
    key: string;
    descripcion: string;
    unidad: string;
    cantidad: string;
    precio: string;
    parcial: string;
}

export interface MoCelda {
    etiqueta: string | null;
    monto: string | null;
}

export interface MoGrupo {
    ref: string;
    partida: string;
    descripcion: string;
    tipo: GrupoTipo | null;
    sin_metrado: number;
    rows: MoInsumoRow[];
    valores: Record<string, Record<Franja, MoCelda | null>>;
    totales: {
        et_parcial: string;
        valorizado: string;
        adelantos: string;
        pagado: string;
        aprobado: string;
        aprobado_manual: boolean;
        saldo: string;
        sobregiro: boolean;
    };
}

export interface MoPayload {
    pagos: MoPago[];
    grupos: MoGrupo[];
    totales: { general: { et_parcial: string; valorizado: string; adelantos: string; final: string; aprobado: string; saldo: string } };
}

export interface MoResponse {
    revision: number;
    mo: MoPayload;
}

// ── MAT ─────────────────────────────────────────────────────────────────────
export interface MatCompra {
    id: string;
    fecha: string | null;
    numero: number;
}

export interface MatCompraCelda {
    cantidad: string | null;
    precio: string | null;
    subtotal: string | null;
    proveedor: string | null;
}

export interface MatRow {
    key: string;
    id: string | null;
    origen: 'expediente' | 'manual' | 'huerfano';
    descripcion: string;
    unidad: string | null;
    et: { cantidad: string; precio: string; parcial: string } | null;
    cot: { cantidad: string | null; cantidad_source: 'et' | 'manual'; precio: string | null; parcial: string | null };
    compras: Record<string, MatCompraCelda | null>;
    total_comprado: string;
    saldo: string;
}

export interface MatTotales {
    et: string;
    cotizado: string;
    compras: Record<string, string>;
    total_comprado: string;
    saldo: string;
    estado: 'deficit' | 'superavit' | 'cuadra';
}

export interface MatPayload {
    grupo_ref: string;
    sin_metrado: number;
    compras: MatCompra[];
    rows: MatRow[];
    totales: MatTotales;
}

export interface MatResponse {
    revision: number;
    mat: MatPayload;
}

export interface MatDeltaResponse {
    revision: number;
    row: MatRow | null;
    totales: MatTotales;
}

// ── RESUMEN ─────────────────────────────────────────────────────────────────
export interface GastFinResumenPayload extends ResumenPayload {
    grupos: GastFinGrupo[];
}

export interface GastFinResumenResponse {
    revision: number;
    resumen: GastFinResumenPayload;
}

export interface GrupoUpdateResponse {
    revision: number;
    grupos: GastFinGrupo[];
    mo: MoPayload;
}
