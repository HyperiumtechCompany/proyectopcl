/**
 * autoDetectClosedRegion.ts — Ronda 28 (2026-08-20), a pedido explícito del
 * usuario: "proyección de dibujo como DIALux" = un solo clic DENTRO de un
 * contorno cerrado del plano importado genera el polígono automáticamente a
 * partir de la geometría DXF real, en vez de trazarlo vértice a vértice a
 * mano. Elimina el error de "área varía" que viene de la precisión del mouse
 * (a zoom 100%, 1 px ≈ 1-2 cm reales — cada clic manual acarrea ese margen).
 *
 * Método: relleno por inundación (flood-fill) sobre una grilla fina alrededor
 * del punto de clic, usando los segmentos de línea del DXF (y los muros ya
 * dibujados) como barreras, seguido de extracción de contorno por conteo de
 * aristas exteriores (mismo algoritmo que `buildRegionPolygon` en
 * `hooks/ambientSpaces.ts` — reimplementado aquí, no importado, para no
 * introducir una dependencia inversa `geometry/` → `hooks/`).
 *
 * Todo lo que NO se puede resolver con confianza devuelve un error explícito
 * (`AutoDetectFailure`) en vez de un polígono aproximado — nunca se inventa
 * un contorno cuando el área no cierra dentro del radio de búsqueda.
 */

export interface WorldPoint {
    x: number;
    y: number;
}

export interface Segment {
    start: WorldPoint;
    end: WorldPoint;
}

export interface AutoDetectOptions {
    /** Tamaño de celda de la grilla, en metros. Default 0.05 (5 cm) — muy por debajo del margen de error de un clic manual a zoom normal. */
    cellSizeM?: number;
    /** Media-anchura del área de búsqueda alrededor del clic, en metros. Default 30 (caja de 60×60 m). */
    maxRadiusM?: number;
    /** Tope de celdas visitadas antes de abortar por "no cierra" (protección de rendimiento). */
    maxCells?: number;
    /** Área mínima aceptable del polígono resultante, en m² — descarta ruido de 1-2 celdas. */
    minAreaM2?: number;
}

export type AutoDetectResult =
    | { ok: true; vertices: WorldPoint[]; areaM2: number }
    | { ok: false; reason: 'seed-blocked' | 'not-enclosed' | 'degenerate' };

const DEFAULTS: Required<AutoDetectOptions> = {
    // 2 cm: el contorno trazado sigue la última celda LIBRE antes de la
    // pared, así que hereda un sesgo de hasta ~1 celda hacia adentro en cada
    // lado (inherente a cualquier método raster, no un bug puntual — ver
    // `segmentIntersectsCell`). Con 2 cm el peor caso es ~2 cm por lado —
    // muy por debajo del margen real de un clic de mouse (1-2 cm por PÍXEL
    // a zoom 100%, no por vértice).
    cellSizeM: 0.02,
    maxRadiusM: 30,
    maxCells: 1_000_000,
    minAreaM2: 0.25,
};

/**
 * Intersección exacta segmento-vs-caja alineada a ejes, por el método de
 * slabs (Kay–Kajiya) en 2D — mismo método que `segmentOcclusion.ts` usa en
 * 3D para el solver de oclusión. Un segmento con longitud cero (start≈end)
 * nunca "atraviesa" nada — se trata como no-intersección, no como un punto
 * degenerado dentro de la caja.
 */
