/**
 * buildDialuxDxfExport.ts
 *
 * Generates a DXF file in AC1009 (AutoCAD R12) format — the most universally
 * compatible DXF version, accepted by AutoCAD, QCAD, FreeCAD, LibreCAD, etc.
 *
 * AC1009 structure (all four sections are mandatory):
 *   HEADER  – drawing metadata
 *   TABLES  – layer / linetype / style definitions
 *   BLOCKS  – block definitions (empty but required)
 *   ENTITIES – all drawing geometry
 *   EOF
 *
 * Geometry strategy: every polygon is exploded into individual LINE entities.
 * This avoids LWPOLYLINE (R2000+) and POLYLINE/VERTEX complexity while
 * remaining fully parseable by every CAD tool.
 *
 * Layers exported:
 *   DXF_BASE        – imported CAD base plan             (color 8  gray)
 *   RECINTOS        – room / enclosure polygons          (color 4  cyan)
 *   PAREDES         – walls                              (color 7  white)
 *   VENTANAS        – window openings + ticks            (color 5  blue)
 *   PUERTAS         – door leaf + swing arc              (color 3  green)
 *   CANOPIES        – canopy / eave lines                (color 9  lt-gray)
 *   LUMINARIAS      – fixture: circle + cross            (color 2  yellow)
 *   CABLEADO        – electrical conductor paths         (color 1  red)
 *   INTERRUPTORES   – light switch symbol                (color 6  magenta)
 *   DISP_ELECTRICOS – panels, meters, junction boxes     (color 30 orange)
 *   TEXTO_RECINTOS  – room name labels                   (color 4  cyan)
 *   TEXTO_LUZ       – fixture labels                     (color 2  yellow)
 *   TEXTO_ELEC      – electrical labels                  (color 30 orange)
 */

import type {
    Canopy,
    Conductor,
    Door,
    DxfEntity,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
    Room,
    Wall,
    Window as SceneWindow,
} from '@/hooks/dialux/types';
import type { DialuxExportSnapshot } from '../domain/types';

// ── Internal types ────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
type DxfLines = string[];

// ── Primitive helpers ─────────────────────────────────────────────────────────

/** Format a float for DXF output — no scientific notation, 6 decimal places. */
function f(v: number): string {
    return v.toFixed(6);
}

/** Transliterate common Spanish/Latin characters to plain ASCII for AC1009. */
function ascii(s: string): string {
    return s
        .replace(/[áàäâã]/gi, (m) => (m === m.toUpperCase() ? 'A' : 'a'))
        .replace(/[éèëê]/gi, (m) => (m === m.toUpperCase() ? 'E' : 'e'))
        .replace(/[íìïî]/gi, (m) => (m === m.toUpperCase() ? 'I' : 'i'))
        .replace(/[óòöôõ]/gi, (m) => (m === m.toUpperCase() ? 'O' : 'o'))
        .replace(/[úùüû]/gi, (m) => (m === m.toUpperCase() ? 'U' : 'u'))
        .replace(/[ñ]/g, 'n')
        .replace(/[Ñ]/g, 'N')
        .replace(/[^\x20-\x7E]/g, '?')
        .slice(0, 255);
}

function centroid(pts: Pt[]): Pt {
    return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
}

/**
 * Walk along a multi-vertex polyline and return the point at `offset` metres
 * from the start, plus the normalised direction vector at that segment.
 */
function ptAlongPoly(vertices: Pt[], offset: number): { pt: Pt; dir: Pt } {
    let rem = offset;
    for (let i = 1; i < vertices.length; i++) {
        const dx = vertices[i].x - vertices[i - 1].x;
        const dy = vertices[i].y - vertices[i - 1].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (rem <= len || i === vertices.length - 1) {
            const t = len > 0 ? Math.min(rem / len, 1) : 0;
            return {
                pt: { x: vertices[i - 1].x + t * dx, y: vertices[i - 1].y + t * dy },
                dir: { x: len > 0 ? dx / len : 1, y: len > 0 ? dy / len : 0 },
            };
        }
        rem -= len;
    }
    const last = vertices[vertices.length - 1];
    const prev = vertices[vertices.length - 2] ?? vertices[0];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
        pt: last,
        dir: len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 },
    };
}

// ── DXF group-code emitter ────────────────────────────────────────────────────

