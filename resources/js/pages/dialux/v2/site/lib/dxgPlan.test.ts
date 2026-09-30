import { describe, expect, it } from 'vitest';
import { aciToRgb, dxgLayerColor, dxgSiteBounds, dxgStripIndices, parseDxgPlan } from './dxgPlan';

/** Arma un .dxg igual que `CadPlanGeometryBuilder`: una capa (por defecto, dos tiras). */
function sampleDxg(
    counts = new Uint32Array([2, 3]),
    points = new Float32Array([0, 0, 10, 0, 10, 0, 10, 5, 12, 5]),
    bbox = [0, 0, 12, 5],
): ArrayBuffer {
    const layerBytes = counts.byteLength + points.byteLength;
    let json = JSON.stringify({
        version: 1,
        origin: [500000, 8000000],
        bbox,
        layers: [{ name: 'MUROS', color: 1, visible: true, strips: counts.length, points: points.length / 2, offset: 0 }],
        texts: [[1, 1, 0.5, Math.PI / 2, 'Aula', 'MUROS']],
    });
    while (json.length % 4 !== 0) json += ' ';
    const header = new TextEncoder().encode(json);
    const buffer = new ArrayBuffer(8 + header.length + layerBytes);
    const bytes = new Uint8Array(buffer);
    bytes.set(new TextEncoder().encode('DXG1'), 0);
    new DataView(buffer).setUint32(4, header.length, true);
    bytes.set(header, 8);
    bytes.set(new Uint8Array(counts.buffer), 8 + header.length);
    bytes.set(new Uint8Array(points.buffer), 8 + header.length + counts.byteLength);
    return buffer;
}

describe('dxgPlan', () => {
    it('lee capas, tiras y textos sin copiar los datos', () => {
        const plan = parseDxgPlan(sampleDxg());
        const [layer] = plan.layers;
        expect(layer.name).toBe('MUROS');
        expect(Array.from(layer.counts)).toEqual([2, 3]);
        expect(layer.points[8] + plan.origin[0]).toBe(500012);
        expect(plan.texts[0][4]).toBe('Aula');
    });

    it('rechaza un archivo que no es geometría', () => {
        expect(() => parseDxgPlan(new TextEncoder().encode('0\r\nSECTION').buffer as ArrayBuffer)).toThrow();
    });

    it('corta cada tira con el índice de reinicio de primitiva', () => {
        expect(Array.from(dxgStripIndices(new Uint32Array([2, 3])))).toEqual([0, 1, 0xffffffff, 2, 3, 4, 0xffffffff]);
    });

    it('la extensión pasa al emplazamiento con Y invertida', () => {
        expect(dxgSiteBounds(parseDxgPlan(sampleDxg()))).toEqual({ x: 500000, y: -8000005, width: 12, height: 5 });
    });

    it('el encuadre ignora objetos sueltos lejanos (basura del DWG)', () => {
        // 1000 puntos del dibujo en [0, 100] y una línea perdida a 2 000 km.
        const drawing = Array.from({ length: 2000 }, (_, i) => (i * 37) % 101);
        const points = new Float32Array([...drawing, 0, 0, 2_000_000, 2_000_000]);
        const counts = new Uint32Array([1000, 2]);
        const plan = parseDxgPlan(sampleDxg(counts, points, [0, 0, 2_000_000, 2_000_000]));
        const [minX, , maxX] = plan.fitBox;
        expect(maxX - minX).toBeLessThan(120);
        expect(dxgSiteBounds(plan).width).toBeLessThan(120);
    });

    it('colores ACI de AutoCAD', () => {
        expect(aciToRgb(1)).toEqual([255, 0, 0]);
        expect(aciToRgb(10)).toEqual([255, 0, 0]);
        expect(aciToRgb(250)).toEqual([51, 51, 51]);
        // 7 = negro sobre fondo claro, claro sobre fondo oscuro.
        expect(dxgLayerColor(7, false)).toEqual([15, 23, 42]);
        expect(dxgLayerColor(7, true)).toEqual([226, 232, 240]);
        // Amarillo puro se oscurece sobre fondo claro para leerse.
        expect(Math.max(...dxgLayerColor(2, false))).toBeLessThan(255);
    });
});
