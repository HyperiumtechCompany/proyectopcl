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
    onUpdateSettings,
    onRemove,
}: {
    data: ElectricalNetworkData;
    selectedId?: string;
    calculations: EdgeCalculation[];
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onUpdateNode: (id: string, patch: Partial<ElectricalNode>) => void;
    onChangeNodeParent: (nodeId: string, parentId: string) => void;
    onUpdateSettings: (
        patch: Partial<ElectricalNetworkData['settings']>,
    ) => void;
    onRemove: (id: string) => void;
}) {
    const edge = data.edges.find((item) => item.id === selectedId);
    const node = data.nodes.find((item) => item.id === selectedId);
    const result = calculations.find((item) => item.edgeId === edge?.id);
    const incomingEdge = node
        ? data.edges.find((item) => item.targetNodeId === node.id)
        : undefined;
    const incomingResult = calculations.find(
        (item) => item.edgeId === incomingEdge?.id,
    );
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
                                    <option value="">
                                        Sin conexión
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
                        {node.type === 'main_panel' && (
                            <>
                                <div className="mt-1 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                                    Configuración general de la red
                                </div>
                                <p className="-mt-2 text-[10px] leading-relaxed text-slate-400">
                                    Este es el único TG del proyecto — desde
                                    aquí se define el suministro para todos
                                    los módulos conectados.
                                </p>
                                <NumberField
                                    label="Voltaje de operación (V)"
                                    value={data.settings.nominalVoltageV}
                                    min={1}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            nominalVoltageV: value,
                                        })
                                    }
                                />
                                <SelectField
                                    label="Sistema"
                                    value={String(data.settings.phases)}
                                    options={[
                                        ['1', '1Φ (monofásico)'],
                                        ['3', '3Φ (trifásico)'],
                                    ]}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            phases: Number(value) as 1 | 3,
                                        })
                                    }
                                />
                                <SelectField
                                    label="Conexión"
                                    value={data.settings.connectionType}
                                    options={[
                                        ['star', 'Estrella'],
                                        ['delta', 'Delta'],
                                    ]}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            connectionType: value as
                                                | 'star'
                                                | 'delta',
                                        })
                                    }
                                />
                                <SelectField
                                    label="Frecuencia"
                                    value={String(data.settings.frequencyHz)}
                                    options={[
                                        ['50', '50 Hz'],
                                        ['60', '60 Hz'],
                                    ]}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            frequencyHz: Number(value) as
                                                | 50
                                                | 60,
                                        })
                                    }
                                />
                                <SelectField
                                    label="Material del conductor"
                                    value={data.settings.conductorMaterial}
                                    options={[
                                        ['copper', 'Cobre'],
                                        ['aluminium', 'Aluminio'],
                                    ]}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            conductorMaterial: value as
                                                | 'copper'
                                                | 'aluminium',
                                        })
                                    }
                                />
                                <NumberField
                                    label="Factor de potencia por defecto"
                                    value={data.settings.defaultPowerFactor}
                                    min={0.1}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            defaultPowerFactor: Math.min(
                                                1,
                                                value,
                                            ),
                                        })
                                    }
                                />
                                <NumberField
                                    label="Factor de diseño (fdis)"
                                    value={data.settings.designFactor ?? 1.25}
                                    min={1}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            designFactor: value,
                                        })
                                    }
                                />
                                <NumberField
                                    label="Temperatura de trabajo (°C)"
                                    value={data.settings.workingTemperatureC}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            workingTemperatureC: value,
                                        })
                                    }
                                />
                                <NumberField
                                    label="Límite ΔU alimentador (%)"
                                    value={data.settings.feederDropLimitPercent}
                                    min={0.1}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            feederDropLimitPercent: value,
                                        })
                                    }
                                />
                                <NumberField
                                    label="Límite ΔU acumulada total (%)"
                                    value={data.settings.totalDropLimitPercent}
                                    min={0.1}
                                    onChange={(value) =>
                                        onUpdateSettings({
                                            totalDropLimitPercent: value,
                                        })
                                    }
                                />
                            </>
                        )}
                        {incomingEdge && (
                            <>
                                <div className="mt-1 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                                    Alimentador entrante
                                </div>
                                <EdgeFields
                                    edge={incomingEdge}
                                    result={incomingResult}
                                    onUpdateEdge={onUpdateEdge}
                                    onRemove={onRemove}
                                    disconnectLabel="Desconectar alimentador"
                                    verticalHelperText="Distancia vertical desde el suministro/tablero aguas arriba hasta este equipo (bajada de acometida, altura de montaje, etc.). Necesaria para calcular su caída de tensión."
                                />
                            </>
                        )}
                    </>
                )}
                {edge && (
                    <EdgeFields
                        edge={edge}
                        result={result}
                        onUpdateEdge={onUpdateEdge}
                        onRemove={onRemove}
                        disconnectLabel="Desconectar este tramo"
                    />
                )}
            </div>
        </aside>
    );
}

function EdgeFields({
    edge,
    result,
    onUpdateEdge,
    onRemove,
    disconnectLabel,
    verticalHelperText,
}: {
    edge: ElectricalEdge;
    result?: EdgeCalculation;
    onUpdateEdge: (id: string, patch: Partial<ElectricalEdge>) => void;
    onRemove: (id: string) => void;
    disconnectLabel: string;
    verticalHelperText?: string;
}) {
    return (
        <>
            <Info
                label="Longitud total"
                value={`${(edge.horizontalLengthM + edge.verticalLengthM).toFixed(2)} m`}
            />
            <NumberField
                label="Longitud horizontal (m)"
                value={edge.horizontalLengthM}
                onChange={(value) =>
                    onUpdateEdge(edge.id, { horizontalLengthM: value })
                }
            />
            <div>
                <NumberField
                    label="Longitud vertical (m)"
                    value={edge.verticalLengthM}
                    onChange={(value) =>
                        onUpdateEdge(edge.id, { verticalLengthM: value })
                    }
                />
                {verticalHelperText && (
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                        {verticalHelperText}
                    </span>
                )}
            </div>
            <NumberField
                label="Sección (mm²)"
                value={edge.sectionMm2}
                min={0.1}
                onChange={(value) => onUpdateEdge(edge.id, { sectionMm2: value })}
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
                    <Info label="ITM sugerido" value={`${result.breakerA} A`} />
                    <Info
                        label="Caída del tramo"
                        value={`${result.ownVoltageDropPercent.toFixed(3)} %`}
                    />
                    <Info
                        label="Caída acumulada"
                        value={`${result.accumulatedVoltageDropPercent.toFixed(3)} %`}
                    />
                    {result.suggestedSectionMm2 &&
                        result.suggestedSectionMm2 !== edge.sectionMm2 && (
                            <button
                                type="button"
                                onClick={() =>
                                    onUpdateEdge(edge.id, {
                                        sectionMm2: result.suggestedSectionMm2,
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
            <button
                type="button"
                onClick={() => onRemove(edge.id)}
                className="w-full rounded-md border border-rose-400/60 px-2 py-1.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
                {disconnectLabel}
            </button>
        </>
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
function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="text-[11px] text-slate-500">
            {label}
            <select
                className={inputClass}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </select>
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
