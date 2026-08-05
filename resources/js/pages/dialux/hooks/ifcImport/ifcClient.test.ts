import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IFCBUILDINGSTOREY, IFCSPACE } from 'web-ifc';
import { closeIfcModel, createIfcApi, openIfcModel } from './ifcClient';

function readFixture(): Uint8Array {
    return new Uint8Array(readFileSync(join(__dirname, '__fixtures__/two-rooms.ifc')));
}

describe('ifcClient', () => {
    it('inicializa, abre el modelo de prueba y encuentra el storey y los 2 espacios (regresión: web-ifc debe seguir cargando bajo Vitest/Node)', async () => {
        const api = await createIfcApi();
        const modelId = openIfcModel(api, readFixture());

        const storeyIds = api.GetLineIDsWithType(modelId, IFCBUILDINGSTOREY);
        expect(storeyIds.size()).toBe(1);

        const spaceIds = api.GetLineIDsWithType(modelId, IFCSPACE);
        expect(spaceIds.size()).toBe(2);

        closeIfcModel(api, modelId);
    });
});
