/**
 * deletionPolicy.ts — Política de eliminación protegida para contenedores.
 *
 * Reglas:
 *  - Dispositivos (luminaria, interruptor, tomacorriente, cable, etc.) se
 *    eliminan directo: solo el ID seleccionado; nunca arrastran a su contenedor.
 *  - Contenedores (recintos/ambientes) y muros con aberturas son operaciones
 *    protegidas: nunca se elimina en cascada de forma implícita. El llamador
 *    debe mostrar la confirmación y elegir el modo explícitamente.
 */

import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { Scene } from '@/pages/dialux/hooks/types';

export interface DeletionChild {
    id: string;
    kind: 'fixture' | 'switch' | 'electrical-device' | 'window' | 'door' | 'conductor';
    label: string;
}

export type DeletionTargetKind =
    | 'room'
    | 'wall'
    | 'fixture'
    | 'switch'
    | 'electrical-device'
    | 'window'
    | 'door'
    | 'conductor'
    | 'canopy'
    | 'partition'
    | 'junction-box'
    | 'structural-obstacle'
    | 'unknown';

export interface DeletionAnalysis {
    id: string;
    kind: DeletionTargetKind;
    label: string;
    /** true → nunca borrar sin confirmación explícita del usuario */
    requiresConfirmation: boolean;
    /** Objetos que dependen del objetivo (se perderían o quedarían huérfanos) */
    children: DeletionChild[];
}

/** Modo elegido por el usuario en la confirmación de un contenedor. */
export type ContainerDeletionMode = 'container-only' | 'cascade';

export function analyzeDeletion(scene: Scene, id: string): DeletionAnalysis {
    const room = scene.rooms.find((r) => r.id === id);
    if (room) {
        const children: DeletionChild[] = [];
        for (const f of scene.fixtures ?? []) {
            const belongs =
                (f.roomId && (f.roomId === id || f.roomId.startsWith(id))) ||
                (room.vertices.length >= 3 && pointInPolygon({ x: f.x, y: f.y }, room.vertices));
            if (belongs) children.push({ id: f.id, kind: 'fixture', label: f.name ?? 'Luminaria' });
        }
        if (room.vertices.length >= 3) {
            for (const s of scene.lightSwitches ?? []) {
                if (pointInPolygon({ x: s.x, y: s.y }, room.vertices)) {
                    children.push({ id: s.id, kind: 'switch', label: s.label ?? 'Interruptor' });
                }
            }
            for (const d of scene.electricalDevices ?? []) {
                if (pointInPolygon({ x: d.x, y: d.y }, room.vertices)) {
                    children.push({ id: d.id, kind: 'electrical-device', label: d.label ?? 'Dispositivo' });
                }
            }
        }
        const isEnclosure = !room.roomType || room.roomType === 'room';
        return {
            id,
            kind: 'room',
            label: room.name,
            // Contenedores con hijos: SIEMPRE protegido. Recintos (envolvente):
            // protegido aunque estén vacíos, porque delimitan el proyecto.
            requiresConfirmation: children.length > 0 || isEnclosure,
            children,
        };
    }

    const wall = scene.walls.find((w) => w.id === id);
    if (wall) {
        const children: DeletionChild[] = [
            ...(scene.windows ?? [])
                .filter((w) => w.wallId === id)
                .map((w): DeletionChild => ({ id: w.id, kind: 'window', label: 'Ventana' })),
            ...(scene.doors ?? [])
                .filter((d) => d.wallId === id)
                .map((d): DeletionChild => ({ id: d.id, kind: 'door', label: 'Puerta' })),
        ];
        return {
            id,
            kind: 'wall',
            label: 'Muro',
            requiresConfirmation: children.length > 0,
            children,
        };
    }

    const direct = (kind: DeletionTargetKind, label: string): DeletionAnalysis => ({
        id,
        kind,
        label,
        requiresConfirmation: false,
        children: [],
    });

    const fixture = scene.fixtures.find((f) => f.id === id);
    if (fixture) return direct('fixture', fixture.name ?? 'Luminaria');
    const sw = (scene.lightSwitches ?? []).find((s) => s.id === id);
    if (sw) return direct('switch', sw.label ?? 'Interruptor');
    const dev = (scene.electricalDevices ?? []).find((d) => d.id === id);
    if (dev) return direct('electrical-device', dev.label ?? 'Dispositivo eléctrico');
    const win = (scene.windows ?? []).find((w) => w.id === id);
    if (win) return direct('window', 'Ventana');
    const door = (scene.doors ?? []).find((d) => d.id === id);
    if (door) return direct('door', 'Puerta');
    const cond = (scene.conductors ?? []).find((c) => c.id === id);
    if (cond) return direct('conductor', 'Cable');
    const can = (scene.canopies ?? []).find((c) => c.id === id);
    if (can) return direct('canopy', 'Marquesina');
    const part = (scene.partitions ?? []).find((p) => p.id === id);
    if (part) return direct('partition', 'Tabique');
    const jb = (scene.junctionBoxes ?? []).find((j) => j.id === id);
    if (jb) return direct('junction-box', 'Caja de paso');
    // Borrado directo: no arrastra "hijos" en el sentido de deletionPolicy
    // (nada depende geometricamente del obstaculo). El store SI recalcula la
    // grilla de luminarias del room afectado al eliminarlo (ver
    // recomputeFixtureGridsNearObstacle en sceneObjectsSlice.ts) -- eso es
    // responsabilidad del motor de calculo, no una cascada de borrado.
    const obstacle = (scene.structuralObstacles ?? []).find((o) => o.id === id);
    if (obstacle) return direct('structural-obstacle', obstacle.name);

    return direct('unknown', 'Objeto');
}
