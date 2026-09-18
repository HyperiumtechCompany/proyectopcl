import { describe, expect, it } from 'vitest';
import {
    buildSpiralRampPolyline,
    buildStraightRampLayout,
    platformCotasUnder,
    stairAsRampConfig,
    U_TURN_GAP_M,
} from './rampLayout';
import type { RampConfig, SiteElement } from './types';

function baseRamp(overrides: Partial<RampConfig> = {}): RampConfig {
    return {
        kind: 'ramp',
        fromElevationM: 0,
        toElevationM: 3,
        widthM: 3,
        ...overrides,
    };
}

describe('site/domain/rampLayout', () => {
    it('sin flights genera un único tramo que cubre todo el desnivel (compatibilidad con rampas clásicas)', () => {
        const layout = buildStraightRampLayout(baseRamp());
        expect(layout).toHaveLength(1);
        expect(layout[0].endY - layout[0].startY).toBeCloseTo(3, 6);
    });

    it('encadena varios tramos con giros y acumula el desnivel total', () => {
        const layout = buildStraightRampLayout(
            baseRamp({
                flights: [
                    { id: 'f1', direction: 'north', lengthM: 10, riseM: 1.5, turnAfterDeg: 180 },
                    { id: 'f2', direction: 'north', lengthM: 10, riseM: 1.5 },
                ],
            }),
        );
        // Dos tramos + el descanso de la vuelta en U + el descanso de llegada.
        expect(layout.map((seg) => seg.kind)).toEqual(['flight', 'landing', 'flight', 'landing']);
        const [first, landing, second] = layout;
        // El giro de 180° hace que el segundo tramo avance en sentido opuesto al primero.
        const dx1 = first.endLocal.x - first.startLocal.x;
        const dz1 = first.endLocal.z - first.startLocal.z;
        const dx2 = second.endLocal.x - second.startLocal.x;
        const dz2 = second.endLocal.z - second.startLocal.z;
        expect(dx1 + dx2).toBeCloseTo(0, 6);
        expect(dz1 + dz2).toBeCloseTo(0, 6);
        // El segundo tramo termina 3 m más arriba del inicio del primero.
        expect(second.endY - first.startY).toBeCloseTo(3, 6);
        expect(landing.startY).toBeCloseTo(landing.endY, 6);
    });

    it('una vuelta en U deja el segundo tramo AL LADO del primero (no encima) con un descanso que abarca ambos', () => {
        const width = 1.2;
        const layout = buildStraightRampLayout(
            baseRamp({
                widthM: width,
                flights: [
                    { id: 'f1', direction: 'north', lengthM: 8, riseM: 0.6, landingLengthM: 1.5, turnAfterDeg: 180 },
                    { id: 'f2', direction: 'north', lengthM: 8, riseM: 0.6 },
                ],
            }),
        );
        const [first, landing, second] = layout;
        // Separación lateral entre ejes = ancho + separación entre tramos.
        const lateral = Math.abs(second.startLocal.x - first.startLocal.x);
        expect(lateral).toBeCloseTo(width + U_TURN_GAP_M, 6);
        // Al ser vertical el eje (norte), no hay desplazamiento a lo largo del avance entre inicios: ambos parten del mismo borde.
        expect(second.startLocal.z).toBeCloseTo(first.endLocal.z, 6);
        // El descanso cubre los dos tramos y mide al menos 1.50 m de fondo.
        expect(landing.widthM).toBeCloseTo(width * 2 + U_TURN_GAP_M, 6);
        const landingDepth = Math.hypot(
            landing.endLocal.x - landing.startLocal.x,
            landing.endLocal.z - landing.startLocal.z,
        );
        expect(landingDepth).toBeGreaterThanOrEqual(1.5 - 1e-9);
    });

    it('tres tramos con vueltas en U avanzan siempre hacia el mismo lado (no vuelven sobre el primero)', () => {
        const flights = Array.from({ length: 3 }, (_, i) => ({
            id: 'f' + i,
            direction: 'north' as const,
            lengthM: 8,
            riseM: 0.5,
            turnAfterDeg: i < 2 ? 180 : 0,
        }));
        const layout = buildStraightRampLayout(baseRamp({ widthM: 1.2, flights }));
        const xs = layout
            .filter((seg) => seg.kind === 'flight')
            .map((seg) => seg.startLocal.x);
        expect(xs[1]).not.toBeCloseTo(xs[0], 3);
        expect(xs[2]).not.toBeCloseTo(xs[1], 3);
        expect(xs[2]).not.toBeCloseTo(xs[0], 3);
        expect(Math.sign(xs[1] - xs[0])).toBe(Math.sign(xs[2] - xs[1]));
    });

    it('invertir el recorrido intercambia INICIO y FIN sin cambiar las cotas: sigue subiendo de la cota origen a la destino', () => {
        const cfg = baseRamp({
            widthM: 1.2,
            fromElevationM: 0,
            toElevationM: 1.2,
            flights: [
                { id: 'f1', direction: 'north', lengthM: 8, riseM: 0.6, landingLengthM: 1.5, turnAfterDeg: 180 },
                { id: 'f2', direction: 'north', lengthM: 8, riseM: 0.6 },
            ],
        });
        const normal = buildStraightRampLayout(cfg);
        const reversed = buildStraightRampLayout({ ...cfg, reversed: true });
        const normalFlights = normal.filter((seg) => seg.kind === 'flight');
        const reversedFlights = reversed.filter((seg) => seg.kind === 'flight');
        // El nuevo INICIO está donde antes estaba el FIN, y parte de la cota 0.
        expect(reversedFlights[0].startLocal.x).toBeCloseTo(normalFlights[1].endLocal.x, 6);
        expect(reversedFlights[0].startLocal.z).toBeCloseTo(normalFlights[1].endLocal.z, 6);
        expect(reversedFlights[0].startY).toBeCloseTo(0, 6);
        // Y el nuevo FIN está donde antes estaba el INICIO, en la cota destino (+1.2).
        const last = reversedFlights[reversedFlights.length - 1];
        expect(last.endLocal.x).toBeCloseTo(normalFlights[0].startLocal.x, 6);
        expect(last.endY).toBeCloseTo(1.2, 6);
        // Todos los tramos siguen subiendo y el descanso queda plano.
        for (const seg of reversedFlights) {
            expect(seg.endY).toBeGreaterThan(seg.startY);
        }
        const landing = reversed.find((seg) => seg.kind === 'landing');
        expect(landing?.startY).toBeCloseTo(landing?.endY ?? -1, 6);
    });

    it('propone las cotas de las plataformas que toca la rampa, de baja a alta', () => {
        const mk = (id: string, z: number, x0: number): SiteElement => ({
            id,
            type: 'terrace_platform',
            label: id,
            baseElevationM: z,
            vertices: [
                { x: x0, y: 0 },
                { x: x0 + 10, y: 0 },
                { x: x0 + 10, y: 10 },
                { x: x0, y: 10 },
            ],
            style: { fillColor: '#fff', strokeColor: '#000' },
        });
        const ramp = [
            { x: 8, y: 2 },
            { x: 14, y: 2 },
            { x: 14, y: 6 },
            { x: 8, y: 6 },
        ];
        expect(
            platformCotasUnder(ramp, [mk('a', 3.5, 10), mk('b', 0, 0), mk('c', -3.35, 100)]),
        ).toEqual([0, 3.5]);
        expect(platformCotasUnder(ramp, [])).toEqual([]);
    });

    it('cierra la rampa con un descanso de llegada plano de 1.50 m a la cota final, también al invertir el recorrido', () => {
        const cfg = baseRamp({
            widthM: 1.2,
            fromElevationM: 0,
            toElevationM: 1.2,
            flights: [
                { id: 'f1', direction: 'north', lengthM: 8, riseM: 0.6, landingLengthM: 1.5, turnAfterDeg: 180 },
                { id: 'f2', direction: 'north', lengthM: 8, riseM: 0.6 },
            ],
        });
        for (const reversed of [false, true]) {
            const layout = buildStraightRampLayout({ ...cfg, reversed });
            const last = layout[layout.length - 1];
            expect(last.role).toBe('arrival');
            expect(last.startY).toBeCloseTo(1.2, 6);
            expect(last.endY).toBeCloseTo(1.2, 6);
            const depth = Math.hypot(
                last.endLocal.x - last.startLocal.x,
                last.endLocal.z - last.startLocal.z,
            );
            expect(depth).toBeCloseTo(1.5, 6);
        }
        // Se puede quitar con 0.
        const none = buildStraightRampLayout({ ...cfg, arrivalLandingM: 0 });
        expect(none.some((seg) => seg.role === 'arrival')).toBe(false);
    });

    it('una escalera de 20 peldaños se arma como dos tramos al lado con descanso y descanso de llegada', () => {
        const cfg = stairAsRampConfig(
            { kind: 'stair', fromElevationM: 0, toElevationM: 3.5, widthM: 1.2, run: 'straight' },
            'east',
        );
        const layout = buildStraightRampLayout(cfg);
        expect(layout.map((seg) => seg.kind)).toEqual(['flight', 'landing', 'flight', 'landing']);
        expect(layout[layout.length - 1].role).toBe('arrival');
        expect(layout[layout.length - 1].endY).toBeCloseTo(3.5, 2);
    });

    it('escalera recta con descanso: los dos tramos quedan en línea (mismo eje) y el descanso del medio no cierra el paso', () => {
        const layout = buildStraightRampLayout(
            stairAsRampConfig(
                { kind: 'stair', fromElevationM: 0, toElevationM: 3.5, widthM: 1.2, run: 'straight' },
                'east',
            ),
        );
        const [first, landing, second, arrival] = layout;
        // Mismo eje: misma z en los dos tramos; el segundo continúa donde acaba el descanso.
        expect(second.startLocal.z).toBeCloseTo(first.startLocal.z, 6);
        expect(second.startLocal.x).toBeCloseTo(landing.endLocal.x, 6);
        expect(landing.role).toBe('through');
        expect(landing.widthM).toBeCloseTo(1.2, 6);
        expect(arrival.role).toBe('arrival');
    });

    it('escalera en L: el segundo tramo sale perpendicular por el costado del descanso cuadrado', () => {
        const layout = buildStraightRampLayout(
            stairAsRampConfig(
                { kind: 'stair', fromElevationM: 0, toElevationM: 3.5, widthM: 1.2, run: 'L' },
                'east',
            ),
        );
        const [first, landing, second] = layout;
        expect(landing.role).toBe('corner');
        const depth = Math.hypot(
            landing.endLocal.x - landing.startLocal.x,
            landing.endLocal.z - landing.startLocal.z,
        );
        expect(depth).toBeGreaterThanOrEqual(1.2 - 1e-9);
        const dx1 = first.endLocal.x - first.startLocal.x;
        const dz1 = first.endLocal.z - first.startLocal.z;
        const dx2 = second.endLocal.x - second.startLocal.x;
        const dz2 = second.endLocal.z - second.startLocal.z;
        // Perpendiculares: producto punto ≈ 0.
        expect(dx1 * dx2 + dz1 * dz2).toBeCloseTo(0, 6);
    });

    it('al invertir el recorrido el descanso conserva su orientación (sus bordes abiertos/cerrados no cambian de lugar)', () => {
        const cfg = stairAsRampConfig(
            { kind: 'stair', fromElevationM: 0, toElevationM: 3.5, widthM: 1.2, run: 'U' },
            'east',
        );
        const normal = buildStraightRampLayout(cfg).find((seg) => seg.role === 'turn');
        const reversed = buildStraightRampLayout({ ...cfg, reversed: true }).find(
            (seg) => seg.role === 'turn',
        );
        // Mismo vector de orientación (el centrado global puede desplazar ambos por igual).
        expect((reversed?.endLocal.x ?? NaN) - (reversed?.startLocal.x ?? NaN)).toBeCloseTo((normal?.endLocal.x ?? NaN) - (normal?.startLocal.x ?? NaN), 6);
        expect((reversed?.endLocal.z ?? NaN) - (reversed?.startLocal.z ?? NaN)).toBeCloseTo((normal?.endLocal.z ?? NaN) - (normal?.startLocal.z ?? NaN), 6);
    });

    it('agrega un descanso plano (mismo Y en ambos extremos) cuando el tramo lo pide', () => {
        const layout = buildStraightRampLayout(
            baseRamp({
                flights: [
                    { id: 'f1', direction: 'north', lengthM: 10, riseM: 1.5, landingLengthM: 2 },
                ],
            }),
        );
        // Tramo + su descanso propio (el último tramo ya trae descanso: no se agrega otro de llegada).
        expect(layout).toHaveLength(2);
        expect(layout[1].kind).toBe('landing');
        expect(layout[1].startY).toBeCloseTo(layout[1].endY, 6);
    });

    it('la espiral completa el desnivel total al final del recorrido y respeta el radio de la huella', () => {
        const points = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 2, widthM: 4 }),
            10,
        );
        expect(points[0].y).toBeCloseTo(0, 6);
        expect(points[points.length - 1].y).toBeCloseTo(3, 6);
        const maxRadius = Math.max(...points.map((p) => Math.hypot(p.x, p.z)));
        expect(maxRadius).toBeLessThanOrEqual(10 + 1e-6);
    });

    it('la espiral en sentido antihorario gira en dirección opuesta a la horaria', () => {
        const cw = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 0.25, clockwise: true }),
            10,
        );
        const ccw = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 0.25, clockwise: false }),
            10,
        );
        expect(cw[cw.length - 1].z).toBeCloseTo(-ccw[ccw.length - 1].z, 6);
    });
});
