import {
    ArcRotateCamera,
    Color4,
    Engine,
    Scene,
    Vector3,
} from '@babylonjs/core';
import { Box, Layers, Maximize, SquareStack } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { SiteData } from '../domain/types';
import { SiteBuilder3D, type SiteModuleScene } from '../engine/SiteBuilder3D';

interface Props {
    siteData: SiteData;
    moduleScenes?: SiteModuleScene[];
    feederCalculations?: EdgeCalculation[];
    onReady?: () => void;
    /** `false` cuando la pestaña 2D está al frente: se pausa el render loop. */
    isActive?: boolean;
}

const VIEWS = {
    perspective: { alpha: -Math.PI / 3, beta: Math.PI / 3 },
    isometric: { alpha: -Math.PI / 4, beta: Math.PI / 4 },
    top: { alpha: -Math.PI / 2, beta: 0.08 },
} as const;

/**
 * Vista 3D read-only del emplazamiento completo (Fase 4.1). Al igual que
 * `Editor3DCanvas`, esta vista persiste montada mientras el usuario está en
 * el Módulo General: el toggle 2D/3D es estado local (no navega), así que
 * el motor Babylon se mantiene vivo y solo se pausa el render loop cuando
 * la pestaña 2D está al frente (`isActive === false`). Solo se libera al
 * salir del módulo.
 */
export function SiteViewer3D({
    siteData,
    moduleScenes = [],
    feederCalculations = [],
    onReady,
    isActive = true,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const builderRef = useRef<SiteBuilder3D | null>(null);
    const isActiveRef = useRef(isActive);
    const [showInteriors, setShowInteriors] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
        });
        engineRef.current = engine;

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.68, 0.78, 0.88, 1);

        const camera = new ArcRotateCamera(
            'site_cam',
            VIEWS.perspective.alpha,
            VIEWS.perspective.beta,
            60,
            Vector3.Zero(),
            scene,
        );
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 500;
        camera.lowerBetaLimit = 0.05;
        camera.upperBetaLimit = Math.PI / 2.05;
        camera.wheelDeltaPercentage = 0.02;
        camera.panningSensibility = 60;
        cameraRef.current = camera;

        const builder = new SiteBuilder3D(scene, camera);
        builder.setupLights();
        builderRef.current = builder;

        engine.runRenderLoop(() => {
            if (isActiveRef.current) scene.render();
        });
        const onResize = () => engine.resize();
        globalThis.addEventListener('resize', onResize);

        onReady?.();

        return () => {
            globalThis.removeEventListener('resize', onResize);
            builderRef.current?.dispose();
            scene.dispose();
            engine.dispose();
            engineRef.current = null;
            cameraRef.current = null;
            builderRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        isActiveRef.current = isActive;
        if (!isActive) return;
        // El canvas venía con display:none (tamaño 0). Esperar a que el layout
        // le dé dimensiones reales antes de `resize()` — si no, el viewport de
        // Babylon queda en 0×0 y no se ve nada (mismo patrón que v1).
        let raf = 0;
        let tries = 0;
        const kick = () => {
            const canvas = canvasRef.current;
            const engine = engineRef.current;
            if (!canvas || !engine) return;
            if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
                engine.resize();
                engine.scenes[0]?.render();
                return;
            }
            if (tries++ < 60) raf = requestAnimationFrame(kick);
        };
        raf = requestAnimationFrame(kick);
        return () => cancelAnimationFrame(raf);
    }, [isActive]);

    useEffect(() => {
        builderRef.current?.sync(
            siteData,
            moduleScenes,
            feederCalculations,
            showInteriors,
        );
    }, [siteData, moduleScenes, feederCalculations, showInteriors]);

    const setView = (view: keyof typeof VIEWS) => {
        const cam = cameraRef.current;
        if (!cam) return;
        cam.alpha = VIEWS[view].alpha;
        cam.beta = VIEWS[view].beta;
    };

    return (
        <div className="relative h-full w-full bg-sky-100 dark:bg-slate-900">
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    touchAction: 'none',
                }}
            />

            <div className="absolute top-3 left-3 flex flex-col gap-1">
                <button
                    type="button"
                    title="Vista en planta"
                    onClick={() => setView('top')}
                    className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <Layers className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    title="Vista isométrica"
                    onClick={() => setView('isometric')}
                    className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <SquareStack className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    title="Vista en perspectiva"
                    onClick={() => setView('perspective')}
                    className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <Maximize className="h-4 w-4" />
                </button>
            </div>

            <label
                title="Muestra el interior real de los módulos vinculados a un bloque de edificación — puede ser lento con muchos módulos."
                className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-semibold text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
            >
                <input
                    type="checkbox"
                    checked={showInteriors}
                    onChange={(event) => setShowInteriors(event.target.checked)}
                />
                <Box className="h-3.5 w-3.5" />
                Mostrar interiores
            </label>

            <div className="pointer-events-none absolute right-3 bottom-3 space-y-0.5 text-right font-mono text-[9px] text-slate-500 dark:text-slate-500">
                <div>{'Arrastrar -> orbitar'}</div>
                <div>{'Derecho -> pan'}</div>
                <div>{'Rueda -> zoom'}</div>
            </div>
        </div>
    );
}
