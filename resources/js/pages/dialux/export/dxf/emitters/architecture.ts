import type { Canopy, Door, DxfEntity, Room, Wall, Window as SceneWindow } from '@/pages/dialux/hooks/types';
import { centroid, ptAlongPoly } from '../geometry/polylineGeometry';
import { dxfArc, dxfCircle, dxfLine, dxfPoint, dxfPolyLines, dxfText, type DxfLines, type Pt } from './primitives';

/**
 * Puntos de muestreo para aproximar una ELLIPSE del CAD importado como
 * polilínea. El archivo exportado se declara AC1009 (R12) por compatibilidad
 * máxima -- ELLIPSE como entidad nativa es de R14/2000 en adelante, así que
 * se aproxima igual que ya se hace con SPLINE en este mismo archivo, en vez
 * de emitir una entidad que un lector estrictamente R12 podría rechazar.
 */
const ELLIPSE_SAMPLE_STEPS = 48;

/** Ecuación paramétrica DXF de elipse: centro + eje_mayor*cos(t) + eje_menor*sin(t), t en radianes. */
function sampleEllipsePoints(ent: {
    cx: number; cy: number; major_x: number; major_y: number;
    minor_ratio: number; start_param: number; end_param: number;
}): Pt[] {
    const majorLen = Math.hypot(ent.major_x, ent.major_y);
    if (majorLen < 1e-9) return [];
    const minorLen = majorLen * ent.minor_ratio;
    const rotation = Math.atan2(ent.major_y, ent.major_x);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    let start = ent.start_param;
    let end = ent.end_param;
    if (end <= start) end += 2 * Math.PI;

    const pts: Pt[] = [];
    for (let i = 0; i <= ELLIPSE_SAMPLE_STEPS; i++) {
        const t = start + ((end - start) * i) / ELLIPSE_SAMPLE_STEPS;
        const lx = majorLen * Math.cos(t);
        const ly = minorLen * Math.sin(t);
        pts.push({
            x: ent.cx + lx * cos - ly * sin,
            y: ent.cy + lx * sin + ly * cos,
        });
    }
    return pts;
}

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
                // Capa propia (no 'DXF_BASE'): el texto del plano importado
                // (incluido el texto de cotas explotadas de DIMENSION) debe
                // poder ocultarse/congelarse sin perder muros ni hatch.
                dxfText(out, 'DXF_BASE_TEXTO', ent.x, ent.y, Math.max(ent.height, 0.05), ent.text);
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
            case 'ellipse': {
                const pts = sampleEllipsePoints(ent);
                if (pts.length >= 2) dxfPolyLines(out, 'DXF_BASE', pts, false);
                break;
            }
            case 'point':
                dxfPoint(out, 'DXF_BASE', ent.x, ent.y);
                break;
            case 'hatch':
                // v1: solo el contorno (boundary_paths), sin relleno de
                // patrón real -- rellenar con SOLID requeriría triangular
                // un polígono arbitrario, fuera de alcance. El parser Rust
                // ya descarta en origen los hatches con boundary no-polilínea
                // (ver dxf_parser.rs), así que lo que llega aquí siempre es
                // un contorno cerrado válido.
                //
                // Capa propia (no 'DXF_BASE'): un hatch de piso/área
                // sombreada suele solaparse visualmente con texto/cotas
                // cercanas -- sin capa separada el usuario no puede
                // congelar/ocultar solo el hatch en AutoCAD sin perder el
                // resto del plano base (reportado con un DXF real).
                for (const path of ent.boundary_paths) {
                    if (path.length >= 2) {
                        dxfPolyLines(out, 'DXF_BASE_HATCH', path.map(([x, y]) => ({ x, y })), true);
                    }
                }
                break;
            default:
                break;
        }
    }
}

/**
 * Solo el contorno de recinto/ambiente (capa `RECINTOS`), sin el nombre en
 * texto -- a pedido explícito del usuario tras ver un export real: el
 * nombre de recinto/pasadizo no aporta en esta etapa, solo el dibujo y la
 * simbología (el texto propio del CAD importado, capa `DXF_BASE_TEXTO`, no
 * se toca -- esto es solo texto que generamos nosotros).
 */
export function renderRooms(out: DxfLines, rooms: Room[]): void {
    for (const room of rooms) {
        if (room.vertices.length < 3) continue;
        dxfPolyLines(out, 'RECINTOS', room.vertices, true);
    }
}

/**
 * Solo los nombres de recinto (capa `TEXTO_RECINTOS`), sin el polígono de
 * `RECINTOS` — sin uso actual (ver `renderLevelArchitectureBlock`: el
 * contorno de recinto/ambiente SÍ se dibuja incluso con plano CAD base,
 * porque es una zona de cálculo de DIAlux, no un muro físico duplicado).
 * Se conserva por si a futuro hace falta un modo "solo etiquetas".
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
 * ese plano YA trae los muros/ventanas/puertas reales — dibujar además
 * nuestra reconstrucción trazada a mano (nunca pixel-perfecta contra el CAD
 * real) produce líneas dobles/desalineadas en el plano de construcción, así
 * que esas SÍ se omiten.
 *
 * El contorno de recinto/ambiente (`renderRooms`, capa `RECINTOS`) NO se
 * omite: un `Room` (incluye `roomType: 'ambient'`) es una zona de cálculo de
 * DIAlux, no necesariamente coincidente con un muro físico del CAD, así que
 * es información propia que el plano importado no trae. Confirmado por el
 * usuario tras un export real donde faltaban "los dibujos del recinto y de
 * los ambientes".
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
    renderRooms(out, rooms);
    if (basePlanEntities.length > 0) {
        return;
    }
    renderWalls(out, walls);
    renderWindows(out, windows, wallMap);
    renderDoors(out, doors, wallMap);
    renderCanopies(out, canopies);
}
