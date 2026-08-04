/**
 * House3DBuilder.ts
 *
 * Motor 3D para el editor DIAlux — construye meshes Babylon.js
 * a partir de los datos del store (rooms, walls, windows, canopies, fixtures).
 *
 * Estrategia de construcción de paredes con ventanas:
 *   Una pared se divide en sub-cajas verticales:
 *   - Segmentos sólidos: caja completa (width=segLen, height=wallH, depth=thickness)
 *   - Segmentos con ventana: 3 cajas (antepecho, hueco, dintel)
 *   Esto evita CSG y es altamente performante.
 */

import type { Scene, ArcRotateCamera } from '@babylonjs/core';
import {
    MeshBuilder,
    Mesh,
    StandardMaterial,
    Color3,
    Vector3,
    SpotLight,
    PointLight,
    HemisphericLight,
    DirectionalLight,
    ShadowGenerator,
    TransformNode,
} from '@babylonjs/core';

import { DynamicTexture } from '@babylonjs/core';
import earcut from 'earcut';
(window as any).earcut = earcut;

import { buildContourSegments } from '@/pages/dialux/hooks/isoluxContours';
import { pointInPolygon } from '@/pages/dialux/hooks/ambientSpaces';
import { buildConductor3DPath } from '@/pages/dialux/engine/conductor3DPath';
import {
    DEFAULT_STRUCTURAL_SLAB_THICKNESS,
    getCorridorRenderFlags,
    getFittedStairTreadDepth,
    getFloorToFloorStackHeight,
    getPostLandingCursorOffset,
    getStairLaneLayout,
} from '@/pages/dialux/hooks/stairGeometry';
import type {
    Room,
    Wall,
    Window,
    Door,
    Canopy,
    Fixture,
    LightSwitch,
    Conductor,
    ElectricalDevice,
    ElectricalDeviceType,
    Partition,
    Scene as EditorScene,
    LightingResult,
    IsoluxMode,
} from '@/pages/dialux/hooks/useEditorStore';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from './fixtureHeights';

// ─── Constantes de material ────────────────────────────────────────────────────

const HEX_WALL = '#8ba0b4';
const HEX_FLOOR = '#1e293b';
const HEX_CEILING = '#1e3a4a';
const HEX_GLASS = '#7dd3fc';
const HEX_FRAME = '#334155';
const HEX_CANOPY = '#ca8a04';
/** Losa de pasadizo: tono ámbar cálido que la diferencia del techo interior */
const HEX_PASADIZO_SLAB = '#92400e';
const WAVE_LEVEL_FACTORS = [0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.82, 0.94];

interface FixtureBodyOptions {
    diameter?: number;
    diameterTop?: number;
    diameterBottom?: number;
    height?: number;
}

/**
 * Convierte grados (planta, sentido horario, 0°=Norte) a radianes para
 * mesh.rotation.y. El editor 2D usa la misma convención en su SVG
 * (rotate(deg) sentido horario) y worldToScreen mapea Norte=arriba de
 * pantalla, por lo que no hace falta invertir el signo aquí — a diferencia
 * de los ángulos derivados de muros (`Math.atan2(dy,dx)`), que sí lo
 * necesitan porque miden desde el eje +X en convención matemática CCW.
 */
function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

function hexToColor3(hex: string): Color3 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new Color3(r, g, b);
}

// ─── Clase principal ──────────────────────────────────────────────────────────

export class House3DBuilder {
    scene: Scene;
    camera: ArcRotateCamera | null;
    meshMap: Map<string, Mesh[]> = new Map();
    shadowGen: ShadowGenerator | null = null;
    warnedInvalidRooms: Set<string> = new Set();
    floorNodes: Map<string, TransformNode> = new Map();

    // Materiales estructurales cacheados (creados UNA vez)
    matWall!: StandardMaterial;
    matFloor!: StandardMaterial;
    matCeiling!: StandardMaterial;
    matGlass!: StandardMaterial;
    matFrame!: StandardMaterial;
    matCanopy!: StandardMaterial;
    matDoor!: StandardMaterial; // madera de puerta
    matPasadizoSlab!: StandardMaterial; // losa de pasadizo (voladizo/techo)

    /** Cache de materiales por color de fixture — evita N instancias de StandardMaterial */
    matFixtureCache: Map<string, StandardMaterial> = new Map();

    /** Cache de materiales por color de dispositivo eléctrico */
    matElecDeviceCache: Map<string, StandardMaterial> = new Map();

    /** Cache de materiales para marcadores de escalera (entrada verde / salida amarillo) */
    matStairMarkerCache: Map<string, StandardMaterial> = new Map();

    constructor(scene: Scene, camera?: ArcRotateCamera) {
        this.scene = scene;
        this.camera = camera || null;
        this.initMaterials();
    }

    // ── Multi-piso ─────────────────────────────────────────────────────────────
    /**
     * Renderiza TODOS los pisos del proyecto apilados en Y según `floorElevation`.
     * Reemplaza las llamadas directas a `syncScene` desde Editor3DCanvas.
     */
    syncAllFloors(
        scenes: EditorScene[],
        result: LightingResult | null = null,
        showIsolux: boolean = false,
        isoluxMode: IsoluxMode = 'functional',
        showRoof: boolean = false,
        activeSceneId: string | null = null,
        showAllFloors: boolean = true,
    ) {
        // 1. Dispose meshes y nodos padre previos
        this.floorNodes.forEach((node) => node.dispose());
        this.floorNodes.clear();
        this.meshMap.forEach((meshes) => meshes.forEach((m) => m.dispose()));
        this.meshMap.clear();
        this.scene.lights
            .filter((l) => l.name.startsWith('light_'))
            .forEach((l) => l.dispose());

        // 2. Ordenar por floorIndex (sótano → ático)
        const sorted = [...scenes].sort((a, b) => a.floorIndex - b.floorIndex);

        const displayElevations = this.resolveDisplayElevations(
            sorted,
            showRoof,
        );

        // 3. Construir cada piso en su elevación visual
        for (let i = 0; i < sorted.length; i++) {
            const floor = sorted[i];
            const floorBelow = i > 0 ? sorted[i - 1] : undefined;
            const isActive = floor.id === activeSceneId;
            const isVisible = floor.visible ?? true;

            if (!isActive && (!showAllFloors || !isVisible)) {
                continue;
            }

            this.syncScene(
                floor,
                isActive ? result : null,
                isActive ? showIsolux : false,
                isoluxMode,
                showRoof,
                displayElevations.get(floor.id) ?? floor.floorElevation,
                floor.id,
                floorBelow,
            );
        }

        this.frameCamera();
    }

    // ── Materiales ─────────────────────────────────────────────────────────────
    initMaterials() {
        this.matWall = this.makeMat('mat_wall', HEX_WALL, 0.0);
        this.matFloor = this.makeMat('mat_floor', HEX_FLOOR, 0.05);
        this.matCeiling = this.makeMat('mat_ceiling', HEX_CEILING, 0.0);
        this.matFrame = this.makeMat('mat_frame', HEX_FRAME, 0.0);
        this.matCanopy = this.makeMat('mat_canopy', HEX_CANOPY, 0.1);
        this.matDoor = this.makeMat('mat_door', '#7c5c3a', 0.05);

        // Losa de pasadizo: mismo tono que el techo, opaca y visible desde ambos lados
        this.matPasadizoSlab = new StandardMaterial(
            'mat_pasadizo_slab',
            this.scene,
        );
        this.matPasadizoSlab.diffuseColor = hexToColor3(HEX_CEILING);
        this.matPasadizoSlab.specularColor = new Color3(0.1, 0.15, 0.2);
        this.matPasadizoSlab.backFaceCulling = false;

        // Vidrio semitransparente
        this.matGlass = new StandardMaterial('mat_glass', this.scene);
        this.matGlass.diffuseColor = hexToColor3(HEX_GLASS);
        this.matGlass.specularColor = Color3.White();
        this.matGlass.alpha = 0.35;
        this.matGlass.backFaceCulling = false;
    }

    makeMat(
        name: string,
        hex: string,
        specularIntensity: number,
    ): StandardMaterial {
        const m = new StandardMaterial(name, this.scene);
        m.diffuseColor = hexToColor3(hex);
        m.specularColor = new Color3(
            specularIntensity,
            specularIntensity,
            specularIntensity,
        );
        return m;
    }

    /**
     * Crea (o retorna desde caché) un material para el primer/último escalón.
     *   'entry' = verde suave (primer escalón — entrada)
     *   'exit'  = amarillo suave (último escalón — salida/descanso)
     */
    getOrCreateStairMarkerMat(type: 'entry' | 'exit'): StandardMaterial {
        const cached = this.matStairMarkerCache.get(type);
        if (cached) return cached;

        const m = new StandardMaterial(`mat_stair_${type}`, this.scene);
        if (type === 'entry') {
            m.diffuseColor = new Color3(0.2, 0.65, 0.3); // verde entrada
        } else {
            m.diffuseColor = new Color3(0.85, 0.72, 0.1); // amarillo salida
        }
        m.specularColor = new Color3(0.05, 0.05, 0.05);
        this.matStairMarkerCache.set(type, m);
        return m;
    }

    // ── Setup de iluminación base ─────────────────────────────────────────────
    setupLights() {
        // Luz ambiental suave
        const ambient = new HemisphericLight(
            'hemi',
            new Vector3(0, 1, 0),
            this.scene,
        );
        ambient.intensity = 0.5;
        ambient.diffuse = new Color3(0.9, 0.95, 1.0);
        ambient.groundColor = new Color3(0.2, 0.2, 0.3);

        // Luz direccional (sol)
        const sun = new DirectionalLight(
            'sun',
            new Vector3(-1, -2, -1).normalize(),
            this.scene,
        );
        sun.intensity = 0.8;
        sun.diffuse = new Color3(1.0, 0.95, 0.85);
        sun.position = new Vector3(10, 15, 10);

        // Shadow generator sobre el sol
        this.shadowGen = new ShadowGenerator(1024, sun);
        this.shadowGen.useBlurExponentialShadowMap = true;
        this.shadowGen.blurKernel = 16;

        return { ambient, sun };
    }

    /** Elimina todas las luces de fixtures */
    disposeFixtureLights() {
        this.scene.lights
            .filter((l) => l.name.startsWith('light_'))
            .forEach((l) => l.dispose());
    }

    // ── Sincronización con el store ───────────────────────────────────────────

    /**
     * Reconstruye toda la escena 3D.
     * Llama cada vez que el store cambia (via suscripción).
     *
     * Garantías de memoria:
     *   1. Todos los meshes previos se disponen antes de reconstruir.
     *   2. Las luces de fixtures (prefijo 'light_') se eliminan aquí
     *      ANTES de llamar a buildFixtureLight(), evitando acumulación.
     */
    syncScene(
        editorScene: EditorScene,
        result?: LightingResult | null,
        showIsolux?: boolean,
        isoluxMode: IsoluxMode = 'functional',
        showRoof: boolean = false,
        yOffset: number = 0,
        sceneId?: string,
        floorBelow?: EditorScene,
    ) {
        // 1. Dispose meshes previos de este escopo (no afectar otros pisos)
        // Cuando se llama desde syncAllFloors, el dispose ya se hizo en bloque.
        // Cuando se llama solo (compatibilidad), hacemos dispose total.
        if (!sceneId) {
            this.meshMap.forEach((meshes) =>
                meshes.forEach((m) => m.dispose()),
            );
            this.meshMap.clear();
        }

        // 2. TransformNode padre para este piso
        const floorNode = new TransformNode(
            `floor_node_${sceneId ?? 'single'}`,
            this.scene,
        );
        floorNode.position.y = yOffset;
        if (sceneId) this.floorNodes.set(sceneId, floorNode);

        const rooms = editorScene.rooms || [];
        const walls = editorScene.walls || [];

        // Calcular la altura de techo para cada habitación.
        // Para los pasadizos (corridor) se hereda la altura del recinto que los contiene.
        const recintoHeights = new Map(
            rooms
                .filter(
                    (r) => r.roomType !== 'corridor' && r.roomType !== 'stair',
                )
                .map((r) => [r.id, resolveRoomCeilingHeight(r, walls)]),
        );

        const roomHeights = new Map<string, number>();
        for (const room of rooms) {
            if (room.roomType !== 'corridor' && room.roomType !== 'stair') {
                roomHeights.set(
                    room.id,
                    recintoHeights.get(room.id) ?? room.height,
                );
            } else {
                // El pasadizo/escalera hereda la altura del recinto que lo contiene.
                const cx =
                    room.vertices.reduce((s, v) => s + v.x, 0) /
                    room.vertices.length;
                const cy =
                    room.vertices.reduce((s, v) => s + v.y, 0) /
                    room.vertices.length;
                const parent = rooms.find(
                    (r) =>
                        r.roomType !== 'corridor' &&
                        r.roomType !== 'stair' &&
                        this.pointInRoom(r, cx, cy),
                );
                const inheritedHeight = parent
                    ? (recintoHeights.get(parent.id) ?? parent.height)
                    : resolveRoomCeilingHeight(room, walls);
                roomHeights.set(room.id, inheritedHeight);
            }
        }

        rooms.forEach((r) =>
            this.buildRoom(
                r,
                showRoof,
                roomHeights.get(r.id) ?? r.height,
                editorScene.windows || [],
                editorScene.doors || [],
                editorScene.walls || [],
                floorNode,
                rooms,
                floorBelow,
            ),
        );
        (editorScene.walls || []).forEach((w) =>
            this.buildWall(
                w,
                editorScene.windows || [],
                editorScene.doors || [],
                rooms,
                floorNode,
            ),
        );
        (editorScene.canopies || []).forEach((c) =>
            this.buildCanopy(c, floorNode),
        );
        (editorScene.fixtures || []).forEach((f) =>
            this.buildFixtureLight(
                f,
                this.resolveFixtureRoomHeight(f, rooms, roomHeights),
                floorNode,
            ),
        );
        (editorScene.lightSwitches || []).forEach((ls) =>
            this.buildLightSwitch(ls, floorNode, editorScene.walls || [], editorScene.rooms || []),
        );
        (editorScene.electricalDevices || []).forEach((d) =>
            this.buildElectricalDevice(d, floorNode, editorScene.walls || [], editorScene.rooms || []),
        );
        this.buildConductors(
            editorScene.conductors ?? [],
            editorScene.fixtures || [],
            editorScene.lightSwitches || [],
            editorScene.electricalDevices || [],
            editorScene.rooms || [],
            editorScene.floorHeight ?? 2.7,
            floorNode,
        );
        (editorScene.doors || []).forEach((d) =>
            this.buildDoor(d, editorScene.walls || [], floorNode),
        );
        (editorScene.partitions || []).forEach((p) =>
            this.buildPartition(p, editorScene.doors || [], floorNode),
        );

        if (showIsolux && result) {
            this.buildIsolux(result, isoluxMode);
        }

        if (!sceneId) {
            this.frameCamera();
        }
    }

