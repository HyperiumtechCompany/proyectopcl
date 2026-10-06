// Browser engine of the Cuaderno connector: drives the official OECE portal in an
// invisible Chrome/Edge. Used by the local HTTP runner and by the remote agent.
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Browser } from './browser.mjs';
import {
    inspectPortal,
    fillLogin,
    selectNotebook,
    changePage,
    clearFilters,
    outlinePortal,
    followInboxLink,
    describeScreen,
    applyScreen,
    clickRowAction,
    readDetail,
    clickNewEntry,
    followSwitchLink,
} from './dom.mjs';

const sessions = new Map();
const busy = new Set();
const jobs = new Map();
// dataDir holds the private browser profiles and downloads of this computer.
// Invisible browser by default; headless=false shows the window for debugging.
const settings = { dataDir: null, headless: true, idleMinutes: 10 };
const profileDir = (id) => join(settings.dataDir, 'cuaderno-browser', id);
const launch = (id) =>
    Browser.open(profileDir(id), {
        headless: settings.headless,
        lowMemory: true,
    });
const fingerprint = (value) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function snapshot(session) {
    const result = await session.browser.evaluate(inspectPortal);
    if (result.state === 'selection') {
        session.choices = result.choices.map((choice) => ({
            ...choice,
            key: fingerprint(choice),
        }));
        return {
            ...result,
            choices: session.choices.map(({ key, label }) => ({ key, label })),
        };
    }
    return result;
}

async function settledSnapshot(session) {
    for (let attempt = 0; attempt < 10; attempt++) {
        await delay(400);
        const result = await snapshot(session);
        if (['ready', 'selection', 'login'].includes(result.state))
            return result;
    }
    return snapshot(session);
}

// After "Ingresar" the login form stays visible for a moment; wait for the portal to answer.
async function loginOutcome(session) {
    let result;
    for (let attempt = 0; attempt < 24; attempt++) {
        await delay(500);
        result = await snapshot(session);
        if (result.state !== 'login' || result.message) break;
    }
    if (result.state === 'intervention' && result.authenticated)
        return openInbox(session);
    return result;
}

const EXPIRED = {
    state: 'login',
    message: 'La sesión de OECE expiró. Vuelve a conectar tu cuenta.',
};

async function openInbox(session) {
    if (!(await session.browser.evaluate(followInboxLink))) {
        await session.browser.navigate(
            'https://apps.oece.gob.pe/cuaderno-obra/bandeja-asientos',
        );
    }
    let page = await settledSnapshot(session);
    for (let attempt = 0; attempt < 8 && page.stale; attempt++) {
        await delay(500);
        page = await snapshot(session);
    }
    if (!page.stale) return page;
    // A half-loaded inbox (expired token restored from storage): "Inicio" makes the
    // portal check the session itself and redirect to its login when it expired.
    await session.browser.navigate(
        'https://apps.oece.gob.pe/cuaderno-obra/bandeja',
    );
    page = await settledSnapshot(session);
    if (page.state === 'intervention' && page.authenticated && !page.stale) {
        await session.browser.evaluate(followInboxLink);
        page = await settledSnapshot(session);
    }
    return page.stale ? EXPIRED : page;
}

// Fills the official login form when it is shown; null when there is no form.
async function submitLogin(session, usuario, password) {
    for (let attempt = 0; attempt < 20; attempt++) {
        await delay(300);
        if (await session.browser.evaluate(fillLogin, { usuario, password }))
            return loginOutcome(session);
    }
    return null;
}

async function waitForPage(session, previous) {
    for (let attempt = 0; attempt < 20; attempt++) {
        await delay(300);
        const result = await snapshot(session);
        if (result.state !== 'ready') throw new Error('session_expired');
        if (fingerprint(result.rows) !== previous) return result;
    }
    throw new Error('pagination_not_changed');
}

