// Service worker of the "Asistente del Cuaderno" extension. While a Costos tab is open it
// takes the holder's Cuaderno tasks from Costos (same protocol as the desktop connector),
// runs them on the holder's own OECE tab and sends back results and official PDFs.
import { focusPortal, perform } from './executor.js';

const VERSION = chrome.runtime.getManifest().version;
const ports = new Map();
const loops = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tokenFor(origin) {
    const { agents = {} } = await chrome.storage.local.get('agents');
    return agents[origin]?.token ?? null;
}

async function saveToken(origin, token) {
    const { agents = {} } = await chrome.storage.local.get('agents');
    if (token) agents[origin] = { token };
    else delete agents[origin];
    await chrome.storage.local.set({ agents });
}

function broadcast(origin, message) {
    for (const port of ports.get(origin) ?? []) {
        try {
            port.postMessage(message);
        } catch {
            // The tab was closed meanwhile.
        }
    }
}

const browserLabel = () => {
    const brand = navigator.userAgent.includes('Edg/') ? 'Edge' : 'Chrome';
    const platform =
        navigator.userAgentData?.platform || navigator.platform || '';
    return `${brand} · ${platform}`.slice(0, 120);
};

async function pair(origin, codigo) {
    const response = await fetch(`${origin}/api/cuaderno-agente/emparejar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            codigo,
            nombre: browserLabel(),
            plataforma: navigator.userAgent.slice(0, 120),
            version: VERSION,
            tipo: 'extension',
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.token)
        throw new Error(body.message ?? 'No se pudo enlazar el asistente.');
    await saveToken(origin, body.token);
    startLoop(origin);
}

function api(origin, token, method, path, body) {
    return fetch(`${origin}/api/cuaderno-agente${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'X-Agente-Version': VERSION,
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
    });
}

async function handle(origin, token, task) {
    try {
        const result = await perform(task.action, task.payload ?? {});
        // The official PDF travels as a file, into the folder of this task's session.
        if (result?.pdf?.base64) {
            const path = `cuaderno-downloads/${task.payload.session}/${crypto.randomUUID()}`;
            const bytes = Uint8Array.from(atob(result.pdf.base64), (char) =>
                char.charCodeAt(0),
            );
            const form = new FormData();
            form.append('path', path);
            form.append(
                'archivo',
                new Blob([bytes], { type: 'application/pdf' }),
                'documento.pdf',
            );
            const upload = await api(
                origin,
                token,
                'POST',
                `/tareas/${task.id}/archivo`,
                form,
            );
            if (!upload.ok) throw new Error('upload_failed');
            result.pdf = { path };
        }
        await api(origin, token, 'POST', `/tareas/${task.id}/resultado`, {
            status: 'completada',
            result,
        });
    } catch (error) {
        const code = /^[a-z_]+$/.test(error.message)
            ? error.message
            : 'connector_failed';
        await api(origin, token, 'POST', `/tareas/${task.id}/resultado`, {
            status: 'fallida',
            error: code,
        }).catch(() => {});
    }
}

/** Polls Costos for tasks while at least one Costos tab of that site is open. */
async function startLoop(origin) {
    if (loops.has(origin)) return;
    loops.add(origin);
    let running = 0;
    let failures = 0;
    let lastTask = 0;
    try {
        while (ports.get(origin)?.size) {
            const token = await tokenFor(origin);
            if (!token) {
                broadcast(origin, {
                    type: 'status',
                    paired: false,
                    version: VERSION,
                });
                break;
            }
            try {
                if (running < 2) {
                    const response = await api(origin, token, 'GET', '/tareas');
                    if (response.status === 401) {
                        await saveToken(origin, null);
                        broadcast(origin, {
                            type: 'status',
                            paired: false,
                            version: VERSION,
                        });
                        break;
                    }
                    if (response.status === 200) {
                        const task = await response.json();
                        running++;
                        lastTask = Date.now();
                        handle(origin, token, task).finally(() => running--);
                        failures = 0;
                        continue;
                    }
                    failures = response.ok ? 0 : failures + 1;
                }
            } catch {
                failures++;
            }
            const recent = running > 0 || Date.now() - lastTask < 120000;
            await delay(
                failures
                    ? Math.min(20000, 2000 * failures)
                    : recent
                      ? 1000
                      : 2500,
            );
        }
    } finally {
        loops.delete(origin);
    }
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'costos-cuaderno' || !port.sender?.url) return;
    const origin = new URL(port.sender.url).origin;
    if (!ports.has(origin)) ports.set(origin, new Set());
    ports.get(origin).add(port);
    port.onDisconnect.addListener(() => ports.get(origin)?.delete(port));
    port.onMessage.addListener(async (message) => {
        if (message?.type === 'pair') {
            try {
                await pair(origin, message.codigo);
                port.postMessage({
                    type: 'status',
                    paired: true,
                    version: VERSION,
                });
            } catch (error) {
                port.postMessage({
                    type: 'pair-error',
                    message: error.message,
                });
            }
        } else if (message?.type === 'focus') {
            await focusPortal();
        } else if (message?.type === 'status') {
            port.postMessage({
                type: 'status',
                paired: Boolean(await tokenFor(origin)),
                version: VERSION,
            });
        }
        // "ping" messages only keep this worker awake while Costos is open.
    });
    tokenFor(origin).then((token) => {
        port.postMessage({
            type: 'status',
            paired: Boolean(token),
            version: VERSION,
        });
        if (token) startLoop(origin);
    });
});
