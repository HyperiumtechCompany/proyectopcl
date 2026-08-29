/**
 * Editor3DCanvas.tsx - Vista 3D del editor DIAlux (Babylon.js)
 *
 * Controles de camara:
 *   - Click izquierdo + arrastrar -> orbitar
 *   - Click derecho + arrastrar   -> pan
 *   - Rueda                       -> zoom
 *   - Doble click                 -> reset camara
 *
 * Memory safety:
 *   - Las luces de fixtures se eliminan al inicio de cada syncScene().
 *   - La suscripcion al store se limpia al desmontar el componente.
 *   - Babylon Engine no se destruye en el cleanup porque el componente
 *     persiste y solo se oculta al cambiar entre 2D y 3D.
 */

import {
    ArcRotateCamera,
    Color3,
    Color4,
    Engine,
    HemisphericLight,
    MeshBuilder,
    Scene,
    StandardMaterial,
    Vector3,
} from '@babylonjs/core';
import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
    resolveFixtureRenderHeight,
    resolveRoomCeilingHeight,
} from '@/pages/dialux/engine/fixtureHeights';
import { House3DBuilder } from '@/pages/dialux/engine/House3DBuilder';
import {
    computeWorldOrigin,
    translateLightingResultForRender,
    translateSceneForRender,
    type WorldOrigin,
} from '@/pages/dialux/engine/sceneWorldOrigin';
import { findAmbientSpaceAtPoint } from '@/pages/dialux/hooks/ambientSpaces';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';

interface Props {
    isVisible?: boolean;
}

