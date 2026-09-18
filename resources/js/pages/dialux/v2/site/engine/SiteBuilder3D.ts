import {
    Color3,
    Color4,
    DirectionalLight,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    PointLight,
    ShadowGenerator,
    StandardMaterial,
    TransformNode,
    Vector3,
    VertexBuffer,
    VertexData,
    type ArcRotateCamera,
    type Scene,
} from '@babylonjs/core';
import { House3DBuilder } from '@/pages/dialux/engine/House3DBuilder';
import type { Scene as EditorScene } from '@/pages/dialux/hooks/useEditorStore';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import {
    computeLuxGrid,
    DEFAULT_LUMINAIRE,
    luxColor,
    summarizeLux,
    type LightingSummary,
    type LuxGridSpec,
    type LuminaireSource,
} from '../domain/exteriorLighting';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import {
    boundingBox,
    closestPointOnPolygon,
    outwardMiterDirections,
    pointInPolygon,
} from '../domain/geometry';
import {
    buildSpiralRampPolyline,
    buildStraightRampLayout,
    stairAsRampConfig,
} from '../domain/rampLayout';
import { RAMP_NORM, stairStepCount } from '../domain/siteNorms';
import {
    hasTerrainData,
    sampleGroundElevation,
    terrainElevationPoints,
    type ElevationPoint,
} from '../domain/terrainSurface';
import type {
    FeederPath,
    FenceConfig,
    GateConfig,
    PoleConfig,
    Point2D,
    RampConfig,
    SiteData,
    SiteElement,
    StairConfig,
    TerracePlatformConfig,
    TgConfig,
    TransformerConfig,
} from '../domain/types';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';

/** Un portón sin cerco asignado se pega al cerco más cercano si está a esta distancia (m) o menos. */
const GATE_SNAP_M = 3;

/** Tipos que definen el terreno/niveles — nunca "se apoyan" en una plataforma. */
const NO_PLATFORM_REST = new Set<SiteElement['type']>([
    'terrain',
    'terrace_platform',
    'contour',
    'spot_elevation',
    'ramp',
    'stair',
]);

function gateCfg(el: SiteElement): GateConfig | undefined {
    return el.config?.kind === 'gate' ? el.config : undefined;
}
function fenceCfg(el: SiteElement): FenceConfig | undefined {
    return el.config?.kind === 'fence' ? el.config : undefined;
}
function poleCfg(el: SiteElement): PoleConfig | undefined {
    return el.config?.kind === 'pole' ? el.config : undefined;
}
function tgCfg(el: SiteElement): TgConfig | undefined {
    return el.config?.kind === 'tg' ? el.config : undefined;
}
function transformerCfg(el: SiteElement): TransformerConfig | undefined {
    return el.config?.kind === 'transformer' ? el.config : undefined;
}
function rampCfg(el: SiteElement): RampConfig | undefined {
    return el.config?.kind === 'ramp' ? el.config : undefined;
}
function stairCfg(el: SiteElement): StairConfig | undefined {
    return el.config?.kind === 'stair' ? el.config : undefined;
}
function terracePlatformCfg(
    el: SiteElement,
): TerracePlatformConfig | undefined {
    return el.config?.kind === 'terrace_platform' ? el.config : undefined;
}

export interface SiteModuleScene {
    moduleId: number;
    moduleName: string;
    data: Record<string, unknown> & { scenes: EditorScene[] };
}

function hexToColor3(hex: string): Color3 {
    return Color3.FromHexString(hex);
}

