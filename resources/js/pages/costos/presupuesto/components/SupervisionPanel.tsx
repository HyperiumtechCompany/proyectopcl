import React from 'react';
import { useSupervisionStore, SupervisionRow } from '../stores/supervisionStore';
import { 
    ChevronRight, 
    ChevronDown, 
    Calculator, 
    TrendingUp, 
    ShieldCheck, 
    FileText,
    Percent,
    DollarSign,
    Users
} from 'lucide-react';

interface RowProps {
    row: SupervisionRow;
    depth: number;
    path: string[];
}

const SupervisionRowComponent: React.FC<RowProps> = ({ row, depth, path }) => {
    const [expanded, setExpanded] = React.useState(true);
    const updateCell = useSupervisionStore((s) => s.updateCell);
    const hasChildren = row.hijos && row.hijos.length > 0;

    const isCalculation = row.tipo === 'calculo';
    const isSection = row.tipo === 'seccion';
    const isSubSection = row.tipo === 'subseccion';
    const isCaptura = row.tipo === 'captura';

    const getBgColor = () => {
        if (isSection) return 'bg-sky-900/40 border-sky-500/30';
        if (row.item === 'VI') return 'bg-emerald-900/40 border-emerald-500/30';
        if (row.item === 'VIII') return 'bg-amber-900/40 border-amber-500/30';
        return 'hover:bg-slate-800/50 border-slate-700/50';
    };

    const getTextColor = () => {
        if (isSection) return 'text-sky-300 font-black';
        if (row.item === 'VI') return 'text-emerald-300 font-black';
        if (row.item === 'VIII') return 'text-amber-300 font-black';
        if (isSubSection) return 'text-slate-200 font-bold';
        return 'text-slate-400';
    };

    return (
        <>
            <tr className={`group transition-all border-b ${getBgColor()}`}>
                <td className="p-0">
                    <div className="flex items-center gap-2 py-2 px-4" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
                        {hasChildren ? (
                            <button 
                                onClick={() => setExpanded(!expanded)}
                                className="p-1 rounded-md hover:bg-white/10 transition-colors"
                            >
                                {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                            </button>
                        ) : (
                            <div className="w-6" />
                        )}
                        <span className={`text-[11px] min-w-[20px] font-mono ${getTextColor()}`}>{row.item}</span>
                        <span className={`text-[11px] truncate ${getTextColor()}`}>{row.descripcion}</span>
                    </div>
                </td>
                <td className="text-center">
                    {!isSection && !isCalculation && !isCaptura && depth > 1 && (
                        <input
                            type="text"
                            value={row.unidad}
                            onChange={(e) => updateCell([...path], 'unidad', e.target.value)}
                            className="w-16 bg-transparent border-none text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1"
                        />
                    )}
                </td>
                <td className="text-center">
                    {row.tipo === 'partida' && (
                        <input
                            type="number"
                            value={row.cantidad}
                            onChange={(e) => updateCell([...path], 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-transparent border-none text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1"
                        />
                    )}
                </td>
                <td className="text-center">
                    {row.tipo === 'partida' && (
                        <input
                            type="number"
                            value={row.meses}
                            onChange={(e) => updateCell([...path], 'meses', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-transparent border-none text-[10px] text-center text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1"
                        />
                    )}
                </td>
                <td className="text-right">
                    {row.tipo === 'partida' && (
                        <input
                            type="number"
                            value={row.precio}
                            onChange={(e) => updateCell([...path], 'precio', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-transparent border-none text-[10px] text-right text-slate-300 focus:ring-1 focus:ring-sky-500 rounded px-1 mr-4"
                        />
                    )}
                </td>
                <td className="text-right px-4">
                    {!isSection && !isCalculation && !isSubSection && row.subtotal > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">
                            {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(row.subtotal)}
                        </span>
                    )}
                </td>
                <td className="text-right px-6">
                    {isCaptura ? (
                        <input
                            type="number"
                            value={row.total}
                            onChange={(e) => updateCell([...path], 'total', parseFloat(e.target.value) || 0)}
                            className="w-32 bg-slate-800/50 border border-slate-700 text-[11px] text-right text-amber-300 font-mono focus:ring-1 focus:ring-amber-500 rounded px-2"
                        />
                    ) : (
                        <span className={`text-[11px] font-mono ${getTextColor()}`}>
                            {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(row.total)}
                        </span>
                    )}
                </td>
            </tr>
            {expanded && hasChildren && row.hijos?.map((hijo, idx) => (
                <SupervisionRowComponent 
                    key={`${row.item}-${idx}`} 
                    row={hijo} 
                    depth={depth + 1} 
                    path={[...path, hijo.item]} 
                />
            ))}
        </>
    );
};

export function SupervisionPanel() {
    const rows = useSupervisionStore((s) => s.rows);
    const loading = useSupervisionStore((s) => s.loading);

    return (
        <div className="flex h-full flex-col bg-slate-950 overflow-hidden">
            {/* Header / Banner */}
            <div className="relative overflow-hidden border-b border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-sky-500/5 blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
                
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30">
                            <ShieldCheck className="h-6 w-6 text-sky-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white uppercase">Presupuesto de Supervisión</h1>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-[0.2em]">Estructura detallada y cálculos automáticos</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Supervisión</span>
                            <span className="text-2xl font-black text-amber-400 font-mono tracking-tighter">
                                S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(rows[7]?.total || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calculations Quick Stats */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-800 bg-slate-900/30">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-sky-500/10 flex items-center justify-center text-sky-500">
                        <DollarSign size={16} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Costo Directo</p>
                        <p className="text-sm font-black text-slate-200 font-mono">S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(rows[2]?.total || 0)}</p>
                    </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Percent size={16} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Utilidad (5%)</p>
                        <p className="text-sm font-black text-emerald-400 font-mono">S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(rows[4]?.total || 0)}</p>
                    </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">IGV (18%)</p>
                        <p className="text-sm font-black text-purple-400 font-mono">S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(rows[6]?.total || 0)}</p>
                    </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Users size={16} />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Gastos Generales</p>
                        <p className="text-sm font-black text-amber-400 font-mono">S/. {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(rows[3]?.total || 0)}</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md shadow-lg border-b border-slate-700">
                        <tr>
                            <th className="py-3 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[500px]">Concepto</th>
                            <th className="py-3 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">Unidad</th>
                            <th className="py-3 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">Cantidad</th>
                            <th className="py-3 px-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">Meses</th>
                            <th className="py-3 px-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Precio Unit. (S/.)</th>
                            <th className="py-3 px-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Subtotal</th>
                            <th className="py-3 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-medium">
                        {rows.map((row, idx) => (
                            <SupervisionRowComponent 
                                key={idx} 
                                row={row} 
                                depth={0} 
                                path={[row.item]} 
                            />
                        ))}
                    </tbody>
                </table>

                {/* Footer Message */}
                <div className="p-8 flex flex-col items-center justify-center text-slate-600">
                    <Calculator className="h-8 w-8 mb-4 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Cálculos Finalizados</p>
                    <p className="text-[9px] italic">Los totales de las secciones III, V, VI, VII y VIII se derivan de fórmulas automáticas.</p>
                </div>
            </div>
        </div>
    );
}