// Background crawl of every inbox page; Laravel polls its progress.
async function crawl(session, job) {
    const current = await snapshot(session);
    if (current.state === 'selection' || current.state === 'login')
        return current;
    let page = await openInbox(session);
    if (page.state !== 'ready') return page;
    await session.browser.evaluate(clearFilters);
    await delay(600);
    page = await snapshot(session);
    if (page.state !== 'ready') return page;
    const identityFingerprint = fingerprint(page.identity);
    job.total = page.total;
    // Start at the first page even when the holder browsed the notebook manually.
    for (let attempt = 0; ; attempt++) {
        if (attempt === 1000) throw new Error('pagination_limit');
        const previous = fingerprint(page.rows);
        if (!(await session.browser.evaluate(changePage, 'previous'))) break;
        page = await waitForPage(session, previous);
    }
    const seen = new Set();
    const deadline = Date.now() + 15 * 60 * 1000;
    for (;;) {
        if (job.cancelled) throw new Error('sync_cancelled');
        if (Date.now() > deadline || seen.size >= 1000)
            throw new Error('pagination_limit');
        if (fingerprint(page.identity) !== identityFingerprint)
            throw new Error('notebook_changed');
        const signature = fingerprint(page.rows);
        if (seen.has(signature)) throw new Error('pagination_repeated');
        seen.add(signature);
        job.page = seen.size;
        job.total = page.total;
        for (const row of page.rows) job.rows.set(row.numero, row);
        if (!(await session.browser.evaluate(changePage, 'next'))) break;
        page = await waitForPage(session, signature);
    }
    return {
        state: 'ready',
        identity: page.identity,
        rows: [...job.rows.values()],
        total: page.total,
        complete: job.rows.size === page.total,
    };
}

const progress = (job) => ({
    state: 'syncing',
    progress: { page: job.page, rows: job.rows.size, total: job.total },
});

function startSync(session, id) {
    const job = {
        rows: new Map(),
        page: 0,
        total: null,
        done: false,
        cancelled: false,
    };
    jobs.set(id, job);
    busy.add(id);
    crawl(session, job)
        .then((result) => (job.result = result))
        .catch((error) => {
            job.error = /^[a-z_]+$/.test(error.message)
                ? error.message
                : 'connector_failed';
        })
        .finally(() => {
            job.done = true;
            busy.delete(id);
        });
    return progress(job);
}

function cancelSync(id) {
    const job = jobs.get(id);
    if (job) job.cancelled = true;
    jobs.delete(id);
    busy.delete(id);
}

// Reopens a browser closed by inactivity or a restart, reusing its private profile
// (cookies and trusted device), so the holder rarely has to sign in again.
async function ensureSession(id) {
    let session = sessions.get(id);
    if (session?.browser.closed) {
        sessions.delete(id);
        session = null;
    }
    if (!session) {
        if (!existsSync(profileDir(id))) throw new Error('session_missing');
        session = { browser: await launch(id) };
        sessions.set(id, session);
        await session.browser.navigate(
            'https://apps.oece.gob.pe/cuaderno-obra/bandeja',
        );
        await settledSnapshot(session);
    }
    session.lastUsed = Date.now();
    return session;
}

async function describe(session, withShot) {
    const screen = await session.browser.evaluate(describeScreen);
    const viewport = await session.browser.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
    }));
    return {
        ...screen,
        viewport,
        shot: withShot ? await session.browser.screenshot() : null,
    };
}

async function interact(session, input) {
    if (input.kind === 'form') {
        const fields = Array.isArray(input.fields) ? input.fields : [];
        if (
            fields.length > 60 ||
            fields.some(
                (field) =>
                    !Number.isInteger(field?.ref) ||
                    (field.value !== undefined &&
                        field.value !== null &&
                        (typeof field.value !== 'string' ||
                            field.value.length > 2000)),
            ) ||
            (input.submit != null && !Number.isInteger(input.submit))
        )
            throw new Error('invalid_request');
        const result = await session.browser.evaluate(applyScreen, {
            fields,
            submit: input.submit ?? null,
        });
        if (result !== 'ok') throw new Error(result);
    } else if (input.kind === 'click') {
        const { x, y } = input;
        if (
            ![x, y].every(
                (value) =>
                    Number.isFinite(value) && value >= 0 && value <= 4000,
            )
        )
            throw new Error('invalid_request');
        await session.browser.click(x, y);
    } else if (input.kind === 'type') {
        if (typeof input.text !== 'string' || input.text.length > 2000)
            throw new Error('invalid_request');
        await session.browser.typeText(input.text);
    } else if (input.kind === 'key') {
        if (!['Enter', 'Tab', 'Backspace', 'Escape'].includes(input.key))
            throw new Error('invalid_request');
        await session.browser.pressKey(input.key);
    } else {
        throw new Error('invalid_action');
    }
    await delay(1200);
}

// The inbox list loads after a search; "Limpiar" reloads every row.
async function ensureInboxRows(session) {
    let page = await snapshot(session);
    if (page.state === 'login' || page.state === 'selection') return page;
    if (page.state !== 'ready' || !page.rows.length) {
        page = await openInbox(session);
        for (
            let attempt = 0;
            attempt < 20 && page.state !== 'login' && !page.rows?.length;
            attempt++
        ) {
            if (attempt === 0 || attempt === 10)
                await session.browser.evaluate(clearFilters);
            await delay(500);
            page = await snapshot(session);
        }
    }
    return page;
}

