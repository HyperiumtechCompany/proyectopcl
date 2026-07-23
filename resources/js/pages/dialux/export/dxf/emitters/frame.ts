import type { DxfSheetGeometry } from '../domain/types';
import { dxfPolyLines, rectCorners, type DxfLines } from './primitives';

/**
 * Dibuja el marco exterior e interior de una lámina (sección 8.1) en la capa
 * `MARCO`, en coordenadas LOCALES a la lámina (el mismo sistema que
 * `DxfSheetGeometry`). Fase 8 traslada estas líneas a la posición final de
 * cada lámina dentro del dibujo completo.
 */
export function renderSheetFrame(out: DxfLines, geometry: DxfSheetGeometry): void {
    dxfPolyLines(out, 'MARCO', rectCorners(geometry.frameOuter), true);
    dxfPolyLines(out, 'MARCO', rectCorners(geometry.frameInner), true);
}
