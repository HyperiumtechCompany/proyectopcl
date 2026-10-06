import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class Browser {
    constructor(socket, child) {
        this.socket = socket;
        this.child = child;
        this.sequence = 0;
        this.pending = new Map();
        this.listeners = new Map();
        socket.addEventListener('message', ({ data }) => {
            const result = JSON.parse(data);
            if (result.method && result.id === undefined) {
                for (const listener of this.listeners.get(result.method) ?? [])
                    listener(result.params ?? {});
                return;
            }
            const pending = this.pending.get(result.id);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.pending.delete(result.id);
            if (result.error)
                pending.reject(new Error('browser_command_failed'));
            else pending.resolve(result.result);
        });
        socket.addEventListener('close', () => {
            this.closed = true;
            for (const pending of this.pending.values()) {
                clearTimeout(pending.timer);
                pending.reject(new Error('browser_closed'));
            }
            this.pending.clear();
        });
    }

    static async open(profile, { headless = false, lowMemory = false } = {}) {
        const executable =
            process.env.CUADERNO_BROWSER_PATH ||
            [
                'C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
                'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
            ].find(existsSync);
        if (!executable || !existsSync(executable))
            throw new Error('browser_not_found');
        mkdirSync(profile, { recursive: true });
        const defaultProfile = join(profile, 'Default');
        mkdirSync(defaultProfile, { recursive: true });
        const preferences = join(defaultProfile, 'Preferences');
        if (!existsSync(preferences)) {
            writeFileSync(
                preferences,
                JSON.stringify({
                    credentials_enable_service: false,
                    profile: { password_manager_enabled: false },
                }),
            );
        }
        const child = spawn(
            executable,
            [
                '--remote-debugging-port=0',
                '--remote-debugging-address=127.0.0.1',
                `--user-data-dir=${profile}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-sync',
                '--disable-save-password-bubble',
                ...(headless ? ['--headless=new'] : []),
                // Keeps a single small renderer: old computers have little RAM.
                ...(lowMemory
                    ? [
                          '--window-size=1280,900',
                          '--disable-gpu',
                          '--disable-extensions',
                          '--disable-background-networking',
                          '--disable-component-update',
                          '--disable-default-apps',
                          // One renderer for the portal and its reCAPTCHA frame instead of one per site.
                          '--disable-features=Translate,OptimizationHints,MediaRouter,IsolateOrigins,site-per-process',
                          '--disable-site-isolation-trials',
                          '--renderer-process-limit=1',
                          '--js-flags=--max-old-space-size=256',
                          '--mute-audio',
                      ]
                    : []),
                'about:blank',
            ],
            { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: headless },
        );
        const endpoint = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('browser_start_timeout')),
                15000,
            );
            let output = '';
            child.stderr.on('data', (data) => {
                output = (output + data.toString()).slice(-3000);
                const match = output.match(
                    /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[\w-]+)/,
                );
                if (match) {
                    clearTimeout(timer);
                    resolve(match[1]);
                }
            });
            child.once('error', () => {
                clearTimeout(timer);
                reject(new Error('browser_start_failed'));
            });
            child.once('exit', () => {
                clearTimeout(timer);
                reject(new Error('browser_closed'));
            });
        }).catch((error) => {
            child.kill();
            throw error;
        });
        const socket = new WebSocket(endpoint);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('browser_connection_timeout')),
                10000,
            );
            socket.addEventListener(
                'open',
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                { once: true },
            );
            socket.addEventListener(
                'error',
                () => {
                    clearTimeout(timer);
                    reject(new Error('browser_connection_failed'));
                },
                { once: true },
            );
        }).catch((error) => {
            child.kill();
            throw error;
        });
        const browser = new Browser(socket, child);
        const { targetInfos } = await browser.send('Target.getTargets');
        const target = targetInfos.find(
            (item) => item.type === 'page' && item.url === 'about:blank',
        );
        if (!target) {
            await browser.close();
            throw new Error('browser_page_missing');
        }
        const { sessionId } = await browser.send('Target.attachToTarget', {
            targetId: target.targetId,
            flatten: true,
        });
        browser.sessionId = sessionId;
        await browser.send('Page.enable', {}, sessionId);
        if (lowMemory) {
            // Portal images, fonts and media are not needed to read or fill the notebook.
            // Google (reCAPTCHA) resources are never blocked.
            await browser.send('Network.enable', {}, sessionId);
            await browser.send(
                'Network.setBlockedURLs',
                {
                    urls: [
                        'png',
                        'jpg',
                        'jpeg',
                        'gif',
                        'webp',
                        'woff',
                        'woff2',
                        'ttf',
                        'mp4',
                        'webm',
                    ]
                        .map(
                            (extension) =>
                                `*://apps.oece.gob.pe/*.${extension}*`,
                        )
                        .concat([
                            '*googletagmanager.com*',
                            '*google-analytics.com*',
                        ]),
                },
                sessionId,
            );
        }
        return browser;
    }

    send(method, params = {}, sessionId) {
        return new Promise((resolve, reject) => {
            const id = ++this.sequence;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('browser_command_timeout'));
            }, 10000);
            this.pending.set(id, { resolve, reject, timer });
            try {
                this.socket.send(
                    JSON.stringify({
                        id,
                        method,
                        params,
                        ...(sessionId ? { sessionId } : {}),
                    }),
                );
            } catch {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(new Error('browser_closed'));
            }
        });
    }

    async evaluate(fn, argument = null) {
        const result = await this.send(
            'Runtime.evaluate',
            {
                expression: `(${fn.toString()})(${JSON.stringify(argument)})`,
                returnByValue: true,
                awaitPromise: true,
            },
            this.sessionId,
        );
        if (result.exceptionDetails)
            throw new Error('portal_structure_changed');
        return result.result.value;
    }

    async navigate(url) {
        const result = await this.send(
            'Page.navigate',
            { url },
            this.sessionId,
        );
        if (result.errorText) throw new Error('portal_unreachable');
    }

    /** Subscribes to a DevTools event; returns the unsubscribe function. */
    on(method, listener) {
        const listeners = this.listeners.get(method) ?? new Set();
        listeners.add(listener);
        this.listeners.set(method, listeners);
        return () => listeners.delete(listener);
    }

    /**
     * Runs `trigger` (a click on an official download button) and waits for the file
     * the portal saves. Returns the file name inside `directory` (Chrome's download guid).
     */
    async captureDownload(directory, trigger, timeout = 45000) {
        mkdirSync(directory, { recursive: true });
        await this.send('Browser.setDownloadBehavior', {
            behavior: 'allowAndName',
            downloadPath: directory,
            eventsEnabled: true,
        });
        let timer;
        let unsubscribe = () => {};
        const cleanup = () => {
            clearTimeout(timer);
            unsubscribe();
        };
        const finished = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                cleanup();
                reject(new Error('download_timeout'));
            }, timeout);
            unsubscribe = this.on('Browser.downloadProgress', (event) => {
                if (event.state === 'completed') {
                    cleanup();
                    resolve(event.guid);
                } else if (event.state === 'canceled') {
                    cleanup();
                    reject(new Error('download_failed'));
                }
            });
        });
        try {
            await trigger();
        } catch (error) {
            cleanup();
            finished.catch(() => {});
            throw error;
        }
        return finished;
    }

    // Remote view: Costos shows this picture and forwards the holder's clicks and keys.
    async screenshot() {
        const { data } = await this.send(
            'Page.captureScreenshot',
            { format: 'jpeg', quality: 55 },
            this.sessionId,
        );
        return data;
    }

    async click(x, y) {
        for (const type of ['mousePressed', 'mouseReleased']) {
            await this.send(
                'Input.dispatchMouseEvent',
                { type, x, y, button: 'left', clickCount: 1 },
                this.sessionId,
            );
        }
    }

    async typeText(text) {
        await this.send('Input.insertText', { text }, this.sessionId);
    }

    async pressKey(key) {
        const codes = { Enter: 13, Tab: 9, Backspace: 8, Escape: 27 };
        for (const type of ['keyDown', 'keyUp']) {
            await this.send(
                'Input.dispatchKeyEvent',
                {
                    type,
                    key,
                    code: key,
                    windowsVirtualKeyCode: codes[key],
                    ...(key === 'Enter' && type === 'keyDown'
                        ? { text: '\r' }
                        : {}),
                },
                this.sessionId,
            );
        }
    }

    async close() {
        try {
            await this.send('Browser.close');
        } catch {
            this.child.kill();
        }
        this.socket.close();
    }
}
