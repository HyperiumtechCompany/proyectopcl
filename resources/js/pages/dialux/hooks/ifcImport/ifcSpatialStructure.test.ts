import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IfcAPI } from 'web-ifc';
import { closeIfcModel, createIfcApi, openIfcModel } from './ifcClient';
import { extractSpatialStructure } from './ifcSpatialStructure';

function readFixture(): Uint8Array {
    return new Uint8Array(readFileSync(join(__dirname, '__fixtures__/two-rooms.ifc')));
}

describe('ifcSpatialStructure', () => {
    let api: IfcAPI;
    let modelId: number;

    beforeEach(async () => {
        api = await createIfcApi();
        modelId = openIfcModel(api, readFixture());
    });

    afterEach(() => {
        closeIfcModel(api, modelId);
    });

    it('encuentra 1 storey con 2 espacios, conservando nombre y GlobalId', async () => {
        const structure = await extractSpatialStructure(api, modelId);

        expect(structure.storeys).toHaveLength(1);
        const storey = structure.storeys[0]!;
        expect(storey.name).toBe('Piso 1');
        expect(storey.globalId).toBe('0YvctVUKr0kugbFTf5xNmV');
        expect(storey.elevationM).toBe(0);

        expect(storey.spaces).toHaveLength(2);
        const names = storey.spaces.map((s) => s.name).sort();
        expect(names).toEqual(['Sala 1', 'Sala 2']);

        const sala1 = storey.spaces.find((s) => s.name === 'Sala 1');
        expect(sala1?.globalId).toBe('0YvctVUKr0kugbFTf5xNmW');
        const sala2 = storey.spaces.find((s) => s.name === 'Sala 2');
        expect(sala2?.globalId).toBe('0YvctVUKr0kugbFTf5xNmX');
    });
});
