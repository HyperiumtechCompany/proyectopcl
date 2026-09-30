// @vitest-environment jsdom
import { NullEngine, Scene, VertexBuffer } from '@babylonjs/core';
import earcut from 'earcut';
import { expect, it } from 'vitest';
import type { SiteData } from '@/pages/dialux/v2/site/domain/types';
import { SiteBuilder3D } from '@/pages/dialux/v2/site/engine/SiteBuilder3D';
(globalThis as unknown as { earcut: typeof earcut }).earcut = earcut;
it('cable aéreo entre postes sobre una rampa: va de cabeza a cabeza y sube con la rampa (no baja al suelo)', () => {
    const scene = new Scene(new NullEngine());
    const mk = (vs: number[][]) => vs.map(([x, y]) => ({ x, y }));
    const pole = (id: string, x: number) => ({ id, type: 'pole', label: id, vertices: mk([[x - 0.2, 0.8], [x + 0.2, 0.8], [x + 0.2, 1.2], [x - 0.2, 1.2]]), style: { fillColor: '#888', strokeColor: '#000' }, config: { kind: 'pole', heightM: 4, lumens: 3000, wattage: 30, fixtures: 1, armLengthM: 0, armDirectionDeg: 0 } });
    const site = { schemaVersion: 1, terrainScaleM: 1, elements: [
        { id: 'r', type: 'ramp', label: 'R', vertices: mk([[0, 0], [20, 0], [20, 2], [0, 2]]), style: { fillColor: '#888', strokeColor: '#000' }, config: { kind: 'ramp', fromElevationM: 0, toElevationM: 1.5, widthM: 2 } },
        pole('p1', 3), pole('p2', 17),
    ], circuits: [{ id: 'c', sourceId: 'p1', targetId: 'p2', waypoints: mk([[3, 1], [17, 1]]), calculatedLengthM: 0, wireCount: 2, segmentModes: ['aerial'], route: { kind: 'aerial', mountHeightM: 3 } }], feederPaths: [], layers: [] };
    const b = new SiteBuilder3D(scene);
    b.sync(site as unknown as SiteData);
    const read = (name: string) => { const m = scene.getMeshByName(name)!; m.computeWorldMatrix(true); const p = m.getVerticesData(VertexBuffer.PositionKind)!; const w = m.getWorldMatrix().m; const out: number[][] = []; for (let i = 0; i < p.length; i += 3) out.push([p[i] * w[0] + p[i + 1] * w[4] + p[i + 2] * w[8] + w[12], p[i] * w[1] + p[i + 1] * w[5] + p[i + 2] * w[9] + w[13]]); return out; };
    const tube = read('site_circuit_c');
    const s1 = read('site_pole_shaft_p1'); const s2 = read('site_pole_shaft_p2');
    const top = (pts: number[][]) => Math.max(...pts.map((p) => p[1]));
    const bot = (pts: number[][]) => Math.min(...pts.map((p) => p[1]));
    const near = (x: number) => tube.filter((p) => Math.abs(p[0] - x) < 0.3).map((p) => p[1]);
    // Los postes se apoyan en la rampa (sube hacia x mínima: p1 más alto que p2).
    expect(bot(s1)).toBeGreaterThan(bot(s2) + 0.5);
    // El cable termina en la cabeza de cada poste (tope − 0,30 m) y nunca baja al suelo.
    expect(Math.max(...near(s1[0][0]))).toBeCloseTo(top(s1) - 0.3, 1);
    expect(Math.max(...near(s2[0][0]))).toBeCloseTo(top(s2) - 0.3, 1);
    expect(bot(tube)).toBeGreaterThan(top(s2) - 1);
});
