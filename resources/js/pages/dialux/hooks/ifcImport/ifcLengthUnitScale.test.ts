import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IfcAPI } from 'web-ifc';
import { closeIfcModel, createIfcApi, openIfcModel } from './ifcClient';
import { getLengthUnitScaleToMeters, readRealValue } from './ifcLengthUnitScale';

function readFixture(): Uint8Array {
    return new Uint8Array(readFileSync(join(__dirname, '__fixtures__/two-rooms.ifc')));
}

describe('ifcLengthUnitScale', () => {
    let api: IfcAPI;
    let modelId: number;

    beforeEach(async () => {
        api = await createIfcApi();
        modelId = openIfcModel(api, readFixture());
    });

    afterEach(() => {
        closeIfcModel(api, modelId);
    });

    it('detecta el factor 0.001 para un proyecto en milímetros (two-rooms.ifc)', () => {
        expect(getLengthUnitScaleToMeters(api, modelId)).toBe(0.001);
    });

    it('readRealValue lee el valor numérico de un IfcLengthMeasure real (Elevation del storey)', () => {
        const storeyIds = api.GetLineIDsWithType(modelId, 3124254112); // IFCBUILDINGSTOREY
        const storey = api.GetLine(modelId, storeyIds.get(0));
        expect(readRealValue(storey.Elevation)).toBe(0);
    });

    it('readRealValue devuelve null para valores no numéricos', () => {
        expect(readRealValue(null)).toBeNull();
        expect(readRealValue(undefined)).toBeNull();
        expect(readRealValue({ value: 'not-a-number' })).toBeNull();
    });
});
