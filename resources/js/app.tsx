import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import '../css/app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { patchWebGLPreserveBuffer } from './pages/dialux/export/assets/patchWebGLPreserveBuffer';
import { initializeTheme } from './hooks/use-appearance';
import $ from 'jquery';
import 'jquery-mousewheel';
import 'tabulator-tables/dist/css/tabulator.min.css';

patchWebGLPreserveBuffer();

// Si un proxy/CDN conserva HTML anterior durante un deploy y solicita un
// chunk que ya no existe, Vite emite este evento. Una sola recarga obtiene el
// manifest nuevo sin dejar el editor 2D/3D en blanco ni crear un bucle.
window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    const reloadKey = 'pcl:vite-preload-reload-at';
    const previousReload = Number(sessionStorage.getItem(reloadKey) ?? 0);
    const now = Date.now();
    if (now - previousReload < 30_000) return;

    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
});

// Luckysheet is loaded as a UMD script and expects these globals.
(window as any).$ = $;
(window as any).jQuery = $;

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

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

initializeTheme();
