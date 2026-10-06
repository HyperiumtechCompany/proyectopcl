// Runs Cuaderno tasks on the holder's own OECE tab (the browser where they signed in).
// Same steps as scripts/cuaderno/engine.mjs, using chrome.scripting instead of a separate
// browser. The page functions come from dom.js (copy of scripts/cuaderno/dom.mjs).
import {
    applyScreen,
    changePage,
    clearFilters,
    clickRowAction,
    describeScreen,
    followInboxLink,
    followSwitchLink,
    inspectPortal,
    outlinePortal,
    readDetail,
    selectNotebook,
} from './dom.js';

const PORTAL = 'https://apps.oece.gob.pe/cuaderno-obra/';
const sessions = new Map();
const jobs = new Map();
const busy = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fingerprint(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/** The OECE tab of this session: the one already open, or a new one. */
async function portalTab(id, { focus = false } = {}) {
    const session = sessions.get(id) ?? {};
    sessions.set(id, session);
    let tab = session.tabId
        ? await chrome.tabs.get(session.tabId).catch(() => null)
        : null;
    if (!tab?.url?.startsWith(PORTAL)) {
        [tab] = await chrome.tabs.query({ url: `${PORTAL}*` });
    }
    if (!tab) {
        tab = await chrome.tabs.create({
            url: `${PORTAL}bandeja`,
            active: focus,
        });
        await waitForLoad(tab.id);
    } else if (focus) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows
            .update(tab.windowId, { focused: true })
            .catch(() => {});
    }
    session.tabId = tab.id;
    return { session, tabId: tab.id };
}

export async function focusPortal() {
    const [tab] = await chrome.tabs.query({ url: `${PORTAL}*` });
    if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows
            .update(tab.windowId, { focused: true })
            .catch(() => {});
        return true;
    }
    await chrome.tabs.create({ url: `${PORTAL}login`, active: true });
    return true;
}

async function waitForLoad(tabId) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) throw new Error('browser_closed');
        if (tab.status === 'complete') return;
        await delay(250);
    }
}

// Pages outside OECE (RENIEC / ID Perú sign-in) or a tab mid-navigation cannot be read:
// that counts as "still signing in", never as an error.
async function evaluate(tabId, func, arg = null, world = 'ISOLATED') {
    try {
        const [frame] = await chrome.scripting.executeScript({
            target: { tabId },
            func,
            args: [arg],
            world,
        });
        return frame?.result;
    } catch {
        return undefined;
    }
}

async function navigate(tabId, url) {
    await chrome.tabs.update(tabId, { url });
    await delay(300);
    await waitForLoad(tabId);
}

// Signing in happens on the holder's tab, never in Costos: a login screen is an
// intervention ("sign in on the OECE tab"), not a credentials form.
function forHolder(result) {
    if (result?.state !== 'login') return result;
    return {
        state: 'intervention',
        authenticated: false,
        message: result.blocked
            ? result.message
            : 'Inicia sesión en la pestaña de OECE con tu usuario y tu verificación de siempre.',
    };
}

async function snapshot(context) {
    const result = await evaluate(context.tabId, inspectPortal);
    if (result?.state === 'selection') {
        context.session.choices = await Promise.all(
            result.choices.map(async (choice) => ({
                ...choice,
                key: await fingerprint(choice),
            })),
        );
        return {
            ...result,
            choices: context.session.choices.map(({ key, label }) => ({
                key,
                label,
            })),
        };
    }
    return (
        result ?? {
            state: 'intervention',
            message: 'Completa el ingreso en la pestaña de OECE.',
        }
    );
}

async function settledSnapshot(context) {
    for (let attempt = 0; attempt < 10; attempt++) {
        await delay(400);
        const result = await snapshot(context);
        if (['ready', 'selection', 'login'].includes(result.state))
            return result;
    }
    return snapshot(context);
}

async function openInbox(context) {
    if (!(await evaluate(context.tabId, followInboxLink))) {
        await navigate(context.tabId, `${PORTAL}bandeja-asientos`);
    }
    let page = await settledSnapshot(context);
    for (let attempt = 0; attempt < 8 && page.stale; attempt++) {
        await delay(500);
        page = await snapshot(context);
    }
    if (!page.stale) return page;
    // Half-loaded inbox (expired token): "Inicio" makes the portal check its session.
    await navigate(context.tabId, `${PORTAL}bandeja`);
    page = await settledSnapshot(context);
    if (page.state === 'intervention' && page.authenticated && !page.stale) {
        await evaluate(context.tabId, followInboxLink);
        page = await settledSnapshot(context);
    }
    return page.stale ? { state: 'login' } : page;
}

async function liveState(context) {
    const result = await snapshot(context);
    return result.state === 'intervention' && result.authenticated
        ? openInbox(context)
        : result;
}

