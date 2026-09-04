import { Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { useState } from 'react';
import { polygonArea, polygonPerimeter } from '../domain/geometry';
import type { SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { SiteElementConfigFields } from './SiteElementConfigFields';
import { POINT_ELEMENT_TYPES } from './SiteElementSymbol';

interface ModuleOption {
    id: number;
    name: string;
}

interface Props {
    editor: UseSiteEditorReturn;
    modules: ModuleOption[];
}

const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export function SitePropertiesPanel({ editor, modules }: Props) {
    const element = editor.siteData?.elements.find(
        (item) => item.id === editor.selectedElementId,
    );

    return (
        <aside className="flex min-h-0 w-full flex-col overflow-y-auto border-t border-slate-200 bg-white xl:w-72 xl:border-t-0 xl:border-l dark:border-white/10 dark:bg-[#101218]">
            <div className="shrink-0 border-b border-slate-200 p-4 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Propiedades
                </h2>
                <p className="text-[11px] text-slate-500">
                    {element
                        ? 'Elemento del emplazamiento'
                        : 'Selecciona un elemento del plano'}
                </p>
            </div>
            {editor.calibrationPoints.length === 2 && (
                <CalibrationPanel editor={editor} />
            )}
            {element && (
                <ElementProperties
                    key={element.id}
                    element={element}
                    editor={editor}
                    modules={modules}
                />
            )}
            {!element && <ImportedPlanPanel editor={editor} />}
            {!element && (editor.siteData?.feederPaths.length ?? 0) > 0 && (
                <div className="p-4">
                    <p className="mb-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                        Alimentadores trazados
                    </p>
                    <ul className="space-y-1">
                        {editor.siteData?.feederPaths.map((path) => (
                            <li
                                key={path.id}
                                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] dark:border-white/10"
                            >
                                <span className="truncate text-slate-600 dark:text-slate-300">
                                    {path.label ?? path.networkEdgeId}
                                </span>
                                <span className="shrink-0 text-slate-400">
                                    {path.calculatedLengthM.toFixed(1)} m
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        editor.removeFeederPath(path.id)
                                    }
                                    title="Eliminar trazado"
                                    className="shrink-0 text-rose-500 hover:text-rose-700"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </aside>
    );
}

type PropTab = 'general' | 'position' | 'config';

/** Propiedades de un elemento seleccionado, organizadas en pestañas para que
 * quepan en el ancho fijo del panel sin depender solo de scroll vertical. */
function ElementProperties({
    element,
    editor,
    modules,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
    modules: ModuleOption[];
}) {
    const isTopo =
        element.type === 'contour' || element.type === 'spot_elevation';
    const isFootprint =
        element.type !== 'ramp' && element.type !== 'stair' && !isTopo;
    const hasConfigTab = !!element.config || element.type === 'building_block';

    const tabs: Array<{ id: PropTab; label: string }> = [
        { id: 'general', label: 'General' },
        { id: 'position', label: 'Posición' },
        ...(hasConfigTab ? [{ id: 'config' as const, label: 'Config.' }] : []),
    ];
    const [tab, setTab] = useState<PropTab>('general');
    // `hasConfigTab` es fijo para un `element.id` dado (depende solo de su
    // tipo), así que no hace falta un efecto: si la pestaña ya no aplica,
    // se deriva directo en el render.
    const activeTab = tab === 'config' && !hasConfigTab ? 'general' : tab;

    const centroid = element.vertices.reduce(
        (a, v) => ({
            x: a.x + v.x / element.vertices.length,
            y: a.y + v.y / element.vertices.length,
        }),
        { x: 0, y: 0 },
    );
    const ground = editor.groundElevationAt(centroid.x, centroid.y);
    const abs = ground + (element.baseElevationM ?? 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-2 dark:border-white/10">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`rounded-t-md px-2.5 py-1.5 text-[11px] font-semibold ${
                            activeTab === t.id
                                ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto p-4">
                {activeTab === 'general' && (
                    <>
                        <label className="text-[11px] text-slate-500">
                            Nombre
                            <input
                                className={inputClass}
                                value={element.label}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        label: event.target.value,
                                    })
                                }
                            />
                        </label>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Tipo</span>
                            <strong className="text-slate-900 dark:text-white">
                                {element.type}
                            </strong>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-[11px] text-slate-500">
                                Color
                                <input
                                    type="color"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 dark:border-slate-700"
                                    value={element.style.fillColor}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            style: {
                                                ...element.style,
                                                fillColor: event.target.value,
                                            },
                                        })
                                    }
                                />
                            </label>
                            <label className="text-[11px] text-slate-500">
                                Borde
                                <input
                                    type="color"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 dark:border-slate-700"
                                    value={element.style.strokeColor}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            style: {
                                                ...element.style,
                                                strokeColor: event.target.value,
                                            },
                                        })
                                    }
                                />
                            </label>
                        </div>
                        <label className="text-[11px] text-slate-500">
                            Opacidad (
                            {Math.round((element.style.opacity ?? 1) * 100)}%)
                            <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={element.style.opacity ?? 1}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        style: {
                                            ...element.style,
                                            opacity: Number(event.target.value),
                                        },
                                    })
                                }
                                className="mt-1 w-full"
                            />
                        </label>

                        {element.vertices.length >= 3 && (
                            <div className="rounded-lg border border-slate-200 p-2 text-xs dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Área</span>
                                    <strong>
                                        {(
                                            polygonArea(element.vertices) *
                                            editor.terrainScaleM *
                                            editor.terrainScaleM
                                        ).toFixed(1)}{' '}
                                        m²
                                    </strong>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                        Perímetro
                                    </span>
                                    <strong>
                                        {(
                                            polygonPerimeter(element.vertices) *
                                            editor.terrainScaleM
                                        ).toFixed(1)}{' '}
                                        m
                                    </strong>
                                </div>
                                {editor.terrainScaleM === 1 && (
                                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        Plano sin calibrar — usa “Calibrar
                                        plano”.
                                    </p>
                                )}
                            </div>
                        )}

                        {(element.type === 'building_block' ||
                            element.type === 'fence') && (
                            <label className="text-[11px] text-slate-500">
                                Altura (m)
                                <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    className={inputClass}
                                    value={element.heightM ?? 0}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            heightM: Number(event.target.value),
                                        })
                                    }
                                />
                            </label>
                        )}
                    </>
                )}

                {activeTab === 'position' && (
                    <>
                        <label className="text-[11px] text-slate-500">
                            {isTopo
                                ? 'Cota (m)'
                                : editor.terrainModeled
                                  ? 'Cota sobre el terreno (m)'
                                  : 'Cota base (m)'}
                            <input
                                type="number"
                                step={isTopo ? 0.5 : 0.1}
                                className={inputClass}
                                value={element.baseElevationM ?? 0}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        baseElevationM: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                            {editor.terrainModeled && isFootprint && (
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                    Terreno natural aquí: {ground.toFixed(2)} m
                                    · cota absoluta ≈ {abs.toFixed(2)} m
                                </span>
                            )}
                        </label>

                        {POINT_ELEMENT_TYPES.has(element.type) && (
                            <label className="text-[11px] text-slate-500">
                                Rotación (°)
                                <input
                                    type="number"
                                    step="15"
                                    className={inputClass}
                                    value={element.rotation ?? 0}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            rotation:
                                                Number(event.target.value) %
                                                360,
                                        })
                                    }
                                />
                            </label>
                        )}
                    </>
                )}

                {activeTab === 'config' && hasConfigTab && (
                    <>
                        <SiteElementConfigFields
                            element={element}
                            editor={editor}
                        />

                        {element.type === 'building_block' && (
                            <label className="text-[11px] text-slate-500">
                                Módulo vinculado
                                <select
                                    className={inputClass}
                                    value={element.moduleId ?? ''}
                                    onChange={(event) => {
                                        const moduleId = event.target.value
                                            ? Number(event.target.value)
                                            : undefined;
                                        const moduleName = modules.find(
                                            (item) => item.id === moduleId,
                                        )?.name;
                                        editor.updateSiteElement(element.id, {
                                            moduleId,
                                            moduleName,
                                        });
                                    }}
                                >
                                    <option value="">Sin vincular</option>
                                    {modules.map((module) => (
                                        <option
                                            key={module.id}
                                            value={module.id}
                                        >
                                            {module.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3 dark:border-white/10">
                <button
                    type="button"
                    onClick={() =>
                        editor.updateSiteElement(element.id, {
                            visible: element.visible === false,
                        })
                    }
                    title={element.visible === false ? 'Mostrar' : 'Ocultar'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {element.visible === false ? (
                        <EyeOff className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <Eye className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        editor.updateSiteElement(element.id, {
                            locked: !element.locked,
                        })
                    }
                    title={element.locked ? 'Desbloquear' : 'Bloquear'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {element.locked ? (
                        <Lock className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <Unlock className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const newId = editor.duplicateSiteElement(element.id);
                        if (newId) editor.selectElement(newId);
                    }}
                    title="Duplicar"
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    <Copy className="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        editor.removeSiteElement(element.id);
                        editor.selectElement(null);
                    }}
                    title="Eliminar"
                    className="flex-1 rounded-md border border-rose-300 py-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/** Panel de gestión del plano importado (DXF/DWG convertido a imagen) — opacidad, visibilidad, calibrar, eliminar. */
function ImportedPlanPanel({ editor }: { editor: UseSiteEditorReturn }) {
    const plan = editor.siteData?.importedPlan;
    if (!plan) return null;

    return (
        <div className="border-b border-slate-200 p-4 dark:border-white/10">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Plano importado
            </p>
            <p className="mb-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                {plan.originalName}
            </p>
            <p className="mb-2 text-[10px] text-slate-500">
                {editor.terrainScaleM === 1 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                        Sin calibrar — 1 unidad del plano = 1 m
                    </span>
                ) : (
                    <>
                        Escala: 1 unidad = {editor.terrainScaleM.toPrecision(4)}{' '}
                        m
                    </>
                )}
            </p>
            <label className="text-[11px] text-slate-500">
                Opacidad ({Math.round(plan.opacity * 100)}%)
                <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={plan.opacity}
                    onChange={(event) =>
                        editor.updateImportedPlan({
                            opacity: Number(event.target.value),
                        })
                    }
                    className="mt-1 w-full"
                />
            </label>
            <div className="mt-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() =>
                        editor.updateImportedPlan({ visible: !plan.visible })
                    }
                    title={plan.visible ? 'Ocultar' : 'Mostrar'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {plan.visible ? (
                        <Eye className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <EyeOff className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={editor.startCalibratePlan}
                    title="Calibrar con una distancia real conocida"
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    Calibrar
                </button>
                <button
                    type="button"
                    onClick={editor.removeImportedPlan}
                    title="Eliminar plano importado"
                    className="flex-1 rounded-md border border-rose-300 py-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/** Panel de calibración — aparece con los 2 clics ya hechos, pide la distancia real y fija la escala del emplazamiento. */
function CalibrationPanel({ editor }: { editor: UseSiteEditorReturn }) {
    const [distance, setDistance] = useState('');
    const [p1, p2] = editor.calibrationPoints;
    const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const preview =
        Number(distance) > 0 && measured > 0
            ? Number(distance) / measured
            : null;

    return (
        <div className="border-b border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-fuchsia-600 uppercase dark:text-fuchsia-400">
                Calibrar plano
            </p>
            <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-300">
                Distancia medida en el plano:{' '}
                <strong>{measured.toFixed(2)} u</strong>. ¿Cuánto mide esa misma
                distancia en la realidad?
            </p>
            {preview !== null && (
                <p className="mb-2 text-[10px] text-fuchsia-700 dark:text-fuchsia-300">
                    Escala resultante: 1 u = {preview.toPrecision(4)} m
                </p>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={0}
                    step="0.01"
                    autoFocus
                    placeholder="Metros reales"
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                    className={inputClass}
                />
                <button
                    type="button"
                    disabled={!(Number(distance) > 0)}
                    onClick={() =>
                        editor.applyPlanCalibration(Number(distance))
                    }
                    className="h-8 shrink-0 rounded-md bg-fuchsia-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                    Aplicar
                </button>
                <button
                    type="button"
                    onClick={editor.cancelCalibration}
                    className="h-8 shrink-0 rounded-md border border-slate-200 px-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}
