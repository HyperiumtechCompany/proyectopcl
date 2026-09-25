import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    feederLengthBreakdown,
    FEEDER_ROUTE_DEFAULTS,
    routeDepthM,
    routeMountHeightM,
    routeSagPct,
} from '../domain/aerialCableGeometry';
import {
    cablePresetsFor,
    defaultCableForKind,
    FEEDER_CABLE_PRESETS,
} from '../domain/feederCables';
import type { FeederRoute, Point2D } from '../domain/types';

const inputClass =
    'mt-1 h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

/** Forma mínima que necesita este panel — la comparten `FeederPath` (alimentador de la red) y `SiteCircuit` (cableado de instalaciones). */
export interface RoutableEntity {
    id: string;
    waypoints: Point2D[];
    route?: FeederRoute;
    segmentModes?: Array<'aerial' | 'underground'>;
    wastePct?: number;
}

/**
 * Tendido de un trazado exterior: plano (solo planta), aéreo entre postes o
 * subterráneo con cajas de paso. Sirve tanto para un alimentador de la red
 * troncal (`context="feeder"`, por defecto) como para un circuito de
 * instalaciones (`context="circuit"` — no entra al cálculo de caída de
 * tensión, así que el pie de página lo aclara en vez de citar la red).
 */
export function SiteFeederRoutePanel({
    path,
    scaleM,
    context = 'feeder',
    onSetRoute,
    elevationsM,
    onWastePctChange,
}: {
    path: RoutableEntity;
    scaleM: number;
    context?: 'feeder' | 'circuit';
    /** Ausente = `setFeederRoute` de la red (comportamiento previo). */
    onSetRoute?: (
        id: string,
        route: FeederRoute | undefined,
        segmentModes?: Array<'aerial' | 'underground'>,
    ) => void;
    elevationsM?: number[];
    onWastePctChange?: (value: number) => void;
}) {
    const setFeederRoute = useEditorStore((s) => s.setFeederRoute);
    const applyRoute = onSetRoute ?? setFeederRoute;
    const route = path.route;
    const modes = path.segmentModes ?? [];
    const airCount = modes.filter((m) => m === 'aerial').length;
    const groundCount = modes.length - airCount;
    const mixed = airCount > 0 && groundCount > 0;
    const breakdown = feederLengthBreakdown(
        path.waypoints,
        scaleM,
        route,
        path.segmentModes,
        elevationsM,
        context === 'circuit' ? (path.wastePct ?? 5) : 0,
    );

    const patch = (next: Partial<FeederRoute>) => {
        if (!route) return;
        applyRoute(path.id, { ...route, ...next }, path.segmentModes);
    };
    // Caja de paso en el punto medio del tramo más largo (el usuario la ajusta con el resto del trazado).
    const addBox = () => {
        if (
            !route ||
            !(route.kind === 'underground' || groundCount > 0) ||
            path.waypoints.length < 2
        )
            return;
        let best = 0;
        let bestLen = -1;
        for (let i = 1; i < path.waypoints.length; i++) {
            const len = Math.hypot(
                path.waypoints[i].x - path.waypoints[i - 1].x,
                path.waypoints[i].y - path.waypoints[i - 1].y,
            );
            if (len > bestLen) {
                bestLen = len;
                best = i;
            }
        }
        const a = path.waypoints[best - 1];
        const b = path.waypoints[best];
        patch({
            junctionBoxes: [
                ...(route.junctionBoxes ?? []),
                { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            ],
        });
    };

    return (
        <div className="mt-1 grid gap-1 rounded-md bg-slate-50 p-1.5 text-[10px] dark:bg-white/5">
            <label className="text-slate-500">
                Tendido
                <select
                    className={inputClass}
                    value={mixed ? 'mixed' : (route?.kind ?? 'flat')}
                    onChange={(e) => {
                        const kind = e.target.value;
                        applyRoute(
                            path.id,
                            kind === 'flat'
                                ? undefined
                                : {
                                      kind: kind as FeederRoute['kind'],
                                      ...defaultCableForKind(
                                          kind as FeederRoute['kind'],
                                      ),
                                  },
                        );
                    }}
                >
                    {mixed && (
                        <option value="mixed" disabled>
                            Mixto: {airCount} aéreo(s) · {groundCount} por el
                            suelo
                        </option>
                    )}
                    <option value="flat">Plano (solo planta)</option>
                    <option value="aerial">Aéreo entre postes</option>
                    <option value="underground">Subterráneo en zanja</option>
                </select>
            </label>
            {route && (
                <div className="grid grid-cols-2 gap-1">
                    <label className="text-slate-500">
                        Lado del arco
                        <select
                            className={inputClass}
                            value={route.curveSide ?? 'auto'}
                            onChange={(e) =>
                                patch({
                                    curveSide: e.target
                                        .value as FeederRoute['curveSide'],
                                })
                            }
                        >
                            <option value="auto">Automático</option>
                            <option value="left">Izquierda</option>
                            <option value="right">Derecha</option>
                            <option value="straight">Recto</option>
                        </select>
                    </label>
                    <label className="text-slate-500">
                        Separación (m)
                        <input
                            type="number"
                            min={0.05}
                            max={10}
                            step={0.05}
                            disabled={route.curveSide === 'straight'}
                            className={inputClass}
                            value={route.curveOffsetM ?? 0.6}
                            onChange={(e) =>
                                patch({
                                    curveOffsetM: Math.min(
                                        10,
                                        Math.max(0.05, Number(e.target.value)),
                                    ),
                                })
                            }
                        />
                    </label>
                    <label className="col-span-2 text-slate-500">
                        Cable
                        <select
                            className={inputClass}
                            value={route.cableType ?? ''}
                            onChange={(e) => {
                                const preset = FEEDER_CABLE_PRESETS.find(
                                    (item) => item.id === e.target.value,
                                );
                                patch({
                                    cableType: preset?.id,
                                    conductorMaterial:
                                        preset?.material ??
                                        route.conductorMaterial,
                                });
                            }}
                        >
                            <option value="">(el de la red)</option>
                            {cablePresetsFor(route.kind).map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="col-span-2 text-slate-500">
                        Material del conductor
                        <select
                            className={inputClass}
                            value={route.conductorMaterial ?? ''}
                            onChange={(e) =>
                                patch({
                                    conductorMaterial:
                                        e.target.value === ''
                                            ? undefined
                                            : (e.target
                                                  .value as FeederRoute['conductorMaterial']),
                                })
                            }
                        >
                            <option value="">(el de la red)</option>
                            <option value="copper">Cobre</option>
                            <option value="aluminium">Aluminio</option>
                        </select>
                    </label>
                </div>
            )}
            {(route?.kind === 'aerial' || airCount > 0) && (
                <div className="grid grid-cols-2 gap-1">
                    <label className="text-slate-500">
                        Flecha (% del vano)
                        <input
                            type="number"
                            min={0.5}
                            max={15}
                            step={0.5}
                            className={inputClass}
                            value={routeSagPct(route)}
                            onChange={(e) =>
                                patch({
                                    sagPct: Math.min(
                                        15,
                                        Math.max(0.5, Number(e.target.value)),
                                    ),
                                })
                            }
                        />
                    </label>
                    <label className="text-slate-500">
                        Altura de amarre (m)
                        <input
                            type="number"
                            min={2}
                            step={0.5}
                            className={inputClass}
                            value={routeMountHeightM(route)}
                            onChange={(e) =>
                                patch({
                                    mountHeightM: Math.max(
                                        2,
                                        Number(e.target.value),
                                    ),
                                })
                            }
                        />
                    </label>
                </div>
            )}
            {route && (route.kind === 'underground' || groundCount > 0) && (
                <div className="grid grid-cols-2 items-end gap-1">
                    <label className="text-slate-500">
                        Profundidad (m)
                        <input
                            type="number"
                            min={0.3}
                            step={0.1}
                            className={inputClass}
                            value={routeDepthM(route)}
                            onChange={(e) =>
                                patch({
                                    depthM: Math.max(
                                        0.3,
                                        Number(e.target.value),
                                    ),
                                })
                            }
                        />
                    </label>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={addBox}
                            className="h-7 flex-1 rounded-md border border-cyan-500 text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                            + Caja de paso ({route.junctionBoxes?.length ?? 0})
                        </button>
                        {(route.junctionBoxes?.length ?? 0) > 0 && (
                            <button
                                type="button"
                                title="Quitar la última caja"
                                onClick={() =>
                                    patch({
                                        junctionBoxes: (
                                            route.junctionBoxes ?? []
                                        ).slice(0, -1),
                                    })
                                }
                                className="h-7 rounded-md border border-rose-300 px-2 text-rose-600"
                            >
                                −
                            </button>
                        )}
                    </div>
                </div>
            )}
            {context === 'circuit' && (
                <label className="text-slate-500">
                    Reserva / desperdicio (%)
                    <input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        className={inputClass}
                        value={path.wastePct ?? 5}
                        onChange={(event) =>
                            onWastePctChange?.(
                                Math.min(
                                    50,
                                    Math.max(0, Number(event.target.value)),
                                ),
                            )
                        }
                    />
                </label>
            )}
            <p className="text-slate-500">
                {context === 'circuit'
                    ? 'Longitud del cable:'
                    : 'Longitud para la caída de tensión:'}{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {breakdown.totalM.toFixed(1)} m
                </span>
                {(route ||
                    breakdown.levelChangeM > 0 ||
                    breakdown.wasteM > 0) && (
                    <>
                        {' '}
                        = planta {breakdown.planM.toFixed(1)}
                        {route?.kind === 'aerial' &&
                            ` + flecha ${breakdown.sagExtraM.toFixed(2)}`}
                        {breakdown.routeVerticalM > 0 &&
                            ` + amarres/zanja ${breakdown.routeVerticalM.toFixed(1)}`}
                        {breakdown.levelChangeM > 0 &&
                            ` + desniveles ${breakdown.levelChangeM.toFixed(1)}`}
                        {breakdown.wasteM > 0 &&
                            ` + reserva ${breakdown.wasteM.toFixed(1)}`}
                    </>
                )}
            </p>
            {route?.kind === 'aerial' && (
                <p className="text-slate-400">
                    Los waypoints del trazado son los postes: cada vano es una
                    catenaria (defaults: flecha {FEEDER_ROUTE_DEFAULTS.sagPct}%,
                    amarre {FEEDER_ROUTE_DEFAULTS.mountHeightM} m).{' '}
                    {context === 'circuit'
                        ? 'Material y cable son informativos — este cableado todavía no entra al cálculo de caída de tensión.'
                        : 'El material y el cable elegidos se aplican al alimentador de la red. Si el catálogo no trae ese material, la caída se calcula con su resistividad y no se verifica la ampacidad.'}
                </p>
            )}
            {context === 'circuit' && route?.kind !== 'aerial' && (
                <p className="text-slate-400">
                    Cableado de instalación: informativo/constructivo, todavía
                    no entra al cálculo de caída de tensión.
                </p>
            )}
        </div>
    );
}
