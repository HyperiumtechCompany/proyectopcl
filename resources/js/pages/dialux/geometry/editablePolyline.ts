import type { Vertex } from '@/pages/dialux/hooks/types';

export function movePolygonVertex(
    vertices: Vertex[],
    index: number,
    point: Vertex,
): Vertex[] {
    if (index < 0 || index >= vertices.length) return vertices;
    return vertices.map((vertex, currentIndex) =>
        currentIndex === index ? { ...point } : vertex,
    );
}

export function insertPolygonEdgeMidpoint(
    vertices: Vertex[],
    edgeIndex: number,
): { vertices: Vertex[]; insertedIndex: number } {
    if (vertices.length < 2 || edgeIndex < 0 || edgeIndex >= vertices.length) {
        return { vertices, insertedIndex: -1 };
    }
    const start = vertices[edgeIndex];
    const end = vertices[(edgeIndex + 1) % vertices.length];
    const insertedIndex = edgeIndex + 1;
    const next = [...vertices];
    next.splice(insertedIndex, 0, {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
    });
    return { vertices: next, insertedIndex };
}
