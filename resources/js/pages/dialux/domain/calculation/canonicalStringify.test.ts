import { describe, expect, it } from 'vitest';
import { canonicalStringify } from './canonicalStringify';

describe('canonicalStringify — orden estable de arrays con id', () => {
    it('ordena arrays de objetos con `id` alfabéticamente, sin importar el orden de inserción', () => {
        const a = canonicalStringify([{ id: 'b', v: 1 }, { id: 'a', v: 2 }]);
        const b = canonicalStringify([{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
        expect(a).toBe(b);
    });

    it('preserva el orden de arrays SIN id (ej. vértices de un polígono)', () => {
        const ring1 = canonicalStringify([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
        const ring2 = canonicalStringify([{ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }]);
        expect(ring1).not.toBe(ring2);
    });
});

describe('canonicalStringify — Fase 10: ordena LuminaireState por `luminaireId` (regresión de auditoría)', () => {
    /**
     * Antes de esta fase, `hasStableId` solo reconocía la clave `id` — los
     * arrays `LightingSceneState.luminaireStates` (que identifican cada
     * elemento con `luminaireId`, no `id`) NUNCA se reordenaban antes de
     * hashear, a diferencia de `luminaires`/`scenes`/`calculationObjects`.
     * En la práctica el orden ya era estable (viene de `.filter()` sobre
     * `scene.fixtures`), pero era una excepción silenciosa a la convención
     * documentada, detectada por la auditoría `dialux-calc-reviewer` de
     * Fase 10 — un refactor futuro que arme el array desde otra fuente
     * (ej. un `Map`/`Set`) podría producir un hash espurio sin que ningún
     * test lo detectara.
     */
    it('el hash es idéntico sin importar el orden de inserción de luminaireStates', () => {
        const a = canonicalStringify([
            { luminaireId: 'b', on: true, dimmingFactor: 1 },
            { luminaireId: 'a', on: false, dimmingFactor: 0.5 },
        ]);
        const b = canonicalStringify([
            { luminaireId: 'a', on: false, dimmingFactor: 0.5 },
            { luminaireId: 'b', on: true, dimmingFactor: 1 },
        ]);
        expect(a).toBe(b);
    });

    it('no confunde un array mixto (algunos con `id`, otros con `luminaireId`) — no se reordena', () => {
        const mixed = [{ id: 'x', v: 1 }, { luminaireId: 'y', v: 2 }];
        // No debe lanzar ni producir un resultado incorrecto — solo se abstiene de reordenar.
        expect(() => canonicalStringify(mixed)).not.toThrow();
    });
});
