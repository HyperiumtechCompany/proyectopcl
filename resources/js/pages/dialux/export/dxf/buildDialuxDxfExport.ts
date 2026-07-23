/**
 * buildDialuxDxfExport.ts
 *
 * Generates a DXF file in AC1009 (AutoCAD R12) format — the most universally
 * compatible DXF version, accepted by AutoCAD, QCAD, FreeCAD, LibreCAD, etc.
 *
 * AC1009 structure (all four sections are mandatory):
 *   HEADER  – drawing metadata
 *   TABLES  – layer / linetype / style definitions
 *   BLOCKS  – block definitions (holds the background-plan block, see below)
 *   ENTITIES – all drawing geometry
 *   EOF
 *
 * Geometry strategy: every polygon is exploded into individual LINE entities.
 * This avoids LWPOLYLINE (R2000+) and POLYLINE/VERTEX complexity while
 * remaining fully parseable by every CAD tool.
 *
 * Editability strategy: the architectural background (imported CAD entities,
 * rooms, walls, windows, doors, canopies) is bundled into a single BLOCK
 * ("PLANO_BASE") and referenced once via INSERT, so in AutoCAD it selects as
 * ONE object. Electrical design entities (fixtures, conductors, switches,
 * devices, junction boxes) are emitted as loose, individually-editable
 * entities outside the block.
 *
 * Conductor curves are exported as true ARC entities (circular arc through
 * the two endpoints and the curve's midpoint) instead of Bezier-sampled
 * LINE chains — one entity per cable segment instead of many. Wire-count
 * tick marks stay as graphics, but the wire-label TEXT (e.g. "F+N+T") is
 * intentionally omitted from the export.
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
    Conductor,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
} from '@/pages/dialux/hooks/types';
import type { DialuxExportSnapshot } from '../domain/types';
import { ELECTRICAL_LEGEND_ITEMS, type ElectricalLegendItem } from '../../electrical/electricalLegend';
import {
    renderCanopies, renderDoors, renderImportedEntities, renderRooms, renderWalls, renderWindows,
} from './emitters/architecture';
import {
    ascii, dxfArc, dxfCircle, dxfFilledDot, dxfLine, dxfPolyLines, dxfText, f, p,
} from './emitters/primitives';
import type { DxfLines, Pt } from './emitters/primitives';
import {
    TICK_HALF, TICK_SPACING, computeConductorCurve, conductorCp,
} from './geometry/conductorCurve';
import type { ConductorCurve } from './geometry/conductorCurve';

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

/** Name of the block that bundles the whole architectural background plan. */
const BASE_BLOCK_NAME = 'PLANO_BASE';

/**
 * BLOCKS section holding a single block definition ("PLANO_BASE") with the
 * architectural background geometry. Referenced once via INSERT in the
 * ENTITIES section so the whole background acts as ONE selectable/editable
 * object in AutoCAD, leaving electrical design entities individually
 * editable.
 */
function buildBlocks(out: DxfLines, renderBackground: () => void): void {
    p(out, 0, 'SECTION');
    p(out, 2, 'BLOCKS');

    p(out, 0, 'BLOCK');
    p(out, 8, '0');
    p(out, 2, BASE_BLOCK_NAME);
    p(out, 70, 0);
    p(out, 10, '0.0'); p(out, 20, '0.0'); p(out, 30, '0.0');
    p(out, 3, BASE_BLOCK_NAME);
    p(out, 1, '');
    renderBackground();
    p(out, 0, 'ENDBLK');
    p(out, 8, '0');

    p(out, 0, 'ENDSEC');
}

/** Insert the background block once, so it selects as a single object. */
function insertBaseBlock(out: DxfLines): void {
    p(out, 0, 'INSERT');
    p(out, 8, 'DXF_BASE');
    p(out, 2, BASE_BLOCK_NAME);
    p(out, 10, '0.0'); p(out, 20, '0.0'); p(out, 30, '0.0');
    p(out, 41, '1.0'); p(out, 42, '1.0'); p(out, 43, '1.0');
    p(out, 50, '0.0');
}

// ── Domain renderers ──────────────────────────────────────────────────────────

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

