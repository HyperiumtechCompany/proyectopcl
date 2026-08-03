import { describe, expect, it } from 'vitest';
import { calibrateScaleConfig, computeLinearScaleFactor, scaleAreaByLinearFactor } from './calibration';
import {
    cadToMeters,
    createCanvasTransforms,
    getEffectiveScale,
    metersToCad,
    type CadViewLike,
} from './coordinateTransform';
import { polygonAreaM2 } from './polygonGeometry';
import type { ScaleConfig } from '@/pages/dialux/hooks/types';

function makeScale(overrides: Partial<ScaleConfig> = {}): ScaleConfig {
    return {
        unit: 'm',
        factor: 1,
        displayUnit: 'Metros (1 = 1m)',
        calibrationFactor: 1,
        isCalibrated: false,
        ...overrides,
    };
}

/**
 * Cámara ortográfica simulada equivalente a la del motor mlightcad:
 * screen = (world − pan) × zoom  con inversión de eje Y.
 * Trabaja en píxeles CSS, igual que la vista real (getBoundingClientRect).
 */
function makeMockCadView(zoom: number, panX: number, panY: number, heightPx = 600): CadViewLike {
    return {
        worldToScreen: (p) => ({
            x: (p.x - panX) * zoom,
            y: heightPx - (p.y - panY) * zoom,
        }),
        screenToWorld: (p) => ({
            x: p.x / zoom + panX,
            y: (heightPx - p.y) / zoom + panY,
        }),
    };
}

const RECT_M = [
    { x: 10, y: 20 },
    { x: 18, y: 20 },
    { x: 18, y: 25.012 },
    { x: 10, y: 25.012 },
];

describe('effectiveScale / conversiones CAD ↔ metros', () => {
    it('mm: 1000 unidades CAD = 1 m (ida y vuelta sin pérdida)', () => {
        const scale = makeScale({ unit: 'mm', factor: 0.001 });
        expect(cadToMeters(1000, scale)).toBeCloseTo(1, 12);
        expect(metersToCad(1, scale)).toBeCloseTo(1000, 9);
        expect(metersToCad(cadToMeters(1234.5678, scale), scale)).toBeCloseTo(1234.5678, 9);
    });

    it('la calibración multiplica el factor base', () => {
        const scale = makeScale({ factor: 1, calibrationFactor: 1.1658 });
        expect(getEffectiveScale(scale)).toBeCloseTo(1.1658, 9);
    });
});

