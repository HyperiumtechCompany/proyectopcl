import {
    ArcRotateCamera,
    Color4,
    Engine,
    Scene,
    Vector3,
} from '@babylonjs/core';
import { Box, Layers, Maximize, Moon, Sun, SquareStack, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ModuleLoadingOverlay } from '../../components/ModuleLoadingOverlay';
import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { LightingSummary } from '../domain/exteriorLighting';
import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import {
    dayOfYearFromDate,
    DEFAULT_LATITUDE_DEG,
    formatHour,
    sunPosition,
} from '../domain/sunPosition';
import type { SiteData } from '../domain/types';
import { SiteBuilder3D, type SiteModuleScene } from '../engine/SiteBuilder3D';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { SiteNormVerificationPanel } from './SiteNormPanels';

interface Props {
    siteData: SiteData;
    moduleScenes?: SiteModuleScene[];
    feederCalculations?: EdgeCalculation[];
    /** Fotometría (IES/LDT) de los productos usados por los postes, del catálogo compartido con v1. */
    luminairePhotometry?: Map<number, LuminairePhotometry>;
    onReady?: () => void;
    /** `false` cuando la pestaña 2D está al frente: se pausa el render loop. */
    isActive?: boolean;
    /** Aún llegan las escenas de los módulos / cálculos de la red. */
    networkLoading?: boolean;
    /**
     * Resultado de "Calcular alumbrado" (motor V1, compartido con el 2D). Con
     * él, el mapa de lux, el resumen y la verificación normativa usan esos
     * valores; sin él, la estimación rápida del 3D.
     */
    calculatedLighting?: SiteLightingCalculation | null;
    /** El cálculo es de una versión anterior de la planta. */
    calculatedLightingStale?: boolean;
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
    networkLoading = false,
    calculatedLighting = null,
    calculatedLightingStale = false,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const builderRef = useRef<SiteBuilder3D | null>(null);
    const isActiveRef = useRef(isActive);
    /** La primera construcción de la escena terminó (oculta el indicador de carga). */
    const [firstBuildDone, setFirstBuildDone] = useState(false);
    const [showInteriors, setShowInteriors] = useState(false);
    const [night, setNight] = useState(false);
    const [luxMap, setLuxMap] = useState(false);
    const [hour, setHour] = useState(10);
    const [date, setDate] = useState('2026-03-21');
    const dayOfYear = dayOfYearFromDate(date);
    const latitude = siteData.location?.lat ?? DEFAULT_LATITUDE_DEG;
    const sun = sunPosition(hour, latitude, dayOfYear);
    const [postFx, setPostFx] = useState(true);
    const [summary, setSummary] = useState<LightingSummary | null>(null);
    const [areaSummaries, setAreaSummaries] = useState<
        Record<string, LightingSummary | null>
    >({});

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
        queueMicrotask(() => {
            setFirstBuildDone(true);
            setSummary(builder?.getLightingSummary() ?? null);
            const perArea: Record<string, LightingSummary | null> = {};
            for (const el of siteData.elements) {
                if (el.normReq && el.vertices.length >= 3) {
                    perArea[el.id] = builder?.getAreaLighting(el.vertices) ?? null;
                }
            }
            setAreaSummaries(perArea);
        });
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
    useEffect(() => {
        builderRef.current?.setCalculatedLux(
            calculatedLighting
                ? // Un parche por cota: el mapa sigue plataformas y relieve.
                  calculatedLighting.areas.flatMap((area) => area.patches)
                : null,
        );
    }, [calculatedLighting]);
    // Con cálculo V1, el resumen y las normas salen de ESE cálculo.
    const shownAreaSummaries = calculatedLighting
        ? Object.fromEntries(
              calculatedLighting.areas.map((area) => [
                  area.elementId,
                  area.summary,
              ]),
          )
        : areaSummaries;
    useEffect(() => {
        builderRef.current?.setTimeOfDay(hour, dayOfYear);
    }, [hour, dayOfYear, siteData.location?.lat]);
    useEffect(() => {
        builderRef.current?.setPostFx(postFx);
    }, [postFx]);

