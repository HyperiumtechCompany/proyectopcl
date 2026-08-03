import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSafeDxfFilename, downloadDxfDocument } from './downloadDxfDocument';

describe('buildSafeDxfFilename', () => {
    it('reemplaza espacios y caracteres inválidos por guion bajo', () => {
        expect(buildSafeDxfFilename('Proyecto Test / v2')).toBe('Proyecto_Test___v2_planos_electricos.dxf');
    });

    it('usa "plano" cuando el nombre del proyecto está vacío', () => {
        expect(buildSafeDxfFilename('')).toBe('plano_planos_electricos.dxf');
    });

    it('conserva letras, números, guion y guion bajo tal cual', () => {
        expect(buildSafeDxfFilename('Modulo-I_2026')).toBe('Modulo-I_2026_planos_electricos.dxf');
    });
});

describe('downloadDxfDocument — descarga y liberación del object URL', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('crea un object URL, dispara la descarga vía <a> y libera el URL después', () => {
        const createObjectURL = vi.fn(() => 'blob:fake-url');
        const revokeObjectURL = vi.fn();
        const clickSpy = vi.fn();
        const appendChildSpy = vi.fn();
        const removeChildSpy = vi.fn();
        const fakeAnchor = { href: '', download: '', click: clickSpy };

        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
        vi.stubGlobal('document', {
            createElement: vi.fn(() => fakeAnchor),
            body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
        });

        downloadDxfDocument('0\nEOF\n', 'proyecto_planos_electricos.dxf');

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(fakeAnchor.download).toBe('proyecto_planos_electricos.dxf');
        expect(fakeAnchor.href).toBe('blob:fake-url');
        expect(appendChildSpy).toHaveBeenCalledWith(fakeAnchor);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(removeChildSpy).toHaveBeenCalledWith(fakeAnchor);
        // El URL se libera DESPUÉS de disparar la descarga, no antes.
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
        expect(clickSpy.mock.invocationCallOrder[0]).toBeLessThan(revokeObjectURL.mock.invocationCallOrder[0]!);
    });
});
