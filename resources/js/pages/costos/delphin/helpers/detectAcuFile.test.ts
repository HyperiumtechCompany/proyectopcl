import { describe, expect, it } from 'vitest';
import { detectAcuFileKind, requireAcuRecords } from './detectAcuFile';

describe('identificación del archivo de ACU por contenido', () => {
    it('reconoce un PDF sin extensión ni MIME, como el archivo de Descargas', async () => {
        await expect(
            detectAcuFileKind(
                new File(['%PDF-1.7\ncontenido'], 'ACU VETERINARIA OK'),
            ),
        ).resolves.toBe('pdf');
    });
    it('prioriza un PDF real aunque tenga una extensión equivocada', async () => {
        await expect(
            detectAcuFileKind(
                new File(['%PDF-1.4'], 'acu.xls', {
                    type: 'application/vnd.ms-excel',
                }),
            ),
        ).resolves.toBe('pdf');
    });
    it('reconoce PDF con encabezado desplazado y con extensión habitual', async () => {
        await expect(
            detectAcuFileKind(new File(['\n%PDF-1.4'], 'acu.PDF')),
        ).resolves.toBe('pdf');
    });
    it('rechaza archivos vacíos y archivos falsamente identificados como PDF', async () => {
        await expect(detectAcuFileKind(new File([], 'acu'))).rejects.toThrow(
            'vacío',
        );
        await expect(
            detectAcuFileKind(new File(['no es un PDF'], 'acu.pdf')),
        ).rejects.toThrow('encabezado PDF válido');
        await expect(
            detectAcuFileKind(
                new File(['no es un PDF'], 'acu', { type: 'application/pdf' }),
            ),
        ).rejects.toThrow('encabezado PDF válido');
    });
    it('mantiene Excel y reconoce sus formatos binarios sin extensión', async () => {
        await expect(
            detectAcuFileKind(new File(['<html>reporte</html>'], 'acu.xls')),
        ).resolves.toBe('excel');
        await expect(
            detectAcuFileKind(
                new File(
                    [
                        new Uint8Array([
                            0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
                        ]),
                    ],
                    'acu',
                ),
            ),
        ).resolves.toBe('excel');
        await expect(
            detectAcuFileKind(
                new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'acu'),
            ),
        ).resolves.toBe('excel');
        await expect(
            detectAcuFileKind(new File(['desconocido'], 'acu')),
        ).rejects.toThrow('No se reconoce');
    });
    it('convierte una lectura de cero ACU en error visible y conserva su explicación', () => {
        expect(() =>
            requireAcuRecords({
                acus: [],
                warnings: ['No se encontraron ACUs en el reporte S10.'],
            }),
        ).toThrow('No se encontraron ACUs');
        expect(() => requireAcuRecords({ acus: [], warnings: [] })).toThrow(
            'No se encontraron ACU',
        );
        expect(() =>
            requireAcuRecords({ acus: [{}], warnings: [] }),
        ).not.toThrow();
    });
});
