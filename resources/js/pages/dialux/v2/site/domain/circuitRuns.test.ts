import { describe, expect, it } from 'vitest';
import { circuitColor, circuitRuns, circuitRunTag } from './circuitRuns';
import { createTgOutput } from './tgPanel';
import type { SiteCircuit, SiteData, SiteElement } from './types';

const el = (id: string, type: SiteElement['type'], x: number): SiteElement => ({
    id,
    type,
    label: type === 'tg_location' ? 'TG' : id.toUpperCase(),
    vertices: [{ x, y: 0 }],
    style: { fillColor: '#000', strokeColor: '#000' },
});
const wire = (id: string, from: string, to: string, extra: Partial<SiteCircuit> = {}): SiteCircuit => ({
    id,
    sourceId: from,
    targetId: to,
    waypoints: [],
    calculatedLengthM: 0,
    wireCount: 3,
    ...extra,
});
const site = (elements: SiteElement[], circuits: SiteCircuit[]) =>
    ({ schemaVersion: 1, terrainScaleM: 1, elements, feederPaths: [], circuits }) as unknown as SiteData;

describe('recorrido completo de cada salida', () => {
    const tg = { ...el('tg', 'tg_location', 0), label: 'TG-1' };
    const plant = site(
        [tg, el('box', 'pull_box', 10), el('p1', 'pole', 20), el('p2', 'pole', 30), el('m1', 'building_block', 50), el('p9', 'pole', 90)],
        [
            // Salida 2 re-trazada por una caja: solo el primer tramo toca el TG.
            wire('c1', 'tg', 'box', { tgOutputId: 'tg-output-2' }),
            wire('c2', 'box', 'p1'),
            wire('c3', 'p2', 'p1'), // dibujado al revés: igual es de la salida
            wire('c4', 'tg', 'm1', { tgOutputId: 'tg-output-1' }),
            wire('c5', 'm1', 'p9'), // detrás de un edificio: ya no es de la salida del TG
        ],
    );
    const runs = circuitRuns(plant);

    it('todas las conexiones de la salida (por cajas y postes) conocen su salida y su color', () => {
        const run = runs.get('c3')!;
        expect(run.circuitIds).toEqual(['c1', 'c2', 'c3']);
        expect(run.outputLabel).toBe('2');
        expect(circuitColor(plant.circuits![2], run)).toBe(createTgOutput(1).color);
        expect(circuitRunTag(run)).toBe('TG-1·2');
        expect(runs.get('c2')?.key).toBe(runs.get('c1')?.key);
    });

    it('no cruza edificios ni tableros; lo que no llega a un tablero queda sin salida', () => {
        expect(runs.get('c4')?.circuitIds).toEqual(['c4']);
        expect(runs.get('c5')).toBeUndefined();
        // Sin salida: manda el color propio del cable.
        expect(circuitColor(wire('x', 'a', 'b', { style: { color: '#123456' } }), undefined)).toBe('#123456');
    });

    it('un sub tablero numera sus salidas (sin colores de TG)', () => {
        const sub = site([{ ...el('td', 'sub_panel', 0), label: 'TD-01' }, el('p1', 'pole', 5)], [wire('s1', 'td', 'p1')]);
        const run = circuitRuns(sub).get('s1')!;
        expect(run.outputColor).toBeUndefined();
        expect(circuitRunTag(run)).toBe('TD-01·S1');
    });
});

describe('eliminar desde aquí con tramos dibujados al revés', () => {
    it('borra lo que cuelga del tramo, nunca lo que va hacia el tablero', async () => {
        const { downstreamCircuitIds } = await import('./circuitSplit');
        const elements = [el('tg', 'tg_location', 0), el('box', 'pull_box', 10), el('p1', 'pole', 20), el('p2', 'pole', 30)];
        const circuits = [
            wire('c1', 'tg', 'box'),
            wire('c2', 'p1', 'box'), // dibujado del poste hacia la caja
            wire('c3', 'p1', 'p2'),
        ];
        const runs = circuitRuns(site(elements, circuits));
        expect(runs.get('c2')?.upstreamNodeOf.c2).toBe('box');
        const ids = downstreamCircuitIds(circuits, elements, 'c2', runs.get('c2')?.upstreamNodeOf.c2);
        expect(ids.sort()).toEqual(['c2', 'c3']);
        // Sin el sentido real (comportamiento anterior) se habría ido hacia el TG.
        expect(downstreamCircuitIds(circuits, elements, 'c2').sort()).toEqual(['c1', 'c2']);
    });
});

