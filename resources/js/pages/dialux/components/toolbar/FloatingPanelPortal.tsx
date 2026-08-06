import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PanelWidth } from './types';

/**
 * Margen (px) entre el borde derecho del RIEL de la toolbar (o del botón que
 * abrió el panel, lo que quede más a la derecha) y el panel mismo. Anclar
 * solo al botón individual (rect.right de su wrapper) dejaba apenas unos
 * pocos px de separación real con el borde del riel `#dialux-toolbar`
 * (padding/gap del wrapper se cuentan distinto a como se ven visualmente),
 * suficiente para que el panel se percibiera pegado o superpuesto al riel.
 * Ahora se toma el máximo entre el borde derecho del riel completo y el del
 * botón — el panel nunca puede quedar encima de ninguna parte de la toolbar.
 */
const PANEL_GAP_X = 16;
const PANEL_GAP_Y = 8;

const TOOLBAR_RAIL_ID = 'dialux-toolbar';

/** Si el ancla está por debajo de este umbral (fracción del viewport) el panel se abre hacia arriba. */
const FLIP_THRESHOLD = 0.55;

interface FloatingPanelPortalProps {
    title: string;
    icon: React.ReactNode;
    anchorRef: React.RefObject<HTMLElement | null>;
    onClose: () => void;
    children: React.ReactNode;
    width?: PanelWidth;
    dropdown?: boolean;
    hideHeader?: boolean;
}

export const FloatingPanelPortal: React.FC<FloatingPanelPortalProps> = ({
    title,
    icon,
    anchorRef,
    onClose,
    children,
    width = 'sm',
    dropdown = false,
    hideHeader = false,
}) => {
    const [layout, setLayout] = useState<{
        top?: number;
        bottom?: number;
        maxH?: string;
        left: number;
        width: number;
    }>({ left: 80, width: 220 });
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const update = () => {
            if (!anchorRef.current) return;

            const rect = anchorRef.current.getBoundingClientRect();
            const toolbarElement = document.getElementById(TOOLBAR_RAIL_ID);
            const toolbarRight = toolbarElement?.getBoundingClientRect().right ?? 0;
            // `.contains()` cubre el caso normal, pero si por lo que sea falla
            // (portal intermedio, timing) igual detectamos por geometría: un
            // ancla cuyo borde izquierdo cae dentro del riel es del riel — así
            // el panel nunca puede terminar dibujado encima de la toolbar.
            const isToolbarAnchor =
                (toolbarElement?.contains(anchorRef.current) ?? false) ||
                (toolbarElement !== null && rect.left < toolbarRight);
            const headerBottom =
                document.getElementById('dialux-header')?.getBoundingClientRect()
                    .bottom ?? 0;
            const widthPx = { sm: 220, md: 268, lg: 328, xl: 392 }[width];
            const minWidth = 140;
            let panelWidth: number;
            let left: number;

            if (isToolbarAnchor) {
                const rightEdge = Math.max(rect.right, toolbarRight);
                const rightAvailable = window.innerWidth - rightEdge - PANEL_GAP_X - 16;
                const leftAvailable = rect.left - PANEL_GAP_X - 16;

                if (rightAvailable >= minWidth) {
                    panelWidth = Math.min(widthPx, rightAvailable);
                    left = rightEdge + PANEL_GAP_X;
                } else if (leftAvailable >= minWidth) {
                    panelWidth = Math.min(widthPx, leftAvailable);
                    left = Math.max(8, rect.left - PANEL_GAP_X - panelWidth);
                } else {
                    panelWidth = Math.min(widthPx, Math.max(minWidth, window.innerWidth - 32));
                    left = Math.max(8, Math.min(rightEdge + PANEL_GAP_X, window.innerWidth - panelWidth - 16));
                }
            } else {
                const maxAllowedWidth = Math.max(minWidth, window.innerWidth - 32);
                panelWidth = Math.min(widthPx, maxAllowedWidth);

                const leftAligned = Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16));
                const rightAligned = Math.max(16, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 16));

                if (rect.left + panelWidth <= window.innerWidth - 16) {
                    left = rect.left > window.innerWidth / 2 ? rightAligned : leftAligned;
                } else if (rect.right - panelWidth >= 16) {
                    left = rightAligned;
                } else {
                    left = leftAligned;
                }
            }

            let pos: { top?: number; bottom?: number; maxH?: string };
            const availableBelow = window.innerHeight - Math.max(rect.bottom, headerBottom) - PANEL_GAP_Y;
            const availableAbove = rect.top - headerBottom - PANEL_GAP_Y;
            const openAbove = availableAbove >= availableBelow && availableAbove >= 140;

            if (openAbove) {
                const bottom = Math.max(PANEL_GAP_Y, window.innerHeight - rect.top + PANEL_GAP_Y);
                pos = dropdown
                    ? { bottom }
                    : { bottom, maxH: `${Math.max(0, availableAbove)}px` };
            } else {
                const top = Math.max(headerBottom + PANEL_GAP_Y, rect.bottom + PANEL_GAP_Y);
                pos = dropdown
                    ? { top }
                    : { top, maxH: `${Math.max(0, availableBelow)}px` };
            }

            setLayout({ ...pos, left, width: panelWidth });
        };

        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update);
        document.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update);
            document.removeEventListener('scroll', update, true);
        };
    }, [anchorRef, width, dropdown]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const panel = panelRef.current;
            if (
                anchorRef.current &&
                !anchorRef.current.contains(target) &&
                panel &&
                !panel.contains(target)
            )
                onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [anchorRef, onClose]);

    const style: React.CSSProperties = {
        position: 'fixed',
        left: `${layout.left}px`,
        zIndex: 99999,
        width: `${layout.width}px`,
        ...(layout.maxH ? { maxHeight: layout.maxH } : {}),
    };
    if (layout.bottom !== undefined) {
        style.bottom = `${layout.bottom}px`;
    } else {
        style.top = `${layout.top}px`;
    }

    return createPortal(
        <div
            ref={panelRef}
            id="dialux-floating-panel"
            style={style}
            className={`flex flex-col rounded-lg border border-gray-700/60 bg-[#191c2c] shadow-2xl ring-1 ring-black/50 ${dropdown ? 'overflow-visible' : 'overflow-hidden'}`}
        >
            {/* Header (optional for compact dropdowns) */}
            {!hideHeader && (
                <div className="flex shrink-0 items-center justify-between border-b border-gray-700/50 bg-[#1e2236] px-3 py-2">
                    <div className="flex items-center gap-2 text-gray-200">
                        <span className="text-gray-400">{icon}</span>
                        <span className="text-[11.5px] font-bold tracking-wide">{title}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-600/40 hover:text-gray-300"
                    >
                        <X size={10} />
                    </button>
                </div>
            )}

            {/* Body */}
            <div
                role={dropdown ? 'menu' : undefined}
                aria-expanded={dropdown ? true : undefined}
                className={`${dropdown ? '' : 'min-h-0 flex-1'} p-2.5 ${dropdown ? 'overflow-visible' : 'overflow-auto'}`}
            >
                <div className="flex flex-col gap-1">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
