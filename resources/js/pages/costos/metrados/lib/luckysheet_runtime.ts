export function isLuckysheetReady(): boolean {
    const inst = (window as any).luckysheet;
    const container = document.getElementById('luckysheet');

    return Boolean(
        inst &&
            container?.isConnected &&
            container.querySelector('canvas') &&
            inst.getAllSheets?.()?.length,
    );
}

export function safeSetCellValue(
    row: number,
    column: number,
    value: any,
    options?: Record<string, any>,
): void {
    const inst = (window as any).luckysheet;

    if (!isLuckysheetReady() || typeof inst?.setCellValue !== 'function') {
        return;
    }

    try {
        inst.setCellValue(row, column, value, options);
    } catch (error) {
        console.warn('[Luckysheet] setCellValue skipped:', error);
    }
}

export function safeSetDataVerification(
    options: Record<string, any>,
    rangeOptions: Record<string, any>,
): void {
    const inst = (window as any).luckysheet;

    if (
        !isLuckysheetReady() ||
        typeof inst?.setDataVerification !== 'function'
    ) {
        return;
    }

    try {
        inst.setDataVerification(options, rangeOptions);
    } catch (error) {
        console.warn('[Luckysheet] setDataVerification skipped:', error);
    }
}
