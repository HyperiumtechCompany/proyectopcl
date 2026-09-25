import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { UseSiteEditorReturn } from './useSiteEditor';

/**
 * Atajos de teclado del Emplazamiento 2D:
 *  - Esc: cancela el trazo en curso; sin trazo, vuelve a "Seleccionar"; sin herramienta, deselecciona.
 *  - Ctrl+Z: durante un trazo quita el último punto; si no, deshace el último cambio.
 *  - Ctrl+Y / Ctrl+Shift+Z: rehace.
 *  - Ctrl+C / Ctrl+V: copia / pega el elemento seleccionado.
 *  - Retroceso: quita el último punto mientras se dibuja. Enter: termina el trazo.
 *  - Ctrl+A: selecciona todo lo visible. Supr / Retroceso (sin trazo): elimina la selección.
 *
 * Solo escucha con el 2D al frente (`isActive`), y nunca dentro de un campo de
 * texto/lista ni con un diálogo de importación abierto (ahí valen los atajos nativos).
 */
export function useSiteKeyboard(editor: UseSiteEditorReturn, isActive: boolean) {
    const editorRef = useRef(editor);
    useEffect(() => {
        editorRef.current = editor;
    });

    useEffect(() => {
        if (!isActive) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable)
            ) {
                return;
            }
            const ed = editorRef.current;
            if (ed.planImportOpen || ed.contourImportOpen || ed.surveyImportOpen) {
                return;
            }
            const mod = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            const drawing = ed.pendingVertices.length > 0;
            const handled = () => {
                event.preventDefault();
                event.stopPropagation();
            };

            if (key === 'escape') {
                if (drawing) ed.cancelDrawing();
                else if (ed.calibrationPoints.length > 0) ed.cancelCalibration();
                else if (ed.activeTool !== 'select') ed.startTool('select');
                else if (ed.selectedElementId) ed.selectElement(null);
                else if (ed.selectedWireId) ed.selectWire(null);
                else return;
                handled();
                return;
            }
            if (drawing && key === 'enter') {
                ed.finishDrawing();
                handled();
                return;
            }
            if (!drawing && !mod && (key === 'delete' || key === 'backspace')) {
                if (ed.deleteSelected() > 0) handled();
                return;
            }
            if (drawing && key === 'backspace') {
                ed.removeLastVertex();
                handled();
                return;
            }
            if (!mod) return;
            if (key === 'z' && !event.shiftKey) {
                if (drawing) ed.removeLastVertex();
                else useEditorStore.getState().undo();
                handled();
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                useEditorStore.getState().redo();
                handled();
            } else if (key === 'a') {
                ed.selectAllElements();
                handled();
            } else if (key === 'c') {
                // No pisar el copiar nativo si hay texto seleccionado en la página.
                if (window.getSelection()?.toString()) return;
                if (ed.copySelectedElement()) handled();
            } else if (key === 'v') {
                if (ed.pasteElement()) handled();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isActive]);
}