/** Push one group-code / value pair. */
function p(out: DxfLines, code: number, value: string | number): void {
    out.push(`${code}\n${value}`);
}

// ── Entity emitters (AC1009-compatible primitives) ────────────────────────────

function dxfLine(
    out: DxfLines, layer: string,
    x1: number, y1: number, x2: number, y2: number,
): void {
    p(out, 0, 'LINE');
    p(out, 8, layer);
    p(out, 10, f(x1)); p(out, 20, f(y1)); p(out, 30, '0.0');
    p(out, 11, f(x2)); p(out, 21, f(y2)); p(out, 31, '0.0');
}

/** Emit a closed or open polygon as individual LINE segments. */
function dxfPolyLines(out: DxfLines, layer: string, pts: Pt[], closed: boolean): void {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length - 1; i++) {
        dxfLine(out, layer, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    if (closed && pts.length >= 3) {
        const last = pts[pts.length - 1];
        dxfLine(out, layer, last.x, last.y, pts[0].x, pts[0].y);
    }
}

function dxfCircle(out: DxfLines, layer: string, cx: number, cy: number, r: number): void {
    p(out, 0, 'CIRCLE');
    p(out, 8, layer);
    p(out, 10, f(cx)); p(out, 20, f(cy)); p(out, 30, '0.0');
    p(out, 40, f(r));
}

function dxfArc(
    out: DxfLines, layer: string,
    cx: number, cy: number, r: number,
    startDeg: number, endDeg: number,
): void {
    p(out, 0, 'ARC');
    p(out, 8, layer);
    p(out, 10, f(cx)); p(out, 20, f(cy)); p(out, 30, '0.0');
    p(out, 40, f(r));
    p(out, 50, f(startDeg));
    p(out, 51, f(endDeg));
}

/** Simple left-aligned TEXT (no alignment codes — maximum R12 compatibility). */
function dxfText(
    out: DxfLines, layer: string,
    x: number, y: number,
    height: number, content: string,
): void {
    const safe = ascii(content);
    if (!safe) return;
    p(out, 0, 'TEXT');
    p(out, 8, layer);
    p(out, 10, f(x)); p(out, 20, f(y)); p(out, 30, '0.0');
    p(out, 40, f(height));
    p(out, 1, safe);
}

// ── DXF section builders ──────────────────────────────────────────────────────

const LAYER_DEFS: ReadonlyArray<{ name: string; color: number }> = [
    { name: '0',               color: 7  },
    { name: 'DXF_BASE',        color: 8  },
    { name: 'RECINTOS',        color: 4  },
    { name: 'PAREDES',         color: 7  },
    { name: 'VENTANAS',        color: 5  },
    { name: 'PUERTAS',         color: 3  },
    { name: 'CANOPIES',        color: 9  },
    { name: 'LUMINARIAS',      color: 2  },
    { name: 'CABLEADO',        color: 1  },
    { name: 'INTERRUPTORES',   color: 6  },
    { name: 'DISP_ELECTRICOS', color: 30 },
    { name: 'TEXTO_RECINTOS',  color: 4  },
    { name: 'TEXTO_LUZ',       color: 2  },
    { name: 'TEXTO_ELEC',      color: 30 },
];

function buildHeader(
    out: DxfLines,
    minX: number, minY: number, maxX: number, maxY: number,
): void {
    p(out, 0, 'SECTION'); p(out, 2, 'HEADER');
    p(out, 9, '$ACADVER');    p(out, 1, 'AC1009');
    p(out, 9, '$EXTMIN');
    p(out, 10, f(minX)); p(out, 20, f(minY));
    p(out, 9, '$EXTMAX');
    p(out, 10, f(maxX)); p(out, 20, f(maxY));
    p(out, 0, 'ENDSEC');
}

function buildTables(out: DxfLines): void {
    p(out, 0, 'SECTION'); p(out, 2, 'TABLES');

    // --- LTYPE table (one entry: CONTINUOUS) ---
    p(out, 0, 'TABLE'); p(out, 2, 'LTYPE'); p(out, 70, 1);
    p(out, 0, 'LTYPE');
    p(out, 2, 'CONTINUOUS');
    p(out, 70, 0);
    p(out, 3, 'Solid line');
    p(out, 72, 65); p(out, 73, 0); p(out, 40, '0.0');
    p(out, 0, 'ENDTAB');

    // --- LAYER table ---
    p(out, 0, 'TABLE'); p(out, 2, 'LAYER'); p(out, 70, LAYER_DEFS.length);
    for (const ld of LAYER_DEFS) {
        p(out, 0, 'LAYER');
        p(out, 2, ld.name);
        p(out, 70, 0);           // on, not frozen, not locked
        p(out, 62, ld.color);
        p(out, 6, 'CONTINUOUS');
    }
    p(out, 0, 'ENDTAB');

    // --- STYLE table (minimal STANDARD entry) ---
    p(out, 0, 'TABLE'); p(out, 2, 'STYLE'); p(out, 70, 1);
    p(out, 0, 'STYLE');
    p(out, 2, 'STANDARD');
    p(out, 70, 0);
    p(out, 40, '0.0'); p(out, 41, '1.0');
    p(out, 50, '0.0'); p(out, 71, 0);
    p(out, 42, '0.2');
    p(out, 3, 'txt'); p(out, 4, '');
    p(out, 0, 'ENDTAB');

    p(out, 0, 'ENDSEC');
}

/** Required even when empty. */
function buildBlocks(out: DxfLines): void {
    p(out, 0, 'SECTION');
    p(out, 2, 'BLOCKS');
    p(out, 0, 'ENDSEC');
}

// ── Domain renderers ──────────────────────────────────────────────────────────

function renderImportedEntities(out: DxfLines, entities: DxfEntity[]): void {
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

function renderRooms(out: DxfLines, rooms: Room[]): void {
    for (const room of rooms) {
        if (room.vertices.length < 3) continue;
        dxfPolyLines(out, 'RECINTOS', room.vertices, true);
        const c = centroid(room.vertices);
        dxfText(out, 'TEXTO_RECINTOS', c.x, c.y, 0.15, room.name || 'Recinto');
    }
}

function renderWalls(out: DxfLines, walls: Wall[]): void {
    for (const wall of walls) {
        if (wall.vertices.length < 2) continue;
        dxfPolyLines(out, 'PAREDES', wall.vertices, false);
    }
}

function renderWindows(
    out: DxfLines,
    windows: SceneWindow[],
    wallMap: Map<string, Wall>,
): void {
    for (const win of windows) {
        const wall = wallMap.get(win.wallId);
        if (!wall || wall.vertices.length < 2) continue;
        const { pt: sp, dir } = ptAlongPoly(wall.vertices, win.offsetAlongWall);
        const ep = { x: sp.x + dir.x * win.width, y: sp.y + dir.y * win.width };
        // Opening line
        dxfLine(out, 'VENTANAS', sp.x, sp.y, ep.x, ep.y);
        // Perpendicular tick marks at each jamb
        const t = 0.08;
        dxfLine(out, 'VENTANAS',
            sp.x - dir.y * t, sp.y + dir.x * t,
            sp.x + dir.y * t, sp.y - dir.x * t);
        dxfLine(out, 'VENTANAS',
            ep.x - dir.y * t, ep.y + dir.x * t,
            ep.x + dir.y * t, ep.y - dir.x * t);
    }
}

function renderDoors(
    out: DxfLines,
    doors: Door[],
    wallMap: Map<string, Wall>,
): void {
    for (const door of doors) {
        const wall = wallMap.get(door.wallId);
        if (!wall || wall.vertices.length < 2) continue;
        const { pt: sp, dir } = ptAlongPoly(wall.vertices, door.offsetAlongWall);
        const ep = { x: sp.x + dir.x * door.width, y: sp.y + dir.y * door.width };
        // Door leaf
        dxfLine(out, 'PUERTAS', sp.x, sp.y, ep.x, ep.y);
        // 90° swing arc from the hinge end (sp)
        const baseAngleDeg = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
        dxfArc(out, 'PUERTAS', sp.x, sp.y, door.width, baseAngleDeg, baseAngleDeg + 90);
    }
}

function renderCanopies(out: DxfLines, canopies: Canopy[]): void {
    for (const c of canopies) {
        dxfLine(out, 'CANOPIES', c.x1, c.y1, c.x2, c.y2);
    }
}

function renderFixtures(out: DxfLines, fixtures: Fixture[]): void {
    const R = 0.15;    // symbol radius (15 cm)
    const C = R * 0.65; // cross arm
    for (const fix of fixtures) {
        dxfCircle(out, 'LUMINARIAS', fix.x, fix.y, R);
        dxfLine(out, 'LUMINARIAS', fix.x - C, fix.y, fix.x + C, fix.y);
        dxfLine(out, 'LUMINARIAS', fix.x, fix.y - C, fix.x, fix.y + C);
        const label = fix.name || fix.brand || 'LUM';
        dxfText(out, 'TEXTO_LUZ', fix.x, fix.y - R - 0.12, 0.08, label);
    }
}

function resolvePos(
    id: string,
    fixtures: Fixture[],
    switches: LightSwitch[],
    devices: ElectricalDevice[],
    jboxes: JunctionBox[],
): Pt | null {
    const f = fixtures.find((o) => o.id === id);   if (f) return { x: f.x, y: f.y };
    const s = switches.find((o) => o.id === id);   if (s) return { x: s.x, y: s.y };
    const d = devices.find((o) => o.id === id);    if (d) return { x: d.x, y: d.y };
    const j = jboxes.find((o) => o.id === id);     if (j) return { x: j.x, y: j.y };
    return null;
}

// ── Conductor curve helpers (mirrors OverlayWires.tsx logic) ─────────────────

/** Steps used to approximate each quadratic Bezier segment with LINE entities. */
const BEZIER_STEPS = 8;

/** Half-distance (metres) between the two parallel lines of a floor-route conductor. */
const FLOOR_OFFSET = 0.04;

/** Half-length (metres) of a wire-count tick mark perpendicular to the wire. */
const TICK_HALF = 0.12;

/** Spacing (metres) between adjacent tick marks along the wire. */
const TICK_SPACING = 0.055;

/**
 * Compute the quadratic Bezier control point for a conductor segment.
 * Matches the canvas formula: midpoint + perpendicular * length * 0.18 * curveDir.
 *   curveDir = +1 for floor routes, -1 for wall/ceiling routes.
 */
function conductorCp(a: Pt, b: Pt, curveDir: number): Pt {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return {
        x: (a.x + b.x) / 2 + (-dy / len) * len * 0.18 * curveDir,
        y: (a.y + b.y) / 2 + (dx / len) * len * 0.18 * curveDir,
    };
}

/**
 * Sample BEZIER_STEPS+1 points on the quadratic Bezier a→cp→b.
 */
function sampleBezier(a: Pt, cp: Pt, b: Pt): Pt[] {
    const pts: Pt[] = [];
    for (let i = 0; i <= BEZIER_STEPS; i++) {
        const t = i / BEZIER_STEPS;
        const mt = 1 - t;
        pts.push({
            x: mt * mt * a.x + 2 * mt * t * cp.x + t * t * b.x,
            y: mt * mt * a.y + 2 * mt * t * cp.y + t * t * b.y,
        });
    }
    return pts;
}

/**
 * Offset each point in `pts` by `d` metres perpendicular to the local tangent,
 * producing a parallel copy of the polyline.
 */
function offsetPolyline(pts: Pt[], d: number): Pt[] {
    return pts.map((p, i) => {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-6) return p;
        return { x: p.x + (-dy / len) * d, y: p.y + (dx / len) * d };
    });
}

/**
 * Emit wire-count tick marks at the midpoint of the Bezier segment a→cp→b.
 *
 * Tick type assignment (standard electrical CAD notation, same as canvas):
 *   count ≥ 3  → tick[0]=T (tierra, T-bar)  tick[1]=N (neutro, circle)  rest=F (fase)
 *   count = 2  → tick[0]=N  tick[1]=F
 *   count = 1  → tick[0]=F
 */
function emitConductorTicks(
    out: DxfLines,
    a: Pt, cp: Pt, b: Pt,
    wireCount: number,
    layer: string,
): void {
    if (wireCount < 1) return;

    // Mid-point on Bezier at t=0.5
    const midX = 0.25 * a.x + 0.5 * cp.x + 0.25 * b.x;
    const midY = 0.25 * a.y + 0.5 * cp.y + 0.25 * b.y;

    // Tangent at t=0.5 is proportional to (b - a) for a quadratic Bezier
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;

    const ux = dx / len;  // unit tangent along wire
    const uy = dy / len;
    const nx = -uy;       // unit normal (perpendicular to wire)
    const ny = ux;

    for (let i = 0; i < wireCount; i++) {
        // Spread ticks symmetrically around the mid-point along the wire direction
        const off = (i - (wireCount - 1) / 2) * TICK_SPACING;
        const tx = midX + ux * off;
        const ty = midY + uy * off;

        // Perpendicular tick line (common to every wire type)
        dxfLine(out, layer,
            tx - nx * TICK_HALF, ty - ny * TICK_HALF,
            tx + nx * TICK_HALF, ty + ny * TICK_HALF,
        );

        // Determine wire type
        let type: 'T' | 'N' | 'F';
        if (wireCount >= 3) {
            type = i === 0 ? 'T' : i === 1 ? 'N' : 'F';
        } else if (wireCount === 2) {
            type = i === 0 ? 'N' : 'F';
        } else {
            type = 'F';
        }

        const topX = tx + nx * TICK_HALF;  // "top" end of the tick
        const topY = ty + ny * TICK_HALF;

        if (type === 'T') {
            // T-bar crossbar perpendicular to the tick at its top end
            const barHalf = TICK_HALF * 0.45;
            dxfLine(out, layer,
                topX - ux * barHalf, topY - uy * barHalf,
                topX + ux * barHalf, topY + uy * barHalf,
            );
        } else if (type === 'N') {
            // Small filled circle at the top of the tick
            const r = TICK_HALF * 0.22;
            dxfCircle(out, layer, topX + nx * r, topY + ny * r, r);
        }
        // 'F' = plain vertical tick only
    }
}

function renderConductors(
    out: DxfLines,
    conductors: Conductor[],
    fixtures: Fixture[],
    switches: LightSwitch[],
    devices: ElectricalDevice[],
    jboxes: JunctionBox[],
): void {
    for (const c of conductors) {
        // Build node list: source endpoint → intermediate waypoints → target endpoint
        const srcPos = resolvePos(c.sourceId, fixtures, switches, devices, jboxes);
        const tgtPos = resolvePos(c.targetId, fixtures, switches, devices, jboxes);

        const nodes: Pt[] = [
            ...(srcPos ? [srcPos] : []),
            ...(c.waypoints ?? []),
            ...(tgtPos ? [tgtPos] : []),
        ];
        if (nodes.length < 2) continue;

        const isFloor = c.routeType === 'floor';
        // +1 curves to the right of travel (floor), -1 curves left (wall/ceiling)
        const curveDir = isFloor ? 1 : -1;
        const layer = 'CABLEADO';
        const midSegIdx = Math.floor((nodes.length - 2) / 2);

        for (let i = 0; i < nodes.length - 1; i++) {
            const a = nodes[i];
            const b = nodes[i + 1];
            const cp = conductorCp(a, b, curveDir);
            const bezPts = sampleBezier(a, cp, b);

            if (isFloor) {
                // Floor route → two parallel lines (double-line convention)
                dxfPolyLines(out, layer, offsetPolyline(bezPts, +FLOOR_OFFSET), false);
                dxfPolyLines(out, layer, offsetPolyline(bezPts, -FLOOR_OFFSET), false);
            } else {
                // Wall/ceiling route → single line
                dxfPolyLines(out, layer, bezPts, false);
            }

            // Draw wire-count tick marks on the middle segment only
            if (i === midSegIdx) {
                emitConductorTicks(out, a, cp, b, c.wireCount, layer);
            }
        }

        // Wire label at the midpoint of the middle segment, offset slightly
        const midA = nodes[midSegIdx];
        const midB = nodes[midSegIdx + 1];
        const midCp = conductorCp(midA, midB, curveDir);
        const labelX = 0.25 * midA.x + 0.5 * midCp.x + 0.25 * midB.x;
        const labelY = 0.25 * midA.y + 0.5 * midCp.y + 0.25 * midB.y;

        // Perpendicular offset for the label (away from the curve)
        const ldx = midB.x - midA.x;
        const ldy = midB.y - midA.y;
        const llen = Math.sqrt(ldx * ldx + ldy * ldy);
        const lnx = llen > 1e-6 ? -ldy / llen : 0;
        const lny = llen > 1e-6 ?  ldx / llen : 1;
        const labelOffset = FLOOR_OFFSET + TICK_HALF + 0.06;

        const label = c.wireLabel ?? `${c.wireCount}C`;
        dxfText(out, 'TEXTO_ELEC',
            labelX + lnx * labelOffset,
            labelY + lny * labelOffset,
            0.08, label,
        );
    }
}

function renderLightSwitches(out: DxfLines, switches: LightSwitch[]): void {
    const typeLabel: Record<string, string> = {
        single: 'S', double: '2S', triple: '3S', 'two-way': 'Sc',
    };
    for (const sw of switches) {
        dxfCircle(out, 'INTERRUPTORES', sw.x, sw.y, 0.06);
        dxfText(out, 'TEXTO_ELEC', sw.x + 0.07, sw.y, 0.06,
            sw.label ?? typeLabel[sw.type] ?? 'S');
    }
}

function renderElectricalDevices(out: DxfLines, devices: ElectricalDevice[]): void {
    const HS = 0.075; // half-size: 15 cm square symbol
    for (const dev of devices) {
        dxfPolyLines(out, 'DISP_ELECTRICOS', [
            { x: dev.x - HS, y: dev.y - HS },
            { x: dev.x + HS, y: dev.y - HS },
            { x: dev.x + HS, y: dev.y + HS },
            { x: dev.x - HS, y: dev.y + HS },
        ], true);
        dxfText(out, 'TEXTO_ELEC', dev.x - HS, dev.y + HS + 0.05, 0.07, dev.label);
    }
}

function renderJunctionBoxes(out: DxfLines, jboxes: JunctionBox[]): void {
    for (const jb of jboxes) {
        dxfCircle(out, 'DISP_ELECTRICOS', jb.x, jb.y, 0.05);
        dxfText(out, 'TEXTO_ELEC', jb.x + 0.06, jb.y, 0.06, 'C');
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Converts a DialuxExportSnapshot into a DXF R12 (AC1009) file string.
 * Save the returned string as a UTF-8 `.dxf` file.
 */
export function buildDialuxDxfExport(snapshot: DialuxExportSnapshot): string {
    const { scene, rooms, walls, windows, doors, canopies, fixtures, dxfEntities, dxfExtents } = snapshot;
    const conductors        = scene.conductors        ?? [];
    const lightSwitches     = scene.lightSwitches     ?? [];
    const electricalDevices = scene.electricalDevices ?? [];
    const junctionBoxes     = scene.junctionBoxes     ?? [];

    const wallMap = new Map(walls.map((w) => [w.id, w]));

    // Compute bounding box for EXTMIN / EXTMAX
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const samplePts: Pt[] = [
        ...rooms.flatMap((r) => r.vertices),
        ...walls.flatMap((w) => w.vertices),
        ...fixtures.map((fx) => ({ x: fx.x, y: fx.y })),
    ];
    if (dxfExtents) {
        samplePts.push({ x: dxfExtents.min_x, y: dxfExtents.min_y });
        samplePts.push({ x: dxfExtents.max_x, y: dxfExtents.max_y });
    }
    for (const pt of samplePts) {
        if (isFinite(pt.x)) { minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x); }
        if (isFinite(pt.y)) { minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y); }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
    const PAD = 2;

    const out: DxfLines = [];

    // ── Four mandatory AC1009 sections ────────────────────────────────────────
    buildHeader(out, minX - PAD, minY - PAD, maxX + PAD, maxY + PAD);
    buildTables(out);
    buildBlocks(out);  // ← empty but required

    p(out, 0, 'SECTION');
    p(out, 2, 'ENTITIES');

    renderImportedEntities(out, dxfEntities);
    renderRooms(out, rooms);
    renderWalls(out, walls);
    renderWindows(out, windows, wallMap);
    renderDoors(out, doors, wallMap);
    renderCanopies(out, canopies);
    renderFixtures(out, fixtures);
    renderConductors(out, conductors, fixtures, lightSwitches, electricalDevices, junctionBoxes);
    renderLightSwitches(out, lightSwitches);
    renderElectricalDevices(out, electricalDevices);
    renderJunctionBoxes(out, junctionBoxes);

    p(out, 0, 'ENDSEC');
    p(out, 0, 'EOF');

    return out.join('\n') + '\n';
}
