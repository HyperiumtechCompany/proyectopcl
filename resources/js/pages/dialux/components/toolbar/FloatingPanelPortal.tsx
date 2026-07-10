import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PanelWidth } from './types';

const RAIL_PX =
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 56 : 48;

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
    const [top, setTop] = useState(0);

    useEffect(() => {
        const update = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            // Clamp so the panel never starts too close to the bottom
            const maxTop = Math.max(8, window.innerHeight - 200);
            setTop(Math.min(rect.top, maxTop));
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const panel = document.getElementById('dialux-floating-panel');
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

    // Width in pixels mapped from PanelWidth — used for viewport clamping
    const widthPx = { sm: 208, md: 256, lg: 320, xl: 384 }[width];
    const maxPanelWidth = Math.min(widthPx, window.innerWidth - RAIL_PX - 16);

    return createPortal(
        <div
            id="dialux-floating-panel"
            style={{
                position: 'fixed',
                left: RAIL_PX + 4,
                top,
                zIndex: 9999,
                maxHeight: `calc(100vh - ${top + 12}px)`,
                width: maxPanelWidth,
            }}
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
            <div className="flex-1 overflow-y-auto p-2.5">
                <div className="flex flex-col gap-1">{children}</div>
            </div>
        </div>,
        document.body,
    );
};
