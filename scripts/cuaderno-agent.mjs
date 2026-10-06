#!/usr/bin/env node
// Connector installed on the holder's computer. OECE/RENIEC block datacenter IPs, so the
// production server (Costos) queues tasks and this computer runs them from its own normal
// connection: it asks for tasks over HTTPS, drives OECE with the shared browser engine and
// sends back the results and official PDFs. It never opens ports or windows.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import {
    existsSync,
    mkdirSync,
    openAsBlob,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir, hostname, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { closeAll, configureEngine, perform } from './cuaderno/engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const versionFile = join(here, 'version.txt');
const version = existsSync(versionFile)
    ? readFileSync(versionFile, 'utf8').trim()
    : 'dev';
const home =
    process.env.CUADERNO_AGENTE_HOME ||
    join(
        process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'),
        'CostosCuaderno',
    );
const configFile = join(home, 'config.json');
const dataDir = join(home, 'datos');
const MAX_PARALLEL = 4;

const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index > 0 ? process.argv[index + 1] : undefined;
};
const log = (message) =>
    process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);

async function pair(code, server) {
    const origin = new URL(server).origin;
    if (
        !origin.startsWith('https://') &&
        !/\/\/(127\.0\.0\.1|localhost)/.test(origin)
    )
        throw new Error('El servidor debe usar https.');
    const response = await fetch(`${origin}/api/cuaderno-agente/emparejar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            codigo: code,
            nombre: hostname().slice(0, 120),
            plataforma: `${platform()} ${release()}`.slice(0, 120),
            version,
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.token)
        throw new Error(
            body.message ?? `El servidor respondió ${response.status}.`,
        );
    mkdirSync(home, { recursive: true });
    writeFileSync(
        configFile,
        JSON.stringify({ servidor: origin, token: body.token }),
        {
            mode: 0o600,
        },
    );
    log(`Conector enlazado como «${body.nombre}».`);
}

// Only one copy per computer: two copies would fight over the same browser profiles.
function singleInstance() {
    return new Promise((resolve) => {
        const lock = createServer();
        lock.once('error', () => resolve(false));
        lock.listen(43128, '127.0.0.1', () => resolve(true));
        lock.unref();
    });
}

async function run() {
    if (!(await singleInstance())) {
        log('El conector ya está en ejecución en esta PC.');
        return;
    }
    if (!existsSync(configFile)) {
        log('Este conector no está enlazado. Instálalo desde Costos.');
        process.exitCode = 1;
        return;
    }
    const { servidor, token } = JSON.parse(readFileSync(configFile, 'utf8'));
    configureEngine({
        dataDir,
        headless: process.env.CUADERNO_BROWSER_HEADLESS !== 'false',
        idleMinutes: Number(process.env.CUADERNO_BROWSER_IDLE_MINUTES || 10),
    });
    const api = (method, path, body) =>
        fetch(`${servidor}/api/cuaderno-agente${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'X-Agente-Version': version,
                ...(body && !(body instanceof FormData)
                    ? { 'Content-Type': 'application/json' }
                    : {}),
            },
            body:
                body instanceof FormData
                    ? body
                    : body
                      ? JSON.stringify(body)
                      : undefined,
            signal: AbortSignal.timeout(120000),
        });

    async function selfUpdate() {
        const response = await api('GET', '/paquete');
        if (!response.ok) return;
        const { version: next, files } = await response.json();
        if (!next || next === version) return;
        for (const [name, content] of Object.entries(files)) {
            const target = join(here, name);
            if (!target.startsWith(here)) continue;
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, content);
        }
        writeFileSync(versionFile, next);
        log(`Actualizado a la versión ${next}; reiniciando.`);
        await closeAll();
        spawn(process.execPath, [join(here, 'cuaderno-agent.mjs')], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        }).unref();
        process.exit(0);
    }

    async function handle(task) {
        try {
            const result = await perform(task.action, task.payload ?? {});
            // Official PDFs saved by the engine travel as files, then are removed here.
            if (result?.pdf?.path) {
                const file = join(dataDir, result.pdf.path);
                const form = new FormData();
                form.append('path', result.pdf.path);
                form.append('archivo', await openAsBlob(file), 'documento.pdf');
                const upload = await api(
                    'POST',
                    `/tareas/${task.id}/archivo`,
                    form,
                );
                rmSync(file, { force: true });
                if (!upload.ok) throw new Error('upload_failed');
            }
            await api('POST', `/tareas/${task.id}/resultado`, {
                status: 'completada',
                result,
            });
        } catch (error) {
            const code = /^[a-z_]+$/.test(error.message)
                ? error.message
                : 'connector_failed';
            await api('POST', `/tareas/${task.id}/resultado`, {
                status: 'fallida',
                error: code,
            }).catch(() => {});
        }
    }

    log(`Conector ${version} listo; esperando tareas de ${servidor}.`);
    let running = 0;
    let failures = 0;
    let lastTask = 0;
    let updateChecked = false;
    for (;;) {
        try {
            if (running < MAX_PARALLEL) {
                const response = await api('GET', '/tareas');
                if (response.status === 401) {
                    log(
                        'Este conector fue revocado en Costos. Vuelve a instalarlo.',
                    );
                    await closeAll();
                    process.exit(2);
                }
                const serverVersion = response.headers.get(
                    'x-agente-version-servidor',
                );
                if (response.status === 200) {
                    const task = await response.json();
                    running++;
                    lastTask = Date.now();
                    void handle(task).finally(() => running--);
                    failures = 0;
                    continue;
                }
                failures = response.ok ? 0 : failures + 1;
                // Update only while idle, so no task is interrupted.
                if (
                    serverVersion &&
                    serverVersion !== version &&
                    version !== 'dev' &&
                    running === 0 &&
                    !updateChecked
                ) {
                    updateChecked = true;
                    await selfUpdate();
                }
            }
        } catch {
            failures++;
        }
        const recent = running > 0 || Date.now() - lastTask < 120000;
        await delay(
            failures ? Math.min(30000, 2000 * failures) : recent ? 1000 : 3000,
        );
    }
}

const code = argument('--emparejar');
if (code) {
    try {
        await pair(code, argument('--servidor'));
    } catch (error) {
        log(`No se pudo enlazar: ${error.message}`);
        process.exitCode = 1;
    }
} else {
    process.on('SIGINT', async () => {
        await closeAll();
        process.exit(0);
    });
    await run();
}