/** Emit one conductor curve as a single ARC entity, or LINE when it's straight. */
function emitConductorCurve(
    out: DxfLines, layer: string,
    curve: ConductorCurve, a: Pt, b: Pt,
): void {
    if (curve.kind === 'line') {
        dxfLine(out, layer, a.x, a.y, b.x, b.y);
        return;
    }
    dxfArc(out, layer, curve.cx, curve.cy, curve.r, curve.startDeg, curve.endDeg);
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
            // Filled dot at the top of the tick, in neutral-wire blue (ACI 5)
            // so it reads as a distinct, colored marker rather than a hollow
            // ring in the cable's own (red) layer color.
            const r = TICK_HALF * 0.22;
            dxfFilledDot(out, layer, topX + nx * r, topY + ny * r, r, 5);
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
        // Both route types sweep in a gentle arc, curving in opposite
        // directions. The sign is INVERTED relative to OverlayWires.tsx's
        // curveDir (floor=+1, wall/ceiling=-1): the canvas computes its
        // control point in screen space (Y axis pointing down), while this
        // DXF is in world space (Y axis pointing up) — mirroring the Y axis
        // reverses which side the curve bows to. Confirmed by comparing the
        // same level open in DIAlux (bows left) against AutoCAD (was bowing
        // right before this fix).
        const curveDir = isFloor ? -1 : 1;
        const layer = 'CABLEADO';
        const midSegIdx = Math.floor((nodes.length - 2) / 2);

        for (let i = 0; i < nodes.length - 1; i++) {
            const a = nodes[i];
            const b = nodes[i + 1];
            const curve = computeConductorCurve(a, b, curveDir);
            emitConductorCurve(out, layer, curve, a, b);

            // Draw wire-count tick marks on the middle segment only
            if (i === midSegIdx) {
                const cp = conductorCp(a, b, curveDir);
                emitConductorTicks(out, a, cp, b, c.wireCount, layer);
            }
        }

        // Note: the wire-label TEXT (e.g. "F+N+T") is intentionally not
        // exported — the tick marks above already encode wire type/count,
        // and the label clutters the plan when overlaid on the base CAD.
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

function renderWallOutlet(out: DxfLines, dev: ElectricalDevice, waterproof = false): void {
    const r = 0.075;
    dxfCircle(out, 'DISP_ELECTRICOS', dev.x, dev.y, r);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x - r, dev.y, dev.x + r, dev.y);
    dxfText(out, 'TEXTO_ELEC', dev.x + r + 0.025, dev.y - 0.025, 0.06, dev.label || 'T');

    if (waterproof) {
        dxfText(out, 'TEXTO_ELEC', dev.x + r + 0.025, dev.y + 0.055, 0.04, 'AP');
        dxfText(out, 'TEXTO_ELEC', dev.x + r + 0.025, dev.y - 0.085, 0.035, '1.20m');
    }
}

function renderCeilingOutlet(out: DxfLines, dev: ElectricalDevice): void {
    const r = 0.075;
    dxfLine(out, 'DISP_ELECTRICOS', dev.x - r * 1.6, dev.y + r * 0.7, dev.x + r * 1.25, dev.y + r * 0.7);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x - r * 0.95, dev.y + r * 0.7, dev.x - r * 0.95, dev.y - r * 1.8);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x, dev.y + r * 0.7, dev.x, dev.y - r * 1.8);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x + r * 0.95, dev.y + r * 0.7, dev.x + r * 0.95, dev.y - r * 1.8);
    dxfCircle(out, 'DISP_ELECTRICOS', dev.x + r * 1.25, dev.y + r * 0.7, r * 0.45);
}

function renderRackOutlet(out: DxfLines, dev: ElectricalDevice): void {
    const hw = 0.10;
    const hh = 0.06;
    dxfPolyLines(out, 'DISP_ELECTRICOS', [
        { x: dev.x - hw, y: dev.y - hh },
        { x: dev.x + hw, y: dev.y - hh },
        { x: dev.x + hw, y: dev.y + hh },
        { x: dev.x - hw, y: dev.y + hh },
    ], true);
    dxfText(out, 'TEXTO_ELEC', dev.x - 0.045, dev.y - 0.02, 0.055, dev.label || 'TR');
}

function renderWaterHeater(out: DxfLines, dev: ElectricalDevice): void {
    const hw = 0.16;
    const hh = 0.09;
    dxfPolyLines(out, 'DISP_ELECTRICOS', [
        { x: dev.x - hw, y: dev.y - hh },
        { x: dev.x + hw * 0.45, y: dev.y - hh },
        { x: dev.x + hw * 0.45, y: dev.y + hh },
        { x: dev.x - hw, y: dev.y + hh },
    ], true);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x - hw * 0.9, dev.y - hh * 0.72, dev.x + hw * 0.3, dev.y + hh * 0.72);
    dxfLine(out, 'DISP_ELECTRICOS', dev.x + hw * 0.3, dev.y - hh * 0.72, dev.x - hw * 0.9, dev.y + hh * 0.72);
    dxfText(out, 'TEXTO_ELEC', dev.x + hw * 0.6, dev.y - 0.025, 0.07, 'TE');
}

