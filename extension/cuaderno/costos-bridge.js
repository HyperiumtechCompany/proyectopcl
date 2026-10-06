// Content script on Costos pages: tells the page the assistant is installed and relays
// its few messages (pair, status, focus the OECE tab) to the extension.
// When the extension is reloaded or updated, this old copy is orphaned ("Extension context
// invalidated"): it then stops quietly and the new copy takes over.
(() => {
    if (globalThis.__costosCuadernoBridge) return;
    globalThis.__costosCuadernoBridge = true;

    const alive = () => {
        try {
            return Boolean(chrome.runtime?.id);
        } catch {
            return false;
        }
    };
    const toPage = (message) =>
        window.postMessage(
            { ...message, source: 'costos-cuaderno-extension' },
            location.origin,
        );

    let port = null;
    let pinger = null;
    let retired = false;

    function retire() {
        if (retired) return;
        retired = true;
        port = null;
        clearInterval(pinger);
        window.removeEventListener('message', onPage);
        toPage({ type: 'invalidated' });
    }

    function connect() {
        if (!alive()) return retire();
        try {
            port = chrome.runtime.connect({ name: 'costos-cuaderno' });
        } catch {
            return retire();
        }
        port.onMessage.addListener(toPage);
        port.onDisconnect.addListener(() => {
            port = null;
            void chrome.runtime?.lastError;
            // The service worker restarts often (normal in Manifest V3): reconnect.
            // A reloaded/removed extension cannot be reached anymore: stop.
            if (alive()) setTimeout(connect, 1000);
            else retire();
        });
    }

    function post(message) {
        if (!port) return;
        try {
            port.postMessage(message);
        } catch {
            port = null;
            if (!alive()) retire();
        }
    }

    function onPage(event) {
        if (event.source !== window || event.origin !== location.origin) return;
        const { source, type, codigo } = event.data ?? {};
        if (source !== 'costos-cuaderno-page') return;
        if (type === 'pair' && /^[A-Z2-9]{8}$/.test(codigo ?? ''))
            post({ type, codigo });
        if (type === 'focus' || type === 'status') post({ type });
    }

    document.documentElement.dataset.costosCuaderno =
        chrome.runtime.getManifest().version;
    window.addEventListener('message', onPage);
    connect();
    // Keeps the extension awake while Costos is open, so it can take tasks.
    pinger = setInterval(() => post({ type: 'ping' }), 20000);
})();
