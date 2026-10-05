import Decimal from 'decimal.js';

export interface Partida {
    id: string;                    // Único, ej: "01.01.01.01"
    codigo: string;                // "01.01.01.01"
    descripcion: string;
    nivel: number;                 // 0=raíz/obra, 1=componente, 2=sub, 3=hoja
    unidad?: string;               // "GLB", "m2", "m3", "und"...
    metrado?: Decimal;             // Solo en hojas (último nivel)
    precioUnitario?: Decimal;      // Solo en hojas
    total?: Decimal;               // ROUND(metrado × P.U., 2)
    esHoja: boolean;               // true = tiene metrado y P.U.
    children: Partida[];           // Subpartidas
    parentId?: string;
}

export interface PartidaPeriodo {
    partidaId: string;
    monto: Decimal;
    pct: Decimal;                  // % = monto / total_partida
}