function renderElectricalDevices(out: DxfLines, devices: ElectricalDevice[]): void {
    const HS = 0.075; // half-size: 15 cm square symbol
    for (const dev of devices) {
        if (dev.type === 'outlet_floor') {
            renderWallOutlet(out, dev);
            continue;
        }

        if (dev.type === 'outlet_initial' || dev.type === 'outlet_high_180') {
            renderWallOutlet(out, dev);
            continue;
        }

        if (dev.type === 'outlet_floor_box') {
            renderRackOutlet(out, { ...dev, label: 'TP' });
            continue;
        }

        if (dev.type === 'outlet_waterproof') {
            renderWallOutlet(out, dev, true);
            continue;
        }

        if (dev.type === 'outlet_ceiling') {
            renderCeilingOutlet(out, dev);
            continue;
        }

        if (dev.type === 'outlet_rack') {
            renderRackOutlet(out, dev);
            continue;
        }

        if (dev.type === 'water_heater_30l') {
            renderWaterHeater(out, dev);
            continue;
        }

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

export function usedElectricalLegendItems(
    fixtures: Fixture[],
    switches: LightSwitch[],
    devices: ElectricalDevice[],
    conductors: Conductor[],
): ElectricalLegendItem[] {
    const codes = new Set<string>();
    if (fixtures.length > 0) codes.add('⊗');
    if (fixtures.some((fixture) => fixture.emergencyType && fixture.emergencyType !== 'none')) codes.add('E');
    const switchCodes: Record<LightSwitch['type'], string> = { single: 'S', double: '2S', triple: '2S', 'two-way': 'Sc' };
    switches.forEach((item) => codes.add(switchCodes[item.type]));
    const deviceCodes: Partial<Record<ElectricalDevice['type'], string>> = {
        outlet_floor: 'T', outlet_waterproof: 'T', outlet_initial: 'TI',
        outlet_high_180: 'TA', outlet_ceiling: 'TC', outlet_rack: 'TR',
        outlet_floor_box: 'TP', main_panel: 'TG', sub_panel: 'TD',
    };
    devices.forEach((item) => {
        const code = deviceCodes[item.type];
        if (code) codes.add(code);
    });
    if (conductors.some((item) => item.routeType === 'wall_ceiling')) codes.add('—');
    if (conductors.some((item) => item.routeType === 'floor')) codes.add('⌒');

    const base = ELECTRICAL_LEGEND_ITEMS.filter((item) => codes.has(item.code));
    const cableRows: ElectricalLegendItem[] = [...new Map(conductors.map((item) => {
        const awg = item.sectionMm2 === 2.5 ? 'AWG 14' : item.sectionMm2 === 4 ? 'AWG 12' : '';
        const key = `${item.conductorType}|${item.sectionMm2}`;
        return [key, {
            code: 'C',
            label: `${item.conductorType} · ${item.sectionMm2} mm²${awg ? ` (${awg})` : ''}`,
            group: 'Cableado' as const,
            color: '#ef4444',
        }];
    })).values()];
    return [...base, ...cableRows];
}

function renderElectricalLegend(out: DxfLines, x: number, topY: number, items: ElectricalLegendItem[]): void {
    if (items.length === 0) return;
    const width = 7.2;
    const rowHeight = 0.42;
    const titleHeight = 0.58;
    const height = titleHeight + items.length * rowHeight + 0.18;
    const bottomY = topY - height;

    dxfPolyLines(out, 'DISP_ELECTRICOS', [
        { x, y: topY },
        { x: x + width, y: topY },
        { x: x + width, y: bottomY },
        { x, y: bottomY },
    ], true);
    dxfLine(out, 'DISP_ELECTRICOS', x, topY - titleHeight, x + width, topY - titleHeight);
    dxfText(out, 'TEXTO_ELEC', x + 0.18, topY - 0.38, 0.22, 'LEYENDA ELECTRICA');

    items.forEach((item, index) => {
        const y = topY - titleHeight - (index + 0.7) * rowHeight;
        dxfText(out, 'TEXTO_ELEC', x + 0.2, y, 0.16, item.cadCode ?? item.code);
        dxfText(out, 'TEXTO_ELEC', x + 0.95, y, 0.14, item.label);
    });
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
    const legendX = maxX + 1;
    const legendTopY = maxY;
    buildHeader(out, minX - PAD, Math.min(minY - PAD, legendTopY - 8), legendX + 8, maxY + PAD);
    buildTables(out);

    // Background plan (imported CAD + architectural elements) → one block.
    buildBlocks(out, () => {
        renderImportedEntities(out, dxfEntities);
        renderRooms(out, rooms);
        renderWalls(out, walls);
        renderWindows(out, windows, wallMap);
        renderDoors(out, doors, wallMap);
        renderCanopies(out, canopies);
    });

    p(out, 0, 'SECTION');
    p(out, 2, 'ENTITIES');

    // Single INSERT makes the background plan act as ONE object in AutoCAD.
    insertBaseBlock(out);

    // Electrical design entities stay loose and individually editable.
    renderFixtures(out, fixtures);
    renderConductors(out, conductors, fixtures, lightSwitches, electricalDevices, junctionBoxes);
    renderLightSwitches(out, lightSwitches);
    renderElectricalDevices(out, electricalDevices);
    renderJunctionBoxes(out, junctionBoxes);
    renderElectricalLegend(
        out,
        legendX,
        legendTopY,
        usedElectricalLegendItems(fixtures, lightSwitches, electricalDevices, conductors),
    );

    p(out, 0, 'ENDSEC');
    p(out, 0, 'EOF');

    return out.join('\n') + '\n';
}
