// Offline browser verification: all HTTP requests are intercepted with synthetic HTML.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Browser } from './cuaderno/browser.mjs';
import {
    inspectPortal,
    fillLogin,
    changePage,
    selectNotebook,
    outlinePortal,
    followInboxLink,
    describeScreen,
    applyScreen,
    clickRowAction,
    readDetail,
    followSwitchLink,
} from './cuaderno/dom.mjs';

const fixtures = {
    'login-error':
        '<input formcontrolname="usuario"><input formcontrolname="clave" type="password"><mat-error>Usuario o clave incorrecta</mat-error>',
    inicio: '<nav><button>Cerrar sesión</button></nav><h1>Bienvenido</h1>',
    // Mirrors the real landing page captured on 2026-10-06 (no logout text).
    bandeja:
        '<a href="/cuaderno-obra/bandeja-asientos" onclick="event.preventDefault();document.body.dataset.inbox=1">Lista de asientos</a><a href="/cuaderno-obra/seleccionar-login">Cambiar a otra obra</a>',
    'codigo-2fa': `<p>Ingrese el código enviado a su correo</p><label for="c">Código</label><input id="c" formcontrolname="codigo" maxlength="6"><label><input type="checkbox" id="r"> Recordar este dispositivo</label><button id="b" disabled onclick="document.body.dataset.code=document.getElementById('c').value+(document.getElementById('r').checked?':r':'')">Validar</button><script>document.getElementById("c").addEventListener("input",()=>setTimeout(()=>document.getElementById("b").disabled=false,50))</script>`,
    verificacion:
        '<nav><button>Cerrar sesión</button></nav><input formcontrolname="codigo" maxlength="6">',
    login: '<input formcontrolname="usuario"><input formcontrolname="clave" type="password"><input type="radio" name="role"><input type="radio" name="role"><button onclick="document.body.dataset.submitted=1">Ingresar</button>',
    'seleccionar-login':
        '<div><input type="radio" name="notebook">Entidad piloto SUPERVISOR Obra uno CUI N° 2458710</div><div><input type="radio" name="notebook">Entidad piloto SUPERVISOR Obra dos CUI N° 2444383</div><button onclick="document.body.dataset.selected=1">Siguiente</button>',
    // Real case (2026-10-06): inbox restored with an expired token, list never loads.
    'vacia/bandeja-asientos':
        '<utils-info-row><section-label>Entidad contratante:</section-label><section-value>Entidad piloto</section-value></utils-info-row><button>Nuevo asiento</button><a>Filtros</a><p>Lista total de asientos:</p><a href="/cuaderno-obra/seleccionar-login" onclick="event.preventDefault();document.body.dataset.switch=1">Cambiar a otra obra</a>',
    expirado:
        '<div class="modal-content"><p>Tu sesión ha expirado</p><p>Vuelva a iniciar sesión</p><button>Aceptar</button></div>',
    // Official detail page, as captured on 2026-10-06.
    '3450bb3e-5d8f-4cd2-a3a0-07116ea0b459':
        '<utils-info-row><section-label>Entidad contratante:</section-label><section-value>Entidad piloto</section-value></utils-info-row><utils-info-row><section-label>Título:</section-label><section-value>Presentación de valorización</section-value></utils-info-row><utils-info-row><section-label>Descripción:</section-label><section-value>Texto completo del asiento</section-value></utils-info-row><utils-info-row><section-label>Asiento de referencia:</section-label><section-value>NINGUNO</section-value></utils-info-row>',
    'bandeja-asientos': `<utils-info-row><section-label>Entidad contratante:</section-label><section-value>Entidad piloto</section-value></utils-info-row><utils-info-row><section-label>Obra:</section-label><section-value>Obra piloto CUI N° 2458710</section-value></utils-info-row><p>Lista total de asientos: 2</p><table><tr class="mat-row"><td class="mat-column-num">2</td><td class="mat-column-titulo">Título de prueba</td><td class="mat-column-tipo">CONSULTA</td><td class="mat-column-fecha">03/10/2026 09:16 PM</td><td class="mat-column-usuario">Usuario de prueba</td><td class="mat-column-rol">SUPERVISOR</td><td class="mat-column-estado">DEFINITIVO</td><td class="mat-column-acciones"><button onclick="document.body.dataset.eye=1"><mat-icon class="fas fa-eye"></mat-icon></button><button onclick="const a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob(['%PDF-1.4 prueba'],{type:'application/pdf'}));a.download='x.pdf';a.click()"><mat-icon class="fas fa-file-pdf"></mat-icon></button></td></tr></table><button onclick="document.querySelector('.mat-column-num').innerText=1;this.disabled=true">chevron_right</button>`,
};
const profile = mkdtempSync(join(tmpdir(), 'proyectopcl-cuaderno-smoke-'));
let browser;
try {
    browser = await Browser.open(profile, {
        headless: true,
        lowMemory: true,
    });
    browser.socket.addEventListener('message', ({ data }) => {
        const event = JSON.parse(data);
        if (event.method !== 'Fetch.requestPaused') return;
        const path = new URL(event.params.request.url).pathname.replace(
            '/cuaderno-obra/',
            '',
        );
        const html =
            fixtures[path] ??
            fixtures[path.split('/').at(-1)] ??
            '<html>Offline fixture</html>';
        void browser.send(
            'Fetch.fulfillRequest',
            {
                requestId: event.params.requestId,
                responseCode: 200,
                responseHeaders: [
                    { name: 'Content-Type', value: 'text/html; charset=utf-8' },
                ],
                body: Buffer.from(html).toString('base64'),
            },
            browser.sessionId,
        );
    });
    await browser.send(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*' }] },
        browser.sessionId,
    );
    async function open(page) {
        await browser.navigate(
            `https://apps.oece.gob.pe/cuaderno-obra/${page}`,
        );
        await delay(250);
    }
    await open('login');
    assert.equal((await browser.evaluate(inspectPortal)).state, 'login');
    assert.equal(
        await browser.evaluate(fillLogin, {
            usuario: 'usuario-ficticio',
            password: 'clave-ficticia',
        }),
        true,
    );
    assert.equal(
        await browser.evaluate(() => document.body.dataset.submitted),
        '1',
    );
    await open('seleccionar-login');
    const selection = await browser.evaluate(inspectPortal);
    assert.equal(selection.choices.length, 2);
    assert.equal(
        await browser.evaluate(selectNotebook, selection.choices[1]),
        true,
    );
    assert.equal(
        await browser.evaluate(
            () => document.querySelectorAll('input[type=radio]')[1].checked,
        ),
        true,
    );
    await open('login-error');
    assert.equal(
        (await browser.evaluate(inspectPortal)).message,
        'Usuario o clave incorrecta',
    );
    await open('inicio');
    assert.equal((await browser.evaluate(inspectPortal)).authenticated, true);
    await open('bandeja');
    assert.equal((await browser.evaluate(inspectPortal)).authenticated, true);
    assert.equal(await browser.evaluate(followInboxLink), true);
    assert.equal(
        await browser.evaluate(() => document.body.dataset.inbox),
        '1',
    );
    await open('codigo-2fa');
    const remote = await browser.evaluate(describeScreen);
    assert.deepEqual(
        remote.fields.map((field) => [field.kind, field.label]),
        [
            ['text', 'Código'],
            ['checkbox', 'Recordar este dispositivo'],
            ['button', 'Validar'],
        ],
    );
    assert.match(remote.text, /código enviado/);
    assert.equal(
        await browser.evaluate(applyScreen, {
            fields: [
                { ref: 1, value: '123456' },
                { ref: 2, checked: true },
            ],
            submit: 3,
        }),
        'ok',
    );
    assert.equal(
        await browser.evaluate(() => document.body.dataset.code),
        '123456:r',
    );
    assert.ok((await browser.screenshot()).length > 1000);
    await browser.evaluate(() => {
        const input = document.getElementById('c');
        input.value = '';
        input.focus();
    });
    await browser.typeText('654321');
    assert.equal(
        await browser.evaluate(() => document.getElementById('c').value),
        '654321',
    );
    await open('verificacion');
    assert.equal((await browser.evaluate(inspectPortal)).authenticated, false);
    await open('bandeja-asientos');
    const outline = await browser.evaluate(outlinePortal);
    assert.equal(outline.path, '/cuaderno-obra/bandeja-asientos');
    assert.ok(outline.table.columns.includes('mat-column-titulo'));
    assert.deepEqual(outline.infoRows, ['Entidad contratante:', 'Obra:']);
    const snapshot = await browser.evaluate(inspectPortal);
    assert.equal(snapshot.state, 'ready');
    assert.equal(snapshot.identity.codigo_cui, '2458710');
    assert.equal(snapshot.total, 2);
    assert.equal(snapshot.rows[0].numero, '2');
    const downloads = mkdtempSync(join(tmpdir(), 'proyectopcl-cuaderno-dl-'));
    // The blob download needs no network; pause the offline interceptor meanwhile.
    await browser.send('Fetch.disable', {}, browser.sessionId);
    try {
        const guid = await browser.captureDownload(downloads, async () =>
            assert.equal(
                await browser.evaluate(clickRowAction, {
                    numero: 2,
                    icon: 'fa-file-pdf',
                }),
                true,
            ),
        );
        assert.equal(
            readFileSync(join(downloads, guid), 'latin1').slice(0, 5),
            '%PDF-',
        );
    } finally {
        await browser.send(
            'Fetch.enable',
            { patterns: [{ urlPattern: '*' }] },
            browser.sessionId,
        );
        rmSync(downloads, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 300,
        });
    }
    assert.equal(
        await browser.evaluate(clickRowAction, { numero: 99, icon: 'fa-eye' }),
        false,
    );
    assert.equal(await browser.evaluate(changePage, 'next'), true);
    assert.equal((await browser.evaluate(inspectPortal)).rows[0].numero, '1');
    assert.equal(await browser.evaluate(changePage, 'next'), false);
    await open('vacia/bandeja-asientos');
    const stale = await browser.evaluate(inspectPortal);
    assert.equal(stale.state, 'intervention');
    assert.equal(stale.stale, true);
    assert.equal(await browser.evaluate(followSwitchLink), true);
    assert.equal(
        await browser.evaluate(() => document.body.dataset.switch),
        '1',
    );
    await open('expirado');
    assert.equal((await browser.evaluate(inspectPortal)).state, 'login');
    await open(
        'operaciones/detalle-asiento/3450bb3e-5d8f-4cd2-a3a0-07116ea0b459',
    );
    const detail = await browser.evaluate(readDetail);
    assert.equal(detail.external_id, '3450bb3e-5d8f-4cd2-a3a0-07116ea0b459');
    assert.equal(detail.values['Descripción'], 'Texto completo del asiento');
    await browser.navigate(
        'data:text/html,<input formcontrolname="usuario"><input formcontrolname="clave">',
    );
    await delay(150);
    assert.equal(
        await browser.evaluate(fillLogin, {
            usuario: 'usuario-ficticio',
            password: 'clave-ficticia',
        }),
        false,
    );
    process.stdout.write(
        'Browser smoke passed: login, login notice, 2FA/session detection, remote form, screenshot, remote typing, PDF download, detail, expired session, stale inbox, change of work, selection, identity, table, outline, pagination and origin guard.\n',
    );
} finally {
    if (browser) await browser.close();
    await delay(500);
    if (
        !resolve(profile).startsWith(
            resolve(tmpdir()) + sep + 'proyectopcl-cuaderno-smoke-',
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
