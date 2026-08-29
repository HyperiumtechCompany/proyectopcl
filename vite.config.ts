import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
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
        // Producción: sin ruido de consola. En `vite build` se eliminan del
        // bundle los `console.log/info/debug/warn/trace` (quedan sin efecto)
        // y los `debugger`. Se conserva `console.error` a propósito: un error
        // real debe seguir siendo visible para diagnosticar producción. No
        // aplica en `serve`/HMR ni en los tests. El backend ya corre con
        // APP_DEBUG=false; esto es el equivalente para el frontend React.
        // Nota: los archivos precompilados servidos desde `public/` (ej.
        // dialux-core/pkg, cad-workers) NO pasan por esbuild.
        pure:
            command === 'build'
                ? [
                      'console.log',
                      'console.info',
                      'console.debug',
                      'console.warn',
                      'console.trace',
                  ]
                : [],
        drop: command === 'build' ? ['debugger'] : [],
    },


    optimizeDeps: {
        include: ['docx'],
    },

    test: {
        environment: 'node',
        include: ['resources/js/**/*.test.ts', 'resources/js/**/*.test.tsx'],
        // El motor de tablas UGR (salas de referencia CIE) y los benchmarks de
        // paridad DIALux evo hacen cálculo pesado real: ~2-4 s cada uno en
        // aislamiento, pero al correr el suite entero en paralelo la
        // contención de CPU los empuja más allá del default de 5 s de Vitest
        // y fallan por timeout sin ser una regresión. 20 s da margen sin
        // ocultar un cuelgue real.
        testTimeout: 20_000,
        hookTimeout: 20_000,
    },
}));
