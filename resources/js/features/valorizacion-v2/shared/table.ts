/**
 * Clases comunes de las tablas de control (no árbol). El color de texto vive en
 * la TABLA y las celdas lo heredan: así una fila (total, final, resaltada) puede
 * fijar su propio color sin que la celda lo pise (antes `td` traía su color y en
 * modo oscuro dejaba letras claras sobre fondos claros).
 */
export const tableClasses = {
    wrap: 'min-w-0 max-w-full overflow-x-auto rounded-lg border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
    table: 'w-full min-w-3xl border-separate border-spacing-0 text-[13px] text-stone-800 dark:text-stone-200',
    band: 'border-b border-l border-stone-300 bg-stone-200/60 px-3 py-2.5 text-center text-[11px] font-semibold tracking-[0.04em] text-stone-800 uppercase first:border-l-0 dark:border-stone-700 dark:bg-stone-700/50 dark:text-stone-100',
    th: 'border-b border-stone-300 bg-stone-100 px-3 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-stone-700 uppercase dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200',
    td: 'border-b border-stone-100 px-3 py-2 whitespace-nowrap dark:border-stone-800',
    num: 'text-right font-mono tabular-nums',
    total: 'bg-amber-100/70 font-semibold text-stone-900 dark:bg-amber-500/15 dark:text-amber-100',
} as const;
