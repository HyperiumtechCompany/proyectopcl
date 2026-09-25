import type {
    StandardMaterial,
    TransformNode} from '@babylonjs/core';
import {
    Color3,
    DynamicTexture,
    Mesh,
    MeshBuilder,
    Vector3,
    type Scene,
} from '@babylonjs/core';
import { courtLines } from '../domain/courtLayout';
import type {
    CanopyConfig,
    CourtConfig,
    GreenAreaConfig,
    RoofKind,
    TreeConfig,
} from '../domain/types';

/** Lo que estos constructores necesitan del `SiteBuilder3D` (evita acoplarlos a la clase). */
export interface SceneryContext {
    scene: Scene;
    matFor: (hex: string, alpha?: number, specular?: number) => StandardMaterial;
    addShadowCaster: (mesh: Mesh) => void;
    /** Materiales con textura procedural, cacheados y liberados por el builder. */
    textured: (kind: SurfaceKind, tint: string, uTiles: number, vTiles: number) => StandardMaterial;
}

export type SurfaceKind = 'grass' | 'paving' | 'asphalt' | 'concrete' | 'tile';

/** Textura procedural en escala de grises claros — se tiñe con el color del elemento. */
export function createSurfaceTexture(scene: Scene, kind: SurfaceKind): DynamicTexture {
    const size = 256;
    const texture = new DynamicTexture(`site_tex_${kind}`, size, scene, true);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    // Aleatorio determinista (misma textura en cada sesión).
    let seed = kind.length * 9301 + 49297;
    const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    const gray = (v: number, a = 1) => {
        const c = Math.round(255 * Math.min(1, Math.max(0, v)));
        return `rgba(${c},${c},${c},${a})`;
    };
    ctx.fillStyle = gray(kind === 'asphalt' ? 0.82 : 0.9);
    ctx.fillRect(0, 0, size, size);
    if (kind === 'grass') {
        for (let i = 0; i < 2600; i++) {
            const x = rnd() * size;
            const y = rnd() * size;
            ctx.strokeStyle = gray(0.62 + rnd() * 0.38, 0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 5);
            ctx.stroke();
        }
    } else if (kind === 'tile') {
        // Teja: hileras horizontales con juntas verticales alternadas.
        const rows = 8;
        const rowH = size / rows;
        for (let r = 0; r < rows; r++) {
            const offset = (r % 2) * (size / 8);
            for (let c = -1; c < 5; c++) {
                ctx.fillStyle = gray(0.8 + rnd() * 0.18);
                ctx.fillRect(offset + c * (size / 4), r * rowH, size / 4, rowH);
                ctx.strokeStyle = gray(0.5);
                ctx.lineWidth = 2;
                ctx.strokeRect(offset + c * (size / 4), r * rowH, size / 4, rowH);
            }
        }
    } else if (kind === 'paving') {
        const tile = size / 4;
        for (let ty = 0; ty < 4; ty++) {
            for (let tx = 0; tx < 4; tx++) {
                ctx.fillStyle = gray(0.86 + rnd() * 0.12);
                ctx.fillRect(tx * tile, ty * tile, tile, tile);
            }
        }
        ctx.strokeStyle = gray(0.55);
        ctx.lineWidth = 3;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(i * tile, 0);
            ctx.lineTo(i * tile, size);
            ctx.moveTo(0, i * tile);
            ctx.lineTo(size, i * tile);
            ctx.stroke();
        }
    } else {
        // asphalt / concrete: grano fino
        const spread = kind === 'asphalt' ? 0.22 : 0.12;
        for (let i = 0; i < 3500; i++) {
            ctx.fillStyle = gray(0.9 - rnd() * spread * 2, 0.55);
            ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
        }
        if (kind === 'concrete') {
            // Juntas de dilatación.
            ctx.strokeStyle = gray(0.6);
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, size - 2, size - 2);
        }
    }
    texture.update();
    texture.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
    texture.wrapV = DynamicTexture.WRAP_ADDRESSMODE;
    return texture;
}