describe('borrar objetos con cables', () => {
    const pt = (x: number) => ({ x, y: 0 });
    const w = (id: string, from: string, to: string, xs: number[], extra: Partial<SiteCircuit> = {}) =>
        wire(id, from, to, { waypoints: xs.map(pt), ...extra });

    it('borrar una caja de paso UNE los dos tramos (el cable sigue conectado)', async () => {
        const { circuitsAfterRemovingElements } = await import('./circuitSplit');
        const result = circuitsAfterRemovingElements(
            [
                w('c1', 'tg', 'box', [0, 10], { tgOutputId: 'tg-output-3', sectionMm2: 6 }),
                w('c2', 'p1', 'box', [20, 15, 10], { segmentModes: ['aerial', 'aerial'] }), // al revés
            ],
            new Set(['box']),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 'c1', sourceId: 'tg', targetId: 'p1', tgOutputId: 'tg-output-3', sectionMm2: 6 });
        expect(result[0].waypoints.map((p) => p.x)).toEqual([0, 10, 15, 20]);
        expect(result[0].segmentModes).toEqual(['underground', 'aerial', 'aerial']);
    });

    it('varias cajas seguidas se unen; un extremo borrado elimina su cable', async () => {
        const { circuitsAfterRemovingElements } = await import('./circuitSplit');
        const chain = [w('c1', 'tg', 'a', [0, 10]), w('c2', 'a', 'b', [10, 20]), w('c3', 'b', 'p', [20, 30])];
        const merged = circuitsAfterRemovingElements(chain, new Set(['a', 'b']));
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({ sourceId: 'tg', targetId: 'p' });
        expect(merged[0].waypoints.map((p) => p.x)).toEqual([0, 10, 20, 30]);
        expect(circuitsAfterRemovingElements(chain, new Set(['p'])).map((c) => c.id)).toEqual(['c1', 'c2']);
        // Un poste con 3 cables (derivación) no se une: se borran los 3.
        const branch = [w('x1', 'tg', 'p', [0, 1]), w('x2', 'p', 'q', [1, 2]), w('x3', 'p', 'r', [1, 3])];
        expect(circuitsAfterRemovingElements(branch, new Set(['p']))).toHaveLength(0);
    });
});

describe('caja de pase compartida (misma zanja)', () => {
    it('cada salida y cada TG conserva sus cables aunque pasen por la misma caja', () => {
        const plant = site(
            [el('tg1', 'tg_location', 0), el('tg2', 'tg_location', 40), el('caja', 'pull_box', 20), el('p1', 'pole', 25), el('p2', 'pole', 30)],
            [
                wire('a', 'tg1', 'caja', { tgOutputId: 'tg-output-1' }),
                wire('a2', 'caja', 'p1', { tgOutputId: 'tg-output-1' }),
                wire('b', 'tg1', 'caja', { tgOutputId: 'tg-output-2' }),
                wire('b2', 'caja', 'p2', { tgOutputId: 'tg-output-2' }),
                wire('x', 'tg2', 'caja', { tgOutputId: 'tg-output-1' }),
            ],
        );
        const runs = circuitRuns(plant);
        expect(runs.get('a')?.circuitIds).toEqual(['a', 'a2']);
        expect(runs.get('b')?.circuitIds).toEqual(['b', 'b2']);
        expect(runs.get('x')?.panelId).toBe('tg2');
        expect(runs.get('x')?.circuitIds).toEqual(['x']);
        // Dos TG de nombre genérico: TG-1 / TG-2, como en Red y CT.
        expect(circuitRunTag(runs.get('a'))).toBe('TG-1·1');
        expect(circuitRunTag(runs.get('x'))).toBe('TG-2·1');
    });
});

describe('plano del PDF', () => {
    it('cada cable con el color y el rótulo de su salida (TG-1 / TG-2)', async () => {
        const { renderSitePlanSvg } = await import('../export/siteSvgPlan');
        const at = (id: string, type: SiteElement['type'], x: number) => ({
            ...el(id, type, x),
            vertices: [{ x, y: 0 }],
        });
        const plant = site(
            [at('tg1', 'tg_location', 0), at('tg2', 'tg_location', 100), at('p1', 'pole', 60), at('p2', 'pole', 160)],
            [
                wire('a', 'tg1', 'p1', { waypoints: [{ x: 0, y: 0 }, { x: 60, y: 0 }], tgOutputId: 'tg-output-2' }),
                wire('b', 'tg2', 'p2', { waypoints: [{ x: 100, y: 0 }, { x: 160, y: 0 }], tgOutputId: 'tg-output-1' }),
            ],
        );
        const svg = JSON.stringify(renderSitePlanSvg(plant));
        expect(svg).toContain('TG-1·2');
        expect(svg).toContain('TG-2·1');
        expect(svg).toContain(createTgOutput(1).color);
        expect(svg).toContain(createTgOutput(0).color);
    });
});

describe('lo que no es una salida', () => {
    it('el cable que llega del ATS y el de puesta a tierra no se rotulan como salidas', () => {
        const plant = site(
            [el('tg', 'tg_location', 0), el('ats', 'ats', -10), el('pat', 'earth_pit', 5), el('p1', 'pole', 20)],
            [wire('in', 'ats', 'tg'), wire('gnd', 'tg', 'pat'), wire('out', 'tg', 'p1', { tgOutputId: 'tg-output-1' })],
        );
        const runs = circuitRuns(plant);
        expect(runs.get('in')).toBeUndefined();
        expect(runs.get('gnd')).toBeUndefined();
        expect(circuitRunTag(runs.get('out'))).toBe('TG·1');
    });
});

