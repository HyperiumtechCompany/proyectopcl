import type Decimal from 'decimal.js';
import { cn } from '@/lib/utils';
import { EditableCell } from '../../shared/EditableCell';
import { tableClasses as t } from '../../shared/table';
import type { AjustesPago, ParametrosPresupuesto } from '../../types';
import { fmtNumber, fmtPct } from '../../utils/format';
import type { PagoMensual } from './computePagos';

type Campo = keyof Pick<
    AjustesPago,
    'reajusteMes' | 'reintegroMesAnterior' | 'deduccionReajusteDirecto' | 'deduccionReajusteMateriales' | 'amortizacionDirecto' | 'amortizacionMateriales' | 'penalidadAtraso' | 'penalidadOtros'
>;

interface Fila {
    key: string;
    letra?: string;
    label: string;
    nota?: string;
    tipo: 'pie' | 'grupo' | 'sub' | 'total' | 'final';
    value: (p: PagoMensual) => Decimal;
    campo?: Campo;
}

const filas = (parametros: ParametrosPresupuesto, detraccion: string): Fila[] => [
    { key: 'cd', label: 'Costo directo', tipo: 'pie', value: (p) => p.valorizacion.costoDirecto },
    { key: 'gg', label: `Gastos generales (${fmtPct(parametros.gastosGenerales)})`, tipo: 'sub', value: (p) => p.valorizacion.gastosGenerales },
    { key: 'ut', label: `Utilidad (${fmtPct(parametros.utilidad)})`, tipo: 'sub', value: (p) => p.valorizacion.utilidad },
    { key: 'st', label: 'Sub total', tipo: 'pie', value: (p) => p.valorizacion.subTotal },
    { key: 'igv', label: `IGV (${fmtPct(parametros.igv)})`, tipo: 'sub', value: (p) => p.valorizacion.igv },
    { key: 'a', letra: 'A', label: 'Valorización mensual sin reajuste', tipo: 'total', value: (p) => p.a },
    { key: 'b', letra: 'B', label: 'Reajuste de la valorización', tipo: 'grupo', value: (p) => p.b.total },
    { key: 'b1', label: 'Reajuste del mes', tipo: 'sub', value: (p) => p.b.reajusteMes, campo: 'reajusteMes' },
    { key: 'b2', label: 'Reintegro del mes anterior', tipo: 'sub', value: (p) => p.b.reintegroMesAnterior, campo: 'reintegroMesAnterior' },
    { key: 'c', letra: 'C', label: 'Monto bruto valorizado reajustado', nota: '(A+B)', tipo: 'total', value: (p) => p.c },
    { key: 'd', letra: 'D', label: 'Deducción del reajuste que no corresponde', tipo: 'grupo', value: (p) => p.d.total },
    { key: 'd1', label: 'Por adelanto directo', nota: '(−)', tipo: 'sub', value: (p) => p.d.directo, campo: 'deduccionReajusteDirecto' },
    { key: 'd2', label: 'Por adelanto de materiales', nota: '(−)', tipo: 'sub', value: (p) => p.d.materiales, campo: 'deduccionReajusteMateriales' },
    { key: 'e', letra: 'E', label: 'Amortización por adelantos', tipo: 'grupo', value: (p) => p.e.total },
    { key: 'e1', label: 'Por adelanto directo', nota: '(−)', tipo: 'sub', value: (p) => p.e.directo, campo: 'amortizacionDirecto' },
    { key: 'e2', label: 'Por adelanto de materiales', nota: '(−)', tipo: 'sub', value: (p) => p.e.materiales, campo: 'amortizacionMateriales' },
    { key: 'f', letra: 'F', label: 'Monto neto valorizado facturable', nota: '(C−D−E)', tipo: 'total', value: (p) => p.f },
    { key: 'g', letra: 'G', label: 'Retenciones', tipo: 'grupo', value: (p) => p.g.total },
    { key: 'g1', label: 'Por garantía de fiel cumplimiento', nota: '(−)', tipo: 'sub', value: (p) => p.g.rfc },
    { key: 'g2', label: `Detracciones (${fmtPct(detraccion, 0)})`, nota: 'entero', tipo: 'sub', value: (p) => p.g.detraccion },
    { key: 'h', letra: 'H', label: 'Penalidades', tipo: 'grupo', value: (p) => p.h.total },
    { key: 'h1', label: 'Por atraso de obra', nota: '(−)', tipo: 'sub', value: (p) => p.h.atraso, campo: 'penalidadAtraso' },
    { key: 'h2', label: 'Otros', nota: '(−)', tipo: 'sub', value: (p) => p.h.otros, campo: 'penalidadOtros' },
    { key: 'j', letra: 'J', label: 'Monto a facturar por el contratista', nota: '(F)', tipo: 'total', value: (p) => p.j },
    { key: 'k', letra: 'K', label: 'Monto líquido a pagar al contratista', nota: '(F−G−H)', tipo: 'final', value: (p) => p.k },
];