/** Metros por repetición de la textura de cada superficie. */
export const SURFACE_TILE_M: Record<SurfaceKind, number> = {
    grass: 2,
    paving: 4,
    asphalt: 4,
    concrete: 5,
    tile: 1,
};

interface Bounds2 {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export function localBounds(vertices: Vector3[]): Bounds2 {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const v of vertices) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minZ = Math.min(minZ, v.z);
        maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ };
}

/** Losa con textura: `topY` = cara superior, extruida hacia abajo `depth`. */
export function buildTexturedSlab(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    localVertices: Vector3[],
    kind: SurfaceKind,
    tint: string,
    depth: number,
    topY: number,
) {
    const b = localBounds(localVertices);
    const mat = ctx.textured(
        kind,
        tint,
        (b.maxX - b.minX) / SURFACE_TILE_M[kind],
        (b.maxZ - b.minZ) / SURFACE_TILE_M[kind],
    );
    const slab = MeshBuilder.CreatePolygon(
        `site_slab_${id}`,
        { shape: localVertices, depth, sideOrientation: Mesh.DOUBLESIDE },
        ctx.scene,
    );
    slab.position.y = topY;
    slab.material = mat;
    slab.receiveShadows = true;
    slab.parent = parent;
    return slab;
}

// ---------------------------------------------------------------------------
// Cubiertas (techados, entradas techadas, canchas techadas)
// ---------------------------------------------------------------------------

interface RoofOptions {
    heightM: number;
    roof: RoofKind;
    translucent: boolean;
    columnSpacingM: number;
    columnDiameterM: number;
    color: string;
}

/**
 * Cubierta sobre columnas para un contorno local. Plana → polígono extruido;
 * a dos aguas / en arco → sobre la caja del contorno, con la cumbrera a lo largo
 * del lado mayor. Las columnas van en los dos lados largos.
 */
export function buildRoofStructure(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    localVertices: Vector3[],
    o: RoofOptions,
) {
    const b = localBounds(localVertices);
    const dx = b.maxX - b.minX;
    const dz = b.maxZ - b.minZ;
    const alongX = dx >= dz;
    const length = Math.max(dx, dz);
    const span = Math.min(dx, dz);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const P = (a: number, c: number, y: number) =>
        alongX
            ? new Vector3(cx + a, y, cz + c)
            : new Vector3(cx + c, y, cz + a);

    const roofMat = o.translucent
        ? ctx.matFor('#bfdbfe', 0.5, 0.5)
        : ctx.matFor(o.color, 1, 0.15);
    const steel = ctx.matFor('#64748b', 1, 0.3);
    const rise = o.roof === 'flat' ? 0 : Math.max(0.4, span * (o.roof === 'arched' ? 0.16 : 0.14));

    let roofMesh: Mesh;
    if (o.roof === 'flat') {
        roofMesh = MeshBuilder.CreatePolygon(
            `site_roof_${id}`,
            { shape: localVertices, depth: 0.18, sideOrientation: Mesh.DOUBLESIDE },
            ctx.scene,
        );
        roofMesh.position.y = o.heightM + 0.18;
    } else {
        const paths: Vector3[][] = [];
        const steps = o.roof === 'arched' ? 14 : 2;
        for (let i = 0; i <= steps; i++) {
            const u = i / steps; // 0..1 a través de la luz
            const c = -span / 2 + span * u;
            const t = 1 - Math.pow(2 * u - 1, 2); // parábola: 0 en aleros, 1 en cumbrera
            const y =
                o.roof === 'arched'
                    ? o.heightM + rise * t
                    : o.heightM + rise * (1 - Math.abs(2 * u - 1));
            paths.push([P(-length / 2, c, y), P(length / 2, c, y)]);
        }
        roofMesh = MeshBuilder.CreateRibbon(
            `site_roof_${id}`,
            { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE },
            ctx.scene,
        );
    }
    roofMesh.material = roofMat;
    roofMesh.parent = parent;
    ctx.addShadowCaster(roofMesh);

    // Columnas en los dos lados largos (equiespaciadas, incluyendo las esquinas).
    const nCols = Math.max(2, Math.round(length / Math.max(1, o.columnSpacingM)) + 1);
    const columns: Mesh[] = [];
    for (const side of [-1, 1]) {
        for (let i = 0; i < nCols; i++) {
            const a = -length / 2 + (length * i) / (nCols - 1);
            const col = MeshBuilder.CreateCylinder(
                `site_col_${id}_${side}_${i}`,
                { diameter: Math.max(0.1, o.columnDiameterM), height: o.heightM, tessellation: 12 },
                ctx.scene,
            );
            col.position = P(a, (side * span) / 2, o.heightM / 2);
            columns.push(col);
        }
        // Viga perimetral.
        const beam = MeshBuilder.CreateBox(
            `site_beam_${id}_${side}`,
            alongX
                ? { width: length, height: 0.2, depth: 0.15 }
                : { width: 0.15, height: 0.2, depth: length },
            ctx.scene,
        );
        beam.position = P(0, (side * span) / 2, o.heightM - 0.1);
        beam.material = steel;
        beam.parent = parent;
        ctx.addShadowCaster(beam);
    }
    const merged = Mesh.MergeMeshes(columns, true, true);
    if (merged) {
        merged.material = steel;
        merged.parent = parent;
        ctx.addShadowCaster(merged);
    }
}

