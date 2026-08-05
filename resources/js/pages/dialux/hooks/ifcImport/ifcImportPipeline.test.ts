import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseIfcFileForImport } from './ifcImportPipeline';

function readFixture(): Uint8Array {
    return new Uint8Array(readFileSync(join(__dirname, '__fixtures__/two-rooms.ifc')));
}

describe('parseIfcFileForImport', () => {
    it('devuelve 1 storey con 2 espacios, cada uno con su huella de planta calculada', async () => {
        const preview = await parseIfcFileForImport(readFixture());

        expect(preview.storeys).toHaveLength(1);
        const storey = preview.storeys[0]!;
        expect(storey.name).toBe('Piso 1');
        expect(storey.spaces).toHaveLength(2);

        for (const space of storey.spaces) {
            expect(space.footprint).not.toBeNull();
            expect(space.footprint!.height).toBeCloseTo(2.8, 3);
            expect(space.footprint!.vertices.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('cierra el modelo después de extraer todo (no deja handles abiertos)', async () => {
        // Llamar dos veces seguidas no debe fallar ni degradarse — si el
        // modelo no se cerrara correctamente, `web-ifc` acumularía memoria
        // o el segundo `OpenModel` podría comportarse distinto.
        const first = await parseIfcFileForImport(readFixture());
        const second = await parseIfcFileForImport(readFixture());
        expect(second.storeys).toEqual(first.storeys);
    });
});
