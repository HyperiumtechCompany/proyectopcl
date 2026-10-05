import React from 'react';
import { useValorizacionStore, ValorizacionState } from '../../stores/useValorizacionStore';
import { fmtMoney } from '../../utils/decimal-helpers';

interface SheetHeaderProps {
    title: string;
    subtitle?: string;
}

export function SheetHeader({ title, subtitle }: SheetHeaderProps) {
    const ficha = useValorizacionStore((state: ValorizacionState) => state.fichaTecnica);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            {/* Header Title */}
            <div className="bg-slate-800 px-6 py-4">
                <h1 className="text-xl font-bold text-white uppercase tracking-wider">{title}</h1>
                {subtitle && <p className="text-slate-300 text-sm mt-1">{subtitle}</p>}
            </div>

            {/* Info Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Obra:</span>
                        <span className="col-span-2 text-gray-600 truncate" title={ficha?.obra || '---'}>
                            {ficha?.obra || '---'}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Entidad:</span>
                        <span className="col-span-2 text-gray-600">{ficha?.entidad || '---'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Ejecutor:</span>
                        <span className="col-span-2 text-gray-600">{ficha?.ejecutor || '---'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <span className="font-semibold text-gray-700">Residente:</span>
                        <span className="col-span-2 text-gray-600">{ficha?.residente || '---'}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Supervisor:</span>
                        <span className="col-span-2 text-gray-600">{ficha?.supervisor || '---'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Valor Ref.:</span>
                        <span className="col-span-2 text-gray-600">{fmtMoney(ficha?.valorReferencial)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-700">Monto Contrato:</span>
                        <span className="col-span-2 font-medium text-emerald-600">{fmtMoney(ficha?.montoContrato)} (Inc. IGV)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <span className="font-semibold text-gray-700">Plazo:</span>
                        <span className="col-span-2 text-gray-600">{ficha?.plazoEjecucionDias || 0} D.C.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
