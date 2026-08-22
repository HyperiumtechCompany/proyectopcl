import type { EdgeCalculation } from '../domain/calculations';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
} from '../domain/types';

const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export function ElectricalPropertiesPanel({
    data,
    selectedId,
    calculations,
    onUpdateEdge,
    onUpdateNode,
    onChangeNodeParent,
}: {
    data: ElectricalNetworkData;
    selectedId?: string;
    calculations: EdgeCalculation[];
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
    onChangeNodeParent: (nodeId: string, parentId: string) => void;
}) {
    const edge = data.edges.find((item) => item.id === selectedId);
    const node = data.nodes.find((item) => item.id === selectedId);
    const result = calculations.find((item) => item.edgeId === edge?.id);
    return (
        <aside className="w-full border-t border-slate-200 bg-white xl:w-72 xl:border-t-0 xl:border-l dark:border-white/10 dark:bg-[#101218]">
            <div className="border-b border-slate-200 p-4 dark:border-white/10">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Propiedades
                </h2>
                <p className="text-[11px] text-slate-500">
                    {edge
                        ? 'Alimentador seleccionado'
                        : node
                          ? 'Equipo seleccionado'
                          : 'Selecciona un nodo o conexión'}
                </p>
            </div>
            <div className="grid max-h-80 gap-3 overflow-y-auto p-4 xl:max-h-none">
                {node && (
                    <>
                        <label className="text-[11px] text-slate-500">
                            Nombre visible
                            <input
                                className={inputClass}
                                value={node.label}
                                onChange={(event) =>
                                    onUpdateNode(node.id, {
                                        label: event.target.value,
                                    })
                                }
                            />
                        </label>
                        <Info label="Tipo" value={node.type} />
                        {node.moduleName && (
                            <Info label="Módulo" value={node.moduleName} />
                        )}
                        {node.sceneName && (
                            <Info label="Nivel" value={node.sceneName} />
                        )}
                        {node.deviceId && (
                            <Info
                                label="ID del tablero"
                                value={node.deviceId}
                            />
                        )}
                        {node.type === 'module_panel_port' && (
                            <label className="text-[11px] text-slate-500">
                                Alimentado desde
                                <select
                                    className={inputClass}
                                    value={
                                        data.edges.find(
                                            (item) =>
                                                item.targetNodeId === node.id,
                                        )?.sourceNodeId ?? ''
                                    }
                                    onChange={(event) =>
                                        onChangeNodeParent(
                                            node.id,
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="" disabled>
                                        Selecciona un tablero
                                    </option>
                                    {data.nodes
                                        .filter(
                                            (candidate) =>
                                                candidate.id !== node.id &&
                                                [
                                                    'main_panel',
                                                    'module_panel_port',
                                                ].includes(candidate.type) &&
                                                (candidate.type ===
                                                    'main_panel' ||
                                                    candidate.moduleId ===
                                                        node.moduleId),
                                        )
                                        .map((candidate) => (
                                            <option
                                                key={candidate.id}
                                                value={candidate.id}
                                            >
                                                {candidate.moduleName
                                                    ? `${candidate.moduleName} · `
                                                    : ''}
                                                {candidate.label}
                                            </option>
                                        ))}
                                </select>
                                <span className="mt-1 block leading-relaxed text-slate-400">
                                    Reemplaza únicamente el tramo de entrada de
                                    este tablero.
                                </span>
                            </label>
                        )}
                    </>
                )}
                {edge && (
                    <>
                        <NumberField
                            label="Longitud horizontal (m)"
                            value={edge.horizontalLengthM}
                            onChange={(value) =>
                                onUpdateEdge(edge.id, {
                                    horizontalLengthM: value,
                                })
                            }
                        />
                        <NumberField
                            label="Longitud vertical (m)"
                            value={edge.verticalLengthM}
                            onChange={(value) =>
                                onUpdateEdge(edge.id, {
                                    verticalLengthM: value,
                                })
                            }
                        />
                        <NumberField
                            label="Sección (mm²)"
                            value={edge.sectionMm2}
                            min={0.1}
                            onChange={(value) =>
                                onUpdateEdge(edge.id, { sectionMm2: value })
                            }
                        />
                        <label className="text-[11px] text-slate-500">
                            Conductor
                            <input
                                className={inputClass}
                                value={edge.conductorType}
                                onChange={(event) =>
                                    onUpdateEdge(edge.id, {
                                        conductorType: event.target.value,
                                    })
                                }
                            />
                        </label>
                        {result && (
                            <div
                                className={`rounded-lg border p-3 ${result.status === 'non_compliant' ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : result.status === 'incomplete' ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900' : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'}`}
                            >
                                <Info
                                    label="Potencia instalada"
                                    value={`${(result.installedPowerW / 1000).toFixed(2)} kW`}
                                />
                                <Info
                                    label="Máxima demanda"
                                    value={`${(result.demandPowerW / 1000).toFixed(2)} kW`}
                                />
                                <Info
                                    label="Corriente"
                                    value={`${result.currentA.toFixed(2)} A`}
                                />
                                <Info
                                    label="Corriente de diseño"
                                    value={`${result.designCurrentA.toFixed(2)} A`}
                                />
                                <Info
                                    label="Ampacidad"
                                    value={
                                        result.ampacityA
                                            ? `${result.ampacityA.toFixed(0)} A`
                                            : 'Sin catálogo'
                                    }
                                />
                                <Info
                                    label="ITM sugerido"
                                    value={`${result.breakerA} A`}
                                />
                                <Info
                                    label="Caída del tramo"
                                    value={`${result.ownVoltageDropPercent.toFixed(3)} %`}
                                />
                                <Info
                                    label="Caída acumulada"
                                    value={`${result.accumulatedVoltageDropPercent.toFixed(3)} %`}
                                />
                                {result.suggestedSectionMm2 &&
                                    result.suggestedSectionMm2 !==
                                        edge.sectionMm2 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onUpdateEdge(edge.id, {
                                                    sectionMm2:
                                                        result.suggestedSectionMm2,
                                                })
                                            }
                                            className="mt-2 w-full rounded-md bg-cyan-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-cyan-500"
                                        >
                                            Aplicar sección sugerida:{' '}
                                            {result.suggestedSectionMm2} mm²
                                        </button>
                                    )}
                                {result.warnings.map((warning) => (
                                    <p
                                        key={warning}
                                        className="mt-1 text-[10px] leading-snug text-red-600 dark:text-red-300"
                                    >
                                        {warning}
                                    </p>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
}

function NumberField({
    label,
    value,
    min = 0,
    onChange,
}: {
    label: string;
    value: number;
    min?: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="text-[11px] text-slate-500">
            {label}
            <input
                type="number"
                min={min}
                step="0.1"
                className={inputClass}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </label>
    );
}
function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-1 text-xs">
            <span className="text-slate-500">{label}</span>
            <strong className="text-right text-slate-900 dark:text-white">
                {value}
            </strong>
        </div>
    );
}
