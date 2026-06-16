import { useCallback, useState } from 'react';
import type { EditState } from '../types/cell';
import type { GanttTask } from '../types/task';

interface UseGanttSelectionReturn {
    selectedRowId: number | null;
    editState: EditState | null;
    selectRow: (id: number) => void;
    startEdit: (rowId: number, colKey: string) => void;
    cancelEdit: () => void;
    // Committing triggers updateField externally; this just clears edit state
    stopEdit: () => void;
}

export function useGanttSelection(): UseGanttSelectionReturn {
    const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
    const [editState, setEditState]         = useState<EditState | null>(null);

    const selectRow = useCallback((id: number) => {
        setSelectedRowId(id);
        setEditState(null);
    }, []);

    const startEdit = useCallback((rowId: number, colKey: string) => {
        setSelectedRowId(rowId);
        setEditState({ rowId, colKey });
    }, []);

    const cancelEdit = useCallback(() => {
        setEditState(null);
    }, []);

    const stopEdit = useCallback(() => {
        setEditState(null);
    }, []);

    return { selectedRowId, editState, selectRow, startEdit, cancelEdit, stopEdit };
}