export interface ColumnaEstado {
    label: string;
    pago: PagoMensual;
    /** Si se define, las filas manuales de esta columna son editables para ese mes. */
    editable?: { valores: Partial<AjustesPago>; onEdit: (campo: Campo, valor: string | null) => void };
    highlight?: boolean;
}

const ROW_TONE: Record<Fila['tipo'], string> = {
    pie: 'font-semibold text-stone-900 dark:text-stone-100',
    grupo: 'bg-stone-50 font-semibold text-stone-800 dark:bg-stone-800/40 dark:text-stone-200',
    sub: 'text-stone-700 dark:text-stone-300',
    total: 'bg-amber-100/70 font-semibold text-stone-900 dark:bg-amber-500/15 dark:text-amber-100',
    final: 'bg-orange-700 font-bold text-white dark:bg-orange-500/15 dark:text-orange-100',
};

/** Estado de pago A → K (R PAGO MENSUAL y PAGOS ACUMULADOS), con N columnas. */
export function EstadoPagoTable({ columnas, parametros, detraccion }: { columnas: ColumnaEstado[]; parametros: ParametrosPresupuesto; detraccion: string }) {
    return (
        <div className={t.wrap}>
            <table className={cn(t.table, columnas.length === 1 ? 'min-w-xl' : 'min-w-4xl')}>
                <thead>
                    <tr>
                        <th className={cn(t.th, 'w-10 text-left')}>Ítem</th>
                        <th className={cn(t.th, 'min-w-64 text-left')}>Descripción</th>
                        {columnas.map((columna) => (
                            <th key={columna.label} className={cn(t.th, 'text-right', columna.highlight && 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200')}>{columna.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filas(parametros, detraccion).map((fila) => (
                        <tr key={fila.key} className={ROW_TONE[fila.tipo]}>
                            <td className={cn(t.td, 'font-mono text-inherit')}>{fila.letra ?? ''}</td>
                            <td className={cn(t.td, 'max-w-md text-inherit whitespace-normal', fila.tipo === 'sub' && 'pl-6')}>
                                <span className={fila.tipo === 'sub' ? '' : 'uppercase'}>{fila.label}</span>
                                {fila.nota && <span className="ml-2 font-mono text-[10px] font-normal opacity-60">{fila.nota}</span>}
                            </td>
                            {columnas.map((columna) => (
                                <td key={columna.label} className={cn(t.td, t.num, 'text-inherit', columna.highlight && fila.tipo !== 'final' && 'bg-orange-50/40 dark:bg-orange-500/5')}>
                                    {fila.campo && columna.editable ? (
                                        <EditableCell
                                            label={`${fila.label} (${columna.label})`}
                                            kind="money"
                                            placeholder="0.00"
                                            className="ml-auto min-w-36 max-w-48"
                                            value={columna.editable.valores[fila.campo] ?? null}
                                            onCommit={(valor) => columna.editable!.onEdit(fila.campo!, valor)}
                                        />
                                    ) : (
                                        fmtNumber(fila.value(columna.pago))
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
