// Read-only public login check. Never fills or submits credentials.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Browser } from './cuaderno/browser.mjs';

const profile = mkdtempSync(join(tmpdir(), 'proyectopcl-cuaderno-public-'));
let browser;
try {
    browser = await Browser.open(profile, { headless: true });
    await browser.navigate('https://apps.oece.gob.pe/cuaderno-obra/login');
    let report;
    for (let attempt = 0; attempt < 40; attempt++) {
        await delay(500);
        report = await browser.evaluate(() => ({
            officialOrigin: location.origin === 'https://apps.oece.gob.pe',
            userField: Boolean(
                document.querySelector('input[formcontrolname="usuario"]'),
            ),
            passwordField: Boolean(
                document.querySelector('input[formcontrolname="clave"]'),
            ),
            roleCount: document.querySelectorAll('input[type="radio"]').length,
            loginButton: [...document.querySelectorAll('button')].some(
                (button) => /^Ingresar$/i.test(button.innerText.trim()),
            ),
        }));
        if (report.userField && report.passwordField && report.loginButton)
            break;
    }
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode =
        report.officialOrigin &&
        report.userField &&
        report.passwordField &&
        report.roleCount === 2 &&
        report.loginButton
            ? 0
            : 1;
} finally {
    if (browser) await browser.close();
    await delay(500);
    if (
        !resolve(profile).startsWith(
            resolve(tmpdir()) + sep + 'proyectopcl-cuaderno-public-',
        )
    )
        throw new Error('invalid_cleanup_path');
    rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
    });
}