export function buildCanopyMeshes(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    localVertices: Vector3[],
    cfg: CanopyConfig,
    color: string,
) {
    buildRoofStructure(ctx, parent, id, localVertices, {
        heightM: cfg.heightM,
        roof: cfg.roof,
        translucent: cfg.translucent,
        columnSpacingM: cfg.columnSpacingM,
        columnDiameterM: cfg.columnDiameterM,
        color,
    });
    // Piso bajo el techado (losa de concreto pulida).
    const b = localBounds(localVertices);
    const floor = ctx.textured(
        'concrete',
        '#d6d3d1',
        (b.maxX - b.minX) / SURFACE_TILE_M.concrete,
        (b.maxZ - b.minZ) / SURFACE_TILE_M.concrete,
    );
    const slab = MeshBuilder.CreatePolygon(
        `site_canopy_floor_${id}`,
        { shape: localVertices, depth: 0.1, sideOrientation: Mesh.DOUBLESIDE },
        ctx.scene,
    );
    slab.position.y = 0.06;
    slab.material = floor;
    slab.receiveShadows = true;
    slab.parent = parent;
}

// ---------------------------------------------------------------------------
// Canchas
// ---------------------------------------------------------------------------

const COURT_COLORS: Record<string, string> = {
    multi: '#2f6f4f',
    futsal: '#2f6f4f',
    basketball: '#b8562c',
    volleyball: '#3b6ea5',
    none: '#9ca3af',
};

function lineSegmentBoxes(
    ctx: SceneryContext,
    id: string,
    polylines: Array<Array<[number, number]>>,
    toWorld: (a: number, c: number) => Vector3,
): Mesh[] {
    const boxes: Mesh[] = [];
    let n = 0;
    for (const line of polylines) {
        for (let i = 0; i < line.length - 1; i++) {
            const p = toWorld(line[i][0], line[i][1]);
            const q = toWorld(line[i + 1][0], line[i + 1][1]);
            const len = Vector3.Distance(p, q);
            if (len < 1e-3) continue;
            const box = MeshBuilder.CreateBox(
                `site_mark_${id}_${n++}`,
                { width: len + 0.06, height: 0.012, depth: 0.09 },
                ctx.scene,
            );
            box.position = Vector3.Center(p, q);
            box.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
            boxes.push(box);
        }
    }
    return boxes;
}

