import type {
    Fixture,
    Room,
    Wall,
} from '@/pages/dialux/hooks/useEditorStore';

const DEFAULT_CEILING_CLEARANCE = 0.08;
const PENDANT_CEILING_CLEARANCE = 0.45;
const MIN_FIXTURE_HEIGHT = 0.2;
/** Las luminarias de emergencia siempre se montan a esta altura fija, sin importar el techo. */
const EMERGENCY_MOUNTING_HEIGHT = 2.2;

/**
 * Por debajo de esta fracción de `room.height`, una pared más baja que el
 * recinto deja de tratarse como techo visible intencional (soffito, viga,
 * sección rebajada) y pasa a tratarse como dato sin sincronizar — altura por
 * defecto al dibujar la pared, nunca actualizada para igualar la altura real
 * del recinto. Confiar en ella sin este piso montaba luminarias pegadas al
 * "techo" equivocado en recintos altos (ej. pared en 2.78 m con recinto real
 * en 4.670 m), acercando la luminaria al plano de trabajo y disparando la
 * iluminancia muy por encima del valor real de DIALux.
 */
const WALL_CEILING_TRUST_RATIO = 0.75;

export function resolveRoomCeilingHeight(room: Room, walls: Wall[]): number {
    const wallHeights = walls
        .map((wall) => wall.height)
        .filter((height) => Number.isFinite(height) && height > 0);

    if (wallHeights.length === 0) {
        return room.height;
    }

    const tallestWall = Math.max(...wallHeights);
    if (tallestWall < room.height * WALL_CEILING_TRUST_RATIO) {
        return room.height;
    }

    return Math.min(room.height, tallestWall);
}

export function resolveFixtureRenderHeight(
    fixture: Pick<Fixture, 'z' | 'fixtureType' | 'emergencyType'>,
    ceilingHeight?: number,
): number {
    if (fixture.emergencyType && fixture.emergencyType !== 'none') {
        return EMERGENCY_MOUNTING_HEIGHT;
    }

    const requestedHeight = Number.isFinite(fixture.z)
        ? fixture.z
        : ceilingHeight ?? 2.4;

    if (!ceilingHeight) {
        return requestedHeight;
    }

    const clearance =
        fixture.fixtureType === 'pendant'
            ? PENDANT_CEILING_CLEARANCE
            : DEFAULT_CEILING_CLEARANCE;
    const maxHeight = Math.max(MIN_FIXTURE_HEIGHT, ceilingHeight - clearance);

    return Math.min(requestedHeight, maxHeight);
}
