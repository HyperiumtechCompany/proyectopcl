import {
    Color3,
    DirectionalLight,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    ShadowGenerator,
    StandardMaterial,
    TransformNode,
    Vector3,
    type ArcRotateCamera,
    type Scene,
} from '@babylonjs/core';
import { House3DBuilder } from '@/pages/dialux/engine/House3DBuilder';
import type { Scene as EditorScene } from '@/pages/dialux/hooks/useEditorStore';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import { deriveFeederStatus, feederStatusColor } from '../domain/feederSync';
import { boundingBox } from '../domain/geometry';
import type {
    FeederPath,
    GateConfig,
    PoleConfig,
    Point2D,
    SiteData,
    SiteElement,
    TgConfig,
    TransformerConfig,
} from '../domain/types';

function gateCfg(el: SiteElement): GateConfig | undefined {
    return el.config?.kind === 'gate' ? el.config : undefined;
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
    ) {
        this.disposeContent();
        const scaleM = siteData.terrainScaleM || 1;
        const visibleTypes = new Set(
            siteData.layers
                .filter((layer) => layer.visible)
                .flatMap((layer) => layer.types),
        );

        for (const element of siteData.elements) {
            if (element.visible === false) continue;
            if (!visibleTypes.has(element.type)) continue;
            if (element.vertices.length < 3) continue;
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
    }

    private buildElement(
        element: SiteElement,
        scaleM: number,
        moduleScenes: SiteModuleScene[],
        showInteriors: boolean,
    ) {
        switch (element.type) {
            case 'terrain':
                this.buildFlatSlab(element, scaleM, 0.3, 0);
                return;
            case 'street':
            case 'green_area':
            case 'parking':
            case 'court':
            case 'ramp':
                this.buildFlatSlab(element, scaleM, 0.06, 0.02);
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
                this.buildExtrudedMass(element, scaleM, element.heightM ?? 3);
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
        // `baseElevationM` es en metros reales (no unidades de plano) — el
        // terreno no es plano: aulas +7, estacionamiento −1, etc.
        node.position.set(
            center.x * scaleM,
            element.baseElevationM ?? 0,
            -center.y * scaleM,
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
        const bounds = boundingBox(element.vertices);
        const spanX = Math.max(1.2, (bounds.maxX - bounds.minX) * scaleM);
        const spanZ = Math.max(1.2, (bounds.maxY - bounds.minY) * scaleM);
        const horizontal = spanX >= spanZ;
        const span = cfg?.widthM ?? (horizontal ? spanX : spanZ);
        const variant = cfg?.variant ?? 'swing';
        const openDeg =
            cfg?.state === 'open'
                ? cfg?.openAngleDeg || 90
                : cfg?.state === 'ajar'
                  ? cfg?.openAngleDeg || 35
                  : (cfg?.openAngleDeg ?? 0);
        const height = element.heightM ?? (variant === 'barrier' ? 1 : 2.2);
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
            head.material = this.matFor(element.style.fillColor, 1, 0.1);
            head.parent = node;
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
            (point) => new Vector3(point.x * scaleM, 0.06, -point.y * scaleM),
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
        const center = new Vector3(
            ((bounds.minX + bounds.maxX) / 2) * scaleM,
            0,
            -((bounds.minY + bounds.maxY) / 2) * scaleM,
        );
        const size = Math.max(
            (bounds.maxX - bounds.minX) * scaleM,
            (bounds.maxY - bounds.minY) * scaleM,
        );
        this.camera.setTarget(center);
        this.camera.radius = Math.max(20, size * 1.3);
    }

    /** Elimina todo lo construido (elementos, alimentadores, interiores de módulos hijos) — no toca cámara/luces. */
    private disposeContent() {
        this.elementNodes.forEach((node) => node.dispose());
        this.elementNodes.clear();
        this.feederMeshes.forEach((mesh) => mesh.dispose());
        this.feederMeshes = [];
        this.childBuilders.forEach((builder) => builder.dispose());
        this.childBuilders.clear();
    }

    dispose() {
        this.disposeContent();
        this.matCache.forEach((mat) => mat.dispose());
        this.matCache.clear();
        this.shadowGen?.dispose();
        this.shadowGen = null;
    }
}
