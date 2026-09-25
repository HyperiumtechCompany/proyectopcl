import { p, type DxfLines } from './primitives';

/**
 * Envoltorio de un DXF R12 de una sola lámina (HEADER + TABLES + ENTITIES):
 * lo usan los planos de Dialux v2 (unifilar de la red, planta general).
 * Archivo nuevo: no altera el pipeline multi-lámina de la V1
 * (`buildDxfMultiSheetDocument`).
 */
export interface DxfLayerDef {
    name: string;
    /** Índice de color ACI. */
    color: number;
}

export function buildSimpleDxfDocument(input: {
    layers: DxfLayerDef[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    /** 4 = mm, 6 = m ($INSUNITS). */
    insUnits: 4 | 6;
    renderEntities: (out: DxfLines) => void;
}): string {
    const out: DxfLines = [];
    p(out, 0, 'SECTION');
    p(out, 2, 'HEADER');
    p(out, 9, '$ACADVER');
    p(out, 1, 'AC1009');
    p(out, 9, '$INSUNITS');
    p(out, 70, input.insUnits);
    p(out, 9, '$EXTMIN');
    p(out, 10, input.bounds.minX.toFixed(4));
    p(out, 20, input.bounds.minY.toFixed(4));
    p(out, 9, '$EXTMAX');
    p(out, 10, input.bounds.maxX.toFixed(4));
    p(out, 20, input.bounds.maxY.toFixed(4));
    p(out, 0, 'ENDSEC');

    p(out, 0, 'SECTION');
    p(out, 2, 'TABLES');
    p(out, 0, 'TABLE');
    p(out, 2, 'LTYPE');
    p(out, 70, 1);
    p(out, 0, 'LTYPE');
    p(out, 2, 'CONTINUOUS');
    p(out, 70, 0);
    p(out, 3, 'Solid line');
    p(out, 72, 65);
    p(out, 73, 0);
    p(out, 40, '0.0');
    p(out, 0, 'ENDTAB');
    p(out, 0, 'TABLE');
    p(out, 2, 'LAYER');
    p(out, 70, input.layers.length);
    for (const layer of input.layers) {
        p(out, 0, 'LAYER');
        p(out, 2, layer.name);
        p(out, 70, 0);
        p(out, 62, layer.color);
        p(out, 6, 'CONTINUOUS');
    }
    p(out, 0, 'ENDTAB');
    p(out, 0, 'TABLE');
    p(out, 2, 'STYLE');
    p(out, 70, 1);
    p(out, 0, 'STYLE');
    p(out, 2, 'STANDARD');
    p(out, 70, 0);
    p(out, 40, '0.0');
    p(out, 41, '1.0');
    p(out, 50, '0.0');
    p(out, 71, 0);
    p(out, 42, '0.2');
    p(out, 3, 'txt');
    p(out, 4, '');
    p(out, 0, 'ENDTAB');
    p(out, 0, 'ENDSEC');

    p(out, 0, 'SECTION');
    p(out, 2, 'ENTITIES');
    input.renderEntities(out);
    p(out, 0, 'ENDSEC');
    p(out, 0, 'EOF');
    return `${out.join('\n')}\n`;
}
