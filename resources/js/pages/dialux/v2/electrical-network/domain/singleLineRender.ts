import { buildSimpleDxfDocument } from '@/pages/dialux/export/dxf/emitters/document';
import {
    dxfCircle,
    dxfLine,
    dxfPolyLines,
    dxfText,
    type DxfLines,
} from '@/pages/dialux/export/dxf/emitters/primitives';
import {
    SLD_BOX_H_MM,
    SLD_BOX_W_MM,
    SLD_MARGIN_MM,
    type SingleLineDiagram,
    type SldNode,
} from './singleLineDiagram';

/**
 * Dibujo del unifilar (E2) a partir del modelo `buildSingleLineDiagram`:
 * SVG (vista previa e impresión a PDF desde el navegador) y DXF R12 con las
 * primitivas de la exportación DXF de la V1 (`export/dxf/emitters/primitives`),
 * en milímetros, una capa por tipo de entidad.
 */

/** mm bajo la caja del padre donde corre la barra horizontal. */
const ROUTE_Y_OFFSET = 22;

/** Recorrido ortogonal padre → hijo: baja, cruza y baja hasta la caja del hijo. */
export function edgePath(from: SldNode, to: SldNode): Array<{ x: number; y: number }> {
    const top = from.y + SLD_BOX_H_MM / 2;
    const busY = top + ROUTE_Y_OFFSET;
    return [
        { x: from.x, y: top },
        { x: from.x, y: busY },
        { x: to.x, y: busY },
        { x: to.x, y: to.y - SLD_BOX_H_MM / 2 },
    ];
}

const escapeXml = (content: string) =>
    content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isRound = (node: SldNode) => node.kind === 'service' || node.kind === 'meter';

/** Posición del texto de un nodo (a la derecha del símbolo redondo, dentro de la caja). */
function textAnchor(node: SldNode) {
    return isRound(node)
        ? { x: node.x + 7, y: node.y - 3 }
        : { x: node.x - SLD_BOX_W_MM / 2 + 1.5, y: node.y - SLD_BOX_H_MM / 2 + 3.6 };
}

export function renderSingleLineSvg(diagram: SingleLineDiagram): string {
    const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
    const parts: string[] = [];
    const text = (x: number, y: number, size: number, content: string, extra = '') =>
        parts.push(
            `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" font-family="Arial, sans-serif" ${extra}>${escapeXml(content)}</text>`,
        );
    parts.push(
        `<rect x="0" y="0" width="${diagram.widthMm}" height="${diagram.heightMm}" fill="#fff"/>`,
        `<rect x="5" y="5" width="${diagram.widthMm - 10}" height="${diagram.heightMm - 10}" fill="none" stroke="#111" stroke-width="0.5"/>`,
    );
    text(SLD_MARGIN_MM, SLD_MARGIN_MM, 5, diagram.title, 'font-weight="bold"');
    for (const edge of diagram.edges) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) continue;
        const color = edge.warning ? '#dc2626' : '#111';
        const path = edgePath(from, to);
        parts.push(
            `<polyline points="${path.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="0.35"/>`,
        );
        // Interruptor: cuadrito en el tramo que baja al hijo.
        const by = path[2].y + 4;
        parts.push(
            `<rect x="${to.x - 1.5}" y="${by - 1.5}" width="3" height="3" fill="#fff" stroke="${color}" stroke-width="0.35"/>`,
        );
        [...(edge.breaker ? [edge.breaker] : []), ...edge.lines].forEach((line, index) =>
            text(to.x + 2.5, by + index * 3.2, 2.4, line, `fill="${color}"`),
        );
    }
    for (const node of diagram.nodes) {
        const color = node.warning ? '#dc2626' : '#111';
        const x0 = node.x - SLD_BOX_W_MM / 2;
        const y0 = node.y - SLD_BOX_H_MM / 2;
        if (node.kind === 'service') {
            parts.push(
                `<circle cx="${node.x}" cy="${node.y - 2}" r="4" fill="#fff" stroke="${color}" stroke-width="0.35"/>`,
                `<circle cx="${node.x}" cy="${node.y + 3}" r="4" fill="none" stroke="${color}" stroke-width="0.35"/>`,
            );
        } else if (node.kind === 'meter') {
            parts.push(`<circle cx="${node.x}" cy="${node.y}" r="5" fill="#fff" stroke="${color}" stroke-width="0.35"/>`);
            text(node.x - 2.6, node.y + 1, 2.4, 'kWh');
        } else {
            const dashed = node.kind === 'output' ? ' stroke-dasharray="1.5 1"' : '';
            parts.push(
                `<rect x="${x0}" y="${y0}" width="${SLD_BOX_W_MM}" height="${SLD_BOX_H_MM}" fill="#fff" stroke="${color}" stroke-width="${node.kind === 'output' ? 0.25 : 0.5}"${dashed}/>`,
            );
        }
        const anchor = textAnchor(node);
        text(anchor.x, anchor.y, 2.8, node.title, `font-weight="bold" fill="${color}"`);
        node.lines.forEach((line, index) =>
            text(anchor.x, anchor.y + 3.1 * (index + 1), 2.3, line, `fill="${color}"`),
        );
    }
    diagram.notes.forEach((note, index) =>
        text(
            SLD_MARGIN_MM,
            diagram.heightMm - SLD_MARGIN_MM - (diagram.notes.length - 1 - index) * 4,
            2.4,
            note,
        ),
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${diagram.widthMm}mm" height="${diagram.heightMm}mm" viewBox="0 0 ${diagram.widthMm} ${diagram.heightMm}">${parts.join('')}</svg>`;
}