export function buildCourtMeshes(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    localVertices: Vector3[],
    cfg: CourtConfig,
    fillColor: string,
) {
    const b = localBounds(localVertices);
    const dx = b.maxX - b.minX;
    const dz = b.maxZ - b.minZ;
    const alongX = dx >= dz;
    const length = Math.max(dx, dz);
    const width = Math.min(dx, dz);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const toWorld = (a: number, c: number) =>
        alongX
            ? new Vector3(cx + a, 0.1, cz + c)
            : new Vector3(cx + c, 0.1, cz + a);

    // Losa de la cancha: color del elemento si el usuario lo cambió; si no, el propio del deporte.
    const tint = fillColor && fillColor !== '#9ca3af' ? fillColor : COURT_COLORS[cfg.sport];
    buildTexturedSlab(ctx, parent, id, localVertices, 'concrete', tint, 0.1, 0.08);

    if (cfg.sport !== 'none') {
        const lines = courtLines(cfg.sport, length, width);
        const boxes = lineSegmentBoxes(ctx, id, lines, toWorld);
        const merged = boxes.length > 0 ? Mesh.MergeMeshes(boxes, true, true) : null;
        if (merged) {
            merged.material = ctx.matFor('#f8fafc', 1, 0.05);
            merged.parent = parent;
        }
        buildCourtEquipment(ctx, parent, id, cfg, length, width, toWorld);
    }

    if (cfg.covered) {
        buildRoofStructure(ctx, parent, `${id}_roof`, localVertices, {
            heightM: cfg.roofHeightM,
            roof: cfg.roof,
            translucent: false,
            columnSpacingM: 6,
            columnDiameterM: 0.4,
            color: '#e2e8f0',
        });
    }
}

function buildCourtEquipment(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    cfg: CourtConfig,
    length: number,
    width: number,
    toWorld: (a: number, c: number) => Vector3,
) {
    const steel = ctx.matFor('#475569', 1, 0.3);
    const white = ctx.matFor('#f8fafc', 1, 0.1);
    const orange = ctx.matFor('#ea580c', 1, 0.2);
    const place = (mesh: Mesh, a: number, c: number, y: number) => {
        const p = toWorld(a, c);
        mesh.position.set(p.x, y, p.z);
        mesh.parent = parent;
        ctx.addShadowCaster(mesh);
    };
    const ground = 0.09;
    // `crossYaw`: las piezas se modelan con su cara "ancha" a lo largo del eje Z local;
    // si el largo va por X la rotación no cambia (a = X). Si va por Z, gira 90°.
    const alongX = toWorld(1, 0).x - toWorld(0, 0).x !== 0;
    const yaw = alongX ? 0 : Math.PI / 2;

    if (cfg.sport === 'basketball' || cfg.sport === 'multi') {
        for (const side of [-1, 1]) {
            const a = side * (length / 2 - 0.4);
            const post = MeshBuilder.CreateCylinder(`site_hoop_post_${id}_${side}`, { diameter: 0.15, height: 3.6 }, ctx.scene);
            post.material = steel;
            place(post, a + side * 0.4, 0, ground + 1.8);
            const board = MeshBuilder.CreateBox(`site_hoop_board_${id}_${side}`, { width: 0.05, height: 1.05, depth: 1.8 }, ctx.scene);
            board.material = white;
            board.rotation.y = yaw;
            place(board, a + side * 0.1, 0, ground + 3.05);
            const ring = MeshBuilder.CreateTorus(`site_hoop_ring_${id}_${side}`, { diameter: 0.45, thickness: 0.03, tessellation: 20 }, ctx.scene);
            ring.material = orange;
            place(ring, a - side * 0.3, 0, ground + 3.05);
        }
    }
    if (cfg.sport === 'futsal') {
        for (const side of [-1, 1]) {
            const a = side * (length / 2);
            const goal = MeshBuilder.CreateBox(`site_goal_${id}_${side}`, { width: 0.06, height: 2, depth: 3 }, ctx.scene);
            goal.material = white;
            goal.rotation.y = yaw;
            place(goal, a, 0, ground + 1);
        }
    }
    if (cfg.sport === 'volleyball' || cfg.sport === 'multi') {
        const netH = 2.43;
        for (const side of [-1, 1]) {
            const post = MeshBuilder.CreateCylinder(`site_net_post_${id}_${side}`, { diameter: 0.1, height: netH + 0.1 }, ctx.scene);
            post.material = steel;
            place(post, 0, (side * width) / 2 + side * 0.4, ground + (netH + 0.1) / 2);
        }
        const net = MeshBuilder.CreatePlane(`site_net_${id}`, { width: width + 0.8, height: 1 }, ctx.scene);
        const netMat = ctx.matFor('#f1f5f9', 0.45, 0);
        net.material = netMat;
        net.rotation.y = yaw + Math.PI / 2;
        place(net, 0, 0, ground + netH - 0.5);
    }
}

