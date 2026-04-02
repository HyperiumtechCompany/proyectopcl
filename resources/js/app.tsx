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
import 'tabulator-tables/dist/css/tabulator.min.css';
import 'tabulator-tables/dist/css/tabulator_simple.min.css'; // Estilo alternativo más limpio

// ── jQuery globals (deben estar antes que Luckysheet) ───────────────────────
// Luckysheet (cargado como UMD via script tag dinámico en Luckysheet.tsx)
// accede a window.$ y window.jQuery al inicializarse.
(window as any).$ = $;
(window as any).jQuery = $;

// Agrega esta línea al inicio del archivo
import 'tabulator-tables/dist/css/tabulator.min.css';

// También asegúrate de cargar el script de Tabulator
const tabulatorScript = document.createElement('script');
tabulatorScript.src = 'https://unpkg.com/tabulator-tables@5.5.0/dist/js/tabulator.min.js';
document.head.appendChild(tabulatorScript);

// Cargar docx.js para generación de Word


// Cargar FileSaver.js para guardar archivos
const fileSaverScript = document.createElement('script');
fileSaverScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
fileSaverScript.async = true;
document.head.appendChild(fileSaverScript);
// NOTA: El CSS de Luckysheet se inyecta dinámicamente en Luckysheet.tsx
// junto al script UMD desde public/luckysheet/. No se importa aquí.

// ── Laravel Echo (Reverb via Pusher protocol) ─────────────────────────────────
 
//(window as any).Pusher = Pusher;
 
//(window as any).Echo = new Echo({
   // broadcaster: 'reverb',
    //key: import.meta.env.VITE_REVERB_APP_KEY,
   // wsHost: import.meta.env.VITE_REVERB_HOST ? import.meta.env.VITE_REVERB_HOST : window.location.hostname,
    //wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    //wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
    //7/forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    //enabledTransports: ['ws', 'wss'],
    //disableStats: true,
//});

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
            
                <App {...props} />
        
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
