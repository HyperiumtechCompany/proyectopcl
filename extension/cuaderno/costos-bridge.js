// Content script on Costos pages: tells the page the assistant is installed and relays
// its few messages (pair, status, focus the OECE tab) to the extension.
document.documentElement.dataset.costosCuaderno =
    chrome.runtime.getManifest().version;

let port;
function connect() {
    port = chrome.runtime.connect({ name: 'costos-cuaderno' });
    port.onMessage.addListener((message) =>
        window.postMessage(
            { ...message, source: 'costos-cuaderno-extension' },
            location.origin,
        ),
    );
    port.onDisconnect.addListener(() => setTimeout(connect, 1000));
}
connect();

// Keeps the extension awake while Costos is open, so it can take tasks.
setInterval(() => {
    try {
        port.postMessage({ type: 'ping' });
    } catch {
        // Reconnects on its own.
    }
}, 20000);

window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const { source, type, codigo } = event.data ?? {};
    if (source !== 'costos-cuaderno-page') return;
    if (type === 'pair' && /^[A-Z2-9]{8}$/.test(codigo ?? ''))
        port.postMessage({ type, codigo });
    if (type === 'focus' || type === 'status') port.postMessage({ type });
});
