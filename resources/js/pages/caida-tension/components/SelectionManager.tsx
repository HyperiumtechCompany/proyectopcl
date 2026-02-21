import React, { useCallback, useEffect, useState } from 'react';
import type { SelectionData } from '@/types/caida-tension';

interface Props {
    totalMaxDemanda: number;
    initialData: SelectionData | null;
    canEdit: boolean;
    editMode: boolean;
    onChange: (data: SelectionData) => void;
}

const DEFAULT: SelectionData = {
    cantidadPotenciaWatts: 0,
    factorDemanda: 1.0,
    factorCarga1: 0.9,
    factorCarga2: 0.8,
    potenciaEstabilizadaStandby: 68,
};

export default function SelectionManager({ totalMaxDemanda, initialData, canEdit, editMode, onChange }: Props) {
    const [data, setData] = useState<SelectionData>(initialData ?? DEFAULT);

    // Sincronizar demanda máxima desde TG
    useEffect(() => {
        if (totalMaxDemanda > 0) {
            setData((prev) => ({ ...prev, cantidadPotenciaWatts: totalMaxDemanda }));
        }
    }, [totalMaxDemanda]);

    useEffect(() => {
        onChange(data);
    }, [data, onChange]);

    const update = useCallback(<K extends keyof SelectionData>(key: K, value: SelectionData[K]) => {
        setData((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Cálculos derivados
    const potenciaInstaladaKw = data.cantidadPotenciaWatts / 1000;
    const maximaDemandaKw = potenciaInstaladaKw * data.factorDemanda;
    const potenciaTotalKw = maximaDemandaKw;
    const grupoElectrogeno145 = data.factorCarga1 !== 0 ? potenciaTotalKw / data.factorCarga1 : 0;
    const grupoElectrogeno80 = data.factorCarga2 !== 0 ? grupoElectrogeno145 / data.factorCarga2 : 0;
    const grupoElectrogenoStandBy = grupoElectrogeno80;

    const inputCls = 'w-full rounded-md border border-gray-300 bg-white p-1 text-sm text-gray-800 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

    const EditableNumber = ({ field, value, step = '0.01' }: { field: keyof SelectionData; value: number; step?: string }) =>
        editMode ? (
            <input
                type="number" step={step}
                value={value}
                onChange={(e) => update(field, parseFloat(e.target.value) || 0)}
                className={inputCls}
            />
        ) : (
            <span>{value.toFixed(parseFloat(step) < 1 ? 2 : 0)}</span>
        );

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                {/* Sección 1: Resumen TG */}
                <h4 className="mb-3 border-b pb-2 text-base font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
                    Selección de Grupo Electrógeno
                </h4>

                <div className="overflow-x-auto mb-8">
                    <table className="min-w-full text-left border-collapse">
                        <thead className="border-b-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
                            <tr>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Descripción</th>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Cant. / Potencia (W)</th>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Pot. Instalada (kW)</th>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">F.D.</th>
                                <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200">Máx. Demanda (kW)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">TG</td>
                                <td className="py-2 px-3">
                                    <EditableNumber field="cantidadPotenciaWatts" value={data.cantidadPotenciaWatts} />
                                </td>
                                <td className="py-2 px-3">{potenciaInstaladaKw.toFixed(2)}</td>
                                <td className="py-2 px-3">
                                    <EditableNumber field="factorDemanda" value={data.factorDemanda} />
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{maximaDemandaKw.toFixed(2)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                                <td colSpan={4} className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100">POTENCIA TOTAL</td>
                                <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">{potenciaTotalKw.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Sección 2: Selección del grupo electrógeno */}
                <h4 className="mb-3 border-b pb-2 text-base font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
                    Selección de Grupo Electrógeno
                </h4>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left border-collapse">
                        <thead className="border-b-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
                            <tr>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Descripción</th>
                                <th className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Factor de Carga</th>
                                <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200">Potencia Calculada (kW)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <td colSpan={2} className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">POTENCIA TOTAL</td>
                                <td className="py-2 px-3 font-medium text-right">{potenciaTotalKw.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <td className="py-2 px-3">Grupo Electrógeno a 145.35 m.s.n.m.</td>
                                <td className="py-2 px-3"><EditableNumber field="factorCarga1" value={data.factorCarga1} /></td>
                                <td className="py-2 px-3 text-right">{grupoElectrogeno145.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <td className="py-2 px-3">Funcionará al 80% de su máxima capacidad</td>
                                <td className="py-2 px-3"><EditableNumber field="factorCarga2" value={data.factorCarga2} /></td>
                                <td className="py-2 px-3 text-right">{grupoElectrogeno80.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                                <td colSpan={2} className="py-2 px-3">Potencia STAND BY en kW a 145.35 m.s.n.m.</td>
                                <td className="py-2 px-3 text-right">{grupoElectrogenoStandBy.toFixed(2)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                                <td colSpan={2} className="px-3 py-2 font-bold text-gray-800 dark:text-gray-100">
                                    GRUPO ELECTRÓGENO ESTABILIZADO EN STAND BY (kW)
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">
                                    <EditableNumber field="potenciaEstabilizadaStandby" value={data.potenciaEstabilizadaStandby} step="1" />
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