async function ensureInboxRows(context) {
    let page = await snapshot(context);
    if (page.state === 'login' || page.state === 'selection') return page;
    if (page.state !== 'ready' || !page.rows.length) {
        page = await openInbox(context);
        for (
            let attempt = 0;
            attempt < 20 && page.state !== 'login' && !page.rows?.length;
            attempt++
        ) {
            if (attempt === 0 || attempt === 10)
                await evaluate(context.tabId, clearFilters);
            await delay(500);
            page = await snapshot(context);
        }
    }
    return page;
}

async function waitForPage(context, previous) {
    for (let attempt = 0; attempt < 20; attempt++) {
        await delay(300);
        const result = await snapshot(context);
        if (result.state !== 'ready') throw new Error('session_expired');
        if ((await fingerprint(result.rows)) !== previous) return result;
    }
    throw new Error('pagination_not_changed');
}

async function crawl(context, job) {
    let page = await ensureInboxRows(context);
    if (page.state !== 'ready') return page;
    await evaluate(context.tabId, clearFilters);
    await delay(600);
    page = await snapshot(context);
    if (page.state !== 'ready') return page;
    const identity = await fingerprint(page.identity);
    for (let attempt = 0; ; attempt++) {
        if (attempt === 1000) throw new Error('pagination_limit');
        const previous = await fingerprint(page.rows);
        if (!(await evaluate(context.tabId, changePage, 'previous'))) break;
        page = await waitForPage(context, previous);
    }
    const seen = new Set();
    const deadline = Date.now() + 15 * 60 * 1000;
    for (;;) {
        if (job.cancelled) throw new Error('sync_cancelled');
        if (Date.now() > deadline || seen.size >= 1000)
            throw new Error('pagination_limit');
        if ((await fingerprint(page.identity)) !== identity)
            throw new Error('notebook_changed');
        const signature = await fingerprint(page.rows);
        if (seen.has(signature)) throw new Error('pagination_repeated');
        seen.add(signature);
        job.page = seen.size;
        job.total = page.total;
        for (const row of page.rows) job.rows.set(row.numero, row);
        if (!(await evaluate(context.tabId, changePage, 'next'))) break;
        page = await waitForPage(context, signature);
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

// --- Official PDF: the portal builds a Blob and "downloads" it through a link. While a PDF
// is requested from Costos, the Blob is kept for Costos instead of the Downloads folder.
function armCapture() {
    if (window.__costosCapture) return true;
    const capture = {
        blob: null,
        createObjectURL: URL.createObjectURL,
        click: HTMLAnchorElement.prototype.click,
    };
    window.__costosCapture = capture;
    URL.createObjectURL = function (object) {
        if (object instanceof Blob) capture.blob = object;
        return capture.createObjectURL.apply(this, arguments);
    };
    HTMLAnchorElement.prototype.click = function () {
        if (this.download && this.href.startsWith('blob:')) return undefined;
        return capture.click.apply(this, arguments);
    };
    return true;
}

async function takeCapturedBlob() {
    const capture = window.__costosCapture;
    if (!capture?.blob) return null;
    const blob = capture.blob;
    capture.blob = null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
}

function disarmCapture() {
    const capture = window.__costosCapture;
    if (!capture) return true;
    URL.createObjectURL = capture.createObjectURL;
    HTMLAnchorElement.prototype.click = capture.click;
    delete window.__costosCapture;
    return true;
}

let capturing = 0;
// Safety net: downloads started another way while capturing never reach the user's folder.
chrome.downloads?.onCreated.addListener((item) => {
    if (capturing && item.url.startsWith('blob:https://apps.oece.gob.pe')) {
        chrome.downloads
            .cancel(item.id)
            .then(() => chrome.downloads.erase({ id: item.id }))
            .catch(() => {});
    }
});

async function capturePdf(context, numero) {
    capturing++;
    try {
        await evaluate(context.tabId, armCapture, null, 'MAIN');
        if (
            !(await evaluate(context.tabId, clickRowAction, {
                numero,
                icon: 'fa-file-pdf',
            }))
        )
            throw new Error('asiento_not_found');
        for (let attempt = 0; attempt < 90; attempt++) {
            await delay(500);
            const base64 = await evaluate(
                context.tabId,
                takeCapturedBlob,
                null,
                'MAIN',
            );
            if (base64) return base64;
        }
        throw new Error('download_timeout');
    } finally {
        capturing--;
        await evaluate(context.tabId, disarmCapture, null, 'MAIN').catch(
            () => {},
        );
    }
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

async function fetchEntry(context, numero, withPdf, withDetail) {
    const page = await ensureInboxRows(context);
    if (page.state !== 'ready') return page;
    const row = page.rows.find((item) => item.numero === String(numero));
    if (!row) throw new Error('asiento_not_found');
    const pdf = withPdf ? { base64: await capturePdf(context, numero) } : null;
    if (!withDetail) {
        return {
            state: 'ready',
            identity: page.identity,
            asiento: { numero, titulo: row.titulo },
            pdf,
        };
    }
    if (
        !(await evaluate(context.tabId, clickRowAction, {
            numero,
            icon: 'fa-eye',
        }))
    )
        throw new Error('asiento_not_found');
    let detail = null;
    for (let attempt = 0; attempt < 30 && !detail; attempt++) {
        await delay(300);
        const state = await snapshot(context);
        if (state.state === 'login') return state;
        detail = await evaluate(context.tabId, readDetail);
    }
    if (!detail) throw new Error('portal_structure_changed');
    await evaluate(context.tabId, followInboxLink);
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

/** Same actions and answers as the desktop engine, so Costos treats both alike. */
export async function perform(action, input) {
    if (!/^[a-f0-9-]{36}$/.test(input.session ?? ''))
        throw new Error('invalid_session');
    const id = input.session;
    const job = jobs.get(id);
    if (action === 'sync' && job) {
        if (!job.done) return progress(job);
        jobs.delete(id);
        if (job.error) throw new Error(job.error);
        return forHolder(job.result);
    }
    if (action === 'disconnect') {
        if (job) job.cancelled = true;
        jobs.delete(id);
        sessions.delete(id);
        return { state: 'disconnected' };
    }
    if (busy.has(id)) throw new Error('operation_busy');
    busy.add(id);
    let background = false;
    try {
        const context = await portalTab(id, { focus: action === 'connect' });
        if (action === 'connect') {
            // The portal (Angular) needs a moment to render: wait before judging the session,
            // and open its login only when the tab is not on the portal at all.
            const tab = await chrome.tabs.get(context.tabId);
            if (!tab.url?.startsWith(PORTAL))
                await navigate(context.tabId, `${PORTAL}login`);
            const current = await settledSnapshot(context);
            return forHolder(
                current.state === 'intervention' && current.authenticated
                    ? await openInbox(context)
                    : current,
            );
        }
        if (
            action === 'inspect' ||
            action === 'screen' ||
            action === 'interact'
        ) {
            if (action === 'interact' && input.kind === 'form')
                await evaluate(context.tabId, applyScreen, {
                    fields: input.fields ?? [],
                    submit: input.submit ?? null,
                });
            const { rows: _rows, ...state } = forHolder(
                await liveState(context),
            );
            return action === 'inspect'
                ? state
                : {
                      ...state,
                      screen: {
                          ...(await evaluate(context.tabId, describeScreen)),
                          viewport: null,
                          shot: null,
                      },
                  };
        }
        if (action === 'preview') {
            const current = await snapshot(context);
            if (current.state === 'selection' || current.state === 'login')
                return forHolder(current);
            const page = await openInbox(context);
            return page.state === 'ready'
                ? { state: 'ready', identity: page.identity }
                : forHolder(page);
        }
        if (action === 'select') {
            const choice = context.session.choices?.find(
                (item) => item.key === input.choice,
            );
            if (
                !choice ||
                !(await evaluate(context.tabId, selectNotebook, choice))
            )
                throw new Error('selection_changed');
            await delay(400);
            const result = await settledSnapshot(context);
            return forHolder(
                result.state === 'intervention' && result.authenticated
                    ? await openInbox(context)
                    : result,
            );
        }
        if (action === 'switch') {
            if (!(await evaluate(context.tabId, followSwitchLink)))
                await navigate(context.tabId, `${PORTAL}seleccionar-login`);
            return forHolder(await settledSnapshot(context));
        }
        if (action === 'asiento') {
            if (!Number.isInteger(input.numero) || input.numero < 1)
                throw new Error('invalid_request');
            return forHolder(
                await fetchEntry(
                    context,
                    input.numero,
                    input.pdf !== false,
                    input.detalle !== false,
                ),
            );
        }
        if (action === 'capture') {
            const outline = await evaluate(context.tabId, outlinePortal);
            const { rows: _rows, ...state } = forHolder(
                await snapshot(context),
            );
            return { ...state, outline };
        }
        if (action === 'sync') {
            const started = {
                rows: new Map(),
                page: 0,
                total: null,
                done: false,
                cancelled: false,
            };
            jobs.set(id, started);
            // The session stays busy until the crawl ends, as in the desktop engine.
            background = true;
            crawl(context, started)
                .then((result) => (started.result = result))
                .catch((error) => {
                    started.error = /^[a-z_]+$/.test(error.message)
                        ? error.message
                        : 'connector_failed';
                })
                .finally(() => {
                    started.done = true;
                    busy.delete(id);
                });
            return progress(started);
        }
        throw new Error('invalid_action');
    } finally {
        if (!background) busy.delete(id);
    }
}
