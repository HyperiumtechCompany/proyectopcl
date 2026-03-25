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

  export function create(arg0: { container: HTMLDivElement; data: { name: any; celldata: any[]; row: number; column: number; }[]; showinfobar: boolean; showstatisticBar: boolean; toolbar: boolean; allowEdit: boolean; hook: { cellUpdated: (r: number) => void; }; }): any {
    throw new Error("Function not implemented.");
  }
}
