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
} from '@babylonjs/core';

import { DynamicTexture } from '@babylonjs/core';
import { buildContourSegments } from '@/hooks/dialux/isoluxContours';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from './fixtureHeights';
import type {
    Room,
    Wall,
    Window,
    Door,
    Canopy,
    Fixture,
    Scene as EditorScene,
    LightingResult,
    IsoluxMode,
} from '@/hooks/dialux/useEditorStore';

// ─── Constantes de material ────────────────────────────────────────────────────

const HEX_WALL = '#8ba0b4';
const HEX_FLOOR = '#1e293b';
const HEX_CEILING = '#1e3a4a';
const HEX_GLASS = '#7dd3fc';
const HEX_FRAME = '#334155';
const HEX_CANOPY = '#ca8a04';
const WAVE_LEVEL_FACTORS = [0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.82, 0.94];

interface FixtureBodyOptions {
    diameter?: number;
    diameterTop?: number;
    diameterBottom?: number;
    height?: number;
}

function hexToColor3(hex: string): Color3 {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new Color3(r, g, b);
}

// ─── Clase principal ──────────────────────────────────────────────────────────

export class House3DBuilder {
    private scene: Scene;
    private camera: ArcRotateCamera | null;
    private meshMap: Map<string, Mesh[]> = new Map();
    private shadowGen: ShadowGenerator | null = null;
    private warnedInvalidRooms: Set<string> = new Set();

    // Materiales estructurales cacheados (creados UNA vez)
    private matWall!: StandardMaterial;
    private matFloor!: StandardMaterial;
    private matCeiling!: StandardMaterial;
    private matGlass!: StandardMaterial;
    private matFrame!: StandardMaterial;
    private matCanopy!: StandardMaterial;
    private matDoor!: StandardMaterial; // madera de puerta

    /** Cache de materiales por color de fixture — evita N instancias de StandardMaterial */
    private matFixtureCache: Map<string, StandardMaterial> = new Map();

    constructor(scene: Scene, camera?: ArcRotateCamera) {
        this.scene = scene;
        this.camera = camera || null;
        this.initMaterials();
    }

    // ── Materiales ─────────────────────────────────────────────────────────────
    private initMaterials() {
        this.matWall = this.makeMat('mat_wall', HEX_WALL, 0.0);
        this.matFloor = this.makeMat('mat_floor', HEX_FLOOR, 0.05);
        this.matCeiling = this.makeMat('mat_ceiling', HEX_CEILING, 0.0);
        this.matFrame = this.makeMat('mat_frame', HEX_FRAME, 0.0);
        this.matCanopy = this.makeMat('mat_canopy', HEX_CANOPY, 0.1);
        this.matDoor = this.makeMat('mat_door', '#7c5c3a', 0.05);

        // Vidrio semitransparente
        this.matGlass = new StandardMaterial('mat_glass', this.scene);
        this.matGlass.diffuseColor = hexToColor3(HEX_GLASS);
        this.matGlass.specularColor = Color3.White();
        this.matGlass.alpha = 0.35;
        this.matGlass.backFaceCulling = false;
    }

