import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PanelWidth } from './types';

/** Ancho del rail lateral (px). Se recalcula en cada resize. */
function getRailPx(): number {
    if (typeof window === 'undefined') return 56;
    return window.innerWidth >= 768 ? 56 : 48;
}

/** Distancia desde el borde derecho del rail hasta el panel (margen de separación). */
const PANEL_OFFSET_X = 64;

/** Si el ancla está por debajo de este umbral (fracción del viewport) el panel se abre hacia arriba. */
const FLIP_THRESHOLD = 0.55;



interface FloatingPanelPortalProps {
    title: string;
    icon: React.ReactNode;
    anchorRef: React.RefObject<HTMLElement | null>;
    onClose: () => void;
    children: React.ReactNode;
    width?: PanelWidth;
}

export const FloatingPanelPortal: React.FC<FloatingPanelPortalProps> = ({
    title,
    icon,
    anchorRef,
    onClose,
    children,
    width = 'sm',
}) => {
    const [pos, setPos] = useState<{
        top?: number;
        bottom?: number;
        left: number;
        maxH: string;
    }>({ left: getRailPx() + PANEL_OFFSET_X, maxH: '80vh' });
    const [railPx, setRailPx] = useState(getRailPx);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const update = () => {
            const rail = getRailPx();
            setRailPx(rail);
            if (!anchorRef.current) return;

            const rect = anchorRef.current.getBoundingClientRect();
            const vH = window.innerHeight;
            const anchorMidY = rect.top + rect.height / 2;
            const left = rail + PANEL_OFFSET_X;

            if (anchorMidY / vH > FLIP_THRESHOLD) {
                // Anchor in bottom half → open upward (bottom-anchored)
                const bottom = vH - rect.bottom + rect.height / 2;
                const maxH = `${Math.min(vH - bottom - 12, vH * 0.75)}px`;
                setPos({ bottom: Math.max(8, bottom), left, maxH });
            } else {
                // Anchor in top half → open downward (top-anchored)
                const top = Math.max(8, rect.top);
                const maxH = `calc(100vh - ${top + 12}px)`;
                setPos({ top, left, maxH });
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [anchorRef]);

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

    // Width clamped to viewport
    const widthPx = { sm: 220, md: 268, lg: 328, xl: 392 }[width];
    const maxPanelWidth = Math.min(widthPx, window.innerWidth - railPx - PANEL_OFFSET_X - 8);

    const style: React.CSSProperties = {
        position: 'fixed',
        left: pos.left,
        zIndex: 9999,
        maxHeight: pos.maxH,
        width: maxPanelWidth,
    };
    if (pos.bottom !== undefined) {
        style.bottom = pos.bottom;
    } else {
        style.top = pos.top;
    }

    return createPortal(
        <div
            ref={panelRef}
            id="dialux-floating-panel"
            style={style}
            className="flex flex-col overflow-hidden rounded-lg border border-gray-700/60 bg-[#191c2c] shadow-2xl ring-1 ring-black/50"
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700/50 bg-[#1e2236] px-3 py-2">
                <div className="flex items-center gap-2 text-gray-200">
                    <span className="text-gray-400">{icon}</span>
                    <span className="text-[11.5px] font-bold tracking-wide">
                        {title}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-600/40 hover:text-gray-300"
                >
                    <X size={10} />
                </button>
            </div>
            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                <div className="flex flex-col gap-1">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