const DETAIL_FIELDS = {
    titulo: 'Título',
    tipo: 'Tipo de Asiento',
    descripcion: 'Descripción',
    referencia: 'Asiento de referencia',
    fecha: 'Fecha y hora',
    usuario: 'Usuario',
    rol: 'Rol',
    latitud: 'Latitud',
    longitud: 'Longitud',
};

// Official PDF (row button) and full detail (eye button) of one numbered entry.
async function fetchEntry(session, id, numero, withPdf, withDetail) {
    const page = await ensureInboxRows(session);
    if (page.state !== 'ready') return page;
    const row = page.rows.find((item) => item.numero === String(numero));
    if (!row) throw new Error('asiento_not_found');
    let pdf = null;
    if (withPdf) {
        const guid = await session.browser.captureDownload(
            join(settings.dataDir, 'cuaderno-downloads', id),
            async () => {
                if (
                    !(await session.browser.evaluate(clickRowAction, {
                        numero,
                        icon: 'fa-file-pdf',
                    }))
                )
                    throw new Error('asiento_not_found');
            },
        );
        pdf = { path: `cuaderno-downloads/${id}/${guid}` };
    }
    // "Solo PDF": stays on the inbox, much faster for large notebooks.
    if (!withDetail) {
        return {
            state: 'ready',
            identity: page.identity,
            asiento: { numero, titulo: row.titulo },
            pdf,
        };
    }
    if (
        !(await session.browser.evaluate(clickRowAction, {
            numero,
            icon: 'fa-eye',
        }))
    )
        throw new Error('asiento_not_found');
    let detail = null;
    for (let attempt = 0; attempt < 30 && !detail; attempt++) {
        await delay(300);
        const state = await snapshot(session);
        if (state.state === 'login') return state;
        detail = await session.browser.evaluate(readDetail);
    }
    if (!detail) throw new Error('portal_structure_changed');
    await session.browser.evaluate(followInboxLink);
    const values = detail.values;
    return {
        state: 'ready',
        identity: {
            entidad: values['Entidad contratante'] ?? '',
            obra: values['Obra'] ?? '',
            codigo_cui:
                values['Obra']?.match(/CUI\s*(?:N[°ºo.]*)?\s*(\d{7})/i)?.[1] ??
                null,
        },
        asiento: {
            numero,
            external_id: detail.external_id,
            ...Object.fromEntries(
                Object.entries(DETAIL_FIELDS).map(([key, label]) => [
                    key,
                    values[label] ?? '',
                ]),
            ),
        },
        pdf,
    };
}

// Read-only exploration of screens not mapped yet: opens them, records which requests the
// portal makes (method and URL only) and returns to the inbox without submitting anything.
async function exploreTarget(session, target, numero) {
    const page = await ensureInboxRows(session);
    if (page.state !== 'ready') return null;
    const requests = [];
    const stop = session.browser.on('Network.requestWillBeSent', (event) => {
        const url = new URL(event.request.url);
        if (!/\.(js|css|png|jpe?g|svg|woff2?)$/.test(url.pathname))
            requests.push(
                `${event.request.method} ${url.origin}${url.pathname}`,
            );
    });
    try {
        const opened =
            target === 'nuevo'
                ? await session.browser.evaluate(clickNewEntry)
                : await session.browser.evaluate(clickRowAction, {
                      numero: numero ?? page.rows[0]?.numero,
                      icon: 'fa-paperclip',
                  });
        if (!opened) throw new Error('asiento_not_found');
        await delay(3000);
        const outline = await session.browser.evaluate(outlinePortal);
        return { ...outline, target, requests };
    } finally {
        stop();
        await session.browser.pressKey('Escape').catch(() => {});
        await session.browser.evaluate(followInboxLink).catch(() => {});
    }
}

