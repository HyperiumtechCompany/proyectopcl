// Offline check of the real connector process against a fake Costos server:
// pairing, task polling, running a task with the engine, reporting and single instance.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const agent = join(
    dirname(fileURLToPath(import.meta.url)),
    'cuaderno-agent.mjs',
);
const home = mkdtempSync(join(tmpdir(), 'proyectopcl-agente-'));
const token = 'x'.repeat(64);
const results = [];
let delivered = false;

const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : null;
    const authorized = request.headers.authorization === `Bearer ${token}`;
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/cuaderno-agente/emparejar') {
        assert.equal(body.codigo, 'ABCD2345');
        return response.end(JSON.stringify({ token, nombre: body.nombre }));
    }
    if (!authorized) {
        response.writeHead(401);
        return response.end('{}');
    }
    if (request.url === '/api/cuaderno-agente/tareas') {
        if (delivered) {
            response.writeHead(204);
            return response.end();
        }
        delivered = true;
        return response.end(
            JSON.stringify({
                id: 'tarea-1',
                action: 'disconnect',
                payload: { session: '11111111-1111-4111-8111-111111111111' },
            }),
        );
    }
    if (request.url === '/api/cuaderno-agente/tareas/tarea-1/resultado') {
        results.push(body);
        response.writeHead(204);
        return response.end();
    }
    response.writeHead(404);
    response.end('{}');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, CUADERNO_AGENTE_HOME: home };
const run = (args) =>
    spawn(process.execPath, [agent, ...args], { env, stdio: 'pipe' });
const output = (child) =>
    new Promise((resolve) => {
        let text = '';
        child.stdout.on('data', (data) => (text += data));
        child.on('exit', (code) => resolve({ code, text }));
    });

let first;
try {
    const paired = await output(
        run(['--emparejar', 'ABCD2345', '--servidor', url]),
    );
    assert.equal(paired.code, 0, paired.text);
    assert.equal(
        JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).token,
        token,
    );

    first = run([]);
    for (let attempt = 0; attempt < 40 && !results.length; attempt++)
        await delay(250);
    assert.deepEqual(results, [
        { status: 'completada', result: { state: 'disconnected' } },
    ]);

    const second = await output(run([]));
    assert.match(second.text, /ya está en ejecución/);
    process.stdout.write(
        'Agent smoke passed: pairing, polling, task run, report and single instance.\n',
    );
} finally {
    first?.kill();
    server.close();
    await delay(300);
    rmSync(home, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
    });
}
