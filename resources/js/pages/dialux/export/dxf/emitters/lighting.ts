import type { Conductor, ElectricalDevice, Fixture, JunctionBox, LightSwitch } from '@/pages/dialux/hooks/types';
import { TICK_HALF, TICK_SPACING, computeConductorCurve, conductorCp, type ConductorCurve } from '../geometry/conductorCurve';
import { renderFixtureSymbol, renderLightSwitchSymbol } from '../symbols/lightingSymbols';
import { dxfArc, dxfFilledDot, dxfLine, dxfText, type DxfLines, type Pt } from './primitives';

/**
 * Entidades de alumbrado por lámina (luminarias, interruptores,
 * conductores). A diferencia de `buildDialuxDxfExport.ts` (el exportador de
 * un solo plano, que dibuja siempre círculo+cruz sin importar
 * `catalogSymbol`), este emitter usa los símbolos reales de la Fase 5 — el
 * mismo renderer que la leyenda de la Fase 6 (criterio de cierre Fase 5).
 */

const FIXTURE_SYMBOL_SIZE_M = 0.15;
const SWITCH_SYMBOL_SIZE_M = 0.06;

/**
 * `rotation` en `Fixture`/`LightSwitch`/`ElectricalDevice` se captura en el
 * lienzo (pantalla, eje Y hacia abajo). El DXF vive en espacio de mundo
 * (eje Y hacia arriba) — invertir el eje Y invierte también el sentido de
 * cualquier rotación, así que hay que negar el ángulo al pasar de un
 * sistema al otro o el símbolo queda espejado. Igual para la curvatura de
 * los conductores (ver `renderConductorEntities`) — el usuario lo confirmó
 * comparando el mismo nivel en DIAlux (cable/luminaria hacia la izquierda)
 * contra AutoCAD (hacia la derecha) tras exportar.
 */
function toDxfRotationDeg(canvasRotationDeg: number | undefined): number {
    return -(canvasRotationDeg ?? 0);
}

export function renderFixtureEntities(out: DxfLines, layer: string, _textLayer: string, fixtures: Fixture[]): void {
    for (const fixture of fixtures) {
        renderFixtureSymbol(out, layer, {
            x: fixture.x, y: fixture.y,
            rotationDeg: toDxfRotationDeg(fixture.rotation),
            sizeM: FIXTURE_SYMBOL_SIZE_M,
            catalogSymbol: fixture.catalogSymbol,
        });
        // La descripción técnica (nombre/potencia/rango de montaje) se
        // omite en planta por ahora — a pedido del usuario, se veía
        // amontonada sobre el cableado y con caracteres no-ASCII rotos
        // (p.ej. "0.60-1.20m" perdía el guion). La leyenda ya la muestra.
    }
}

export function renderLightSwitchEntities(out: DxfLines, layer: string, textLayer: string, switches: LightSwitch[]): void {
    const typeLabel: Record<LightSwitch['type'], string> = {
        single: 'S', double: '2S', triple: '3S', 'two-way': 'Sc',
    };
    for (const lightSwitch of switches) {
        renderLightSwitchSymbol(out, layer, {
            x: lightSwitch.x, y: lightSwitch.y,
            rotationDeg: toDxfRotationDeg(lightSwitch.rotation),
            sizeM: SWITCH_SYMBOL_SIZE_M,
        });
        dxfText(out, textLayer, lightSwitch.x + 0.07, lightSwitch.y, 0.06, lightSwitch.label ?? typeLabel[lightSwitch.type]);
    }
}

/** Resuelve la posición de un extremo de conductor entre los 4 tipos de nodo posibles. Busca en TODAS las entidades del nivel, no solo las de una disciplina, porque un conductor de alumbrado puede terminar en un tablero compartido. */
export function resolveConductorEndpoint(
    id: string,
    fixtures: Fixture[],
    switches: LightSwitch[],
    devices: ElectricalDevice[],
    jboxes: JunctionBox[],
): Pt | null {
    const fixture = fixtures.find((item) => item.id === id);
    if (fixture) return { x: fixture.x, y: fixture.y };
    const lightSwitch = switches.find((item) => item.id === id);
    if (lightSwitch) return { x: lightSwitch.x, y: lightSwitch.y };
    const device = devices.find((item) => item.id === id);
    if (device) return { x: device.x, y: device.y };
    const jbox = jboxes.find((item) => item.id === id);
    if (jbox) return { x: jbox.x, y: jbox.y };
    return null;
}

