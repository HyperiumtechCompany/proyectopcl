// Offline check of the extension executor (extension/cuaderno/executor.js) on a real headless
// Chrome: a minimal chrome.* shim drives one tab whose pages are synthetic copies of the
// observed portal screens. Covers sign-in on the holder's tab, sync, PDF capture, detail
// and change of work.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Browser } from './cuaderno/browser.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));
const root = dirname(scripts);
const info = (label, value) =>
    `<utils-info-row><section-label>${label}</section-label><section-value>${value}</section-value></utils-info-row>`;
const identity =
    info('Entidad contratante:', 'Entidad piloto') +
    info('Obra:', 'Obra piloto CUI N° 2458710');
const row = (numero, titulo) =>
    `<mat-row><mat-cell class="mat-column-num">${numero}</mat-cell><mat-cell class="mat-column-titulo">${titulo}</mat-cell><mat-cell class="mat-column-tipo">CONSULTA</mat-cell><mat-cell class="mat-column-fecha">03/10/2026 09:16 PM</mat-cell><mat-cell class="mat-column-usuario">Usuario</mat-cell><mat-cell class="mat-column-rol">SUPERVISOR</mat-cell><mat-cell class="mat-column-estado">DEFINITIVO</mat-cell><mat-cell class="mat-column-acciones"><button onclick="location.href='/cuaderno-obra/operaciones/detalle-asiento/3450bb3e-5d8f-4cd2-a3a0-07116ea0b459'"><mat-icon class="fas fa-eye"></mat-icon></button><button onclick="const a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob(['%PDF-1.5 asiento ${numero}'],{type:'application/pdf'}));a.download='x.pdf';a.click()"><mat-icon class="fas fa-file-pdf"></mat-icon></button></mat-cell></mat-row>`;
const fixtures = {
    login: '<input formcontrolname="usuario"><input formcontrolname="clave" type="password">',
    bandeja:
        '<a href="/cuaderno-obra/bandeja-asientos">Lista de asientos</a><a href="/cuaderno-obra/seleccionar-login">Cambiar a otra obra</a>',
    'bandeja-asientos': `${identity}<a href="/cuaderno-obra/seleccionar-login">Cambiar a otra obra</a><p>Lista total de asientos: 2</p>${row(2, 'Absolución de consulta')}${row(1, 'Consulta de diseño')}`,
    '3450bb3e-5d8f-4cd2-a3a0-07116ea0b459': `${identity}${info('Título:', 'Absolución de consulta')}${info('Descripción:', 'Texto completo del asiento')}${info('Asiento de referencia:', '1')}<a href="/cuaderno-obra/bandeja-asientos">Bandeja de asientos</a>`,
    'seleccionar-login':
        '<div><input type="radio" name="n">Entidad piloto SUPERVISOR Obra uno CUI N° 2458710</div><div><input type="radio" name="n">Entidad piloto SUPERVISOR Obra dos CUI N° 2444383</div><button>Siguiente</button>',
};

const profile = mkdtempSync(join(tmpdir(), 'proyectopcl-extension-smoke-'));
const extension = mkdtempSync(join(tmpdir(), 'proyectopcl-extension-code-'));
let browser;
try {
    browser = await Browser.open(profile, { headless: true, lowMemory: true });
    browser.on('Fetch.requestPaused', (event) => {
        const path = new URL(event.request.url).pathname.split('/').at(-1);
        void browser.send(
            'Fetch.fulfillRequest',
            {
                requestId: event.requestId,
                responseCode: 200,
                responseHeaders: [
                    { name: 'Content-Type', value: 'text/html; charset=utf-8' },
                ],
                body: Buffer.from(fixtures[path] ?? '<html></html>').toString(
                    'base64',
                ),
            },
            browser.sessionId,
        );
    });
    await browser.send(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*' }] },
        browser.sessionId,
    );

    // Minimal chrome.* API backed by the single real tab.
    let open = false;
    const tab = async () => ({
        id: 1,
        windowId: 1,
        status: 'complete',
        url: open ? await browser.evaluate(() => location.href) : undefined,
    });
    const go = async (url) => {
        open = true;
        await browser.navigate(url);
        await delay(250);
    };
    globalThis.chrome = {
        tabs: {
            get: async () => tab(),
            query: async () => (open ? [await tab()] : []),
            create: async ({ url }) => (await go(url), tab()),
            update: async (_id, { url }) => (url && (await go(url)), tab()),
        },
        windows: { update: async () => ({}) },
        scripting: {
            executeScript: async ({ func, args }) => [
                { result: await browser.evaluate(func, args[0]) },
            ],
        },
    };

    copyFileSync(
        join(root, 'extension/cuaderno/executor.js'),
        join(extension, 'executor.js'),
    );
    copyFileSync(join(scripts, 'cuaderno/dom.mjs'), join(extension, 'dom.js'));
    const { perform } = await import(
        pathToFileURL(join(extension, 'executor.js')).href
    );
    const session = '11111111-1111-4111-8111-111111111111';

    // Connect opens the portal on the holder's tab and lands on the inbox when signed in.
    const connected = await perform('connect', { session });
    assert.equal(connected.state, 'ready');
    assert.equal(connected.identity.codigo_cui, '2458710');

    // A login screen asks to sign in on the OECE tab, never for credentials in Costos.
    await go('https://apps.oece.gob.pe/cuaderno-obra/login');
    const login = await perform('inspect', { session });
    assert.equal(login.state, 'intervention');
    assert.match(login.message, /pestaña de OECE/);
    // The holder signs in on that tab; the portal lands on its home page.
    await go('https://apps.oece.gob.pe/cuaderno-obra/bandeja');

    // Background sync with progress, then the final result.
    let sync = await perform('sync', { session });
    for (let attempt = 0; attempt < 40 && sync.state === 'syncing'; attempt++) {
        await delay(250);
        sync = await perform('sync', { session });
    }
    assert.equal(sync.state, 'ready');
    assert.equal(sync.complete, true);
    assert.deepEqual(sync.rows.map((item) => item.numero).sort(), ['1', '2']);

    // Official PDF captured from the portal's own blob (not saved to Downloads) + detail.
    const entry = await perform('asiento', { session, numero: 2 });
    assert.equal(
        Buffer.from(entry.pdf.base64, 'base64').toString(),
        '%PDF-1.5 asiento 2',
    );
    assert.equal(
        entry.asiento.external_id,
        '3450bb3e-5d8f-4cd2-a3a0-07116ea0b459',
    );
    assert.equal(entry.asiento.descripcion, 'Texto completo del asiento');
    assert.equal(
        await browser.evaluate(() =>
            URL.createObjectURL.toString().includes('[native code]'),
        ),
        true,
    );

    // PDF only stays on the inbox.
    const quick = await perform('asiento', {
        session,
        numero: 1,
        detalle: false,
    });
    assert.equal(
        Buffer.from(quick.pdf.base64, 'base64').toString(),
        '%PDF-1.5 asiento 1',
    );
    assert.equal(quick.asiento.titulo, 'Consulta de diseño');

    // Change of work opens the official selection.
    const choose = await perform('switch', { session });
    assert.equal(choose.state, 'selection');
    assert.equal(choose.choices.length, 2);

    process.stdout.write(
        'Extension smoke passed: connect, sign-in on the holder tab, sync, PDF capture, detail, PDF only and change of work.\n',
    );
} finally {
    if (browser) await browser.close();
    await delay(400);
    rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
    });
    rmSync(extension, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
    });
}
