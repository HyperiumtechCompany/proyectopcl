import React, { useMemo } from 'react';
import { Head } from '@inertiajs/react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ChartOptions,
    ChartData
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Registro avanzado de componentes para evitar errores de "scale not found"
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface Periodo {
    label: string;
    key: string;
}

interface Material {
    descripcion: string;
    unidad: string;
    precio: number;
    cantidad_total: number;
    mensual: Record<string, number>;
}

interface Props {
    project: string;
    materiales: Material[];
    periodos: Periodo[];
}

const CronogramaMateriales: React.FC<Props> = ({ project, materiales = [], periodos = [] }) => {
    
    // Memoizamos los datos del gráfico para que no se recalculen en cada renderizado (Optimización)
    const dataGrafico: ChartData<'bar'> = useMemo(() => {
        const valoresPorMes = periodos.map(p => {
            return materiales.reduce((sum, mat) => {
                const cantMes = mat.mensual[p.key] || 0;
                return sum + (cantMes * mat.precio);
            }, 0);
        });

        return {
            labels: periodos.map(p => p.label.toUpperCase()),
            datasets: [
                {
                    label: 'Inversión Mensual (S/.)',
                    data: valoresPorMes,
                    backgroundColor: 'rgba(30, 64, 175, 0.7)', // Azul fuerte
                    borderColor: 'rgb(30, 64, 175)',
                    borderWidth: 2,
                    borderRadius: 5,
                    hoverBackgroundColor: 'rgba(234, 88, 12, 0.8)', // Naranja al pasar el mouse
                },
            ],
        };
    }, [materiales, periodos]);

    const opcionesGrafico: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#e2e8f0' },
                ticks: { 
                    callback: (value) => 'S/. ' + Number(value).toLocaleString(),
                    font: { size: 11, weight: 'bold' }
                }
            },
            x: {
                grid: { display: false },
                ticks: { font: { size: 10, weight: 'bold' } }
            }
        },
        plugins: {
            legend: { display: false }, // Quitamos la leyenda para más espacio
            tooltip: {
                backgroundColor: '#1e293b',
                padding: 12,
                titleFont: { size: 14 },
                callbacks: {
                    label: (context) => ` Total Mes: S/. ${context.parsed.y ? context.parsed.y.toLocaleString() : '0'}`
                }
            }
        },
    };

    const totalGeneralInsumos = useMemo(() => 
        materiales.reduce((sum, m) => sum + (m.cantidad_total * m.precio), 0)
    , [materiales]);

    return (
        <div className="p-4 bg-[#f1f5f9] min-h-screen font-sans antialiased text-slate-900">
            <Head title="Cronograma de Insumos - Sistema Experto" />
            
            <div className="max-w-[1700px] mx-auto space-y-4">
                
                {/* CABECERA PROFESIONAL */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <span className="bg-blue-600 text-white p-1 rounded">MS</span> 
                            USO DE RECURSOS DEL PROYECTO
                        </h1>
                        <p className="text-slate-500 font-medium">ID Proyecto: {project} | Análisis de Insumos Programados</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presupuesto Total Materiales</p>
                        <p className="text-3xl font-black text-blue-700">S/. {totalGeneralInsumos.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                </div>

                {/* HISTOGRAMA DE RECURSOS */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-3 bg-white p-5 rounded-xl shadow-md border border-slate-200">
                        <div className="flex justify-between mb-4">
                            <h3 className="font-bold text-slate-700 uppercase text-sm">Histograma de Inversión en Materiales</h3>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">VALORES EN SOLES</span>
                        </div>
                        <div className="h-[250px]">
                            <Bar options={opcionesGrafico} data={dataGrafico} />
                        </div>
                    </div>
                    
                    {/* MINI RESUMEN LATERAL */}
                    <div className="bg-slate-800 p-5 rounded-xl shadow-md text-white flex flex-col justify-center">
                        <div className="space-y-4">
                            <div>
                                <p className="text-slate-400 text-xs uppercase">Total de Insumos</p>
                                <p className="text-2xl font-bold">{materiales.length} Registros</p>
                            </div>
                            <div className="pt-4 border-t border-slate-700">
                                <p className="text-slate-400 text-xs uppercase">Mes con mayor gasto</p>
                                <p className="text-xl font-bold text-orange-400">Pico de Obra</p>
                            </div>
                            <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xs transition">
                                GENERAR REPORTE PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* TABLA DE TIEMPO (ESTILO MS PROJECT) */}
                <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-300">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                        <table className="min-w-full border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="p-3 border-b border-r sticky left-0 bg-slate-50 z-30 min-w-[300px] text-left text-[11px] font-black uppercase text-slate-600">Descripción del Recurso</th>
                                    <th className="p-3 border-b border-r text-center text-[11px] font-black uppercase text-slate-600 w-16">Und</th>
                                    <th className="p-3 border-b border-r text-right text-[11px] font-black uppercase text-slate-600 w-28">Precio</th>
                                    <th className="p-3 border-b border-r text-right text-[11px] font-black uppercase text-blue-700 bg-blue-50 w-32">Cantidad Total</th>
                                    {periodos.map(p => (
                                        <th key={p.key} className="p-3 border-b border-r text-center text-[10px] font-black uppercase bg-slate-100 text-slate-500 min-w-[120px]">
                                            {p.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {materiales.map((mat, i) => (
                                    <tr key={i} className="group">
                                        <td className="p-3 border-b border-r sticky left-0 bg-white group-hover:bg-blue-50 font-bold z-20 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {mat.descripcion}
                                        </td>
                                        <td className="p-3 border-b border-r text-center text-slate-500 group-hover:bg-blue-50">{mat.unidad}</td>
                                        <td className="p-3 border-b border-r text-right font-mono group-hover:bg-blue-50">{new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mat.precio)}</td>
                                        <td className="p-3 border-b border-r text-right font-black text-blue-900 bg-blue-50/50 group-hover:bg-blue-100 transition-colors">
                                            {mat.cantidad_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        {periodos.map(p => {
                                            const valor = mat.mensual[p.key] || 0;
                                            return (
                                                <td key={p.key} className={`p-3 border-b border-r text-right font-mono transition-colors ${valor > 0 ? 'bg-white font-bold text-slate-900 group-hover:bg-orange-50' : 'text-slate-300 bg-slate-50/30'}`}>
                                                    {valor > 0 ? valor.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CronogramaMateriales;