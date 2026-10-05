import type { ReactNode } from 'react';
import MoUnitSelect from '@/features/mantenimiento/mo/MoUnitSelect';
import type { PartidaPatch } from '../../lib/presupuestoOps';
import { EditableCell } from '../../shared/EditableCell';
import type { TreeColumn } from '../../shared/tree/PartidaTreeTable';
import { fmtNumber, fmtPct } from '../../utils/format';
import type { PresupuestoFila } from './computePresupuesto';

const num = 'font-mono tabular-nums';
const GROUP = 'Presupuesto de obra';

/** Dato obligatorio de una partida que falta: guion rojo con aviso. */
const missing = (what: string): ReactNode => (
    <span className="font-sans text-red-600 dark:text-red-400" title={`Falta ${what}`}>—</span>
);

/**
 * Columnas de PRESUPUESTO. Solo las partidas (nodos sin hijos) tienen unidad,
 * metrado y P.U.; en modo edición esas celdas son inputs. Los títulos muestran
 * únicamente su subtotal.
 */
export function presupuestoColumns(editing: boolean, onUpdate: (node: PresupuestoFila['node'], patch: PartidaPatch) => void): TreeColumn<PresupuestoFila>[] {
    const editable = (row: PresupuestoFila): boolean => editing && row.node.esHoja;

    return [
        {
            id: 'unidad',
            header: 'Und',
            group: GROUP,
            align: 'center',
            className: editing ? 'min-w-24' : undefined,
            cell: (row) => {
                if (editable(row)) {
                    return (
                        <label>
                            <span className="sr-only">Unidad {row.node.codigo}</span>
                            <MoUnitSelect value={row.node.unidad ?? ''} editable className="min-h-9 rounded-md border border-amber-300 bg-amber-50/80 text-base sm:text-[13px] dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-stone-100" onCommit={(unidad) => onUpdate(row.node, { unidad })} />
                        </label>
                    );
                }

                return row.node.esHoja ? (row.node.unidad ?? missing('unidad')) : '';
            },
        },
        {
            id: 'metrado',
            header: 'Metrado',
            group: GROUP,
            className: editing ? `${num} w-28` : num,
            cell: (row) => {
                if (editable(row)) {
                    return <EditableCell label={`Metrado ${row.node.codigo}`} kind="number" align="right" placeholder="0.00" value={row.node.input.metrado} onCommit={(metrado) => onUpdate(row.node, { metrado })} />;
                }

                return row.node.esHoja ? (row.metrado ? fmtNumber(row.metrado) : missing('metrado')) : '';
            },
        },
        {
            id: 'pu',
            header: 'P. unit.',
            group: GROUP,
            className: editing ? `${num} w-28` : num,
            cell: (row) => {
                if (editable(row)) {
                    return <EditableCell label={`Precio unitario ${row.node.codigo}`} kind="number" align="right" placeholder="0.00" value={row.node.input.precioUnitario} onCommit={(precioUnitario) => onUpdate(row.node, { precioUnitario })} />;
                }

                return row.node.esHoja ? (row.precioUnitario ? fmtNumber(row.precioUnitario) : missing('precio unitario')) : '';
            },
        },
        { id: 'total', header: 'Total (S/)', group: GROUP, className: num, cell: (row) => fmtNumber(row.total) },
        {
            id: 'incidencia',
            header: '% Incid.',
            className: `${num} text-stone-500`,
            cell: (row) => (row.node.nivel === 1 ? '' : fmtPct(row.incidencia)),
        },
    ];
}
