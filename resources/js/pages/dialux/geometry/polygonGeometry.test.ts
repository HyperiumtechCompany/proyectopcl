import { describe, expect, it } from 'vitest';
import {
    distanceToPolygonEdge,
    isSelfIntersecting,
    pointInPolygon,
    polygonAreaM2,
    polygonCentroid,
    polygonPerimeterM,
    polygonBounds,
    rectangleFromPolygonBounds,
    resizePolygonBounds,
    sanitizePolygon,
    validatePolygon,
} from './polygonGeometry';

describe('resizePolygonBounds', () => {
    it('convierte un cuadrado en rectangulo conservando su centro', () => {
        const resized = resizePolygonBounds(
            [
                { x: 0, y: 0 },
                { x: 2, y: 0 },
                { x: 2, y: 2 },
                { x: 0, y: 2 },
            ],
            6,
            3,
        );
        expect(polygonBounds(resized)).toMatchObject({ width: 6, height: 3 });
        expect(resized[0]).toEqual({ x: -2, y: -0.5 });
    });
});

describe('rectangleFromPolygonBounds', () => {
    it('convierte una forma libre en un rectangulo editable', () => {
        expect(
            rectangleFromPolygonBounds([
                { x: 1, y: 2 },
                { x: 5, y: 3 },
                { x: 4, y: 8 },
            ]),
        ).toEqual([
            { x: 1, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 8 },
            { x: 1, y: 8 },
        ]);
    });
});

/** Rectángulo del caso de referencia del bug de escalado: 8.000 m × 5.012 m */
const REFERENCE_RECT = [
    { x: 0, y: 0 },
    { x: 8.0, y: 0 },
    { x: 8.0, y: 5.012 },
    { x: 0, y: 5.012 },
];

describe('polygonAreaM2 — caso de referencia del plan (AC-001)', () => {
    it('un rectángulo de 8.000 × 5.012 m produce exactamente 40.096 m²', () => {
        expect(polygonAreaM2(REFERENCE_RECT)).toBeCloseTo(40.096, 9);
    });

    it('el área es idéntica sin importar orientación (horario vs antihorario)', () => {
        const reversed = [...REFERENCE_RECT].reverse();
        expect(polygonAreaM2(reversed)).toBeCloseTo(40.096, 9);
    });

    it('el área es invariante ante traslación (mover la cámara no cambia coordenadas de mundo)', () => {
        const translated = REFERENCE_RECT.map((v) => ({
            x: v.x + 123.456,
            y: v.y - 78.9,
        }));
        expect(polygonAreaM2(translated)).toBeCloseTo(40.096, 9);
    });

    it('acepta el anillo con vértice de cierre duplicado', () => {
        const closed = [...REFERENCE_RECT, { x: 0, y: 0 }];
        expect(polygonAreaM2(closed)).toBeCloseTo(40.096, 9);
    });

    it('NO reproduce el área errónea de 44.540 m² del bug reportado', () => {
        expect(polygonAreaM2(REFERENCE_RECT)).not.toBeCloseTo(44.54, 1);
    });
});

describe('polygonAreaM2 — degenerados', () => {
    it('menos de 3 vértices distintos → 0', () => {
        expect(polygonAreaM2([])).toBe(0);
        expect(polygonAreaM2([{ x: 0, y: 0 }])).toBe(0);
        expect(
            polygonAreaM2([
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ]),
        ).toBe(0);
    });

    it('vértices colineales → 0', () => {
        expect(
            polygonAreaM2([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 2 },
            ]),
        ).toBe(0);
    });

    it('coordenadas NaN se descartan sin producir NaN en el resultado', () => {
        const withNaN = [...REFERENCE_RECT, { x: NaN, y: 3 }];
        expect(Number.isFinite(polygonAreaM2(withNaN))).toBe(true);
    });

    it('un triángulo con precisión decimal completa (sin redondeo prematuro)', () => {
        // base 3.333333333, altura 2.222222222 → área = 3.7037037...
        const tri = [
            { x: 0, y: 0 },
            { x: 3.333333333, y: 0 },
            { x: 0, y: 2.222222222 },
        ];
        expect(polygonAreaM2(tri)).toBeCloseTo(
            (3.333333333 * 2.222222222) / 2,
            12,
        );
    });
});

describe('sanitizePolygon', () => {
    it('elimina duplicados consecutivos y el cierre repetido', () => {
        const dirty = [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 0 },
        ];
        expect(sanitizePolygon(dirty)).toHaveLength(3);
    });
});

describe('polygonPerimeterM', () => {
    it('perímetro del rectángulo de referencia = 2×(8+5.012)', () => {
        expect(polygonPerimeterM(REFERENCE_RECT)).toBeCloseTo(26.024, 9);
    });
});

describe('polygonCentroid', () => {
    it('centroide del rectángulo de referencia en su centro geométrico', () => {
        const c = polygonCentroid(REFERENCE_RECT)!;
        expect(c.x).toBeCloseTo(4.0, 9);
        expect(c.y).toBeCloseTo(2.506, 9);
    });
});

describe('pointInPolygon', () => {
    it('centro dentro, exterior fuera, borde dentro', () => {
        expect(pointInPolygon({ x: 4, y: 2.5 }, REFERENCE_RECT)).toBe(true);
        expect(pointInPolygon({ x: 9, y: 2.5 }, REFERENCE_RECT)).toBe(false);
        expect(pointInPolygon({ x: 8.0, y: 2.5 }, REFERENCE_RECT)).toBe(true);
    });

    it('polígono en L: agujero de la L queda fuera', () => {
        const ele = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 4 },
            { x: 0, y: 4 },
        ];
        expect(pointInPolygon({ x: 1, y: 3 }, ele)).toBe(true);
        expect(pointInPolygon({ x: 3, y: 3 }, ele)).toBe(false);
    });
});

describe('distanceToPolygonEdge', () => {
    it('distancia desde el centro al borde más próximo', () => {
        expect(
            distanceToPolygonEdge({ x: 4, y: 2.506 }, REFERENCE_RECT),
        ).toBeCloseTo(2.506, 9);
    });
});

describe('isSelfIntersecting / validatePolygon', () => {
    it('un cuadrado no se autointerseca; una pajarita sí', () => {
        expect(isSelfIntersecting(REFERENCE_RECT)).toBe(false);
        const bowtie = [
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
        ];
        expect(isSelfIntersecting(bowtie)).toBe(true);
        expect(validatePolygon(bowtie).warnings.length).toBeGreaterThan(0);
    });

    it('valida el rectángulo de referencia y rechaza polígonos degenerados', () => {
        expect(validatePolygon(REFERENCE_RECT).valid).toBe(true);
        expect(
            validatePolygon([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ]).valid,
        ).toBe(false);
        expect(
            validatePolygon([
                { x: 0, y: 0 },
                { x: NaN, y: 1 },
                { x: 2, y: 2 },
            ]).valid,
        ).toBe(false);
    });
});
