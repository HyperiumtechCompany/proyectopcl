import React, { memo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ColumnDef, EditState } from '../../types/cell';
import type { GanttTask, Predecessor } from '../../types/task';
import { CellReadOnly } from './cells/CellReadOnly';
import { CellText } from './cells/CellText';
import { CellNumber } from './cells/CellNumber';
import { CellDate } from './cells/CellDate';
import { CellPredecesoras } from './cells/CellPredecesoras';
import { CellSelect } from './cells/CellSelect';

const INDENT_PX = 16;
const EXPAND_W  = 16;

interface Props {
    task: GanttTask;
    columns: ColumnDef[];
    allTasks: GanttTask[];
    isSelected: boolean;
    isGroup: boolean;
    isExpanded: boolean;
    editState: EditState | null;
    style: React.CSSProperties;
    /** Text color class applied to the description cell (hierarchy coloring) */
    descTextClass?: string;
    /** When provided, renders a sticky row-number gutter cell before all columns */
    rowIndex?: number;
    onSelect: (id: number) => void;
    onStartEdit: (rowId: number, colKey: string) => void;
    onCommitField: <K extends keyof GanttTask>(
        id: number,
        field: K,
        value: GanttTask[K],
    ) => void;
    onCancelEdit: () => void;
    onToggleExpand: (id: number) => void;
    onContextMenu: (taskId: number, x: number, y: number) => void;
    /** Cuando se provee, la partida del nodo raíz (nivel 1) es editable con doble clic */
    onRenamePartida?: (taskId: number, newPartida: string) => void;
}