function centroid(vertices: Point2D[]): Point2D {
    const sum = vertices.reduce(
        (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
        { x: 0, y: 0 },
    );
    return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

/**
 * Motor 3D del emplazamiento (Fase 4.1). Construye un mesh por elemento del
 * plano. El canvas 2D del emplazamiento dibuja con Y hacia ABAJO (convención
 * de pantalla); el mundo 3D usa Z hacia el fondo. Para que la vista 3D en
 * planta se lea IGUAL que el canvas 2D hay que invertir la Y del plano al
 * mapearla a Z: `z = -y·escala` (mismo motivo que el exportador DXF, ver
 * memoria `dialux-dxf-conductors-must-be-arcs`). Antes no se invertía y el
 * emplazamiento salía espejado en 3D respecto del 2D.
 *
 * Cada elemento se ancla en su propio `TransformNode` centrado en su
 * centroide — la geometría del mesh se construye en espacio LOCAL a ese
 * nodo, no en coordenadas de mundo directas. Esto permite reposicionar un
 * elemento moviendo un solo nodo, y es lo que hace posible incrustar el
 * interior de un módulo hijo (Fase 4.1, "módulos hijos read-only") sin que
 * su propio sistema de coordenadas (arbitrario, propio de su editor) choque
 * con la posición real del bloque en el emplazamiento.
 */
export class SiteBuilder3D {
    scene: Scene;
    camera: ArcRotateCamera | null;
    shadowGen: ShadowGenerator | null = null;
    elementNodes: Map<string, TransformNode> = new Map();
    feederMeshes: Mesh[] = [];
    /** Un `House3DBuilder` propio por bloque de edificio con interior cargado — se dispone junto con el nodo del elemento. */
    childBuilders: Map<string, House3DBuilder> = new Map();
    private matCache: Map<string, StandardMaterial> = new Map();
    private terrainPoints: ElevationPoint[] = [];
    private terrainModeled = false;
    /**
     * Cota de referencia (m) que se resta a TODA la Y del mundo 3D. Con cotas
     * reales de proyecto (2518 m s.n.m. en Vinchos) sin restar nada, la escena
     * queda 2500 m sobre donde apunta la cámara → 3D en blanco. Restando el
     * mínimo, la escena vuelve al entorno del origen.
     */
    private elevationDatum = 0;
    /**
     * Origen X/Z (en metros de mundo) que se resta a toda posición horizontal.
     * Los planos georreferenciados están en UTM (~9.000.000) — a esa magnitud
     * la precisión float32 de WebGL colapsa y la escena no renderiza. Igual
     * que el recentrado de `House3DBuilder` para el editor de interiores.
     */
    private originX = 0;
    private originZ = 0;
    /** Elementos del emplazamiento por id — para que un objeto pueda referenciar a otro (ej. portón → cerco al que queda pegado). */
    private elementsById = new Map<string, SiteElement>();
    /** Plataformas de terreno — para que un objeto colocado encima se apoye en su superficie sin tener que teclear la cota. */
    private platforms: SiteElement[] = [];
    /** Metros por unidad de plano de la última `sync` — para medir distancias reales en helpers de suelo. */
    private scaleM = 1;
    /** Cerco al que queda pegado cada portón (id del portón → cerco): el vinculado a mano o, si no hay, el más cercano dentro de `GATE_SNAP_M`. */
    private gateFence = new Map<string, SiteElement>();
    // ── Alumbrado exterior / modo noche ──
    private ambient: HemisphericLight | null = null;
    private sun: DirectionalLight | null = null;
    private nightMode = false;
    private luxMapOn = false;
    private lampHeads: Array<{
        head: Mesh;
        pole: TransformNode;
        /** Flujo fijado a mano en el poste; ausente = el de la ficha del producto (o el genérico). */
        lumens: number | undefined;
        productId: number | undefined;
        beamDeg: number;
        maintenance: number;
    }> = [];
    /** Fotometría (matriz IES/LDT) de los productos usados por los postes; llega de forma asíncrona. */
    private photometry = new Map<number, LuminairePhotometry>();
    private lampMat: StandardMaterial | null = null;
    private luxMesh: Mesh | null = null;
    private nightLights: PointLight[] = [];
    private lightingSummary: LightingSummary | null = null;
    private luxSources: LuminaireSource[] = [];
    private luxSpec: LuxGridSpec | null = null;
    private luxValues: Float32Array | null = null;

    constructor(scene: Scene, camera?: ArcRotateCamera) {
        this.scene = scene;
        this.camera = camera ?? null;
    }

    setupLights() {
        const ambient = new HemisphericLight(
            'site_hemi',
            new Vector3(0, 1, 0),
            this.scene,
        );
        ambient.intensity = 0.6;
        ambient.diffuse = new Color3(0.95, 0.97, 1.0);
        ambient.groundColor = new Color3(0.3, 0.28, 0.22);

        const sun = new DirectionalLight(
            'site_sun',
            new Vector3(-0.5, -1.5, -0.8).normalize(),
            this.scene,
        );
        sun.intensity = 1.1;
        sun.diffuse = new Color3(1.0, 0.97, 0.9);
        sun.position = new Vector3(40, 60, 40);

        this.ambient = ambient;
        this.sun = sun;
        this.shadowGen = new ShadowGenerator(1024, sun);
        this.shadowGen.useBlurExponentialShadowMap = true;
        this.shadowGen.blurKernel = 16;

        return { ambient, sun };
    }

    private matFor(hex: string, alpha = 1, specular = 0.05): StandardMaterial {
        const key = `${hex}:${alpha}:${specular}`;
        const cached = this.matCache.get(key);
        if (cached) return cached;
        const mat = new StandardMaterial(`site_mat_${key}`, this.scene);
        mat.diffuseColor = hexToColor3(hex);
        mat.specularColor = new Color3(specular, specular, specular);
        mat.maxSimultaneousLights = 12; // por defecto 4: las luminarias del modo noche no se verían
        if (alpha < 1) {
            mat.alpha = alpha;
            mat.backFaceCulling = false;
        }
        this.matCache.set(key, mat);
        return mat;
    }

    /** Reconstruye todo el emplazamiento — dispone lo anterior primero (mismo patrón que `syncAllFloors`). */
    sync(
        siteData: SiteData,
        moduleScenes: SiteModuleScene[] = [],
        feederCalculations: EdgeCalculation[] = [],
        showInteriors = false,
        photometry: Map<number, LuminairePhotometry> = new Map(),
    ) {
        this.photometry = photometry;
        this.disposeContent();
        const scaleM = siteData.terrainScaleM || 1;
        this.scaleM = scaleM;
        this.elementsById = new Map(
            siteData.elements.map((element) => [element.id, element]),
        );
        this.gateFence = this.computeGateFences(siteData.elements);
        this.platforms = siteData.elements.filter(
            (element) =>
                element.type === 'terrace_platform' &&
                element.visible !== false &&
                element.vertices.length >= 3,
        );
        // Un tipo se oculta solo si una capa que lo contiene está oculta; un
        // tipo sin capa (proyectos previos a añadirlo) se muestra igual.
        const hiddenTypes = new Set(
            siteData.layers
                .filter((layer) => !layer.visible)
                .flatMap((layer) => layer.types),
        );
        // Puntos de cota del terreno (curvas de nivel + puntos acotados) → si
        // hay ≥3, el terreno se modela como superficie en vez de losa plana.
        this.terrainPoints = terrainElevationPoints(siteData.elements);
        this.terrainModeled = hasTerrainData(siteData.elements);
        // Datum = cota mínima de los datos (o de las cotas base de objetos si
        // no hay superficie). Todo lo demás se dibuja relativo a ella. Reduce
        // (no `Math.min(...)`): un levantamiento puede traer miles de puntos.
        // (ignora centinelas de campo tipo −99999 que se hayan colado)
        const sane = (z: number) => Number.isFinite(z) && Math.abs(z) < 9000;
        let minZ = Infinity;
        for (const p of this.terrainPoints) {
            if (sane(p.z) && p.z < minZ) minZ = p.z;
        }
        for (const e of siteData.elements) {
            if (
                typeof e.baseElevationM === 'number' &&
                sane(e.baseElevationM) &&
                e.baseElevationM < minZ
            ) {
                minZ = e.baseElevationM;
            }
        }
        this.elevationDatum = Number.isFinite(minZ) ? minZ : 0;

        // Origen X/Z = centro de la caja de toda la geometría (en metros).
        const allV = siteData.elements.flatMap((e) => e.vertices);
        if (allV.length > 0) {
            const b = boundingBox(allV);
            this.originX = ((b.minX + b.maxX) / 2) * scaleM;
            this.originZ = -((b.minY + b.maxY) / 2) * scaleM;
        } else {
            this.originX = 0;
            this.originZ = 0;
        }

        for (const element of siteData.elements) {
            if (element.visible === false) continue;
            if (hiddenTypes.has(element.type)) continue;
            const minVerts = element.type === 'contour' ? 2 : 3;
            if (element.vertices.length < minVerts) continue;
            try {
                this.buildElement(element, scaleM, moduleScenes, showInteriors);
            } catch (error) {
                console.warn(
                    `No se pudo construir el elemento de emplazamiento ${element.id} (${element.type})`,
                    error,
                );
            }
        }

        for (const path of siteData.feederPaths) {
            try {
                this.buildFeeder(path, scaleM, feederCalculations);
            } catch (error) {
                console.warn(
                    `No se pudo construir el trazado del alimentador ${path.id}`,
                    error,
                );
            }
        }

        this.frameCamera(siteData, scaleM);
        this.finalizeLighting(siteData);

        const t = this.camera
            ? this.camera.target.asArray().map((n) => Math.round(n))
            : [];
        console.log(
            `[site3D] elems=${siteData.elements.length} nodos=${this.elementNodes.size} ` +
                `terrain=${this.terrainModeled}(${this.terrainPoints.length}pts) ` +
                `datum=${this.elevationDatum.toFixed(1)} origin=(${Math.round(this.originX)},${Math.round(this.originZ)}) ` +
                `camTarget=(${t.join(',')}) camRadius=${this.camera ? Math.round(this.camera.radius) : '?'} ` +
                `scaleM=${scaleM}`,
        );
    }

    private buildElement(
        element: SiteElement,
        scaleM: number,
        moduleScenes: SiteModuleScene[],
        showInteriors: boolean,
    ) {
        switch (element.type) {
            case 'terrain':
                if (this.terrainModeled) {
                    this.buildTerrainSurface(element, scaleM);
                } else {
                    this.buildFlatSlab(element, scaleM, 0.3, 0);
                }
                return;
            case 'contour':
                this.buildContourLine(element, scaleM);
                return;
            case 'spot_elevation':
                // Con un levantamiento grande no se dibuja un mástil por punto
                // (cientos de meshes) — los puntos ya definen la superficie.
                if (this.terrainPoints.length <= 150) {
                    this.buildSpotMarker(element, scaleM);
                }
                return;
            case 'terrace_platform':
                this.buildTerracePlatform(element, scaleM);
                return;
            case 'street':
            case 'green_area':
            case 'parking':
            case 'court':
                this.buildFlatSlab(element, scaleM, 0.06, 0.02);
                return;
            case 'ramp':
                this.buildRamp(element, scaleM);
                return;
            case 'stair':
                this.buildStair(element, scaleM);
                return;
            case 'custom_zone':
                this.buildFlatSlab(element, scaleM, 0.04, 0.03, 0.5);
                return;
            case 'pool':
                this.buildPool(element, scaleM);
                return;
            case 'building_block':
                this.buildBuildingBlock(
                    element,
                    scaleM,
                    moduleScenes,
                    showInteriors,
                );
                return;
            case 'fence':
                this.buildFence(element, scaleM);
                return;
            case 'tg_location':
                this.buildCabinet(element, scaleM);
                return;
            case 'transformer':
                this.buildTransformer(element, scaleM);
                return;
            case 'pole':
                this.buildPole(element, scaleM);
                return;
            case 'gate':
                this.buildGate(element, scaleM);
                return;
        }
    }

    /** Altura del terreno natural en un punto, RELATIVA al datum (0 si no hay superficie). */
    private groundAt(center: Point2D): number {
        return this.terrainModeled
            ? sampleGroundElevation(this.terrainPoints, center.x, center.y) -
                  this.elevationDatum
            : 0;
    }

    private computeGateFences(elements: SiteElement[]): Map<string, SiteElement> {
        const result = new Map<string, SiteElement>();
        const fences = elements.filter(
            (el) =>
                el.type === 'fence' &&
                el.visible !== false &&
                el.vertices.length >= 2,
        );
        for (const gate of elements) {
            if (gate.type !== 'gate' || gate.visible === false) continue;
            const linkId = gateCfg(gate)?.fenceId;
            if (linkId === 'none') continue;
            const explicit = linkId
                ? fences.find((f) => f.id === linkId)
                : undefined;
            if (explicit) {
                result.set(gate.id, explicit);
                continue;
            }
            const c = centroid(gate.vertices);
            let best: SiteElement | undefined;
            let bestDist = GATE_SNAP_M;
            for (const fence of fences) {
                const hit = closestPointOnPolygon(
                    c,
                    fence.vertices,
                    fenceCfg(fence)?.closed ?? true,
                );
                if (!hit) continue;
                const d = hit.distance * this.scaleM;
                if (d <= bestDist) {
                    bestDist = d;
                    best = fence;
                }
            }
            if (best) result.set(gate.id, best);
        }
        return result;
    }

    /** Cota absoluta del suelo bajo un punto: la plataforma más alta que lo contiene; si no hay, terreno modelado o el datum. */
    private groundTopAbs(point: Point2D): number {
        // Suelo continuo: encima de una plataforma, su cota; fuera de ella,
        // el talud que baja desde su borde con su ángulo (misma pendiente
        // que dibuja `buildTerracePlatform`), nunca por debajo del terreno
        // natural / datum. Así un cerco sobre el talud SUBE o BAJA con él en
        // vez de saltar de la cota de la plataforma al datum.
        let h = this.terrainModeled
            ? sampleGroundElevation(this.terrainPoints, point.x, point.y)
            : this.elevationDatum;
        for (const platform of this.platforms) {
            const top = platform.baseElevationM ?? 0;
            if (top <= h) continue;
            if (pointInPolygon(point, platform.vertices)) {
                h = top;
                continue;
            }
            const near = closestPointOnPolygon(point, platform.vertices);
            if (!near) continue;
            const angle = Math.min(
                89,
                Math.max(
                    1,
                    terracePlatformCfg(platform)?.taludAngleDeg ?? 75,
                ),
            );
            const talud =
                top -
                near.distance * this.scaleM * Math.tan((angle * Math.PI) / 180);
            if (talud > h) h = talud;
        }
        return h;
    }

    /** Aberturas de portones vinculados a un cerco: por lado, tramo [desde, hasta] en metros a saltar. */
    private fenceOpenings(
        fence: SiteElement,
        closed: boolean,
    ): Map<number, Array<[number, number]>> {
        const openings = new Map<number, Array<[number, number]>>();
        for (const el of this.elementsById.values()) {
            if (el.type !== 'gate' || el.visible === false) continue;
            const g = gateCfg(el);
            if (this.gateFence.get(el.id)?.id !== fence.id) continue;
            const near = closestPointOnPolygon(
                centroid(el.vertices),
                fence.vertices,
                closed,
            );
            if (!near) continue;
            const a = fence.vertices[near.edgeIndex];
            const b = fence.vertices[(near.edgeIndex + 1) % fence.vertices.length];
            const edgeM = Math.hypot(b.x - a.x, b.y - a.y) * this.scaleM;
            const half = Math.max(0.5, g?.widthM || 4) / 2;
            const center = near.t * edgeM;
            const list = openings.get(near.edgeIndex) ?? [];
            list.push([Math.max(0, center - half), Math.min(edgeM, center + half)]);
            openings.set(near.edgeIndex, list);
        }
        return openings;
    }

    /**
     * Cerco/muro que SIGUE el trazado y se adapta al suelo (plataformas,
     * terreno). Antes se extruía el polígono entero como un bloque de altura
     * fija apoyado en la cota de UN solo punto (el centroide) — sobre
     * plataformas a distintas cotas quedaba al aire en unas y enterrado en
     * otras. Ahora se parte en paneles (`panelLengthM`) y cada uno toma su
     * cota del suelo bajo él:
     *  - 'stepped': panel horizontal; su base baja hasta el punto más bajo
     *    del suelo bajo el panel (hace de muro de contención) y su corona
     *    sube hasta el más alto + altura del cerco → escalones entre paneles.
     *  - 'sloped': cada panel sigue la pendiente entre sus extremos.
     *  - 'flat': comportamiento previo (bloque a cota fija).
     * La cota base propia del elemento solo se usa en 'flat' (en los otros
     * modos el suelo ya define dónde apoya).
     */
    private buildFence(element: SiteElement, scaleM: number) {
        const cfg = fenceCfg(element);
        const conform = cfg?.conform ?? 'stepped';
        if (conform === 'flat') {
            this.buildExtrudedMass(element, scaleM, element.heightM ?? 3);
            return;
        }
        const { node, center } = this.anchorNode(element, scaleM);
        node.position.y = 0;
        // El suelo se muestrea con los vértices tal cual: un giro del nodo
        // desalinearía la cota respecto del lugar real.
        node.rotation.y = 0;
        const height = element.heightM ?? 3;
        const thickness = Math.max(0.05, cfg?.thicknessM ?? 0.2);
        const panelLen = Math.max(0.5, cfg?.panelLengthM ?? 2.5);
        const grille = cfg?.fenceKind === 'grille';
        const closed = cfg?.closed ?? true;
        const verts = element.vertices;
        const edges = closed ? verts.length : verts.length - 1;
        const wallMat = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        const glassMat = this.matFor(element.style.strokeColor, 0.35, 0.1);
        const local = (p: Point2D) => ({
            x: (p.x - center.x) * scaleM,
            z: -(p.y - center.y) * scaleM,
        });

        // Todos los paneles de un mismo material se fusionan en UN mesh al
        // final (un cerco de 400 m pasaba de ~160-320 meshes con su sombra
        // a 1-2).
        const byMaterial = new Map<StandardMaterial, Mesh[]>();

        // Caja de un panel orientada de A a B; `shear` inclina las caras (metros de subida A→B).
        const addBox = (
            name: string,
            a: Point2D,
            b: Point2D,
            width: number,
            boxHeight: number,
            centerY: number,
            shear: number,
            mat: StandardMaterial,
        ) => {
            const la = local(a);
            const lb = local(b);
            const length = Math.max(
                0.05,
                Math.hypot(lb.x - la.x, lb.z - la.z),
            );
            const mesh = MeshBuilder.CreateBox(
                name,
                { width, height: boxHeight, depth: length },
                this.scene,
            );
            if (shear !== 0) {
                const positions = mesh.getVerticesData(
                    VertexBuffer.PositionKind,
                );
                const indices = mesh.getIndices();
                if (positions && indices) {
                    const slope = shear / length;
                    for (let i = 0; i < positions.length; i += 3) {
                        positions[i + 1] += slope * positions[i + 2];
                    }
                    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
                    const normals: number[] = [];
                    VertexData.ComputeNormals(positions, indices, normals);
                    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
                }
            }
            // Posición + lookAt sin padre (local == mundo, mismo orden que
            // `buildPole`/`buildFlightRamp`); al fusionar, esas coordenadas
            // (locales al nodo del cerco) quedan horneadas en el mesh final,
            // que sí se cuelga del nodo.
            mesh.position.set(
                (la.x + lb.x) / 2,
                this.rel(centerY),
                (la.z + lb.z) / 2,
            );
            mesh.lookAt(new Vector3(lb.x, this.rel(centerY), lb.z));
            mesh.material = mat;
            const list = byMaterial.get(mat) ?? [];
            list.push(mesh);
            byMaterial.set(mat, list);
        };

        /** Cota del suelo en 5 puntos de un tramo (extremos + 3 intermedios): detecta escalones que caen entre muestras. */
        const sampleGround = (a: Point2D, b: Point2D): number[] =>
            [0, 0.25, 0.5, 0.75, 1].map((t) =>
                this.groundTopAbs({
                    x: a.x + (b.x - a.x) * t,
                    y: a.y + (b.y - a.y) * t,
                }),
            );

        const STEP_TOL_M = 0.35;
        const MIN_PANEL_M = 0.3;
        let panelIndex = 0;

        /** Panel de `u0` a `u1` metros sobre el lado `v0→v1`; se parte en dos si el suelo cambia demasiado dentro de él (sigue el escalón/talud en vez de hacer un bloque alto). */
        const emitPanel = (
            v0: Point2D,
            v1: Point2D,
            edgeM: number,
            u0: number,
            u1: number,
        ) => {
            const t0 = u0 / edgeM;
            const t1 = u1 / edgeM;
            const a = {
                x: v0.x + (v1.x - v0.x) * t0,
                y: v0.y + (v1.y - v0.y) * t0,
            };
            const b = {
                x: v0.x + (v1.x - v0.x) * t1,
                y: v0.y + (v1.y - v0.y) * t1,
            };
            const g = sampleGround(a, b);
            const hi = Math.max(...g);
            const lo = Math.min(...g);
            // Desviación respecto de una recta A→B (para 'sloped').
            const deviation = Math.max(
                ...g.map((z, k) => Math.abs(z - (g[0] + (g[4] - g[0]) * (k / 4)))),
            );
            const needsSplit =
                (conform === 'stepped' ? hi - lo : deviation) > STEP_TOL_M;
            if (needsSplit && u1 - u0 > MIN_PANEL_M * 2) {
                const mid = (u0 + u1) / 2;
                emitPanel(v0, v1, edgeM, u0, mid);
                emitPanel(v0, v1, edgeM, mid, u1);
                return;
            }
            const id = `${element.id}_${panelIndex++}`;
            if (conform === 'sloped') {
                addBox(
                    `site_fence_${id}`,
                    a,
                    b,
                    thickness,
                    height,
                    (g[0] + g[4]) / 2 + height / 2,
                    g[4] - g[0],
                    wallMat,
                );
                return;
            }
            if (!grille) {
                const h = hi + height - lo;
                addBox(
                    `site_fence_${id}`,
                    a,
                    b,
                    thickness,
                    h,
                    lo + h / 2,
                    0,
                    wallMat,
                );
                return;
            }
            // Reja: zócalo sólido (contención si hay desnivel; mín. 0.4 m) + paño translúcido.
            const plinth = hi - lo + 0.4;
            addBox(
                `site_fence_base_${id}`,
                a,
                b,
                thickness,
                plinth,
                lo + plinth / 2,
                0,
                wallMat,
            );
            const panelH = Math.max(0.2, height - 0.4);
            addBox(
                `site_fence_panel_${id}`,
                a,
                b,
                thickness * 0.4,
                panelH,
                hi + 0.4 + panelH / 2,
                0,
                glassMat,
            );
        };

        const openings = this.fenceOpenings(element, closed);
        for (let e = 0; e < edges; e++) {
            const v0 = verts[e];
            const v1 = verts[(e + 1) % verts.length];
            const edgeM = Math.hypot(v1.x - v0.x, v1.y - v0.y) * scaleM;
            if (edgeM < 1e-6) continue;
            // Tramos del lado que SÍ llevan cerco: el lado menos las
            // aberturas de sus portones (el ingreso queda libre).
            const gaps = [...(openings.get(e) ?? [])].sort(
                (p, q) => p[0] - q[0],
            );
            const runs: Array<[number, number]> = [];
            let cursor = 0;
            for (const [g0, g1] of gaps) {
                if (g0 > cursor) runs.push([cursor, g0]);
                cursor = Math.max(cursor, g1);
            }
            if (cursor < edgeM) runs.push([cursor, edgeM]);
            for (const [u0, u1] of runs) {
                if (u1 - u0 < 0.05) continue;
                const n = Math.max(1, Math.ceil((u1 - u0) / panelLen));
                for (let i = 0; i < n; i++) {
                    emitPanel(
                        v0,
                        v1,
                        edgeM,
                        u0 + ((u1 - u0) * i) / n,
                        u0 + ((u1 - u0) * (i + 1)) / n,
                    );
                }
            }
        }

        byMaterial.forEach((meshes, mat) => {
            const merged = Mesh.MergeMeshes(meshes, true, true);
            if (!merged) return;
            merged.name = `site_fence_${element.id}`;
            merged.material = mat;
            merged.receiveShadows = true;
            merged.parent = node;
            this.shadowGen?.addShadowCaster(merged);
        });
    }

    /** Cota absoluta de la plataforma más alta que contiene el punto (undefined si ninguna). */
    private platformTopAt(point: Point2D): number | undefined {
        let top: number | undefined;
        for (const platform of this.platforms) {
            if (!pointInPolygon(point, platform.vertices)) continue;
            const z = platform.baseElevationM ?? 0;
            if (top === undefined || z > top) top = z;
        }
        return top;
    }

    /** Cota absoluta (m) → altura relativa al datum del mundo 3D. */
    private rel(elevationM: number): number {
        return elevationM - this.elevationDatum;
    }

    /** X de plano → X de mundo 3D (recentrado). */
    private wx(planX: number, scaleM: number): number {
        return planX * scaleM - this.originX;
    }
    /** Y de plano (hacia abajo) → Z de mundo 3D (recentrado, eje invertido). */
    private wz(planY: number, scaleM: number): number {
        return -planY * scaleM - this.originZ;
    }

    /** TransformNode anclado al centroide del elemento — punto de referencia común para todas las variantes de construcción. */
    private anchorNode(
        element: SiteElement,
        scaleM: number,
    ): {
        node: TransformNode;
        localVertices: Vector3[];
        center: Point2D;
    } {
        const center = centroid(element.vertices);
        const node = new TransformNode(`site_${element.id}`, this.scene);
        // Y = cota del terreno natural bajo el centroide + `baseElevationM`
        // (offset en metros reales: 0 = apoyado en el suelo; +7 = plataforma
        // de aulas; −1 = estacionamiento hundido).
        // Sin cota propia (0/ausente) y con el centro sobre una plataforma:
        // se apoya en la superficie de ESA plataforma (construir sobre ella).
        // Con cota propia distinta de 0 no se toca — respeta lo ya dibujado.
        const platformTop =
            !element.baseElevationM && !NO_PLATFORM_REST.has(element.type)
                ? this.platformTopAt(center)
                : undefined;
        node.position.set(
            this.wx(center.x, scaleM),
            platformTop !== undefined
                ? this.rel(platformTop)
                : this.groundAt(center) + (element.baseElevationM ?? 0),
            this.wz(center.y, scaleM),
        );
        // `rotation` en grados horarios sobre pantalla. Como el plano se
        // mapea con Z invertida (`z = -y`), el giro equivalente en el mundo 3D
        // es el negado para que se lea igual desde la vista en planta.
        const rotRad = (-(element.rotation ?? 0) * Math.PI) / 180;
        node.rotation.y = rotRad;
        this.elementNodes.set(element.id, node);
        const localVertices = element.vertices.map(
            (v) =>
                new Vector3(
                    (v.x - center.x) * scaleM,
                    0,
                    -(v.y - center.y) * scaleM,
                ),
        );
        return { node, localVertices, center };
    }

    /** Losa plana (terreno, calles, áreas verdes, etc.) — extruida hacia abajo desde `topY`. */
    private buildFlatSlab(
        element: SiteElement,
        scaleM: number,
        depth: number,
        topY: number,
        alpha = 1,
    ) {
        const { node, localVertices } = this.anchorNode(element, scaleM);
        const slab = MeshBuilder.CreatePolygon(
            `site_slab_${element.id}`,
            { shape: localVertices, depth, sideOrientation: Mesh.DOUBLESIDE },
            this.scene,
        );
        slab.position.y = topY + depth;
        slab.material = this.matFor(
            element.style.fillColor,
            alpha * (element.style.opacity ?? 1),
        );
        slab.receiveShadows = true;
        slab.parent = node;
    }

    /** Masa extruida hacia arriba desde el suelo (cercos, portones, bloques sin interior cargado). */
    private buildExtrudedMass(
        element: SiteElement,
        scaleM: number,
        heightM: number,
    ): TransformNode {
        const { node, localVertices } = this.anchorNode(element, scaleM);
        const mass = MeshBuilder.CreatePolygon(
            `site_mass_${element.id}`,
            {
                shape: localVertices,
                depth: heightM,
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        mass.position.y = heightM;
        mass.material = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        mass.receiveShadows = true;
        mass.checkCollisions = false;
        this.shadowGen?.addShadowCaster(mass);
        mass.parent = node;
        return node;
    }

    /** Terreno como SUPERFICIE: grilla sobre la caja del lote, cota por IDW. */
    private buildTerrainSurface(element: SiteElement, scaleM: number) {
        const node = new TransformNode(`site_${element.id}`, this.scene);
        this.elementNodes.set(element.id, node);
        const b = boundingBox(element.vertices);
        const N = 36;
        const paths: Vector3[][] = [];
        for (let iy = 0; iy <= N; iy++) {
            const wy = b.minY + ((b.maxY - b.minY) * iy) / N;
            const row: Vector3[] = [];
            for (let ix = 0; ix <= N; ix++) {
                const px = b.minX + ((b.maxX - b.minX) * ix) / N;
                const z =
                    sampleGroundElevation(this.terrainPoints, px, wy) -
                    this.elevationDatum;
                row.push(
                    new Vector3(this.wx(px, scaleM), z, this.wz(wy, scaleM)),
                );
            }
            paths.push(row);
        }
        const surface = MeshBuilder.CreateRibbon(
            `site_terrain_${element.id}`,
            { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE },
            this.scene,
        );
        surface.material = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        surface.receiveShadows = true;
        surface.parent = node;
    }

    /** Curva de nivel: polilínea a su cota real. */
    private buildContourLine(element: SiteElement, scaleM: number) {
        const node = new TransformNode(`site_${element.id}`, this.scene);
        this.elementNodes.set(element.id, node);
        const z = this.rel(element.baseElevationM ?? 0);
        const pts = element.vertices.map(
            (v) =>
                new Vector3(
                    this.wx(v.x, scaleM),
                    z + 0.05,
                    this.wz(v.y, scaleM),
                ),
        );
        if (pts.length < 2) return;
        const line = MeshBuilder.CreateTube(
            `site_contour_${element.id}`,
            { path: pts, radius: 0.1, sideOrientation: Mesh.DOUBLESIDE },
            this.scene,
        );
        line.material = this.matFor(element.style.strokeColor, 1, 0.1);
        line.parent = node;
    }

    /**
     * Plataforma de terreno a cota absoluta — "opción 2" para lotes no
     * planos: en vez de digitalizar curvas de nivel, cada nivel de la ladera
     * se dibuja como un polígono plano a su propia cota (`baseElevationM`,
     * igual que una curva de nivel: valor absoluto, no offset), y el talud
     * que lo une con el terreno se genera solo con el ángulo configurado
     * (`taludAngleDeg`, 75° por defecto). El borde de cada vértice se
     * desplaza en línea recta desde el centroide (aproximación válida para
     * huellas convexas/típicas de plataforma — evita depender del sentido de
     * giro con el que el usuario haya dibujado el polígono) hasta la cota
     * del terreno natural bajo ese punto (o hasta el datum si aún no hay
     * topografía modelada con curvas/puntos).
     */
    private buildTerracePlatform(element: SiteElement, scaleM: number) {
        const { node, localVertices, center } = this.anchorNode(
            element,
            scaleM,
        );
        const platformYAbs = element.baseElevationM ?? 0;
        // Cota absoluta, no relativa al terreno bajo el centroide.
        node.position.y = this.rel(platformYAbs);

        if (element.vertices.length < 3) return;
        const cfg = terracePlatformCfg(element);
        const angleDeg = Math.min(89, Math.max(1, cfg?.taludAngleDeg ?? 75));
        const tanAngle = Math.tan((angleDeg * Math.PI) / 180);

        // Otras plataformas del emplazamiento — si un vértice de ESTA cae
        // sobre el borde de una plataforma VECINA (el caso normal: se
        // dibujan una junto a otra, compartiendo el borde), el talud baja
        // hasta la cota de esa vecina en vez de hasta el terreno natural o el
        // datum global. Sin esto, una plataforma alta con vecinas a cotas
        // intermedias hundía su talud muy por debajo de donde debía apoyarse
        // — el "hueco"/salto visible entre plataformas que reportó el
        // usuario (2026-09-17). No requiere que el usuario vuelva a dibujar
        // nada: se recalcula solo a partir de los polígonos ya existentes.
        const neighborPlatforms = [...this.elementsById.values()].filter(
            (el) => el.type === 'terrace_platform' && el.id !== element.id,
        );
        const groundAbsAt = (v: Point2D): number => {
            const neighbor = neighborPlatforms.find((other) =>
                pointInPolygon(v, other.vertices),
            );
            if (neighbor) return neighbor.baseElevationM ?? 0;
            return this.terrainModeled
                ? sampleGroundElevation(this.terrainPoints, v.x, v.y)
                : this.elevationDatum;
        };

        // Dirección "hacia afuera" de CADA vértice, respetando sus dos lados
        // vecinos (funciona con huellas cóncavas — una en L, con un patio,
        // con un retranqueo). Reemplaza un desplazamiento radial desde el
        // centroide: en una huella cóncava ese método podía mover un vértice
        // hacia el lado equivocado y cruzar el resto del polígono, dejando
        // una malla que se autointerseca (el "hueco"/tajo oscuro que reportó
        // el usuario, 2026-09-17).
        const outwardDirs = outwardMiterDirections(element.vertices);

        const bottomRing = element.vertices.map((v, i) => {
            const groundAbs = groundAbsAt(v);
            const dh = platformYAbs - groundAbs;
            const spread = Math.abs(dh) / tanAngle;
            const dir = outwardDirs[i];
            const bx = v.x + dir.x * spread;
            const by = v.y + dir.y * spread;
            return new Vector3(
                (bx - center.x) * scaleM,
                groundAbs - platformYAbs,
                -(by - center.y) * scaleM,
            );
        });
        // Relleno SÓLIDO: la tapa se extruye hacia abajo hasta la cota más
        // baja de su talud (antes era una losa de 15 cm sobre una cáscara
        // vacía — se veía hueca). Siempre opaca: una plataforma es terreno
        // sobre el que se construye, no un plano translúcido (las ya
        // dibujadas con opacidad 70 % guardada también salen sólidas en 3D).
        let lowestY = 0;
        for (const p of bottomRing) if (p.y < lowestY) lowestY = p.y;
        const cap = MeshBuilder.CreatePolygon(
            `site_terrace_cap_${element.id}`,
            {
                shape: localVertices,
                depth: Math.max(0.15, -lowestY),
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        cap.material = this.matFor(element.style.fillColor, 1);
        cap.receiveShadows = true;
        cap.parent = node;

        const topRing = [...localVertices, localVertices[0]];
        bottomRing.push(bottomRing[0]);

        const skirt = MeshBuilder.CreateRibbon(
            `site_terrace_skirt_${element.id}`,
            {
                pathArray: [topRing, bottomRing],
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        skirt.material = this.matFor('#a89270', 1, 0.05);
        skirt.receiveShadows = true;
        skirt.parent = node;
    }

    /** Punto acotado: varilla vertical hasta su cota (desde el 0 de referencia). */
    private buildSpotMarker(element: SiteElement, scaleM: number) {
        const c = centroid(element.vertices);
        const node = new TransformNode(`site_${element.id}`, this.scene);
        node.position.set(this.wx(c.x, scaleM), 0, this.wz(c.y, scaleM));
        this.elementNodes.set(element.id, node);
        const z = this.rel(element.baseElevationM ?? 0);
        const rod = MeshBuilder.CreateCylinder(
            `site_spot_${element.id}`,
            { diameter: 0.12, height: Math.max(0.3, Math.abs(z) + 0.3) },
            this.scene,
        );
        rod.position.y = z / 2;
        rod.material = this.matFor(element.style.strokeColor, 1, 0.2);
        rod.parent = node;
        const knob = MeshBuilder.CreateSphere(
            `site_spot_knob_${element.id}`,
            { diameter: 0.28 },
            this.scene,
        );
        knob.position.y = z;
        knob.material = this.matFor(element.style.fillColor, 1, 0.1);
        knob.parent = node;
    }

    /** Eje largo de la huella y su longitud en metros — para rampas/escaleras. */
    private longAxis(element: SiteElement, scaleM: number) {
        const b = boundingBox(element.vertices);
        const w = (b.maxX - b.minX) * scaleM;
        const d = (b.maxY - b.minY) * scaleM;
        const alongX = w >= d;
        return {
            alongX,
            run: (alongX ? w : d) || 1,
            crossM: (alongX ? d : w) || 1,
        };
    }

    /** Rampa: un solo tramo recto (clásico), varios tramos con giros, o helicoidal — según `RampConfig.shape`/`flights`. */
    private buildRamp(element: SiteElement, scaleM: number) {
        const c = rampCfg(element);
        if (c?.shape === 'spiral') {
            this.buildSpiralRamp(element, scaleM, c);
            return;
        }
        if (c?.flights && c.flights.length > 0) {
            this.buildFlightRamp(element, scaleM, c);
            return;
        }
        this.buildSingleRampSlab(element, scaleM, c);
    }

    /** Comportamiento clásico: una losa inclinada sobre el polígono dibujado, de `fromElevationM` a `toElevationM`. */
    private buildSingleRampSlab(
        element: SiteElement,
        scaleM: number,
        c: RampConfig | undefined,
    ) {
        const { node, localVertices } = this.anchorNode(element, scaleM);
        node.position.y = 0; // rampa/escalera usan cotas absolutas en su config
        const from = c
            ? this.rel(c.fromElevationM)
            : this.groundAt(centroid(element.vertices));
        const to = c ? this.rel(c.toElevationM) : from + 1;
        const { alongX, run } = this.longAxis(element, scaleM);
        const angle = Math.atan2(to - from, run);
        const slab = MeshBuilder.CreatePolygon(
            `site_ramp_${element.id}`,
            {
                shape: localVertices,
                depth: 0.15,
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        slab.position.y = (from + to) / 2 + 0.08;
        slab.rotation[alongX ? 'z' : 'x'] = alongX ? -angle : angle;
        slab.material = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        slab.receiveShadows = true;
        slab.parent = node;
    }

    /** Rampa de varios tramos rectos con giros (zigzag) — conecta varias cotas en un solo elemento. */
    private buildFlightRamp(
        element: SiteElement,
        scaleM: number,
        c: RampConfig,
        /** Si viene, los tramos se dibujan con peldaños de esta contrahuella en vez de losa inclinada (escalera). */
        stepped?: { riserM: number },
    ) {
        const node = new TransformNode(`site_${element.id}`, this.scene);
        this.elementNodes.set(element.id, node);
        const center = centroid(element.vertices);
        node.position.set(
            this.wx(center.x, scaleM),
            this.rel(c.fromElevationM),
            this.wz(center.y, scaleM),
        );
        node.rotation.y = (-(element.rotation ?? 0) * Math.PI) / 180;

        const mat = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        const segments = buildStraightRampLayout(c);
        const fillMat = this.matFor('#a8a29e', 1, 0.05);
        const curbMat = this.matFor('#78716c', 1, 0.05);
        const railMat = this.matFor('#6b7280', 1, 0.3);
        const panelMat = this.matFor('#94a3b8', 0.3, 0.1);
        // Base del relleno: el nivel más bajo que conecta la rampa (menos 0.3 m de empotre).
        const baseLocalY =
            Math.min(c.fromElevationM, c.toElevationM) - 0.3 - c.fromElevationM;
        const railH = RAMP_NORM.handrailHeightM;
        const CURB_H = 0.3; // borde resistente (A.120, figura 3)

        /** Caja entre dos puntos 3D (posición + lookAt sin padre → local == mundo; luego se cuelga del nodo). */
        const boxBetween = (
            name: string,
            p0: { x: number; y: number; z: number },
            p1: { x: number; y: number; z: number },
            width: number,
            height: number,
            mat: StandardMaterial,
            parent: TransformNode,
        ) => {
            const len = Math.max(
                0.05,
                Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z),
            );
            const mesh = MeshBuilder.CreateBox(
                name,
                { width, height, depth: len },
                this.scene,
            );
            mesh.position.set(
                (p0.x + p1.x) / 2,
                (p0.y + p1.y) / 2,
                (p0.z + p1.z) / 2,
            );
            mesh.lookAt(new Vector3(p1.x, p1.y, p1.z));
            mesh.material = mat;
            mesh.parent = parent;
            return mesh;
        };

        segments.forEach((seg) => {
            const dx = seg.endLocal.x - seg.startLocal.x;
            const dz = seg.endLocal.z - seg.startLocal.z;
            const length = Math.max(0.1, Math.hypot(dx, dz));
            const midX = (seg.startLocal.x + seg.endLocal.x) / 2;
            const midY = (seg.startY + seg.endY) / 2;
            const midZ = (seg.startLocal.z + seg.endLocal.z) / 2;
            const ux = dx / length;
            const uz = dz / length;
            const px = -uz; // perpendicular en planta
            const pz = ux;
            const half = seg.widthM / 2;

            if (stepped && seg.kind === 'flight') {
                // Peldaños macizos hasta el nivel inferior (escalera cerrada, sin huecos).
                const rise = seg.endY - seg.startY;
                const n = Math.max(1, Math.round(Math.abs(rise) / stepped.riserM));
                const tread = length / n;
                for (let k = 0; k < n; k++) {
                    const top = seg.startY + (rise / n) * (k + 1);
                    const h = Math.max(0.05, top - baseLocalY);
                    const step = MeshBuilder.CreateBox(
                        `site_stair_${element.id}_${seg.id}_${k}`,
                        { width: seg.widthM, height: h, depth: tread },
                        this.scene,
                    );
                    const along = -length / 2 + tread * (k + 0.5);
                    step.position.set(
                        midX + ux * along,
                        baseLocalY + h / 2,
                        midZ + uz * along,
                    );
                    step.lookAt(
                        new Vector3(
                            step.position.x + ux,
                            step.position.y,
                            step.position.z + uz,
                        ),
                    );
                    step.material = mat;
                    step.receiveShadows = true;
                    step.parent = node;
                }
            } else {
            // Losa (cara de rodadura), inclinada según el tramo.
            const slab = MeshBuilder.CreateBox(
                `site_ramp_${element.id}_${seg.id}`,
                { width: seg.widthM, height: 0.15, depth: length },
                this.scene,
            );
            slab.position.set(midX, midY, midZ);
            slab.lookAt(new Vector3(seg.endLocal.x, seg.endY, seg.endLocal.z));
            slab.material = mat;
            slab.receiveShadows = true;
            slab.parent = node;
            this.shadowGen?.addShadowCaster(slab);

            // Relleno sólido bajo la losa, hasta el nivel inferior (cuña: la
            // cara de abajo es plana, la de arriba sigue la pendiente) — antes
            // los tramos quedaban en el aire, como triángulos flotantes.
            const topStart = seg.startY - 0.075;
            const topEnd = seg.endY - 0.075;
            const fill = MeshBuilder.CreateBox(
                `site_ramp_fill_${element.id}_${seg.id}`,
                { width: seg.widthM, height: 1, depth: length },
                this.scene,
            );
            const positions = fill.getVerticesData(VertexBuffer.PositionKind);
            const indices = fill.getIndices();
            if (positions && indices) {
                for (let i = 0; i < positions.length; i += 3) {
                    const t = (positions[i + 2] + length / 2) / length;
                    positions[i + 1] =
                        positions[i + 1] > 0
                            ? Math.max(
                                  baseLocalY + 0.05,
                                  topStart + (topEnd - topStart) * t,
                              )
                            : baseLocalY;
                }
                fill.setVerticesData(VertexBuffer.PositionKind, positions);
                const normals: number[] = [];
                VertexData.ComputeNormals(positions, indices, normals);
                fill.setVerticesData(VertexBuffer.NormalKind, normals);
            }
            fill.position.set(midX, 0, midZ);
            fill.lookAt(new Vector3(seg.endLocal.x, 0, seg.endLocal.z));
            fill.material = fillMat;
            fill.receiveShadows = true;
            fill.parent = node;

            }

            // Bordes laterales: bordillo de 0.30 m + baranda (pasamanos +
            // paño) a cada lado, siguiendo la pendiente.
            for (const side of [-1, 1]) {
                // Descanso de esquina: por ese lado sale el tramo siguiente.
                if (
                    seg.kind === 'landing' &&
                    seg.role === 'corner' &&
                    side === seg.openSide
                ) {
                    continue;
                }
                const off = (half - 0.05) * side;
                const p0 = {
                    x: seg.startLocal.x + px * off,
                    y: seg.startY,
                    z: seg.startLocal.z + pz * off,
                };
                const p1 = {
                    x: seg.endLocal.x + px * off,
                    y: seg.endY,
                    z: seg.endLocal.z + pz * off,
                };
                const lift = (dy: number) => [
                    { ...p0, y: p0.y + dy },
                    { ...p1, y: p1.y + dy },
                ];
                const curbOn = !stepped || seg.kind === 'landing';
                const stepLift = stepped && seg.kind === 'flight' ? stepped.riserM : 0;
                if (curbOn) {
                    const [c0, c1] = lift(CURB_H / 2 + 0.075);
                    boxBetween(`site_ramp_curb_${element.id}_${seg.id}_${side}`, c0, c1, 0.1, CURB_H, curbMat, node);
                }
                const [h0, h1] = lift(railH + stepLift);
                boxBetween(`site_ramp_hr_${element.id}_${seg.id}_${side}`, h0, h1, 0.05, 0.05, railMat, node);
                const glassBase = curbOn ? CURB_H : 0.05;
                const glassH = Math.max(0.1, railH - glassBase - 0.1);
                const [g0, g1] = lift(stepLift + glassBase + glassH / 2);
                boxBetween(`site_ramp_gl_${element.id}_${seg.id}_${side}`, g0, g1, 0.02, glassH, panelMat, node);
            }
            // Descanso: baranda también en el borde del fondo (perpendicular al avance).
            if (
                seg.kind === 'landing' &&
                (seg.role === 'turn' || seg.role === 'corner')
            ) {
                const off = length / 2;
                const q0 = {
                    x: midX + ux * off - px * (half - 0.05),
                    y: seg.endY + railH,
                    z: midZ + uz * off - pz * (half - 0.05),
                };
                const q1 = {
                    x: midX + ux * off + px * (half - 0.05),
                    y: seg.endY + railH,
                    z: midZ + uz * off + pz * (half - 0.05),
                };
                boxBetween(`site_ramp_hrb_${element.id}_${seg.id}`, q0, q1, 0.05, 0.05, railMat, node);
                const cy = seg.endY + CURB_H / 2 + 0.075;
                boxBetween(
                    `site_ramp_curbb_${element.id}_${seg.id}`,
                    { ...q0, y: cy },
                    { ...q1, y: cy },
                    0.1,
                    CURB_H,
                    curbMat,
                    node,
                );
                const gyH = Math.max(0.1, railH - CURB_H - 0.1);
                const gy = seg.endY + CURB_H + gyH / 2;
                boxBetween(
                    `site_ramp_glb_${element.id}_${seg.id}`,
                    { ...q0, y: gy },
                    { ...q1, y: gy },
                    0.02,
                    gyH,
                    panelMat,
                    node,
                );
            }
        });
    }

    /** Rampa helicoidal: cinta que gira `turns` vueltas mientras sube/baja de `fromElevationM` a `toElevationM`. */
    private buildSpiralRamp(
        element: SiteElement,
        scaleM: number,
        c: RampConfig,
    ) {
        const node = new TransformNode(`site_${element.id}`, this.scene);
        this.elementNodes.set(element.id, node);
        const center = centroid(element.vertices);
        node.position.set(
            this.wx(center.x, scaleM),
            this.rel(c.fromElevationM),
            this.wz(center.y, scaleM),
        );
        node.rotation.y = (-(element.rotation ?? 0) * Math.PI) / 180;

        const bounds = boundingBox(element.vertices);
        const footprintRadiusM =
            (Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) *
                scaleM) /
            2;
        const widthM = Math.max(0.5, c.widthM || 3);
        const points = buildSpiralRampPolyline(
            c,
            Math.max(1, footprintRadiusM),
        );
        if (points.length < 2) return;

        const innerPath: Vector3[] = [];
        const outerPath: Vector3[] = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const next = points[Math.min(i + 1, points.length - 1)];
            const tangent = Math.atan2(next.z - p.z, next.x - p.x);
            const nx = Math.sin(tangent);
            const nz = -Math.cos(tangent);
            innerPath.push(
                new Vector3(
                    p.x - (nx * widthM) / 2,
                    p.y,
                    p.z - (nz * widthM) / 2,
                ),
            );
            outerPath.push(
                new Vector3(
                    p.x + (nx * widthM) / 2,
                    p.y,
                    p.z + (nz * widthM) / 2,
                ),
            );
        }

        const ribbon = MeshBuilder.CreateRibbon(
            `site_ramp_spiral_${element.id}`,
            { pathArray: [innerPath, outerPath], sideOrientation: Mesh.DOUBLESIDE },
            this.scene,
        );
        ribbon.material = this.matFor(
            element.style.fillColor,
            element.style.opacity ?? 1,
        );
        ribbon.receiveShadows = true;
        this.shadowGen?.addShadowCaster(ribbon);
        ribbon.parent = node;
    }

    /** Escalera exterior: peldaños entre `fromElevationM` y `toElevationM`. */
    /** Escalera exterior: tramos de peldaños macizos con descansos (vuelta en U cada N peldaños) y descanso de llegada a la plataforma siguiente. */
    private buildStair(element: SiteElement, scaleM: number) {
        const c: StairConfig = stairCfg(element) ?? {
            kind: 'stair',
            fromElevationM: 0,
            toElevationM: 1,
            widthM: 1.2,
            run: 'straight',
        };
        const { alongX } = this.longAxis(element, scaleM);
        const total = c.toElevationM - c.fromElevationM;
        this.buildFlightRamp(
            element,
            scaleM,
            stairAsRampConfig(c, alongX ? 'east' : 'south'),
            {
                riserM:
                    Math.abs(total) > 1e-6
                        ? Math.abs(total) / stairStepCount(total)
                        : 0.175,
            },
        );
    }

    /** Piscina: caja hundida con un plano de agua translúcido al ras del terreno. */
    private buildPool(element: SiteElement, scaleM: number) {
        const { node, localVertices } = this.anchorNode(element, scaleM);
        const basinDepth = 1.4;
        const basin = MeshBuilder.CreatePolygon(
            `site_pool_basin_${element.id}`,
            {
                shape: localVertices,
                depth: basinDepth,
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        basin.position.y = 0;
        basin.material = this.matFor('#94a3b8', 1, 0.1);
        basin.parent = node;

        const water = MeshBuilder.CreatePolygon(
            `site_pool_water_${element.id}`,
            {
                shape: localVertices,
                depth: 0.05,
                sideOrientation: Mesh.DOUBLESIDE,
            },
            this.scene,
        );
        water.position.y = -0.15;
        water.material = this.matFor(element.style.fillColor, 0.75, 0.4);
        water.parent = node;
    }

    /** Bloque de edificación: masa extruida + (opcional) interior real del módulo vinculado. */
    private buildBuildingBlock(
        element: SiteElement,
        scaleM: number,
        moduleScenes: SiteModuleScene[],
        showInteriors: boolean,
    ) {
        const node = this.buildExtrudedMass(
            element,
            scaleM,
            element.heightM ?? 9,
        );
        if (!showInteriors || element.moduleId === undefined) return;
        const moduleData = moduleScenes.find(
            (candidate) => candidate.moduleId === element.moduleId,
        );
        const scenes = moduleData?.data?.scenes;
        if (!scenes || scenes.length === 0) return;

        try {
            const childBuilder = new House3DBuilder(this.scene);
            childBuilder.syncAllFloors(
                scenes,
                [],
                false,
                'functional',
                false,
                null,
                true,
            );

            // El módulo hijo trae su propio sistema de coordenadas (arbitrario,
            // propio de SU editor) — se centra su huella (bounding box del
            // primer piso) en el origen del nodo del bloque, que ya está
            // anclado en el centroide real del emplazamiento.
            const groundFloor = [...scenes].sort(
                (a, b) => a.floorIndex - b.floorIndex,
            )[0];
            const footprint = (groundFloor?.rooms ?? []).flatMap(
                (room) => room.vertices,
            );
            const offset = new TransformNode(
                `site_interior_offset_${element.id}`,
                this.scene,
            );
            offset.parent = node;
            if (footprint.length > 0) {
                const bounds = boundingBox(footprint);
                offset.position.set(
                    -(bounds.minX + bounds.maxX) / 2,
                    0,
                    -(bounds.minY + bounds.maxY) / 2,
                );
            }
            childBuilder.floorNodes.forEach((floorNode) => {
                floorNode.parent = offset;
            });
            childBuilder.meshMap.forEach((meshes) =>
                meshes.forEach((mesh) => {
                    mesh.isPickable = false;
                }),
            );
            this.childBuilders.set(element.id, childBuilder);
        } catch (error) {
            console.warn(
                `No se pudo cargar el interior del módulo ${element.moduleId} en el emplazamiento`,
                error,
            );
        }
    }

    /** Tablero General: gabinete simple (caja) en su footprint real. */
    private buildCabinet(element: SiteElement, scaleM: number) {
        const { node } = this.anchorNode(element, scaleM);
        const cfg = tgCfg(element);
        const bounds = boundingBox(element.vertices);
        const width =
            cfg?.widthM ?? Math.max(0.4, (bounds.maxX - bounds.minX) * scaleM);
        const depth =
            cfg?.depthM ?? Math.max(0.3, (bounds.maxY - bounds.minY) * scaleM);
        const height = cfg?.heightM ?? 2;
        const pedestal = cfg?.mount === 'pedestal' ? 0.4 : 0;
        if (pedestal > 0) {
            const base = MeshBuilder.CreateBox(
                `site_tg_base_${element.id}`,
                { width: width * 1.2, height: pedestal, depth: depth * 1.2 },
                this.scene,
            );
            base.position.y = pedestal / 2;
            base.material = this.matFor('#6b7280', 1, 0.2);
            base.parent = node;
        }
        const cabinet = MeshBuilder.CreateBox(
            `site_tg_${element.id}`,
            { width, height, depth },
            this.scene,
        );
        cabinet.position.y = pedestal + height / 2;
        cabinet.material = this.matFor(element.style.fillColor, 1, 0.3);
        cabinet.parent = node;
        this.shadowGen?.addShadowCaster(cabinet);
    }

    /** Transformador: cilindro (cuba) + caja (radiadores/tapa). */
    private buildTransformer(element: SiteElement, scaleM: number) {
        const { node } = this.anchorNode(element, scaleM);
        const cfg = transformerCfg(element);
        const bounds = boundingBox(element.vertices);
        const fpDiameter = Math.max(
            0.6,
            Math.min(
                (bounds.maxX - bounds.minX) * scaleM,
                (bounds.maxY - bounds.minY) * scaleM,
            ),
        );
        const diameter = cfg ? Math.min(cfg.widthM, cfg.depthM) : fpDiameter;
        const tankH = cfg ? Math.max(0.6, cfg.heightM - 0.4) : 1.6;
        const poleMount = cfg?.mount === 'pole';
        const baseY = poleMount ? 6 : 0;
        if (poleMount) {
            const mast = MeshBuilder.CreateCylinder(
                `site_transformer_mast_${element.id}`,
                { diameter: 0.2, height: 6 },
                this.scene,
            );
            mast.position.y = 3;
            mast.material = this.matFor('#6b7280', 1, 0.2);
            mast.parent = node;
        }
        const tank = MeshBuilder.CreateCylinder(
            `site_transformer_tank_${element.id}`,
            { diameter, height: tankH },
            this.scene,
        );
        tank.position.y = baseY + tankH / 2;
        tank.material = this.matFor('#6b7280', 1, 0.25);
        tank.parent = node;

        const lid = MeshBuilder.CreateBox(
            `site_transformer_lid_${element.id}`,
            { width: diameter * 0.7, height: 0.3, depth: diameter * 0.7 },
            this.scene,
        );
        lid.position.y = baseY + tankH + 0.1;
        lid.material = this.matFor(element.style.fillColor, 1, 0.3);
        lid.parent = node;
        this.shadowGen?.addShadowCaster(tank);
    }

    /** Portón de acceso: jambas + travesaño + hoja, según variante y estado. */
    private buildGate(element: SiteElement, scaleM: number) {
        const { node } = this.anchorNode(element, scaleM);
        const cfg = gateCfg(element);
        const fence = this.gateFence.get(element.id);
        const fenceMatch =
            fence?.type === 'fence'
                ? closestPointOnPolygon(
                      centroid(element.vertices),
                      fence.vertices,
                      fenceCfg(fence)?.closed ?? true,
                  )
                : undefined;
        if (fence && fenceMatch) {
            // Pegado al cerco vinculado: mismo punto sobre su línea, misma
            // cota y misma altura — en vez de la posición/altura propias del
            // portón (que en 2D puede no coincidir exacto con el cerco).
            // `bearingDeg` usa la MISMA fórmula que `anchorNode` para
            // `element.rotation` (0°=arriba en pantalla, horario positivo,
            // ver el handle de rotación en `SiteCanvas2D.tsx`) para no tener
            // que derivar a mano el signo de la rotación Y de Babylon.
            const bearingDeg =
                (Math.atan2(fenceMatch.tangent.x, -fenceMatch.tangent.y) *
                    180) /
                Math.PI;
            node.position.set(
                this.wx(fenceMatch.point.x, scaleM),
                (fenceCfg(fence)?.conform ?? 'stepped') === 'flat'
                    ? this.groundAt(fenceMatch.point) +
                          (fence.baseElevationM ?? 0)
                    : this.rel(this.groundTopAbs(fenceMatch.point)),
                this.wz(fenceMatch.point.y, scaleM),
            );
            // El vano del portón corre por su eje local X (este-oeste, rumbo
            // 90° a rotación 0). Para que quede A LO LARGO del cerco hay que
            // girarlo (rumbo del cerco − 90°); girarlo el rumbo completo lo
            // dejaba atravesado al cerco (bug reportado 2026-09-18).
            node.rotation.y = (-(bearingDeg - 90) * Math.PI) / 180;
        }
        const bounds = boundingBox(element.vertices);
        const spanX = Math.max(1.2, (bounds.maxX - bounds.minX) * scaleM);
        const spanZ = Math.max(1.2, (bounds.maxY - bounds.minY) * scaleM);
        // Pegado a un cerco, el vano siempre va por el eje X local (ya alineado arriba).
        const horizontal = fenceMatch ? true : spanX >= spanZ;
        const span = cfg?.widthM ?? (horizontal ? spanX : spanZ);
        const variant = cfg?.variant ?? 'swing';
        const openDeg =
            cfg?.state === 'open'
                ? cfg?.openAngleDeg || 90
                : cfg?.state === 'ajar'
                  ? cfg?.openAngleDeg || 35
                  : (cfg?.openAngleDeg ?? 0);
        const height =
            fence?.heightM ??
            element.heightM ??
            (variant === 'barrier' ? 1 : 2.2);
        const post = 0.18;
        const metal = this.matFor('#6b7280', 1, 0.3);
        const leafMat = this.matFor(element.style.fillColor, 1, 0.2);
        // Eje local: +X a lo largo del vano si horizontal, +Z si no.
        const along = (d: number): [number, number] =>
            horizontal ? [d, 0] : [0, d];

        const mkPost = (d: number) => {
            const [x, z] = along(d);
            const p = MeshBuilder.CreateBox(
                `site_gate_post_${element.id}_${d}`,
                { width: post, height, depth: post },
                this.scene,
            );
            p.position.set(x, height / 2, z);
            p.material = metal;
            p.parent = node;
            this.shadowGen?.addShadowCaster(p);
        };

        if (variant === 'barrier') {
            // Una columna + pluma horizontal que sube openDeg sobre el eje
            // perpendicular al vano.
            mkPost(-span / 2);
            const hinge = new TransformNode(
                `site_gate_hinge_${element.id}`,
                this.scene,
            );
            const [hx, hz] = along(-span / 2);
            hinge.position.set(hx, height, hz);
            hinge.rotation[horizontal ? 'z' : 'x'] =
                ((horizontal ? 1 : -1) * openDeg * Math.PI) / 180;
            hinge.parent = node;
            const boom = MeshBuilder.CreateBox(
                `site_gate_boom_${element.id}`,
                {
                    width: horizontal ? span : 0.1,
                    height: 0.1,
                    depth: horizontal ? 0.1 : span,
                },
                this.scene,
            );
            const [bx, bz] = along(span / 2);
            boom.position.set(bx, 0, bz);
            boom.material = leafMat;
            boom.parent = hinge;
            this.shadowGen?.addShadowCaster(boom);
            return;
        }

        mkPost(-span / 2);
        mkPost(span / 2);
        const beam = MeshBuilder.CreateBox(
            `site_gate_beam_${element.id}`,
            {
                width: horizontal ? span : post,
                height: post,
                depth: horizontal ? post : span,
            },
            this.scene,
        );
        beam.position.y = height - post / 2;
        beam.material = metal;
        beam.parent = node;

        const leafH = height * 0.78;
        const mkLeaf = (
            leafSpan: number,
            hingeD: number,
            sign: number,
            tag: string,
        ) => {
            const hinge = new TransformNode(
                `site_gate_hinge_${element.id}_${tag}`,
                this.scene,
            );
            const [hx, hz] = along(hingeD);
            hinge.position.set(hx, leafH / 2 + 0.05, hz);
            if (variant === 'sliding') {
                // Corre a un lado: 0° cerrado, 90° = corrido todo el vano.
                const slide = (openDeg / 90) * leafSpan;
                const [sx, sz] = along(sign * slide);
                hinge.position.x += sx;
                hinge.position.z += sz;
            } else {
                hinge.rotation.y = (sign * openDeg * Math.PI) / 180;
            }
            hinge.parent = node;
            const leaf = MeshBuilder.CreateBox(
                `site_gate_leaf_${element.id}_${tag}`,
                {
                    width: horizontal ? leafSpan : 0.06,
                    height: leafH,
                    depth: horizontal ? 0.06 : leafSpan,
                },
                this.scene,
            );
            const [lx, lz] = along(leafSpan / 2);
            leaf.position.set(lx, 0, lz);
            leaf.material = leafMat;
            leaf.parent = hinge;
            this.shadowGen?.addShadowCaster(leaf);
        };

        if (variant === 'double-swing') {
            mkLeaf(span / 2 - 0.02, -span / 2, 1, 'l');
            mkLeaf(span / 2 - 0.02, span / 2, -1, 'r');
        } else if (variant === 'pedestrian') {
            mkLeaf(Math.min(1, span - 0.1), -span / 2, 1, 'p');
        } else {
            mkLeaf(span - 0.04, -span / 2, 1, 's');
        }
    }

    /** Poste de alumbrado exterior: fuste + brazo(s) + cabeza(s). */
    private buildPole(element: SiteElement, scaleM: number) {
        const { node } = this.anchorNode(element, scaleM);
        const cfg = poleCfg(element);
        const shaftHeight = cfg?.heightM ?? element.heightM ?? 6;
        const armLen = cfg?.armLengthM ?? 0;
        const armDir = ((cfg?.armDirectionDeg ?? 0) * Math.PI) / 180;
        const fixtures = Math.max(1, cfg?.fixtures ?? 1);
        const shaft = MeshBuilder.CreateCylinder(
            `site_pole_shaft_${element.id}`,
            { diameter: 0.15, height: shaftHeight },
            this.scene,
        );
        shaft.position.y = shaftHeight / 2;
        shaft.material = this.matFor('#6b7280', 1, 0.2);
        shaft.parent = node;

        for (let i = 0; i < fixtures; i++) {
            // Reparte las luminarias alrededor del eje (una sola → según armDir).
            const ang =
                fixtures === 1 ? armDir : armDir + (i * 2 * Math.PI) / fixtures;
            const hx = Math.sin(ang) * armLen;
            const hz = -Math.cos(ang) * armLen;
            if (armLen > 0) {
                const arm = MeshBuilder.CreateBox(
                    `site_pole_arm_${element.id}_${i}`,
                    { width: 0.06, height: 0.06, depth: armLen },
                    this.scene,
                );
                arm.position.set(hx / 2, shaftHeight - 0.1, hz / 2);
                arm.lookAt(new Vector3(hx, shaftHeight - 0.1, hz));
                arm.material = this.matFor('#6b7280', 1, 0.2);
                arm.parent = node;
            }
            const head = MeshBuilder.CreateSphere(
                `site_pole_head_${element.id}_${i}`,
                { diameter: 0.35 },
                this.scene,
            );
            head.position.set(hx, shaftHeight - (armLen > 0 ? 0.1 : 0), hz);
            head.material = this.getLampMaterial();
            head.parent = node;
            this.lampHeads.push({
                head,
                pole: node,
                lumens: cfg?.lumens,
                productId: cfg?.productId,
                beamDeg: cfg?.beamAngleDeg ?? DEFAULT_LUMINAIRE.beamDeg,
                maintenance:
                    cfg?.maintenanceFactor ?? DEFAULT_LUMINAIRE.maintenance,
            });
        }
    }

    /** Tubo que sigue el trazado real del alimentador, coloreado por su estado de caída de tensión. */
    private buildFeeder(
        path: FeederPath,
        scaleM: number,
        calculations: EdgeCalculation[],
    ) {
        if (path.waypoints.length < 2) return;
        const points = path.waypoints.map(
            (point) =>
                new Vector3(
                    this.wx(point.x, scaleM),
                    0.06,
                    this.wz(point.y, scaleM),
                ),
        );
        const tube = MeshBuilder.CreateTube(
            `site_feeder_${path.id}`,
            { path: points, radius: 0.08, sideOrientation: Mesh.DOUBLESIDE },
            this.scene,
        );
        const status = deriveFeederStatus(path.networkEdgeId, calculations);
        tube.material = this.matFor(
            path.style?.color ?? feederStatusColor(status),
            1,
            0.15,
        );
        this.feederMeshes.push(tube);
    }

    private frameCamera(siteData: SiteData, scaleM: number) {
        if (!this.camera) return;
        const allVertices = siteData.elements.flatMap(
            (element) => element.vertices,
        );
        if (allVertices.length === 0) return;
        const bounds = boundingBox(allVertices);
        // Rango vertical del contenido (relativo al datum).
        let loZ = 0;
        let hiZ = 0;
        if (this.terrainModeled) {
            loZ = Infinity;
            hiZ = -Infinity;
            for (const p of this.terrainPoints) {
                const z = p.z - this.elevationDatum;
                if (z < loZ) loZ = z;
                if (z > hiZ) hiZ = z;
            }
        }
        const midY = Number.isFinite(loZ) ? (loZ + hiZ) / 2 : 0;
        // Todo se dibuja recentrado en (originX, originZ) → el centro es (0, ·, 0).
        const center = new Vector3(0, midY, 0);
        const size = Math.max(
            (bounds.maxX - bounds.minX) * scaleM,
            (bounds.maxY - bounds.minY) * scaleM,
        );
        this.camera.setTarget(center);
        this.camera.upperRadiusLimit = Math.max(500, size * 4);
        this.camera.maxZ = Math.max(2000, size * 12);
        this.camera.radius = Math.max(20, size * 1.3);
    }

    /** Elimina todo lo construido (elementos, alimentadores, interiores de módulos hijos) — no toca cámara/luces. */
    private getLampMaterial(): StandardMaterial {
        if (!this.lampMat) {
            const mat = new StandardMaterial('site_lamp_mat', this.scene);
            mat.diffuseColor = new Color3(1, 0.97, 0.85);
            mat.specularColor = new Color3(0.2, 0.2, 0.2);
            mat.emissiveColor = this.nightMode
                ? new Color3(1, 0.93, 0.65)
                : Color3.Black();
            this.lampMat = mat;
        }
        return this.lampMat;
    }

    /** Día / Noche: cambia el cielo y las luces globales, enciende las luminarias y sus luces puntuales. */
    setNightMode(on: boolean) {
        this.nightMode = on;
        this.applyDayNight();
    }

    /** Muestra/oculta el mapa de iluminancia (lux) sobre el suelo. */
    setLuxMap(on: boolean) {
        this.luxMapOn = on;
        this.buildLuxMesh();
    }

    getLightingSummary(): LightingSummary | null {
        return this.lightingSummary;
    }

    private applyDayNight() {
        const night = this.nightMode;
        if (this.ambient) this.ambient.intensity = night ? 0.14 : 0.6;
        if (this.sun) this.sun.intensity = night ? 0.06 : 1.1;
        this.scene.clearColor = night
            ? new Color4(0.02, 0.04, 0.09, 1)
            : new Color4(0.68, 0.78, 0.88, 1);
        if (this.lampMat) {
            this.lampMat.emissiveColor = night
                ? new Color3(1, 0.93, 0.65)
                : Color3.Black();
        }
        this.nightLights.forEach((light) => light.setEnabled(night));
    }

    /**
     * Tras construir el emplazamiento: toma la posición REAL de cada cabeza de
     * luminaria (ya con la rotación del poste aplicada), calcula la malla de
     * iluminancia y su resumen, y (re)crea luces puntuales (máx. 8) y el mapa.
     */
    private finalizeLighting(siteData: SiteData) {
        this.disposeLighting();
        if (this.lampHeads.length === 0) {
            this.applyDayNight();
            return;
        }
        const sources: LuminaireSource[] = this.lampHeads.map((lamp) => {
            lamp.head.computeWorldMatrix(true);
            lamp.pole.computeWorldMatrix(true);
            const p = lamp.head.getAbsolutePosition();
            const pole = lamp.pole.getAbsolutePosition();
            const product =
                lamp.productId !== undefined
                    ? this.photometry.get(lamp.productId)
                    : undefined;
            const lumens =
                lamp.lumens ??
                product?.totalLumens ??
                product?.web?.reference_lumens ??
                DEFAULT_LUMINAIRE.lumens;
            // C0 apunta hacia donde apunta el brazo (de la base del poste a la cabeza).
            const dxp = p.x - pole.x;
            const dzp = p.z - pole.z;
            const reference = product?.web?.reference_lumens ?? 0;
            return {
                x: p.x,
                y: p.y,
                z: p.z,
                lumens,
                beamDeg: lamp.beamDeg,
                maintenance: lamp.maintenance,
                photometry: product?.web
                    ? {
                          web: product.web,
                          scale: reference > 0 ? lumens / reference : 1,
                          orientationRad:
                              Math.hypot(dxp, dzp) > 0.05
                                  ? Math.atan2(dxp, dzp)
                                  : 0,
                      }
                    : undefined,
            };
        });
        this.luxSources = sources;

        // Malla: caja de las luminarias + 25 m, celda ≥ 1 m y ≤ ~150 celdas por lado.
        const R = 25;
        const xs = sources.map((src) => src.x);
        const zs = sources.map((src) => src.z);
        const minX = Math.min(...xs) - R;
        const minZ = Math.min(...zs) - R;
        const spanX = Math.max(...xs) + R - minX;
        const spanZ = Math.max(...zs) + R - minZ;
        const cell = Math.max(1, Math.ceil(Math.max(spanX, spanZ) / 150));
        const spec: LuxGridSpec = {
            minX,
            minZ,
            cell,
            cols: Math.ceil(spanX / cell),
            rows: Math.ceil(spanZ / cell),
        };
        const groundY = (x: number, z: number) =>
            this.rel(
                this.groundTopAbs({
                    x: (x + this.originX) / this.scaleM,
                    y: -(z + this.originZ) / this.scaleM,
                }),
            );
        const values = computeLuxGrid(sources, spec, groundY);
        this.luxSpec = spec;
        this.luxValues = values;

        // Área analizada: el/los "Terreno / Lote" dibujados; si no hay, 15 m alrededor de cada luminaria.
        const terrains = siteData.elements.filter(
            (el) =>
                el.type === 'terrain' &&
                el.visible !== false &&
                el.vertices.length >= 3,
        );
        const include = (i: number, j: number) => {
            const x = spec.minX + i * spec.cell;
            const z = spec.minZ + j * spec.cell;
            if (terrains.length > 0) {
                const p = {
                    x: (x + this.originX) / this.scaleM,
                    y: -(z + this.originZ) / this.scaleM,
                };
                return terrains.some((t) => pointInPolygon(p, t.vertices));
            }
            return sources.some((src) => Math.hypot(src.x - x, src.z - z) <= 15);
        };
        this.lightingSummary = summarizeLux(values, spec, include, sources);

        sources.slice(0, 8).forEach((src, index) => {
            const light = new PointLight(
                `site_night_light_${index}`,
                new Vector3(src.x, src.y - 0.3, src.z),
                this.scene,
            );
            light.diffuse = new Color3(1, 0.92, 0.7);
            light.specular = new Color3(0.3, 0.28, 0.2);
            light.intensity = 0.9;
            light.range = 30;
            light.setEnabled(this.nightMode);
            this.nightLights.push(light);
        });

        this.applyDayNight();
        this.buildLuxMesh();
    }

    /** Malla de colores (un color por vértice, sigue el terreno/plataformas) con la iluminancia calculada. */
    private buildLuxMesh() {
        this.luxMesh?.dispose(false, true);
        this.luxMesh = null;
        if (!this.luxMapOn || !this.luxSpec || !this.luxValues) return;
        const spec = this.luxSpec;
        const values = this.luxValues;
        const stride = spec.cols + 1;
        const positions: number[] = [];
        const colors: number[] = [];
        const normals: number[] = [];
        for (let j = 0; j <= spec.rows; j++) {
            for (let i = 0; i <= spec.cols; i++) {
                const x = spec.minX + i * spec.cell;
                const z = spec.minZ + j * spec.cell;
                const y =
                    this.rel(
                        this.groundTopAbs({
                            x: (x + this.originX) / this.scaleM,
                            y: -(z + this.originZ) / this.scaleM,
                        }),
                    ) + 0.06;
                positions.push(x, y, z);
                normals.push(0, 1, 0);
                colors.push(...luxColor(values[j * stride + i]));
            }
        }
        const indices: number[] = [];
        for (let j = 0; j < spec.rows; j++) {
            for (let i = 0; i < spec.cols; i++) {
                const a = j * stride + i;
                const b = a + 1;
                const c = a + stride;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }
        const mesh = new Mesh('site_lux_map', this.scene);
        const data = new VertexData();
        data.positions = positions;
        data.indices = indices;
        data.normals = normals;
        data.colors = colors;
        data.applyToMesh(mesh);
        mesh.hasVertexAlpha = true;
        mesh.isPickable = false;
        const mat = new StandardMaterial('site_lux_mat', this.scene);
        mat.disableLighting = true;
        mat.emissiveColor = Color3.White();
        mat.backFaceCulling = false;
        mesh.material = mat;
        this.luxMesh = mesh;
    }

    private disposeLighting() {
        this.luxMesh?.dispose(false, true);
        this.luxMesh = null;
        this.nightLights.forEach((light) => light.dispose());
        this.nightLights = [];
        this.luxSources = [];
        this.luxSpec = null;
        this.luxValues = null;
        this.lightingSummary = null;
    }

    private disposeContent() {
        this.disposeLighting();
        this.lampHeads = [];
        this.elementNodes.forEach((node) => node.dispose());
        this.elementNodes.clear();
        this.feederMeshes.forEach((mesh) => mesh.dispose());
        this.feederMeshes = [];
        this.childBuilders.forEach((builder) => builder.dispose());
        this.childBuilders.clear();
    }

    dispose() {
        this.disposeContent();
        this.lampMat?.dispose();
        this.lampMat = null;
        this.matCache.forEach((mat) => mat.dispose());
        this.matCache.clear();
        this.shadowGen?.dispose();
        this.shadowGen = null;
    }
}
