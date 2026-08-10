import type { Canopy, Door, DxfEntity, Room, Wall, Window as SceneWindow } from '@/pages/dialux/hooks/types';
import { centroid, ptAlongPoly } from '../geometry/polylineGeometry';
import { dxfArc, dxfCircle, dxfLine, dxfPolyLines, dxfText, type DxfLines, type Pt } from './primitives';

/**
 * Fondo arquitectónico de un nivel (recintos, muros, ventanas, puertas,
 * coberturas, CAD importado) — extraído de `buildDialuxDxfExport.ts` en la
 * Fase 8 para reutilizarlo tal cual dentro del bloque de nivel (Fase 8,
 * sección 12.1). Mismo comportamiento que antes de la extracción, verificado
 * contra el snapshot congelado de la Fase 0.
 */

export function renderImportedEntities(out: DxfLines, entities: DxfEntity[]): void {
    for (const ent of entities) {
        switch (ent.type) {
            case 'line':
                dxfLine(out, 'DXF_BASE', ent.x1, ent.y1, ent.x2, ent.y2);
                break;
            case 'polyline':
                dxfPolyLines(out, 'DXF_BASE',
                    ent.vertices.map(([x, y]) => ({ x, y })), ent.closed);
                break;
            case 'polygon':
                dxfPolyLines(out, 'DXF_BASE',
                    ent.vertices.map(([x, y]) => ({ x, y })), ent.closed);
                break;
            case 'circle':
                dxfCircle(out, 'DXF_BASE', ent.cx, ent.cy, ent.r);
                break;
            case 'arc':
                dxfArc(out, 'DXF_BASE', ent.cx, ent.cy, ent.r,
                    ent.start_angle, ent.end_angle);
                break;
            case 'text':
                dxfText(out, 'DXF_BASE', ent.x, ent.y, Math.max(ent.height, 0.05), ent.text);
                break;
            case 'rectangle': {
                const rad = (ent.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const { width: w, height: h } = ent;
                const corners: Pt[] = ([
                    [0, 0], [w, 0], [w, h], [0, h],
                ] as [number, number][]).map(([lx, ly]) => ({
                    x: ent.x + lx * cos - ly * sin,
                    y: ent.y + lx * sin + ly * cos,
                }));
                dxfPolyLines(out, 'DXF_BASE', corners, true);
                break;
            }
            case 'solid':
                if (ent.vertices.length >= 3) {
                    dxfPolyLines(out, 'DXF_BASE',
                        ent.vertices.map(([x, y]) => ({ x, y })), true);
                }
                break;
            case 'spline':
                if (ent.control_points.length >= 2) {
                    dxfPolyLines(out, 'DXF_BASE',
                        ent.control_points.map(([x, y]) => ({ x, y })), ent.closed);
                }
                break;
            default:
                break; // hatch / ellipse / point – skip
        }
    }
}

export function renderRooms(out: DxfLines, rooms: Room[]): void {
    for (const room of rooms) {
        if (room.vertices.length < 3) continue;
        dxfPolyLines(out, 'RECINTOS', room.vertices, true);
        const c = centroid(room.vertices);
        dxfText(out, 'TEXTO_RECINTOS', c.x, c.y, 0.15, room.name || 'Recinto');
    }
}

/**
 * Solo los nombres de recinto (capa `TEXTO_RECINTOS`), sin el polígono de
 * `RECINTOS` — usado cuando el nivel ya tiene un plano CAD base importado
 * (`renderImportedEntities`): el CAD real trae los muros/recintos reales,
 * y dibujar además nuestra reconstrucción trazada a mano (nunca
 * pixel-perfecta) produce líneas dobles/desalineadas. El nombre del
 * recinto SÍ aporta información que no existe en el CAD original.
 */
export function renderRoomLabels(out: DxfLines, rooms: Room[]): void {
    for (const room of rooms) {
        if (room.vertices.length < 3) continue;
        const c = centroid(room.vertices);
        dxfText(out, 'TEXTO_RECINTOS', c.x, c.y, 0.15, room.name || 'Recinto');
    }
}

export function renderWalls(out: DxfLines, walls: Wall[]): void {
    for (const wall of walls) {
        if (wall.vertices.length < 2) continue;
        dxfPolyLines(out, 'PAREDES', wall.vertices, false);
    }
}

export function renderWindows(out: DxfLines, windows: SceneWindow[], wallMap: Map<string, Wall>): void {
    for (const win of windows) {
        const wall = wallMap.get(win.wallId);
        if (!wall || wall.vertices.length < 2) continue;
        const { pt: sp, dir } = ptAlongPoly(wall.vertices, win.offsetAlongWall);
        const ep = { x: sp.x + dir.x * win.width, y: sp.y + dir.y * win.width };
        dxfLine(out, 'VENTANAS', sp.x, sp.y, ep.x, ep.y);
        const t = 0.08;
        dxfLine(out, 'VENTANAS',
            sp.x - dir.y * t, sp.y + dir.x * t,
            sp.x + dir.y * t, sp.y - dir.x * t);
        dxfLine(out, 'VENTANAS',
            ep.x - dir.y * t, ep.y + dir.x * t,
            ep.x + dir.y * t, ep.y - dir.x * t);
    }
}

export function renderDoors(out: DxfLines, doors: Door[], wallMap: Map<string, Wall>): void {
    for (const door of doors) {
        const wall = wallMap.get(door.wallId);
        if (!wall || wall.vertices.length < 2) continue;
        const { pt: sp, dir } = ptAlongPoly(wall.vertices, door.offsetAlongWall);
        const ep = { x: sp.x + dir.x * door.width, y: sp.y + dir.y * door.width };
        dxfLine(out, 'PUERTAS', sp.x, sp.y, ep.x, ep.y);
        const baseAngleDeg = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
        dxfArc(out, 'PUERTAS', sp.x, sp.y, door.width, baseAngleDeg, baseAngleDeg + 90);
    }
}

export function renderCanopies(out: DxfLines, canopies: Canopy[]): void {
    for (const c of canopies) {
        dxfLine(out, 'CANOPIES', c.x1, c.y1, c.x2, c.y2);
    }
}

/**
 * Bloque arquitectónico completo de un nivel (`buildDxfMultiSheetDocument.ts`,
 * dentro de cada `BLOCK` de nivel). Cuando hay un plano CAD base importado,
 * ese plano YA trae los muros/recintos/ventanas/puertas reales — dibujar
 * además nuestra reconstrucción trazada a mano (nunca pixel-perfecta contra
 * el CAD real) produce líneas dobles/desalineadas en el plano de
 * construcción. El plano base pasa sin alterarse; el nombre de recinto sí
 * se conserva porque no existe en el CAD original.
 */
export function renderLevelArchitectureBlock(
    out: DxfLines,
    basePlanEntities: DxfEntity[],
    rooms: Room[],
    walls: Wall[],
    windows: SceneWindow[],
    doors: Door[],
    canopies: Canopy[],
    wallMap: Map<string, Wall>,
): void {
    renderImportedEntities(out, basePlanEntities);
    if (basePlanEntities.length > 0) {
        renderRoomLabels(out, rooms);
        return;
    }
    renderRooms(out, rooms);
    renderWalls(out, walls);
    renderWindows(out, windows, wallMap);
    renderDoors(out, doors, wallMap);
    renderCanopies(out, canopies);
}
