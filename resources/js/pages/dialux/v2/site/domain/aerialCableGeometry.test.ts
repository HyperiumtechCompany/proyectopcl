import { describe, expect, it } from 'vitest';
import {
    catenaryLength,
    catenaryParameter,
    catenaryProfile,
    feederLengthBreakdown,
    feederPathLengthM,
} from './aerialCableGeometry';
import type { FeederPath } from './types';

describe('site/domain/aerialCableGeometry', () => {
    it('la flecha obtenida al resolver la catenaria coincide con la pedida', () => {
        const a = catenaryParameter(30, 0.9);
        const sag = a * (Math.cosh(30 / (2 * a)) - 1);
        expect(sag).toBeCloseTo(0.9, 6);
    });

    it('longitud colgada ≈ vano + 8·f²/(3·vano) para flechas pequeñas', () => {
        const span = 40;
        const sag = 1.2; // 3 %
        const approx = span + (8 * sag * sag) / (3 * span);
        expect(catenaryLength(span, sag)).toBeCloseTo(approx, 2);
        expect(catenaryLength(span, sag)).toBeGreaterThan(span);
        expect(catenaryLength(span, 0)).toBe(span);
    });

    it('el perfil baja `sag` en el centro y 0 en los amarres', () => {
        const profile = catenaryProfile(20, 0.6, 10);
        expect(profile[0].drop).toBeCloseTo(0, 9);
        expect(profile[10].drop).toBeCloseTo(0, 9);
        expect(Math.min(...profile.map((p) => p.drop))).toBeCloseTo(-0.6, 6);
    });

    it('aéreo: catenaria de cada vano + subida y bajada al amarre', () => {
        const waypoints = [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 60, y: 0 },
        ];
        const r = feederLengthBreakdown(waypoints, 1, {
            kind: 'aerial',
            mountHeightM: 7,
        });
        expect(r.planM).toBeCloseTo(60);
        expect(r.verticalM).toBe(14);
        expect(r.totalM).toBeCloseTo(60 + r.sagExtraM + 14, 9);
        expect(r.sagExtraM).toBeGreaterThan(0);
    });

    it('subterráneo: recta + 2·prof. en extremos + 2·prof. por caja de paso', () => {
        const r = feederLengthBreakdown(
            [
                { x: 0, y: 0 },
                { x: 0, y: 50 },
            ],
            1,
            {
                kind: 'underground',
                depthM: 0.8,
                junctionBoxes: [{ x: 0, y: 25 }],
            },
        );
        expect(r.totalM).toBeCloseTo(50 + 1.6 + 1.6);
    });

    it('mixto: un tramo aéreo y otro por el suelo suman catenaria, bajada del poste y zanja', () => {
        const waypoints = [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 30, y: 40 },
        ];
        const r = feederLengthBreakdown(
            waypoints,
            1,
            { kind: 'aerial', mountHeightM: 7, depthM: 0.5 },
            ['aerial', 'underground'],
        );
        // extremos: amarre (7) + zanja (0.5); cambio de modo en el poste: 7 + 0.5
        expect(r.verticalM).toBeCloseTo(7 + 0.5 + 7 + 0.5);
        expect(r.planM).toBeCloseTo(70);
        expect(r.sagExtraM).toBeGreaterThan(0);
        expect(r.totalM).toBeCloseTo(70 + r.sagExtraM + r.verticalM, 9);
    });

    it('todo por el suelo con segmentModes equivale al tendido subterráneo clásico', () => {
        const w = [
            { x: 0, y: 0 },
            { x: 0, y: 50 },
        ];
        const a = feederLengthBreakdown(w, 1, {
            kind: 'underground',
            depthM: 0.8,
        });
        const b = feederLengthBreakdown(w, 1, undefined, ['underground']);
        expect(b.planM).toBe(a.planM);
        expect(b.verticalM).toBeCloseTo(1.2); // profundidad por defecto 0.6 en cada extremo
    });

    it('sin ruta y a escala 1 respeta calculatedLengthM; con escala usa los waypoints', () => {
        const path: FeederPath = {
            id: 'p',
            networkEdgeId: 'e',
            waypoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            calculatedLengthM: 10,
        };
        expect(feederPathLengthM(path, 1)).toBe(10);
        expect(feederPathLengthM(path, 2)).toBeCloseTo(20);
    });

    it('suma subidas y bajadas entre plataformas más la reserva de tendido', () => {
        const r = feederLengthBreakdown(
            [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 20, y: 0 },
            ],
            1,
            undefined,
            undefined,
            [0, 3.5, 1],
            5,
        );

        expect(r.planM).toBe(20);
        expect(r.levelChangeM).toBe(6);
        expect(r.subtotalM).toBe(26);
        expect(r.wasteM).toBeCloseTo(1.3);
        expect(r.totalM).toBeCloseTo(27.3);
    });
});
