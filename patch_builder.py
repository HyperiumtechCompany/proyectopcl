import re

with open('resources/js/editor/renderers/3d/engines/House3DBuilder.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update buildRoom signature
content = content.replace(
    '''    private buildRoom(
        room: Room,
        showRoof: boolean,
        ceilingHeight: number = room.height,
    ) {''',
    '''    private buildRoom(
        room: Room,
        showRoof: boolean,
        ceilingHeight: number = room.height,
        allWindows: Window[] = [],
        allDoors: Door[] = [],
        allWalls: Wall[] = []
    ) {'''
)

# 2. Update syncScene calling buildRoom
content = content.replace(
    '''        rooms.forEach((r) =>
            this.buildRoom(r, showRoof, roomHeights.get(r.id) ?? r.height),
        );''',
    '''        rooms.forEach((r) =>
            this.buildRoom(r, showRoof, roomHeights.get(r.id) ?? r.height, editorScene.windows || [], editorScene.doors || [], editorScene.walls || []),
        );'''
)

# 3. Add getAperturesForSegment method right above buildWall
aperture_method = """
    private getAperturesForSegment(
        v1: { x: number; y: number },
        v2: { x: number; y: number },
        allWindows: Window[],
        allDoors: Door[],
        allWalls: Wall[]
    ) {
        const aps: any[] = [];
        const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
        if (segLen < 0.01) return aps;

        const dx = (v2.x - v1.x) / segLen;
        const dy = (v2.y - v1.y) / segLen;

        const checkAperture = (ap: any, type: 'window' | 'door') => {
            const wall = allWalls.find((w) => w.id === ap.wallId);
            if (!wall) return;
            const pt = this.getPointAtOffset(wall.vertices, ap.offsetAlongWall + ap.width / 2);
            
            const t = ((pt.x - v1.x) * dx + (pt.y - v1.y) * dy);
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
                    sillHeight: ap.sillHeight || 0
                });
            }
        };

        allWindows.forEach(w => checkAperture(w, 'window'));
        allDoors.forEach(d => checkAperture(d, 'door'));

        return aps.sort((a, b) => a.localOffset - b.localOffset);
    }

    private buildWallSegment(
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
        renderGlassAndFrame: boolean
    ) {
        if (allAps.length === 0) {
            const m = this.createWallBox(
                `${idPrefix}_solid`,
                segLen,
                height,
                thickness,
                0,
                height / 2,
            );
            this.positionWallBox(m, cx, cz, angleRad);
            m.material = this.matWall;
            m.receiveShadows = true;
            this.shadowGen?.addShadowCaster(m);
            meshes.push(m);
        } else {
            let cursor = 0;
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
                    this.positionWallBoxOffset(m, [v1, v2], subSegOffset, angleRad);
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
                        this.positionWallBoxOffset(m, [v1, v2], ap.localOffset + ap.width / 2, angleRad);
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
                        this.positionWallBoxOffset(glass, [v1, v2], ap.localOffset + ap.width / 2, angleRad);
                        glass.material = this.matGlass;
                        meshes.push(glass);

                        [
                            { w: 0.05, h: ap.height + 0.06, y: glassY, off: ap.localOffset + 0.025 },
                            { w: 0.05, h: ap.height + 0.06, y: glassY, off: ap.localOffset + ap.width - 0.025 },
                        ].forEach((j, ji) => {
                            const jamba = this.createWallBox(
                                `${idPrefix}_jamba_${ap.id}_${ji}`,
                                j.w, j.h, thickness + 0.02, 0, j.y,
                            );
                            this.positionWallBoxOffset(jamba, [v1, v2], j.off, angleRad);
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
                    this.positionWallBoxOffset(m, [v1, v2], ap.localOffset + ap.width / 2, angleRad);
                    m.material = this.matWall;
                    m.receiveShadows = true;
                    this.shadowGen?.addShadowCaster(m);
                    meshes.push(m);
                }

                cursor = Math.max(cursor, ap.localOffset + ap.width);
            });

            if (cursor < segLen - 0.01) {
                const subSegLen = segLen - cursor;
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
"""

content = content.replace("    // ── Pared (Wall)", aperture_method + "\n    // ── Pared (Wall)")

# 4. Modify buildRoom exterior wall generation to use getAperturesForSegment and buildWallSegment
room_wall_old = '''        // Paredes exteriores: una caja vertical por cada arista del polígono
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
                `recinto_wall_${room.id}_${i}`,
                {
                    width: segLen + EXTERIOR_WALL_THICKNESS,
                    height: ceilingHeight,
                    depth: EXTERIOR_WALL_THICKNESS,
                },
                this.scene,
            );
            wallBox.position.set(cx, ceilingHeight / 2, cz);
            wallBox.rotation.y = -angle;
            wallBox.material = this.matWall;
            wallBox.receiveShadows = true;
            this.shadowGen?.addShadowCaster(wallBox);
            meshes.push(wallBox);
        }'''

room_wall_new = '''        // Paredes exteriores: una pared dividida en sub-segmentos si tiene aperturas
        const verts = room.vertices;
        for (let i = 0; i < verts.length; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % verts.length];
            const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
            if (segLen < 0.01) continue;

            const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const cx = (v1.x + v2.x) / 2;
            const cz = (v1.y + v2.y) / 2;

            const allAps = this.getAperturesForSegment(v1, v2, allWindows, allDoors, allWalls);
            
            this.buildWallSegment(
                `recinto_wall_${room.id}_${i}`,
                v1, v2,
                segLen + EXTERIOR_WALL_THICKNESS,
                ceilingHeight,
                EXTERIOR_WALL_THICKNESS,
                angle,
                cx, cz,
                allAps,
                meshes,
                false
            );
        }'''

content = content.replace(room_wall_old, room_wall_new)

# 5. Modify buildWall to use buildWallSegment
wall_old_chunk = '''            if (allAps.length === 0) {
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
            }'''

wall_new_chunk = '''            this.buildWallSegment(
                `wall_${wall.id}_seg${i}`,
                v1, v2,
                segLen,
                wall.height,
                wall.thickness,
                angle,
                cx, cy,
                allAps,
                meshes,
                true // Renderizar vidrio y marco en paredes interiores explícitas
            );'''

content = content.replace(wall_old_chunk, wall_new_chunk)

with open('resources/js/editor/renderers/3d/engines/House3DBuilder.ts', 'w', encoding='utf-8') as f:
    f.write(content)
