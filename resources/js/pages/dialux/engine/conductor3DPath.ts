export interface Conductor3DPoint {
    x: number;
    y: number;
    z: number;
}

function samePoint(a: Conductor3DPoint, b: Conductor3DPoint): boolean {
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Una subida, recorrido completo a la cota de ruta y una bajada final. */
export function buildConductor3DPath(
    nodes: Conductor3DPoint[],
    routeHeightM: number,
): Conductor3DPoint[] {
    if (nodes.length < 2) return [];

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const routeY = Math.max(0, routeHeightM);
    const path: Conductor3DPoint[] = [
        first,
        { x: first.x, y: routeY, z: first.z },
        ...nodes.slice(1, -1).map((node) => ({ x: node.x, y: routeY, z: node.z })),
        { x: last.x, y: routeY, z: last.z },
        last,
    ];

    return path.filter((point, index) => index === 0 || !samePoint(point, path[index - 1]));
}
