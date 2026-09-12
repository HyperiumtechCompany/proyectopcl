export type Armada = 'armada_1' | 'armada_2' | 'liquidacion';

export interface ResumenParametros {
    expediente: { equipos: string; utilidad: string; igv: string; descuento: string };
    aprobado_ideal: {
        materiales: string; mano_obra: string; equipos: string;
        gastos_generales: string; utilidad: string; igv: string; descuento: string;
    };
    apoyo_tecnico: { ejecutado: string; por_pagar: string };
    aportes_socios: { socio1: Record<Armada, string>; socio2: Record<Armada, string> };
    monto_invertir: Record<'materiales' | 'mano_obra' | 'equipos' | 'gastos_generales' | 'descuento', Record<Armada, string>>;
    avance_obra_pct: { costo_directo: string; materiales: string; mano_obra: string; equipos: string };
}

export interface ResumenGeneralRow {
    componente: string;
    label: string;
    expediente: string;
    aprobado_ideal: string;
    editable: { expediente: boolean; aprobado_ideal: boolean };
}

export interface ResumenGeneral {
    rows: ResumenGeneralRow[];
    totals: { expediente: string; aprobado_ideal: string };
}

export interface DesagRowLinea {
    tipo: 'linea' | 'rollup';
    label: string;
    aprobado_ideal: string;
    proyectado_real: string;
    actual: string;
    deuda: string;
    deficit: string;
    pct_gasto_actual: string | null;
    pct_avance: string | null;
    avance_key: string | null;
}

export interface DesagRowSub {
    tipo: 'sub';
    label: string;
}

export interface DesagRowBlank {
    tipo: 'blank';
}

export type DesagRow = DesagRowLinea | DesagRowSub | DesagRowBlank;

export interface ResumenDesagregado {
    rows: DesagRow[];
}

export interface MontoInvertirRow {
    componente: string;
    label: string;
    armadas: Record<Armada, string>;
    sub_total: string;
}

export interface MontoInvertir {
    armadas: Armada[];
    componentes: MontoInvertirRow[];
    socios: MontoInvertirRow[];
}

export interface GastoRealLinea {
    label: string;
    ejecutado: string;
    por_pagar: string;
    total: string;
}

export interface GastoReal {
    lineas: GastoRealLinea[];
    gasto_total: string;
    total_adjudicado: string;
    utilidad: string;
    pct_ejecucion: string | null;
}

export interface ResumenPayload {
    parametros: ResumenParametros;
    general: ResumenGeneral;
    desagregado: ResumenDesagregado;
    monto_invertir: MontoInvertir;
    gasto_real: GastoReal;
}

export interface ResumenResponse {
    revision: number;
    resumen: ResumenPayload;
}