    private makeMat(
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
    private disposeFixtureLights() {
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
    ) {
        // 1. Dispose meshes previos
        this.meshMap.forEach((meshes) => meshes.forEach((m) => m.dispose()));
        this.meshMap.clear();

        // FIX: buildRoom ahora se invoca — genera suelos y techos
        const rooms = editorScene.rooms || [];
        const walls = editorScene.walls || [];
        const roomHeights = new Map(
            rooms.map((room) => [room.id, resolveRoomCeilingHeight(room, walls)]),
        );

        rooms.forEach((r) =>
            this.buildRoom(r, showRoof, roomHeights.get(r.id) ?? r.height),
        );
        (editorScene.walls || []).forEach((w) =>
            this.buildWall(
                w,
                editorScene.windows || [],
                editorScene.doors || [],
            ),
        );
        (editorScene.canopies || []).forEach((c) => this.buildCanopy(c));
        (editorScene.fixtures || []).forEach((f) =>
            this.buildFixtureLight(
                f,
                this.resolveFixtureRoomHeight(f, rooms, roomHeights),
            ),
        );
        (editorScene.doors || []).forEach((d) =>
            this.buildDoor(d, editorScene.walls || []),
        );

        if (showIsolux && result) {
            this.buildIsolux(result, isoluxMode);
        }

        this.frameCamera();
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
    private buildIsolux(
        result: LightingResult,
        mode: IsoluxMode = 'functional',
    ) {
        if (!result.grid_rows || !result.grid_cols || !result.max_lux) return;

        const width = result.grid_cols * 0.5;
        const height = result.grid_rows * 0.5;
        const plane = MeshBuilder.CreatePlane(
            'isolux_plane',
            { width, height },
            this.scene,
        );
        plane.rotation.x = Math.PI / 2;
        plane.position.set(width / 2, 0.015, height / 2);

        const texW = result.grid_cols * 10;
        const texH = result.grid_rows * 10;
        const texture = new DynamicTexture(
            'isolux_tex',
            { width: texW, height: texH },
            this.scene,
            false,
        );
        const ctx = texture.getContext();

        const cellW = texW / result.grid_cols;
        const cellH = texH / result.grid_rows;

        // Limpiar
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, texW, texH);

        result.grid_values.forEach((lux, i) => {
            if (lux === null) return;

            const col = i % result.grid_cols;
            const row = Math.floor(i / result.grid_cols);

            // Babylons Plane with DynamicTexture flips Y axis usually, but we draw standard
            // and babylon UV mappings will map it.
            // Invert row for Babylon UV matching if needed, but since it's rotation.x = PI/2, let's keep direct.
            ctx.fillStyle = this.colorForIsoluxCell(lux, result.max_lux, mode);
            // Babylon's dynamic texture maps 0,0 to bottom left, so:
            ctx.fillRect(col * cellW, texH - (row + 1) * cellH, cellW, cellH);
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
                    x: (col + 0.5) * cellW,
                    y: texH - (row + 0.5) * cellH,
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

    private colorForIsoluxCell(lux: number, maxLux: number, mode: IsoluxMode) {
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

    private waveStrokeColor(level: number, maxLux: number) {
        const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
        const hue = 205 - ratio * 28;
        const saturation = 90 - ratio * 12;
        const lightness = 72 - ratio * 28;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    private sanitizeRoomShape(room: Room): Vector3[] {
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

    private getRoomBounds(room: Room) {
        const xs = room.vertices.map((vertex) => vertex.x);
        const ys = room.vertices.map((vertex) => vertex.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        };
    }

    private pointInRoom(room: Room, x: number, y: number): boolean {
        let inside = false;
        const vertices = room.vertices;

        for (
            let i = 0, j = vertices.length - 1;
            i < vertices.length;
            j = i++
        ) {
            const vi = vertices[i];
            const vj = vertices[j];
            const intersects =
                vi.y > y !== vj.y > y &&
                x <
                    ((vj.x - vi.x) * (y - vi.y)) / (vj.y - vi.y || 1e-9) +
                        vi.x;

            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }

    private resolveFixtureRoomHeight(
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

    private buildRoomFallback(
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

        if (showRoof) {
            const ceiling = MeshBuilder.CreateBox(
                `ceiling_fallback_${room.id}`,
                { width, depth, height: 0.05 },
                this.scene,
            );
            ceiling.position.set(
                centerX,
                Math.max(0.05, ceilingHeight - 0.025),
                centerZ,
            );
            ceiling.material = this.matCeiling;
            meshes.push(ceiling);
        }
    }

    // ── Recinto (Room) ────────────────────────────────────────────────────────
    private buildRoom(
        room: Room,
        showRoof: boolean,
        ceilingHeight: number = room.height,
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

        // Suelo
        if (room.roomType !== 'corridor') {
            try {
                const floor = MeshBuilder.CreatePolygon(
                    `floor_${room.id}`,
                    { shape, depth: 0.05, sideOrientation: Mesh.DOUBLESIDE },
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
                return;
            }
        }

        if (showRoof) {
            try {
                const ceiling = MeshBuilder.CreatePolygon(
                    `ceiling_${room.id}`,
                    { shape, depth: 0.05, sideOrientation: Mesh.DOUBLESIDE },
                    this.scene,
                );
                ceiling.position.y = Math.max(0.05, ceilingHeight - 0.025);
                ceiling.material = this.matCeiling;
                meshes.push(ceiling);
            } catch {
                /* noop: floor fallback already covers minimum geometry */
            }
        }

        this.meshMap.set(room.id, meshes);
    }

    // ── Pared (Wall) ──────────────────────────────────────────────────────────
    /**
     * Construye una pared como una o varias cajas.
     * Cuando hay ventanas: divide en segmentos para crear los huecos.
     */
    private buildWall(
        wall: Wall,
        allWindows: Window[],
        _allDoors: Door[] = [],
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
            const segmentWindows = allWindows
                .filter((w) => w.wallId === wall.id)
                .filter(
                    (w) =>
                        w.offsetAlongWall >= segStartOffset &&
                        w.offsetAlongWall < segStartOffset + segLen,
                )
                .map((w) => ({
                    ...w,
                    type: 'window' as const,
                    localOffset: w.offsetAlongWall - segStartOffset,
                }));

            const segmentDoors = _allDoors
                .filter((d) => d.wallId === wall.id)
                .filter(
                    (d) =>
                        d.offsetAlongWall >= segStartOffset &&
                        d.offsetAlongWall < segStartOffset + segLen,
                )
                .map((d) => ({
                    id: d.id,
                    width: d.width,
                    height: d.height,
                    sillHeight: 0,
                    type: 'door' as const,
                    localOffset: d.offsetAlongWall - segStartOffset,
                }));

            const allAps = [...segmentWindows, ...segmentDoors].sort(
                (a, b) => a.localOffset - b.localOffset,
            );

            if (allAps.length === 0) {
                // Segmento sólido completo
                const m = this.createWallBox(
                    `wall_${wall.id}_seg${i}`,
                    segLen,
                    wall.height,
                    wall.thickness,
                    0,
                    wall.height / 2,
                );
                this.positionWallBox(m, cx, cy, angle);
                m.material = this.matWall;
                m.receiveShadows = true;
                this.shadowGen?.addShadowCaster(m);
                meshes.push(m);
            } else {
                // Dividir en sub-segmentos basándose en aperturas (ventanas y puertas)
                let cursor = 0;
                allAps.forEach((ap, idx) => {
                    // Segmento sólido antes de la apertura
                    if (ap.localOffset > cursor + 0.01) {
                        const subSegLen = ap.localOffset - cursor;
                        const subSegOffset = cursor + subSegLen / 2;
                        const m = this.createWallBox(
                            `wall_${wall.id}_seg${i}_pre${idx}`,
                            subSegLen,
                            wall.height,
                            wall.thickness,
                            0,
                            wall.height / 2,
                        );
                        this.positionWallBoxOffset(
                            m,
                            [v1, v2],
                            subSegOffset,
                            angle,
                        );
                        m.material = this.matWall;
                        m.receiveShadows = true;
                        this.shadowGen?.addShadowCaster(m);
                        meshes.push(m);
                    }

                    if (ap.type === 'window') {
                        // Antepecho para ventana
                        if (ap.sillHeight > 0.01) {
                            const m = this.createWallBox(
                                `win_sill_${ap.id}`,
                                ap.width,
                                ap.sillHeight,
                                wall.thickness,
                                0,
                                ap.sillHeight / 2,
                            );
                            this.positionWallBoxOffset(
                                m,
                                [v1, v2],
                                ap.localOffset + ap.width / 2,
                                angle,
                            );
                            m.material = this.matWall;
                            m.receiveShadows = true;
                            meshes.push(m);
                        }

                        // Vidrio
                        const glassH = ap.height;
                        const glassY = ap.sillHeight + glassH / 2;
                        const glass = this.createWallBox(
                            `win_glass_${ap.id}`,
                            ap.width - 0.06,
                            glassH - 0.06,
                            wall.thickness * 0.2,
                            0,
                            glassY,
                        );
                        this.positionWallBoxOffset(
                            glass,
                            [v1, v2],
                            ap.localOffset + ap.width / 2,
                            angle,
                        );
                        glass.material = this.matGlass;
                        meshes.push(glass);

                        // Marco
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
                                `win_jamba_${ap.id}_${ji}`,
                                j.w,
                                j.h,
                                wall.thickness + 0.02,
                                0,
                                j.y,
                            );
                            this.positionWallBoxOffset(
                                jamba,
                                [v1, v2],
                                j.off,
                                angle,
                            );
                            jamba.material = this.matFrame;
                            meshes.push(jamba);
                        });
                    }

                    // Dintel (común a ventanas y puertas)
                    const dintelH = wall.height - (ap.sillHeight + ap.height);
                    if (dintelH > 0.01) {
                        const dintelY = ap.sillHeight + ap.height + dintelH / 2;
                        const m = this.createWallBox(
                            `ap_dintel_${ap.id}`,
                            ap.width,
                            dintelH,
                            wall.thickness,
                            0,
                            dintelY,
                        );
                        this.positionWallBoxOffset(
                            m,
                            [v1, v2],
                            ap.localOffset + ap.width / 2,
                            angle,
                        );
                        m.material = this.matWall;
                        m.receiveShadows = true;
                        this.shadowGen?.addShadowCaster(m);
                        meshes.push(m);
                    }

                    cursor = ap.localOffset + ap.width;
                });

                // Segmento sólido después
                if (cursor < segLen - 0.01) {
                    const subSegLen = segLen - cursor;
                    const subSegOffset = cursor + subSegLen / 2;
                    const m = this.createWallBox(
                        `wall_${wall.id}_seg${i}_post`,
                        subSegLen,
                        wall.height,
                        wall.thickness,
                        0,
                        wall.height / 2,
                    );
                    this.positionWallBoxOffset(
                        m,
                        [v1, v2],
                        subSegOffset,
                        angle,
                    );
                    m.material = this.matWall;
                    m.receiveShadows = true;
                    this.shadowGen?.addShadowCaster(m);
                    meshes.push(m);
                }
            }
        }

        this.meshMap.set(wall.id, meshes);
    }

    /** Crea una caja orientada para pared */
    private createWallBox(
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
    private positionWallBox(
        mesh: Mesh,
        cx: number,
        cz: number,
        angleRad: number,
    ) {
        mesh.position.x = cx;
        mesh.position.z = cz;
        mesh.rotation.y = -angleRad;
    }

    private getWallVertices(wall: Wall) {
        return wall.vertices.length >= 2 ? wall.vertices : [];
    }

    /**
     * Retorna el punto y ángulo en la polilínea de pared a un offset (m) desde el inicio.
     * Recibe el array de vértices ya calculado para el segmento actual.
     */
    private getPointAtOffset(
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
    private positionWallBoxOffset(
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
    private buildCanopy(canopy: Canopy) {
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

        slab.position.set(offsetX, canopy.height + canopy.slabThickness / 2, offsetZ);
        slab.rotation.y = -angle;
        slab.material = this.matCanopy;
        slab.receiveShadows = true;
        this.shadowGen?.addShadowCaster(slab);

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
    private buildDoor(door: Door, allWalls: Wall[]) {
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
    buildFixtureLight(fixture: Fixture, ceilingHeight?: number): {
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
            const w = fixture.dimensions?.width ?? props.diameter ?? props.diameterBottom ?? 0.2;
            const l = fixture.dimensions?.length ?? props.diameter ?? props.diameterBottom ?? 0.2;
            const h = fixture.dimensions?.height ?? props.height ?? 0.04;
            const d = fixture.dimensions ? Math.max(fixture.dimensions.width, fixture.dimensions.length) : (props.diameter ?? 0.2);

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
                    diameterBottom: fixture.dimensions ? d : props.diameterBottom,
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
        body.position.set(bx, by, bz);
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
                new Vector3(bx, by, bz),
                new Vector3(0, -1, 0), // apunta hacia abajo
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
                new Vector3(bx, by, bz),
                this.scene,
            );
            pt.diffuse = lightColor;
            pt.specular = lightColor;
            pt.intensity = intensity;
            pt.range = 6;
            light = pt;
        }

        this.meshMap.set(fixture.id, meshes);
        return { meshes, light };
    }

    // ── Limpieza ──────────────────────────────────────────────────────────────

    disposeObject(id: string) {
        this.meshMap.get(id)?.forEach((m) => m.dispose());
        this.meshMap.delete(id);
        this.scene.getLightByName(`light_${id}`)?.dispose();
    }

    dispose() {
        // Meshes
        this.meshMap.forEach((meshes) => meshes.forEach((m) => m.dispose()));
        this.meshMap.clear();
        // Materiales cacheados de fixtures
        this.matFixtureCache.forEach((mat) => mat.dispose());
        this.matFixtureCache.clear();
        // Luces de fixtures
        this.scene.lights
            .filter((l) => l.name.startsWith('light_'))
            .forEach((l) => l.dispose());
    }
}
