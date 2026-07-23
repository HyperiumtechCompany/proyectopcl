import type { Vertex } from './types';

export type OutletUse = 'aula' | 'comedor' | 'exterior';

export const OUTLET_RULES: Record<OutletUse, {
    label: string;
    method: 'area' | 'perimeter';
    divisor: number;
    description: string;
}> = {
    aula: { label: 'Aula', method: 'area', divisor: 10, description: '1 por cada 10 m²' },
    comedor: { label: 'Comedor', method: 'area', divisor: 15, description: '1 por cada 15 m²' },
    exterior: { label: 'Exterior', method: 'perimeter', divisor: 9, description: 'separación máxima 9 m' },
};

export function polygonArea(vertices: Vertex[]): number {
    if (vertices.length < 3) return 0;
    return Math.abs(vertices.reduce((sum, point, index) => {
        const next = vertices[(index + 1) % vertices.length];
        return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
}

export function polygonPerimeter(vertices: Vertex[]): number {
    if (vertices.length < 2) return 0;
    return vertices.reduce((sum, point, index) => {
        const next = vertices[(index + 1) % vertices.length];
        return sum + Math.hypot(next.x - point.x, next.y - point.y);
    }, 0);
}

export function requiredOutletCount(vertices: Vertex[], use: OutletUse): number {
    const rule = OUTLET_RULES[use];
    const measurement = rule.method === 'area' ? polygonArea(vertices) : polygonPerimeter(vertices);
    return measurement > 0 ? Math.ceil(measurement / rule.divisor) : 0;
}

/** Distribuye los puntos uniformemente sobre los muros del polígono. */
export function distributeOutletsOnPerimeter(vertices: Vertex[], count: number, startOffset?: number): Vertex[] {
    const perimeter = polygonPerimeter(vertices);
    if (count <= 0 || perimeter <= 0) return [];

    const spacing = perimeter / count;
    return Array.from({ length: count }, (_, index) => {
        let distance = ((startOffset ?? spacing / 2) + index * spacing) % perimeter;
        for (let edge = 0; edge < vertices.length; edge += 1) {
            const start = vertices[edge];
            const end = vertices[(edge + 1) % vertices.length];
            const length = Math.hypot(end.x - start.x, end.y - start.y);
            if (distance <= length || edge === vertices.length - 1) {
                const ratio = length > 0 ? Math.min(distance / length, 1) : 0;
                return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
            }
            distance -= length;
        }
        return vertices[0];
    });
}
