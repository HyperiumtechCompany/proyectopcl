import type { Auth } from '@/types/auth';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}

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