describe('createCanvasTransforms — invariancia de la geometría de mundo (AC-002/003/004)', () => {
    it('screenToScene ∘ sceneToScreen = identidad (ruta nativa)', () => {
        const t = createCanvasTransforms(makeMockCadView(2.5, 100, -30), makeScale(), {
            zoom: 1,
            panX: 0,
            panY: 0,
            pxPerMeter: 60,
        });
        for (const p of RECT_M) {
            const round = t.screenToScene(t.sceneToScreen(p));
            expect(round.x).toBeCloseTo(p.x, 9);
            expect(round.y).toBeCloseTo(p.y, 9);
        }
    });

    it('el área NO cambia con el zoom (25%, 100%, 400%)', () => {
        const areas = [0.25, 1, 4].map((zoom) => {
            const t = createCanvasTransforms(makeMockCadView(zoom * 60, 0, 0), makeScale(), {
                zoom: 1,
                panX: 0,
                panY: 0,
                pxPerMeter: 60,
            });
            // Simular: el usuario clica los 4 puntos de pantalla que corresponden
            // al rectángulo; el sistema los convierte a mundo y calcula el área.
            const screenPts = RECT_M.map((p) => t.sceneToScreen(p));
            const worldPts = screenPts.map((sp) => t.screenToScene(sp));
            return polygonAreaM2(worldPts);
        });
        for (const a of areas) {
            expect(a).toBeCloseTo(40.096, 6);
        }
    });

    it('el área NO cambia al desplazar la cámara (pan)', () => {
        const pans = [
            [0, 0],
            [500, -300],
            [-1234.5, 987.6],
        ];
        for (const [px, py] of pans) {
            const t = createCanvasTransforms(makeMockCadView(60, px, py), makeScale(), {
                zoom: 1,
                panX: 0,
                panY: 0,
                pxPerMeter: 60,
            });
            const worldPts = RECT_M.map((p) => t.screenToScene(t.sceneToScreen(p)));
            expect(polygonAreaM2(worldPts)).toBeCloseTo(40.096, 6);
        }
    });

    it('plano en milímetros: un rectángulo CAD de 8000×5012 mm produce 40.096 m²', () => {
        const scaleMm = makeScale({ unit: 'mm', factor: 0.001 });
        const t = createCanvasTransforms(makeMockCadView(0.05, 0, 0), scaleMm, {
            zoom: 1,
            panX: 0,
            panY: 0,
            pxPerMeter: 60,
        });
        // El motor devuelve unidades CAD (mm); screenToScene aplica effectiveScale.
        const cadRect = [
            { x: 0, y: 0 },
            { x: 8000, y: 0 },
            { x: 8000, y: 5012 },
            { x: 0, y: 5012 },
        ];
        const mockView = makeMockCadView(0.05, 0, 0);
        const worldPts = cadRect.map((cadPt) => {
            const screen = mockView.worldToScreen!(cadPt)!;
            return t.screenToScene({ x: screen.x ?? 0, y: screen.y ?? 0 });
        });
        expect(polygonAreaM2(worldPts)).toBeCloseTo(40.096, 6);
    });

    it('fallback sin motor: ida y vuelta exacta e independiente del zoom del overlay', () => {
        for (const zoom of [0.5, 1, 3]) {
            const t = createCanvasTransforms(null, makeScale(), {
                zoom,
                panX: 40,
                panY: -25,
                pxPerMeter: 60,
            }, 600);
            const worldPts = RECT_M.map((p) => t.screenToScene(t.sceneToScreen(p)));
            expect(polygonAreaM2(worldPts)).toBeCloseTo(40.096, 6);
            const round = t.screenToScene(t.sceneToScreen({ x: 3.25, y: 7.5 }));
            expect(round.x).toBeCloseTo(3.25, 9);
            expect(round.y).toBeCloseTo(7.5, 9);
        }
    });

    it('screenDistance escala linealmente con el zoom pero no altera el mundo', () => {
        const t1 = createCanvasTransforms(makeMockCadView(60, 0, 0), makeScale(), { zoom: 1, panX: 0, panY: 0, pxPerMeter: 60 });
        const t4 = createCanvasTransforms(makeMockCadView(240, 0, 0), makeScale(), { zoom: 1, panX: 0, panY: 0, pxPerMeter: 60 });
        expect(t1.screenDistance(1, 0)).toBeCloseTo(60, 6);
        expect(t4.screenDistance(1, 0)).toBeCloseTo(240, 6);
    });
});

describe('calibración (Prueba de la Fase 1)', () => {
    it('factor lineal = distanciaReal / distanciaMedida', () => {
        expect(computeLinearScaleFactor(1.58, 1.8439)).toBeCloseTo(1.1670, 4);
        expect(computeLinearScaleFactor(0, 5)).toBeNull();
        expect(computeLinearScaleFactor(5, -1)).toBeNull();
        expect(computeLinearScaleFactor(NaN, 5)).toBeNull();
    });

    it('el área corrige con el cuadrado del factor lineal (44.540 → 40.096)', () => {
        const linear = Math.sqrt(40.096 / 44.54);
        expect(scaleAreaByLinearFactor(44.54, linear)).toBeCloseTo(40.096, 9);
    });

    it('calibrateScaleConfig produce effectiveScale = real/cad', () => {
        const next = calibrateScaleConfig(makeScale({ factor: 0.001, unit: 'mm' }), 5000, 5)!;
        expect(next.isCalibrated).toBe(true);
        expect(getEffectiveScale(next)).toBeCloseTo(5 / 5000, 12);
    });
});
