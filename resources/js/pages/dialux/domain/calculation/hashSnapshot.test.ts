import { describe, expect, it } from 'vitest';
import { buildModuloIProjectFixture } from '@/pages/dialux/export/__fixtures__/moduloIFixture';
import type { Project } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { hashCalculationGeometry, hashCalculationSnapshot, withGeometryHash } from './hashSnapshot';
import type { CalculationSnapshot } from './types';

function buildSnapshot(): CalculationSnapshot {
    return buildCalculationSnapshot(buildModuloIProjectFixture());
}

describe('hashCalculationSnapshot — Fase 1', () => {
    it('produce un hash hexadecimal SHA-256 (64 caracteres) estable entre corridas', async () => {
        const snapshot = buildSnapshot();
        const first = await hashCalculationSnapshot(snapshot);
        const second = await hashCalculationSnapshot(snapshot);

        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(second).toBe(first);
    });

    it('el hash es el mismo si se reordenan los arrays de nivel superior (orden irrelevante)', async () => {
        const snapshot = buildSnapshot();
        const reordered: CalculationSnapshot = {
            ...snapshot,
            levels: [...snapshot.levels].reverse(),
            luminaires: [...snapshot.luminaires].reverse(),
            calculationObjects: [...snapshot.calculationObjects].reverse(),
            scenes: [...snapshot.scenes].reverse(),
        };

        expect(await hashCalculationSnapshot(reordered)).toBe(await hashCalculationSnapshot(snapshot));
    });

    it('el hash cambia si una luminaria cambia de lumens (modificación relevante)', async () => {
        const snapshot = buildSnapshot();
        const before = await hashCalculationSnapshot(snapshot);

        const modified: CalculationSnapshot = {
            ...snapshot,
            luminaires: snapshot.luminaires.map((l, i) => (i === 0 ? { ...l, lumens: l.lumens + 1 } : l)),
        };

        expect(await hashCalculationSnapshot(modified)).not.toBe(before);
    });

    it('el hash es independiente de `geometryHash` (evita autoreferencia)', async () => {
        const snapshot = buildSnapshot();
        const withHash = await withGeometryHash(snapshot);

        expect(withHash.geometryHash).not.toBe('');
        expect(await hashCalculationSnapshot(withHash)).toBe(await hashCalculationSnapshot(snapshot));
    });

    it('sobrevive un roundtrip de serialización (JSON.stringify/parse da el mismo hash)', async () => {
        const snapshot = buildSnapshot();
        const roundtripped = JSON.parse(JSON.stringify(snapshot)) as CalculationSnapshot;

        expect(await hashCalculationSnapshot(roundtripped)).toBe(await hashCalculationSnapshot(snapshot));
    });

    it('hashCalculationGeometry cambia si cambia la geometría pero no si solo cambia una luminaria', async () => {
        const snapshot = buildSnapshot();
        const baseGeometryHash = await hashCalculationGeometry(snapshot);

        const sameGeometryDifferentLumens: CalculationSnapshot = {
            ...snapshot,
            luminaires: snapshot.luminaires.map((l, i) => (i === 0 ? { ...l, lumens: l.lumens + 500 } : l)),
        };
        expect(await hashCalculationGeometry(sameGeometryDifferentLumens)).toBe(baseGeometryHash);

        const differentGeometry: CalculationSnapshot = {
            ...snapshot,
            calculationObjects: snapshot.calculationObjects.map((o, i) =>
                i === 0 ? { ...o, height: o.height + 1 } : o,
            ),
        };
        expect(await hashCalculationGeometry(differentGeometry)).not.toBe(baseGeometryHash);
    });
});

describe('buildCalculationSnapshot x hash — proyectos distintos producen hashes distintos', () => {
    it('un Project con un cuarto de más ya hashea distinto', async () => {
        const project: Project = buildModuloIProjectFixture();
        const baseHash = await hashCalculationSnapshot(buildCalculationSnapshot(project));

        const withExtraRoom: Project = {
            ...project,
            scenes: project.scenes.map((scene, i) =>
                i === 0
                    ? {
                          ...scene,
                          rooms: [
                              ...scene.rooms,
                              {
                                  id: 'extra-room',
                                  name: 'Ambiente extra',
                                  vertices: [
                                      { x: 20, y: 0 },
                                      { x: 24, y: 0 },
                                      { x: 24, y: 4 },
                                      { x: 20, y: 4 },
                                  ],
                                  height: 3,
                                  color: '#000',
                              },
                          ],
                      }
                    : scene,
            ),
        };

        expect(await hashCalculationSnapshot(buildCalculationSnapshot(withExtraRoom))).not.toBe(baseHash);
    });
});