// ---------------------------------------------------------------------------
// Áreas verdes en gradas
// ---------------------------------------------------------------------------

type PlanPoint = { x: number; z: number };

/** Recorta un polígono a la banda `lo ≤ coord ≤ hi` (Sutherland–Hodgman, dos semiplanos). */
export function clipPolygonToBand(
    poly: PlanPoint[],
    axis: 'x' | 'z',
    lo: number,
    hi: number,
): PlanPoint[] {
    const clip = (pts: PlanPoint[], keep: (p: PlanPoint) => number): PlanPoint[] => {
        // keep(p) >= 0 ⇒ dentro
        const out: PlanPoint[] = [];
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const da = keep(a);
            const db = keep(b);
            if (da >= 0) out.push(a);
            if (da >= 0 !== db >= 0) {
                const t = da / (da - db);
                out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
            }
        }
        return out;
    };
    let pts = clip(poly, (p) => p[axis] - lo);
    if (pts.length >= 3) pts = clip(pts, (p) => hi - p[axis]);
    return pts;
}

export function buildTerracedGreen(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    localVertices: Vector3[],
    cfg: GreenAreaConfig,
    tint: string,
) {
    const b = localBounds(localVertices);
    const dx = b.maxX - b.minX;
    const dz = b.maxZ - b.minZ;
    const axis: 'x' | 'z' = dx >= dz ? 'x' : 'z';
    const min = axis === 'x' ? b.minX : b.minZ;
    const total = axis === 'x' ? dx : dz;
    const n = Math.max(2, Math.min(12, Math.round(cfg.terraces)));
    const poly = localVertices.map((v) => ({ x: v.x, z: v.z }));
    const wall = ctx.matFor('#a8a29e', 1, 0.05);
    for (let i = 0; i < n; i++) {
        const band = clipPolygonToBand(
            poly,
            axis,
            min + (total * i) / n,
            min + (total * (i + 1)) / n,
        );
        if (band.length < 3) continue;
        const shape = band.map((p) => new Vector3(p.x, 0, p.z));
        const top = 0.06 + cfg.terraceRiseM * i;
        const bb = localBounds(shape);
        const base = MeshBuilder.CreatePolygon(
            `site_terrace_wall_${id}_${i}`,
            { shape, depth: top, sideOrientation: Mesh.DOUBLESIDE },
            ctx.scene,
        );
        base.position.y = top;
        base.material = wall;
        base.receiveShadows = true;
        base.parent = parent;
        ctx.addShadowCaster(base);
        const mat = ctx.textured(
            'grass',
            tint,
            (bb.maxX - bb.minX) / SURFACE_TILE_M.grass,
            (bb.maxZ - bb.minZ) / SURFACE_TILE_M.grass,
        );
        const cap = MeshBuilder.CreatePolygon(
            `site_terrace_grass_${id}_${i}`,
            { shape, depth: 0.05, sideOrientation: Mesh.DOUBLESIDE },
            ctx.scene,
        );
        cap.position.y = top + 0.03;
        cap.material = mat;
        cap.receiveShadows = true;
        cap.parent = parent;
    }
}

// ---------------------------------------------------------------------------
// Árboles
// ---------------------------------------------------------------------------

