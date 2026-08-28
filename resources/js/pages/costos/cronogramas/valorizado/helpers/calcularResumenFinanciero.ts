import type { ComponenteExtra, ConceptoAdicional } from '../types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export interface ResumenFinancieroInput {
    costoDirecto: number;
    pctGastosGenerales: number;
    pctUtilidad: number;
    pctIGV: number;
    montoMobiliario: number;
    pctIGVMobiliario: number;
    hasComponentII: boolean;
    componentesExtra: ComponenteExtra[];
    conceptosAdicionales: ConceptoAdicional[];
}

export type ConceptoCalculado = ConceptoAdicional & { monto: number };
export type ComponenteExtraCalculado = ComponenteExtra & {
    monto: number;
    igv: number;
    subtotal: number;
};

export interface ResumenFinancieroResult {
    montoGG: number;
    montoUT: number;
    subTotal: number;
    montoIGV: number;
    presupI: number; // Presupuestado de Obra Infraestructura Componente I
    montoIGVMob: number;
    subTotalII: number;
    extraCalcs: ComponenteExtraCalculado[];
    extraComponentsTotal: number;
    componentCount: number;
    romanList: string;
    totalI_II: number; // Total Presupuesto de Obra Componente I+II+extra
    amarillos: ConceptoAdicional[];
    rojosNormales: ConceptoAdicional[];
    rojosFinales: ConceptoAdicional[];
    amarilloCalcs: ConceptoCalculado[];
    rojoCalcs: ConceptoCalculado[];
    rojoFinalCalcs: ConceptoCalculado[];
    additionalCalcs: ConceptoCalculado[];
    additionalTotal: number;
    presupuestoSubTotal: number; // Presupuestado de Obra + amarillos
    presupuestoTotalIntermedio: number; // Sub Total + rojos normales
    presupuestoTotal: number; // intermedio + rojos_final — el gran total final
}

const calcConcepto = (concepto: ConceptoAdicional, base: number): ConceptoCalculado => ({
    ...concepto,
    monto:
        concepto.tipo === 'porcentaje'
            ? base * ((Number(concepto.valor) || 0) / 100)
            : Number(concepto.valor) || 0,
});

/**
 * Fuente única del "Resumen Financiero del Presupuesto" del Cronograma
 * Valorizado — Costo Directo → GG/Utilidad/IGV → Componente I → Componente
 * II/extra → cascada de conceptos (amarillo → rojo → rojo_final), igual
 * fórmula que planes/costos/plan_valorizado_compatibilidad.md secciones 5-7.
 *
 * Se extrajo de TablaValorizada.tsx (que la tenía inline) porque
 * exportHelpers.ts la duplicaba dos veces más (Excel y PDF) y
 * CronogramaValorizado.tsx necesita el mismo total final (`presupuestoTotal`)
 * para el Cronograma de Desembolsos — cuatro copias manuales de la misma
 * cascada ya causaron divergencias reales en esta sesión (ver commits de
 * "capturar % reales de GG/Utilidad" y el bug de orden de conceptos).
 */
export function calcularResumenFinanciero(
    input: ResumenFinancieroInput,
): ResumenFinancieroResult {
    const {
        costoDirecto,
        pctGastosGenerales,
        pctUtilidad,
        pctIGV,
        montoMobiliario,
        pctIGVMobiliario,
        hasComponentII,
        componentesExtra,
        conceptosAdicionales,
    } = input;

    const montoGG = costoDirecto * (pctGastosGenerales / 100);
    const montoUT = costoDirecto * (pctUtilidad / 100);
    const subTotal = costoDirecto + montoGG + montoUT;
    const montoIGV = subTotal * (pctIGV / 100);
    const presupI = subTotal + montoIGV;

    const montoIGVMob = montoMobiliario * (pctIGVMobiliario / 100);
    const subTotalII = montoMobiliario + montoIGVMob;

    // Componentes extra (III, IV, ...): igual tratamiento que Componente II
    // (monto fijo + IGV, sin distribuir por mes — no son avance de obra).
    const extraCalcs: ComponenteExtraCalculado[] = componentesExtra.map((c) => {
        const monto = Number(c.monto) || 0;
        const igv = monto * (pctIGVMobiliario / 100);
        return { ...c, monto, igv, subtotal: monto + igv };
    });
    const extraComponentsTotal = extraCalcs.reduce((acc, c) => acc + c.subtotal, 0);
    // Los componentes extra (componentesExtra) NO entran en esta numeración
    // romana — tienen su propia numeración arábiga independiente (1, 2, 3...)
    // para no confundirse con los componentes oficiales I (Obra) / II
    // (Mobiliario y Equipamiento). Ver rows "COMPONENTE {n}" en TablaValorizada.tsx.
    const componentCount = 1 + (hasComponentII ? 1 : 0);
    const romanList = ROMAN.slice(0, componentCount).join('+');

    const totalI_II = presupI + subTotalII + extraComponentsTotal;

    // Cascada de 3 etapas: amarillos → Presupuesto Sub Total → rojos →
    // Presupuesto Total (intermedio) → rojos_final (ej. Control Concurrente)
    // → Presupuesto Total final.
    const amarillos = conceptosAdicionales.filter(
        (c) => (c.categoria ?? 'rojo') === 'amarillo',
    );
    const rojosNormales = conceptosAdicionales.filter(
        (c) => (c.categoria ?? 'rojo') === 'rojo',
    );
    const rojosFinales = conceptosAdicionales.filter(
        (c) => (c.categoria ?? 'rojo') === 'rojo_final',
    );

    const amarilloCalcs = amarillos.map((c) => calcConcepto(c, totalI_II));
    const amarilloTotal = amarilloCalcs.reduce((sum, c) => sum + c.monto, 0);
    const presupuestoSubTotal = totalI_II + amarilloTotal;

    const rojoCalcs = rojosNormales.map((c) => calcConcepto(c, presupuestoSubTotal));
    const rojoTotal = rojoCalcs.reduce((sum, c) => sum + c.monto, 0);
    const presupuestoTotalIntermedio = presupuestoSubTotal + rojoTotal;

    const rojoFinalCalcs = rojosFinales.map((c) => calcConcepto(c, presupuestoTotalIntermedio));
    const rojoFinalTotal = rojoFinalCalcs.reduce((sum, c) => sum + c.monto, 0);

    const additionalCalcs = [...amarilloCalcs, ...rojoCalcs, ...rojoFinalCalcs];
    const additionalTotal = amarilloTotal + rojoTotal + rojoFinalTotal;
    const presupuestoTotal = presupuestoTotalIntermedio + rojoFinalTotal;

    return {
        montoGG,
        montoUT,
        subTotal,
        montoIGV,
        presupI,
        montoIGVMob,
        subTotalII,
        extraCalcs,
        extraComponentsTotal,
        componentCount,
        romanList,
        totalI_II,
        amarillos,
        rojosNormales,
        rojosFinales,
        amarilloCalcs,
        rojoCalcs,
        rojoFinalCalcs,
        additionalCalcs,
        additionalTotal,
        presupuestoSubTotal,
        presupuestoTotalIntermedio,
        presupuestoTotal,
    };
}
