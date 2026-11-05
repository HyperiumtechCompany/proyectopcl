import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import {
    calculateAcuLocally,
    calculateS10PdfSnapshot,
    normalizeAcuData,
} from '../../presupuesto/hooks/usePresupuestoAcu';
import type { DelphinRow } from '../types';
import {
    isS10PdfDocument,
    localS10PdfEndpoint,
    previewS10Pdf,
    readLocalS10Pdf,
    type S10PdfAnalysis,
    type S10PdfDocument,
} from './previewS10Pdf';

const row = (partida = '1.1.1', id = 1): DelphinRow => ({
    id,
    parent_id: null,
    nivel: 3,
    item_order: 0,
    partida,
    descripcion: 'OFICINA',
    unidad: 'm2',
    metrado: 1,
    precio_unitario: 10,
    parcial: 10,
    presupuesto: 10,
    duracion_dias: 0,
    fecha_inicio: null,
    fecha_fin: null,
    avance: 0,
    predecesoras: [],
});
function acu(extra: Partial<S10PdfAnalysis> = {}): S10PdfAnalysis {
    return {
        kind: 'main',
        partida_code: '1.1.1',
        partida_desc: 'OFICINA',
        unidad: 'm²',
        rendimiento: 1,
        rendimiento_text: '1 m²/Día',
        declared_cost: 10,
        page: 1,
        mano_de_obra: [],
        materiales: [
            {
                codigo: '440010001',
                proveedor: null,
                descripcion: 'MATERIAL',
                unidad: 'und',
                recursos: null,
                cantidad: 1,
                precio_unitario: 10,
                precio_hora: 0,
                factor_desperdicio: 1,
                reported_partial: 10,
                page: 1,
            },
        ],
        equipos: [],
        subcontratos: [],
        subpartidas: [],
        ...extra,
    };
}
const document = (analyses = [acu()]): S10PdfDocument => ({
    pages: 1,
    empty_pages: [],
    analyses,
    issues: [],
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('PDF S10 desde la interfaz local', () => {
    it('conserva el origen al normalizar, serializar y recargar, y recalcula al editar', () => {
        const source = acu();
        const imported = previewS10Pdf(document([source]), [row()])
            .applicableMatches[0].acu;
        const normalized = normalizeAcuData({
            ...imported,
            partida: '1.1.1',
            descripcion: imported.partida_desc,
        });
        const reloaded = JSON.parse(JSON.stringify(normalized));
        expect(calculateAcuLocally(reloaded).costo_unitario_total).toBe(10);
        expect(reloaded.materiales[0].source_pdf.partial).toBe(10);
        reloaded.materiales[0].cantidad = 2;
        expect(calculateS10PdfSnapshot(reloaded)).toBeNull();
        expect(calculateAcuLocally(reloaded).costo_unitario_total).toBe(20);
    });

    it('funciona en build local usando Laravel en lugar de Vite', async () => {
        vi.stubEnv('DEV', false);
        const post = vi
            .spyOn(axios, 'post')
            .mockResolvedValue({ data: document() });
        const file = new File(['%PDF-1.7'], 'ACU SIN EXTENSION');
        await expect(
            readLocalS10Pdf(file, undefined, 42),
        ).resolves.toMatchObject({ pages: 1 });
        expect(post).toHaveBeenCalledWith(
            expect.stringContaining('/42/presupuesto/acus/preview-pdf'),
            file,
            expect.objectContaining({
                headers: {
                    'Content-Type': 'application/pdf',
                    Accept: 'application/json',
                },
            }),
        );
    });
    it('vincula contra este presupuesto y permite solo costos exactamente iguales y datos completos', () => {
        const source = document();
        const before = JSON.stringify(source);
        const result = previewS10Pdf(source, [row()]);
        expect(result.applicableMatches).toHaveLength(1);
        expect(result.entries[0].reasons).toEqual([]);
        expect(JSON.stringify(source)).toBe(before);
    });

    it('conserva parciales originales aunque difieran del producto sin redondear', () => {
        const analysis = acu();
        analysis.materiales[0].precio_unitario = 9.9999;
        const result = previewS10Pdf(document([analysis]), [row()]);
        expect(result.applicableMatches).toHaveLength(1);
        expect(result.entries[0].calculatedCost).toBe(10);
        expect(result.entries[0].match.acu.materiales[0].precio_unitario).toBe(
            9.9999,
        );
    });

    it('conserva porcentaje y parcial originales sin multiplicar el costo por cien', () => {
        const analysis = acu({ declared_cost: 13 });
        analysis.mano_de_obra = [
            {
                ...analysis.materiales[0],
                unidad: '%mt',
                cantidad: 3,
                precio_unitario: 100,
                reported_partial: 3,
            },
        ];
        const result = previewS10Pdf(document([analysis]), [
            { ...row(), precio_unitario: 13 },
        ]);
        expect(result.applicableMatches).toHaveLength(1);
        expect(result.entries[0].calculatedCost).toBe(13);
        expect(analysis.mano_de_obra[0].cantidad).toBe(3);
        const edited = normalizeAcuData(result.applicableMatches[0].acu);
        edited.mano_de_obra[0].cantidad = 4;
        expect(calculateAcuLocally(edited).costo_unitario_total).toBe(14);
    });

    it('excluye auxiliares y conserva la ausencia original de rendimiento y unidad con advertencias', () => {
        const analysis = acu({ rendimiento: null });
        analysis.materiales[0].unidad = '';
        const result = previewS10Pdf(
            document([
                analysis,
                acu({ kind: 'auxiliary', partida_code: 'CU0010012' }),
            ]),
            [row()],
        );
        expect(result.auxiliaryCount).toBe(1);
        expect(result.entries).toHaveLength(1);
        expect(result.applicableMatches).toHaveLength(1);
        expect(result.entries[0].source.rendimiento).toBeNull();
        expect(result.entries[0].warnings.join(' ')).toContain('sin unidad');
        expect(
            result.entries[0].match.acu.materiales[0].source_pdf?.original_unit,
        ).toBe('');
    });

    it('no elige un ganador entre códigos o destinos duplicados', () => {
        const result = previewS10Pdf(
            document([acu(), acu({ partida_code: '01.01.01' })]),
            [row()],
        );
        expect(result.applicableMatches).toHaveLength(0);
        expect(
            result.entries.every((entry) =>
                entry.reasons.join(' ').includes('mismo destino'),
            ),
        ).toBe(true);
        expect(
            previewS10Pdf(document(), [row(), row('01.01.01', 2)])
                .applicableMatches,
        ).toHaveLength(0);
    });

    it('bloquea lecturas incompletas y advierte precios distintos sin sustituir el presupuesto', () => {
        const source = document();
        source.empty_pages = [2];
        expect(previewS10Pdf(source, [row()]).applicableMatches).toHaveLength(
            0,
        );
        expect(
            previewS10Pdf(document(), [{ ...row(), precio_unitario: 11 }])
                .applicableMatches,
        ).toHaveLength(1);
    });

    it('valida la respuesta del lector antes de calcular', () => {
        expect(isS10PdfDocument(document())).toBe(true);
        const source = document();
        source.analyses[0].materiales[0].cantidad = NaN;
        expect(isS10PdfDocument(source)).toBe(false);
        expect(
            isS10PdfDocument({ pages: 616, analyses: [{}], issues: [] }),
        ).toBe(false);
    });

    it('resuelve el endpoint en Vite aunque el presupuesto esté servido por Laravel en otro origen', () => {
        expect(
            localS10PdfEndpoint(
                'http://localhost:5174/resources/js/example.ts',
            ),
        ).toBe('http://localhost:5174/__s10-pdf-lab');
    });

    it('no permite leer PDF con la aplicación compilada para producción', async () => {
        vi.stubEnv('DEV', false);
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await expect(
            readLocalS10Pdf(new File(['%PDF-'], 'acu.pdf')),
        ).rejects.toThrow('npm run dev');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('muestra errores del lector y rechaza respuestas incompletas', async () => {
        vi.stubEnv('DEV', true);
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ error: 'PDF dañado' }), {
                    status: 422,
                }),
            ),
        );
        await expect(
            readLocalS10Pdf(new File(['%PDF-'], 'acu.pdf')),
        ).rejects.toThrow('PDF dañado');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
        );
        await expect(
            readLocalS10Pdf(new File(['%PDF-'], 'acu.pdf')),
        ).rejects.toThrow('datos incompletos');
    });

    it('lee un PDF sin extensión y envía sus bytes al lector PDF, no al de Excel', async () => {
        vi.stubEnv('DEV', true);
        const file = new File(['%PDF-1.7\ncontenido'], 'ACU VETERINARIA OK');
        const fetch = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify(document()), { status: 200 }),
            );
        vi.stubGlobal('fetch', fetch);
        await expect(readLocalS10Pdf(file)).resolves.toMatchObject({
            pages: 1,
        });
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: file,
                headers: { 'Content-Type': 'application/pdf' },
            }),
        );
    });

    it('no presenta una respuesta sin ACU como una importación vacía exitosa', async () => {
        vi.stubEnv('DEV', true);
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    new Response(JSON.stringify(document([])), { status: 200 }),
                ),
        );
        await expect(
            readLocalS10Pdf(new File(['%PDF-1.7'], 'acu')),
        ).rejects.toThrow('No se encontraron ACU principales');
    });
});