function segmentIntersectsCell(seg: Segment, x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return false;

    let tMin = 0;
    let tMax = 1;

    if (Math.abs(dx) < 1e-12) {
        if (seg.start.x < x0 || seg.start.x > x1) return false;
    } else {
        let t1 = (x0 - seg.start.x) / dx;
        let t2 = (x1 - seg.start.x) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    if (Math.abs(dy) < 1e-12) {
        if (seg.start.y < y0 || seg.start.y > y1) return false;
    } else {
        let t1 = (y0 - seg.start.y) / dy;
        let t2 = (y1 - seg.start.y) / dy;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    return tMin <= tMax;
}

/** Índice espacial simple: cubetas de 1 m conteniendo los índices de segmentos cuya caja envolvente las toca. */
function buildSegmentBuckets(segments: Segment[], bucketSizeM: number): Map<string, number[]> {
    const buckets = new Map<string, number[]>();
    const add = (bx: number, by: number, index: number) => {
        const key = `${bx},${by}`;
        const list = buckets.get(key);
        if (list) list.push(index);
        else buckets.set(key, [index]);
    };
    segments.forEach((seg, index) => {
        const minX = Math.min(seg.start.x, seg.end.x);
        const maxX = Math.max(seg.start.x, seg.end.x);
        const minY = Math.min(seg.start.y, seg.end.y);
        const maxY = Math.max(seg.start.y, seg.end.y);
        const bx0 = Math.floor(minX / bucketSizeM);
        const bx1 = Math.floor(maxX / bucketSizeM);
        const by0 = Math.floor(minY / bucketSizeM);
        const by1 = Math.floor(maxY / bucketSizeM);
        for (let bx = bx0; bx <= bx1; bx++) {
            for (let by = by0; by <= by1; by++) {
                add(bx, by, index);
            }
        }
    });
    return buckets;
}

interface RasterCell {
    col: number;
    row: number;
}

/**
 * Extrae el contorno de un conjunto de celdas ocupadas contando aristas
 * exteriores (cada arista que aparece una sola vez, nunca compartida entre
 * dos celdas del conjunto, pertenece al borde real). Mismo algoritmo que
 * `buildRegionPolygon` de `hooks/ambientSpaces.ts`, pero las claves del mapa
 * de aristas usan coordenadas ENTERAS de esquina de grilla (`col`,`row`),
 * nunca metros de punto flotante: `originX + col*cellSize` de una celda y
 * `originX + (col+1)*cellSize` de su vecina no siempre coinciden bit a bit
 * (cellSize no es una potencia de 2 exacta en binario), así que dos aristas
 * que deberían cancelarse por compartir el mismo borde interno terminaban
 * con claves de mapa distintas y rompían el conteo — la conversión a metros
 * se hace recién al final, sobre la secuencia ya trazada en espacio entero.
 */
function traceCellsContour(cells: RasterCell[], originX: number, originY: number, cellSize: number): WorldPoint[] {
    const occupied = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
    const hasCell = (col: number, row: number) => occupied.has(`${col},${row}`);

    const edgeCount = new Map<string, number>();
    const edgeTarget = new Map<string, [number, number]>();

    cells.forEach(({ col, row }) => {
        const addEdge = (sx: number, sy: number, ex: number, ey: number) => {
            const key = `${sx},${sy}`;
            edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
            edgeTarget.set(key, [ex, ey]);
        };

        // Esquinas de la celda en coordenadas enteras de grilla: SW=(col,row),
        // SE=(col+1,row), NE=(col+1,row+1), NW=(col,row+1). Convención
        // estándar de trazado de contorno (horario, el relleno queda a la
        // derecha del sentido de recorrido) — el algoritmo copiado de
        // `buildRegionPolygon` (`hooks/ambientSpaces.ts`) tenía norte/sur
        // invertidos (dibujaba la arista norte a la altura `y0`, no `y1`):
        // para un borde recto de más de una celda de largo, dos celdas
        // vecinas terminaban emitiendo aristas que ARRANCAN en el mismo
        // punto medio del borde (una "norte", la otra "oeste" de la celda
        // de arriba) — el conteo por punto de inicio las cancelaba a ambas
        // por "colisión", rompiendo la cadena. Con la orientación correcta
        // cada arista tiene un punto de inicio único a lo largo de todo el
        // contorno, sin importar cuántas celdas mida un lado recto.
        if (!hasCell(col, row + 1)) addEdge(col, row + 1, col + 1, row + 1); // norte
        if (!hasCell(col + 1, row)) addEdge(col + 1, row + 1, col + 1, row); // este
        if (!hasCell(col, row - 1)) addEdge(col + 1, row, col, row); // sur
        if (!hasCell(col - 1, row)) addEdge(col, row, col, row + 1); // oeste
    });

    const nextByStart = new Map<string, [number, number]>();
    edgeCount.forEach((count, key) => {
        if (count === 1) {
            const target = edgeTarget.get(key);
            if (target) nextByStart.set(key, target);
        }
    });

    const firstKey = nextByStart.keys().next().value as string | undefined;
    if (!firstKey) return [];

    const gridVertices: [number, number][] = [];
    let cursorKey = firstKey;
    const visited = new Set<string>();
    const maxSteps = nextByStart.size + 1;

    while (!visited.has(cursorKey) && gridVertices.length <= maxSteps) {
        visited.add(cursorKey);
        const [gx, gy] = cursorKey.split(',').map(Number) as [number, number];
        gridVertices.push([gx, gy]);
        const next = nextByStart.get(cursorKey);
        if (!next) return [];
        cursorKey = `${next[0]},${next[1]}`;
    }

    const worldVertices = gridVertices.map(([gx, gy]) => ({
        x: originX + gx * cellSize,
        y: originY + gy * cellSize,
    }));
    return simplifyCollinear(worldVertices);
}

/** Descarta vértices colineales consecutivos (producto cruzado ~0) — limpia el "escalonado" propio de un contorno de celdas. */
function simplifyCollinear(vertices: WorldPoint[]): WorldPoint[] {
    if (vertices.length < 3) return vertices;
    const out: WorldPoint[] = [];
    for (let i = 0; i < vertices.length; i++) {
        const prev = vertices[(i - 1 + vertices.length) % vertices.length]!;
        const curr = vertices[i]!;
        const next = vertices[(i + 1) % vertices.length]!;
        const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
        if (Math.abs(cross) > 1e-9) out.push(curr);
    }
    return out.length >= 3 ? out : vertices;
}

function polygonAreaM2(vertices: WorldPoint[]): number {
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]!;
        const b = vertices[(i + 1) % vertices.length]!;
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

/**
 * Detecta el contorno cerrado que contiene `seedPoint`, usando `segments`
 * (líneas DXF + muros ya dibujados, en metros de escena) como barreras.
 */
export function autoDetectClosedRegion(
    seedPoint: WorldPoint,
    segments: Segment[],
    options: AutoDetectOptions = {},
): AutoDetectResult {
    const { cellSizeM, maxRadiusM, maxCells, minAreaM2 } = { ...DEFAULTS, ...options };

    const originX = seedPoint.x - maxRadiusM;
    const originY = seedPoint.y - maxRadiusM;
    const gridSize = Math.ceil((maxRadiusM * 2) / cellSizeM);

    // Solo se consideran segmentos dentro (o rozando) la caja de búsqueda —
    // evita cargar el índice espacial con geometría irrelevante de planos grandes.
    const relevantSegments = segments.filter((seg) => {
        const minX = Math.min(seg.start.x, seg.end.x);
        const maxX = Math.max(seg.start.x, seg.end.x);
        const minY = Math.min(seg.start.y, seg.end.y);
        const maxY = Math.max(seg.start.y, seg.end.y);
        return (
            maxX >= originX && minX <= originX + maxRadiusM * 2 && maxY >= originY && minY <= originY + maxRadiusM * 2
        );
    });

    const bucketSizeM = Math.max(1, cellSizeM * 20);
    const buckets = buildSegmentBuckets(relevantSegments, bucketSizeM);

    const blockedCache = new Map<string, boolean>();
    const isBlocked = (col: number, row: number): boolean => {
        const key = `${col},${row}`;
        const cached = blockedCache.get(key);
        if (cached !== undefined) return cached;

        const x0 = originX + col * cellSizeM;
        const y0 = originY + row * cellSizeM;
        const centerX = x0 + cellSizeM / 2;
        const centerY = y0 + cellSizeM / 2;
        const bx = Math.floor(centerX / bucketSizeM);
        const by = Math.floor(centerY / bucketSizeM);
        let blocked = false;
        for (let dx = -1; dx <= 1 && !blocked; dx++) {
            for (let dy = -1; dy <= 1 && !blocked; dy++) {
                const indices = buckets.get(`${bx + dx},${by + dy}`);
                if (!indices) continue;
                for (const idx of indices) {
                    const seg = relevantSegments[idx]!;
                    // Intersección exacta segmento-vs-celda (no "centro a
                    // menos de X de la línea"): bloquea la celda solo cuando
                    // la línea realmente la atraviesa, con precisión de media
                    // celda en vez de un margen fijo — antes, con un umbral
                    // de distancia, el relleno se "erosionaba" ~0.75 celdas
                    // hacia adentro en cada lado (con celdas de 5 cm, hasta
                    // -4% de área en una habitación típica de 4×3 m).
                    if (segmentIntersectsCell(seg, x0, y0, x0 + cellSizeM, y0 + cellSizeM)) {
                        blocked = true;
                        break;
                    }
                }
            }
        }
        blockedCache.set(key, blocked);
        return blocked;
    };

    const seedCol = Math.floor((seedPoint.x - originX) / cellSizeM);
    const seedRow = Math.floor((seedPoint.y - originY) / cellSizeM);

    if (isBlocked(seedCol, seedRow)) {
        return { ok: false, reason: 'seed-blocked' };
    }

    const visited = new Set<string>([`${seedCol},${seedRow}`]);
    const queue: RasterCell[] = [{ col: seedCol, row: seedRow }];
    const cells: RasterCell[] = [];
    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ] as const;

    let escaped = false;
    while (queue.length > 0) {
        const current = queue.shift()!;
        cells.push(current);

        if (cells.length > maxCells) {
            escaped = true;
            break;
        }
        if (current.col <= 0 || current.row <= 0 || current.col >= gridSize - 1 || current.row >= gridSize - 1) {
            // Tocó el borde de la caja de búsqueda sin cerrar — el área real
            // (si existe) es más grande que `maxRadiusM`, no se asume nada.
            escaped = true;
            break;
        }

        for (const [dc, dr] of directions) {
            const nextCol = current.col + dc;
            const nextRow = current.row + dr;
            const key = `${nextCol},${nextRow}`;
            if (visited.has(key) || isBlocked(nextCol, nextRow)) continue;
            visited.add(key);
            queue.push({ col: nextCol, row: nextRow });
        }
    }

    if (escaped) {
        return { ok: false, reason: 'not-enclosed' };
    }

    const contour = traceCellsContour(cells, originX, originY, cellSizeM);
    if (contour.length < 3) {
        return { ok: false, reason: 'degenerate' };
    }

    const areaM2 = polygonAreaM2(contour);
    if (areaM2 < minAreaM2) {
        return { ok: false, reason: 'degenerate' };
    }

    return { ok: true, vertices: contour, areaM2 };
}

/** Extrae segmentos {start,end} de una polilínea/anillo de vértices, con soporte de cierre explícito. */
export function segmentsFromVertexRing(vertices: WorldPoint[], closed: boolean): Segment[] {
    const segments: Segment[] = [];
    for (let i = 1; i < vertices.length; i++) {
        segments.push({ start: vertices[i - 1]!, end: vertices[i]! });
    }
    if (closed && vertices.length > 2) {
        segments.push({ start: vertices[vertices.length - 1]!, end: vertices[0]! });
    }
    return segments;
}
