import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { initializeTheme } from './hooks/use-appearance';
//import Echo from 'laravel-echo';
//import Pusher from 'pusher-js';
import $ from 'jquery';
import 'jquery-mousewheel';

// ── jQuery globals (deben estar antes que Luckysheet) ───────────────────────
// Luckysheet (cargado como UMD via script tag dinámico en Luckysheet.tsx)
// accede a window.$ y window.jQuery al inicializarse.
(window as any).$ = $;
(window as any).jQuery = $;

// NOTA: El CSS de Luckysheet se inyecta dinámicamente en Luckysheet.tsx
// junto al script UMD desde public/luckysheet/. No se importa aquí.

// ── Laravel Echo (Reverb via Pusher protocol) ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any


const appName = import.meta.env.VITE_APP_NAME || 'Laravel';


createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <StrictMode>
                <App {...props} />
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
