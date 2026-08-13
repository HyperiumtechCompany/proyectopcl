import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // Una ruta con `/resources` se interpreta desde la raiz de la unidad en
    // Windows (C:\\resources). Resolver el alias desde este archivo funciona
    // igual en desarrollo, CI y produccion Linux.
    alias: {
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
    },
  },
  build: {
    // Un deploy no debe borrar los chunks que una pestaña ya abierta todavía
    // puede solicitar al cambiar entre 2D y 3D. El manifest nuevo se reemplaza
    // al terminar, mientras los assets con hash anteriores siguen disponibles.
    emptyOutDir: false,
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
    hmr: {
        host: 'localhost',
        protocol: 'http',
    },
    headers: {
        'Permissions-Policy': 'unload=(self)',
    },
    proxy: {
        '/module': {
            target: 'http://127.0.0.1:8000',
            changeOrigin: true,
        },
        '/cronograma': {
            target: 'http://127.0.0.1:8000',
            changeOrigin: true,
        },
    },
},

    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/@mlightcad/cad-simple-viewer/dist/*.js',
                    dest: '../../public/cad-workers'
                },
                {
                    // Fase 19 ("BIM/IFC"): `web-ifc` (WASM) resuelve su binario en
                    // runtime vía `fetch`, no vía el bundler — sin copiar este
                    // archivo a un path público servible, `IfcAPI.Init()` falla
                    // en producción con un 404 silencioso (mismo problema ya
                    // resuelto para los workers de @mlightcad arriba). `rename`
                    // aplana la ruta (sin esto, vite-plugin-static-copy conserva
                    // `node_modules/web-ifc/...` cuando `src` no es un glob).
                    src: 'node_modules/web-ifc/web-ifc.wasm',
                    dest: '../../public/wasm',
                    rename: { stripBase: true }
                }
            ]
        }),
    ],

    esbuild: {
        jsx: 'automatic',
    },


    optimizeDeps: {
        include: ['docx'],
    },

    test: {
        environment: 'node',
        include: ['resources/js/**/*.test.ts', 'resources/js/**/*.test.tsx'],
    },
});
