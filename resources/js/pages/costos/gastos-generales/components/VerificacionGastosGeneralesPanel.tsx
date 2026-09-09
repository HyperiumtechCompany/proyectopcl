import axios from 'axios';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatoMoneda } from '../lib/calculos';
import { verificarSnapshotGastosGenerales, type VerificacionItem } from '../lib/verificacion';

export function VerificacionGastosGeneralesPanel({ projectId }: { projectId: number }) {
    const [checks, setChecks] = useState<VerificacionItem[]>([]);
    const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    const verify = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/costos/proyectos/${projectId}/presupuesto/consolidado/snapshot`);
            const data = response.data?.data ?? {};
            setSnapshot(data);
            setChecks(verificarSnapshotGastosGenerales(data));
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void verify();
    }, [verify]);

    if (loading) {
        return <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verificando cálculos…</div>;
    }

    const allCorrect = checks.length > 0 && checks.every((item) => item.correcto);

    return (
        <div className="h-full overflow-auto bg-slate-950 p-3 sm:p-5">
            <div className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-sm font-black tracking-wide text-white uppercase">Verificación de Gastos Generales</h2>
                        <p className="mt-1 text-xs text-slate-400">Compara cada nivel de la cascada almacenada usando precisión decimal.</p>
                    </div>
                    <button type="button" onClick={() => void verify()} className="flex items-center justify-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 sm:ml-auto">
                        <RefreshCw className="h-3.5 w-3.5" />Actualizar
                    </button>
                </div>
                <div className={`border-b px-4 py-3 text-xs font-bold ${allCorrect ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300' : 'border-red-900 bg-red-950/40 text-red-300'}`}>
                    {allCorrect ? 'Todos los controles internos coinciden.' : 'Se encontraron diferencias que deben revisarse.'}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-xs">
                        <thead className="bg-slate-800 text-slate-400 uppercase"><tr><th className="px-3 py-2 text-left">Control</th><th className="px-3 py-2 text-right">Esperado</th><th className="px-3 py-2 text-right">Calculado</th><th className="px-3 py-2 text-right">Diferencia</th><th className="px-3 py-2 text-center">Estado</th></tr></thead>
                        <tbody className="divide-y divide-slate-800">
                            {checks.map((item) => <tr key={item.concepto} className="text-slate-300"><td className="px-3 py-2 font-semibold">{item.concepto}</td><td className="px-3 py-2 text-right font-mono">S/. {formatoMoneda.format(item.esperado)}</td><td className="px-3 py-2 text-right font-mono">S/. {formatoMoneda.format(item.calculado)}</td><td className="px-3 py-2 text-right font-mono">{formatoMoneda.format(item.diferencia)}</td><td className="px-3 py-2 text-center">{item.correcto ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" /> : <XCircle className="mx-auto h-4 w-4 text-red-400" />}</td></tr>)}
                        </tbody>
                    </table>
                </div>
                <div className="grid gap-2 border-t border-slate-800 p-4 text-xs sm:grid-cols-3">
                    <div className="rounded bg-slate-950 p-3"><span className="text-slate-500">Costo real Control Concurrente</span><strong className="mt-1 block font-mono text-slate-200">S/. {formatoMoneda.format(Number(snapshot?.total_control_concurrente ?? 0))}</strong></div>
                    <div className="rounded bg-slate-950 p-3"><span className="text-slate-500">Tope presupuestado</span><strong className="mt-1 block font-mono text-amber-300">S/. {formatoMoneda.format(Number(snapshot?.total_control_concurrente_financiado ?? 0))}</strong></div>
                    <div className="rounded bg-slate-950 p-3"><span className="text-slate-500">Total inversión</span><strong className="mt-1 block font-mono text-sky-300">S/. {formatoMoneda.format(Number(snapshot?.total_inversion_obra ?? 0))}</strong></div>
                </div>
            </div>
        </div>
    );
}
