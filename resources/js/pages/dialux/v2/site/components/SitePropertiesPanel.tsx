import { Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { polygonArea, polygonPerimeter } from '../domain/geometry';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

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
        <aside className="w-full border-t border-slate-200 bg-white xl:w-72 xl:border-t-0 xl:border-l dark:border-white/10 dark:bg-[#101218]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Propiedades
                </h2>
                <p className="text-[11px] text-slate-500">
                    {element
                        ? 'Elemento del emplazamiento'
                        : 'Selecciona un elemento del plano'}
                </p>
            </div>
            {element && (
                <div className="grid gap-3 overflow-y-auto p-4">
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
                        Opacidad ({Math.round((element.style.opacity ?? 1) * 100)}%)
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
                                    {polygonArea(element.vertices).toFixed(1)}{' '}
                                    m²
                                </strong>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">
                                    Perímetro
                                </span>
                                <strong>
                                    {polygonPerimeter(
                                        element.vertices,
                                    ).toFixed(1)}{' '}
                                    m
                                </strong>
                            </div>
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
                                    <option key={module.id} value={module.id}>
                                        {module.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() =>
                                editor.updateSiteElement(element.id, {
                                    visible: element.visible === false,
                                })
                            }
                            title={
                                element.visible === false
                                    ? 'Mostrar'
                                    : 'Ocultar'
                            }
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
                                const newId = editor.duplicateSiteElement(
                                    element.id,
                                );
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
            )}
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