    const setView = (view: keyof typeof VIEWS) => {
        // Los botones de vista SÍ reencuadran (la cámara ya no se resetea sola en cada edición).
        builderRef.current?.reframe(siteData);
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

            {(!firstBuildDone || networkLoading) && (
                <ModuleLoadingOverlay
                    variant={firstBuildDone ? 'overlay' : 'screen'}
                    title="Cargando vista 3D"
                    stages={[
                        {
                            id: 'site',
                            label: 'Objetos del emplazamiento',
                            status: 'done',
                            detail: `${siteData.elements.length} objetos`,
                        },
                        {
                            id: 'network',
                            label: 'Módulos y red eléctrica',
                            status: networkLoading ? 'active' : 'done',
                        },
                        {
                            id: 'scene',
                            label: 'Construyendo la escena 3D',
                            status: firstBuildDone ? 'done' : 'active',
                        },
                    ]}
                    slowHint="Proyectos con muchos objetos o interiores tardan más en construir la escena."
                />
            )}

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
                <div
                    title="Hora solar local: orienta el sol y las sombras. Si el sol está bajo el horizonte se pasa a Noche."
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-semibold text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <Sun className="h-3.5 w-3.5" />
                    <input
                        type="range"
                        min={0}
                        max={23.5}
                        step={0.5}
                        value={hour}
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            setHour(next);
                            setNight(
                                sunPosition(next, latitude, dayOfYear)
                                    .elevationDeg <= 0,
                            );
                        }}
                        className="w-24"
                    />
                    <span className="w-9 font-mono">{formatHour(hour)}</span>
                </div>
                <div className="flex flex-col items-end gap-1 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-semibold text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300">
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            value={date}
                            onChange={(event) => {
                                setDate(event.target.value);
                                setNight(
                                    sunPosition(
                                        hour,
                                        latitude,
                                        dayOfYearFromDate(event.target.value),
                                    ).elevationDeg <= 0,
                                );
                            }}
                            className="h-6 rounded border border-slate-200 bg-white px-1 text-[10px] dark:border-slate-700 dark:bg-slate-900"
                        />
                    </div>
                    <div className="flex gap-1">
                        {[
                            ['Equinoccio', '2026-03-21'],
                            ['Sol. jun', '2026-06-21'],
                            ['Sol. dic', '2026-12-21'],
                        ].map(([label, value]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => {
                                    setDate(value);
                                    setNight(
                                        sunPosition(
                                            hour,
                                            latitude,
                                            dayOfYearFromDate(value),
                                        ).elevationDeg <= 0,
                                    );
                                }}
                                className={`rounded px-1.5 py-0.5 ${date === value ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <span className="font-mono font-normal text-slate-500">
                        Sol: elev. {sun.elevationDeg.toFixed(0)}° · acimut{' '}
                        {sun.azimuthDeg.toFixed(0)}° · lat.{' '}
                        {latitude.toFixed(1)}°
                    </span>
                </div>
                <label
                    title="Suaviza los bordes (MSAA 4×) y da un halo a las luminarias de noche. Apágalo si la vista va lenta."
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-semibold text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300"
                >
                    <input
                        type="checkbox"
                        checked={postFx}
                        onChange={(event) => setPostFx(event.target.checked)}
                    />
                    Efectos
                </label>
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

            {calculatedLighting && (
                <div className="absolute bottom-3 left-3 max-w-xs rounded-lg border border-slate-200 bg-white/92 p-2 text-[10px] text-slate-700 shadow dark:border-white/10 dark:bg-slate-900/92 dark:text-slate-200">
                    <p className="mb-1 font-bold tracking-wide uppercase">
                        Alumbrado exterior · motor V1
                    </p>
                    {calculatedLightingStale && (
                        <p className="mb-1 font-semibold text-amber-600 dark:text-amber-400">
                            Desactualizado: recalcula en Emplazamiento 2D.
                        </p>
                    )}
                    {calculatedLighting.areas.map((area) => (
                        <p key={area.elementId}>
                            {area.label}: Ēm {area.result.avg_lux.toFixed(1)} lx
                            · Emín {area.result.min_lux.toFixed(1)} · U0{' '}
                            {area.result.uniformity.toFixed(2)}
                        </p>
                    ))}
                    <p className="mt-1 text-[9px] text-slate-400">
                        Mismo cálculo que "Calcular alumbrado" del 2D
                        (fotometría IES/LDT, sombras de edificios y cubiertas).
                    </p>
                </div>
            )}
            {!calculatedLighting && summary && (
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
                        Estimación rápida (sin calcular). Para el resultado
                        del motor V1 pulsa "Calcular alumbrado" en el
                        Emplazamiento 2D. La comparación con la norma es
                        numérica; no declara cumplimiento.
                    </p>
                </div>
            )}

            <SiteNormVerificationPanel
                site={siteData}
                areaSummaries={shownAreaSummaries}
                sourceLabel={
                    calculatedLighting
                        ? `motor luminotécnico V1 ("Calcular alumbrado")${calculatedLightingStale ? ' — desactualizado' : ''}`
                        : 'estimación rápida del 3D (sin calcular; no usar para verificar)'
                }
            />

            <div className="pointer-events-none absolute right-3 bottom-3 space-y-0.5 text-right font-mono text-[9px] text-slate-500 dark:text-slate-500">
                <div>{'Arrastrar -> orbitar'}</div>
                <div>{'Derecho -> pan'}</div>
                <div>{'Rueda -> zoom'}</div>
            </div>
        </div>
    );
}