function emitConductorCurve(out: DxfLines, layer: string, curve: ConductorCurve, a: Pt, b: Pt): void {
    if (curve.kind === 'line') {
        dxfLine(out, layer, a.x, a.y, b.x, b.y);
        return;
    }
    dxfArc(out, layer, curve.cx, curve.cy, curve.r, curve.startDeg, curve.endDeg);
}

/** Marcas de conteo de hilos en el punto medio del tramo — mismo trazo que `buildDialuxDxfExport.ts`. */
function emitConductorTicks(out: DxfLines, layer: string, a: Pt, cp: Pt, b: Pt, wireCount: number): void {
    if (wireCount < 1) return;

    const midX = 0.25 * a.x + 0.5 * cp.x + 0.25 * b.x;
    const midY = 0.25 * a.y + 0.5 * cp.y + 0.25 * b.y;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    for (let i = 0; i < wireCount; i++) {
        const off = (i - (wireCount - 1) / 2) * TICK_SPACING;
        const tx = midX + ux * off;
        const ty = midY + uy * off;

        dxfLine(out, layer, tx - nx * TICK_HALF, ty - ny * TICK_HALF, tx + nx * TICK_HALF, ty + ny * TICK_HALF);

        let type: 'T' | 'N' | 'F';
        if (wireCount >= 3) type = i === 0 ? 'T' : i === 1 ? 'N' : 'F';
        else if (wireCount === 2) type = i === 0 ? 'N' : 'F';
        else type = 'F';

        const topX = tx + nx * TICK_HALF;
        const topY = ty + ny * TICK_HALF;

        if (type === 'T') {
            const barHalf = TICK_HALF * 0.45;
            dxfLine(out, layer, topX - ux * barHalf, topY - uy * barHalf, topX + ux * barHalf, topY + uy * barHalf);
        } else if (type === 'N') {
            const r = TICK_HALF * 0.22;
            dxfFilledDot(out, layer, topX + nx * r, topY + ny * r, r, 5);
        }
    }
}

/**
 * Dibuja los conductores de esta lámina. `allFixtures`/`allSwitches`/
 * `allDevices`/`allJunctionBoxes` deben ser TODAS las entidades del nivel
 * (sin filtrar por disciplina) para resolver correctamente extremos
 * compartidos, como un tablero conectado a ambas especialidades.
 */
export function renderConductorEntities(
    out: DxfLines, layer: string,
    conductors: Conductor[],
    allFixtures: Fixture[], allSwitches: LightSwitch[], allDevices: ElectricalDevice[], allJunctionBoxes: JunctionBox[],
): void {
    for (const conductor of conductors) {
        const srcPos = resolveConductorEndpoint(conductor.sourceId, allFixtures, allSwitches, allDevices, allJunctionBoxes);
        const tgtPos = resolveConductorEndpoint(conductor.targetId, allFixtures, allSwitches, allDevices, allJunctionBoxes);
        const nodes: Pt[] = [...(srcPos ? [srcPos] : []), ...conductor.waypoints, ...(tgtPos ? [tgtPos] : [])];
        if (nodes.length < 2) continue;

        // Signo invertido respecto al canvas (OverlayWires.tsx: isFloor?1:-1)
        // por el mismo motivo que `toDxfRotationDeg` arriba: el canvas calcula
        // el punto de control en espacio de pantalla (Y hacia abajo); el DXF
        // vive en espacio de mundo (Y hacia arriba). Sin este cambio de signo,
        // el cable se dibuja arqueado hacia el lado contrario al de DIAlux.
        const isFloor = conductor.routeType === 'floor';
        const curveDir = isFloor ? -1 : 1;
        const midSegIdx = Math.floor((nodes.length - 2) / 2);

        for (let i = 0; i < nodes.length - 1; i++) {
            const a = nodes[i]!;
            const b = nodes[i + 1]!;
            const curve = computeConductorCurve(a, b, curveDir);
            emitConductorCurve(out, layer, curve, a, b);

            if (i === midSegIdx) {
                const cp = conductorCp(a, b, curveDir);
                emitConductorTicks(out, layer, a, cp, b, conductor.wireCount);
            }
        }
    }
}
