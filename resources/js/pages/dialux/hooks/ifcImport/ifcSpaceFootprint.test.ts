import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IFCSPACE, type IfcAPI } from 'web-ifc';
import { closeIfcModel, createIfcApi, openIfcModel } from './ifcClient';
import { extractSpaceFootprint } from './ifcSpaceFootprint';

function readFixture(): Uint8Array {
    return new Uint8Array(readFileSync(join(__dirname, '__fixtures__/two-rooms.ifc')));
}

function polygonAreaM2(vertices: Array<{ x: number; y: number }>): number {
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]!;
        const b = vertices[(i + 1) % vertices.length]!;
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

describe('ifcSpaceFootprint', () => {
    let api: IfcAPI;
    let modelId: number;
    let sala1ExpressId: number;
    let sala2ExpressId: number;

    beforeEach(async () => {
        api = await createIfcApi();
        modelId = openIfcModel(api, readFixture());

        const spaceIds = api.GetLineIDsWithType(modelId, IFCSPACE);
        for (let i = 0; i < spaceIds.size(); i++) {
            const id = spaceIds.get(i);
            const line = api.GetLine(modelId, id);
            if (line.Name?.value === 'Sala 1') sala1ExpressId = id;
            if (line.Name?.value === 'Sala 2') sala2ExpressId = id;
        }
    });

    afterEach(() => {
        closeIfcModel(api, modelId);
    });

    it('Sala 1 (autorada 4m x 3m x 2.8m): altura y área en metros, aunque el archivo esté en milímetros', () => {
        const footprint = extractSpaceFootprint(api, modelId, sala1ExpressId);
        expect(footprint).not.toBeNull();
        expect(footprint!.height).toBeCloseTo(2.8, 3);
        expect(polygonAreaM2(footprint!.vertices)).toBeCloseTo(12, 2); // 4 x 3
    });

    it('Sala 2 (autorada 3m x 3m x 2.8m, desplazada 5m en X): área y posición correctas', () => {
        const footprint = extractSpaceFootprint(api, modelId, sala2ExpressId);
        expect(footprint).not.toBeNull();
        expect(footprint!.height).toBeCloseTo(2.8, 3);
        expect(polygonAreaM2(footprint!.vertices)).toBeCloseTo(9, 2); // 3 x 3

        const minX = Math.min(...footprint!.vertices.map((v) => v.x));
        const maxX = Math.max(...footprint!.vertices.map((v) => v.x));
        expect(minX).toBeCloseTo(3.5, 2);
        expect(maxX).toBeCloseTo(6.5, 2);
    });

    it('devuelve null para un expressId que no corresponde a ninguna geometría', () => {
        expect(extractSpaceFootprint(api, modelId, 999999)).toBeNull();
    });
});
