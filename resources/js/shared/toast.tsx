// resources/js/shared/toast.tsx
import React, { useState, useCallback, useRef } from 'react';

interface ToastItem {
    id: number;
    text: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const show = useCallback((text: string, type: ToastItem['type']) => {
        const id = ++counterRef.current;
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return { toasts, show };
};

export const ToastContainer: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => {
    const colorMap: Record<string, string> = {
        success: 'bg-emerald-900 border-emerald-600 text-emerald-100',
        error: 'bg-rose-900 border-rose-700 text-rose-100',
        info: 'bg-blue-900 border-blue-700 text-blue-100',
        warning: 'bg-amber-800 border-amber-600 text-amber-100',
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold backdrop-blur-sm ${colorMap[toast.type]}`}
                >
                    {toast.text}
                </div>
            ))}
        </div>
    );
};