const GanttGridRowComponent = function GanttGridRow({
    task,
    columns,
    allTasks,
    isSelected,
    isGroup,
    isExpanded,
    editState,
    style,
    descTextClass,
    rowIndex,
    onSelect,
    onStartEdit,
    onCommitField,
    onCancelEdit,
    onToggleExpand,
    onContextMenu,
    onRenamePartida,
}: Props) {
    const isEditing = (colKey: string) =>
        editState?.rowId === task.id && editState?.colKey === colKey;

    const handleRowClick = useCallback(
        () => onSelect(task.id),
        [task.id, onSelect],
    );

    const handleCellClick = useCallback(
        (colKey: string) => {
            if (isSelected) onStartEdit(task.id, colKey);
            else onSelect(task.id);
        },
        [isSelected, task.id, onSelect, onStartEdit],
    );

    const handleCellDblClick = useCallback(
        (colKey: string) => onStartEdit(task.id, colKey),
        [task.id, onStartEdit],
    );

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            onSelect(task.id);
            onContextMenu(task.id, e.clientX, e.clientY);
        },
        [task.id, onSelect, onContextMenu],
    );

    const depth = Math.max(0, task.nivel - 1);

    const rowBg = isSelected
        ? 'bg-blue-100 border-l-2 border-l-blue-500 dark:bg-blue-900/30'
        : task.nivel === 1
          ? 'bg-slate-200/80 hover:bg-slate-300/70 dark:bg-slate-800/70 dark:hover:bg-slate-700/40'
          : 'bg-white hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/70';

    const textWeight = isGroup ? 'font-semibold' : 'font-normal';
    const descPaddingLeft = depth * INDENT_PX + EXPAND_W + 2;

    return (
        <div
            className={`flex min-h-10 items-stretch border-b border-slate-300 text-xs dark:border-slate-700/50 ${rowBg} ${textWeight}`}
            style={style}
            onClick={handleRowClick}
            onContextMenu={handleContextMenu}
        >
            {rowIndex !== undefined && (
                <div
                    className="flex shrink-0 items-center justify-center border-r border-slate-300 bg-slate-100 font-mono text-[10px] text-slate-500 select-none dark:border-slate-700/50 dark:bg-slate-900/60 dark:text-slate-600"
                    style={{ width: 32, minWidth: 32, position: 'sticky', left: 0, zIndex: 1 }}
                >
                    {rowIndex + 1}
                </div>
            )}
            {columns.map((col) => {
                const editing  = isEditing(col.key);
                const raw      = (task as any)[col.key];
                const cellStyle: React.CSSProperties = {
                    width:    col.width,
                    minWidth: col.width,
                };
                const cellClass =
                    'relative shrink-0 border-r border-slate-300 last:border-r-0 dark:border-slate-700/50';

                return (
                    <div key={col.key} className={cellClass} style={cellStyle}>
                        {/* Expand/collapse toggle inside description */}
                        {col.key === 'descripcion' && (
                            <div
                                className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
                                style={{ paddingLeft: depth * INDENT_PX }}
                            >
                                {isGroup ? (
                                    <button
                                        className="pointer-events-auto flex h-4 w-4 items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleExpand(task.id);
                                        }}
                                        tabIndex={-1}
                                    >
                                        {isExpanded ? (
                                            <ChevronDown size={11} />
                                        ) : (
                                            <ChevronRight size={11} />
                                        )}
                                    </button>
                                ) : (
                                    <div className="w-4" />
                                )}
                            </div>
                        )}

                        {col.type === 'readonly' && (
                            <CellReadOnly value={raw} align={col.align} decimals={col.decimals} />
                        )}
                        {col.type === 'text' && (
                            <CellText
                                value={(raw as string) ?? ''}
                                isEditing={editing}
                                wrap={col.key === 'descripcion'}
                                indent={
                                    col.key === 'descripcion'
                                        ? descPaddingLeft
                                        : 0
                                }
                                prefix={
                                    col.key === 'descripcion'
                                        ? task.partida
                                        : undefined
                                }
                                prefixEditable={
                                    col.key === 'descripcion' &&
                                    task.nivel === 1 &&
                                    isGroup &&
                                    !!onRenamePartida
                                }
                                onPrefixCommit={
                                    col.key === 'descripcion' && onRenamePartida
                                        ? (v) => onRenamePartida(task.id, v)
                                        : undefined
                                }
                                textColorClass={col.key === 'descripcion' ? descTextClass : undefined}
                                onCommit={(v) =>
                                    onCommitField(task.id, col.key as any, v as any)
                                }
                                onCancel={onCancelEdit}
                                onClick={() => handleCellClick(col.key)}
                                onDoubleClick={() => handleCellDblClick(col.key)}
                            />
                        )}
                        {col.type === 'number' && (
                            <CellNumber
                                value={(raw as number) ?? 0}
                                isEditing={editing}
                                decimals={col.decimals ?? 0}
                                min={col.key === 'duracion_dias' ? 1 : undefined}
                                align={col.align}
                                onCommit={(v) =>
                                    onCommitField(task.id, col.key as any, v as any)
                                }
                                onCancel={onCancelEdit}
                                onClick={() => handleCellClick(col.key)}
                                onDoubleClick={() => handleCellDblClick(col.key)}
                            />
                        )}
                        {col.type === 'date' && (
                            <CellDate
                                value={raw as string | null}
                                isEditing={editing}
                                onCommit={(v) =>
                                    onCommitField(task.id, col.key as any, v as any)
                                }
                                onCancel={onCancelEdit}
                                onClick={() => handleCellClick(col.key)}
                                onDoubleClick={() => handleCellDblClick(col.key)}
                            />
                        )}
                        {col.type === 'predecesoras' &&
                            (isGroup ? (
                                <CellReadOnly value="–" align="center" />
                            ) : (
                                <CellPredecesoras
                                    value={(raw as Predecessor[]) ?? []}
                                    allTasks={allTasks}
                                    currentTaskId={task.id}
                                    isEditing={editing}
                                    onCommit={(v) =>
                                        onCommitField(task.id, col.key as any, v as any)
                                    }
                                    onCancel={onCancelEdit}
                                    onClick={() => handleCellClick(col.key)}
                                    onDoubleClick={() => handleCellDblClick(col.key)}
                                />
                            ))}
                        {col.type === 'select' &&
                            (isGroup ? (
                                <CellReadOnly value="–" align="center" />
                            ) : (
                                <CellSelect
                                    value={(raw as string) ?? ''}
                                    options={col.options}
                                    onCommit={(v) =>
                                        onCommitField(task.id, col.key as any, v as any)
                                    }
                                    onClick={() => onSelect(task.id)}
                                />
                            ))}
                    </div>
                );
            })}
        </div>
    );
};

const areEqual = (prev: Props, next: Props) =>
    prev.task               === next.task &&
    prev.columns            === next.columns &&
    prev.style.top          === next.style.top &&
    prev.isSelected         === next.isSelected &&
    prev.isGroup            === next.isGroup &&
    prev.isExpanded         === next.isExpanded &&
    prev.descTextClass      === next.descTextClass &&
    prev.rowIndex           === next.rowIndex &&
    prev.onContextMenu      === next.onContextMenu &&
    prev.onRenamePartida    === next.onRenamePartida &&
    (prev.editState?.rowId === prev.task.id) ===
        (next.editState?.rowId === next.task.id) &&
    (prev.editState?.rowId === prev.task.id
        ? prev.editState?.colKey === next.editState?.colKey
        : true);

export const GanttGridRow = memo(GanttGridRowComponent, areEqual);