export async function perform(action, input) {
    if (!/^[a-f0-9-]{36}$/.test(input.session ?? ''))
        throw new Error('invalid_session');
    const id = input.session;
    const job = jobs.get(id);
    if (action === 'sync' && job) {
        delete input.password;
        if (!job.done) return progress(job);
        jobs.delete(id);
        if (job.error) throw new Error(job.error);
        return job.result;
    }
    if (action === 'connect' || action === 'disconnect') cancelSync(id);
    else if (busy.has(id)) throw new Error('operation_busy');
    busy.add(id);
    let background = false;
    try {
        let session = sessions.get(id);
        if (action === 'connect') {
            if (
                typeof input.usuario !== 'string' ||
                !input.usuario.trim() ||
                input.usuario.length > 100 ||
                typeof input.password !== 'string' ||
                !input.password ||
                input.password.length > 255
            )
                throw new Error('invalid_credentials');
            if (session) await session.browser.close();
            session = { browser: await launch(id), lastUsed: Date.now() };
            sessions.set(id, session);
            const login = 'https://apps.oece.gob.pe/cuaderno-obra/login';
            await session.browser.navigate(login);
            const signed = await submitLogin(
                session,
                input.usuario,
                input.password,
            );
            if (signed) return signed;
            // The profile restored a stored session: check that it is really alive.
            let existing = await snapshot(session);
            if (existing.state === 'intervention' && existing.authenticated)
                existing = await openInbox(session);
            if (existing.state !== 'login') return existing;
            // It expired: sign in again with the credentials just typed.
            await session.browser.navigate(login);
            const again = await submitLogin(
                session,
                input.usuario,
                input.password,
            );
            if (again) return again;
            throw new Error('login_form_not_found');
        }
        if (!session && action === 'disconnect')
            return { state: 'disconnected' };
        if (action !== 'disconnect') session = await ensureSession(id);
        if (action === 'disconnect') {
            await session.browser.close();
            sessions.delete(id);
            return { state: 'disconnected' };
        }
        if (action === 'inspect') {
            const result = await snapshot(session);
            return result.state === 'intervention' && result.authenticated
                ? await openInbox(session)
                : result;
        }
        if (action === 'screen' || action === 'interact') {
            if (action === 'interact') await interact(session, input);
            let state = await snapshot(session);
            if (state.state === 'intervention' && state.authenticated)
                state = await openInbox(session);
            const { rows: _rows, ...rest } = state;
            return {
                ...rest,
                screen: await describe(session, input.shot === true),
            };
        }
        if (action === 'asiento') {
            if (!Number.isInteger(input.numero) || input.numero < 1)
                throw new Error('invalid_request');
            return await fetchEntry(
                session,
                id,
                input.numero,
                input.pdf !== false,
                input.detalle !== false,
            );
        }
        if (action === 'capture') {
            const outline = ['nuevo', 'adjuntos'].includes(input.target)
                ? await exploreTarget(
                      session,
                      input.target,
                      Number.isInteger(input.numero) ? input.numero : null,
                  )
                : await session.browser.evaluate(outlinePortal);
            const { rows: _rows, ...state } = await snapshot(session);
            return { ...state, outline };
        }
        if (action === 'switch') {
            if (!(await session.browser.evaluate(followSwitchLink))) {
                await session.browser.navigate(
                    'https://apps.oece.gob.pe/cuaderno-obra/seleccionar-login',
                );
            }
            return await settledSnapshot(session);
        }
        if (action === 'select') {
            const choice = session.choices?.find(
                (item) => item.key === input.choice,
            );
            if (
                !choice ||
                !(await session.browser.evaluate(selectNotebook, choice))
            )
                throw new Error('selection_changed');
            const result = await settledSnapshot(session);
            return result.state === 'intervention' && result.authenticated
                ? await openInbox(session)
                : result;
        }
        if (action === 'sync') {
            background = true;
            return startSync(session, id);
        }
        if (action !== 'preview') throw new Error('invalid_action');
        const current = await snapshot(session);
        if (current.state === 'selection' || current.state === 'login')
            return current;
        const page = await openInbox(session);
        return page.state === 'ready'
            ? { state: 'ready', identity: page.identity }
            : page;
    } finally {
        // A started sync keeps the session busy until its crawl finishes.
        if (!background) busy.delete(id);
        delete input.password;
    }
}

/** dataDir: folder for the private browser profiles and downloads (required). */
export function configureEngine({
    dataDir,
    headless = true,
    idleMinutes = 10,
}) {
    settings.dataDir = dataDir;
    settings.headless = headless;
    settings.idleMinutes = idleMinutes;
    // Frees RAM: closes browsers left idle; the next request reopens them with the same profile.
    setInterval(async () => {
        for (const [id, session] of sessions) {
            if (
                busy.has(id) ||
                jobs.has(id) ||
                Date.now() - (session.lastUsed ?? 0) <
                    settings.idleMinutes * 60000
            )
                continue;
            sessions.delete(id);
            await session.browser.close().catch(() => {});
        }
    }, 60000).unref();
}

export async function closeAll() {
    await Promise.allSettled(
        [...sessions.values()].map((session) => session.browser.close()),
    );
}
