import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as XLSX from 'xlsx';
import { Browser } from './cuaderno/browser.mjs';
import { loadProjectFunctions } from './s10-import-lab.mjs';

// Monta solo el modal con callbacks de prueba, sin entrar a ningún proyecto real.
const hot = readFileSync('public/hot', 'utf8').trim();
const rows = loadProjectFunctions().parseS10PresupuestoWorkbook(
    XLSX.read(
        readFileSync('planes/costos/1. PRESUPUESTO TOTAL VETERINARIA OK.xls'),
    ),
).rows;
const profile = mkdtempSync(join(tmpdir(), 's10-pdf-ui-'));
const extensionlessPdf = join(profile, 'ACU VETERINARIA OK');
copyFileSync('planes/costos/ACU VETERINARIA OK.pdf', extensionlessPdf);
let browser;
try {
    browser = await Browser.open(profile, { headless: true });
    await browser.navigate(hot);
    await delay(700);
    const mounted = await browser.evaluate(
        async ({ hot, rows }) => {
            try {
                const refresh = (await import(hot + '/@react-refresh')).default;
                refresh.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => (type) => type;
                window.__vite_plugin_react_preamble_installed__ = true;
                const source = await (
                    await fetch(
                        hot +
                            '/resources/js/pages/costos/delphin/components/ImportDelphinModal.tsx',
                    )
                ).text();
                const reactPath = source.match(
                    /"([^"\n]*\/react\.js\?v=[^"\n]+)"/,
                )?.[1];
                if (!reactPath)
                    throw new Error(
                        'No se encontró el módulo React del servidor de desarrollo.',
                    );
                const React = (await import(hot + reactPath)).default;
                const client = await import(
                    hot +
                        reactPath.replace('/react.js?', '/react-dom_client.js?')
                );
                const createRoot =
                    client.createRoot ?? client.default.createRoot;
                const { ImportDelphinModal } = await import(
                    hot +
                        '/resources/js/pages/costos/delphin/components/ImportDelphinModal.tsx'
                );
                const {
                    calculateAcuLocally,
                    normalizeAcuData,
                    usePresupuestoAcu,
                } = await import(
                    hot +
                        '/resources/js/pages/costos/presupuesto/hooks/usePresupuestoAcu.ts'
                );
                const { AcuPanel } = await import(
                    hot +
                        '/resources/js/pages/costos/presupuesto/components/AcuPanel.tsx'
                );
                const axios = (
                    await import(
                        hot + reactPath.replace('/react.js?', '/axios.js?')
                    )
                ).default;
                axios.get = async () => ({ data: { success: true, rows: [] } });
                window.__s10Calculate = (payload) =>
                    calculateAcuLocally(normalizeAcuData(payload));
                document.body.innerHTML = '<div id="s10-test"></div>';
                window.__s10Payloads = [];
                function Harness() {
                    const state = usePresupuestoAcu({
                        projectId: 0,
                        subsection: 'acus',
                        selectedCell: null,
                        selectedPartidaCode: '1.1.1.1.1',
                        selectedPartidaData: {
                            descripcion: 'CONSTRUCCION PROVISIONAL DE OFICINAS',
                            unidad: 'm2',
                        },
                        lastSaved: null,
                        setSheetVersion: () => {},
                        refreshKey: 0,
                    });
                    window.__s10State = state;
                    return React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(ImportDelphinModal, {
                            open: true,
                            source: 's10',
                            project: 'Prueba local',
                            project_id_int: 0,
                            delphinRows: rows,
                            onClose: () => {},
                            onBudgetImported: () => ({ createdPartidas: [] }),
                            onAcusImported: (payloads) => {
                                window.__s10Payloads = payloads;
                                state.localSaveAcus(payloads);
                            },
                        }),
                        React.createElement(
                            'section',
                            { id: 's10-test-acu' },
                            React.createElement(AcuPanel, {
                                acuRows: state.acuRows,
                                acuLoading: state.acuLoading,
                                selectedAcu: state.selectedAcu,
                                projectId: 0,
                            }),
                        ),
                    );
                }
                createRoot(document.getElementById('s10-test')).render(
                    React.createElement(Harness),
                );
                return { ok: true };
            } catch (error) {
                return { ok: false, error: error.stack };
            }
        },
        { hot, rows },
    );
    assert.equal(mounted.ok, true, JSON.stringify(mounted));
    await delay(300);
    const accept = await browser.evaluate(
        () => document.querySelector('input[type=file]')?.accept,
    );
    assert.equal(
        accept,
        '',
        'El selector local debe admitir archivos sin extensión.',
    );
    const { root } = await browser.send(
        'DOM.getDocument',
        {},
        browser.sessionId,
    );
    const { nodeId } = await browser.send(
        'DOM.querySelector',
        { nodeId: root.nodeId, selector: 'input[type=file]' },
        browser.sessionId,
    );
    await browser.send(
        'DOM.setFileInputFiles',
        { nodeId, files: [extensionlessPdf] },
        browser.sessionId,
    );
    let preview;
    for (let attempt = 0; attempt < 80; attempt++) {
        preview = await browser.evaluate(() => ({
            text: document.body.innerText,
            checked: document.querySelector('input[aria-label="Incluir ACU del PDF"]')?.checked,
            loadButton: [...document.querySelectorAll('button')].some(
                (button) =>
                    button.innerText.includes('Cargar ') &&
                    button.innerText.includes('en vista'),
            ),
        }));
        if (preview.text.includes('PDF de prueba local:')) break;
        await delay(250);
    }
    assert.ok(
        preview.text.includes('3100 ACU principales'),
        preview.text.slice(-1500),
    );
    assert.equal(preview.checked, false);
    assert.equal(preview.loadButton, false);
    const compatible = Number(preview.text.match(/(\d+) compatibles/)?.[1]);
    assert.equal(compatible, 3100);
    await browser.evaluate(() =>
        document.querySelector('input[aria-label="Incluir ACU del PDF"]').click(),
    );
    await delay(200);
    await browser.evaluate(() =>
        [...document.querySelectorAll('button')]
            .find(
                (button) =>
                    button.innerText.includes('Cargar ') &&
                    button.innerText.includes('en vista'),
            )
            .click(),
    );
    await delay(200);
    const loaded = await browser.evaluate(() => window.__s10Payloads.length);
    assert.equal(loaded, compatible);
    const first = await browser.evaluate(() => {
        const payload = window.__s10Payloads[0];
        const calculated = window.__s10Calculate(payload);
        return {
            rendimiento: payload.rendimiento,
            manoDeObra: calculated.mano_de_obra.length,
            materiales: calculated.materiales.length,
            total: calculated.costo_unitario_total,
            partial: calculated.mano_de_obra[0].parcial,
            mismatches: window.__s10Payloads.filter(
                (acu) =>
                    window.__s10Calculate(acu).costo_unitario_total !==
                    (
                        acu.mano_de_obra[0] ??
                        acu.materiales[0] ??
                        acu.equipos[0] ??
                        acu.subcontratos[0] ??
                        acu.subpartidas[0]
                    ).source_pdf.declared_cost,
            ).length,
        };
    });
    assert.deepEqual(first, {
        rendimiento: 25,
        manoDeObra: 2,
        materiales: 5,
        total: 101.08,
        partial: 18.82,
        mismatches: 0,
    });
    const actualPanel = await browser.evaluate(() => ({
        rows: window.__s10State.acuRows.length,
        pending: window.__s10State.pendingAcuCount,
        total: window.__s10State.selectedAcu.costo_unitario_total,
        resourcesShown:
            document
                .querySelector('#s10-test-acu')
                .innerText.includes('OPERARIO') &&
            document
                .querySelector('#s10-test-acu')
                .innerText.includes('OFICIAL'),
        hasPdfNote: document
            .querySelector('#s10-test-acu')
            .innerText.includes('ACU importado del PDF'),
    }));
    assert.deepEqual(actualPanel, {
        rows: 3100,
        pending: 3100,
        total: 101.08,
        resourcesShown: true,
        hasPdfNote: true,
    });
    console.log(
        JSON.stringify({
            pdfSelector: accept,
            filename: basename(extensionlessPdf),
            detectedWithoutExtension: true,
            mainAnalyses: 3100,
            compatibleAcus: compatible,
            loadedToTestCallback: loaded,
            autoSelected: false,
            realProjectWrites: false,
            firstOffice: first,
            actualPanel,
        }),
    );
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    if (browser) {
        await browser.close();
        await Promise.race([
            new Promise((done) => browser.child.once('exit', done)),
            delay(1500),
        ]);
    }
    // Perfil creado por esta prueba: verificar destino antes de cualquier borrado recursivo.
    const actual = resolve(profile);
    if (
        actual.startsWith(resolve(tmpdir()) + sep) &&
        basename(actual).startsWith('s10-pdf-ui-')
    ) {
        try {
            rmSync(actual, {
                recursive: true,
                force: true,
                maxRetries: 5,
                retryDelay: 200,
            });
        } catch {
            console.error(
                'El navegador dejó bloqueado su perfil temporal de prueba.',
            );
        }
    }
}
