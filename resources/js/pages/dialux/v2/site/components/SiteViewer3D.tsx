import {
    ArcRotateCamera,
    Color4,
    Engine,
    Scene,
    Vector3,
} from '@babylonjs/core';
import { Box, Layers, Maximize, Moon, Sun, SquareStack, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { LightingSummary } from '../domain/exteriorLighting';
import type { SiteData } from '../domain/types';
import { SiteBuilder3D, type SiteModuleScene } from '../engine/SiteBuilder3D';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';

interface Props {
    siteData: SiteData;
    moduleScenes?: SiteModuleScene[];
    feederCalculations?: EdgeCalculation[];
    /** Fotometría (IES/LDT) de los productos usados por los postes, del catálogo compartido con v1. */
    luminairePhotometry?: Map<number, LuminairePhotometry>;
    onReady?: () => void;
    /** `false` cuando la pestaña 2D está al frente: se pausa el render loop. */
    isActive?: boolean;
}

const NO_PHOTOMETRY = new Map<number, LuminairePhotometry>();

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
    luminairePhotometry = NO_PHOTOMETRY,
    onReady,
    isActive = true,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const builderRef = useRef<SiteBuilder3D | null>(null);
    const isActiveRef = useRef(isActive);
    const [showInteriors, setShowInteriors] = useState(false);
    const [night, setNight] = useState(false);
    const [luxMap, setLuxMap] = useState(false);
    const [summary, setSummary] = useState<LightingSummary | null>(null);

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
        // `sync()` reconstruye TODA la escena (dispose + rebuild de cada
        // elemento) — con la pestaña 2D al frente esto se ejecutaba en cada
        // cambio de `siteData` (ej. cada frame de un arrastre de vértice) sin
        // que nada se viera, solo gastando CPU en el hilo principal y
        // pudiendo trabar la propia interacción 2D. Con la 3D en segundo
        // plano nadie la está viendo, así que se difiere: al volver a
        // activarla, este mismo efecto corre con el `siteData` más reciente.
        if (!isActive) return;
        const builder = builderRef.current;
        builder?.sync(
            siteData,
            moduleScenes,
            feederCalculations,
            showInteriors,
            luminairePhotometry,
        );
        // El resumen de iluminancia sale de la escena recién construida.
        queueMicrotask(() => setSummary(builder?.getLightingSummary() ?? null));
    }, [
        siteData,
        moduleScenes,
        feederCalculations,
        showInteriors,
        luminairePhotometry,
        isActive,
    ]);

    // Día / Noche y mapa de lux: el builder conserva estos modos entre reconstrucciones.
    useEffect(() => {
        builderRef.current?.setNightMode(night);
    }, [night]);
    useEffect(() => {
        builderRef.current?.setLuxMap(luxMap);
    }, [luxMap]);

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

            <div className="absolute top-14 right-3 flex flex-col items-end gap-1">
                <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white/90 text-[10px] font-semibold shadow dark:border-white/10 dark:bg-slate-900/90">
                    <button
                        type="button"
                        onClick={() => setNight(false)}
                        className={`flex items-center gap-1 px-2 py-1.5 ${!night ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'text-slate-500'}`}
                    >
                        <Sun className="h-3.5 w-3.5" /> Día
                    </button>
                    <button
                        type="button"
                        onClick={() => setNight(true)}
                        className={`flex items-center gap-1 px-2 py-1.5 ${night ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-500'}`}
                    >
                        <Moon className="h-3.5 w-3.5" /> Noche
                    </button>
                </div>
                <label
                    title="Pinta sobre el suelo la iluminancia (lux) que dan las luminarias de los postes — modelo simplificado."
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-semibold text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <input
                        type="checkbox"
                        checked={luxMap}
                        onChange={(event) => setLuxMap(event.target.checked)}
                    />
                    <Zap className="h-3.5 w-3.5" />
                    Mapa de lux
                </label>
            </div>

            {summary && (
                <div className="absolute bottom-3 left-3 max-w-xs rounded-lg border border-slate-200 bg-white/92 p-2 text-[10px] text-slate-700 shadow dark:border-white/10 dark:bg-slate-900/92 dark:text-slate-200">
                    <p className="mb-1 font-bold tracking-wide uppercase">
                        Alumbrado exterior
                    </p>
                    <p>
                        {summary.luminaires} luminarias ·{' '}
                        {Math.round(summary.fluxLm).toLocaleString('es-PE')} lm
                        en total
                    </p>
                    <p>
                        E prom {summary.avgLux.toFixed(1)} lx · mín{' '}
                        {summary.minLux.toFixed(1)} · máx{' '}
                        {summary.maxLux.toFixed(0)}
                    </p>
                    <p>
                        Uniformidad U0 = {summary.uniformity.toFixed(2)} ·{' '}
                        {Math.round(summary.areaM2).toLocaleString('es-PE')} m²
                        analizados
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                        Modelo simplificado (lm + ángulo de haz, sin archivo
                        IES/LDT ni obstáculos). No hay norma de iluminancia
                        exterior cargada: no se valida cumplimiento.
                    </p>
                </div>
            )}

            <div className="pointer-events-none absolute right-3 bottom-3 space-y-0.5 text-right font-mono text-[9px] text-slate-500 dark:text-slate-500">
                <div>{'Arrastrar -> orbitar'}</div>
                <div>{'Derecho -> pan'}</div>
                <div>{'Rueda -> zoom'}</div>
            </div>
        </div>
    );
}
