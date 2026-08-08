import React from 'react';

interface WasmBadgeProps {
    ready: boolean;
    label?: string;
}

/**
 * WasmBadge — Indicador de estado del motor de cálculo
 * Verde: motor JS activo / WASM conectado
 * Gris pulsante: motor cargando / desconectado
 */
export const WasmBadge: React.FC<WasmBadgeProps> = ({ ready, label = 'Motor JS' }) => (
    <span
        title={ready ? 'Motor de cálculo activo' : 'Motor cargando…'}
        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono transition-all ${
            ready
                ? 'bg-green-900/50 text-green-400 border border-green-800/50'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border border-gray-300 dark:border-gray-700/50 animate-pulse'
        }`}
    >
        <span className="text-[8px]">{ready ? '●' : '○'}</span>
        {label}
    </span>
);