    public frameCamera() {
        if (!this.camera) return;
        let min = new Vector3(
            Number.MAX_VALUE,
            Number.MAX_VALUE,
            Number.MAX_VALUE,
        );
        let max = new Vector3(
            -Number.MAX_VALUE,
            -Number.MAX_VALUE,
            -Number.MAX_VALUE,
        );
        let found = false;

        this.meshMap.forEach((meshes) => {
            meshes.forEach((m) => {
                m.computeWorldMatrix(true);
                const bb = m.getBoundingInfo().boundingBox;
                min = Vector3.Minimize(min, bb.minimumWorld);
                max = Vector3.Maximize(max, bb.maximumWorld);
                found = true;
            });
        });

        if (found) {
            const center = min.add(max).scale(0.5);
            // Ignore Y for depth bounding or use full length
            const size = max.subtract(min).length();
            this.camera.setTarget(center);

            // Adjust radius but avoid getting too close
            this.camera.radius = Math.max(14, size * 1.2);
        }
    }

    // ── Isolux ────────────────────────────────────────────────────────────────
    buildIsolux(
        result: LightingResult,
        mode: IsoluxMode = 'functional',
    ) {
        if (!result.grid_rows || !result.grid_cols || !result.max_lux) return;

        // El plano/material/textura de isolux se recrean en cada resync (cada
        // edición del usuario mientras el mapa isolux está activo) — hay que
        // disponer la instancia anterior o cada resync deja un StandardMaterial
        // y un DynamicTexture huérfanos en la GPU.
        this.disposeOwnedMeshes(this.meshMap.get('isolux'));

        // El grid puede empezar en cualquier punto de la escena (no solo el
        // origen 0,0): hay que anclar el plano a grid_origin_x/y, si no la
        // isolux aparece flotando sobre el recinto equivocado cuando el
        // recinto calculado no está en el origen del mundo.
        const originX = result.grid_origin_x ?? 0;
        const originY = result.grid_origin_y ?? 0;
        const cellW = result.grid_cell_width || 0.5;
        const cellH = result.grid_cell_height || 0.5;
        const width = result.grid_cols * cellW;
        const height = result.grid_rows * cellH;
        const plane = MeshBuilder.CreatePlane(
            'isolux_plane',
            { width, height },
            this.scene,
        );
        plane.rotation.x = Math.PI / 2;
        plane.position.set(originX + width / 2, 0.015, originY + height / 2);

        const texW = result.grid_cols * 10;
        const texH = result.grid_rows * 10;
        const texture = new DynamicTexture(
            'isolux_tex',
            { width: texW, height: texH },
            this.scene,
            false,
        );
        const ctx = texture.getContext();

        const texCellW = texW / result.grid_cols;
        const texCellH = texH / result.grid_rows;

        // Limpiar
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, texW, texH);

        result.grid_values.forEach((lux, i) => {
            if (lux === null) return;

            const col = i % result.grid_cols;
            const row = Math.floor(i / result.grid_cols);

            // DynamicTexture con invertY (default) + plane.rotation.x=PI/2
            // hacen que fila 0 (Y mínimo del mundo) deba dibujarse en la
            // parte inferior del canvas para terminar en el borde correcto
            // del plano una vez rotado — ver verificación en House3DBuilder tests.
            ctx.fillStyle = this.colorForIsoluxCell(lux, result.max_lux, mode);
            ctx.fillRect(col * texCellW, texH - (row + 1) * texCellH, texCellW, texCellH);
        });

        if (mode === 'waves') {
            const levels = WAVE_LEVEL_FACTORS.map(
                (factor) => result.max_lux * factor,
            );
            const segments = buildContourSegments({
                rows: result.grid_rows,
                cols: result.grid_cols,
                values: result.grid_values,
                levels,
                pointAt: (row, col) => ({
                    x: (col + 0.5) * texCellW,
                    y: texH - (row + 0.5) * texCellH,
                }),
            });

            ctx.lineCap = 'round';
            segments.forEach((segment) => {
                ctx.beginPath();
                ctx.strokeStyle = this.waveStrokeColor(
                    segment.level,
                    result.max_lux,
                );
                ctx.lineWidth = segment.levelIndex % 2 === 0 ? 1.4 : 0.9;
                ctx.moveTo(segment.start.x, segment.start.y);
                ctx.lineTo(segment.end.x, segment.end.y);
                ctx.stroke();
            });
        }
        texture.update();

        const mat = new StandardMaterial('isolux_mat', this.scene);
        mat.diffuseTexture = texture;
        mat.emissiveTexture = texture;
        mat.alpha = 0.6;
        mat.zOffset = -1; // evita z-fighting
        plane.material = mat;

