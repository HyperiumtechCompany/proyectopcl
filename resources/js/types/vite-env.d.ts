/// <reference types="vite/client" />

declare module 'luckysheet' {
    interface LuckysheetOptions {
        container: HTMLElement;
        data?: any[];
        [key: string]: any;
    }

    interface Luckysheet {
        create(options: LuckysheetOptions): void;
        destroy(): void;
    }

    const luckysheet: Luckysheet;
    export default luckysheet;
}
