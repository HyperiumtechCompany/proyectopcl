declare module 'polylabel' {
    /** Un anillo: outer ring primero, holes despues (mismo formato que polygon-clipping). */
    type PolylabelRing = [number, number][];
    interface PolylabelResult extends Array<number> {
        0: number;
        1: number;
        distance: number;
    }
    /** Pole of inaccessibility: punto mas alejado del borde del poligono (incluye holes). */
    export default function polylabel(
        polygon: PolylabelRing[],
        precision?: number,
        debug?: boolean,
    ): PolylabelResult;
}
