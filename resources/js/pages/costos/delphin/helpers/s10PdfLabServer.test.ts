import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import s10PdfLabPlugin, {
    createS10PdfLabMiddleware,
    isLocalLabOrigin,
} from '../../../../../../scripts/s10-pdf-lab-plugin';
import { isS10PdfDocument, previewS10Pdf } from './previewS10Pdf';
import { parseS10PresupuestoWorkbook } from './parseS10Excel';
import { buildAcuPayload } from '../components/ImportDelphinModal';
import {
    normalizeAcuData,
    calculateAcuLocally,
} from '../../presupuesto/hooks/usePresupuestoAcu';
import Decimal from 'decimal.js';
import {
    flattenInsumos,
    sumInsumoTotals,
} from '../components/InsumosConsolidadosModal';

const servers: Server[] = [];
async function start(options: Parameters<typeof createS10PdfLabMiddleware>[0]) {
    const middleware = createS10PdfLabMiddleware(options);
    const server = createServer((request, response) => {
        void middleware(request, response, () => {
            response.statusCode = 404;
            response.end();
        }).catch((error: Error) => {
            response.statusCode = 500;
            response.end(error.message);
        });
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/__s10-pdf-lab`;
}
afterEach(async () => {
    await Promise.all(
        servers.splice(0).map(
            (server) =>
                new Promise<void>((done) => {
                    server.closeAllConnections();
                    server.close(() => done());
                }),
        ),
    );
});
const headers = {
    Origin: 'http://proyectopcl.test',
    'Content-Type': 'application/pdf',
};

describe('lector PDF disponible solo durante desarrollo local', () => {
    it('no se registra en builds y solo admite orígenes locales conocidos', () => {
        expect(s10PdfLabPlugin().apply).toBe('serve');
        expect(isLocalLabOrigin('http://proyectopcl.test')).toBe(true);
        expect(isLocalLabOrigin('http://localhost:5174')).toBe(true);
        expect(isLocalLabOrigin('https://proyectopcl.test.evil.example')).toBe(
            false,
        );
        expect(isLocalLabOrigin('null')).toBe(false);
    });

    it('rechaza orígenes no autorizados, archivos falsos y tamaños excesivos antes de ejecutar Python', async () => {
        const readPdf = vi.fn();
        const url = await start({ root: process.cwd(), readPdf, maxBytes: 20 });
        expect(
            (
                await fetch(url, {
                    method: 'POST',
                    headers: { ...headers, Origin: 'https://example.com' },
                    body: '%PDF-1.4',
                })
            ).status,
        ).toBe(403);
        expect(
            (
                await fetch(url, {
                    method: 'POST',
                    headers,
                    body: 'esto no es PDF',
                })
            ).status,
        ).toBe(422);
        expect(
            (
                await fetch(url, {
                    method: 'POST',
                    headers,
                    body: '%PDF-' + 'x'.repeat(30),
                })
            ).status,
        ).toBe(413);
        expect(readPdf).not.toHaveBeenCalled();
    });

    it('autoriza el preflight del presupuesto local y elimina el temporal tras leer', async () => {
        let temporary = '';
        const url = await start({
            root: process.cwd(),
            readPdf: async (filename) => {
                temporary = filename;
                expect((await readFile(filename)).toString()).toBe('%PDF-1.4');
                return { pages: 1, analyses: [], issues: [], empty_pages: [] };
            },
        });
        const preflight = await fetch(url, { method: 'OPTIONS', headers });
        expect(preflight.status).toBe(204);
        expect(preflight.headers.get('access-control-allow-origin')).toBe(
            headers.Origin,
        );
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: '%PDF-1.4',
        });
        expect(response.status).toBe(200);
        expect((await response.json()).pages).toBe(1);
        await vi.waitFor(() => expect(existsSync(temporary)).toBe(false));
    });

    it('permite reintentar después de un error de lectura', async () => {
        const url = await start({
            root: process.cwd(),
            readPdf: vi
                .fn()
                .mockRejectedValueOnce(new Error('PDF dañado'))
                .mockResolvedValueOnce({ pages: 1 }),
        });
        expect(
            (await fetch(url, { method: 'POST', headers, body: '%PDF-1.4' }))
                .status,
        ).toBe(422);
        await vi.waitFor(async () =>
            expect(
                (
                    await fetch(url, {
                        method: 'POST',
                        headers,
                        body: '%PDF-1.4',
                    })
                ).status,
            ).toBe(200),
        );
    });

    const pdf = resolve('planes/costos/ACU VETERINARIA OK.pdf');
    const excel = resolve(
        'planes/costos/1. PRESUPUESTO TOTAL VETERINARIA OK.xls',
    );
    it.skipIf(!existsSync(pdf) || !existsSync(excel))(
        'lee el PDF original por HTTP y lo compara con el presupuesto sin escribir en él',
        async () => {
            const bytes = await readFile(pdf);
            const url = await start({ root: process.cwd() });
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: bytes,
            });
            expect(response.status).toBe(200);
            const document: unknown = await response.json();
            expect(isS10PdfDocument(document)).toBe(true);
            if (!isS10PdfDocument(document))
                throw new Error('Respuesta inválida');
            const budget = parseS10PresupuestoWorkbook(
                XLSX.read(await readFile(excel)),
            );
            const preview = previewS10Pdf(document, budget.rows);
            expect(preview.entries).toHaveLength(3100);
            expect(
                preview.entries.filter((entry) => entry.match.row),
            ).toHaveLength(3100);
            expect(preview.auxiliaryCount).toBe(25);
            expect(
                preview.entries
                    .filter((entry) => entry.reasons.length > 0)
                    .slice(0, 5)
                    .map((entry) => ({
                        code: entry.source.partida_code,
                        reasons: entry.reasons,
                        cost: entry.calculatedCost,
                        declared: entry.source.declared_cost,
                    })),
            ).toEqual([]);
            expect(preview.applicableMatches).toHaveLength(3100);
            expect(preview.entries[0].calculatedCost).toBe(101.08);
            expect(preview.entries[0].match.acu.rendimiento).toBe(25);
            const persisted = preview.applicableMatches.map((match) =>
                normalizeAcuData(
                    buildAcuPayload(match.acu, match.row!.partida),
                ),
            );
            const reloaded = JSON.parse(JSON.stringify(persisted));
            expect(
                reloaded.every(
                    (acu: Record<string, any>, index: number) =>
                        calculateAcuLocally(acu).costo_unitario_total ===
                        preview.entries[index].source.declared_cost,
                ),
            ).toBe(true);
            const total = preview.applicableMatches.reduce(
                (sum, match, index) =>
                    sum.plus(
                        new Decimal(
                            calculateAcuLocally(reloaded[index])
                                .costo_unitario_total,
                        )
                            .times(match.row!.metrado)
                            .toDecimalPlaces(2),
                    ),
                new Decimal(0),
            );
            expect(total.toDecimalPlaces(2).toNumber()).toBe(31708502.4);
            const acuRows = reloaded.map(
                (acu: Record<string, any>, index: number) => ({
                    ...acu,
                    id: index + 1,
                    ...calculateAcuLocally(acu),
                }),
            );
            const insumos = flattenInsumos(acuRows, budget.rows);
            expect(
                new Decimal(
                    sumInsumoTotals(
                        insumos.map((item) => ({ total: item.parcial })),
                    ),
                )
                    .toDecimalPlaces(2)
                    .toNumber(),
            ).toBe(31708502.4);
            const php = `require 'vendor/autoload.php'; $app = require 'bootstrap/app.php';
                $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
                $rules = (new App\\Http\\Requests\\CalculateAcuRequest)->rules();
                $payloads = json_decode(stream_get_contents(STDIN), true); $ok = 0;
                foreach ($payloads as $payload) {
                    $v = Illuminate\\Support\\Facades\\Validator::make($payload, $rules);
                    if ($v->fails()) { echo json_encode(['errors' => $v->errors()->all(), 'partida' => $payload['partida']]); exit(1); }
                    $snapshot = App\\Services\\S10PdfSnapshot::calculate($v->validated());
                    if ($snapshot === null) { echo json_encode(['invalid_snapshot' => $payload['partida']]); exit(1); }
                    $ok++;
                } echo json_encode(['validated_and_calculated' => $ok]);`;
            const backend = JSON.parse(
                execFileSync('php', ['-d', 'memory_limit=512M', '-r', php], {
                    cwd: process.cwd(),
                    input: JSON.stringify(persisted),
                    encoding: 'utf8',
                    windowsHide: true,
                    timeout: 60_000,
                }),
            );
            expect(backend.validated_and_calculated).toBe(3100);
            expect((await readFile(pdf)).equals(bytes)).toBe(true);
        },
        60_000,
    );
});