describe('tramos en cajas de pase', () => {
    it('un tramo que toca una caja va por el suelo aunque se haya hecho clic "aéreo"', async () => {
        const { forceUndergroundAtBoxes } = await import('./circuitTrace');
        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
        // Poste (0) → caja (10) → caja (20) → poste (30) — entre postes sigue aéreo.
        const isBox = (p: { x: number }) => p.x === 10 || p.x === 20;
        expect(forceUndergroundAtBoxes(points, ['aerial', 'aerial', 'aerial'], isBox)).toEqual(['underground', 'underground', 'underground']);
        expect(forceUndergroundAtBoxes([{ x: 0, y: 0 }, { x: 30, y: 0 }], ['aerial'], isBox)).toEqual(['aerial']);
    });
});

describe('caja compartida más adelante del recorrido', () => {
    it('un tramo sin salida anotada hereda la de su raíz y no se pasa a otra salida', () => {
        const plant = site(
            [el('tg', 'tg_location', 0), el('A', 'pull_box', 10), el('B', 'pull_box', 20), el('p1', 'pole', 30)],
            [
                wire('a', 'tg', 'A', { tgOutputId: 'tg-output-1' }),
                wire('ab', 'A', 'B'), // dibujado a mano, sin salida
                wire('b', 'tg', 'B', { tgOutputId: 'tg-output-2' }),
                wire('bp', 'B', 'p1', { tgOutputId: 'tg-output-2' }),
            ],
        );
        const runs = circuitRuns(plant);
        expect(runs.get('a')?.circuitIds).toEqual(['a', 'ab']);
        expect(runs.get('bp')?.outputLabel).toBe('2');
    });
});

describe('14 salidas del TG por una caja compartida (caso del usuario)', () => {
    // TG → caja (14 cables, una salida cada uno) → un poste por salida.
    const outputs = Array.from({ length: 14 }, (_, i) => `tg-output-${i + 1}`);
    const elements = [
        el('tg', 'tg_location', 0),
        el('caja', 'pull_box', 10),
        ...outputs.map((_, i) => el(`p${i + 1}`, 'pole', 20 + i)),
    ];
    const circuits = outputs.flatMap((output, i) => [
        wire(`t${i + 1}`, 'tg', 'caja', { tgOutputId: output }),
        wire(`c${i + 1}`, 'caja', `p${i + 1}`, { tgOutputId: output }),
    ]);
    const plant = site(elements, circuits);

    it('"eliminar desde aquí" en una salida borra SOLO esa salida', async () => {
        const { downstreamCircuitIds } = await import('./circuitSplit');
        const runs = circuitRuns(plant);
        const start = runs.get('t3')!;
        const ids = downstreamCircuitIds(circuits, elements, 't3', start.upstreamNodeOf.t3, (id) => runs.get(id)?.key === start.key);
        expect(ids.sort()).toEqual(['c3', 't3']);
        // Aun sin conocer los recorridos, la salida distinta de cada cable lo protege.
        expect(downstreamCircuitIds(circuits, elements, 't3').sort()).toEqual(['c3', 't3']);
    });

    it('borrar la caja compartida une los tramos de CADA salida (no borra ninguna)', async () => {
        const { siteCircuitsAfterRemoving } = await import('./circuitRuns');
        const after = siteCircuitsAfterRemoving(plant, new Set(['caja']));
        expect(after).toHaveLength(14);
        for (let i = 1; i <= 14; i++) {
            const cable = after.find((circuit) => circuit.tgOutputId === `tg-output-${i}`)!;
            expect(cable).toMatchObject({ sourceId: 'tg', targetId: `p${i}` });
        }
    });

    it('cada salida tiene un color distinto (también las guardadas con la paleta vieja)', async () => {
        const { normalizeTgOutputs, tgOutputColor } = await import('./tgPanel');
        const colors = Array.from({ length: 24 }, (_, i) => tgOutputColor(i).toLowerCase());
        expect(new Set(colors).size).toBe(24);
        expect(colors.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);
        // Paleta vieja: la 7ª repetía el color de la 1ª.
        const old = Array.from({ length: 14 }, (_, i) => ({ id: `tg-output-${i + 1}`, label: String(i + 1), color: colors[i % 6] }));
        const fixed = normalizeTgOutputs(old);
        expect(new Set(fixed.map((output) => output.color.toLowerCase())).size).toBe(14);
        // Las 6 primeras conservan su color.
        expect(fixed.slice(0, 6).map((output) => output.color)).toEqual(old.slice(0, 6).map((output) => output.color));
    });
});
