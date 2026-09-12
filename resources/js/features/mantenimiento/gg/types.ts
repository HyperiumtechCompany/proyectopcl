export type GgGrupo = 'fijo' | 'variable';

export interface GgRowGrupo {
    tipo: 'grupo';
    item: string;
    grupo: GgGrupo;
    descripcion: string;
    gasto_et: string;
    gasto_proyectado: string;
    total_pagado: string;
    saldo: string;
    por_pago: Record<string, string>;
}

export interface GgRowRubro {
    tipo: 'rubro';
    item: string;
    grupo: GgGrupo;
    rubro: string;
    gasto_et: string;
    gasto_proyectado: string;
    total_pagado: string;
    saldo: string;
    por_pago: Record<string, string>;
}

export interface GgRowLinea {
    tipo: 'linea';
    linea_id: string;
    grupo: GgGrupo;
    rubro: string;
    descripcion: string;
    unidad: string | null;
    cantidad: string;
    costo_unitario: string;
    gasto_et: string;
    gasto_proyectado: string;
    gasto_proyectado_manual: boolean;
    total_pagado: string;
    saldo: string;
    descuadra: boolean;
    por_pago: Record<string, string | null>;
}

export type GgRow = GgRowGrupo | GgRowRubro | GgRowLinea;

export interface GgPago {
    id: string;
    indice: number;
    fecha: string | null;
    etiqueta: string | null;
}

export interface GgScenario {
    id: string;
    nombre: string;
    es_activo: boolean;
}

export interface GgPayload {
    scenario: { id: string; nombre: string };
    scenarios: GgScenario[];
    pagos: GgPago[];
    rows: GgRow[];
    totales: {
        general: Record<'gasto_et' | 'gasto_proyectado' | 'total_pagado' | 'saldo', string>;
        por_pago: Record<string, string>;
        sobregiros: number;
    };
}

export interface GgResponse {
    revision: number;
    gg: GgPayload;
}
