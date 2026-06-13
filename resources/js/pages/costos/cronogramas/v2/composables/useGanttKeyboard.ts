import { useCallback, useRef } from 'react';
import type { EditState } from '../types/cell';
import { EDITABLE_COLUMNS } from '../types/cell';
import type { GanttTask } from '../types/task';

interface Callbacks {
    visibleTasks:   GanttTask[];
    selectedRowId:  number | null;
    editState:      EditState | null;
    selectRow:      (id: number) => void;
    startEdit:      (rowId: number, colKey: string) => void;
    stopEdit:       () => void;
    cancelEdit:     () => void;
    addTaskAfter:   (id: number | null) => number;
    addChildTask:   (id: number) => number;
    deleteTask:     (id: number) => void;
    indentTask:     (id: number) => void;
    outdentTask:    (id: number) => void;
    onPendingSelect: (id: number) => void;
}

export function useGanttKeyboard(cb: Callbacks) {
    // Ref pattern: handler estable sin stale closures
    const cbRef = useRef(cb);
    cbRef.current = cb;

    return useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const { visibleTasks, selectedRowId, editState } = cbRef.current;

        // ── Navegación mientras se edita ─────────────────────────────────
        if (editState) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cbRef.current.cancelEdit();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                cbRef.current.stopEdit();
                const idx = visibleTasks.findIndex(t => t.id === editState.rowId);
                if (idx < visibleTasks.length - 1) {
                    cbRef.current.startEdit(visibleTasks[idx + 1].id, editState.colKey);
                }
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                cbRef.current.stopEdit();
                const colIdx = EDITABLE_COLUMNS.findIndex(c => c.key === editState.colKey);
                const rowIdx = visibleTasks.findIndex(t => t.id === editState.rowId);
                if (e.shiftKey) {
                    if (colIdx > 0) {
                        cbRef.current.startEdit(editState.rowId, EDITABLE_COLUMNS[colIdx - 1].key);
                    } else if (rowIdx > 0) {
                        cbRef.current.startEdit(visibleTasks[rowIdx - 1].id, EDITABLE_COLUMNS[EDITABLE_COLUMNS.length - 1].key);
                    }
                } else {
                    if (colIdx < EDITABLE_COLUMNS.length - 1) {
                        cbRef.current.startEdit(editState.rowId, EDITABLE_COLUMNS[colIdx + 1].key);
                    } else if (rowIdx < visibleTasks.length - 1) {
                        cbRef.current.startEdit(visibleTasks[rowIdx + 1].id, EDITABLE_COLUMNS[0].key);
                    }
                }
                return;
            }
            return;
        }

        // ── Sin edición activa ────────────────────────────────────────────
        if (selectedRowId === null) return;
        const rowIdx = visibleTasks.findIndex(t => t.id === selectedRowId);
        const { selectRow, startEdit, addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask, onPendingSelect } = cbRef.current;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (rowIdx < visibleTasks.length - 1) selectRow(visibleTasks[rowIdx + 1].id);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (rowIdx > 0) selectRow(visibleTasks[rowIdx - 1].id);
                break;
            case 'F2':
            case 'Enter':
                e.preventDefault();
                startEdit(selectedRowId, EDITABLE_COLUMNS[0].key);
                break;
            case 'Insert':
                e.preventDefault();
                if (e.ctrlKey) {
                    // Ctrl+Insert → agregar hijo
                    onPendingSelect(addChildTask(selectedRowId));
                } else {
                    // Insert → agregar hermano
                    onPendingSelect(addTaskAfter(selectedRowId));
                }
                break;
            case 'Delete':
                e.preventDefault();
                deleteTask(selectedRowId);
                if (rowIdx > 0) selectRow(visibleTasks[rowIdx - 1].id);
                break;
            case 'Tab':
                e.preventDefault();
                e.shiftKey ? outdentTask(selectedRowId) : indentTask(selectedRowId);
                break;
            default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    startEdit(selectedRowId, EDITABLE_COLUMNS[0].key);
                }
                break;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