        this.meshMap.set('isolux', [plane]);
    }

    colorForIsoluxCell(lux: number, maxLux: number, mode: IsoluxMode) {
        const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));

        if (mode === 'temperature') {
            const hue = 240 - ratio * 240;
            return `hsl(${hue}, 90%, 56%)`;
        }

        if (mode === 'waves') {
            const hue = 210 - ratio * 35;
            const saturation = 65 + ratio * 15;
            const lightness = 18 + ratio * 16;
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }

        const hue = 220 - ratio * 220;
        const saturation = 85;
        const lightness = 55 - ratio * 10;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    waveStrokeColor(level: number, maxLux: number) {
        const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
        const hue = 205 - ratio * 28;
        const saturation = 90 - ratio * 12;
        const lightness = 72 - ratio * 28;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    sanitizeRoomShape(room: Room): Vector3[] {
        const uniqueVertices = room.vertices.filter((vertex, index, array) => {
            const previous =
                index === 0 ? array[array.length - 1] : array[index - 1];

            return (
                Math.hypot(vertex.x - previous.x, vertex.y - previous.y) > 1e-5
            );
        });

        if (uniqueVertices.length < 3) {
            return uniqueVertices.map(
                (vertex) => new Vector3(vertex.x, 0, vertex.y),
            );
        }

        const simplifiedVertices = uniqueVertices.filter(
            (vertex, index, array) => {
                const previous =
                    array[(index - 1 + array.length) % array.length];
                const next = array[(index + 1) % array.length];
                const cross =
                    (vertex.x - previous.x) * (next.y - vertex.y) -
                    (vertex.y - previous.y) * (next.x - vertex.x);

                return Math.abs(cross) > 1e-5;
            },
        );

        return simplifiedVertices.map(
            (vertex) => new Vector3(vertex.x, 0, vertex.y),
        );
    }

    getRoomBounds(room: Room) {
        const xs = room.vertices.map((vertex) => vertex.x);
        const ys = room.vertices.map((vertex) => vertex.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        };
    }

    /**
     * Expande cada vértice del polígono hacia afuera en `amount` metros.
     * Usa la dirección miter en cada esquina calculada a partir de las normales de los segmentos,
     * detectando correctamente la orientación (winding) del polígono.
     */
    expandPolygonShape(shape: Vector3[], amount: number): Vector3[] {
        const n = shape.length;
        if (n < 3) return shape;

        // Calcular el área signada para determinar el winding (CW vs CCW) en el plano XZ
        let signedArea = 0;
        for (let i = 0; i < n; i++) {
            const v1 = shape[i];
            const v2 = shape[(i + 1) % n];
            signedArea += (v2.x - v1.x) * (v2.z + v1.z);
        }
        const isCCW = signedArea < 0;

        return shape.map((v, i) => {
            const prev = shape[(i - 1 + n) % n];
            const next = shape[(i + 1) % n];

            const d1x = v.x - prev.x,
                d1z = v.z - prev.z;
            const d2x = next.x - v.x,
                d2z = next.z - v.z;

            const len1 = Math.hypot(d1x, d1z) || 1;
            const len2 = Math.hypot(d2x, d2z) || 1;

            const u1x = d1x / len1,
                u1z = d1z / len1;
            const u2x = d2x / len2,
                u2z = d2z / len2;

            // Normales apuntando hacia AFUERA según el winding
            let n1x, n1z, n2x, n2z;
            if (isCCW) {
                n1x = u1z;
                n1z = -u1x;
                n2x = u2z;
                n2z = -u2x;
            } else {
                n1x = -u1z;
                n1z = u1x;
                n2x = -u2z;
                n2z = u2x;
            }

            // Miter (bisectriz): suma de las dos normales salientes
            let mx = n1x + n2x,
                mz = n1z + n2z;
            let mlen = Math.hypot(mx, mz);

            if (mlen < 1e-5) {
                mx = n1x;
                mz = n1z;
                mlen = 1;
            }

            mx /= mlen;
            mz /= mlen;

            // factor = amount / cos(theta/2)
            let cosThetaOver2 = mx * n1x + mz * n1z;
            if (Math.abs(cosThetaOver2) < 0.1)
                cosThetaOver2 = 0.1 * Math.sign(cosThetaOver2) || 0.1;

            const scale = amount / cosThetaOver2;

            return new Vector3(v.x + mx * scale, 0, v.z + mz * scale);
        });
    }

    pointInRoom(room: Room, x: number, y: number): boolean {
        let inside = false;
        const vertices = room.vertices;

        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const vi = vertices[i];
            const vj = vertices[j];
            const intersects =
                vi.y > y !== vj.y > y &&
                x < ((vj.x - vi.x) * (y - vi.y)) / (vj.y - vi.y || 1e-9) + vi.x;

            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }

    resolveFixtureRoomHeight(
        fixture: Fixture,
        rooms: Room[],
        roomHeights: Map<string, number>,
    ): number | undefined {
        const room =
            rooms.find((candidate) => candidate.id === fixture.roomId) ??
            rooms.find((candidate) =>
                this.pointInRoom(candidate, fixture.x, fixture.y),
            );

        return room ? roomHeights.get(room.id) : undefined;
    }

    resolveDisplayElevations(
        floors: EditorScene[],
        showRoof: boolean,
    ): Map<string, number> {
        const displayElevations = new Map<string, number>();
        const above = floors.filter((floor) => (floor.floorIndex ?? 0) >= 0);
        const below = floors
            .filter((floor) => (floor.floorIndex ?? 0) < 0)
            .sort((a, b) => (b.floorIndex ?? 0) - (a.floorIndex ?? 0));

        let elevation = 0;
        for (const floor of above) {
            displayElevations.set(floor.id, elevation);
            elevation += this.resolveSceneStackHeight(floor, showRoof);
        }

        elevation = 0;
        for (const floor of below) {
            elevation -= this.resolveSceneStackHeight(floor, showRoof);
            displayElevations.set(floor.id, elevation);
        }

        return displayElevations;
    }

    resolveSceneStackHeight(
        editorScene: EditorScene,
        showRoof: boolean,
    ): number {
        const rooms = editorScene.rooms || [];
        const walls = editorScene.walls || [];
        // Always include at least a minimal slab thickness between floors so that
        // floors are visually separated (no z-fighting or gaps when showRoof=false).
        const slabThickness = DEFAULT_STRUCTURAL_SLAB_THICKNESS;
        const roomHeight = rooms.reduce((maxHeight, room) => {
            // Stairs are internal objects — they must NOT push the floor stack height
            // beyond the tallest regular room. If the stair is interFloor, it connects
            // to the next floor but its height is bounded by the room that contains it.
            if (room.roomType === 'stair') {
                // Contribute only the stair's own room height (same as its parent recinto)
                return Math.max(maxHeight, resolveRoomCeilingHeight(room, walls));
            }

            return Math.max(
                maxHeight,
                getFloorToFloorStackHeight(
                    resolveRoomCeilingHeight(room, walls),
                    slabThickness,
                ),
            );
        }, 0);

        return Math.max(0.05, roomHeight);
    }

    resolveStairHeight(room: Room): number {
        const cfg = room.stairConfig;
        const startElevation = cfg?.startElevation ?? 0;

        if (!cfg) {
            return Math.max(0.05, room.height);
        }

        if (cfg.flights.length > 0) {
            const risers = cfg.flights.reduce(
                (total, flight) => total + Math.max(0, flight.stepCount),
                0,
            );

            return Math.max(0.05, startElevation + risers * cfg.riserHeight);
        }

        return Math.max(
            0.05,
            startElevation + Math.max(1, cfg.stepCount) * cfg.riserHeight,
        );
    }

    getRoomStairHoles(room: Room, rooms: Room[]): Vector3[][] {
        return rooms
            .filter((candidate) => candidate.roomType === 'stair')
            .filter((candidate) => candidate.id !== room.id)
            .filter((candidate) => {
                return candidate.vertices.some(v => this.pointInRoom(room, v.x, v.y)) ||
                       room.vertices.some(v => this.pointInRoom(candidate, v.x, v.y));
            })
            .map((stair) =>
                this.expandPolygonShape(this.sanitizeRoomShape(stair), -0.01),
            )
            .filter((hole) => hole.length >= 3);
    }

    getRoomCenter(room: Room): { x: number; y: number } {
        return {
            x:
                room.vertices.reduce((sum, vertex) => sum + vertex.x, 0) /
                room.vertices.length,
            y:
                room.vertices.reduce((sum, vertex) => sum + vertex.y, 0) /
                room.vertices.length,
        };
    }

    isEdgeSharedWithOtherRoom(
        v1: { x: number; z: number },
        v2: { x: number; z: number },
        myRoomId: string,
        allRooms: Room[]
    ): boolean {
        const EPSILON = 0.05; // 5 cm de tolerancia

        const segmentsOverlap = (
            a1: { x: number; z: number },
            a2: { x: number; z: number },
            b1: { x: number; z: number },
            b2: { x: number; z: number }
        ) => {
            if (
                Math.max(a1.x, a2.x) < Math.min(b1.x, b2.x) - EPSILON ||
                Math.min(a1.x, a2.x) > Math.max(b1.x, b2.x) + EPSILON ||
                Math.max(a1.z, a2.z) < Math.min(b1.z, b2.z) - EPSILON ||
                Math.min(a1.z, a2.z) > Math.max(b1.z, b2.z) + EPSILON
            ) {
                return false;
            }

            const cross = (a2.x - a1.x) * (b2.z - b1.z) - (a2.z - a1.z) * (b2.x - b1.x);
            if (Math.abs(cross) > EPSILON) return false;

            const lenSq = (a2.x - a1.x) ** 2 + (a2.z - a1.z) ** 2;
            if (lenSq < 0.0001) return false;
            const t = ((b1.x - a1.x) * (a2.x - a1.x) + (b1.z - a1.z) * (a2.z - a1.z)) / lenSq;
            
            const projX = a1.x + t * (a2.x - a1.x);
            const projZ = a1.z + t * (a2.z - a1.z);
            const distSq = (b1.x - projX) ** 2 + (b1.z - projZ) ** 2;
            if (distSq > EPSILON * EPSILON) return false;

            const isHorizontal = Math.abs(a2.x - a1.x) > Math.abs(a2.z - a1.z);
            const aMin = isHorizontal ? Math.min(a1.x, a2.x) : Math.min(a1.z, a2.z);
            const aMax = isHorizontal ? Math.max(a1.x, a2.x) : Math.max(a1.z, a2.z);
            const bMin = isHorizontal ? Math.min(b1.x, b2.x) : Math.min(b1.z, b2.z);
            const bMax = isHorizontal ? Math.max(b1.x, b2.x) : Math.max(b1.z, b2.z);

            const overlapMin = Math.max(aMin, bMin);
            const overlapMax = Math.min(aMax, bMax);

            return overlapMax - overlapMin > 0.1;
        };

        for (const r of allRooms) {
            if (r.id === myRoomId) continue;
            const pts = this.sanitizeRoomShape(r);
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                if (segmentsOverlap(v1, v2, p1, p2)) {
                    return true;
                }
            }
        }
        return false;
    }

    buildRoomFallback(
        room: Room,
        meshes: Mesh[],
        showRoof: boolean,
        ceilingHeight: number,
    ) {
        const bounds = this.getRoomBounds(room);
        const width = Math.max(0.1, bounds.maxX - bounds.minX);
        const depth = Math.max(0.1, bounds.maxY - bounds.minY);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minY + bounds.maxY) / 2;

        const floor = MeshBuilder.CreateBox(
            `floor_fallback_${room.id}`,
            { width, depth, height: 0.05 },
            this.scene,
        );
        floor.position.set(centerX, -0.025, centerZ);
        floor.material = this.matFloor;
        floor.receiveShadows = true;
        meshes.push(floor);

        // Paredes perimetrales también en fallback (para Recinto y Pasadizo)
        const WALL_THICKNESS = 0.2;
        const verts = room.vertices;
        for (let i = 0; i < verts.length; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % verts.length];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (segLen < 0.01) continue;
            const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const cx = (v1.x + v2.x) / 2;
            const cz = (v1.y + v2.y) / 2;
            const wallBox = MeshBuilder.CreateBox(
                `recinto_wall_fb_${room.id}_${i}`,
                {
                    width: segLen + WALL_THICKNESS,
                    height: ceilingHeight,
                    depth: WALL_THICKNESS,
                },
                this.scene,
            );
            wallBox.position.set(cx, ceilingHeight / 2, cz);
            wallBox.rotation.y = -angle;
            wallBox.material = this.matWall;
            wallBox.receiveShadows = true;
            this.shadowGen?.addShadowCaster(wallBox);
            meshes.push(wallBox);
        }

        if (showRoof) {
            const ceiling = MeshBuilder.CreateBox(
                `ceiling_fallback_${room.id}`,
                { width, depth, height: 0.2 },
                this.scene,
            );
            // Centro de la caja a height/2 (0.10) por encima de ceilingHeight
            ceiling.position.set(centerX, ceilingHeight + 0.1, centerZ);
            ceiling.material = this.matCeiling;
            meshes.push(ceiling);

            // Borde perimetral del techo para cubrir paredes en fallback
            for (let i = 0; i < verts.length; i++) {
                const v1 = verts[i];
                const v2 = verts[(i + 1) % verts.length];
                const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
                if (segLen < 0.01) continue;
                const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
                const cx = (v1.x + v2.x) / 2;
                const cz = (v1.y + v2.y) / 2;
                const roofEdge = MeshBuilder.CreateBox(
                    `recinto_roof_edge_fb_${room.id}_${i}`,
                    {
                        width: segLen + WALL_THICKNESS,
                        height: 0.2,
                        depth: WALL_THICKNESS,
                    },
                    this.scene,
                );
                roofEdge.position.set(cx, ceilingHeight + 0.1, cz);
                roofEdge.rotation.y = -angle;
                roofEdge.material = this.matCeiling;
                meshes.push(roofEdge);
            }
        }
    }

    // ── Recinto (Room) y Pasadizo (Corridor) ─────────────────────────────────
    /**
     * Estrategia de renderizado por tipo:
     *   'room'     → piso + paredes exteriores + techo opcional alineado al perímetro
     *   'corridor' → losa de voladizo anclada a la misma altura del techo del recinto
     *                que lo contiene (la cara INFERIOR de la losa = ceilingHeight)
     *
     * Nota sobre CreatePolygon en Babylon.js:
     *   El polígono se crea con la cara «frontal» en Y=0 y crece hacia +Y con
     *   el parámetro `depth`. Por tanto:
     *     - cara inferior = position.y
     *     - cara superior = position.y + depth
     */
    buildRoom(
        room: Room,
        showRoof: boolean,
        ceilingHeight: number = room.height,
        allWindows: Window[] = [],
        allDoors: Door[] = [],
        allWalls: Wall[] = [],
        floorNode?: TransformNode,
        allRooms: Room[] = [],
        floorBelow?: EditorScene,
    ) {
        const meshes: Mesh[] = [];

        if (room.vertices.length < 3) return;

        const shape = this.sanitizeRoomShape(room);
        if (shape.length < 3) {
            if (!this.warnedInvalidRooms.has(room.id)) {
                this.warnedInvalidRooms.add(room.id);
                console.warn(
                    `Room ${room.id}: invalid polygon, using bounds fallback`,
                );
            }
            this.buildRoomFallback(room, meshes, showRoof, ceilingHeight);
            this.meshMap.set(room.id, meshes);
            return;
        }

        /**
         * Grosor de la losa tanto del techo del recinto como del pasadizo.
         * Ambos deben usar el mismo valor para que queden nivelados.
         */
        const SLAB_THICKNESS = 0.2;
        const EXTERIOR_WALL_THICKNESS = 0.2; // 20 cm — pared exterior estándar

        if (room.roomType === 'corridor') {
            const corridorType = room.corridorConfig?.type ?? 'roof_only';
            const renderFlags = getCorridorRenderFlags(corridorType);
            const corridorShape = this.expandPolygonShape(
                shape,
                EXTERIOR_WALL_THICKNESS / 2,
            );
            const floorThickness = 0.05;
            // ── BEREDA / RAMPA ─────────────────────────────────────────────────
            if (corridorType === 'ramp') {
                const rampSlopePercent = room.corridorConfig?.rampSlope ?? 8;
                const rampDirection = room.corridorConfig?.rampDirection ?? 'north';
                const bounds = this.getRoomBounds(room);
                const rampW = Math.max(0.1, bounds.maxX - bounds.minX);
                const rampD = Math.max(0.1, bounds.maxY - bounds.minY);
                const rampCx = (bounds.minX + bounds.maxX) / 2;
                const rampCz = (bounds.minY + bounds.maxY) / 2;

                // Slope angle from percentage (e.g., 8% → arctan(0.08))
                const slopeAngle = Math.atan(rampSlopePercent / 100);

                // Height difference across the ramp span
                const isNS = rampDirection === 'north' || rampDirection === 'south';
                const rampSpan = isNS ? rampD : rampW;
                const rampHeightDiff = rampSpan * Math.tan(slopeAngle);

                // Build ramp as a flat box, then rotate it around the appropriate axis
                const rampFloor = MeshBuilder.CreateBox(
                    `ramp_floor_${room.id}`,
                    { width: rampW, height: floorThickness, depth: rampD },
                    this.scene,
                );
                rampFloor.position.set(rampCx, rampHeightDiff / 2, rampCz);
                if (rampDirection === 'north' || rampDirection === 'south') {
                    rampFloor.rotation.x =
                        rampDirection === 'south' ? slopeAngle : -slopeAngle;
                } else {
                    rampFloor.rotation.z =
                        rampDirection === 'east' ? -slopeAngle : slopeAngle;
                }
                rampFloor.material = this.matFloor;
                rampFloor.receiveShadows = true;
                meshes.push(rampFloor);

                // Railings along the ramp sides
                const railingHeight = room.corridorConfig?.railingHeight ?? 1.0;
                const RAIL_THICKNESS = 0.05;
                const topOfRamp = rampHeightDiff;

                // Two side rails (left & right of ramp direction)
                const railPositions = isNS
                    ? [bounds.minX + RAIL_THICKNESS / 2, bounds.maxX - RAIL_THICKNESS / 2]
                    : [bounds.minY + RAIL_THICKNESS / 2, bounds.maxY - RAIL_THICKNESS / 2];

                for (const railPos of railPositions) {
                    const rail = MeshBuilder.CreateBox(
                        `ramp_rail_${room.id}_${railPos}`,
                        {
                            width: isNS ? RAIL_THICKNESS : rampW,
                            height: railingHeight,
                            depth: isNS ? rampD : RAIL_THICKNESS,
                        },
                        this.scene,
                    );
                    rail.position.set(
                        isNS ? railPos : rampCx,
                        topOfRamp / 2 + railingHeight / 2,
                        isNS ? rampCz : railPos,
                    );
                    if (isNS) {
                        rail.rotation.x =
                            rampDirection === 'south' ? slopeAngle : -slopeAngle;
                    } else {
                        rail.rotation.z =
                            rampDirection === 'east' ? -slopeAngle : slopeAngle;
                    }
                    rail.material = this.matFrame;
                    meshes.push(rail);
                }

                this.meshMap.set(room.id, meshes);
                meshes.forEach((m) => {
                    if (floorNode) m.parent = floorNode;
                });
                return;
            }

            // ── Pasadizo: losa de voladizo — se activa/desactiva con showRoof ──
            //
            // CreatePolygon extruda hacia -Y. position.y = ceilingHeight + SLAB_THICKNESS
            // coloca la cara inferior exactamente en ceilingHeight (tope de paredes).
            // Se expande el polígono en EXTERIOR_WALL_THICKNESS / 2 para sellar
            // contra las paredes del recinto sin juntas visibles.
            const floorHoles = floorBelow ? this.getRoomStairHoles(room, floorBelow.rooms || []) : [];
            floorHoles.push(...this.getRoomStairHoles(room, allRooms));

            if (renderFlags.hasFloor) {
                try {
                    const floor = MeshBuilder.CreatePolygon(
                        `pasadizo_floor_${room.id}`,
                        {
                            shape: corridorShape,
                            holes: floorHoles,
                            depth: floorThickness,
                            sideOrientation: Mesh.DOUBLESIDE,
                        },
                        this.scene,
                    );
                    if (corridorType === 'sidewalk') {
                        floor.position.y = 0.01;
                        floor.material = this.matPasadizoSlab;
                    } else {
                        floor.position.y = -floorThickness / 2;
                        floor.material = this.matFloor;
                    }
                    floor.receiveShadows = true;
                    meshes.push(floor);
                } catch {
                    const bounds = this.getRoomBounds(room);
                    const floor = MeshBuilder.CreateBox(
                        `pasadizo_floor_fb_${room.id}`,
                        {
                            width: Math.max(0.1, bounds.maxX - bounds.minX),
                            height: floorThickness,
                            depth: Math.max(0.1, bounds.maxY - bounds.minY),
                        },
                        this.scene,
                    );
                    floor.position.set(
                        (bounds.minX + bounds.maxX) / 2,
                        -floorThickness / 2,
                        (bounds.minY + bounds.maxY) / 2,
                    );
                    floor.material = this.matFloor;
                    floor.receiveShadows = true;
                    meshes.push(floor);
                }
            }

            if (!showRoof || !renderFlags.hasRoof) {
                this.meshMap.set(room.id, meshes);
                meshes.forEach((m) => {
                    if (floorNode) m.parent = floorNode;
                });
                return;
            }

            try {
                const slab = MeshBuilder.CreatePolygon(
                    `pasadizo_slab_${room.id}`,
                    {
                        shape: corridorShape,
                        holes: floorHoles,
                        depth: SLAB_THICKNESS,
                        sideOrientation: Mesh.DOUBLESIDE,
                    },
                    this.scene,
                );
                slab.position.y = ceilingHeight + SLAB_THICKNESS + 0.002;
                slab.material = this.matPasadizoSlab;
                slab.receiveShadows = true;
                this.shadowGen?.addShadowCaster(slab);
                meshes.push(slab);
            } catch {
                if (!this.warnedInvalidRooms.has(room.id)) {
                    this.warnedInvalidRooms.add(room.id);
                    console.warn(
                        `Pasadizo ${room.id}: polygon mesh failed, using box fallback`,
                    );
                }
                const bounds = this.getRoomBounds(room);
                const w =
                    Math.max(0.1, bounds.maxX - bounds.minX) +
                    EXTERIOR_WALL_THICKNESS;
                const d =
                    Math.max(0.1, bounds.maxY - bounds.minY) +
                    EXTERIOR_WALL_THICKNESS;
                const bcx = (bounds.minX + bounds.maxX) / 2;
                const bcz = (bounds.minY + bounds.maxY) / 2;
                const fallbackSlab = MeshBuilder.CreateBox(
                    `pasadizo_slab_fb_${room.id}`,
                    { width: w, height: SLAB_THICKNESS, depth: d },
                    this.scene,
                );
                fallbackSlab.position.set(
                    bcx,
                    ceilingHeight + SLAB_THICKNESS / 2 + 0.002,
                    bcz,
                );
                fallbackSlab.material = this.matPasadizoSlab;
                fallbackSlab.receiveShadows = true;
                this.shadowGen?.addShadowCaster(fallbackSlab);
                meshes.push(fallbackSlab);
            }

            if (renderFlags.railingMaterial) {
                const railingHeight = room.corridorConfig?.railingHeight ?? 1.05;
                const railMaterial =
                    renderFlags.railingMaterial === 'concrete'
                        ? this.matWall
                        : this.matFrame;
                const railBaseY = floorThickness / 2;
                const railTopY = railBaseY + railingHeight;

                for (let i = 0; i < shape.length; i++) {
                    const v1 = shape[i];
                    const v2 = shape[(i + 1) % shape.length];
                    const segLen = Math.hypot(v2.x - v1.x, v2.z - v1.z);
                    if (segLen < 0.05) continue;

                    // Si este segmento del pasadizo/rampa toca a otro ambiente (ej. escalera o pasadizo),
                    // NO dibujamos baranda para permitir el ingreso fluido.
                    if (this.isEdgeSharedWithOtherRoom(v1, v2, room.id, allRooms)) {
                        continue;
                    }

                    const angle = Math.atan2(v2.z - v1.z, v2.x - v1.x);
                    const cx = (v1.x + v2.x) / 2;
                    const cz = (v1.z + v2.z) / 2;

                    if (renderFlags.railingMaterial === 'concrete') {
                        const rail = MeshBuilder.CreateBox(
                            `pasadizo_rail_concrete_${room.id}_${i}`,
                            {
                                width: segLen,
                                height: railingHeight,
                                depth: 0.12,
                            },
                            this.scene,
                        );
                        rail.position.set(
                            cx,
                            railBaseY + railingHeight / 2,
                            cz,
                        );
                        rail.rotation.y = -angle;
                        rail.material = railMaterial;
                        rail.receiveShadows = true;
                        this.shadowGen?.addShadowCaster(rail);
                        meshes.push(rail);
                    } else {
                        const topRail = MeshBuilder.CreateBox(
                            `pasadizo_rail_metal_${room.id}_${i}`,
                            { width: segLen, height: 0.05, depth: 0.05 },
                            this.scene,
                        );
                        topRail.position.set(cx, railTopY, cz);
                        topRail.rotation.y = -angle;
                        topRail.material = railMaterial;
                        meshes.push(topRail);

                        const postCount = Math.max(2, Math.ceil(segLen / 1.2));
                        for (let p = 0; p <= postCount; p++) {
                            const t = p / postCount;
                            const px = v1.x + (v2.x - v1.x) * t;
                            const pz = v1.z + (v2.z - v1.z) * t;
                            const post = MeshBuilder.CreateBox(
                                `pasadizo_post_metal_${room.id}_${i}_${p}`,
                                {
                                    width: 0.05,
                                    height: railingHeight,
                                    depth: 0.05,
                                },
                                this.scene,
                            );
                            post.position.set(
                                px,
                                railBaseY + railingHeight / 2,
                                pz,
                            );
                            post.rotation.y = -angle;
                            post.material = railMaterial;
                            meshes.push(post);
                        }
                    }
                }
            }

            this.meshMap.set(room.id, meshes);
            meshes.forEach((m) => {
                if (floorNode) m.parent = floorNode;
            });
            return;
        }

        // ── Escalera: escalones apilados, descansos y pasamanos ──────────────────────
        if (room.roomType === 'stair') {
            const bounds = this.getRoomBounds(room);
            const stairW = Math.max(0.5, bounds.maxX - bounds.minX);
            const stairD = Math.max(0.5, bounds.maxY - bounds.minY);
            const stairCx = (bounds.minX + bounds.maxX) / 2;
            const stairCz = (bounds.minY + bounds.maxY) / 2;

            // Elevación de arranque (para escaleras que comienzan desde un descanso intermedio)
            const startElev = room.stairConfig?.startElevation ?? 0;

            // Only create a base slab if hasBaseSlab is not explicitly false.
            // hasBaseSlab defaults to true for stairs connecting floors.
            const shouldCreateBaseSlab = room.stairConfig?.hasBaseSlab !== false;

            // We no longer create a massive stairFloor or fill box covering the entire stair bounds.
            // Support is provided by the individual inclined slabs and landings.

            // ── Helper: crear pasamano a lo largo de un tramo ─────────────────
            const addRail = (
                x0: number,
                z0: number,
                x1: number,
                z1: number,
                yBase: number,
                yTop: number,
                id: string,
            ) => {
                const RAIL_H = 0.9; // altura sobre el escalón
                const RAIL_R = 0.04; // grosor del pasamano
                const POST_W = 0.05;
                const railY = yTop + RAIL_H;
                const len = Math.hypot(x1 - x0, z1 - z0);
                const angle = Math.atan2(z1 - z0, x1 - x0);
                const cx = (x0 + x1) / 2;
                const cz = (z0 + z1) / 2;

                // Barra horizontal del pasamano
                const bar = MeshBuilder.CreateBox(
                    `rail_bar_${id}`,
                    { width: len, height: RAIL_R, depth: RAIL_R },
                    this.scene,
                );
                bar.position.set(cx, railY, cz);
                bar.rotation.y = -angle;
                bar.material = this.matFrame;
                if (floorNode) bar.parent = floorNode;
                meshes.push(bar);

                // Poste inicial
                const post0 = MeshBuilder.CreateBox(
                    `rail_post0_${id}`,
                    { width: POST_W, height: railY - yBase, depth: POST_W },
                    this.scene,
                );
                post0.position.set(x0, yBase + (railY - yBase) / 2, z0);
                post0.material = this.matFrame;
                if (floorNode) post0.parent = floorNode;
                meshes.push(post0);

                // Poste final
                const post1 = MeshBuilder.CreateBox(
                    `rail_post1_${id}`,
                    {
                        width: POST_W,
                        height: railY - yTop + RAIL_H,
                        depth: POST_W,
                    },
                    this.scene,
                );
                post1.position.set(
                    x1,
                    yTop + (railY - yTop + RAIL_H) / 2 - RAIL_H / 2,
                    z1,
                );
                post1.material = this.matFrame;
                if (floorNode) post1.parent = floorNode;
                meshes.push(post1);
            };

            if (room.stairConfig && room.stairConfig.flights.length > 0) {
                const cfg = room.stairConfig;
                const tread = cfg.treadDepth;
                
                const totalSteps = cfg.flights.reduce((sum, f) => sum + f.stepCount, 0);
                const isInterFloor = cfg.isInterFloor !== false;
                const totalHeight = isInterFloor ? ceilingHeight + SLAB_THICKNESS - startElev : ceilingHeight - startElev;
                // Ajuste matemático exacto para que la escalera conecte perfectamente con el siguiente nivel
                const riser = totalSteps > 0 ? totalHeight / totalSteps : cfg.riserHeight;
                
                const showRailings = cfg.showRailings ?? false;
                const isUStair =
                    cfg.flights.length === 2 &&
                    (() => {
                        const d0 = cfg.flights[0].direction;
                        const d1 = cfg.flights[1].direction;
                        return (
                            (d0 === 'north' && d1 === 'south') ||
                            (d0 === 'south' && d1 === 'north') ||
                            (d0 === 'east' && d1 === 'west') ||
                            (d0 === 'west' && d1 === 'east')
                        );
                    })();
                const uLandingDepth = isUStair
                    ? (cfg.flights.find(
                          (f) => f.hasLanding && f.landingDepth > 0,
                      )?.landingDepth ?? 0)
                    : 0;

                // ── Distribuir tramos en carriles según su eje ─────────────────
                // Tramos N/S se apilan en X; tramos E/W se apilan en Z.
                // Ejemplo: 2 tramos N/S → carril 0 en la mitad izquierda, carril 1 en la derecha.
                const nsCount = cfg.flights.filter(
                    (f) => f.direction === 'north' || f.direction === 'south',
                ).length;
                const ewCount = cfg.flights.filter(
                    (f) => f.direction === 'east' || f.direction === 'west',
                ).length;
                let nsLane = 0;
                let ewLane = 0;
                const nsLanes = getStairLaneLayout(
                    stairW,
                    nsCount,
                    cfg.stairWidth,
                    cfg.flightGap,
                    isUStair,
                );
                const ewLanes = getStairLaneLayout(
                    stairD,
                    ewCount,
                    cfg.stairWidth,
                    cfg.flightGap,
                    isUStair,
                );

                // Cursor de posición y altura
                const firstDir = cfg.flights[0].direction;
                let cursorZ =
                    firstDir === 'north'
                        ? stairCz + stairD / 2
                        : stairCz - stairD / 2;
                let cursorX =
                    firstDir === 'west'
                        ? stairCx + stairW / 2
                        : stairCx - stairW / 2;
                let cursorH = 0; // altura relativa al startElev

                for (let f = 0; f < cfg.flights.length; f++) {
                    const flight = cfg.flights[f];
                    if (flight.stepCount <= 0) continue;

                    const isNS =
                        flight.direction === 'north' ||
                        flight.direction === 'south';
                    const signZ = flight.direction === 'south' ? +1 : -1;
                    const signX = flight.direction === 'east' ? +1 : -1;
                    const fittedTread = isUStair
                        ? getFittedStairTreadDepth(
                              isNS ? stairD : stairW,
                              flight.stepCount,
                              tread,
                              uLandingDepth,
                          )
                        : tread;

                    // Centro del carril en el eje perpendicular al movimiento
                    let flightCx: number;
                    let flightCz: number;
                    let laneStepW: number;

                    if (isNS) {
                        // Dividir ancho de habitación entre todos los tramos N/S
                        const lane = nsLanes[nsLane] ?? nsLanes[0];
                        flightCx = bounds.minX + lane.center;
                        flightCz = stairCz; // irrelevante, se usa cursorZ
                        laneStepW = lane.width;
                        nsLane++;
                    } else {
                        // Dividir profundidad entre todos los tramos E/W
                        const lane = ewLanes[ewLane] ?? ewLanes[0];
                        flightCx = stairCx;
                        flightCz = bounds.minY + lane.center;
                        laneStepW = lane.width;
                        ewLane++;
                    }

                    // Primera y última posición del tramo (para el pasamano)
                    const hStart = startElev + cursorH;
                    let firstSZ = 0,
                        firstSX = 0,
                        lastSZ = 0,
                        lastSX = 0;

                    for (let s = 0; s < flight.stepCount; s++) {
                        cursorH += riser;
                        const sZ = isNS
                            ? cursorZ + signZ * (s + 0.5) * fittedTread
                            : flightCz;
                        const sX = isNS
                            ? flightCx
                            : cursorX + signX * (s + 0.5) * fittedTread;

                        if (s === 0) {
                            firstSZ = sZ;
                            firstSX = sX;
                        }
                        if (s === flight.stepCount - 1) {
                            lastSZ = sZ;
                            lastSX = sX;
                        }

                        // Bug #6: color-code first step (entry=green) and last step (exit=yellow)
                        const isEntryStep = f === 0 && s === 0;
                        const isExitStep =
                            f === cfg.flights.length - 1 &&
                            s === flight.stepCount - 1;

                        const isInterFloor = cfg.isInterFloor !== false; // defaults to true
                        const maxStairHeight = isInterFloor ? ceilingHeight + SLAB_THICKNESS : ceilingHeight;
                        
                        // Bug #3: clamp step height so stairs never penetrate the next floor
                        const clampedCursorH = Math.min(cursorH, maxStairHeight - startElev);
                        // Extend bottomFaceY down by 5cm so the step box merges smoothly into the tilted slab
                        const bottomFaceY = startElev + cursorH - riser - 0.05;
                        const topFaceY = startElev + clampedCursorH;
                        const stepThickness = Math.max(0.01, topFaceY - bottomFaceY);

                        const step = MeshBuilder.CreateBox(
                            `stair_step_${room.id}_${f}_${s}`,
                            {
                                width: isNS ? laneStepW : fittedTread,
                                height: stepThickness,
                                depth: isNS ? fittedTread : laneStepW,
                            },
                            this.scene,
                        );
                        step.position.set(sX, bottomFaceY + stepThickness / 2, sZ);
                        if (isEntryStep) {
                            step.material = this.getOrCreateStairMarkerMat('entry');
                        } else if (isExitStep) {
                            step.material = this.getOrCreateStairMarkerMat('exit');
                        } else {
                            step.material = this.matWall;
                        }
                        step.receiveShadows = true;
                        this.shadowGen?.addShadowCaster(step);
                        if (floorNode) step.parent = floorNode;
                        meshes.push(step);
                    }

                    // Pasamano lateral (borde exterior del carril)
                    const railOffX = isNS ? laneStepW / 2 : 0;
                    const railOffZ = isNS ? 0 : laneStepW / 2;
                    if (showRailings) {
                        addRail(
                            firstSX + railOffX,
                            firstSZ + railOffZ,
                            lastSX + railOffX,
                            lastSZ + railOffZ,
                            hStart,
                            startElev + cursorH,
                            `${room.id}_${f}`,
                        );
                    }

                    // ── Losa inclinada estructural del tramo ─────────────────────
                    if (shouldCreateBaseSlab) {
                        const SLAB_T = 0.15; // 15cm
                        const flightLen = flight.stepCount * fittedTread;
                        const flightH = cursorH - (hStart - startElev);
                        const slope = Math.atan2(flightH, flightLen);
                        const slabLen = Math.hypot(flightLen, flightH);
                        
                        const slab = MeshBuilder.CreateBox(
                            `stair_slab_${room.id}_${f}`,
                            {
                                width: isNS ? laneStepW : slabLen,
                                height: SLAB_T,
                                depth: isNS ? slabLen : laneStepW,
                            },
                            this.scene
                        );
                        
                        const midX = (firstSX + lastSX) / 2;
                        const midZ = (firstSZ + lastSZ) / 2;
                        // Posicionar debajo del escalón (restando SLAB_T/2 y ajustando por el riser)
                        const midY = startElev + (cursorH - flightH) + flightH / 2 - riser / 2 - (SLAB_T / 2) * Math.cos(slope);
                        slab.position.set(midX, midY, midZ);
                        
                        if (isNS) {
                            slab.rotation.x = signZ > 0 ? slope : -slope;
                        } else {
                            // Left-handed Z rotation: positive angle rotates +X to +Y (up)
                            slab.rotation.z = signX > 0 ? slope : -slope;
                        }
                        slab.material = this.matWall;
                        slab.receiveShadows = true;
                        if (floorNode) slab.parent = floorNode;
                        meshes.push(slab);
                    }

                    // Avanzar cursor al final del tramo
                    if (isNS) cursorZ += signZ * flight.stepCount * fittedTread;
                    else cursorX += signX * flight.stepCount * fittedTread;

                    // ── Descanso entre tramos ──────────────────────────────────
                    if (flight.hasLanding && flight.landingDepth > 0) {
                        const lD = flight.landingDepth;
                        const landH = cursorH; // tope del descanso
                        const landThickness = 0.15;
                        const lX = isNS ? stairCx : cursorX + (signX * lD) / 2;
                        const lZ = isNS ? cursorZ + (signZ * lD) / 2 : stairCz;
                        
                        // Losa del descanso
                        const landing = MeshBuilder.CreateBox(
                            `stair_landing_${room.id}_${f}`,
                            {
                                width: isNS ? stairW : lD,
                                height: landThickness,
                                depth: isNS ? lD : stairD,
                            },
                            this.scene,
                        );
                        landing.position.set(lX, startElev + landH - landThickness / 2, lZ);
                        landing.material = this.matFloor;
                        landing.receiveShadows = true;
                        this.shadowGen?.addShadowCaster(landing);
                        if (floorNode) landing.parent = floorNode;
                        meshes.push(landing);

                        const landingCursorOffset = getPostLandingCursorOffset(
                            lD,
                            isNS ? signZ : signX,
                            isUStair,
                        );
                        if (isNS) cursorZ += landingCursorOffset;
                        else cursorX += landingCursorOffset;
                    }
                }
            } else {
                // ── Escalera sin tramos: escalones simples en la dirección config ──
                const cfg = room.stairConfig;
                const showRailings = cfg?.showRailings ?? false;
                const stepW = Math.min(cfg?.stairWidth ?? stairW, stairW);
                const orient = cfg?.orientation ?? 'south';
                
                const isInterFloor = cfg?.isInterFloor !== false;
                const totalHeight = isInterFloor ? ceilingHeight + SLAB_THICKNESS - startElev : ceilingHeight - startElev;
                const riserCfg = cfg?.riserHeight ?? 0.175;
                const numSteps = cfg?.stepCount ?? Math.max(1, Math.round(totalHeight / riserCfg));
                const riser = numSteps > 0 ? totalHeight / numSteps : riserCfg;
                const tread = cfg?.treadDepth ?? 0.28;

                const isNS = orient === 'north' || orient === 'south';
                const signZ = orient === 'south' ? +1 : -1;
                const signX = orient === 'east' ? +1 : -1;
                const startZ =
                    orient === 'north'
                        ? stairCz + stairD / 2
                        : stairCz - stairD / 2;
                const startX =
                    orient === 'west'
                        ? stairCx + stairW / 2
                        : stairCx - stairW / 2;
                const actualTread = isNS
                    ? Math.min(tread, stairD / numSteps)
                    : Math.min(tread, stairW / numSteps);

                let firstSX = 0,
                    firstSZ = 0,
                    lastSX = 0,
                    lastSZ = 0;

                const maxStairHeight = isInterFloor ? ceilingHeight + SLAB_THICKNESS : ceilingHeight;

                for (let s = 0; s < numSteps; s++) {
                    const relH = riser * (s + 1);
                    // Bug #3: clamp step height so stairs never penetrate the next floor
                    const clampedRelH = Math.min(relH, maxStairHeight - startElev);
                    // Extend down by 5cm to merge into slab
                    const bottomFaceY = startElev + relH - riser - 0.05;
                    const topFaceY = startElev + clampedRelH;
                    const stepThickness = Math.max(0.01, topFaceY - bottomFaceY);

                    const sZ = isNS
                        ? startZ + signZ * (s + 0.5) * actualTread
                        : stairCz;
                    const sX = isNS
                        ? stairCx
                        : startX + signX * (s + 0.5) * actualTread;
                    if (s === 0) {
                        firstSX = sX;
                        firstSZ = sZ;
                    }
                    if (s === numSteps - 1) {
                        lastSX = sX;
                        lastSZ = sZ;
                    }

                    const stepIsFirst = s === 0;
                    const stepIsLast = s === numSteps - 1;

                    const step = MeshBuilder.CreateBox(
                        `stair_step_${room.id}_${s}`,
                        {
                            width: isNS ? stepW : actualTread,
                            height: stepThickness,
                            depth: isNS ? actualTread : stepW,
                        },
                        this.scene,
                    );
                    step.position.set(sX, bottomFaceY + stepThickness / 2, sZ);
                    // Bug #6: color-code first step (entry=green) and last step (exit=yellow)
                    if (stepIsFirst) {
                        step.material = this.getOrCreateStairMarkerMat('entry');
                    } else if (stepIsLast) {
                        step.material = this.getOrCreateStairMarkerMat('exit');
                    } else {
                        step.material = this.matWall;
                    }
                    step.receiveShadows = true;
                    this.shadowGen?.addShadowCaster(step);
                    if (floorNode) step.parent = floorNode;
                    meshes.push(step);
                }

                // Pasamano para escalera directa
                if (showRailings && numSteps > 0) {
                    const railOffX = isNS ? stepW / 2 : 0;
                    const railOffZ = isNS ? 0 : stepW / 2;
                    addRail(
                        firstSX + railOffX,
                        firstSZ + railOffZ,
                        lastSX + railOffX,
                        lastSZ + railOffZ,
                        startElev,
                        startElev + riser * numSteps,
                        `${room.id}_0`,
                    );
                }

                // ── Losa inclinada estructural para escalera simple ─────────────────────
                if (shouldCreateBaseSlab) {
                    const SLAB_T = 0.15; // 15cm
                    const flightLen = numSteps * actualTread;
                    const flightH = numSteps * riser;
                    const slope = Math.atan2(flightH, flightLen);
                    const slabLen = Math.hypot(flightLen, flightH);
                    
                    const slab = MeshBuilder.CreateBox(
                        `stair_slab_${room.id}`,
                        {
                            width: isNS ? stepW : slabLen,
                            height: SLAB_T,
                            depth: isNS ? slabLen : stepW,
                        },
                        this.scene
                    );
                    
                    const midX = (firstSX + lastSX) / 2;
                    const midZ = (firstSZ + lastSZ) / 2;
                    // Posicionar debajo del escalón (restando SLAB_T/2 y ajustando por el riser)
                    const midY = startElev + flightH / 2 - riser / 2 - (SLAB_T / 2) * Math.cos(slope);
                    slab.position.set(midX, midY, midZ);
                    
                    if (isNS) {
                        slab.rotation.x = signZ > 0 ? slope : -slope;
                    } else {
                        // Left-handed Z rotation: positive angle rotates +X to +Y (up)
                        slab.rotation.z = signX > 0 ? slope : -slope;
                    }
                    slab.material = this.matWall;
                    slab.receiveShadows = true;
                    if (floorNode) slab.parent = floorNode;
                    meshes.push(slab);
                }
            }

            this.meshMap.set(room.id, meshes);
            return;
        }

        try {
            const floorHoles = floorBelow ? this.getRoomStairHoles(room, floorBelow.rooms || []) : [];
            if (room.roomType === 'corridor') {
                floorHoles.push(...this.getRoomStairHoles(room, allRooms));
            }
            const floor = MeshBuilder.CreatePolygon(
                `floor_${room.id}`,
                { shape, holes: floorHoles, depth: 0.05, sideOrientation: Mesh.DOUBLESIDE },
                this.scene,
            );
            floor.position.y = -0.025;
            floor.material = this.matFloor;
            floor.receiveShadows = true;
            meshes.push(floor);
        } catch {
            if (!this.warnedInvalidRooms.has(room.id)) {
                this.warnedInvalidRooms.add(room.id);
                console.warn(
                    `Room ${room.id}: polygon mesh failed, using bounds fallback`,
                );
            }
            this.buildRoomFallback(room, meshes, showRoof, ceilingHeight);
            this.meshMap.set(room.id, meshes);
            meshes.forEach((m) => {
                if (floorNode) m.parent = floorNode;
            });
            return;
        }

        // Paredes exteriores: una pared dividida en sub-segmentos si tiene aperturas
        const verts = room.vertices;
        for (let i = 0; i < verts.length; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % verts.length];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (segLen < 0.01) continue;

            const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const cx = (v1.x + v2.x) / 2;
            const cz = (v1.y + v2.y) / 2;

            const allAps = this.getAperturesForSegment(
                v1,
                v2,
                allWindows,
                allDoors,
                allWalls,
                allRooms,
                room.id
            );

            this.buildWallSegment(
                `recinto_wall_${room.id}_${i}`,
                v1,
                v2,
                segLen,
                ceilingHeight,
                EXTERIOR_WALL_THICKNESS,
                angle,
                cx,
                cz,
                allAps,
                meshes,
                false,
                EXTERIOR_WALL_THICKNESS / 2,
                EXTERIOR_WALL_THICKNESS / 2,
            );
        }

        if (showRoof) {
            try {
                // El techo debe cubrir el borde EXTERIOR de las paredes (no solo los vértices
                // centrales del polígono). Expandimos el polígono hacia afuera en THICKNESS/2
                // para que coincida exactamente con la cara exterior de cada pared.
                const ceilingShape = this.expandPolygonShape(
                    shape,
                    EXTERIOR_WALL_THICKNESS / 2,
                );
                const stairHoles = this.getRoomStairHoles(room, allRooms);

                // CreatePolygon extruda hacia -Y.
                // position.y = ceilingHeight + SLAB_THICKNESS → cara inferior en ceilingHeight
                const ceiling = MeshBuilder.CreatePolygon(
                    `ceiling_${room.id}`,
                    {
                        shape: ceilingShape,
                        holes: stairHoles,
                        depth: SLAB_THICKNESS,
                        sideOrientation: Mesh.DOUBLESIDE,
                    },
                    this.scene,
                );
                ceiling.position.y = ceilingHeight + SLAB_THICKNESS;
                ceiling.material = this.matCeiling;
                meshes.push(ceiling);
            } catch {
                /* noop — el techo de borde perimetral ya cubre las paredes */
            }
        }

        this.meshMap.set(room.id, meshes);
        meshes.forEach((m) => {
            if (floorNode) m.parent = floorNode;
        });
    }

    getAperturesForSegment(
        v1: { x: number; y: number },
        v2: { x: number; y: number },
        allWindows: Window[],
        allDoors: Door[],
        allWalls: Wall[],
        allRooms?: Room[],
        currentRoomId?: string
    ) {
        const aps: any[] = [];
        const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
        if (segLen < 0.01) return aps;

        const dx = (v2.x - v1.x) / segLen;
        const dy = (v2.y - v1.y) / segLen;

        const checkAperture = (ap: any, type: 'window' | 'door') => {
            const wall = allWalls.find((w) => w.id === ap.wallId);
            if (!wall) return;
            const centerOffset =
                type === 'window'
                    ? ap.offsetAlongWall
                    : ap.offsetAlongWall + ap.width / 2;
            const pt = this.getPointAtOffset(wall.vertices, centerOffset);

            const t = (pt.x - v1.x) * dx + (pt.y - v1.y) * dy;
            const px = v1.x + t * dx;
            const py = v1.y + t * dy;
            const dist = Math.hypot(pt.x - px, pt.y - py);

            if (dist < 0.3 && t > 0 && t < segLen) {
                aps.push({
                    id: ap.id,
                    type,
                    localOffset: t - ap.width / 2,
                    width: ap.width,
                    height: ap.height,
                    sillHeight: ap.sillHeight || 0,
                });
            }
        };

        allWindows.forEach((w) => checkAperture(w, 'window'));
        allDoors.forEach((d) => checkAperture(d, 'door'));

        // ── Virtual apertures: solo pasadizo tipo Techo y piso perfora paredes ──
        // Las ESCALERAS no perforan paredes exteriores (van verticalmente, no horizontalmente)
        if (allRooms) {
            allRooms.forEach(r => {
                if (r.id === currentRoomId) return;

                // Solo corridors de tipo roof_floor perforan muros del recinto
                const isRoofFloorCorridor = r.roomType === 'corridor' && r.corridorConfig?.type === 'roof_floor';
                if (!isRoofFloorCorridor) return;

                // Dirección de flujo seleccionada en el panel
                const dir = r.corridorConfig?.direction;

                // Límites 2D del pasadizo (r.vertices son coordenadas 2D {x,y})
                const rVerts = r.vertices;
                const rMinX = Math.min(...rVerts.map(v => v.x));
                const rMaxX = Math.max(...rVerts.map(v => v.x));
                const rMinY = Math.min(...rVerts.map(v => v.y));
                const rMaxY = Math.max(...rVerts.map(v => v.y));

                const pts = this.sanitizeRoomShape(r);
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i];
                    const p2 = pts[(i + 1) % pts.length];

                    // sanitizeRoomShape devuelve Vector3; el eje 2D-Y queda en .z
                    const p1x = p1.x; const p1y = p1.z;
                    const p2x = p2.x; const p2y = p2.z;

                    const pLen = Math.hypot(p2x - p1x, p2y - p1y);
                    if (pLen < 0.01) continue;

                    // ── Filtro de dirección ──────────────────────────────────────
                    // Si hay dirección elegida, sólo la arista del lado correcto perfora
                    if (dir) {
                        const midEx = (p1x + p2x) / 2;
                        const midEy = (p1y + p2y) / 2;
                        const tol = 0.5; // 50 cm de tolerancia para encontrar la arista

                        let isSelectedEdge = false;
                        // En 2D del canvas, Y crece hacia abajo → Norte = minY, Sur = maxY
                        if (dir === 'north' && Math.abs(midEy - rMinY) < tol) isSelectedEdge = true;
                        if (dir === 'south' && Math.abs(midEy - rMaxY) < tol) isSelectedEdge = true;
                        if (dir === 'east'  && Math.abs(midEx - rMaxX) < tol) isSelectedEdge = true;
                        if (dir === 'west'  && Math.abs(midEx - rMinX) < tol) isSelectedEdge = true;

                        if (!isSelectedEdge) continue;
                    }

                    const wdx = (v2.x - v1.x) / segLen;
                    const wdy = (v2.y - v1.y) / segLen;
                    const pdx = (p2x - p1x) / pLen;
                    const pdy = (p2y - p1y) / pLen;

                    const cross = wdx * pdy - wdy * pdx;
                    if (Math.abs(cross) > 0.1) continue; // no son paralelos

                    // Distancia perpendicular — la arista del pasadizo debe estar sobre la pared
                    const distPerp = Math.abs((p1x - v1.x) * (-wdy) + (p1y - v1.y) * wdx);
                    if (distPerp > 0.35) continue;

                    // Traslape 1D sobre el segmento de muro
                    const t1 = (p1x - v1.x) * dx + (p1y - v1.y) * dy;
                    const t2 = (p2x - v1.x) * dx + (p2y - v1.y) * dy;

                    const overlapStart = Math.max(0, Math.min(t1, t2));
                    const overlapEnd   = Math.min(segLen, Math.max(t1, t2));
                    const overlapLen   = overlapEnd - overlapStart;

                    if (overlapLen > 0.1) {
                        aps.push({
                            id: `virtual_${r.id}_${i}`,
                            type: 'door',
                            doorType: 'opening',
                            localOffset: overlapStart,
                            width: overlapLen,
                            height: r.height ?? 3.0,
                            sillHeight: 0,
                            isVirtual: true,
                        });
                    }
                }
            });
        }

        return aps.sort((a, b) => a.localOffset - b.localOffset);
    }

    buildWallSegment(
        idPrefix: string,
        v1: { x: number; y: number },
        v2: { x: number; y: number },
        segLen: number,
        height: number,
        thickness: number,
        angleRad: number,
        cx: number,
        cz: number,
        allAps: any[],
        meshes: Mesh[],
        renderGlassAndFrame: boolean,
        extendStart: number = 0,
        extendEnd: number = 0,
    ) {
        if (allAps.length === 0) {
            const m = this.createWallBox(
                `${idPrefix}_solid`,
                segLen + extendStart + extendEnd,
                height,
                thickness,
                0,
                height / 2,
            );
            const centerShift = (extendEnd - extendStart) / 2;
            this.positionWallBoxOffset(
                m,
                [v1, v2],
                segLen / 2 + centerShift,
                angleRad,
            );
            m.material = this.matWall;
            m.receiveShadows = true;
            this.shadowGen?.addShadowCaster(m);
            meshes.push(m);
        } else {
            let cursor = -extendStart;
            allAps.forEach((ap, idx) => {
                if (ap.localOffset > cursor + 0.01) {
                    const subSegLen = ap.localOffset - cursor;
                    const subSegOffset = cursor + subSegLen / 2;
                    const m = this.createWallBox(
                        `${idPrefix}_pre${idx}`,
                        subSegLen,
                        height,
                        thickness,
                        0,
                        height / 2,
                    );
                    this.positionWallBoxOffset(
                        m,
                        [v1, v2],
                        subSegOffset,
                        angleRad,
                    );
                    m.material = this.matWall;
                    m.receiveShadows = true;
                    this.shadowGen?.addShadowCaster(m);
                    meshes.push(m);
                }

                if (ap.type === 'window') {
                    if (ap.sillHeight > 0.01) {
                        const m = this.createWallBox(
                            `${idPrefix}_sill_${ap.id}`,
                            ap.width,
                            ap.sillHeight,
                            thickness,
                            0,
                            ap.sillHeight / 2,
                        );
                        this.positionWallBoxOffset(
                            m,
                            [v1, v2],
                            ap.localOffset + ap.width / 2,
                            angleRad,
                        );
                        m.material = this.matWall;
                        m.receiveShadows = true;
                        meshes.push(m);
                    }

                    if (renderGlassAndFrame) {
                        const glassH = ap.height;
                        const glassY = ap.sillHeight + glassH / 2;
                        const glass = this.createWallBox(
                            `${idPrefix}_glass_${ap.id}`,
                            ap.width - 0.06,
                            glassH - 0.06,
                            thickness * 0.2,
                            0,
                            glassY,
                        );
                        this.positionWallBoxOffset(
                            glass,
                            [v1, v2],
                            ap.localOffset + ap.width / 2,
                            angleRad,
                        );
                        glass.material = this.matGlass;
                        meshes.push(glass);

                        [
                            {
                                w: 0.05,
                                h: ap.height + 0.06,
                                y: glassY,
                                off: ap.localOffset + 0.025,
                            },
                            {
                                w: 0.05,
                                h: ap.height + 0.06,
                                y: glassY,
                                off: ap.localOffset + ap.width - 0.025,
                            },
                        ].forEach((j, ji) => {
                            const jamba = this.createWallBox(
                                `${idPrefix}_jamba_${ap.id}_${ji}`,
                                j.w,
                                j.h,
                                thickness + 0.02,
                                0,
                                j.y,
                            );
                            this.positionWallBoxOffset(
                                jamba,
                                [v1, v2],
                                j.off,
                                angleRad,
                            );
                            jamba.material = this.matFrame;
                            meshes.push(jamba);
                        });
                    }
                }

                const dintelH = height - (ap.sillHeight + ap.height);
                if (dintelH > 0.01) {
                    const dintelY = ap.sillHeight + ap.height + dintelH / 2;
                    const m = this.createWallBox(
                        `${idPrefix}_dintel_${ap.id}`,
                        ap.width,
                        dintelH,
                        thickness,
                        0,
                        dintelY,
                    );
                    this.positionWallBoxOffset(
                        m,
                        [v1, v2],
                        ap.localOffset + ap.width / 2,
                        angleRad,
                    );
                    m.material = this.matWall;
                    m.receiveShadows = true;
                    this.shadowGen?.addShadowCaster(m);
                    meshes.push(m);
                }

                cursor = ap.localOffset + ap.width;
            });

            if (cursor < segLen + extendEnd - 0.01) {
                const subSegLen = segLen + extendEnd - cursor;
                const subSegOffset = cursor + subSegLen / 2;
                const m = this.createWallBox(
                    `${idPrefix}_post`,
                    subSegLen,
                    height,
                    thickness,
                    0,
                    height / 2,
                );
                this.positionWallBoxOffset(m, [v1, v2], subSegOffset, angleRad);
                m.material = this.matWall;
                m.receiveShadows = true;
                this.shadowGen?.addShadowCaster(m);
                meshes.push(m);
            }
        }
    }

    // ── Partición (Partition) ──────────────────────────────────────────────────
    /**
     * Construye una partición (tabique ligero/cubículo).
     * Reutiliza `buildWallSegment` para poder insertar puertas de partición.
     */
    buildPartition(
        partition: Partition,
        allDoors: Door[] = [],
        floorNode?: TransformNode,
    ) {
        const meshes: Mesh[] = [];
        const vertices = partition.vertices;

        for (let i = 0; i < vertices.length - 1; i++) {
            const v1 = vertices[i];
            const v2 = vertices[i + 1];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (segLen < 0.01) continue;

            const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const cx = (v1.x + v2.x) / 2;
            const cy = (v1.y + v2.y) / 2;

            let segStartOffset = 0;
            for (let j = 0; j < i; j++) {
                segStartOffset += Math.hypot(
                    vertices[j + 1].x - vertices[j].x,
                    vertices[j + 1].y - vertices[j].y,
                );
            }

            const segmentDoors: any[] = [];
            for (const d of allDoors.filter(
                (door) => door.partitionId === partition.id,
            )) {
                const dStart = d.offsetAlongWall;
                const dEnd = d.offsetAlongWall + d.width;
                const segEndOffset = segStartOffset + segLen;

                if (
                    dStart < segEndOffset - 0.01 &&
                    dEnd > segStartOffset + 0.01
                ) {
                    const ixStart = Math.max(dStart, segStartOffset);
                    const ixEnd = Math.min(dEnd, segEndOffset);
                    segmentDoors.push({
                        id: d.id,
                        width: ixEnd - ixStart,
                        height: d.height,
                        sillHeight: d.bottomGap ?? 0, // Las puertas de partición pueden tener bottomGap
                        type: 'door' as const,
                        localOffset: ixStart - segStartOffset,
                    });
                }
            }

            const allAps = [...segmentDoors].sort(
                (a, b) => a.localOffset - b.localOffset,
            );

            // Determinar color base según partitionType
            let pMat = this.matWall; // fallback
            if (partition.partitionType === 'melamine') {
                pMat = this.matDoor; // O un material nuevo para melamina
            } else if (partition.partitionType === 'glass') {
                pMat = this.matGlass;
            }

            // Usamos un array temporal de meshes para interceptar los creados por buildWallSegment
            // y cambiarles el material o ajustarles el bottomGap
            const tempMeshes: Mesh[] = [];

            this.buildWallSegment(
                `partition_${partition.id}_seg${i}`,
                v1,
                v2,
                segLen,
                partition.height,
                partition.thickness,
                angle,
                cx,
                cy,
                allAps,
                tempMeshes,
                false,
            );

            // Aplicar bottomGap global de la partición elevando los meshes
            tempMeshes.forEach((m) => {
                m.material = pMat;
                if (partition.bottomGap > 0) {
                    m.position.y += partition.bottomGap;
                }
                meshes.push(m);
            });
        }

        this.meshMap.set(partition.id, meshes);
        meshes.forEach((m) => {
            if (floorNode) m.parent = floorNode;
        });
    }

    // ── Pared (Wall) ──────────────────────────────────────────────────────────
    /**
     * Construye una pared como una o varias cajas.
     * Cuando hay ventanas: divide en segmentos para crear los huecos.
     */
    buildWall(
        wall: Wall,
        allWindows: Window[],
        _allDoors: Door[] = [],
        allRooms?: Room[],
        floorNode?: TransformNode,
    ) {
        const meshes: Mesh[] = [];

        const vertices = wall.vertices || [
            { x: wall.x1!, y: wall.y1! },
            { x: wall.x2!, y: wall.y2! },
        ];

        // For each segment in the polyline
        for (let i = 0; i < vertices.length - 1; i++) {
            const v1 = vertices[i];
            const v2 = vertices[i + 1];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (segLen < 0.01) continue;

            const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const cx = (v1.x + v2.x) / 2;
            const cy = (v1.y + v2.y) / 2;

            // Calculate cumulative offset start for this segment
            let segStartOffset = 0;
            for (let j = 0; j < i; j++) {
                segStartOffset += Math.hypot(
                    vertices[j + 1].x - vertices[j].x,
                    vertices[j + 1].y - vertices[j].y,
                );
            }

            // Apertures (Windows and Doors) on this segment
            const segmentWindows: any[] = [];
            for (const w of allWindows.filter(
                (win) => win.wallId === wall.id,
            )) {
                const wStart = w.offsetAlongWall - (w.width || 0) / 2;
                const wEnd = w.offsetAlongWall + (w.width || 0) / 2;
                const segEndOffset = segStartOffset + segLen;

                if (
                    wStart < segEndOffset - 0.01 &&
                    wEnd > segStartOffset + 0.01
                ) {
                    const ixStart = Math.max(wStart, segStartOffset);
                    const ixEnd = Math.min(wEnd, segEndOffset);
                    segmentWindows.push({
                        ...w,
                        type: 'window' as const,
                        localOffset: ixStart - segStartOffset,
                        width: ixEnd - ixStart,
                    });
                }
            }

            const segmentDoors: any[] = [];
            for (const d of _allDoors.filter(
                (door) => door.wallId === wall.id,
            )) {
                const dStart = d.offsetAlongWall;
                const dEnd = d.offsetAlongWall + d.width;
                const segEndOffset = segStartOffset + segLen;

                if (
                    dStart < segEndOffset - 0.01 &&
                    dEnd > segStartOffset + 0.01
                ) {
                    const ixStart = Math.max(dStart, segStartOffset);
                    const ixEnd = Math.min(dEnd, segEndOffset);
                    segmentDoors.push({
                        id: d.id,
                        width: ixEnd - ixStart,
                        height: d.height,
                        sillHeight: 0,
                        type: 'door' as const,
                        localOffset: ixStart - segStartOffset,
                    });
                }
            }

            const virtualAps: any[] = [];
            // Virtual apertures: solo pasadizo tipo Techo y piso perfora muros
            // Las escaleras NO perforan paredes exteriores
            if (allRooms) {
                const dx = (v2.x - v1.x) / segLen;
                const dy = (v2.y - v1.y) / segLen;

                allRooms.forEach(r => {
                    // Solo corridors tipo roof_floor crean huecos en paredes
                    const isRoofFloorCorridor = r.roomType === 'corridor' && r.corridorConfig?.type === 'roof_floor';
                    if (!isRoofFloorCorridor) return;

                    const dir = r.corridorConfig?.direction;

                    const rVerts = r.vertices;
                    const rMinX = Math.min(...rVerts.map(v => v.x));
                    const rMaxX = Math.max(...rVerts.map(v => v.x));
                    const rMinY = Math.min(...rVerts.map(v => v.y));
                    const rMaxY = Math.max(...rVerts.map(v => v.y));

                    const pts = this.sanitizeRoomShape(r);
                    for (let k = 0; k < pts.length; k++) {
                        const p1 = pts[k];
                        const p2 = pts[(k + 1) % pts.length];

                        // sanitizeRoomShape devuelve Vector3; el eje 2D-Y queda en .z
                        const p1x = p1.x; const p1y = p1.z;
                        const p2x = p2.x; const p2y = p2.z;

                        const pLen = Math.hypot(p2x - p1x, p2y - p1y);
                        if (pLen < 0.01) continue;

                        // ── Filtro de dirección ──────────────────────────────────
                        if (dir) {
                            const midEx = (p1x + p2x) / 2;
                            const midEy = (p1y + p2y) / 2;
                            const tol = 0.5;

                            let isSelectedEdge = false;
                            if (dir === 'north' && Math.abs(midEy - rMinY) < tol) isSelectedEdge = true;
                            if (dir === 'south' && Math.abs(midEy - rMaxY) < tol) isSelectedEdge = true;
                            if (dir === 'east'  && Math.abs(midEx - rMaxX) < tol) isSelectedEdge = true;
                            if (dir === 'west'  && Math.abs(midEx - rMinX) < tol) isSelectedEdge = true;

                            if (!isSelectedEdge) continue;
                        }

                        const wdx = (v2.x - v1.x) / segLen;
                        const wdy = (v2.y - v1.y) / segLen;
                        const pdx = (p2x - p1x) / pLen;
                        const pdy = (p2y - p1y) / pLen;

                        const cross = wdx * pdy - wdy * pdx;
                        if (Math.abs(cross) > 0.1) continue;

                        const distPerp = Math.abs((p1x - v1.x) * (-wdy) + (p1y - v1.y) * wdx);
                        if (distPerp > 0.35) continue;

                        const t1 = (p1x - v1.x) * dx + (p1y - v1.y) * dy;
                        const t2 = (p2x - v1.x) * dx + (p2y - v1.y) * dy;

                        const overlapStart = Math.max(0, Math.min(t1, t2));
                        const overlapEnd   = Math.min(segLen, Math.max(t1, t2));
                        const overlapLen   = overlapEnd - overlapStart;

                        if (overlapLen > 0.1) {
                            virtualAps.push({
                                id: `virtual_wall_${r.id}_${k}`,
                                type: 'door',
                                doorType: 'opening',
                                localOffset: overlapStart,
                                width: overlapLen,
                                height: r.height ?? 3.0,
                                sillHeight: 0,
                                isVirtual: true,
                            });
                        }
                    }
                });
            }

            const allAps = [...segmentWindows, ...segmentDoors, ...virtualAps].sort(
                (a, b) => a.localOffset - b.localOffset,
            );

            this.buildWallSegment(
                `wall_${wall.id}_seg${i}`,
                v1,
                v2,
                segLen,
                wall.height,
                wall.thickness,
                angle,
                cx,
                cy,
                allAps,
                meshes,
                true, // Renderizar vidrio y marco en paredes interiores explícitas
            );
        }

        this.meshMap.set(wall.id, meshes);
        meshes.forEach((m) => {
            if (floorNode) m.parent = floorNode;
        });
    }

    /** Crea una caja orientada para pared */
    createPolygon(
        name: string,
        length: number,
        height: number,
        thickness: number,
        _x: number,
        yCenter: number,
    ): Mesh {
        const box = MeshBuilder.CreateBox(
            name,
            {
                width: length,
                height,
                depth: thickness,
            },
            this.scene,
        );
        box.position.y = yCenter;
        return box;
    }

    createWallBox(
        name: string,
        length: number,
        height: number,
        thickness: number,
        _x: number,
        yCenter: number,
    ): Mesh {
        const box = MeshBuilder.CreateBox(
            name,
            {
                width: length,
                height,
                depth: thickness,
            },
            this.scene,
        );
        box.position.y = yCenter;
        return box;
    }

    /** Posiciona una caja de pared en el centro de la pared */
    positionWallBox(
        mesh: Mesh,
        cx: number,
        cz: number,
        angleRad: number,
    ) {
        mesh.position.x = cx;
        mesh.position.z = cz;
        mesh.rotation.y = -angleRad;
    }

    getWallVertices(wall: Wall) {
        return wall.vertices.length >= 2 ? wall.vertices : [];
    }

    /**
     * Retorna el punto y ángulo en la polilínea de pared a un offset (m) desde el inicio.
     * Recibe el array de vértices ya calculado para el segmento actual.
     */
    getPointAtOffset(
        vertices: { x: number; y: number }[],
        offsetM: number,
    ): { x: number; y: number; angle: number } {
        if (vertices.length < 2) return { x: 0, y: 0, angle: 0 };

        let remaining = offsetM;
        for (let i = 1; i < vertices.length; i++) {
            const v1 = vertices[i - 1];
            const v2 = vertices[i];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (remaining <= segLen) {
                const t = segLen > 0 ? remaining / segLen : 0;
                return {
                    x: v1.x + (v2.x - v1.x) * t,
                    y: v1.y + (v2.y - v1.y) * t,
                    angle: Math.atan2(v2.y - v1.y, v2.x - v1.x),
                };
            }
            remaining -= segLen;
        }

        const last = vertices[vertices.length - 1];
        const prev = vertices[vertices.length - 2];
        return {
            x: last.x,
            y: last.y,
            angle: Math.atan2(last.y - prev.y, last.x - prev.x),
        };
    }

    /** Posiciona una caja a un offset (metros) a lo largo de un segmento de vértices */
    positionWallBoxOffset(
        mesh: Mesh,
        vertices: { x: number; y: number }[],
        offsetM: number,
        angleRad: number,
    ) {
        const point = this.getPointAtOffset(vertices, offsetM);
        mesh.position.x = point.x;
        mesh.position.z = point.y;
        mesh.rotation.y = -angleRad;
    }

    // ── Voladizo (Canopy) ─────────────────────────────────────────────────────
    buildCanopy(
        canopy: Canopy,
        floorNode?: import('@babylonjs/core').TransformNode,
    ) {
        const depth = Math.hypot(canopy.x2 - canopy.x1, canopy.y2 - canopy.y1);
        if (depth < 0.01) return;

        const angle = Math.atan2(canopy.y2 - canopy.y1, canopy.x2 - canopy.x1);
        const cx = (canopy.x1 + canopy.x2) / 2;
        const cz = (canopy.y1 + canopy.y2) / 2;

        const slab = MeshBuilder.CreateBox(
            `canopy_${canopy.id}`,
            {
                width: depth,
                height: canopy.slabThickness,
                depth: canopy.width,
            },
            this.scene,
        );

        // Desplazamos la losa para que uno de sus bordes descanse en la pared y crezca hacia afuera.
        // El eje Z local es (-sin(angle), 0, cos(angle)) tras rotar -angle en Y.
        const offsetX = cx - Math.sin(angle) * (canopy.width / 2);
        const offsetZ = cz + Math.cos(angle) * (canopy.width / 2);

        slab.position.set(
            offsetX,
            canopy.height + canopy.slabThickness / 2,
            offsetZ,
        );
        slab.rotation.y = -angle;
        slab.material = this.matCanopy;
        slab.receiveShadows = true;
        this.shadowGen?.addShadowCaster(slab);

        slab.parent = floorNode ?? null;
        this.meshMap.set(canopy.id, [slab]);
    }

    // ── Puerta (Door) ─────────────────────────────────────────────────
    /**
     * Renderiza una puerta:
     *   - Marco exterior (2 jambas + dintel, color pared)
     *   - Hoja de puerta (caja delgada, color madera)
     *
     * El hueco ya se gestionalía con CSG en una implementación avanzada;
     * aquí se representa visualmente la hoja sin CSG para mantener el
     * rendimiento del sistema.
     */
    buildDoor(
        door: Door,
        allWalls: Wall[],
        floorNode?: import('@babylonjs/core').TransformNode,
    ) {
        const wall = allWalls.find((w) => w.id === door.wallId);
        if (!wall || wall.vertices.length < 2) return;

        const vertices = wall.vertices;
        const pt = this.getPointAtOffset(
            vertices,
            door.offsetAlongWall + door.width / 2,
        );

        const W = door.width;
        const H = door.height;
        const D = wall.thickness;
        const meshes: Mesh[] = [];

        // Si la puerta es tipo 'opening', es solo el vano, no dibujamos hoja ni marcos
        if (door.doorType === 'opening') {
            this.meshMap.set(door.id, meshes);
            return;
        }

        // Hoja de puerta (caja delgada)
        const leaf = MeshBuilder.CreateBox(
            `door_leaf_${door.id}`,
            {
                width: W - 0.05,
                height: H - 0.01,
                depth: 0.04,
            },
            this.scene,
        );
        leaf.position.set(pt.x, H / 2, pt.y);
        leaf.rotation.y = -pt.angle;
        leaf.material = this.matDoor;
        this.shadowGen?.addShadowCaster(leaf);
        meshes.push(leaf);

        // Pomo/Manija de puerta
        const handle = MeshBuilder.CreateSphere(
            `door_handle_${door.id}`,
            { diameter: 0.04 },
            this.scene,
        );
        const hSide = W / 2 - 0.1;
        const hDepth = 0.025;
        handle.position.set(
            pt.x + Math.cos(pt.angle) * hSide + Math.sin(pt.angle) * hDepth,
            1.05,
            pt.y - Math.sin(pt.angle) * hSide + Math.cos(pt.angle) * hDepth,
        );
        handle.material = this.matFrame;
        meshes.push(handle);

        // Jamba izquierda
        const jambaL = MeshBuilder.CreateBox(
            `door_jamL_${door.id}`,
            {
                width: 0.05,
                height: H + 0.1,
                depth: D + 0.04,
            },
            this.scene,
        );
        const ptL = this.getPointAtOffset(
            vertices,
            door.offsetAlongWall + 0.025,
        );
        jambaL.position.set(ptL.x, H / 2, ptL.y);
        jambaL.rotation.y = -ptL.angle;
        jambaL.material = this.matFrame;
        meshes.push(jambaL);

        // Jamba derecha
        const jambaR = MeshBuilder.CreateBox(
            `door_jamR_${door.id}`,
            {
                width: 0.05,
                height: H + 0.1,
                depth: D + 0.04,
            },
            this.scene,
        );
        const ptR = this.getPointAtOffset(
            vertices,
            door.offsetAlongWall + W - 0.025,
        );
        jambaR.position.set(ptR.x, H / 2, ptR.y);
        jambaR.rotation.y = -ptR.angle;
        jambaR.material = this.matFrame;
        meshes.push(jambaR);

        // Dintel (parte superior)
        const lintel = MeshBuilder.CreateBox(
            `door_lintel_${door.id}`,
            {
                width: W + 0.08,
                height: 0.08,
                depth: D + 0.04,
            },
            this.scene,
        );
        lintel.position.set(pt.x, H + 0.04, pt.y);
        lintel.rotation.y = -pt.angle;
        lintel.material = this.matFrame;
        meshes.push(lintel);

        this.meshMap.set(door.id, meshes);
        meshes.forEach((m) => {
            if (floorNode) m.parent = floorNode;
        });
    }

    // ── Interruptor / LightSwitch ──────────────────────────────────────────────
    buildLightSwitch(
        ls: LightSwitch,
        floorNode: TransformNode,
        walls: Wall[] = [],
        rooms: Room[] = [],
    ) {
        // El interruptor se reconstruye en cada resync con un material propio
        // por instancia (`mat_switch_${id}`/`mat_rocker_${id}`, no cacheado) —
        // hay que disponer la instancia anterior o cada resync deja huérfanos
        // esos dos materiales por interruptor.
        this.disposeOwnedMeshes(this.meshMap.get(ls.id));

        const meshes: Mesh[] = [];

        // ── Caja del interruptor (plástico blanco en la pared) ──
        const width = 0.08;
        const height = 0.12;
        const depth = 0.015;

        const body = MeshBuilder.CreateBox(
            `switch_${ls.id}`,
            { width, height, depth },
            this.scene,
        );

        const mat = new StandardMaterial(`mat_switch_${ls.id}`, this.scene);
        mat.diffuseColor = new Color3(0.92, 0.92, 0.92);
        mat.specularColor = new Color3(0.3, 0.3, 0.3);
        body.material = mat;

        // Posición base
        body.position.x = ls.x;
        body.position.y = ls.mountingHeight ?? 1.2;
        body.position.z = ls.y;

        // Orientar pegado a la pared
        let wallAngle = 0;
        let wallThickness = 0.15; // default

        // Helper to find nearest segment
        let minDist = Infinity;
        let bestV1: {x: number, y: number} | null = null;
        let bestV2: {x: number, y: number} | null = null;

        const checkVertices = (vertices: {x: number, y: number}[], thickness: number) => {
            if (vertices.length < 2) return;
            for (let i = 0; i < vertices.length - 1; i++) {
                const v1 = vertices[i];
                const v2 = vertices[i + 1];
                const px = v2.x - v1.x;
                const py = v2.y - v1.y;
                const norm = px * px + py * py;
                if (norm < 0.00001) continue;
                let u = ((ls.x - v1.x) * px + (ls.y - v1.y) * py) / norm;
                u = Math.max(0, Math.min(1, u));
                const dx = v1.x + u * px - ls.x;
                const dy = v1.y + u * py - ls.y;
                const dist = dx * dx + dy * dy;
                if (dist < minDist) {
                    minDist = dist;
                    wallAngle = Math.atan2(py, px);
                    bestV1 = v1;
                    bestV2 = v2;
                    wallThickness = thickness;
                }
            }
        };

        // Try snapping to explicit walls
        const wall = walls.find(w => w.id === ls.wallId);
        if (wall) {
            checkVertices(wall.vertices, wall.thickness);
        } else {
            // Check all walls and room boundaries if no explicit wall ID matches
            walls.forEach(w => checkVertices(w.vertices, w.thickness));
            rooms.forEach(r => {
                const closedVertices = [...r.vertices, r.vertices[0]];
                checkVertices(closedVertices, 0.15); // standard thickness for rooms
            });
        }

        if (bestV1 && bestV2) {
            // Ángulo automático de la pared + rotación manual del usuario (planta, sentido horario)
            body.rotation.y = -wallAngle + degToRad(ls.rotation ?? 0);
            // Solo aplicamos offset si esta realmente cerca del segmento
            if (minDist < 0.25) { // 0.5m^2 dist sq
                const offsetDist = (wallThickness / 2) + (depth / 2);
                body.position.x = ls.x - Math.sin(wallAngle) * offsetDist;
                body.position.z = ls.y + Math.cos(wallAngle) * offsetDist;
            }
        }


        // Tecla del interruptor (detalle visual)
        const rocker = MeshBuilder.CreateBox(
            `switch_rocker_${ls.id}`,
            { width: width * 0.55, height: height * 0.55, depth: depth * 0.6 },
            this.scene,
        );
        const rockerMat = new StandardMaterial(`mat_rocker_${ls.id}`, this.scene);
        rockerMat.diffuseColor = new Color3(0.75, 0.75, 0.8);
        rocker.material = rockerMat;
        rocker.position.copyFrom(body.position);
        rocker.rotation.copyFrom(body.rotation);
        // Offset hacia afuera (+depth/2 en la dirección normal de la pared)
        rocker.position.x -= Math.sin(wallAngle) * (depth * 0.35);
        rocker.position.z += Math.cos(wallAngle) * (depth * 0.35);
        rocker.parent = floorNode;
        meshes.push(rocker);

        body.parent = floorNode;
        meshes.push(body);

        // El conduit/tubería hacia las luminarias se dibuja centralizadamente
        // en buildConductors() a partir de los Conductor[] reales (o del
        // fallback legacy connectedFixtureIds), igual que hace OverlayWires
        // en 2D — evita duplicar la lógica de ruteo piso/techo por cada tipo
        // de nodo origen.
        this.meshMap.set(ls.id, meshes);
    }

    // ── Dispositivo eléctrico (tablero, medidor, tomacorriente, caja de pase) ──
    /** Dimensiones físicas aproximadas (ancho, profundidad, alto) en metros por tipo. */
    static readonly ELECTRICAL_DEVICE_DIMS: Record<ElectricalDeviceType, { w: number; d: number; h: number }> = {
        meter: { w: 0.3, d: 0.15, h: 0.4 },
        main_panel: { w: 0.4, d: 0.18, h: 0.5 },
        sub_panel: { w: 0.35, d: 0.15, h: 0.45 },
        transfer_switch: { w: 0.35, d: 0.18, h: 0.45 },
        arrival_panel: { w: 0.35, d: 0.15, h: 0.45 },
        junction_box: { w: 0.1, d: 0.05, h: 0.1 },
        earth_pit: { w: 0.15, d: 0.15, h: 0.02 },
        facp: { w: 0.35, d: 0.12, h: 0.3 },
        outlet_floor: { w: 0.08, d: 0.03, h: 0.08 },
        outlet_initial: { w: 0.08, d: 0.03, h: 0.08 },
        outlet_high_180: { w: 0.08, d: 0.03, h: 0.08 },
        outlet_floor_box: { w: 0.1, d: 0.1, h: 0.03 },
        outlet_waterproof: { w: 0.08, d: 0.04, h: 0.08 },
        outlet_ceiling: { w: 0.08, d: 0.08, h: 0.03 },
        outlet_rack: { w: 0.1, d: 0.03, h: 0.06 },
        water_heater_30l: { w: 0.32, d: 0.16, h: 0.24 },
    };

    static readonly ELECTRICAL_DEVICE_COLORS: Record<ElectricalDeviceType, string> = {
        meter: '#22c55e',
        main_panel: '#ef4444',
        sub_panel: '#ef4444',
        transfer_switch: '#ef4444',
        arrival_panel: '#ef4444',
        junction_box: '#22c55e',
        earth_pit: '#eab308',
        facp: '#06b6d4',
        outlet_floor: '#22c55e',
        outlet_initial: '#22c55e',
        outlet_high_180: '#3b82f6',
        outlet_floor_box: '#16a34a',
        outlet_waterproof: '#3b82f6',
        outlet_ceiling: '#e2e8f0',
        outlet_rack: '#ef4444',
        water_heater_30l: '#ff00ff',
    };

    buildElectricalDevice(
        dev: ElectricalDevice,
        floorNode: TransformNode,
        walls: Wall[] = [],
        rooms: Room[] = [],
    ) {
        const dims =
            House3DBuilder.ELECTRICAL_DEVICE_DIMS[dev.type] ??
            { w: 0.2, d: 0.1, h: 0.2 };
        const body = MeshBuilder.CreateBox(
            `elecdev_${dev.id}`,
            { width: dims.w, depth: dims.d, height: dims.h },
            this.scene,
        );

        const hex = House3DBuilder.ELECTRICAL_DEVICE_COLORS[dev.type] ?? '#22c55e';
        let mat = this.matElecDeviceCache.get(hex);
        if (!mat) {
            mat = new StandardMaterial(`mat_elecdev_${hex}`, this.scene);
            mat.diffuseColor = hexToColor3(hex);
            mat.specularColor = new Color3(0.15, 0.15, 0.15);
            this.matElecDeviceCache.set(hex, mat);
        }
        body.material = mat;

        // Orientar contra el muro más cercano (igual criterio que interruptores),
        // y sumar la rotación manual del usuario encima del ángulo automático.
        let wallAngle = 0;
        let wallThickness = 0.15;
        let minDist = Infinity;
        let snapped = false;

        const checkVertices = (vertices: { x: number; y: number }[], thickness: number) => {
            if (vertices.length < 2) return;
            for (let i = 0; i < vertices.length - 1; i++) {
                const v1 = vertices[i];
                const v2 = vertices[i + 1];
                const px = v2.x - v1.x;
                const py = v2.y - v1.y;
                const norm = px * px + py * py;
                if (norm < 0.00001) continue;
                let u = ((dev.x - v1.x) * px + (dev.y - v1.y) * py) / norm;
                u = Math.max(0, Math.min(1, u));
                const dx = v1.x + u * px - dev.x;
                const dy = v1.y + u * py - dev.y;
                const dist = dx * dx + dy * dy;
                if (dist < minDist) {
                    minDist = dist;
                    wallAngle = Math.atan2(py, px);
                    wallThickness = thickness;
                    snapped = true;
                }
            }
        };

        const wall = walls.find((w) => w.id === dev.wallId);
        if (wall) {
            checkVertices(wall.vertices, wall.thickness);
        } else {
            walls.forEach((w) => checkVertices(w.vertices, w.thickness));
            rooms.forEach((r) => checkVertices([...r.vertices, r.vertices[0]], 0.15));
        }

        body.position.set(dev.x, dev.mountingHeight ?? 1.2, dev.y);
        if (snapped && minDist < 0.25) {
            body.rotation.y = -wallAngle + degToRad(dev.rotation ?? 0);
            const offsetDist = wallThickness / 2 + dims.d / 2;
            body.position.x = dev.x - Math.sin(wallAngle) * offsetDist;
            body.position.z = dev.y + Math.cos(wallAngle) * offsetDist;
        } else {
            body.rotation.y = degToRad(dev.rotation ?? 0);
        }

        body.parent = floorNode;
        this.meshMap.set(dev.id, [body]);
    }

    // ── Conductores / Tubería (conduit) ─────────────────────────────────────────
    /**
     * Dibuja un tubo 3D por cada Conductor real (sourceId/targetId pueden ser
     * luminaria, interruptor o dispositivo eléctrico), más un fallback legacy
     * para LightSwitch.connectedFixtureIds sin Conductor asociado — mismo
     * criterio que OverlayWires.tsx en 2D (legacySwitches).
     */
    buildConductors(
        conductors: Conductor[],
        fixtures: Fixture[],
        lightSwitches: LightSwitch[],
        electricalDevices: ElectricalDevice[],
        rooms: Room[],
        floorHeight: number,
        floorNode: TransformNode,
    ) {
        const FLOOR_Y = 0.05;

        const ceilingHeightAt = (x: number, z: number): number =>
            rooms.find((room) => pointInPolygon({ x, y: z }, room.vertices))?.height
                ?? floorHeight;

        const resolveNode = (id: string): { x: number; y: number; z: number } | null => {
            const fx = fixtures.find((f) => f.id === id);
            if (fx) return {
                x: fx.x,
                y: resolveFixtureRenderHeight(fx, ceilingHeightAt(fx.x, fx.y)),
                z: fx.y,
            };
            const sw = lightSwitches.find((s) => s.id === id);
            if (sw) return { x: sw.x, y: sw.mountingHeight ?? 1.2, z: sw.y };
            const dev = electricalDevices.find((d) => d.id === id);
            if (dev) return { x: dev.x, y: dev.mountingHeight ?? 1.2, z: dev.y };
            return null;
        };

        const buildPath = (
            nodes: Array<{ x: number; y: number; z: number }>,
            routeType: 'floor' | 'wall_ceiling',
            routeHeightM?: number,
        ): Vector3[] => {
            const autoCeiling = Math.max(
                ...nodes.map((point) =>
                    rooms.find((room) => pointInPolygon({ x: point.x, y: point.z }, room.vertices))?.height
                        ?? floorHeight,
                ),
            );
            const routeY = routeType === 'floor'
                ? FLOOR_Y
                : (routeHeightM ?? autoCeiling);

            return buildConductor3DPath(nodes, routeY).map(
                (point) => new Vector3(point.x, point.y, point.z),
            );
        };

        const makeTube = (name: string, path: Vector3[], radiusM: number, colorHex: string) => {
            if (path.length < 2) return;
            // Cada conducto tiene un material propio por instancia (`mat_${name}`,
            // no cacheado) que se recrea en cada resync — disponer el anterior
            // evita acumular un StandardMaterial huérfano por conducto y resync.
            this.disposeOwnedMeshes(this.meshMap.get(name));
            const tube = MeshBuilder.CreateTube(
                name,
                { path, radius: Math.max(0.006, radiusM), tessellation: 6, cap: Mesh.CAP_ALL },
                this.scene,
            );
            const mat = new StandardMaterial(`mat_${name}`, this.scene);
            mat.diffuseColor = hexToColor3(colorHex);
            mat.specularColor = new Color3(0.1, 0.1, 0.1);
            tube.material = mat;
            tube.parent = floorNode;
            this.meshMap.set(name, [tube]);
        };

        conductors.forEach((cond) => {
            const source = resolveNode(cond.sourceId);
            const target = resolveNode(cond.targetId);
            if (!source || !target) return;

            const waypoints = (cond.waypoints ?? []).map((w) => {
                // buildPath coloca todos los waypoints en la cota horizontal.
                return { x: w.x, y: 0, z: w.y };
            });

            const nodes = [source, ...waypoints, target];
            const radiusM = Math.max(0.006, (cond.tubeSize || 20) / 1000 / 2);
            makeTube(
                `conduit_${cond.id}`,
                buildPath(nodes, cond.routeType ?? 'wall_ceiling', cond.routeHeightM),
                radiusM,
                '#f97316',
            );
        });

        // Fallback legacy: interruptores con connectedFixtureIds pero sin Conductor real.
        const switchesWithConductor = new Set(
            conductors.flatMap((c) => [c.sourceId, c.targetId]),
        );
        lightSwitches
            .filter(
                (sw) =>
                    !switchesWithConductor.has(sw.id) &&
                    (sw.connectedFixtureIds?.length ?? 0) > 0,
            )
            .forEach((sw) => {
                const source = resolveNode(sw.id);
                if (!source) return;
                sw.connectedFixtureIds.forEach((fId, i) => {
                    const target = resolveNode(fId);
                    if (!target) return;
                    makeTube(
                        `conduit_legacy_${sw.id}_${i}`,
                        buildPath([source, target], 'wall_ceiling'),
                        0.008,
                        '#94a3b8',
                    );
                });
            });
    }

    // ── Fixture / Luminaria ───────────────────────────────────────────────────
    /**
     * Cada luminaria genera:
     * - Un mesh (esfera o cilindro según tipo)
     * - Una PointLight o SpotLight de Babylon.js
     *
     * 📌 AQUÍ PUEDES AGREGAR MÁS TIPOS DE LUMINARIA:
     *    Agregar casos en el switch de `fixture.fixtureType`.
     *    También puedes agregar más fixtures desde el ObjectsPanel
     *    o desde la toolbar usando la herramienta ✦.
     */
    buildFixtureLight(
        fixture: Fixture,
        ceilingHeight?: number,
        floorNode?: import('@babylonjs/core').TransformNode,
        walls: Wall[] = [],
        rooms: Room[] = [],
    ): {
        meshes: Mesh[];
        light: PointLight | SpotLight;
    } {
        const meshes: Mesh[] = [];
        const bx = fixture.x;
        const by = resolveFixtureRenderHeight(fixture, ceilingHeight);
        const bz = fixture.y;

        // ── Cuerpo 3D de la luminaria ──────────────────────────────────────
        let body: Mesh;
        const shape = fixture.fixtureShape ?? 'round';

        const makeBody = (name: string, props: FixtureBodyOptions) => {
            const w =
                fixture.dimensions?.width ??
                props.diameter ??
                props.diameterBottom ??
                0.2;
            const l =
                fixture.dimensions?.length ??
                props.diameter ??
                props.diameterBottom ??
                0.2;
            const h = fixture.dimensions?.height ?? props.height ?? 0.04;
            const d = fixture.dimensions
                ? Math.max(fixture.dimensions.width, fixture.dimensions.length)
                : (props.diameter ?? 0.2);

            if (shape === 'square') {
                return MeshBuilder.CreateBox(
                    name,
                    {
                        width: w,
                        depth: l,
                        height: h,
                    },
                    this.scene,
                );
            }
            if (shape === 'rectangular') {
                return MeshBuilder.CreateBox(
                    name,
                    {
                        width: w,
                        depth: l,
                        height: h,
                    },
                    this.scene,
                );
            }
            return MeshBuilder.CreateCylinder(
                name,
                {
                    diameter: fixture.dimensions ? d : props.diameter,
                    diameterTop: fixture.dimensions ? d : props.diameterTop,
                    diameterBottom: fixture.dimensions
                        ? d
                        : props.diameterBottom,
                    height: h,
                    tessellation: 16,
                },
                this.scene,
            );
        };

        switch (fixture.fixtureType ?? 'recessed') {
            case 'panel': {
                // Nuevo Panel LED específico
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: shape === 'rectangular' ? 0.3 : 0.6,
                    height: 0.02,
                });
                break;
            }
            case 'tube': {
                // Tubo fluorescente
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: 0.05,
                    height: 1.2,
                });
                if (!fixture.dimensions) {
                    body.rotation.z = Math.PI / 2;
                }
                break;
            }
            case 'pendant': {
                // Lámpara colgante: esfera/caja + cable
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: 0.25,
                    height: 0.15,
                });
                const cable = MeshBuilder.CreateCylinder(
                    `fix_cable_${fixture.id}`,
                    {
                        diameter: 0.02,
                        height: 0.5,
                        tessellation: 6,
                    },
                    this.scene,
                );
                cable.position.set(bx, by + 0.35, bz);
                const matCable = this.makeMat(
                    `mat_cable_${fixture.id}`,
                    '#374151',
                    0,
                );
                cable.material = matCable;
                meshes.push(cable);
                break;
            }
            case 'spot': {
                // Foco: cono invertido
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameterTop: 0.08,
                    diameterBottom: 0.18,
                    height: 0.15,
                });
                break;
            }
            case 'strip': {
                // Tira de LEDs: caja larga e independiente a shapes
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: 0.6,
                    height: 0.04,
                });
                break;
            }
            case 'surface': {
                // Superficie plana
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: 0.3,
                    height: 0.06,
                });
                break;
            }
            default: {
                // 'recessed'
                // Empotrado: disco o cuadrado plano
                body = makeBody(`fix_body_${fixture.id}`, {
                    diameter: 0.2,
                    height: 0.04,
                });
                break;
            }
        }

        // Reusar material cacheado por color de luz (evita crear N instancias por sync)
        const lc = fixture.lightColor ?? '#fff5e1';
        let matFix = this.matFixtureCache.get(lc);
        if (!matFix) {
            matFix = new StandardMaterial(`mat_fix_${lc}`, this.scene);
            matFix.diffuseColor = hexToColor3(lc);
            matFix.emissiveColor = hexToColor3(lc).scale(0.8);
            this.matFixtureCache.set(lc, matFix);
        }
        body.material = matFix;
        
        // --- WALL ALIGNMENT ---
        let fixtureWallAngle = 0;
        let isWallMounted = false;
        if (fixture.wallId) {
            // Helper to find nearest segment
            let minDist = Infinity;
            let bestV1: {x: number, y: number} | null = null;
            let bestV2: {x: number, y: number} | null = null;
            let wallThickness = 0.15;

            const checkVertices = (vertices: {x: number, y: number}[], thickness: number) => {
                if (vertices.length < 2) return;
                for (let i = 0; i < vertices.length - 1; i++) {
                    const v1 = vertices[i];
                    const v2 = vertices[i + 1];
                    const px = v2.x - v1.x;
                    const py = v2.y - v1.y;
                    const norm = px * px + py * py;
                    if (norm < 0.00001) continue;
                    let u = ((bx - v1.x) * px + (bz - v1.y) * py) / norm;
                    u = Math.max(0, Math.min(1, u));
                    const dx = v1.x + u * px - bx;
                    const dy = v1.y + u * py - bz;
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) {
                        minDist = dist;
                        fixtureWallAngle = Math.atan2(py, px);
                        bestV1 = v1;
                        bestV2 = v2;
                        wallThickness = thickness;
                    }
                }
            };

            const wall = walls.find(w => w.id === fixture.wallId);
            if (wall) {
                checkVertices(wall.vertices, wall.thickness);
            } else {
                // If it's on a corridor/room edge
                walls.forEach(w => checkVertices(w.vertices, w.thickness));
                rooms.forEach(r => {
                    const closedVertices = [...r.vertices, r.vertices[0]];
                    checkVertices(closedVertices, 0.15);
                });
            }

            if (bestV1 && bestV2 && minDist < 0.25) {
                isWallMounted = true;
                // Rotate the fixture so it faces outward from the wall
                body.rotation.x = Math.PI / 2; // Flat against wall instead of ceiling
                // Ángulo automático de la pared + rotación manual del usuario (planta, sentido horario)
                body.rotation.y = -fixtureWallAngle + degToRad(fixture.rotation ?? 0);

                const offsetDist = (wallThickness / 2);
                body.position.set(
                    bx - Math.sin(fixtureWallAngle) * offsetDist,
                    by,
                    bz + Math.cos(fixtureWallAngle) * offsetDist
                );
            }
        }

        if (!isWallMounted) {
            body.position.set(bx, by, bz);
            body.rotation.y = degToRad(fixture.rotation ?? 0);
        }

        this.shadowGen?.addShadowCaster(body);
        meshes.push(body);

        // ── Fuente de luz ──────────────────────────────────────────────────
        /**
         * 📌 AGREGAR MÁS TIPOS DE LUZ:
         *    - SpotLight: ideal para focos dirigidos (spot, pendant)
         *    - PointLight: omnidireccional (recessed, surface, strip)
         *    Ajusta `intensity` según fixture.lumens (1 lm ≈ 0.0018 candela a 2π sr)
         */
        let light: PointLight | SpotLight;
        const lightColor = hexToColor3(fixture.lightColor ?? '#fff5e1');
        const intensity = fixture.lumens / 2200; // normalización aproximada

        if (
            fixture.fixtureType === 'spot' ||
            fixture.fixtureType === 'pendant'
        ) {
            const spot = new SpotLight(
                `light_${fixture.id}`,
                new Vector3(body.position.x, body.position.y, body.position.z),
                isWallMounted 
                    ? new Vector3(-Math.sin(fixtureWallAngle), 0, Math.cos(fixtureWallAngle)) 
                    : new Vector3(0, -1, 0), // apunta hacia abajo
                Math.PI / 3, // ángulo de apertura 60°
                2, // exponente de caída
                this.scene,
            );
            spot.diffuse = lightColor;
            spot.specular = lightColor;
            spot.intensity = intensity * 1.5;
            this.shadowGen?.addShadowCaster(body);
            light = spot;
        } else {
            const pt = new PointLight(
                `light_${fixture.id}`,
                new Vector3(body.position.x, body.position.y, body.position.z),
                this.scene,
            );
            pt.diffuse = lightColor;
            pt.specular = lightColor;
            pt.intensity = intensity;
            pt.range = 6;
            light = pt;
        }

        this.meshMap.set(fixture.id, meshes);
        meshes.forEach((m) => {
            if (floorNode) m.parent = floorNode;
        });
        return { meshes, light };
    }

    // ── Limpieza ──────────────────────────────────────────────────────────────

    /**
     * Dispone un grupo de meshes JUNTO con su material (y las texturas que
     * ese material tenga asignadas). Solo es seguro llamarlo con meshes cuyo
     * material es EXCLUSIVO de esa instancia (interruptores `mat_switch_*`,
     * conductos `mat_conduit_*`, el plano de isolux) — nunca con meshes que
     * usan un material cacheado a nivel de clase (`matWall`, `matFixtureCache`,
     * `matElecDeviceCache`, `matStairMarkerCache`, etc.), porque disponer un
     * material compartido rompería todos los demás meshes que aún lo usan.
     *
     * Antes de este helper, `buildLightSwitch`/`buildConductors`/`buildIsolux`
     * sobrescribían su entrada en `meshMap` en cada resync (cada edición del
     * usuario) sin disponer el material/textura anterior — cada resync dejaba
     * huérfano un `StandardMaterial` (y, en isolux, también un `DynamicTexture`)
     * por interruptor/conducto/isolux, acumulando memoria de GPU indefinidamente
     * en una sesión de edición larga.
     */
    private disposeOwnedMeshes(meshes: Mesh[] | undefined) {
        meshes?.forEach((m) => {
            m.material?.dispose(false, true);
            m.dispose();
        });
    }

    disposeObject(id: string) {
        this.meshMap.get(id)?.forEach((m) => m.dispose());
        this.meshMap.delete(id);
        this.scene.getLightByName(`light_${id}`)?.dispose();
    }

    dispose() {
        // Meshes
        this.meshMap.forEach((meshes) => meshes.forEach((m) => m.dispose()));
        this.meshMap.clear();
        // Materiales cacheados de fixtures/dispositivos eléctricos/marcadores de escalera
        this.matFixtureCache.forEach((mat) => mat.dispose());
        this.matFixtureCache.clear();
        this.matElecDeviceCache.forEach((mat) => mat.dispose());
        this.matElecDeviceCache.clear();
        this.matStairMarkerCache.forEach((mat) => mat.dispose());
        this.matStairMarkerCache.clear();
        // Luces de fixtures
        this.scene.lights
            .filter((l) => l.name.startsWith('light_'))
            .forEach((l) => l.dispose());
    }
}
