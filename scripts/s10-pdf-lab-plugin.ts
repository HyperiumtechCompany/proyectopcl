import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';

const execute = promisify(execFile);
const endpoint = '/__s10-pdf-lab';
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLocalLabOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        return (
            ['http:', 'https:'].includes(url.protocol) &&
            ['localhost', '127.0.0.1', '[::1]', 'proyectopcl.test'].includes(
                url.hostname,
            ) &&
            url.origin === origin
        );
    } catch {
        return false;
    }
}

type Options = {
    root: string;
    maxBytes?: number;
    readPdf?: (filename: string, signal: AbortSignal) => Promise<unknown>;
};

export function createS10PdfLabMiddleware({
    root,
    maxBytes = 20 * 1024 * 1024,
    readPdf,
}: Options) {
    let busy = false;
    const extract =
        readPdf ??
        (async (filename: string, signal: AbortSignal) => {
            const { stdout } = await execute(
                process.env.S10_PDF_LAB_PYTHON || 'python',
                [join(root, 'scripts/s10_import_pdf.py'), filename],
                {
                    encoding: 'utf8',
                    windowsHide: true,
                    maxBuffer: 64 * 1024 * 1024,
                    timeout: 120_000,
                    signal,
                },
            );
            return JSON.parse(stdout) as unknown;
        });

    return async (
        request: IncomingMessage,
        response: ServerResponse,
        next: () => void,
    ) => {
        if (request.url?.split('?')[0] !== endpoint) return next();
        const send = (status: number, data: unknown) => {
            if (response.destroyed) return;
            response.statusCode = status;
            response.setHeader(
                'Content-Type',
                'application/json; charset=utf-8',
            );
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify(data));
        };
        const origin = request.headers.origin ?? '';
        if (
            !loopback.has(request.socket.remoteAddress ?? '') ||
            !isLocalLabOrigin(origin)
        ) {
            return send(403, {
                error: 'La prueba PDF solo admite solicitudes del proyecto local.',
            });
        }
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        if (request.method === 'OPTIONS') {
            response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            response.setHeader('Access-Control-Allow-Private-Network', 'true');
            response.statusCode = 204;
            return response.end();
        }
        if (request.method !== 'POST')
            return send(405, { error: 'Usa POST para leer el PDF.' });
        if (
            request.headers['content-type']?.split(';')[0] !== 'application/pdf'
        )
            return send(415, { error: 'Selecciona un archivo PDF.' });
        if (Number(request.headers['content-length'] ?? 0) > maxBytes)
            return send(413, {
                error: 'El PDF supera el límite local de 20 MB.',
            });
        if (busy)
            return send(429, {
                error: 'Ya hay un PDF en lectura. Espera o cancela la lectura anterior.',
            });

        busy = true;
        const controller = new AbortController();
        const cancel = () => {
            if (!response.writableEnded) controller.abort();
        };
        response.once('close', cancel);
        let directory: string | undefined;
        try {
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of request) {
                const buffer = Buffer.isBuffer(chunk)
                    ? chunk
                    : Buffer.from(chunk);
                bytes += buffer.length;
                if (bytes > maxBytes)
                    return send(413, {
                        error: 'El PDF supera el límite local de 20 MB.',
                    });
                chunks.push(buffer);
            }
            const buffer = Buffer.concat(chunks);
            if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')))
                return send(422, {
                    error: 'El archivo no contiene un encabezado PDF válido.',
                });
            directory = await mkdtemp(join(tmpdir(), 's10-pdf-preview-'));
            const filename = join(directory, 'acu.pdf');
            await writeFile(filename, buffer);
            const result = await extract(filename, controller.signal);
            send(200, result);
        } catch (error) {
            if (!controller.signal.aborted) {
                const detail =
                    error instanceof Error
                        ? error.message
                        : 'Error desconocido';
                send(422, {
                    error: `No se pudo leer el PDF local. Comprueba Python/PyMuPDF. ${detail.slice(0, 300)}`,
                });
            }
        } finally {
            response.off('close', cancel);
            if (directory) {
                // Solo el archivo conocido y su carpeta temporal; sin borrado recursivo.
                await unlink(join(directory, 'acu.pdf')).catch(() => undefined);
                await rmdir(directory).catch(() => undefined);
            }
            busy = false;
        }
    };
}

export default function s10PdfLabPlugin(): Plugin {
    return {
        name: 's10-pdf-lab-local',
        apply: 'serve',
        configureServer(server) {
            // Se registra antes del middleware CORS de Vite para validar el origen local.
            const middleware = createS10PdfLabMiddleware({
                root: resolve(server.config.root),
            });
            server.middlewares.use((request, response, next) => {
                void middleware(request, response, next).catch(next);
            });
        },
    };
}
