export interface StairLane {
    center: number;
    width: number;
}

export const DEFAULT_STRUCTURAL_SLAB_THICKNESS = 0.2;

export type CorridorRenderType =
    | 'roof_only'
    | 'normal'
    | 'roof_floor'
    | 'concrete_railings'
    | 'metal_railings';

export interface CorridorRenderFlags {
    hasRoof: boolean;
    hasFloor: boolean;
    railingMaterial: 'concrete' | 'metal' | null;
}

export function getCorridorRenderFlags(
    corridorType: CorridorRenderType = 'roof_only',
): CorridorRenderFlags {
    if (corridorType === 'concrete_railings') {
        return {
            hasRoof: true,
            hasFloor: true,
            railingMaterial: 'concrete',
        };
    }

    if (corridorType === 'metal_railings') {
        return {
            hasRoof: true,
            hasFloor: true,
            railingMaterial: 'metal',
        };
    }

    if (corridorType === 'normal' || corridorType === 'roof_floor') {
        return {
            hasRoof: true,
            hasFloor: true,
            railingMaterial: null,
        };
    }

    return {
        hasRoof: true,
        hasFloor: false,
        railingMaterial: null,
    };
}

export function getFloorToFloorStackHeight(
    clearHeight: number,
    slabThickness = DEFAULT_STRUCTURAL_SLAB_THICKNESS,
): number {
    const safeClearHeight =
        Number.isFinite(clearHeight) && clearHeight > 0 ? clearHeight : 0;
    const safeSlabThickness =
        Number.isFinite(slabThickness) && slabThickness > 0
            ? slabThickness
            : 0;

    return Math.max(0.05, safeClearHeight + safeSlabThickness);
}

export function getStairFlightGap(gap?: number): number {
    return Math.max(0, Number.isFinite(gap) ? (gap ?? 0) : 0);
}

export function getStairLaneLayout(
    totalSpan: number,
    laneCount: number,
    preferredLaneWidth: number,
    flightGap?: number,
    fillAvailableSpan = false,
): StairLane[] {
    const count = Math.max(1, Math.floor(laneCount));
    const gap =
        count > 1
            ? Math.min(getStairFlightGap(flightGap), totalSpan / (count - 1))
            : 0;
    const usableSpan = Math.max(0, totalSpan - gap * (count - 1));
    const laneSpan = usableSpan / count;
    const width = Math.max(
        0.1,
        fillAvailableSpan ? laneSpan : Math.min(preferredLaneWidth, laneSpan),
    );

    return Array.from({ length: count }, (_, index) => ({
        center: laneSpan / 2 + index * (laneSpan + gap),
        width,
    }));
}

export function getFittedStairTreadDepth(
    totalRun: number,
    stepCount: number,
    preferredTreadDepth: number,
    landingDepth = 0,
): number {
    const usableRun = totalRun - Math.max(0, landingDepth);
    const safeStepCount = Math.max(1, Math.floor(stepCount));

    if (!Number.isFinite(usableRun) || usableRun <= 0) {
        return Math.max(0.05, preferredTreadDepth);
    }

    return Math.max(0.05, usableRun / safeStepCount);
}

export function getPostLandingCursorOffset(
    landingDepth: number,
    directionSign: number,
    isUTurnLanding: boolean,
): number {
    return isUTurnLanding ? 0 : directionSign * Math.max(0, landingDepth);
}
