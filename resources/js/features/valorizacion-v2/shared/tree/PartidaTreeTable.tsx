import { ChevronRight } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PartidaTreeState } from '../../hooks/usePartidaTree';
import type { PartidaNode } from '../../lib/partidaTree';

export interface TreeColumn<Row> {
    id: string;
    header: ReactNode;
    /** Columnas consecutivas con el mismo grupo comparten una banda superior ("PRESUPUESTO DE OBRA"). */
    group?: string;
    align?: 'left' | 'right' | 'center';
    className?: string;
    cell: (row: Row) => ReactNode;
}

interface PartidaTreeTableProps<Row extends { node: PartidaNode }> {
    rows: Row[];
    columns: TreeColumn<Row>[];
    state: PartidaTreeState;
    /** Filas <tr> del pie (p. ej. BudgetSummaryFooter). */
    footer?: ReactNode;
    /** Título accesible de la tabla (lectores de pantalla). */
    caption?: string;
    /** Reemplaza el texto de la descripción (p. ej. por un input en modo edición). */
    renderDescripcion?: (row: Row) => ReactNode;
    /** Contenido de la columna final de acciones (p. ej. botón ⋮). */
    rowActions?: (row: Row) => ReactNode;
    /** Clic derecho sobre una fila. */
    onRowContextMenu?: (row: Row, event: MouseEvent) => void;
    /** Fila resaltada (la del menú abierto). */
    activeId?: string | null;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/** Tono de fila por nivel: obra, componente, subtítulo, partida. */
function rowTone(node: PartidaNode): string {
    if (node.esHoja) {
        return 'bg-white text-stone-700 hover:bg-amber-50/70 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-amber-500/5';
    }
    if (node.nivel === 1) {
        return 'bg-stone-200/70 font-bold text-stone-900 dark:bg-stone-800 dark:text-stone-50';
    }
    if (node.nivel === 2) {
        return 'bg-orange-50 font-semibold text-orange-800 dark:bg-orange-500/10 dark:text-orange-300';
    }

    return 'bg-white font-semibold text-stone-800 dark:bg-stone-900 dark:text-stone-100';
}

interface HeaderBand {
    label: string | null;
    span: number;
    firstIndex: number;
}

function headerBands<Row>(columns: TreeColumn<Row>[]): HeaderBand[] {
    const bands: HeaderBand[] = [];
    columns.forEach((column, index) => {
        const label = column.group ?? null;
        const last = bands.at(-1);
        if (label !== null && last && last.label === label) {
            last.span += 1;
        } else {
            bands.push({ label, span: 1, firstIndex: index });
        }
    });

    return bands;
}

const TH = 'border-b border-stone-300 px-2 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-stone-700 uppercase dark:border-stone-700 dark:text-stone-200';

/**
 * Tabla-árbol genérica: ÍTEM fija (y DESCRIPCIÓN fija desde tablet) + columnas
 * por hoja. Renderiza la lista plana en preorden filtrando por `state.visible`,
 * reutilizable en calendarios anchos con scroll horizontal.
 */
export function PartidaTreeTable<Row extends { node: PartidaNode }>({
    rows,
    columns,
    state,
    footer,
    caption,
    renderDescripcion,
    rowActions,
    onRowContextMenu,
    activeId,
}: PartidaTreeTableProps<Row>) {
    const hasGroups = columns.some((column) => column.group);
    const bands = headerBands(columns);
    const visibleRows = rows.filter((row) => state.visible.has(row.node.id));
    const searching = state.query.trim() !== '';
    const headerRowSpan = hasGroups ? 2 : 1;

    return (
        <div className="min-w-0 max-w-full overflow-auto rounded-lg border border-stone-200 bg-white lg:max-h-[max(24rem,calc(100dvh-13rem))] dark:border-stone-700 dark:bg-stone-900">
            <table className="w-full min-w-3xl border-separate border-spacing-0 text-[13px]">
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead className="sticky top-0 z-20 bg-stone-100 dark:bg-stone-800">
                    <tr>
                        <th rowSpan={headerRowSpan} className={cn(TH, 'sticky left-0 z-30 w-28 bg-stone-100 text-left dark:bg-stone-800')}>Ítem</th>
                        <th rowSpan={headerRowSpan} className={cn(TH, 'z-30 min-w-56 border-r bg-stone-100 text-left md:sticky md:left-28 lg:min-w-80 dark:bg-stone-800')}>Descripción</th>
                        {bands.map((band) =>
                            band.label === null ? (
                                <th key={columns[band.firstIndex].id} rowSpan={headerRowSpan} className={cn(TH, ALIGN[columns[band.firstIndex].align ?? 'right'])}>
                                    {columns[band.firstIndex].header}
                                </th>
                            ) : (
                                <th key={`band-${band.firstIndex}`} colSpan={band.span} className={cn(TH, 'border-x border-stone-300 bg-stone-200/60 text-center text-stone-800 dark:border-stone-700 dark:bg-stone-700/50 dark:text-stone-100')}>
                                    {band.label}
                                </th>
                            ),
                        )}
                        {rowActions && (
                            <th rowSpan={headerRowSpan} className={cn(TH, 'w-9')}>
                                <span className="sr-only">Acciones</span>
                            </th>
                        )}
                    </tr>
                    {hasGroups && (
                        <tr>
                            {columns.filter((column) => column.group).map((column) => (
                                <th key={column.id} className={cn(TH, ALIGN[column.align ?? 'right'])}>{column.header}</th>
                            ))}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {visibleRows.map((row) => {
                        const { node } = row;
                        const isOpen = !state.collapsed.has(node.id) || searching;

                        return (
                            <tr
                                key={node.id}
                                onContextMenu={
                                    onRowContextMenu
                                        ? (event) => {
                                              event.preventDefault();
                                              onRowContextMenu(row, event);
                                          }
                                        : undefined
                                }
                                className={cn('group', rowTone(node), activeId === node.id && 'outline-2 -outline-offset-2 outline-orange-400')}
                            >
                                <td className="sticky left-0 z-10 border-b border-stone-100 bg-inherit px-2 py-2 font-mono whitespace-nowrap dark:border-stone-800">
                                    <span className="inline-flex items-center gap-1" style={{ paddingLeft: `${(node.nivel - 1) * 0.5}rem` }}>
                                        {node.esHoja ? (
                                            <span className="w-4" />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => state.toggle(node.id)}
                                                aria-expanded={isOpen}
                                                aria-label={`${isOpen ? 'Contraer' : 'Expandir'} ${node.codigo}`}
                                                className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700"
                                            >
                                                <ChevronRight className={cn('size-3 transition-transform', isOpen && 'rotate-90')} />
                                            </button>
                                        )}
                                        {node.codigo}
                                    </span>
                                </td>
                                <td className="z-10 border-r border-b border-stone-100 bg-inherit px-2 py-2 leading-relaxed md:sticky md:left-28 dark:border-stone-800">
                                    {renderDescripcion ? renderDescripcion(row) : <span className={cn(node.nivel <= 2 && !node.esHoja && 'uppercase')}>{node.descripcion}</span>}
                                </td>
                                {columns.map((column) => (
                                    <td key={column.id} className={cn('border-b border-stone-100 px-2 py-2 whitespace-nowrap dark:border-stone-800', ALIGN[column.align ?? 'right'], column.className)}>
                                        {column.cell(row)}
                                    </td>
                                ))}
                                {rowActions && <td className="border-b border-stone-100 px-1 py-0.5 text-center dark:border-stone-800">{rowActions(row)}</td>}
                            </tr>
                        );
                    })}
                    {visibleRows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + (rowActions ? 3 : 2)} className="px-4 py-10 text-center text-sm text-stone-500">
                                {rows.length === 0 ? 'El presupuesto está vacío.' : 'Ninguna partida coincide con la búsqueda.'}
                            </td>
                        </tr>
                    )}
                </tbody>
                {footer && <tfoot className="z-20 lg:sticky lg:bottom-0">{footer}</tfoot>}
            </table>
        </div>
    );
}