export function buildTreeMeshes(
    ctx: SceneryContext,
    parent: TransformNode,
    id: string,
    cfg: TreeConfig,
) {
    const bark = ctx.matFor('#6b4f36', 1, 0.02);
    const leaf = ctx.matFor(
        cfg.species === 'conifer' ? '#1f5f3a' : cfg.species === 'palm' ? '#3f8f3f' : '#3b8a3e',
        1,
        0.05,
    );
    const H = Math.max(1, cfg.heightM);
    const R = Math.max(0.5, cfg.crownM / 2);
    const add = (mesh: Mesh, material: StandardMaterial, shadow = true) => {
        mesh.material = material;
        mesh.parent = parent;
        if (shadow) ctx.addShadowCaster(mesh);
        return mesh;
    };

    if (cfg.species === 'conifer') {
        const trunkH = H * 0.15;
        const trunk = MeshBuilder.CreateCylinder(`site_tree_trunk_${id}`, { diameterTop: 0.15, diameterBottom: 0.3, height: trunkH, tessellation: 8 }, ctx.scene);
        trunk.position.y = trunkH / 2;
        add(trunk, bark);
        const tiers = 3;
        for (let i = 0; i < tiers; i++) {
            const h = (H - trunkH) / tiers * 1.5;
            const cone = MeshBuilder.CreateCylinder(`site_tree_cone_${id}_${i}`, { diameterTop: 0, diameterBottom: R * 2 * (1 - i * 0.28), height: h, tessellation: 12 }, ctx.scene);
            cone.position.y = trunkH + ((H - trunkH) / tiers) * i + h / 2;
            add(cone, leaf);
        }
        return;
    }

    if (cfg.species === 'palm') {
        const trunkH = H * 0.85;
        const trunk = MeshBuilder.CreateCylinder(`site_tree_trunk_${id}`, { diameterTop: 0.22, diameterBottom: 0.38, height: trunkH, tessellation: 8 }, ctx.scene);
        trunk.position.y = trunkH / 2;
        add(trunk, bark);
        const fronds: Mesh[] = [];
        for (let i = 0; i < 8; i++) {
            const frond = MeshBuilder.CreateBox(`site_tree_frond_${id}_${i}`, { width: R * 1.1, height: 0.04, depth: 0.5 }, ctx.scene);
            // Inclinar (caída), alejar del tronco, girar alrededor del eje y subir a la copa.
            frond.rotation.z = -0.35;
            frond.bakeCurrentTransformIntoVertices();
            frond.position.x = R * 0.55;
            frond.bakeCurrentTransformIntoVertices();
            frond.rotation.y = (i * Math.PI * 2) / 8;
            frond.bakeCurrentTransformIntoVertices();
            frond.position.y = trunkH;
            frond.bakeCurrentTransformIntoVertices();
            fronds.push(frond);
        }
        const crown = Mesh.MergeMeshes(fronds, true, true);
        if (crown) add(crown, leaf);
        return;
    }

    // Frondoso: tronco + 3 masas de copa.
    const trunkH = H * 0.45;
    const trunk = MeshBuilder.CreateCylinder(`site_tree_trunk_${id}`, { diameterTop: 0.22, diameterBottom: 0.34, height: trunkH, tessellation: 8 }, ctx.scene);
    trunk.position.y = trunkH / 2;
    add(trunk, bark);
    const blobs: Array<[number, number, number, number]> = [
        [0, 0, 0, 1],
        [R * 0.45, R * 0.15, R * 0.2, 0.7],
        [-R * 0.4, R * 0.1, -R * 0.3, 0.75],
    ];
    const crowns: Mesh[] = [];
    blobs.forEach(([x, y, z, s], i) => {
        const blob = MeshBuilder.CreateSphere(`site_tree_crown_${id}_${i}`, { diameter: R * 2 * s, segments: 8 }, ctx.scene);
        blob.scaling.y = 0.8;
        blob.position.set(x, trunkH + (H - trunkH) * 0.45 + y, z);
        blob.bakeCurrentTransformIntoVertices();
        crowns.push(blob);
    });
    const merged = Mesh.MergeMeshes(crowns, true, true);
    if (merged) add(merged, leaf);
}

/** Color3 helper para el cielo/relleno de materiales texturizados. */
export function tintColor(hex: string): Color3 {
    return Color3.FromHexString(hex.length === 7 ? hex : '#ffffff');
}
