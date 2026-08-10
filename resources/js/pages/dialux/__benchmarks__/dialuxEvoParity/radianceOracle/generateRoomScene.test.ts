import { describe, expect, it } from 'vitest';
import { generateRoomScene } from './generateRoomScene';

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Extrae los vértices de un polígono Radiance por nombre y devuelve su normal (regla de la mano derecha, primeros 3 vértices). */
function normalOf(scene: string, polygonName: string): Vec3 {
    const lines = scene.split('\n');
    const headerIndex = lines.findIndex((line) => line.trim().endsWith(`polygon ${polygonName}`));
    if (headerIndex === -1) {
        throw new Error(`No se encontró el polígono "${polygonName}" en la escena generada.`);
    }
    // header, "0", "0", "<n*3>", luego n líneas "x y z".
    const vertexCountLine = lines[headerIndex + 3]!;
    const vertexCount = Number(vertexCountLine) / 3;
    const vertices: Vec3[] = [];
    for (let i = 0; i < vertexCount; i++) {
        const [x, y, z] = lines[headerIndex + 4 + i]!.trim().split(' ').map(Number);
        vertices.push([x!, y!, z!]);
    }
    const [v0, v1, v2] = vertices as [Vec3, Vec3, Vec3];
    return cross(sub(v1, v0), sub(v2, v0));
}

describe('generateRoomScene', () => {
    const scene = generateRoomScene({
        width: 2.209,
        depth: 0.95,
        height: 3.5,
        reflectance: { ceiling: 0.7, wall: 0.5, floor: 0.2 },
    });

    it('define los 3 materiales plastic con la reflectancia declarada (mapeo directo, sin especular/rugosidad)', () => {
        expect(scene).toContain('void plastic ceiling_mat');
        expect(scene).toContain('5 0.700 0.700 0.700 0 0');
        expect(scene).toContain('void plastic wall_mat');
        expect(scene).toContain('5 0.500 0.500 0.500 0 0');
        expect(scene).toContain('void plastic floor_mat');
        expect(scene).toContain('5 0.200 0.200 0.200 0 0');
    });

    it('define las 6 superficies de la caja', () => {
        for (const name of ['floor', 'ceiling', 'wall_y0', 'wall_y1', 'wall_x0', 'wall_x1']) {
            expect(scene).toContain(`polygon ${name}`);
        }
    });

    /**
     * Verificación geométrica independiente (no solo "el texto coincide con
     * lo que escribí a mano"): cada normal, calculada por regla de la mano
     * derecha desde los vértices generados, debe apuntar HACIA EL INTERIOR
     * del ambiente. Un orden de vértices invertido en cualquiera de las 6
     * caras produciría un resultado de radiosidad incorrecto en Radiance sin
     * ningún error visible — por eso esto se prueba con matemática, no a ojo.
     */
    it.each([
        ['floor', [0, 0, 1]],
        ['ceiling', [0, 0, -1]],
        ['wall_y0', [0, 1, 0]],
        ['wall_y1', [0, -1, 0]],
        ['wall_x0', [1, 0, 0]],
        ['wall_x1', [-1, 0, 0]],
    ] as const)('la normal de "%s" apunta hacia el interior del ambiente', (name, expectedDirection) => {
        const normal = normalOf(scene, name);
        const dot = normal[0] * expectedDirection[0] + normal[1] * expectedDirection[1] + normal[2] * expectedDirection[2];
        expect(dot).toBeGreaterThan(0);
    });
});
