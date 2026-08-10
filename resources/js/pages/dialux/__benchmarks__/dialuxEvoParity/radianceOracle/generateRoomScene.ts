/**
 * Genera la geometría Radiance (.rad) de un ambiente rectangular simple:
 * caja de `width` (eje X) × `depth` (eje Y) × `height` (eje Z), con material
 * `plastic` puramente difuso (sin especular, sin rugosidad) por superficie,
 * usando la reflectancia declarada directamente como RGB — es el mapeo
 * estándar entre "reflectancia difusa" de DIALux/nuestro motor y `plastic`
 * de Radiance.
 *
 * El orden de vértices de cada polígono está elegido a propósito para que
 * la normal (regla de la mano derecha) apunte HACIA EL INTERIOR del
 * ambiente — verificado a mano con productos cruzados durante la Ronda 6
 * (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-6) antes de
 * codificarlo aquí; no cambiar el orden sin volver a verificar.
 *
 * LIMITACIÓN DECLARADA: solo caja rectangular simple, sin aberturas ni
 * mobiliario — suficiente para los fixtures de benchmark actuales
 * (`dialuxEvoParity/fixtures.ts`), que tampoco modelan eso. Si se agrega
 * un fixture con geometría no rectangular, esta función no aplica.
 */

import type { Vertex } from '@/pages/dialux/hooks/types';

export interface RoomSceneReflectance {
    ceiling: number;
    wall: number;
    floor: number;
}

export interface RoomSceneOptions {
    width: number;
    depth: number;
    height: number;
    reflectance: RoomSceneReflectance;
}

function plasticMaterial(name: string, reflectance: number): string {
    const r = reflectance.toFixed(3);
    return `void plastic ${name}\n0\n0\n5 ${r} ${r} ${r} 0 0\n`;
}

function polygon(materialName: string, polyName: string, vertices: Array<[number, number, number]>): string {
    const coords = vertices.map(([x, y, z]) => `${x} ${y} ${z}`).join('\n');
    return `${materialName} polygon ${polyName}\n0\n0\n${vertices.length * 3}\n${coords}\n`;
}

export function generateRoomScene(options: RoomSceneOptions): string {
    const { width: w, depth: d, height: h, reflectance } = options;

    const materials = [
        plasticMaterial('ceiling_mat', reflectance.ceiling),
        plasticMaterial('wall_mat', reflectance.wall),
        plasticMaterial('floor_mat', reflectance.floor),
    ];

    const surfaces = [
        polygon('floor_mat', 'floor', [
            [0, 0, 0],
            [w, 0, 0],
            [w, d, 0],
            [0, d, 0],
        ]),
        polygon('ceiling_mat', 'ceiling', [
            [0, 0, h],
            [0, d, h],
            [w, d, h],
            [w, 0, h],
        ]),
        polygon('wall_mat', 'wall_y0', [
            [0, 0, 0],
            [0, 0, h],
            [w, 0, h],
            [w, 0, 0],
        ]),
        polygon('wall_mat', 'wall_y1', [
            [0, d, 0],
            [w, d, 0],
            [w, d, h],
            [0, d, h],
        ]),
        polygon('wall_mat', 'wall_x0', [
            [0, 0, 0],
            [0, d, 0],
            [0, d, h],
            [0, 0, h],
        ]),
        polygon('wall_mat', 'wall_x1', [
            [w, 0, 0],
            [w, 0, h],
            [w, d, h],
            [w, d, 0],
        ]),
    ];

    return [...materials, ...surfaces].join('\n');
}

/**
 * Generalización de `generateRoomScene()` a un piso de forma ARBITRARIA
 * (polígono simple de N vértices, no solo un rectángulo) — terrenos reales
 * no siempre son rectangulares (planes/plan_cierre_brecha_paridad_dialux_evo.md
 * §-14: formas en L, pentagonales, trapezoidales). Función NUEVA, separada de
 * `generateRoomScene()` (que se deja intacta — tiene su propio test
 * geométrico verificado en la Ronda 6 con nombres de superficie fijos,
 * `wall_y0`/`wall_y1`/`wall_x0`/`wall_x1`, que no aplican a N lados).
 *
 * Regla de orientación derivada (y verificada) de `generateRoomScene()`:
 * si el piso se recorre en sentido antihorario (CCW, convención matemática
 * estándar XY, no de pantalla) su normal por regla de la mano derecha
 * apunta +Z (hacia arriba, al interior). De ahí se derivan sistemáticamente
 * las otras N+1 caras:
 *   - techo: los MISMOS vértices en orden INVERSO, a z=height → normal -Z.
 *   - pared del borde i→i+1: [Vi(z=0), Vi(z=h), Vi+1(z=h), Vi+1(z=0)] →
 *     normal hacia el interior (mismo patrón verificado para las 4 paredes
 *     de `generateRoomScene()`, válido para cualquier polígono simple, no
 *     solo rectángulos — es una propiedad local de cada arista, no depende
 *     de la convexidad del polígono completo).
 * `ensureCcw()` normaliza el orden de entrada para no depender de que quien
 * arma el fixture haya recordado la convención correcta.
 */
export interface PolygonRoomSceneOptions {
    vertices: Vertex[];
    height: number;
    reflectance: RoomSceneReflectance;
}

function signedArea(vertices: Vertex[]): number {
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]!;
        const b = vertices[(i + 1) % vertices.length]!;
        sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
}

/** Reordena a sentido antihorario (CCW) si el polígono de entrada viene en sentido horario. */
function ensureCcw(vertices: Vertex[]): Vertex[] {
    return signedArea(vertices) < 0 ? [...vertices].reverse() : vertices;
}

export function generatePolygonRoomScene(options: PolygonRoomSceneOptions): string {
    const { height: h, reflectance } = options;
    const floorVertices = ensureCcw(options.vertices);
    if (floorVertices.length < 3) {
        throw new Error('generatePolygonRoomScene: se necesitan al menos 3 vértices para definir un piso.');
    }

    const materials = [
        plasticMaterial('ceiling_mat', reflectance.ceiling),
        plasticMaterial('wall_mat', reflectance.wall),
        plasticMaterial('floor_mat', reflectance.floor),
    ];

    const surfaces = [
        polygon('floor_mat', 'floor', floorVertices.map((v): [number, number, number] => [v.x, v.y, 0])),
        polygon(
            'ceiling_mat',
            'ceiling',
            [...floorVertices].reverse().map((v): [number, number, number] => [v.x, v.y, h]),
        ),
    ];

    for (let i = 0; i < floorVertices.length; i++) {
        const vi = floorVertices[i]!;
        const vNext = floorVertices[(i + 1) % floorVertices.length]!;
        surfaces.push(
            polygon('wall_mat', `wall_${i}`, [
                [vi.x, vi.y, 0],
                [vi.x, vi.y, h],
                [vNext.x, vNext.y, h],
                [vNext.x, vNext.y, 0],
            ]),
        );
    }

    return [...materials, ...surfaces].join('\n');
}
