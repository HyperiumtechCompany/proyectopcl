#!/usr/bin/env node
// Local connector: HTTP server on 127.0.0.1 for Costos running on the same computer.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, configureEngine, perform } from './cuaderno/engine.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.loadEnvFile(join(root, '.env'));
const token = process.env.CUADERNO_RUNNER_TOKEN;
const port = Number(process.env.CUADERNO_RUNNER_PORT || 43127);
if (
    !token ||
    token.length < 32 ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
) {
    throw new Error(
        'Configura CUADERNO_RUNNER_TOKEN y CUADERNO_RUNNER_PORT en .env.',
    );
}
configureEngine({
    dataDir: join(root, 'storage/app/private'),
    headless: process.env.CUADERNO_BROWSER_HEADLESS !== 'false',
    idleMinutes: Number(process.env.CUADERNO_BROWSER_IDLE_MINUTES || 10),
});

const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (
        request.headers.origin ||
        request.headers.host !== `127.0.0.1:${port}` ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
    ) {
        response.writeHead(403);
        response.end('{"error":"forbidden"}');
        return;
    }
    if (request.method === 'GET' && request.url === '/health') {
        response.end('{"ready":true}');
        return;
    }
    const action = request.url?.match(
        /^\/(connect|inspect|select|preview|sync|capture|screen|interact|asiento|switch|disconnect)$/,
    )?.[1];
    if (
        request.method !== 'POST' ||
        !action ||
        !request.headers['content-type']?.startsWith('application/json')
    ) {
        response.writeHead(404);
        response.end('{"error":"not_found"}');
        return;
    }
    try {
        let size = 0;
        const chunks = [];
        for await (const chunk of request) {
            size += chunk.length;
            if (size > 8192) throw new Error('request_too_large');
            chunks.push(chunk);
        }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new Error('invalid_request');
        response.end(JSON.stringify(await perform(action, input)));
    } catch (error) {
        response.writeHead(422);
        const code = /^[a-z_]+$/.test(error.message)
            ? error.message
            : 'connector_failed';
        response.end(JSON.stringify({ error: code }));
    }
});
server.requestTimeout = 65000;

server.listen(port, '127.0.0.1', () =>
    process.stdout.write(`Conector de cuaderno listo en 127.0.0.1:${port}\n`),
);

async function shutdown() {
    server.close();
    await closeAll();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
