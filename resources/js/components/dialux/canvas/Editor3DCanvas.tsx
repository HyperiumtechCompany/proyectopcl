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
} from '@/editor/renderers/3d/engines/fixtureHeights';
import { House3DBuilder } from '@/editor/renderers/3d/engines/House3DBuilder';
import { findAmbientSpaceAtPoint } from '@/hooks/dialux/ambientSpaces';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';

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
                const pickedX = pickResult.pickedPoint.x;
                const pickedY = pickResult.pickedPoint.z;
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
                    },
                    ceilingHeight,
                );
                const id = st.addFixture({
                    name: t.name ?? `Luminaria ${ambient?.name ?? 'exterior'}`,
                    x: ambient?.centroid.x ?? pickedX,
                    y: ambient?.centroid.y ?? pickedY,
                    z: fixtureHeight,
                    lumens: t.lumens ?? 4000,
                    power: t.power,
                    efficiency: t.efficiency ?? 0.8,
                    fixtureType,
                    fixtureShape: t.fixtureShape ?? 'round',
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
                result: state.result,
                showIsolux: state.ui.showIsolux,
                isoluxMode: state.ui.isoluxMode,
                showRoof: state.ui.showRoof,
                showAllFloors: state.ui.showAllFloors,
            }),
            ({ result, showIsolux, isoluxMode, showRoof, showAllFloors }) => {
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

                    builderRef.current.syncAllFloors(
                        allScenes,
                        result ?? null,
                        showIsolux,
                        isoluxMode,
                        showRoof,
                        activeSceneId,
                        showAllFloors,
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

            <div className="pointer-events-none absolute right-3 bottom-3 space-y-0.5 text-right font-mono text-[9px] text-gray-600">
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