export const Editor3DCanvas = memo(function Editor3DCanvas({
    isVisible,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const builderRef = useRef<House3DBuilder | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const syncFrameRef = useRef<number | null>(null);
    /**
     * Offset aplicado a la geometría 3D cuando el proyecto está georreferenciado
     * lejos del origen (ver `sceneWorldOrigin.ts`). `null` = sin traslación. El
     * picking 3D suma esto de vuelta para escribir coordenadas del store reales.
     */
    const worldOriginRef = useRef<WorldOrigin | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
        });
        engineRef.current = engine;

        const scene = new Scene(engine);
        sceneRef.current = scene;
        scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);
        scene.ambientColor = new Color3(0.1, 0.1, 0.15);

        const camera = new ArcRotateCamera(
            'cam3d',
            -Math.PI / 4,
            Math.PI / 3.5,
            14,
            Vector3.Zero(),
            scene,
        );
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 60;
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = Math.PI / 2.1;
        camera.wheelDeltaPercentage = 0.02;
        camera.panningSensibility = 80;
        cameraRef.current = camera;

        const ground = MeshBuilder.CreateGround(
            'world_ground',
            { width: 50, height: 50 },
            scene,
        );
        const groundMat = new StandardMaterial('mat_ground', scene);
        groundMat.diffuseColor = new Color3(0.06, 0.07, 0.09);
        groundMat.specularColor = Color3.Black();
        ground.material = groundMat;
        ground.receiveShadows = true;
        ground.position.y = -0.02;

        const hemi = new HemisphericLight(
            'hemi_base',
            new Vector3(0, 1, 0),
            scene,
        );
        hemi.intensity = 0.15;
        hemi.groundColor = new Color3(0.05, 0.05, 0.08);

        const builder = new House3DBuilder(scene, camera);
        builder.setupLights();
        builderRef.current = builder;

        scene.onPointerDown = (_evt, pickResult) => {
            if (_evt.button !== 0) return;
            const st = useEditorStore.getState();
            if (
                st.ui.activeTool === 'fixture' &&
                pickResult.hit &&
                pickResult.pickedPoint
            ) {
                const editorScene = st.activeScene();
                if (!editorScene) return;
                // El punto pickeado está en el espacio 3D trasladado; se suma
                // el offset de regreso para escribir coordenadas del store reales.
                const origin = worldOriginRef.current;
                const pickedX = pickResult.pickedPoint.x + (origin?.x ?? 0);
                const pickedY = pickResult.pickedPoint.z + (origin?.y ?? 0);
                const ambient = findAmbientSpaceAtPoint(editorScene, {
                    x: pickedX,
                    y: pickedY,
                });

                const t = st.ui.fixtureTemplate;
                const fixtureType = t.fixtureType ?? 'recessed';
                const ceilingHeight = ambient
                    ? resolveRoomCeilingHeight(ambient.room, editorScene.walls)
                    : undefined;
                const fixtureHeight = resolveFixtureRenderHeight(
                    {
                        z: t.z ?? (ceilingHeight ? ceilingHeight - 0.08 : 2.4),
                        fixtureType,
                        emergencyType: t.emergencyType,
                    },
                    ceilingHeight,
                );
                const id = st.addFixture({
                    // Conserva todos los campos del catálogo (dimensiones, IP/IK,
                    // catalogSymbol, emergencyType, etc.) — antes se perdían al
                    // colocar la luminaria, dejándola sin su identidad de catálogo.
                    ...t,
                    name: t.name ?? `Luminaria ${ambient?.name ?? 'exterior'}`,
                    x: ambient?.centroid.x ?? pickedX,
                    y: ambient?.centroid.y ?? pickedY,
                    z: fixtureHeight,
                    lumens: t.lumens ?? 4000,
                    power: t.power,
                    efficiency: t.efficiency ?? 0.8,
                    fixtureType,
                    fixtureShape: t.fixtureShape ?? 'rectangular',
                    brand: t.brand,
                    articleNumber: t.articleNumber,
                    productId: t.productId,
                    productSourceFormat: t.productSourceFormat,
                    lightColor: t.lightColor ?? '#fff5e1',
                    roomId: ambient?.room.id,
                });
                st.setSelectedId(id);
                st.setTool('select');
            }
        };

        engine.runRenderLoop(() => scene.render());

        const onResize = () => engine.resize();
        globalThis.addEventListener('resize', onResize);

        const unsub = useEditorStore.subscribe(
            (state) => ({
                sceneId: state.activeSceneId,
                scenes: state.project?.scenes,
                resultsByRoom: state.resultsByRoom,
                showIsolux: state.ui.showIsolux,
                isoluxMode: state.ui.isoluxMode,
                showRoof: state.ui.showRoof,
                showAllFloors: state.ui.showAllFloors,
                // Serialize visibilities so toggling a floor's visibility triggers re-render
                sceneVisibilities: state.project?.scenes
                    .map((s) => `${s.id}:${s.visible ?? true}`)
                    .join(','),
            }),
            (_snapshot) => {
                const state = useEditorStore.getState();
                const allScenes = state.project?.scenes ?? [];
                const activeSceneId = state.activeSceneId;
                if (!builderRef.current || allScenes.length === 0) return;

                if (syncFrameRef.current !== null) {
                    cancelAnimationFrame(syncFrameRef.current);
                }

                syncFrameRef.current = requestAnimationFrame(() => {
                    syncFrameRef.current = null;
                    if (!builderRef.current || scene.isDisposed) return;

                    const freshState = useEditorStore.getState();
                    // Antes se pasaba un único `state.result` (el ambiente
                    // seleccionado) — con 2+ ambientes calculados en el mismo
                    // piso (ej. Aula 1°/Aula 2°) el isolux 3D solo mostraba
                    // uno. Ahora se pasan TODOS los resultados del piso
                    // activo (`resultsByRoom`, la misma fuente que ya usa la
                    // tabla de resultados 2D para mostrar ambos).
                    const activeScene = (freshState.project?.scenes ?? []).find(
                        (s) => s.id === freshState.activeSceneId,
                    );
                    const activeRoomIds = new Set(
                        (activeScene?.rooms ?? []).map((r) => r.id),
                    );
                    const activeResults = Object.entries(
                        freshState.resultsByRoom,
                    )
                        .filter(([roomId]) => {
                            const baseId = roomId.split('::ambient-')[0]!;
                            return activeRoomIds.has(baseId);
                        })
                        .map(([, result]) => result);

                    // Recentrado para planos georreferenciados (UTM): el
                    // `House3DBuilder` recibe copias trasladadas al origen; el
                    // store no se toca (ver `sceneWorldOrigin.ts`). Para un
                    // proyecto normal `origin` es `null` y no se copia nada.
                    const sourceScenes = freshState.project?.scenes ?? [];
                    const origin = computeWorldOrigin(sourceScenes);
                    worldOriginRef.current = origin;
                    const renderScenes = origin
                        ? sourceScenes.map((s) =>
                              translateSceneForRender(s, origin),
                          )
                        : sourceScenes;
                    const renderResults = origin
                        ? activeResults.map((r) =>
                              translateLightingResultForRender(r, origin),
                          )
                        : activeResults;

                    builderRef.current.syncAllFloors(
                        renderScenes,
                        renderResults,
                        freshState.ui.showIsolux,
                        freshState.ui.isoluxMode,
                        freshState.ui.showRoof,
                        freshState.activeSceneId,
                        freshState.ui.showAllFloors,
                    );
                });
            },
        );

        return () => {
            globalThis.removeEventListener('resize', onResize);
            unsub();
            if (syncFrameRef.current !== null) {
                cancelAnimationFrame(syncFrameRef.current);
                syncFrameRef.current = null;
            }
            builderRef.current?.dispose();
            engineRef.current = null;
            sceneRef.current = null;
            builderRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (isVisible && engineRef.current) {
            const raf = requestAnimationFrame(() => {
                engineRef.current?.resize();
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [isVisible]);

    const handleDoubleClick = useCallback(() => {
        const cam = cameraRef.current;
        if (!cam) return;
        cam.alpha = -Math.PI / 4;
        cam.beta = Math.PI / 3.5;
        cam.radius = 14;
        cam.target = Vector3.Zero();
    }, []);

    return (
        <div className="relative h-full w-full bg-[#0d1117]">
            <canvas
                id="babylon-3d-canvas"
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    touchAction: 'none',
                }}
                onDoubleClick={handleDoubleClick}
            />

            <div className="pointer-events-none absolute right-3 bottom-3 space-y-0.5 text-right font-mono text-[9px] text-gray-600 dark:text-gray-600">
                <div>{'Arrastrar -> orbitar'}</div>
                <div>{'Derecho -> pan'}</div>
                <div>{'Rueda -> zoom'}</div>
                <div>{'Dbl click -> reset'}</div>
            </div>

            <div className="pointer-events-none absolute top-2 right-2 rounded border border-purple-800/40 bg-purple-900/60 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-purple-300">
                BABYLON.JS 3D
            </div>
        </div>
    );
});
