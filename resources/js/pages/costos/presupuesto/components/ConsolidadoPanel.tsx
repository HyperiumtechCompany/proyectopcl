import React, { useMemo, useState } from 'react';
import { Calculator, FileText, ShieldCheck } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { useGGFijosStore } from '../stores/ggFijosStore';
import { useGGVariablesStore } from '../stores/ggVariablesStore';
import { useSupervisionStore } from '../stores/supervisionStore';

interface ConsolidadoPanelProps {
    projectId: number;
}

const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

const formatQty = (val: number) =>
    new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

export function ConsolidadoPanel({ projectId }: ConsolidadoPanelProps) {
    // 1) Costo Directo
    const budgetRows = useBudgetStore((s) => s.rows);
    const parentBudgetSections = useMemo(
        () => budgetRows.filter((r) => r._level === 0 || !r._parentId),
        [budgetRows],
    );
    const costoDirecto = useMemo(
        () =>
            parentBudgetSections.reduce(
                (acc, r) => acc + (Number(r.parcial) || 0),
                0,
            ),
        [parentBudgetSections],
    );

    // 2) Gastos Generales
    const ggFijosTotal = useGGFijosStore((s) => s.getTotal());
    const ggVariablesTotal = useGGVariablesStore((s) => s.getTotal());
    const totalGastosGenerales = ggFijosTotal + ggVariablesTotal;

    // 3) Utilidad
    const [porcentajeUtilidadInput, setPorcentajeUtilidadInput] = useState(5);
    const utilidadTotal = costoDirecto * (porcentajeUtilidadInput / 100);

    // 4) Subtotal + IGV
    const subtotal = costoDirecto + totalGastosGenerales + utilidadTotal;
    const igv = subtotal * 0.18;
    const totalEjecucion = subtotal + igv;

    // 5) SupervisiÃ³n (Section VIII reference)
    const supervisionTotal = useSupervisionStore((s) => s.rows[7]?.total || 0);

    const totalPresupuestoObra = totalEjecucion + supervisionTotal;

    const porcentajeGastosGenerales =
        costoDirecto > 0 ? totalGastosGenerales / costoDirecto : 0;
    const porcentajeUtilidad =
        costoDirecto > 0 ? utilidadTotal / costoDirecto : 0;
    const porcentajeIgv = subtotal > 0 ? igv / subtotal : 0;
    const porcentajeSupervision =
        totalEjecucion > 0 ? supervisionTotal / totalEjecucion : 0;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-slate-950">
            <div className="border-b border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800">
                        <Calculator className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-tight text-white">
                            Presupuesto Consolidado
                        </h1>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Estructura uniforme para presentaciÃ³n al cliente
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="mx-auto flex max-w-5xl flex-col gap-6">
                    {/* Tabla 1 */}
                    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-700">
                            ResÃºmen de AnÃ¡lisis de Gastos Generales
                        </div>
                        <table className="w-full text-[11px] text-slate-800">
                            <thead className="bg-slate-200/80">
                                <tr>
                                    <th className="w-14 border-r border-slate-300 px-3 py-2 text-left">
                                        Item
                                    </th>
                                    <th className="border-r border-slate-300 px-3 py-2 text-left">
                                        DescripciÃ³n
                                    </th>
                                    <th className="w-14 border-r border-slate-300 px-2 py-2 text-center">
                                        Und.
                                    </th>
                                    <th className="w-20 border-r border-slate-300 px-2 py-2 text-center">
                                        Cantidad
                                    </th>
                                    <th className="w-28 border-r border-slate-300 px-2 py-2 text-right">
                                        Precio Unitario S/.
                                    </th>
                                    <th className="w-28 px-2 py-2 text-right">
                                        Valor Total S/.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 text-center font-bold">
                                        I
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        Gastos Generales Fijos
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        Glb.
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        {formatQty(1)}
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-right">
                                        {formatMoney(ggFijosTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        {formatMoney(ggFijosTotal)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 text-center font-bold">
                                        II
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        Gastos Generales Variables
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        Glb.
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        {formatQty(1)}
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-right">
                                        {formatMoney(ggVariablesTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        {formatMoney(ggVariablesTotal)}
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="border-t border-slate-300 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-700"
                                    >
                                        Total de Gastos Generales S/.
                                    </td>
                                    <td className="border-t border-slate-300 px-2 py-2 text-right font-bold text-slate-900">
                                        {formatMoney(totalGastosGenerales)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Tabla 2 */}
                    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-700">
                            ResÃºmen de AnÃ¡lisis de Gastos de SupervisiÃ³n
                        </div>
                        <table className="w-full text-[11px] text-slate-800">
                            <thead className="bg-slate-200/80">
                                <tr>
                                    <th className="w-14 border-r border-slate-300 px-3 py-2 text-left">
                                        Item
                                    </th>
                                    <th className="border-r border-slate-300 px-3 py-2 text-left">
                                        DescripciÃ³n
                                    </th>
                                    <th className="w-14 border-r border-slate-300 px-2 py-2 text-center">
                                        Und.
                                    </th>
                                    <th className="w-20 border-r border-slate-300 px-2 py-2 text-center">
                                        Cantidad
                                    </th>
                                    <th className="w-28 border-r border-slate-300 px-2 py-2 text-right">
                                        Precio Unitario S/.
                                    </th>
                                    <th className="w-28 px-2 py-2 text-right">
                                        Valor Total S/.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 text-center font-bold">
                                        I
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        Gastos Generales de SupervisiÃ³n
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        Glb.
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        {formatQty(1)}
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-right">
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="border-t border-slate-300 px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-700"
                                    >
                                        Total de Gastos de SupervisiÃ³n S/.
                                    </td>
                                    <td className="border-t border-slate-300 px-2 py-2 text-right font-bold text-slate-900">
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Tabla 3: DescripciÃ³n del Costo (4 columnas) */}
                    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-700">
                            DescripciÃ³n del Costo
                        </div>
                        <table className="w-full text-[11px] text-slate-800">
                            <thead className="bg-slate-200/80">
                                <tr>
                                    <th className="border-r border-slate-300 px-3 py-2 text-left">
                                        DescripciÃ³n
                                    </th>
                                    <th className="w-16 border-r border-slate-300 px-2 py-2 text-center">
                                        Moneda
                                    </th>
                                    <th className="w-36 border-r border-slate-300 px-3 py-2 text-right">
                                        Monto
                                    </th>
                                    <th className="w-24 px-3 py-2 text-right">
                                        %
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        Costo Directo
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right">
                                        {formatMoney(costoDirecto)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-500">
                                        â€”
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        Gastos Generales
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right">
                                        {formatMoney(totalGastosGenerales)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatMoney(
                                            porcentajeGastosGenerales * 100,
                                        )}
                                        %
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        <div className="flex items-center gap-2">
                                            Utilidad
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-right text-[10px] text-slate-700"
                                                    value={porcentajeUtilidadInput}
                                                    onChange={(e) =>
                                                        setPorcentajeUtilidadInput(
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                        )
                                                    }
                                                />
                                                <span className="text-[10px] text-slate-500">
                                                    %
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right">
                                        {formatMoney(utilidadTotal)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatMoney(porcentajeUtilidad * 100)}%
                                    </td>
                                </tr>
                                <tr className="bg-slate-50">
                                    <td className="border-r border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Subtotal Presupuesto
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right font-bold text-slate-900">
                                        {formatMoney(subtotal)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-500">
                                        â€”
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        I.G.V. (18%)
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right">
                                        {formatMoney(igv)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatMoney(porcentajeIgv * 100)}%
                                    </td>
                                </tr>
                                <tr className="bg-amber-50">
                                    <td className="border-r border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                                        Presupuesto EjecuciÃ³n de Obra
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center text-xs font-bold text-amber-700">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right font-bold text-amber-700">
                                        {formatMoney(totalEjecucion)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-amber-700">
                                        â€”
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-slate-300 px-3 py-2 font-semibold">
                                        SupervisiÃ³n (SecciÃ³n VIII)
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-2 text-center">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-2 text-right">
                                        {formatMoney(supervisionTotal)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatMoney(
                                            porcentajeSupervision * 100,
                                        )}
                                        %
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr className="bg-emerald-100">
                                    <td className="border-r border-slate-300 px-3 py-3 text-xs font-black uppercase tracking-wider text-emerald-800">
                                        Total Presupuesto de Obra
                                    </td>
                                    <td className="border-r border-slate-300 px-2 py-3 text-center text-xs font-black text-emerald-800">
                                        S/.
                                    </td>
                                    <td className="border-r border-slate-300 px-3 py-3 text-right text-base font-black text-emerald-800">
                                        {formatMoney(totalPresupuestoObra)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-emerald-800">
                                        â€”
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                            El total de supervisiÃ³n se toma directamente de la
                            SecciÃ³n VIII.
                        </div>
                    </div>

                    {/* Tabla auxiliar: Secciones del Costo Directo */}
                    <div className="overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900/60 shadow-xl">
                        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
                            <FileText size={14} className="text-sky-400" />
                            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                                Detalle de Costo Directo (referencia interna)
                            </h2>
                        </div>
                        <table className="w-full text-[10px] text-slate-300">
                            <thead className="bg-slate-900">
                                <tr>
                                    <th className="w-14 px-3 py-2 text-left uppercase tracking-wider text-slate-500">
                                        Item
                                    </th>
                                    <th className="px-3 py-2 text-left uppercase tracking-wider text-slate-500">
                                        DescripciÃ³n
                                    </th>
                                    <th className="w-28 px-3 py-2 text-right uppercase tracking-wider text-slate-500">
                                        Monto (S/.)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-mono">
                                {parentBudgetSections.map((r) => (
                                    <tr
                                        key={r.partida}
                                        className="hover:bg-slate-800/30"
                                    >
                                        <td className="px-3 py-2 text-sky-400">
                                            {r.partida}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.descripcion}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {formatMoney(
                                                Number(r.parcial) || 0,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900/80">
                                <tr>
                                    <td
                                        colSpan={2}
                                        className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                    >
                                        Total Costo Directo
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-200">
                                        {formatMoney(costoDirecto)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
