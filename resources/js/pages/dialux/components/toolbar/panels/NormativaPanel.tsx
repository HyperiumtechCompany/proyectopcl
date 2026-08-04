import { CheckCircle2, Scale } from 'lucide-react';
import React, { useState } from 'react';
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { ALL_STANDARDS, type NormKey } from '../normativeData';
import { PanelCard } from '../primitives';

const NORM_KEY_TO_STANDARD: Record<NormKey, NormativeStandard> = {
    EN_12464_1: 'en_12464',
    EN_12464_2: 'en_12464',
    IESNA: 'ies_na',
    NTP_370: 'rne_peru',
    EN_1838: 'en_1838',
};

const STANDARD_TO_NORM_KEY: Record<NormativeStandard, NormKey> = {
    en_12464: 'EN_12464_2',
    ies_na: 'IESNA',
    rne_peru: 'NTP_370',
    en_1838: 'EN_1838',
    nfpa101: 'EN_12464_2',
    ds024: 'EN_12464_2',
};

interface NormativaPanelProps {
    onApplyStandardGlobally: (standard: NormativeStandard) => void;
}

export const NormativaPanel: React.FC<NormativaPanelProps> = ({
    onApplyStandardGlobally,
}) => {
    const defaultStandard = useEditorStore(
        (state) => state.defaultRoomNormativeStandard,
    );
    const [selectedKey, setSelectedKey] = useState<NormKey>(
        () => STANDARD_TO_NORM_KEY[defaultStandard] ?? 'EN_12464_2',
    );
    const [applied, setApplied] = useState(false);
    const selectedStandard = ALL_STANDARDS.find(
        (standard) => standard.key === selectedKey,
    )!;

    const handleApply = () => {
        onApplyStandardGlobally(NORM_KEY_TO_STANDARD[selectedKey]);
        setApplied(true);
        setTimeout(() => setApplied(false), 2500);
    };

    return (
        <div className="flex flex-col gap-2.5">
            <PanelCard title="Estándar normativo del proyecto" tone="normativa">
                <div className="flex flex-col gap-1.5">
                    {ALL_STANDARDS.map((standard) => (
                        <button
                            key={standard.key}
                            type="button"
                            onClick={() => {
                                setSelectedKey(standard.key);
                                setApplied(false);
                            }}
                            className={`flex items-start gap-2 rounded px-2.5 py-2 text-left transition-colors ${selectedKey === standard.key ? 'bg-emerald-900/25 ring-1 ring-emerald-700/40' : 'hover:bg-gray-700/40'}`}
                        >
                            <div
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${selectedKey === standard.key ? 'bg-emerald-400' : 'bg-gray-600'}`}
                            />
                            <div>
                                <p
                                    className={`text-[11px] font-semibold ${selectedKey === standard.key ? 'text-emerald-300' : 'text-gray-300'}`}
                                >
                                    {standard.label}
                                </p>
                                <p className="text-[9.5px] leading-snug text-gray-500">
                                    {standard.region}
                                </p>
                            </div>
                            {selectedKey === standard.key && (
                                <CheckCircle2
                                    size={12}
                                    className="mt-0.5 ml-auto shrink-0 text-emerald-400"
                                />
                            )}
                        </button>
                    ))}
                </div>
                <p className="mt-2 px-1 text-[9.5px] leading-snug text-gray-600">
                    {selectedStandard.fullName}
                </p>
            </PanelCard>

            <div className="rounded-lg border border-blue-800/40 bg-blue-950/20 px-2.5 py-2 text-[9.5px] leading-snug text-blue-200/80">
                Aquí se define únicamente la norma general. El área, la
                subsección, la aplicación y los lux se configuran en las
                propiedades de cada ambiente.
            </div>

            <button
                type="button"
                onClick={handleApply}
                className={`flex w-full items-center justify-center gap-2 rounded py-2 text-[11px] font-semibold transition-all duration-200 ${applied ? 'bg-emerald-700/40 text-emerald-300 ring-1 ring-emerald-600/40' : 'bg-emerald-800/30 text-emerald-200 ring-1 ring-emerald-800/40 hover:bg-emerald-700/40'}`}
            >
                {applied ? (
                    <>
                        <CheckCircle2 size={13} /> Estándar actualizado
                    </>
                ) : (
                    <>
                        <Scale size={13} /> Cambiar estándar del proyecto
                    </>
                )}
            </button>
        </div>
    );
};
