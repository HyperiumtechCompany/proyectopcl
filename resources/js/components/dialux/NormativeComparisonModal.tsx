/**
 * NormativeComparisonModal.tsx
 *
 * Modal que compara los requisitos para una misma actividad entre
 * las normas EN 12464, IES HB-10 y RNE EM.010.
 */

import { AlertCircle, Scale, X } from 'lucide-react';
import React, { useMemo } from 'react';
import {
    compareNormsForActivity,
    findMostStrictNorm,
    NORMATIVE_STANDARDS_META,
} from '@/hooks/dialux/normativeEngine';
import type { NormativeStandard } from '@/hooks/dialux/roomLighting';

interface NormativeComparisonModalProps {
    activitySearchText: string;
    onClose: () => void;
}

export const NormativeComparisonModal: React.FC<NormativeComparisonModalProps> = ({
    activitySearchText,
    onClose,
}) => {
    const comparison = useMemo(
        () => compareNormsForActivity(activitySearchText, ['rne_peru', 'en_12464', 'ies_na']),
        [activitySearchText],
    );

    const strictest = useMemo(() => findMostStrictNorm(comparison), [comparison]);

    function legalBadge(legalStatus: 'mandatory' | 'recommended' | 'reference', standardId: NormativeStandard) {
        const meta = NORMATIVE_STANDARDS_META[standardId];
        const cfg = {
            mandatory:   { label: 'Obligatoria', cls: 'bg-red-950/60 text-red-300 border-red-800/50' },
            recommended: { label: 'Recomendada', cls: 'bg-blue-950/60 text-blue-300 border-blue-800/50' },
            reference:   { label: 'Referencia',  cls: 'bg-slate-800/60 text-slate-400 border-slate-700/50' },
        }[legalStatus];
        return (
            <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">{meta?.name ?? standardId}</p>
                <span className={`inline-block rounded border px-1.5 py-px text-[8px] font-semibold ${cfg.cls}`}>
                    {cfg.label}
                </span>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative mx-4 w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-[#0f1117] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <Scale size={16} className="text-blue-400" />
                        <div>
                            <h2 className="text-sm font-bold text-white">Comparación Normativa</h2>
                            <p className="text-[10px] text-slate-500">
                                Actividad: <span className="text-slate-300">{activitySearchText}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Tabla de comparación */}
                <div className="overflow-x-auto p-5">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800">
                                <th className="pb-3 pr-3 font-semibold text-slate-400">Parámetro</th>
                                {comparison.map((entry) => (
                                    <th key={entry.standard} className="pb-3 px-2 text-center">
                                        {legalBadge(entry.legalStatus, entry.standard)}
                                        <p className="mt-1 text-[9px] text-slate-600">
                                            {entry.activityTitle}
                                        </p>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            <tr>
                                <td className="py-2.5 pr-3 text-slate-400">Iluminancia (Em)</td>
                                {comparison.map((entry) => (
                                    <td key={entry.standard} className="px-2 py-2.5 text-center">
                                        {entry.illuminanceLux > 0 ? (
                                            <span className={[
                                                'font-mono font-bold',
                                                entry.standard === strictest?.standard ? 'text-amber-400' : 'text-white',
                                            ].join(' ')}>
                                                {entry.illuminanceLux}
                                                <span className="ml-0.5 text-[9px] font-normal text-slate-600">lx</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-600">—</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-2.5 pr-3 text-slate-400">UGR máximo</td>
                                {comparison.map((entry) => (
                                    <td key={entry.standard} className="px-2 py-2.5 text-center font-mono">
                                        {entry.ugr !== null ? (
                                            <span className="text-white">≤ {entry.ugr}</span>
                                        ) : (
                                            <span className="text-slate-600">No aplica</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-2.5 pr-3 text-slate-400">Uniformidad (Uo)</td>
                                {comparison.map((entry) => (
                                    <td key={entry.standard} className="px-2 py-2.5 text-center font-mono">
                                        {entry.uniformity !== null ? (
                                            <span className="text-white">≥ {entry.uniformity}</span>
                                        ) : (
                                            <span className="text-slate-600">No aplica</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-2.5 pr-3 text-slate-400">IRC (Ra)</td>
                                {comparison.map((entry) => (
                                    <td key={entry.standard} className="px-2 py-2.5 text-center font-mono">
                                        {entry.ra !== null ? (
                                            <span className="text-white">≥ {entry.ra}</span>
                                        ) : (
                                            <span className="text-slate-600">No aplica</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-2.5 pr-3 align-top text-slate-400">Requisitos especiales</td>
                                {comparison.map((entry) => (
                                    <td key={entry.standard} className="px-2 py-2.5 text-center">
                                        {entry.specificRequirements ? (
                                            <span className="text-[9px] text-slate-500">{entry.specificRequirements}</span>
                                        ) : (
                                            <span className="text-slate-700">—</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Nota de la norma más estricta */}
                {strictest && strictest.illuminanceLux > 0 && (
                    <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                        <p className="text-[10px] text-amber-600/90">
                            <span className="font-semibold text-amber-500">Norma más exigente: </span>
                            <strong>{NORMATIVE_STANDARDS_META[strictest.standard]?.name}</strong> requiere{' '}
                            <strong>{strictest.illuminanceLux} lx</strong> para esta actividad.
                            Se recomienda diseñar cumpliendo el umbral más alto para asegurar conformidad multi-normativa.
                        </p>
                    </div>
                )}

                {/* Disclaimers */}
                <div className="border-t border-slate-800/60 px-5 py-3">
                    <p className="text-[8.5px] leading-relaxed text-slate-700">
                        Los valores mostrados son parámetros técnicos fácticos extraídos de normas de dominio público.
                        EN 12464-1:2021 (CEN/TC 169) · IES HB-10-17 (Illuminating Engineering Society) · RNE EM.010 (MVCS Perú).
                        Para aplicación legal, consulte las publicaciones oficiales.
                    </p>
                </div>
            </div>
        </div>
    );
};
