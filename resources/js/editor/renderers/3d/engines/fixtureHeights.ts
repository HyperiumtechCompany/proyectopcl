import type {
    Fixture,
    Room,
    Wall,
} from '@/hooks/dialux/useEditorStore';

const DEFAULT_CEILING_CLEARANCE = 0.08;
const PENDANT_CEILING_CLEARANCE = 0.45;
const MIN_FIXTURE_HEIGHT = 0.2;

export function resolveRoomCeilingHeight(room: Room, walls: Wall[]): number {
    const wallHeights = walls
        .map((wall) => wall.height)
        .filter((height) => Number.isFinite(height) && height > 0);

    if (wallHeights.length === 0) {
        return room.height;
    }

    return Math.min(room.height, Math.max(...wallHeights));
}

export function resolveFixtureRenderHeight(
    fixture: Pick<Fixture, 'z' | 'fixtureType'>,
    ceilingHeight?: number,
): number {
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
