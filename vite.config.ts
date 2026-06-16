import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
