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
    onSelect,
    onStartEdit,
    onCommitField,
    onCancelEdit,
    onToggleExpand,
    onContextMenu,
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
        ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
        : task.nivel === 1
          ? 'bg-slate-800/70 hover:bg-slate-700/40'
          : 'bg-slate-850 hover:bg-slate-700/30';

    const textWeight = isGroup ? 'font-semibold' : 'font-normal';
    const descPaddingLeft = depth * INDENT_PX + EXPAND_W + 2;

    return (
        <div
            className={`flex min-h-10 items-stretch border-b border-slate-700/50 text-xs ${rowBg} ${textWeight}`}
            style={style}
            onClick={handleRowClick}
            onContextMenu={handleContextMenu}
        >
            {columns.map((col) => {
                const editing  = isEditing(col.key);
                const raw      = (task as any)[col.key];
                const cellStyle: React.CSSProperties = {
                    width:    col.width,
                    minWidth: col.width,
                };
                const cellClass =
                    'relative shrink-0 border-r border-slate-700/50 last:border-r-0';

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
                                        className="pointer-events-auto flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-200"
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
                            <CellReadOnly value={raw} align={col.align} />
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
                                decimals={col.key === 'presupuesto' ? 2 : 0}
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
    prev.task          === next.task &&
    prev.columns       === next.columns &&
    prev.style.top     === next.style.top &&
    prev.isSelected    === next.isSelected &&
    prev.isGroup       === next.isGroup &&
    prev.isExpanded    === next.isExpanded &&
    prev.onContextMenu === next.onContextMenu &&
    (prev.editState?.rowId === prev.task.id) ===
        (next.editState?.rowId === next.task.id) &&
    (prev.editState?.rowId === prev.task.id
        ? prev.editState?.colKey === next.editState?.colKey
        : true);

export const GanttGridRow = memo(GanttGridRowComponent, areEqual);