const LAYERS = [
    { name: 'UNIF-EQUIPOS', color: 7 },
    { name: 'UNIF-CONDUCTORES', color: 5 },
    { name: 'UNIF-TEXTO', color: 7 },
    { name: 'UNIF-ALERTAS', color: 1 },
    { name: 'UNIF-MARCO', color: 8 },
];

/** DXF R12 en mm (Y hacia arriba: y_dxf = alto − y). */
export function renderSingleLineDxf(diagram: SingleLineDiagram): string {
    const H = diagram.heightMm;
    const Y = (y: number) => H - y;
    return buildSimpleDxfDocument({
        layers: LAYERS,
        bounds: { minX: 0, minY: 0, maxX: diagram.widthMm, maxY: H },
        insUnits: 4,
        renderEntities: (out) => renderSingleLineEntities(out, diagram, Y),
    });
}

function renderSingleLineEntities(
    out: DxfLines,
    diagram: SingleLineDiagram,
    Y: (y: number) => number,
): void {
    const H = diagram.heightMm;

    const rect = (layer: string, x0: number, y0: number, w: number, h: number) =>
        dxfPolyLines(
            out,
            layer,
            [
                { x: x0, y: Y(y0) },
                { x: x0 + w, y: Y(y0) },
                { x: x0 + w, y: Y(y0 + h) },
                { x: x0, y: Y(y0 + h) },
            ],
            true,
        );
    rect('UNIF-MARCO', 5, 5, diagram.widthMm - 10, H - 10);
    dxfText(out, 'UNIF-TEXTO', SLD_MARGIN_MM, Y(SLD_MARGIN_MM), 5, diagram.title);
    const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
    for (const edge of diagram.edges) {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) continue;
        const layer = edge.warning ? 'UNIF-ALERTAS' : 'UNIF-CONDUCTORES';
        const path = edgePath(from, to);
        for (let i = 0; i < path.length - 1; i++) {
            dxfLine(out, layer, path[i].x, Y(path[i].y), path[i + 1].x, Y(path[i + 1].y));
        }
        const by = path[2].y + 4;
        rect(layer, to.x - 1.5, by - 1.5, 3, 3);
        [...(edge.breaker ? [edge.breaker] : []), ...edge.lines].forEach((line, index) =>
            dxfText(
                out,
                edge.warning ? 'UNIF-ALERTAS' : 'UNIF-TEXTO',
                to.x + 2.5,
                Y(by + index * 3.2),
                2.4,
                line,
            ),
        );
    }
    for (const node of diagram.nodes) {
        const layer = node.warning ? 'UNIF-ALERTAS' : 'UNIF-EQUIPOS';
        if (node.kind === 'service') {
            dxfCircle(out, layer, node.x, Y(node.y - 2), 4);
            dxfCircle(out, layer, node.x, Y(node.y + 3), 4);
        } else if (node.kind === 'meter') {
            dxfCircle(out, layer, node.x, Y(node.y), 5);
            dxfText(out, 'UNIF-TEXTO', node.x - 2.6, Y(node.y + 1), 2.4, 'kWh');
        } else {
            rect(
                layer,
                node.x - SLD_BOX_W_MM / 2,
                node.y - SLD_BOX_H_MM / 2,
                SLD_BOX_W_MM,
                SLD_BOX_H_MM,
            );
        }
        const anchor = textAnchor(node);
        dxfText(out, node.warning ? 'UNIF-ALERTAS' : 'UNIF-TEXTO', anchor.x, Y(anchor.y), 2.8, node.title);
        node.lines.forEach((line, index) =>
            dxfText(out, 'UNIF-TEXTO', anchor.x, Y(anchor.y + 3.1 * (index + 1)), 2.3, line),
        );
    }
    diagram.notes.forEach((note, index) =>
        dxfText(
            out,
            'UNIF-TEXTO',
            SLD_MARGIN_MM,
            Y(H - SLD_MARGIN_MM - (diagram.notes.length - 1 - index) * 4),
            2.4,
            note,
        ),
    );
}
